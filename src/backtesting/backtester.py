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
    initial_capital: float = 100000.0
) -> dict:
    """
    Run backtest simulation on model-generated signals.

    Args:
        df: Input DataFrame containing 'Date', 'Close', and 'Signal' columns.
        risk_free_rate: Annual risk-free rate (default 5%).
        initial_capital: Starting portfolio value in rupees.

    Returns:
        Dictionary containing overall metrics and daily curve data.
    """
    backtest_df = df.copy()

    # Sort chronologically to make sure returns are sequential
    backtest_df['Date'] = pd.to_datetime(backtest_df['Date'])
    backtest_df = backtest_df.sort_values('Date').reset_index(drop=True)

    # 1. Calculate Daily Returns
    backtest_df['Daily_Return'] = backtest_df['Close'].pct_change().fillna(0)

    # 2. Calculate Strategy Return (shift signal by 1 to prevent lookahead bias)
    # The signal generated at day t is executed on day t+1
    backtest_df['Signal_Shifted'] = backtest_df['Signal'].shift(1).fillna(0)
    backtest_df['Strategy_Return'] = backtest_df['Signal_Shifted'] * backtest_df['Daily_Return']

    # 3. Calculate Cumulative Wealth & Returns
    backtest_df['Stock_Wealth'] = initial_capital * (1 + backtest_df['Daily_Return']).cumprod()
    backtest_df['Strategy_Wealth'] = initial_capital * (1 + backtest_df['Strategy_Return']).cumprod()

    backtest_df['Cum_Stock_Return'] = (backtest_df['Stock_Wealth'] / initial_capital) - 1
    backtest_df['Cum_Strategy_Return'] = (backtest_df['Strategy_Wealth'] / initial_capital) - 1

    # 4. Calculate Drawdown
    # Peak wealth up to day t
    backtest_df['Strategy_Peak'] = backtest_df['Strategy_Wealth'].cummax()
    backtest_df['Strategy_Drawdown'] = (backtest_df['Strategy_Wealth'] - backtest_df['Strategy_Peak']) / backtest_df['Strategy_Peak']

    backtest_df['Stock_Peak'] = backtest_df['Stock_Wealth'].cummax()
    backtest_df['Stock_Drawdown'] = (backtest_df['Stock_Wealth'] - backtest_df['Stock_Peak']) / backtest_df['Stock_Peak']

    max_drawdown = float(backtest_df['Strategy_Drawdown'].min())
    stock_max_drawdown = float(backtest_df['Stock_Drawdown'].min())

    # 5. Calculate Sharpe Ratio (Annualized)
    # 252 trading days per year
    daily_rf = risk_free_rate / 252
    excess_returns = backtest_df['Strategy_Return'] - daily_rf
    mean_excess = excess_returns.mean()
    std_excess = excess_returns.std()

    if std_excess > 0:
        sharpe_ratio = float((mean_excess / std_excess) * np.sqrt(252))
    else:
        sharpe_ratio = 0.0

    # Stock Sharpe for comparison
    stock_excess = backtest_df['Daily_Return'] - daily_rf
    stock_std = stock_excess.std()
    stock_sharpe = float((stock_excess.mean() / stock_std) * np.sqrt(252)) if stock_std > 0 else 0.0

    # 6. Trade-Level Statistics
    # Track trade entry/exits where position shifts
    trade_returns = []
    current_position = 0
    entry_price = 0.0
    entry_idx = 0

    for i in range(len(backtest_df)):
        sig = backtest_df.loc[i, 'Signal']
        price = backtest_df.loc[i, 'Close']

        # Position changed or last day of backtest
        if sig != current_position or i == len(backtest_df) - 1:
            # If we were in a position, close it out and calculate return
            if current_position != 0:
                trade_return = 0.0
                if current_position == 1: # Long
                    trade_return = (price - entry_price) / entry_price
                elif current_position == -1: # Short
                    trade_return = (entry_price - price) / entry_price
                
                trade_returns.append({
                    'entry_date': backtest_df.loc[entry_idx, 'Date'].strftime('%Y-%m-%d'),
                    'exit_date': backtest_df.loc[i, 'Date'].strftime('%Y-%m-%d'),
                    'direction': 'LONG' if current_position == 1 else 'SHORT',
                    'return': float(trade_return)
                })
            
            # Open new position
            current_position = sig
            entry_price = price
            entry_idx = i

    trades_count = len(trade_returns)
    winning_trades = [t for t in trade_returns if t['return'] > 0]
    win_rate = float(len(winning_trades) / trades_count) if trades_count > 0 else 0.0
    avg_trade_return = float(np.mean([t['return'] for t in trade_returns])) if trades_count > 0 else 0.0

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
        'trades': trade_returns[:50], # Return first 50 trades list
        'chart_data': {
            'dates': backtest_df['Date'].tolist(),
            'stock_cum_return': (backtest_df['Cum_Stock_Return'] * 100).round(2).tolist(),
            'strategy_cum_return': (backtest_df['Cum_Strategy_Return'] * 100).round(2).tolist(),
            'drawdown': (backtest_df['Strategy_Drawdown'] * 100).round(2).tolist(),
            'stock_drawdown': (backtest_df['Stock_Drawdown'] * 100).round(2).tolist()
        }
    }
