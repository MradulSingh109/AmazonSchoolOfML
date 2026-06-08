"""
QuantML Research Platform - Random Forest Model
Phase 4: Baseline Models

Implements:
  - Random Forest Classifier
  - TimeSeriesSplit validation
  - Feature importance analysis
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score


def train_random_forest(
    df: pd.DataFrame, 
    feature_cols: list, 
    target_col: str = 'Target',
    n_splits: int = 5,
    n_estimators: int = 200,
    max_depth: int = 4,
    min_samples_leaf: int = 100,
    min_samples_split: int = 100
) -> dict:
    """
    Train a highly regularized Random Forest model using TimeSeriesSplit validation.

    Args:
        df: Input DataFrame containing features and target.
        feature_cols: List of column names to use as features.
        target_col: Name of the target column.
        n_splits: Number of splits for TimeSeriesSplit.
        n_estimators: Number of trees in the forest.
        max_depth: Maximum depth of the trees.
        min_samples_leaf: Minimum number of samples required to be at a leaf node.
        min_samples_split: Minimum number of samples required to split an internal node.

    Returns:
        Dictionary containing trained model, metrics, and feature importances.
    """
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

        # Train model with strong regularization
        model_cv = RandomForestClassifier(
            n_estimators=n_estimators, 
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            min_samples_split=min_samples_split,
            max_features='sqrt',
            random_state=42,
            n_jobs=-1
        )
        model_cv.fit(X_train_cv, y_train_cv)

        # Predict
        preds = model_cv.predict(X_val_cv)
        probs = model_cv.predict_proba(X_val_cv)[:, 1]

        # Calculate metrics
        cv_metrics['accuracy'].append(accuracy_score(y_val_cv, preds))
        cv_metrics['precision'].append(precision_score(y_val_cv, preds, zero_division=0))
        cv_metrics['recall'].append(recall_score(y_val_cv, preds, zero_division=0))
        cv_metrics['f1'].append(f1_score(y_val_cv, preds, zero_division=0))
        try:
            cv_metrics['auc'].append(roc_auc_score(y_val_cv, probs))
        except ValueError:
            cv_metrics['auc'].append(0.5)

    # Train final model on all data with same strong regularization
    final_model = RandomForestClassifier(
        n_estimators=n_estimators, 
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        min_samples_split=min_samples_split,
        max_features='sqrt',
        random_state=42,
        n_jobs=-1
    )
    final_model.fit(X, y)

    # Final predictions & probabilities on the training set
    final_preds = final_model.predict(X)
    final_probs = final_model.predict_proba(X)[:, 1]

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

    # Feature importances
    importances = final_model.feature_importances_
    feature_importance = [
        {'feature': feat, 'importance': float(imp)}
        for feat, imp in zip(feature_cols, importances)
    ]
    # Sort by importance size
    feature_importance = sorted(feature_importance, key=lambda x: x['importance'], reverse=True)

    return {
        'model': final_model,
        'metrics': metrics,
        'feature_importance': feature_importance,
        'predictions': final_preds.tolist(),
        'probabilities': final_probs.tolist()
    }
