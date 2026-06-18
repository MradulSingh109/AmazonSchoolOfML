"""
QuantML Research Platform - ITSM Regressor Models Module
Trains quantitative regression models to predict the final hour return (LH).
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from app.config import MODELS_DIR, PROCESSED_INTRADAY_DIR
from app.core.logging import get_logger

# Import XGBoost if available, fallback to RandomForest if not
try:
    from xgboost import XGBRegressor
except ImportError:
    XGBRegressor = None

logger = get_logger("models.itsm")

def train_itsm_model(
    filename: str, 
    model_type: str = 'linear_regression', 
    hyperparameters: dict = None
) -> dict:
    """
    Train an ITSM regression model on the processed daily features.
    """
    hyperparameters = hyperparameters or {}
    processed_path = os.path.join(PROCESSED_INTRADAY_DIR, filename)
    if not os.path.exists(processed_path):
        raise FileNotFoundError(f"Processed features file not found: {filename}")
        
    df = pd.read_csv(processed_path)
    logger.info(f"Training ITSM model {model_type} on {filename} ({len(df)} rows)")
    
    if len(df) < 5:
        raise ValueError("Insufficient data to train ITSM model. Need at least 5 trading days.")
        
    # Feature columns and target
    feature_cols = [
        'onfh', 'middle_return', 'gap'
    ]
    target_col = 'lh_return'
    
    # Drop rows with NaN values
    clean_df = df.dropna(subset=feature_cols + [target_col]).copy()
    
    X = clean_df[feature_cols].values
    y = clean_df[target_col].values
    
    # Train/Test Split: Use last 20% for test (or 3 months if there's enough data)
    split_idx = int(len(clean_df) * 0.8)
    if len(clean_df) - split_idx < 1:
        split_idx = len(clean_df) - 1
        
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    # Initialize Model
    if model_type == 'linear_regression':
        model = LinearRegression()
    elif model_type == 'ridge':
        alpha = hyperparameters.get('alpha', 1.0)
        model = Ridge(alpha=alpha)
    elif model_type == 'lasso':
        alpha = hyperparameters.get('alpha', 0.1)
        model = Lasso(alpha=alpha)
    elif model_type == 'random_forest':
        n_estimators = hyperparameters.get('n_estimators', 100)
        max_depth = hyperparameters.get('max_depth', 5)
        model = RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, random_state=42)
    elif model_type == 'xgboost':
        if XGBRegressor is None:
            logger.warning("XGBoost is not installed. Falling back to RandomForestRegressor.")
            model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
            model_type = 'random_forest'
        else:
            n_estimators = hyperparameters.get('n_estimators', 100)
            max_depth = hyperparameters.get('max_depth', 3)
            learning_rate = hyperparameters.get('learning_rate', 0.1)
            model = XGBRegressor(n_estimators=n_estimators, max_depth=max_depth, learning_rate=learning_rate, random_state=42)
    else:
        raise ValueError(f"Unknown ITSM model type: {model_type}")
        
    # Fit Model
    model.fit(X_train, y_train)
    
    # Evaluate Train metrics
    y_train_pred = model.predict(X_train)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
    train_r2 = r2_score(y_train, y_train_pred)
    
    # Evaluate Test metrics
    y_test_pred = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
    test_r2 = r2_score(y_test, y_test_pred)
    
    # Save Model Dict
    model_data = {
        'model': model,
        'model_type': model_type,
        'feature_cols': feature_cols,
        'hyperparameters': hyperparameters,
        'test_metrics': {
            'mae': float(test_mae),
            'rmse': float(test_rmse),
            'r2': float(test_r2)
        }
    }
    
    # Write model to folder
    clean_symbol = filename.split('_')[0].lower()
    model_filename = f"itsm_{clean_symbol}_{model_type}.pkl"
    model_path = os.path.join(MODELS_DIR, model_filename)
    
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)
        
    logger.info(f"Successfully trained and saved ITSM model to: {model_filename}")
    return {
        'success': True,
        'filename': model_filename,
        'train_metrics': {
            'mae': round(float(train_mae), 6),
            'rmse': round(float(train_rmse), 6),
            'r2': round(float(train_r2), 4)
        },
        'test_metrics': {
            'mae': round(float(test_mae), 6),
            'rmse': round(float(test_rmse), 6),
            'r2': round(float(test_r2), 4)
        }
    }
