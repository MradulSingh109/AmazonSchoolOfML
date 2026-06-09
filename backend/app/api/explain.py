import os
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.explainability.shap_explainer import calculate_shap_values
from app.schemas.api_models import ExplainRequest
from app.config import PROCESSED_DIR, MODELS_DIR

router = APIRouter()

@router.post("")
async def api_explain_model(payload: ExplainRequest):
    symbol = payload.symbol.lower()
    model_filename = payload.model_filename

    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    model_path = os.path.join(MODELS_DIR, model_filename)

    if not os.path.exists(features_path):
        raise HTTPException(
            status_code=404,
            detail=f"Processed dataset for {symbol.upper()} not found."
        )
    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model {model_filename} not found."
        )

    try:
        df = pd.read_csv(features_path)

        # Calculate SHAP values (last 250 samples for computation speed)
        results = calculate_shap_values(df, model_path, max_samples=250)

        if not results.get('success', False):
            raise HTTPException(
                status_code=400,
                detail=results.get('error', 'SHAP calculation failed.')
            )

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running SHAP explanation: {str(e)}")
