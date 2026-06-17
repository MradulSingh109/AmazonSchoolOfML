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

    regime_aware = model_data.get('regime_aware', False)
    model = model_data['model']
    scaler = model_data.get('scaler', None)
    feature_cols = model_data['feature_cols']

    # Copy input data
    signal_df = df.copy()

    # Predict probabilities (of class 1 / UP)
    if regime_aware:
        if 'Regime_Cluster' not in signal_df.columns:
            raise ValueError("Regime_Cluster column is missing from the dataset. Please run Regime Detection first.")

        probs = []
        models_dict = model  # Dictionary of models
        scalers_dict = scaler or {}  # Dictionary of scalers

        for idx, row in signal_df.iterrows():
            r = int(row['Regime_Cluster'])
            if r == -1 or r not in models_dict:
                # Default fallback probability
                probs.append(0.5)
                continue

            model_r = models_dict[r]
            scaler_r = scalers_dict.get(r, None)

            # Extract row features
            row_X = row[feature_cols].values.reshape(1, -1)
            if scaler_r is not None:
                row_X = scaler_r.transform(row_X)

            prob_r = float(model_r.predict_proba(row_X)[0, 1])
            probs.append(prob_r)

        probs = np.array(probs)
    else:
        # Extract features
        X = signal_df[feature_cols].values

        # Scale features if scaler exists
        if scaler is not None:
            X_scaled = scaler.transform(X)
        else:
            X_scaled = X

        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_scaled)[:, 1]
        else:
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
