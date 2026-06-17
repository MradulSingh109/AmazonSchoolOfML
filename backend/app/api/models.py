import os
import pickle
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.models.logistic_regression import train_logistic_regression
from app.core.models.random_forest import train_random_forest
from app.core.models.xgboost_model import train_xgboost
from app.schemas.api_models import TrainModelRequest
from app.config import PROCESSED_DIR, MODELS_DIR
from app.core.logging import get_logger

logger = get_logger("api.models")
router = APIRouter()

FEATURE_COLS = [
    'EMA50', 'RSI', 'MACD', 'ATR', 'Vol_Ratio', 'Return_1D',
    'HL_Spread', 'Close_Position',
    'RSI_Lag_1', 'RSI_Lag_2',
    'Return_1D_Lag_1', 'Return_1D_Lag_2',
    'MACD_Lag_1', 'MACD_Lag_2',
    'Vol_Ratio_Lag_1', 'Vol_Ratio_Lag_2'
]

def _train_model_sync(symbol: str, model_type: str, regime_aware: bool, params: dict) -> dict:
    features_filepath = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    if not os.path.exists(features_filepath):
        raise FileNotFoundError(f"Engineered dataset for {symbol.upper()} not found. Run Feature Engineering first.")

    # Load dataset
    df = pd.read_csv(features_filepath)

    # Chronological train-test split (80% train, 20% test to prevent data leakage)
    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx].reset_index(drop=True)

    # Ensure all columns are present
    missing_cols = [col for col in FEATURE_COLS if col not in df_train.columns]
    if missing_cols:
        raise ValueError(f"Missing feature columns in dataset: {missing_cols}")

    if regime_aware:
        # 1. Verify regime clusters are present
        if 'Regime_Cluster' not in df_train.columns:
            raise ValueError("Regime clustering has not been run for this stock. Please run Regime Detection first.")

        # Filter out non-regime padding rows (label -1)
        df_train_clean = df_train[df_train['Regime_Cluster'] != -1].reset_index(drop=True)
        unique_regimes = sorted(df_train_clean['Regime_Cluster'].unique())

        models_dict = {}
        scalers_dict = {}
        metrics_dict = {}
        importances_dict = {}

        # 2. Train sub-models for each active regime
        for r in unique_regimes:
            df_train_r = df_train_clean[df_train_clean['Regime_Cluster'] == r].reset_index(drop=True)
            n_samples_r = len(df_train_r)

            if n_samples_r < 10:
                raise ValueError(f"Not enough data in Regime {r} (only {n_samples_r} samples) to train. Please collect more historical data.")

            # Dynamically set cross-validation splits based on regime sample count
            n_splits_r = min(5, max(2, n_samples_r // 15))

            if model_type == 'logistic_regression':
                C = float(params.get('C', 0.01))
                solver = str(params.get('solver', 'lbfgs'))
                result_r = train_logistic_regression(df_train_r, FEATURE_COLS, C=C, solver=solver, n_splits=n_splits_r)
            elif model_type == 'random_forest':
                n_estimators = int(params.get('n_estimators', 200))
                max_depth = int(params.get('max_depth', 4)) if params.get('max_depth') is not None else None
                min_samples_leaf = int(params.get('min_samples_leaf', 100))
                min_samples_split = int(params.get('min_samples_split', 100))
                result_r = train_random_forest(
                    df_train_r,
                    FEATURE_COLS,
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    min_samples_leaf=min_samples_leaf,
                    min_samples_split=min_samples_split,
                    n_splits=n_splits_r
                )
            elif model_type == 'xgboost':
                n_estimators = int(params.get('n_estimators', 250))
                max_depth = int(params.get('max_depth', 1))
                learning_rate = float(params.get('learning_rate', 0.02))
                subsample = float(params.get('subsample', 0.5))
                min_child_weight = int(params.get('min_child_weight', 25))
                reg_alpha = float(params.get('reg_alpha', 5.0))
                reg_lambda = float(params.get('reg_lambda', 15.0))
                result_r = train_xgboost(
                    df_train_r,
                    FEATURE_COLS,
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    learning_rate=learning_rate,
                    subsample=subsample,
                    min_child_weight=min_child_weight,
                    reg_alpha=reg_alpha,
                    reg_lambda=reg_lambda,
                    n_splits=n_splits_r
                )
            else:
                raise ValueError(f"Unsupported model type: {model_type}")

            models_dict[r] = result_r['model']
            scalers_dict[r] = result_r.get('scaler', None)
            metrics_dict[r] = result_r['metrics']
            importances_dict[r] = result_r['feature_importance']

        # 3. Calculate overall aggregate metrics weighted by sample sizes
        total_samples = len(df_train_clean)
        aggregate_metrics = {}
        for metric in ['train_accuracy', 'train_precision', 'train_recall', 'train_f1', 'train_auc',
                        'cv_accuracy', 'cv_precision', 'cv_recall', 'cv_f1', 'cv_auc']:
            weighted_sum = 0.0
            for r in unique_regimes:
                r_weight = len(df_train_clean[df_train_clean['Regime_Cluster'] == r]) / total_samples
                weighted_sum += metrics_dict[r].get(metric, 0.0) * r_weight
            aggregate_metrics[metric] = float(round(weighted_sum, 4))

        # 4. Average feature importances across all sub-models
        avg_importances = {}
        for r in unique_regimes:
            for item in importances_dict[r]:
                feat = item['feature']
                imp = item['importance']
                avg_importances[feat] = avg_importances.get(feat, 0.0) + imp / len(unique_regimes)

        aggregate_feature_importance = [
            {'feature': feat, 'importance': float(round(imp, 4))}
            for feat, imp in avg_importances.items()
        ]
        aggregate_feature_importance = sorted(aggregate_feature_importance, key=lambda x: x['importance'], reverse=True)

        # 5. Construct prediction samples for response preview using the routing logic
        final_preds = []
        final_probs = []
        for _, row in df_train.iterrows():
            r = int(row['Regime_Cluster'])
            if r == -1 or r not in models_dict:
                final_preds.append(0)
                final_probs.append(0.5)
                continue

            model_r = models_dict[r]
            scaler_r = scalers_dict[r]
            row_X = row[FEATURE_COLS].values.reshape(1, -1)

            if scaler_r:
                row_X = scaler_r.transform(row_X)

            final_preds.append(int(model_r.predict(row_X)[0]))
            final_probs.append(float(model_r.predict_proba(row_X)[0, 1]))

        result = {
            'model': models_dict,
            'scaler': scalers_dict,
            'metrics': aggregate_metrics,
            'feature_importance': aggregate_feature_importance,
            'predictions': final_preds,
            'probabilities': final_probs
        }

    else:
        # Train a standard single global model
        if model_type == 'logistic_regression':
            C = float(params.get('C', 0.01))
            solver = str(params.get('solver', 'lbfgs'))
            result = train_logistic_regression(df_train, FEATURE_COLS, C=C, solver=solver)
        elif model_type == 'random_forest':
            n_estimators = int(params.get('n_estimators', 200))
            max_depth = int(params.get('max_depth', 4)) if params.get('max_depth') is not None else None
            min_samples_leaf = int(params.get('min_samples_leaf', 100))
            min_samples_split = int(params.get('min_samples_split', 100))
            result = train_random_forest(
                df_train,
                FEATURE_COLS,
                n_estimators=n_estimators,
                max_depth=max_depth,
                min_samples_leaf=min_samples_leaf,
                min_samples_split=min_samples_split
            )
        elif model_type == 'xgboost':
            n_estimators = int(params.get('n_estimators', 250))
            max_depth = int(params.get('max_depth', 1))
            learning_rate = float(params.get('learning_rate', 0.02))
            subsample = float(params.get('subsample', 0.5))
            min_child_weight = int(params.get('min_child_weight', 25))
            reg_alpha = float(params.get('reg_alpha', 5.0))
            reg_lambda = float(params.get('reg_lambda', 15.0))
            result = train_xgboost(
                df_train,
                FEATURE_COLS,
                n_estimators=n_estimators,
                max_depth=max_depth,
                learning_rate=learning_rate,
                subsample=subsample,
                min_child_weight=min_child_weight,
                reg_alpha=reg_alpha,
                reg_lambda=reg_lambda
            )
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    # Save model and scaler metadata using pickle
    model_suffix = f"{model_type}_regime_aware" if regime_aware else model_type
    model_filename = f"{symbol}_{model_suffix}.pkl"
    model_filepath = os.path.join(MODELS_DIR, model_filename)

    model_data = {
        'regime_aware': regime_aware,
        'model_type': model_type,
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
        'message': f"Successfully trained {'Regime-Aware ' if regime_aware else ''}{model_type.replace('_', ' ').title()} on {symbol.upper()}. Saved model to models/{model_filename}",
        'model_type': model_type,
        'symbol': symbol.upper(),
        'metrics': result['metrics'],
        'feature_importance': result['feature_importance'][:8], # top 8
        'predictions_sample': result['predictions'][:20],
        'probabilities_sample': result['probabilities'][:20]
    }

@router.post("/train")
async def api_train_model(payload: TrainModelRequest):
    symbol = payload.symbol.lower()
    model_type = payload.model_type.lower()
    regime_aware = payload.regime_aware
    params = payload.hyperparameters or {}

    logger.info(f"Received training request: symbol={symbol}, type={model_type}, regime_aware={regime_aware}")

    try:
        # Offload model training to a separate thread
        result = await asyncio.to_thread(_train_model_sync, symbol, model_type, regime_aware, params)
        logger.info(f"Successfully trained {'regime-aware ' if regime_aware else ''}{model_type} for {symbol}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error training {model_type} model for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

def _list_models_sync() -> list:
    models = []
    if os.path.exists(MODELS_DIR):
        for f in os.listdir(MODELS_DIR):
            if f.endswith('.pkl') and not f.endswith('_regime.pkl'):  # Filter out standalone regime clustering models
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
                    logger.error(f"Error reading model file {f}: {e}")
    return models

@router.get("/list")
async def api_list_models():
    logger.debug("Listing all ML models")
    models = await asyncio.to_thread(_list_models_sync)
    return {'success': True, 'models': models}
