import os
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.explainability.shap_explainer import calculate_shap_values
from app.schemas.api_models import ExplainRequest
from app.config import PROCESSED_DIR, MODELS_DIR
from app.core.logging import get_logger

logger = get_logger("api.explain")
router = APIRouter()

def _explain_model_sync(symbol: str, model_filename: str) -> dict:
    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    model_path = os.path.join(MODELS_DIR, model_filename)

    if not os.path.exists(features_path):
        raise FileNotFoundError(f"Processed dataset for {symbol.upper()} not found.")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model {model_filename} not found.")

    df = pd.read_csv(features_path)

    # Calculate SHAP values (last 250 samples for computation speed)
    results = calculate_shap_values(df, model_path, max_samples=250)

    if not results.get('success', False):
        raise ValueError(results.get('error', 'SHAP calculation failed.'))

    return results

@router.post("")
async def api_explain_model(payload: ExplainRequest):
    symbol = payload.symbol.lower()
    model_filename = payload.model_filename
    
    logger.info(f"Received SHAP explanation request: symbol={symbol}, model={model_filename}")
    
    try:
        result = await asyncio.to_thread(_explain_model_sync, symbol, model_filename)
        logger.info(f"Successfully calculated SHAP explanation for {symbol}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error running SHAP explanation for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error running SHAP explanation: {str(e)}")
