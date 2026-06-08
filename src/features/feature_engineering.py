"""
QuantML Research Platform - Feature Engineering Module
Phase 2: Feature Engineering

Calculates:
  - Trend: EMA20, EMA50, EMA200
  - Momentum: RSI, MACD, ROC
  - Volatility: ATR, Bollinger Band Width
  - Volume: Volume Moving Average, Volume Ratio
  - Returns: 1D, 5D, 10D Returns
"""

import pandas as pd
import numpy as np


def calculate_ema(df: pd.DataFrame, span: int) -> pd.Series:
    """Calculate Exponential Moving Average."""
    return df['Close'].ewm(span=span, adjust=False).mean()


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculate Relative Strength Index (RSI)."""
    delta = df['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Use wilder's smoothing (com = period - 1)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()

    rs = avg_gain / (avg_loss + 1e-9)  # Avoid division by zero
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
    """Calculate MACD Line and Signal Line."""
    ema_fast = df['Close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['Close'].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, signal_line


def calculate_roc(df: pd.DataFrame, period: int = 10) -> pd.Series:
    """Calculate Rate of Change (ROC)."""
    return ((df['Close'] - df['Close'].shift(period)) / (df['Close'].shift(period) + 1e-9)) * 100


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculate Average True Range (ATR)."""
    high_low = df['High'] - df['Low']
    high_close = (df['High'] - df['Close'].shift()).abs()
    low_close = (df['Low'] - df['Close'].shift()).abs()

    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    return atr


def calculate_bollinger_width(df: pd.DataFrame, period: int = 20, num_std: float = 2.0) -> pd.Series:
    """Calculate Bollinger Band Width."""
    ma = df['Close'].rolling(window=period).mean()
    std = df['Close'].rolling(window=period).std()
    upper_band = ma + (std * num_std)
    lower_band = ma - (std * num_std)
    return upper_band - lower_band


def generate_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate the full matrix of features.

    Args:
        df: Input DataFrame containing Date, Open, High, Low, Close, Volume.

    Returns:
        DataFrame with engineered features.
    """
    # Create copy to avoid modifying original
    features_df = df.copy()

    # Sort by Date to ensure time-series calculations are correct
    features_df = features_df.sort_values('Date').reset_index(drop=True)

    # 1. Trend Features (Normalized as % deviation from Close)
    features_df['EMA20'] = (features_df['Close'] - calculate_ema(features_df, 20)) / calculate_ema(features_df, 20)
    features_df['EMA50'] = (features_df['Close'] - calculate_ema(features_df, 50)) / calculate_ema(features_df, 50)
    features_df['EMA200'] = (features_df['Close'] - calculate_ema(features_df, 200)) / calculate_ema(features_df, 200)

    # 2. Momentum Features
    features_df['RSI'] = calculate_rsi(features_df, 14)
    macd_line, signal_line = calculate_macd(features_df)
    features_df['MACD'] = macd_line / features_df['Close']
    features_df['MACD_Signal'] = signal_line / features_df['Close']
    features_df['ROC'] = calculate_roc(features_df, 10)

    # 3. Volatility Features (Normalized by Close price)
    features_df['ATR'] = calculate_atr(features_df, 14) / features_df['Close']
    features_df['BB_Width'] = calculate_bollinger_width(features_df, 20) / features_df['Close']

    # 4. Volume Features
    features_df['Vol_MA'] = features_df['Volume'].rolling(window=20).mean()
    features_df['Vol_Ratio'] = features_df['Volume'] / (features_df['Vol_MA'] + 1e-9)

    # 5. Return Features
    features_df['Return_1D'] = features_df['Close'].pct_change(1)
    features_df['Return_5D'] = features_df['Close'].pct_change(5)
    features_df['Return_10D'] = features_df['Close'].pct_change(10)

    # 6. High-Low Spread and Close Position in Range
    features_df['HL_Spread'] = (features_df['High'] - features_df['Low']) / features_df['Close']
    features_df['Close_Position'] = (features_df['Close'] - features_df['Low']) / (features_df['High'] - features_df['Low'] + 1e-9)

    # 7. Lag Features (1-Day and 2-Day shifts) for core indicators
    features_df['RSI_Lag_1'] = features_df['RSI'].shift(1)
    features_df['RSI_Lag_2'] = features_df['RSI'].shift(2)
    features_df['Return_1D_Lag_1'] = features_df['Return_1D'].shift(1)
    features_df['Return_1D_Lag_2'] = features_df['Return_1D'].shift(2)
    features_df['MACD_Lag_1'] = features_df['MACD'].shift(1)
    features_df['MACD_Lag_2'] = features_df['MACD'].shift(2)
    features_df['Vol_Ratio_Lag_1'] = features_df['Vol_Ratio'].shift(1)
    features_df['Vol_Ratio_Lag_2'] = features_df['Vol_Ratio'].shift(2)

    # Round numeric columns for cleaner storage/viewing
    float_cols = [
        'EMA20', 'EMA50', 'EMA200', 'RSI', 'MACD', 'MACD_Signal', 'ROC',
        'ATR', 'BB_Width', 'Vol_MA', 'Vol_Ratio', 'Return_1D', 'Return_5D', 'Return_10D',
        'HL_Spread', 'Close_Position', 
        'RSI_Lag_1', 'RSI_Lag_2', 'Return_1D_Lag_1', 'Return_1D_Lag_2',
        'MACD_Lag_1', 'MACD_Lag_2', 'Vol_Ratio_Lag_1', 'Vol_Ratio_Lag_2'
    ]
    for col in float_cols:
        if col in features_df.columns:
            features_df[col] = features_df[col].round(4)

    return features_df
