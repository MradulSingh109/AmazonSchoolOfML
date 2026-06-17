import os
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import DBTrainedModel, DBBacktest
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
async def api_run_backtest(payload: RunBacktestRequest, db: AsyncSession = Depends(get_db)):
    signal_filename = payload.signal_filename
    initial_capital = payload.initial_capital
    risk_free_rate = payload.risk_free_rate
    stop_loss = payload.stop_loss
    take_profit = payload.take_profit
    
    logger.info(f"Received request to run backtest: file={signal_filename}, capital={initial_capital}")
    
    # 1. Look up the matching trained model in the database
    symbol = signal_filename.split('_')[0].upper()
    stmt = select(DBTrainedModel).where(DBTrainedModel.latest_signals_path == signal_filename)
    db_res = await db.execute(stmt)
    db_model = db_res.scalars().first()
    
    if not db_model:
        # Fallback: Find the most recent model for the symbol
        stmt_fallback = select(DBTrainedModel).where(DBTrainedModel.symbol == symbol).order_by(DBTrainedModel.created_at.desc())
        db_res_fallback = await db.execute(stmt_fallback)
        db_model = db_res_fallback.scalars().first()
        
    if not db_model:
        raise HTTPException(
            status_code=404, 
            detail=f"No trained model found associated with signals file '{signal_filename}'. Please train a model first."
        )
    
    try:
        # 2. Run the backtest simulation in a background thread
        result = await asyncio.to_thread(
            _run_backtest_sync,
            signal_filename,
            initial_capital,
            risk_free_rate,
            stop_loss,
            take_profit
        )
        logger.info(f"Successfully finished backtest run for {signal_filename}")
        
        # 3. Save the backtest metrics to the database
        short_style = "short" if any(t.get('direction') == 'SHORT' for t in result.get('trades', [])) else "flat"
        
        # Extract number of regimes if the model is regime-aware
        n_regimes = None
        if db_model.regime_aware:
            from app.config import MODELS_DIR
            import pickle
            model_filepath = os.path.join(MODELS_DIR, db_model.file_path)
            if os.path.exists(model_filepath):
                try:
                    with open(model_filepath, 'rb') as f:
                        m_data = pickle.load(f)
                        if isinstance(m_data.get('model'), dict):
                            n_regimes = len(m_data['model'])
                except Exception as e:
                    logger.error(f"Failed to read n_regimes from pickle: {e}")
                    
        db_backtest = DBBacktest(
            model_id=db_model.id,
            symbol=db_model.symbol,
            model_type=db_model.model_type,
            regime_aware=db_model.regime_aware,
            n_regimes=n_regimes,
            initial_capital=initial_capital,
            short_style=short_style,
            total_return_pct=float(result['metrics']['strategy_total_return'] * 100),
            cagr_pct=float(result['metrics']['strategy_cagr'] * 100),
            sharpe_ratio=float(result['metrics']['strategy_sharpe']),
            max_drawdown_pct=float(result['metrics']['strategy_max_drawdown'] * 100),
            win_rate_pct=float(result['metrics']['win_rate'] * 100),
            trades_count=int(result['metrics']['trades_count']),
            metrics_json=result['metrics']
        )
        db.add(db_backtest)
        await db.commit()
        
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Error executing backtest for {signal_filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing backtest: {str(e)}")
