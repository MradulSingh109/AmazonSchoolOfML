"""
QuantML Research Platform - ORB-RVOL Intraday Backtesting Engine
Simulates ORB breakout entries, ATR/range stops, profit targets, 3-bar failed breakouts, and trailing stops.
"""

import os
import pandas as pd
import numpy as np
from app.config import PROCESSED_INTRADAY_DIR, RAW_INTRADAY_DIR
from app.core.logging import get_logger

logger = get_logger("backtesting.orb")

def run_orb_backtest(
    features_filename: str,
    raw_filename: str,
    initial_capital: float = 26000.0,
    rvol_threshold: float = 2.0,
    vix_filter: bool = True,
    trailing_stop: bool = True,
    transaction_cost_pct: float = 0.0003,
    risk_per_trade_pct: float = 0.01, # 1% risk per trade
    atr_multiplier: float = 1.5,
    risk_reward_ratio: float = 3.0
) -> dict:
    """
    Simulates the ORB-RVOL strategy over the historical dataset.
    """
    processed_path = os.path.join(PROCESSED_INTRADAY_DIR, features_filename)
    if not os.path.exists(processed_path):
        raise FileNotFoundError(f"Processed ORB features file not found: {features_filename}")
    features_df = pd.read_csv(processed_path)
    
    raw_path = os.path.join(RAW_INTRADAY_DIR, raw_filename)
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw intraday file not found: {raw_filename}")
    raw_df = pd.read_csv(raw_path)
    raw_df['Datetime'] = pd.to_datetime(raw_df['Datetime'])
    
    capital = initial_capital
    equity_curve = [initial_capital]
    dates = []
    daily_returns = []
    trades = []
    
    # Simulate day by day
    for idx, row in features_df.iterrows():
        date_str = str(row['Date'])
        dates.append(date_str)
        
        # 1. Check Filters
        qualified = True
        if row['rvol'] < rvol_threshold:
            qualified = False
        if vix_filter and row['vix'] < 11.0: # 20th percentile VIX proxy
            qualified = False
            
        if not qualified:
            daily_returns.append(0.0)
            equity_curve.append(capital)
            continue
            
        # Get raw 5m bars for today
        day_bars = raw_df[
            (raw_df['Datetime'].dt.strftime('%Y-%m-%d') == date_str)
        ].sort_values('Datetime').copy()
        
        if day_bars.empty:
            daily_returns.append(0.0)
            equity_curve.append(capital)
            continue
            
        h_or = float(row['h_or'])
        l_or = float(row['l_or'])
        orw_pct = float(row['orw_pct'])
        atr14 = float(row['atr14'])
        
        # Strategy variables
        in_position = None  # 'LONG', 'SHORT' or None
        entry_price = 0.0
        stop_price = 0.0
        target_price = 0.0
        quantity = 0
        consecutive_inside_bars = 0
        highest_close = 0.0
        lowest_close = 999999.0
        
        # Entry trigger state
        trigger_direction = None
        
        trade_entry_time = None
        trade_exit_time = None
        trade_exit_price = 0.0
        trade_stopped_out = False
        trade_pnl = 0.0
        
        # Iterate over bars from 09:20 onwards
        for _, bar in day_bars.iterrows():
            bar_time_str = bar['Datetime'].strftime('%H:%M')
            bar_datetime_str = bar['Datetime'].strftime('%Y-%m-%d %H:%M:%S')
            bar_open = float(bar['Open'])
            bar_high = float(bar['High'])
            bar_low = float(bar['Low'])
            bar_close = float(bar['Close'])
            
            # Skip the opening 09:15-09:20 range candle itself for triggers
            if bar_time_str <= '09:15':
                continue
                
            # If entry trigger was set on previous bar, execute entry at open of this bar
            if trigger_direction is not None and in_position is None:
                in_position = trigger_direction
                trigger_direction = None
                entry_price = bar_open
                trade_entry_time = bar_datetime_str
                
                # Stop loss calculation
                if orw_pct < 0.75: # Narrow Range Exception
                    stop_price = l_or if in_position == 'LONG' else h_or
                else: # Standard ATR stop
                    stop_price = entry_price - (atr_multiplier * atr14) if in_position == 'LONG' else entry_price + (atr_multiplier * atr14)
                
                R = abs(entry_price - stop_price)
                if R <= 0:
                    R = 0.01 * entry_price
                
                # Target
                target_price = entry_price + (risk_reward_ratio * R) if in_position == 'LONG' else entry_price - (risk_reward_ratio * R)
                
                # Position sizing (allocate maximum available capital)
                max_qty = int(capital / entry_price) if entry_price > 0 else 0
                quantity = max_qty
                
                if quantity <= 0:
                    # Cancel trade
                    in_position = None
                    break
                    
                highest_close = entry_price
                lowest_close = entry_price
                continue # Skip rest of this bar's processing for safety as it just opened
                
            if in_position is None:
                # We can only trigger entries up to 14:30
                if bar_time_str <= '14:30':
                    # Check Long entry
                    if bar_close > h_or and bar_low > h_or:
                        trigger_direction = 'LONG'
                    # Check Short entry
                    elif bar_close < l_or and bar_high < l_or:
                        trigger_direction = 'SHORT'
            else:
                # We are in position, monitor exits
                
                # 1. Stop Loss check
                if in_position == 'LONG':
                    if bar_low <= stop_price:
                        trade_exit_price = stop_price
                        trade_exit_time = bar_datetime_str
                        trade_stopped_out = True
                        break
                else: # SHORT
                    if bar_high >= stop_price:
                        trade_exit_price = stop_price
                        trade_exit_time = bar_datetime_str
                        trade_stopped_out = True
                        break
                        
                # 2. Profit Target check
                if in_position == 'LONG':
                    if bar_high >= target_price:
                        trade_exit_price = target_price
                        trade_exit_time = bar_datetime_str
                        break
                else: # SHORT
                    if bar_low <= target_price:
                        trade_exit_price = target_price
                        trade_exit_time = bar_datetime_str
                        break
                        
                # 3. Dynamic Trailing
                R = abs(entry_price - stop_price)
                if in_position == 'LONG':
                    # Breakeven trailing at 1.5R
                    if bar_close >= entry_price + (1.5 * R):
                        stop_price = max(stop_price, entry_price)
                    # ATR trailing at 2R
                    if trailing_stop and bar_close >= entry_price + (2.0 * R):
                        highest_close = max(highest_close, bar_close)
                        stop_price = max(stop_price, highest_close - atr14)
                else: # SHORT
                    # Breakeven trailing at 1.5R
                    if bar_close <= entry_price - (1.5 * R):
                        stop_price = min(stop_price, entry_price)
                    # ATR trailing at 2R
                    if trailing_stop and bar_close <= entry_price - (2.0 * R):
                        lowest_close = min(lowest_close, bar_close)
                        stop_price = min(stop_price, lowest_close + atr14)
                        
                # 4. Failed Breakout check (3 consecutive closes back inside opening range)
                if l_or < bar_close < h_or:
                    consecutive_inside_bars += 1
                else:
                    consecutive_inside_bars = 0
                    
                if consecutive_inside_bars >= 3:
                    trade_exit_price = bar_close
                    trade_exit_time = bar_datetime_str
                    break
                    
                # 5. End of Day mandatory exit at 15:15
                if bar_time_str >= '15:15':
                    trade_exit_price = bar_close
                    trade_exit_time = bar_datetime_str
                    break
                    
        # Post-day trade cleanup
        if in_position is not None:
            # If we were in position but didn't trigger an exit inside the loop (e.g. market closed early)
            if not trade_exit_time:
                last_bar = day_bars.iloc[-1]
                trade_exit_price = float(last_bar['Close'])
                trade_exit_time = last_bar['Datetime'].strftime('%Y-%m-%d %H:%M:%S')
                
            # Calculate PnL
            if in_position == 'LONG':
                gross_pnl = quantity * (trade_exit_price - entry_price)
            else:
                gross_pnl = quantity * (entry_price - trade_exit_price)
                
            turnover = quantity * (entry_price + trade_exit_price)
            brokerage = 40.0
            taxes = turnover * 0.0003
            slippage = turnover * transaction_cost_pct
            
            total_costs = brokerage + taxes + slippage
            net_pnl = gross_pnl - total_costs
            
            trade_ret_net = net_pnl / capital
            capital += net_pnl
            
            # Calculate SL percentage change (negative value representing price decrease/increase to stop loss)
            sl_change_pct = ((stop_price - entry_price) / entry_price) * 100.0 if in_position == 'LONG' else ((entry_price - stop_price) / entry_price) * 100.0
            
            daily_returns.append(trade_ret_net)
            equity_curve.append(capital)
            
            trades.append({
                'date': date_str,
                'direction': in_position,
                'entry_time': trade_entry_time,
                'exit_time': trade_exit_time,
                'entry_price': round(entry_price, 2),
                'exit_price': round(trade_exit_price, 2),
                'quantity': quantity,
                'stop_loss': round(stop_price, 2),
                'sl_change_pct': round(sl_change_pct, 2),
                'stopped_out': trade_stopped_out,
                'pnl': round(net_pnl, 2),
                'return_pct': round(trade_ret_net * 100, 4)
            })
        else:
            daily_returns.append(0.0)
            equity_curve.append(capital)
            
    # Calculate performance metrics
    n_days = len(features_df)
    n_years = n_days / 252.0 if n_days > 0 else 1.0
    
    total_return_pct = ((capital - initial_capital) / initial_capital) * 100.0
    cagr_pct = (((capital / initial_capital) ** (1.0 / n_years)) - 1.0) * 100.0 if n_days > 0 and capital > 0 else 0.0
    
    # Calculate Drawdown Curve
    eq_series = pd.Series(equity_curve)
    cum_max = eq_series.cummax()
    dd_pct = ((cum_max - eq_series) / cum_max) * 100.0
    max_drawdown_pct = dd_pct.max()
    
    # Sharpe Ratio
    daily_rets_arr = np.array(daily_returns)
    avg_daily_ret = np.mean(daily_rets_arr) if len(daily_rets_arr) > 0 else 0.0
    std_daily_ret = np.std(daily_rets_arr) if len(daily_rets_arr) > 0 else 1e-9
    
    # Annualized Sharpe (assuming 252 trading days)
    sharpe_ratio = (avg_daily_ret / (std_daily_ret + 1e-9)) * np.sqrt(252) if std_daily_ret > 0 else 0.0
    
    # Win rate
    wins = [t for t in trades if t['pnl'] > 0]
    win_rate_pct = (len(wins) / len(trades)) * 100.0 if len(trades) > 0 else 0.0
    
    # Average stop loss percentage change
    avg_stop_loss_pct = np.mean([abs(t['sl_change_pct']) for t in trades]) if len(trades) > 0 else 0.0
    
    return {
        'success': True,
        'metrics': {
            'total_return_pct': round(total_return_pct, 2),
            'cagr_pct': round(cagr_pct, 2),
            'max_drawdown_pct': round(max_drawdown_pct, 2),
            'sharpe_ratio': round(sharpe_ratio, 3),
            'trades_count': len(trades),
            'win_rate_pct': round(win_rate_pct, 2),
            'final_capital': round(capital, 2),
            'avg_stop_loss_pct': round(avg_stop_loss_pct, 2),
            'risk_reward_ratio': round(risk_reward_ratio, 2)
        },
        'trades': trades,
        'chart_data': {
            'dates': dates,
            'strategy_cum_return': [round(((e - initial_capital) / initial_capital * 100.0), 2) for e in equity_curve[1:]],
            'drawdown': [round(-d, 2) for d in dd_pct[1:]]
        }
    }
