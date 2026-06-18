import os
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
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
async def api_train_model(payload: ITSMTrainRequest):
    logger.info(f"Received request to train ITSM model: {payload.model_type} on {payload.filename}")
    try:
        result = await asyncio.to_thread(
            train_itsm_model, 
            payload.filename, 
            payload.model_type, 
            payload.hyperparameters
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Error training model")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backtest")
async def api_run_backtest(payload: ITSMBacktestRequest):
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
