"""
QuantML Research Platform - Signal Generation Layer
Phase 6: Signal Generation

Rule:
  - Probability > 0.55 -> BUY (1)
  - Probability <= 0.55 -> SELL (-1 for Short or 0 for Flat)
"""

import os
import pickle
import pandas as pd
import numpy as np


def generate_signals(
    df: pd.DataFrame, 
    model_path: str, 
    threshold: float = 0.55,
    short_style: str = 'short'  # 'short' for -1 (Long-Short), 'flat' for 0 (Long-Only)
) -> pd.DataFrame:
    """
    Generate trading signals using a trained ML model.

    Args:
        df: Processed features DataFrame containing Date, Close, and feature columns.
        model_path: Path to the trained model pickle file.
        threshold: Decision probability threshold for generating a BUY signal.
        short_style: 'short' (signals: 1 / -1) or 'flat' (signals: 1 / 0).

    Returns:
        DataFrame with added 'Probability' and 'Signal' columns.
    """
    # Load model and components
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Trained model not found at {model_path}")
        
    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)

    model = model_data['model']
    scaler = model_data.get('scaler', None)
    feature_cols = model_data['feature_cols']

    # Copy input data
    signal_df = df.copy()

    # Extract features
    X = signal_df[feature_cols].values

    # Scale features if scaler exists
    if scaler is not None:
        X_scaled = scaler.transform(X)
    else:
        X_scaled = X

    # Predict probabilities (of class 1 / UP)
    # Some classifiers might output probabilities. If they don't, we fall back.
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_scaled)[:, 1]
    else:
        # LogisticRegression, RandomForest, XGBoost all support predict_proba
        probs = model.predict(X_scaled)

    signal_df['Probability'] = np.round(probs, 4)

    # Generate signals based on probability threshold
    # Prob > threshold -> BUY (1)
    # Prob <= threshold -> SELL (-1 or 0)
    sell_value = -1 if short_style == 'short' else 0
    signal_df['Signal'] = np.where(signal_df['Probability'] > threshold, 1, sell_value)

    # Calculate signal changes (trades)
    # 1: Enter Long / Exit Short
    # -1: Exit Long / Enter Short
    signal_df['Position_Change'] = signal_df['Signal'].diff().fillna(0).astype(int)

    return signal_df
