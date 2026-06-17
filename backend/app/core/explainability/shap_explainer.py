"""
QuantML Research Platform - SHAP Explainer
Phase 8: Model Explainability

Calculates SHAP values for:
  - Logistic Regression (LinearExplainer / Explainer)
  - Random Forest (TreeExplainer)
  - XGBoost (TreeExplainer)
"""

import os
import pickle
import pandas as pd
import numpy as np
import shap


def calculate_shap_values(
    df: pd.DataFrame, 
    model_path: str,
    max_samples: int = 200
) -> dict:
    """
    Calculate SHAP values for features using the trained model.

    Args:
        df: Processed feature DataFrame.
        model_path: Path to the trained model pickle file.
        max_samples: Number of latest samples to analyze for speed.

    Returns:
        Dictionary containing mean SHAP values, feature importances, 
        and raw scatter points for visualization.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")

    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)

    regime_aware = model_data.get('regime_aware', False)
    model = model_data['model']
    scaler = model_data.get('scaler', None)
    feature_cols = model_data['feature_cols']

    # Select the latest rows for explainability (since time-series shifts regimes)
    analysis_df = df.tail(max_samples).copy().reset_index(drop=True)
    X = analysis_df[feature_cols].values

    # Initialize Explainer based on model class
    try:
        if regime_aware:
            models_dict = model
            scalers_dict = scaler or {}
            shap_values = np.zeros_like(X, dtype=float)

            if 'Regime_Cluster' not in analysis_df.columns:
                raise ValueError("Regime_Cluster column is missing from the dataset. Please run Regime Detection first.")

            for r, sub_model in models_dict.items():
                idx_r = analysis_df[analysis_df['Regime_Cluster'] == r].index.tolist()
                if not idx_r:
                    continue

                X_r = X[idx_r]
                scaler_r = scalers_dict.get(r, None)
                X_r_scaled = scaler_r.transform(X_r) if scaler_r is not None else X_r

                try:
                    sub_model_classname = sub_model.__class__.__name__
                    if "XGB" in sub_model_classname or "RandomForest" in sub_model_classname:
                        explainer = shap.TreeExplainer(sub_model)
                        raw_shap = explainer.shap_values(X_r_scaled)
                        if isinstance(raw_shap, list):
                            shap_values_r = raw_shap[1]
                        elif isinstance(raw_shap, np.ndarray) and len(raw_shap.shape) == 3:
                            shap_values_r = raw_shap[:, :, 1]
                        else:
                            shap_values_r = raw_shap
                    else:
                        explainer = shap.Explainer(sub_model, X_r_scaled)
                        explanation = explainer(X_r_scaled)
                        shap_values_r = explanation.values if hasattr(explanation, "values") else explanation

                    if len(shap_values_r.shape) == 3:
                        shap_values_r = shap_values_r[:, :, 1]

                    shap_values[idx_r] = shap_values_r
                except Exception as sub_err:
                    print(f"SHAP computation skipped for regime {r}: {sub_err}")

            model_classname = "RegimeAwareEnsemble"
        else:
            # Scale features if scaler exists
            if scaler is not None:
                X_scaled = scaler.transform(X)
            else:
                X_scaled = X

            model_classname = model.__class__.__name__

            if "XGB" in model_classname or "RandomForest" in model_classname:
                explainer = shap.TreeExplainer(model)
                raw_shap = explainer.shap_values(X_scaled)
                
                if isinstance(raw_shap, list):
                    shap_values = raw_shap[1]
                elif isinstance(raw_shap, np.ndarray) and len(raw_shap.shape) == 3:
                    shap_values = raw_shap[:, :, 1]
                else:
                    shap_values = raw_shap
            else:
                explainer = shap.Explainer(model, X_scaled)
                explanation = explainer(X_scaled)
                shap_values = explanation.values if hasattr(explanation, "values") else explanation

        # Ensure shap_values is a 2D numpy array matching X shape
        if isinstance(shap_values, list):
            shap_values = np.array(shap_values)
        if len(shap_values.shape) == 3:
            shap_values = shap_values[:, :, 1]

        # Calculate mean absolute SHAP values for ranking
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        
        feature_impact = [
            {'feature': feat, 'mean_abs_shap': float(val)}
            for feat, val in zip(feature_cols, mean_abs_shap)
        ]
        feature_impact = sorted(feature_impact, key=lambda x: x['mean_abs_shap'], reverse=True)

        # Generate details for beeswarm visualization:
        # We want to send back the feature values and SHAP values for each data point
        beeswarm_data = {}
        for idx, feat in enumerate(feature_cols):
            feat_vals = X[:, idx] # Raw (unscaled) values for plotting
            feat_shap = shap_values[:, idx]
            
            # Normalize feature values to [0, 1] range for color mapping (low to high)
            min_val = float(np.min(feat_vals))
            max_val = float(np.max(feat_vals))
            range_val = max_val - min_val if max_val > min_val else 1.0
            
            colors = [float((v - min_val) / range_val) for v in feat_vals]

            beeswarm_data[feat] = [
                {
                    'value': float(val),
                    'shap': float(sh),
                    'normalized_value': float(col)
                }
                for val, sh, col in zip(feat_vals, feat_shap, colors)
            ]

        return {
            'success': True,
            'model_type': model_classname,
            'samples_count': len(analysis_df),
            'feature_impact': feature_impact,
            'beeswarm': beeswarm_data
        }

    except Exception as e:
        # Provide fallbacks if SHAP fails for any internal reason
        return {
            'success': False,
            'error': str(e)
        }
