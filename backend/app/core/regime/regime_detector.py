"""
QuantML Research Platform - Market Regime Detection Engine
Phase 2: Unsupervised Clustering & GMM Engine
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.mixture import GaussianMixture
from sklearn.cluster import KMeans

# Set of features used strictly for clustering the macro market state
REGIME_FEATURES = [
    'Regime_Trend_Strength',
    'Regime_Return_5D',
    'Regime_Return_20D',
    'Regime_Volatility',
    'Regime_ATR',
    'Regime_BB_Width',
    'Regime_ADX'
]

def fit_regime_detector(
    df: pd.DataFrame, 
    n_regimes: int = 3, 
    method: str = 'gmm'
) -> dict:
    """
    Fits an unsupervised model on stock features to discover market regimes.
    Sorts regimes consistently by average daily returns (0 = Bear, 1 = Sideways, 2 = Bull).

    Args:
        df: Processed stock DataFrame containing Regime_ features.
        n_regimes: Number of clusters (typically 3).
        method: 'gmm' (Gaussian Mixture Model) or 'kmeans'.

    Returns:
        Dictionary containing model, scaler, label mapping, and clustering statistics.
    """
    # Verify all regime features are present
    missing = [col for col in REGIME_FEATURES if col not in df.columns]
    if missing:
        raise ValueError(f"Missing regime feature columns: {missing}")

    # Drop NaNs for the training matrix (regime features have rolling windows)
    train_df = df.dropna(subset=REGIME_FEATURES).copy().reset_index(drop=True)
    X = train_df[REGIME_FEATURES].values

    # 1. Scale indicators to zero mean and unit variance
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 2. Fit clustering model
    if method == 'gmm':
        model = GaussianMixture(n_components=n_regimes, random_state=42, n_init=10)
        raw_labels = model.fit_predict(X_scaled)
        probabilities = model.predict_proba(X_scaled)
    else:
        model = KMeans(n_clusters=n_regimes, random_state=42, n_init=10)
        raw_labels = model.fit_predict(X_scaled)
        # Create dummy probability distribution for KMeans (1.0 for predicted cluster)
        probabilities = np.zeros((len(X), n_regimes))
        for idx, lbl in enumerate(raw_labels):
            probabilities[idx, lbl] = 1.0

    # 3. Sort cluster labels logically by historical returns (0: Bear, 1: Sideways, 2: Bull)
    # This prevents random label assignment across different stocks
    cluster_returns = []
    for r in range(n_regimes):
        mean_return = train_df.loc[raw_labels == r, 'Return_1D'].mean()
        cluster_returns.append((r, mean_return))

    # Sort by mean return ascending (lowest return = Bear/0, highest = Bull/2)
    cluster_returns = sorted(cluster_returns, key=lambda x: x[1])
    
    # Create the label mapping dictionary (old_label -> sorted_label)
    label_map = {old: new for new, (old, _) in enumerate(cluster_returns)}
    
    # Map the predicted labels
    sorted_labels = np.array([label_map[lbl] for lbl in raw_labels])
    
    # Re-order the probabilities columns to match the sorted labels
    sorted_order = [old for old, _ in cluster_returns]
    sorted_probs = probabilities[:, sorted_order]

    # Calculate statistics for each sorted regime
    regime_stats = {}
    regime_names = {0: 'Bear', 1: 'Sideways', 2: 'Bull'} if n_regimes == 3 else {i: f"Regime_{i}" for i in range(n_regimes)}

    for r in range(n_regimes):
        mask = (sorted_labels == r)
        r_name = regime_names.get(r, f"Regime_{r}")
        
        if np.sum(mask) > 0:
            regime_stats[r_name] = {
                'regime_id': r,
                'days_count': int(np.sum(mask)),
                'percentage': float(round((np.sum(mask) / len(sorted_labels)) * 100, 2)),
                'avg_return_annualized': float(round(train_df.loc[mask, 'Return_1D'].mean() * 252 * 100, 2)),
                'avg_volatility_annualized': float(round(train_df.loc[mask, 'Return_1D'].std() * np.sqrt(252) * 100, 2)),
                'avg_adx': float(round(train_df.loc[mask, 'Regime_ADX'].mean(), 2)),
            }
        else:
            regime_stats[r_name] = {
                'regime_id': r,
                'days_count': 0,
                'percentage': 0.0,
                'avg_return_annualized': 0.0,
                'avg_volatility_annualized': 0.0,
                'avg_adx': 0.0
            }

    # Package model artifacts
    model_package = {
        'method': method,
        'n_regimes': n_regimes,
        'model': model,
        'scaler': scaler,
        'label_map': label_map,
        'sorted_order': sorted_order,
        'regime_names': regime_names,
        'regime_stats': regime_stats,
        'feature_cols': REGIME_FEATURES
    }

    return {
        'package': model_package,
        'dates': train_df['Date'].tolist(),
        'close': train_df['Close'].tolist(),
        'labels': sorted_labels.tolist(),
        'probabilities': sorted_probs.tolist(),
        'stats': regime_stats
    }


def predict_regime(model_package: dict, X_new: np.ndarray) -> tuple:
    """
    Predicts the market regime for new feature inputs using a saved package.

    Args:
        model_package: Saved model dict containing GMM/KMeans and scaler.
        X_new: 2D numpy array of shape (N, n_features) matching REGIME_FEATURES.

    Returns:
        tuple containing (mapped_labels, sorted_probabilities)
    """
    model = model_package['model']
    scaler = model_package['scaler']
    label_map = model_package['label_map']
    sorted_order = model_package['sorted_order']
    
    # Scale inputs
    X_scaled = scaler.transform(X_new)
    
    # Predict
    if isinstance(model, GaussianMixture):
        raw_labels = model.predict(X_scaled)
        probabilities = model.predict_proba(X_scaled)
    else:
        raw_labels = model.predict(X_scaled)
        # KMeans dummy probabilities
        probabilities = np.zeros((len(X_new), model.n_clusters))
        for idx, lbl in enumerate(raw_labels):
            probabilities[idx, lbl] = 1.0

    # Map labels to sorted indices (Bear -> Bull)
    mapped_labels = np.array([label_map[lbl] for lbl in raw_labels])
    
    # Sort probability columns
    sorted_probs = probabilities[:, sorted_order]
    
    return mapped_labels, sorted_probs
