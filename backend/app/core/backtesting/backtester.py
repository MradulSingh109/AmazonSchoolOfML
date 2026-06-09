"""
QuantML Research Platform - Backtesting Engine
Phase 7: Backtesting Engine

Calculates:
  - Daily Stock & Strategy Returns (shifting signal by 1 day to prevent leakage)
  - Cumulative Returns
  - Annualized Sharpe Ratio (risk-free rate = 5%)
  - Maximum Drawdown (MDD)
  - Trade-level statistics (win rate, average trade return)
"""

import pandas as pd
import numpy as np


def run_backtest(
    df: pd.DataFrame,
    risk_free_rate: float = 0.05,
    initial_capital: float = 100000.0,
    stop_loss_pct: float = 0.0,
    take_profit_pct: float = 0.0
) -> dict:
    """
    Run backtest simulation on model-generated signals with Stop-Loss and Take-Profit limits.

    Args:
        df: Input DataFrame containing 'Date', 'Close', and 'Signal' columns.
        risk_free_rate: Annual risk-free rate (default 5%).
        initial_capital: Starting portfolio value in rupees.
        stop_loss_pct: Percentage loss to exit position (0.0 to disable).
        take_profit_pct: Percentage profit to exit position (0.0 to disable).

    Returns:
        Dictionary containing overall metrics and daily curve data.
    """
    backtest_df = df.copy()

    # Sort chronologically to make sure returns are sequential
    backtest_df['Date'] = pd.to_datetime(backtest_df['Date'])
    backtest_df = backtest_df.sort_values('Date').reset_index(drop=True)

    # 1. Calculate Daily Returns
    backtest_df['Daily_Return'] = backtest_df['Close'].pct_change().fillna(0)

    # 2. Calculate Strategy Return and track Trades (with Stop-Loss and Take-Profit limits)
    backtest_df['Signal_Shifted'] = backtest_df['Signal'].shift(1).fillna(0)
    
    strategy_wealth = []
    trade_returns = []
    
    current_position = 0
    entry_price = 0.0
    entry_idx = 0
    has_stopped_out = False
    stop_out_pnl = 0.0
    
    running_capital = initial_capital
    trade_entry_capital = initial_capital
    
    for i in range(len(backtest_df)):
        daily_ret = backtest_df.loc[i, 'Daily_Return']
        close_price = backtest_df.loc[i, 'Close']
        sig_shifted = backtest_df.loc[i, 'Signal_Shifted']
        date_str = backtest_df.loc[i, 'Date'].strftime('%Y-%m-%d')
        
        # If flat and signal triggers, start position
        if current_position == 0 and sig_shifted != 0:
            current_position = sig_shifted
            entry_price = backtest_df.loc[i-1, 'Close'] if i > 0 else backtest_df.loc[0, 'Close']
            entry_idx = i - 1 if i > 0 else 0
            has_stopped_out = False
            trade_entry_capital = running_capital
            
        # Daily wealth evaluation
        if current_position != 0:
            if not has_stopped_out:
                if current_position == 1:
                    pnl = (close_price - entry_price) / entry_price
                else:
                    pnl = (entry_price - close_price) / entry_price
                    
                # 1. Check Stop Loss
                if stop_loss_pct > 0 and pnl <= -stop_loss_pct:
                    trade_returns.append({
                        'entry_date': backtest_df.loc[entry_idx, 'Date'].strftime('%Y-%m-%d'),
                        'exit_date': date_str,
                        'direction': 'LONG' if current_position == 1 else 'SHORT',
                        'entry_price': float(entry_price),
                        'exit_price': float(entry_price * (1 - stop_loss_pct) if current_position == 1 else entry_price * (1 + stop_loss_pct)),
                        'return': float(-stop_loss_pct)
                    })
                    has_stopped_out = True
                    stop_out_pnl = -stop_loss_pct
                    running_capital = trade_entry_capital * (1 - stop_loss_pct)
                    today_wealth = running_capital
                    
                # 2. Check Take Profit
                elif take_profit_pct > 0 and pnl >= take_profit_pct:
                    trade_returns.append({
                        'entry_date': backtest_df.loc[entry_idx, 'Date'].strftime('%Y-%m-%d'),
                        'exit_date': date_str,
                        'direction': 'LONG' if current_position == 1 else 'SHORT',
                        'entry_price': float(entry_price),
                        'exit_price': float(entry_price * (1 + take_profit_pct) if current_position == 1 else entry_price * (1 - take_profit_pct)),
                        'return': float(take_profit_pct)
                    })
                    has_stopped_out = True
                    stop_out_pnl = take_profit_pct
                    running_capital = trade_entry_capital * (1 + take_profit_pct)
                    today_wealth = running_capital
                    
                # 3. Check normal exit or signal change
                elif sig_shifted != current_position or i == len(backtest_df) - 1:
                    trade_returns.append({
                        'entry_date': backtest_df.loc[entry_idx, 'Date'].strftime('%Y-%m-%d'),
                        'exit_date': date_str,
                        'direction': 'LONG' if current_position == 1 else 'SHORT',
                        'entry_price': float(entry_price),
                        'exit_price': float(close_price),
                        'return': float(pnl)
                    })
                    running_capital = trade_entry_capital * (1 + pnl)
                    today_wealth = running_capital
                    
                    # Setup next position
                    current_position = sig_shifted
                    if sig_shifted != 0:
                        entry_price = close_price
                        entry_idx = i
                        has_stopped_out = False
                        trade_entry_capital = running_capital
                else:
                    # Normal hold day
                    today_wealth = trade_entry_capital * (1 + pnl)
            else:
                # Already stopped out during this hold period (waiting for signal change to go flat/switch)
                today_wealth = trade_entry_capital * (1 + stop_out_pnl)
                
                # Check for signal change to release the lock and setup next position
                if sig_shifted != current_position or i == len(backtest_df) - 1:
                    current_position = sig_shifted
                    if sig_shifted != 0:
                        entry_price = close_price
                        entry_idx = i
                        has_stopped_out = False
                        trade_entry_capital = running_capital
        else:
            # Flat
            today_wealth = running_capital
            
        strategy_wealth.append(today_wealth)
            
    backtest_df['Strategy_Wealth'] = strategy_wealth
    backtest_df['Strategy_Return'] = backtest_df['Strategy_Wealth'].pct_change().fillna(0)
    backtest_df['Stock_Wealth'] = initial_capital * (1 + backtest_df['Daily_Return']).cumprod()

    backtest_df['Cum_Stock_Return'] = (backtest_df['Stock_Wealth'] / initial_capital) - 1
    backtest_df['Cum_Strategy_Return'] = (backtest_df['Strategy_Wealth'] / initial_capital) - 1

    # 4. Calculate Drawdown
    backtest_df['Strategy_Peak'] = backtest_df['Strategy_Wealth'].cummax()
    backtest_df['Strategy_Drawdown'] = (backtest_df['Strategy_Wealth'] - backtest_df['Strategy_Peak']) / backtest_df['Strategy_Peak']

    backtest_df['Stock_Peak'] = backtest_df['Stock_Wealth'].cummax()
    backtest_df['Stock_Drawdown'] = (backtest_df['Stock_Wealth'] - backtest_df['Stock_Peak']) / backtest_df['Stock_Peak']

    max_drawdown = float(backtest_df['Strategy_Drawdown'].min())
    stock_max_drawdown = float(backtest_df['Stock_Drawdown'].min())

    # 5. Calculate Sharpe Ratio (Annualized)
    daily_rf = risk_free_rate / 252
    excess_returns = backtest_df['Strategy_Return'] - daily_rf
    mean_excess = excess_returns.mean()
    std_excess = excess_returns.std()

    if std_excess > 0:
        sharpe_ratio = float((mean_excess / std_excess) * np.sqrt(252))
    else:
        sharpe_ratio = 0.0

    stock_excess = backtest_df['Daily_Return'] - daily_rf
    stock_std = stock_excess.std()
    stock_sharpe = float((stock_excess.mean() / stock_std) * np.sqrt(252)) if stock_std > 0 else 0.0

    # 6. Trade-Level Statistics Summary
    trades_count = len(trade_returns)
    winning_trades = [t for t in trade_returns if t['return'] > 0]
    win_rate = float(len(winning_trades) / trades_count) if trades_count > 0 else 0.0
    avg_trade_return = float(np.mean([t['return'] for t in trade_returns])) if trades_count > 0 else 0.0

    # Calculate running capital per trade
    running_capital = initial_capital
    for t in trade_returns:
        exit_cap = running_capital * (1 + t['return'])
        t['entry_capital'] = float(running_capital)
        t['exit_capital'] = float(exit_cap)
        running_capital = exit_cap

    # Annualized Returns (CAGR)
    n_days = len(backtest_df)
    n_years = n_days / 252
    
    final_stock_wealth = float(backtest_df['Stock_Wealth'].iloc[-1])
    final_strategy_wealth = float(backtest_df['Strategy_Wealth'].iloc[-1])

    cagr_stock = float((final_stock_wealth / initial_capital) ** (1 / n_years) - 1) if n_years > 0 else 0.0
    cagr_strategy = float((final_strategy_wealth / initial_capital) ** (1 / n_years) - 1) if n_years > 0 else 0.0

    metrics = {
        'initial_capital': initial_capital,
        'final_stock_value': final_stock_wealth,
        'final_strategy_value': final_strategy_wealth,
        'stock_total_return': float(backtest_df['Cum_Stock_Return'].iloc[-1]),
        'strategy_total_return': float(backtest_df['Cum_Strategy_Return'].iloc[-1]),
        'stock_cagr': cagr_stock,
        'strategy_cagr': cagr_strategy,
        'stock_max_drawdown': stock_max_drawdown,
        'strategy_max_drawdown': max_drawdown,
        'stock_sharpe': stock_sharpe,
        'strategy_sharpe': sharpe_ratio,
        'trades_count': trades_count,
        'win_rate': win_rate,
        'avg_trade_return': avg_trade_return
    }

    # Format Date back to string for response
    backtest_df['Date'] = backtest_df['Date'].dt.strftime('%Y-%m-%d')

    return {
        'metrics': metrics,
        'trades': trade_returns, # Return all trades
        'chart_data': {
            'dates': backtest_df['Date'].tolist(),
            'stock_cum_return': (backtest_df['Cum_Stock_Return'] * 100).round(2).tolist(),
            'strategy_cum_return': (backtest_df['Cum_Strategy_Return'] * 100).round(2).tolist(),
            'drawdown': (backtest_df['Strategy_Drawdown'] * 100).round(2).tolist(),
            'stock_drawdown': (backtest_df['Stock_Drawdown'] * 100).round(2).tolist()
        }
    }
