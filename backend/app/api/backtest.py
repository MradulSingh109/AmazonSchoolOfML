import os
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.backtesting.backtester import run_backtest
from app.schemas.api_models import RunBacktestRequest
from app.config import PROCESSED_DIR
from app.core.logging import get_logger

logger = get_logger("api.backtest")
router = APIRouter()

def _run_backtest_sync(
    signal_filename: str,
    initial_capital: float,
    risk_free_rate: float,
    stop_loss: float,
    take_profit: float
) -> dict:
    signals_filepath = os.path.join(PROCESSED_DIR, signal_filename)
    if not os.path.exists(signals_filepath):
        raise FileNotFoundError(f"Signals file {signal_filename} not found.")

    df = pd.read_csv(signals_filepath)
    
    # Convert percent to decimal (e.g. 1.0% -> 0.01, 6.0% -> 0.06)
    stop_loss_pct = stop_loss / 100.0
    take_profit_pct = take_profit / 100.0

    # Run backtester
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

@router.post("/run")
async def api_run_backtest(payload: RunBacktestRequest):
    signal_filename = payload.signal_filename
    initial_capital = payload.initial_capital
    risk_free_rate = payload.risk_free_rate
    stop_loss = payload.stop_loss
    take_profit = payload.take_profit
    
    logger.info(f"Received request to run backtest: file={signal_filename}, capital={initial_capital}")
    
    try:
        result = await asyncio.to_thread(
            _run_backtest_sync,
            signal_filename,
            initial_capital,
            risk_free_rate,
            stop_loss,
            take_profit
        )
        logger.info(f"Successfully finished backtest run for {signal_filename}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Error executing backtest for {signal_filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing backtest: {str(e)}")
