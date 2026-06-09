"""
QuantML Research Platform - Logistic Regression Model
Phase 4: Baseline Models

Implements:
  - Logistic Regression Classifier
  - TimeSeriesSplit validation
  - Standard scaling of features
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score


def train_logistic_regression(
    df: pd.DataFrame, 
    feature_cols: list, 
    target_col: str = 'Target',
    n_splits: int = 5,
    C: float = 0.01,
    penalty: str = 'l2',
    solver: str = 'lbfgs'
) -> dict:
    """
    Train a Logistic Regression model using TimeSeriesSplit validation.

    Args:
        df: Input DataFrame containing features and target.
        feature_cols: List of column names to use as features.
        target_col: Name of the target column.
        n_splits: Number of splits for TimeSeriesSplit.

    Returns:
        Dictionary containing trained model, scaler, and evaluation metrics.
    """
    # Prepare data
    X = df[feature_cols].values
    y = df[target_col].values

    # TimeSeriesSplit cross-validation
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    cv_metrics = {
        'accuracy': [],
        'precision': [],
        'recall': [],
        'f1': [],
        'auc': []
    }

    for train_idx, val_idx in tscv.split(X):
        X_train_cv, X_val_cv = X[train_idx], X[val_idx]
        y_train_cv, y_val_cv = y[train_idx], y[val_idx]

        # Scale features
        scaler_cv = StandardScaler()
        X_train_scaled = scaler_cv.fit_transform(X_train_cv)
        X_val_scaled = scaler_cv.transform(X_val_cv)

        # Train model
        model_cv = LogisticRegression(
            C=C,
            penalty=penalty,
            solver=solver,
            max_iter=1000,
            random_state=42
        )
        model_cv.fit(X_train_scaled, y_train_cv)

        # Predict
        preds = model_cv.predict(X_val_scaled)
        probs = model_cv.predict_proba(X_val_scaled)[:, 1]

        # Calculate metrics
        cv_metrics['accuracy'].append(accuracy_score(y_val_cv, preds))
        cv_metrics['precision'].append(precision_score(y_val_cv, preds, zero_division=0))
        cv_metrics['recall'].append(recall_score(y_val_cv, preds, zero_division=0))
        cv_metrics['f1'].append(f1_score(y_val_cv, preds, zero_division=0))
        try:
            cv_metrics['auc'].append(roc_auc_score(y_val_cv, probs))
        except ValueError:
            cv_metrics['auc'].append(0.5)

    # Train final model on all data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    final_model = LogisticRegression(
        C=C,
        penalty=penalty,
        solver=solver,
        max_iter=1000,
        random_state=42
    )
    final_model.fit(X_scaled, y)

    # Final predictions & probabilities on the training set (for training metrics)
    final_preds = final_model.predict(X_scaled)
    final_probs = final_model.predict_proba(X_scaled)[:, 1]

    # Calculate overall metrics
    metrics = {
        'train_accuracy': float(accuracy_score(y, final_preds)),
        'train_precision': float(precision_score(y, final_preds, zero_division=0)),
        'train_recall': float(recall_score(y, final_preds, zero_division=0)),
        'train_f1': float(f1_score(y, final_preds, zero_division=0)),
        'train_auc': float(roc_auc_score(y, final_probs)),
        'cv_accuracy': float(np.mean(cv_metrics['accuracy'])),
        'cv_precision': float(np.mean(cv_metrics['precision'])),
        'cv_recall': float(np.mean(cv_metrics['recall'])),
        'cv_f1': float(np.mean(cv_metrics['f1'])),
        'cv_auc': float(np.mean(cv_metrics['auc'])),
    }

    # Coefficients for feature importance
    importance = final_model.coef_[0]
    feature_importance = [
        {'feature': feat, 'importance': float(imp)}
        for feat, imp in zip(feature_cols, importance)
    ]
    # Sort by absolute coefficient size
    feature_importance = sorted(feature_importance, key=lambda x: abs(x['importance']), reverse=True)

    return {
        'model': final_model,
        'scaler': scaler,
        'metrics': metrics,
        'feature_importance': feature_importance,
        'predictions': final_preds.tolist(),
        'probabilities': final_probs.tolist()
    }
