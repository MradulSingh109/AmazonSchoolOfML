import os
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.backtesting.backtester import run_backtest
from app.schemas.api_models import RunBacktestRequest
from app.config import PROCESSED_DIR

router = APIRouter()

@router.post("/run")
async def api_run_backtest(payload: RunBacktestRequest):
    signal_filename = payload.signal_filename
    initial_capital = payload.initial_capital
    risk_free_rate = payload.risk_free_rate
    stop_loss = payload.stop_loss
    take_profit = payload.take_profit

    signals_filepath = os.path.join(PROCESSED_DIR, signal_filename)
    if not os.path.exists(signals_filepath):
        raise HTTPException(
            status_code=404,
            detail=f"Signals file {signal_filename} not found."
        )

    try:
        df = pd.read_csv(signals_filepath)
        
        # Convert percent to decimal (e.g. 1.0% -> 0.01, 6.0% -> 0.06)
        stop_loss_pct = stop_loss / 100.0
        take_profit_pct = take_profit / 100.0

        # Run backtester with correct positional parameters:
        # run_backtest(df, risk_free_rate, initial_capital, stop_loss_pct, take_profit_pct)
        result = run_backtest(
            df,
            risk_free_rate,
            initial_capital,
            stop_loss_pct,
            take_profit_pct
        )

        return {
            'success': True,
            'message': 'Backtest execution completed.',
            'metrics': result['metrics'],
            'trades': result['trades'],
            'chart_data': result['chart_data']
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing backtest: {str(e)}")
