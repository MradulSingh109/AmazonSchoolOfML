"""
QuantML Research Platform - ITSM Intraday Backtesting Engine
Simulates intraday trade path with dynamic ATR stops, trailing stops, and transaction costs.
"""

import os
import pickle
import pandas as pd
import numpy as np
from app.config import PROCESSED_INTRADAY_DIR, RAW_INTRADAY_DIR
from app.core.logging import get_logger

logger = get_logger("backtesting.itsm")

def run_itsm_backtest(
    features_filename: str,
    raw_filename: str,
    model_filename: str,
    initial_capital: float = 1000000.0,
    vix_filter: bool = True,
    volume_filter: bool = True,
    trend_filter: bool = True,
    breadth_filter: bool = False,
    trailing_stop: bool = True,
    transaction_cost_pct: float = 0.0005, # 0.05% slippage + brokerage
    risk_per_trade_pct: float = 0.02 # 2% risk
) -> dict:
    """
    Simulates the ITSM strategy over the historical dataset.
    """
    # Load processed features
    processed_path = os.path.join(PROCESSED_INTRADAY_DIR, features_filename)
    if not os.path.exists(processed_path):
        raise FileNotFoundError(f"Processed features file not found: {features_filename}")
    features_df = pd.read_csv(processed_path)
    
    # Load raw 5m bars
    raw_path = os.path.join(RAW_INTRADAY_DIR, raw_filename)
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw intraday file not found: {raw_filename}")
    raw_df = pd.read_csv(raw_path)
    raw_df['Datetime'] = pd.to_datetime(raw_df['Datetime'])
    
    # Load model
    from app.config import MODELS_DIR
    model_path = os.path.join(MODELS_DIR, model_filename)
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_filename}")
        
    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)
        
    model = model_data['model']
    feature_cols = model_data['feature_cols']
    
    # Predict LH return for all days
    X = features_df[feature_cols].values
    features_df['predicted_lh'] = model.predict(X)
    
    # Track states
    capital = initial_capital
    equity_curve = [initial_capital]
    dates = []
    daily_returns = []
    trades = []
    
    # We simulate day by day
    for idx, row in features_df.iterrows():
        date_str = str(row['Date'])
        dates.append(date_str)
        
        # 1. Calculate Signal
        predicted_lh = row['predicted_lh']
        theta = 0.5 * row['intraday_volatility']
        
        # Base direction signal
        signal = 0
        if predicted_lh > theta:
            signal = 1
        elif predicted_lh < -theta:
            signal = -1
            
        # Apply filters
        if signal != 0:
            if vix_filter and row['vix'] <= 15:
                signal = 0
            if volume_filter and row['relative_volume'] <= 1.2:
                signal = 0
            if trend_filter:
                if signal == 1 and row['p_1440'] <= row['vwap_1440']:
                    signal = 0
                elif signal == -1 and row['p_1440'] >= row['vwap_1440']:
                    signal = 0
            if breadth_filter:
                if signal == 1 and row['breadth'] <= 1.2:
                    signal = 0
                elif signal == -1 and row['breadth'] >= 0.8:
                    signal = 0
                    
        # If no signal, daily return is 0, capital stays constant
        if signal == 0:
            daily_returns.append(0.0)
            equity_curve.append(capital)
            continue
            
        # 2. Simulate Trade
        direction = 'LONG' if signal == 1 else 'SHORT'
        entry_price = float(row['p_1440'])
        exit_price_baseline = float(row['p_1510'])
        atr = float(row['atr14'])
        
        # Stop loss distance and sizing
        stop_dist = 0.75 * atr if atr > 0 else 0.01 * entry_price
        stop_price = entry_price - stop_dist if signal == 1 else entry_price + stop_dist
        
        # Position sizing (risk 2% of current capital, capped by cash/no leverage)
        risk_amount = capital * risk_per_trade_pct
        raw_qty = int(risk_amount / stop_dist) if stop_dist > 0 else 1
        max_qty = int(capital / entry_price) if entry_price > 0 else 0
        quantity = min(raw_qty, max_qty)
        
        # If we cannot afford even 1 share with our capital, skip this trade
        if quantity <= 0:
            daily_returns.append(0.0)
            equity_curve.append(capital)
            continue
            
        # Filter raw 5m bars for this specific day between 14:45 and 15:10
        day_bars = raw_df[
            (raw_df['Datetime'].dt.strftime('%Y-%m-%d') == date_str) &
            (raw_df['Datetime'].dt.strftime('%H:%M') > '14:40') &
            (raw_df['Datetime'].dt.strftime('%H:%M') <= '15:10')
        ].sort_values('Datetime')
        
        # Simulate path to check stop loss
        stopped_out = False
        stop_hit_time = None
        current_stop = stop_price
        highest_price = entry_price
        lowest_price = entry_price
        
        final_exit_price = exit_price_baseline
        final_exit_time = f"{date_str} 15:10:00"
        
        for _, bar in day_bars.iterrows():
            bar_high = float(bar['High'])
            bar_low = float(bar['Low'])
            bar_close = float(bar['Close'])
            bar_time_str = bar['Datetime'].strftime('%Y-%m-%d %H:%M:%S')
            
            if signal == 1: # Long
                # Trailing stop update
                if trailing_stop and bar_close > highest_price:
                    highest_price = bar_close
                    current_stop = max(current_stop, highest_price - stop_dist)
                    
                # Check stop loss
                if bar_low <= current_stop:
                    stopped_out = True
                    final_exit_price = current_stop
                    final_exit_time = bar_time_str
                    break
            else: # Short
                # Trailing stop update
                if trailing_stop and bar_close < lowest_price:
                    lowest_price = bar_close
                    current_stop = min(current_stop, lowest_price + stop_dist)
                    
                # Check stop loss
                if bar_high >= current_stop:
                    stopped_out = True
                    final_exit_price = current_stop
                    final_exit_time = bar_time_str
                    break
                    
        # Calculate gross PnL based on actual quantity
        if signal == 1:
            gross_pnl = quantity * (final_exit_price - entry_price)
        else:
            gross_pnl = quantity * (entry_price - final_exit_price)
            
        # Calculate overall turnover for taxes and slippage
        turnover = quantity * (entry_price + final_exit_price)
        
        # Charges
        brokerage = 40.0
        taxes = turnover * 0.000003 # 0.0003% transaction tax
        slippage = turnover * transaction_cost_pct
        
        total_costs = brokerage + taxes + slippage
        pnl = gross_pnl - total_costs
        
        # Net return relative to the capital pool
        trade_ret_net = pnl / capital
        
        # Update capital
        prev_capital = capital
        capital += pnl
        daily_returns.append(trade_ret_net)
        equity_curve.append(capital)
        
        trades.append({
            'date': date_str,
            'direction': direction,
            'entry_time': f"{date_str} 14:40:00",
            'exit_time': final_exit_time,
            'entry_price': round(entry_price, 2),
            'exit_price': round(final_exit_price, 2),
            'quantity': quantity,
            'stop_loss': round(stop_price, 2),
            'stopped_out': stopped_out,
            'pnl': round(pnl, 2),
            'return_pct': round(trade_ret_net * 100, 4)
        })
        
    # Calculate performance metrics
    n_days = len(features_df)
    n_years = n_days / 252.0 if n_days > 0 else 1.0
    
    total_return_pct = (capital - initial_capital) / initial_capital
    cagr = (capital / initial_capital) ** (1.0 / n_years) - 1.0 if n_years > 0 and capital > 0 else 0.0
    
    # Daily returns statistics
    daily_returns_arr = np.array(daily_returns)
    win_rate = float(np.sum(daily_returns_arr > 0) / len(trades)) if len(trades) > 0 else 0.0
    
    # Annualized Sharpe (RF = 5%)
    daily_rf = 0.05 / 252.0
    excess_returns = daily_returns_arr - daily_rf
    mean_excess = np.mean(excess_returns)
    std_excess = np.std(excess_returns)
    sharpe = float((mean_excess / std_excess) * np.sqrt(252)) if std_excess > 0 else 0.0
    
    # Drawdown Curve
    equity_curve_arr = np.array(equity_curve)
    peaks = np.maximum.accumulate(equity_curve_arr)
    drawdowns = (equity_curve_arr - peaks) / (peaks + 1e-9)
    max_dd = float(np.min(drawdowns))
    
    # Sortino (Downside risk)
    downside_returns = daily_returns_arr[daily_returns_arr < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0.0
    sortino = float(np.mean(daily_returns_arr) / downside_std * np.sqrt(252)) if downside_std > 0 else 0.0
    
    metrics = {
        'initial_capital': initial_capital,
        'final_capital': capital,
        'total_return_pct': round(total_return_pct * 100, 2),
        'cagr_pct': round(cagr * 100, 2),
        'sharpe_ratio': round(sharpe, 2),
        'sortino_ratio': round(sortino, 2),
        'max_drawdown_pct': round(max_dd * 100, 2),
        'trades_count': len(trades),
        'win_rate_pct': round(win_rate * 100, 2),
        'avg_trade_return_pct': round(float(np.mean([t['return_pct'] for t in trades])), 2) if len(trades) > 0 else 0.0
    }
    
    # Format chart data
    chart_data = {
        'dates': dates,
        'strategy_cum_return': ((equity_curve_arr[1:] - initial_capital) / initial_capital * 100).round(2).tolist(),
        'drawdown': (drawdowns[1:] * 100).round(2).tolist()
    }
    
    return {
        'success': True,
        'metrics': metrics,
        'trades': trades,
        'chart_data': chart_data
    }
