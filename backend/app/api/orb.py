import os
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import DBBacktest, DBORBStrategyNifty50
from app.core.features.orb_feature_engineering import process_orb_features
from app.core.backtesting.orb_backtester import run_orb_backtest
from app.core.logging import get_logger

logger = get_logger("api.orb")
router = APIRouter()

class ORBProcessFeaturesRequest(BaseModel):
    filename: str = Field(..., description="Raw intraday CSV filename, e.g. reliance_5m.csv")

class ORBBacktestRequest(BaseModel):
    features_filename: str = Field(..., description="Processed features CSV filename, e.g. reliance_5m_orb_features.csv")
    raw_filename: str = Field(..., description="Raw intraday CSV filename, e.g. reliance_5m.csv")
    initial_capital: float = Field(default=1000000.0)
    rvol_threshold: float = Field(default=3.0)
    vix_filter: bool = Field(default=True)
    trailing_stop: bool = Field(default=True)
    transaction_cost_pct: float = Field(default=0.0005)
    risk_per_trade_pct: float = Field(default=0.01)
    atr_multiplier: float = Field(default=1.5)
    risk_reward_ratio: float = Field(default=3.0)

@router.post("/process-features")
async def api_process_features(payload: ORBProcessFeaturesRequest):
    logger.info(f"Received request to process ORB features for: {payload.filename}")
    try:
        result = await asyncio.to_thread(process_orb_features, payload.filename)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error processing ORB features")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backtest")
async def api_run_backtest(payload: ORBBacktestRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Received request to run ORB backtest on features: {payload.features_filename}")
    try:
        result = await asyncio.to_thread(
            run_orb_backtest,
            features_filename=payload.features_filename,
            raw_filename=payload.raw_filename,
            initial_capital=payload.initial_capital,
            rvol_threshold=payload.rvol_threshold,
            vix_filter=payload.vix_filter,
            trailing_stop=payload.trailing_stop,
            transaction_cost_pct=payload.transaction_cost_pct,
            risk_per_trade_pct=payload.risk_per_trade_pct,
            atr_multiplier=payload.atr_multiplier,
            risk_reward_ratio=payload.risk_reward_ratio
        )
        
        # Save backtest results to database
        if result.get("success") or "metrics" in result:
            symbol = payload.raw_filename.split('_')[0].upper()
            
            db_backtest = DBBacktest(
                model_id=None,
                symbol=symbol,
                model_type="ORB_RVOL",
                regime_aware=False,
                n_regimes=None,
                initial_capital=payload.initial_capital,
                short_style="short",
                total_return_pct=float(result['metrics']['total_return_pct']),
                cagr_pct=float(result['metrics']['cagr_pct']),
                sharpe_ratio=float(result['metrics']['sharpe_ratio']),
                max_drawdown_pct=float(result['metrics']['max_drawdown_pct']),
                win_rate_pct=float(result['metrics']['win_rate_pct']),
                trades_count=int(result['metrics']['trades_count']),
                metrics_json=result['metrics']
            )
            db.add(db_backtest)
            
            db_orb = DBORBStrategyNifty50(
                model_id=None,
                symbol=symbol,
                model_type="ORB_RVOL",
                regime_aware=False,
                n_regimes=None,
                initial_capital=payload.initial_capital,
                short_style="short",
                total_return_pct=float(result['metrics']['total_return_pct']),
                cagr_pct=float(result['metrics']['cagr_pct']),
                sharpe_ratio=float(result['metrics']['sharpe_ratio']),
                max_drawdown_pct=float(result['metrics']['max_drawdown_pct']),
                win_rate_pct=float(result['metrics']['win_rate_pct']),
                trades_count=int(result['metrics']['trades_count']),
                metrics_json=result['metrics']
            )
            db.add(db_orb)
            
            await db.commit()
            
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error running ORB backtest")
        raise HTTPException(status_code=500, detail=str(e))
