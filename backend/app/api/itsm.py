import os
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import DBTrainedModel, DBBacktest, DBITSMStrategy
from app.core.features.itsm_feature_engineering import process_itsm_features
from app.core.models.itsm_models import train_itsm_model
from app.core.backtesting.itsm_backtester import run_itsm_backtest
from app.config import MODELS_DIR
from app.core.logging import get_logger

logger = get_logger("api.itsm")
router = APIRouter()

class ITSMProcessFeaturesRequest(BaseModel):
    filename: str = Field(..., description="Raw intraday CSV filename, e.g. reliance_5m.csv")

class ITSMTrainRequest(BaseModel):
    filename: str = Field(..., description="Processed features CSV filename, e.g. reliance_5m_features.csv")
    model_type: str = Field('linear_regression', description="Model type: linear_regression, ridge, lasso, random_forest, xgboost")
    hyperparameters: dict = Field(default={})

class ITSMBacktestRequest(BaseModel):
    features_filename: str = Field(..., description="Processed features CSV filename, e.g. reliance_5m_features.csv")
    raw_filename: str = Field(..., description="Raw intraday CSV filename, e.g. reliance_5m.csv")
    model_filename: str = Field(..., description="Trained model PKL filename, e.g. itsm_reliance_linear_regression.pkl")
    initial_capital: float = Field(default=1000000.0)
    vix_filter: bool = Field(default=True)
    volume_filter: bool = Field(default=True)
    trend_filter: bool = Field(default=True)
    breadth_filter: bool = Field(default=False)
    trailing_stop: bool = Field(default=True)
    transaction_cost_pct: float = Field(default=0.0005)

@router.post("/process-features")
async def api_process_features(payload: ITSMProcessFeaturesRequest):
    logger.info(f"Received request to process features for raw file: {payload.filename}")
    try:
        result = await asyncio.to_thread(process_itsm_features, payload.filename)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error processing features")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train")
async def api_train_model(payload: ITSMTrainRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Received request to train ITSM model: {payload.model_type} on {payload.filename}")
    try:
        result = await asyncio.to_thread(
            train_itsm_model, 
            payload.filename, 
            payload.model_type, 
            payload.hyperparameters
        )
        
        if result.get("success"):
            symbol = payload.filename.split('_')[0].upper()
            model_filename = result["filename"]
            
            stmt = select(DBTrainedModel).where(
                DBTrainedModel.symbol == symbol,
                DBTrainedModel.model_type == f"ITSM_{payload.model_type.upper()}",
                DBTrainedModel.file_path == model_filename
            )
            db_res = await db.execute(stmt)
            db_model = db_res.scalars().first()
            
            if not db_model:
                db_model = DBTrainedModel(
                    symbol=symbol,
                    model_type=f"ITSM_{payload.model_type.upper()}",
                    regime_aware=False,
                    file_path=model_filename,
                    metrics_json=result.get("test_metrics", {}),
                    hyperparameters_json=payload.hyperparameters,
                    latest_signals_path=payload.filename
                )
                db.add(db_model)
            else:
                db_model.metrics_json = result.get("test_metrics", {})
                db_model.hyperparameters_json = payload.hyperparameters
                db_model.latest_signals_path = payload.filename
                
            await db.commit()
            
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error training model")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backtest")
async def api_run_backtest(payload: ITSMBacktestRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Received request to run ITSM backtest for model: {payload.model_filename}")
    try:
        result = await asyncio.to_thread(
            run_itsm_backtest,
            features_filename=payload.features_filename,
            raw_filename=payload.raw_filename,
            model_filename=payload.model_filename,
            initial_capital=payload.initial_capital,
            vix_filter=payload.vix_filter,
            volume_filter=payload.volume_filter,
            trend_filter=payload.trend_filter,
            breadth_filter=payload.breadth_filter,
            trailing_stop=payload.trailing_stop,
            transaction_cost_pct=payload.transaction_cost_pct
        )
        
        if result.get("success") or "metrics" in result:
            symbol = payload.raw_filename.split('_')[0].upper()
            
            stmt = select(DBTrainedModel).where(
                DBTrainedModel.symbol == symbol,
                DBTrainedModel.file_path == payload.model_filename
            )
            db_res = await db.execute(stmt)
            db_model = db_res.scalars().first()
            
            model_id = db_model.id if db_model else None
            model_type_suffix = payload.model_filename.split('_')[-1].replace('.pkl', '').upper()
            
            db_backtest = DBBacktest(
                model_id=model_id,
                symbol=symbol,
                model_type=f"ITSM_{model_type_suffix}",
                regime_aware=False,
                n_regimes=None,
                initial_capital=payload.initial_capital,
                short_style="flat",
                total_return_pct=float(result['metrics']['total_return_pct']),
                cagr_pct=float(result['metrics']['cagr_pct']),
                sharpe_ratio=float(result['metrics']['sharpe_ratio']),
                max_drawdown_pct=float(result['metrics']['max_drawdown_pct']),
                win_rate_pct=float(result['metrics']['win_rate_pct']),
                trades_count=int(result['metrics']['trades_count']),
                metrics_json=result['metrics']
            )
            db.add(db_backtest)
            
            db_itsm = DBITSMStrategy(
                model_id=model_id,
                symbol=symbol,
                model_type=f"ITSM_{model_type_suffix}",
                regime_aware=False,
                initial_capital=payload.initial_capital,
                total_return_pct=float(result['metrics']['total_return_pct']),
                cagr_pct=float(result['metrics']['cagr_pct']),
                sharpe_ratio=float(result['metrics']['sharpe_ratio']),
                sortino_ratio=float(result['metrics'].get('sortino_ratio', 0.0)),
                max_drawdown_pct=float(result['metrics']['max_drawdown_pct']),
                win_rate_pct=float(result['metrics']['win_rate_pct']),
                trades_count=int(result['metrics']['trades_count']),
                avg_trade_return_pct=float(result['metrics'].get('avg_trade_return_pct', 0.0)),
                metrics_json=result['metrics']
            )
            db.add(db_itsm)
            await db.commit()
            
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error running backtest")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def api_list_models():
    """List all trained ITSM models."""
    logger.debug("Listing all trained ITSM models")
    models = []
    if os.path.exists(MODELS_DIR):
        for f in os.listdir(MODELS_DIR):
            if f.startswith('itsm_') and f.endswith('.pkl'):
                parts = f.replace('.pkl', '').split('_')
                # Format: itsm_reliance_linear_regression
                symbol = parts[1].upper() if len(parts) > 1 else 'UNKNOWN'
                model_type = '_'.join(parts[2:]) if len(parts) > 2 else 'UNKNOWN'
                
                filepath = os.path.join(MODELS_DIR, f)
                stat = os.stat(filepath)
                
                models.append({
                    'filename': f,
                    'symbol': symbol,
                    'model_type': model_type,
                    'size_kb': round(stat.st_size / 1024, 1),
                    'modified': stat.st_mtime
                })
    return {"success": True, "models": models}
