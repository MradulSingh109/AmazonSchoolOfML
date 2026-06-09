import os
import pickle
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.models.logistic_regression import train_logistic_regression
from app.core.models.random_forest import train_random_forest
from app.core.models.xgboost_model import train_xgboost
from app.schemas.api_models import TrainModelRequest
from app.config import PROCESSED_DIR, MODELS_DIR

router = APIRouter()

FEATURE_COLS = [
    'EMA50', 'RSI', 'MACD', 'ATR', 'Vol_Ratio', 'Return_1D',
    'HL_Spread', 'Close_Position',
    'RSI_Lag_1', 'RSI_Lag_2',
    'Return_1D_Lag_1', 'Return_1D_Lag_2',
    'MACD_Lag_1', 'MACD_Lag_2',
    'Vol_Ratio_Lag_1', 'Vol_Ratio_Lag_2'
]

@router.post("/train")
async def api_train_model(payload: TrainModelRequest):
    symbol = payload.symbol.lower()
    model_type = payload.model_type.lower()

    features_filepath = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    if not os.path.exists(features_filepath):
        raise HTTPException(
            status_code=404,
            detail=f"Engineered dataset for {symbol.upper()} not found. Run Feature Engineering first."
        )

    try:
        # Load dataset
        df = pd.read_csv(features_filepath)

        # Chronological train-test split (80% train, 20% test to prevent data leakage)
        split_idx = int(len(df) * 0.8)
        df_train = df.iloc[:split_idx].reset_index(drop=True)

        # Ensure all columns are present
        missing_cols = [col for col in FEATURE_COLS if col not in df_train.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Missing feature columns in dataset: {missing_cols}"
            )

        # Train model based on type (using df_train)
        if model_type == 'logistic_regression':
            result = train_logistic_regression(df_train, FEATURE_COLS)
        elif model_type == 'random_forest':
            result = train_random_forest(df_train, FEATURE_COLS)
        elif model_type == 'xgboost':
            result = train_xgboost(df_train, FEATURE_COLS)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported model type: {model_type}")

        # Save model and scaler metadata using pickle
        model_filename = f"{symbol}_{model_type}.pkl"
        model_filepath = os.path.join(MODELS_DIR, model_filename)

        model_data = {
            'model': result['model'],
            'scaler': result.get('scaler', None),
            'feature_cols': FEATURE_COLS,
            'metrics': result['metrics'],
            'feature_importance': result['feature_importance']
        }

        with open(model_filepath, 'wb') as f:
            pickle.dump(model_data, f)

        # Return response matching frontend expects
        return {
            'success': True,
            'message': f"Successfully trained {model_type.replace('_', ' ').title()} on {symbol.upper()}. Saved model to models/{model_filename}",
            'model_type': model_type,
            'symbol': symbol.upper(),
            'metrics': result['metrics'],
            'feature_importance': result['feature_importance'][:8], # top 8
            'predictions_sample': result['predictions'][:20],
            'probabilities_sample': result['probabilities'][:20]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

@router.get("/list")
async def api_list_models():
    models = []
    if os.path.exists(MODELS_DIR):
        for f in os.listdir(MODELS_DIR):
            if f.endswith('.pkl'):
                filepath = os.path.join(MODELS_DIR, f)
                try:
                    with open(filepath, 'rb') as file:
                        m_data = pickle.load(file)
                        
                        # Extract symbol from filename (e.g. rely_xgboost.pkl -> rely)
                        parts = f.replace('.pkl', '').split('_')
                        symbol = parts[0].upper()
                        model_type = '_'.join(parts[1:])

                        models.append({
                            'filename': f,
                            'symbol': symbol,
                            'model_type': model_type,
                            'metrics': m_data.get('metrics', {})
                        })
                except Exception as e:
                    print(f"Error reading model file {f}: {e}")
    return {'success': True, 'models': models}
