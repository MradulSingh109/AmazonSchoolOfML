"""
QuantML Research Platform - Target Generation Module
Phase 3: Target Creation

Target:
  - 1 if Tomorrow's Close > Today's Close
  - 0 otherwise (Tomorrow's Close <= Today's Close)
"""

import pandas as pd


def generate_target(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate target variable (binary label) for machine learning prediction.

    Args:
        df: Input DataFrame containing Close price.

    Returns:
        DataFrame with added 'Target' column.
    """
    target_df = df.copy()

    # Shift Close price by -1 to get tomorrow's close price
    target_df['Tomorrow_Close'] = target_df['Close'].shift(-1)

    # Label: 1 if Tomorrow_Close > Close, else 0
    target_df['Target'] = (target_df['Tomorrow_Close'] > target_df['Close']).astype(int)

    # Drop the temporary tomorrow close column
    target_df = target_df.drop(columns=['Tomorrow_Close'])

    # Since the last row doesn't have a "tomorrow" price, its Target is invalid.
    # We keep it for prediction/inference, but for training datasets we usually drop it.
    # We will let the pipeline decide when to drop NaN feature values and the last target row.

    return target_df
