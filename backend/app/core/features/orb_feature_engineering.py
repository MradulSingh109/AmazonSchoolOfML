"""
QuantML Research Platform - ORB-RVOL Feature Engineering Module
Calculates daily-level strategy inputs for the Opening Range Breakout strategy from 5-minute data.
"""

import os
import pandas as pd
import numpy as np
from app.config import RAW_INTRADAY_DIR, PROCESSED_INTRADAY_DIR
from app.core.logging import get_logger

logger = get_logger("features.orb")

def calculate_orb_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate ORB-RVOL daily features from 5-minute OHLCV data.
    """
    df = df.copy()
    df['Datetime'] = pd.to_datetime(df['Datetime'])
    df['Date'] = df['Datetime'].dt.date
    df = df.sort_values('Datetime').reset_index(drop=True)
    
    unique_dates = sorted(df['Date'].unique())
    daily_records = []
    
    # First, calculate Daily OHLC to compute Daily ATR(14)
    daily_ohlc_list = []
    for d in unique_dates:
        day_data = df[df['Date'] == d].sort_values('Datetime')
        if day_data.empty:
            continue
        daily_ohlc_list.append({
            'Date': d,
            'High': float(day_data['High'].max()),
            'Low': float(day_data['Low'].min()),
            'Close': float(day_data.iloc[-1]['Close']),
            'Open': float(day_data.iloc[0]['Open'])
        })
    
    ohlc_df = pd.DataFrame(daily_ohlc_list).sort_values('Date').reset_index(drop=True)
    ohlc_df['Prev_Close'] = ohlc_df['Close'].shift(1)
    
    # Calculate True Range (TR)
    tr_list = []
    for idx, row in ohlc_df.iterrows():
        if pd.isna(row['Prev_Close']):
            tr_list.append(row['High'] - row['Low'])
        else:
            tr = max(
                row['High'] - row['Low'],
                abs(row['High'] - row['Prev_Close']),
                abs(row['Low'] - row['Prev_Close'])
            )
            tr_list.append(tr)
            
    ohlc_df['TR'] = tr_list
    ohlc_df['atr14'] = ohlc_df['TR'].rolling(window=14, min_periods=1).mean()
    
    # Map Date to string for easy merging
    ohlc_df['Date_str'] = ohlc_df['Date'].astype(str)
    atr_map = ohlc_df.set_index('Date_str')['atr14'].to_dict()
    
    # Loop over dates starting from index 1 to allow access to previous day's close
    for i in range(1, len(unique_dates)):
        prev_date = unique_dates[i-1]
        curr_date = unique_dates[i]
        
        prev_day_data = df[df['Date'] == prev_date].sort_values('Datetime')
        curr_day_data = df[df['Date'] == curr_date].sort_values('Datetime')
        
        if prev_day_data.empty or curr_day_data.empty:
            continue
            
        p_close_prev = prev_day_data.iloc[-1]['Close']
        
        # Get the first 5-minute candle (09:15)
        bar_0915 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '09:15']
        
        if bar_0915.empty:
            continue
            
        open_today = bar_0915.iloc[0]['Open']
        h_or = bar_0915.iloc[0]['High']
        l_or = bar_0915.iloc[0]['Low']
        
        # Get volume from 09:20 bar because 09:15 volume is often zero in yfinance data
        bar_0920 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '09:20']
        if not bar_0920.empty:
            v_today = bar_0920.iloc[0]['Volume']
        else:
            v_today = bar_0915.iloc[0]['Volume']
        
        # Calculations
        orw = h_or - l_or
        orw_pct = (orw / p_close_prev) * 100.0
        
        # Store basic record for now
        daily_records.append({
            'Date': curr_date.strftime('%Y-%m-%d'),
            'p_close_prev': float(p_close_prev),
            'open_today': float(open_today),
            'h_or': float(h_or),
            'l_or': float(l_or),
            'orw': float(orw),
            'orw_pct': float(orw_pct),
            'v_today': float(v_today),
            'atr14': float(atr_map.get(curr_date.strftime('%Y-%m-%d'), 0.0)),
            'vix': 16.5, # Mock VIX level as per SRD specs
            'breadth': 1.0 # Mock breadth
        })
        
    daily_df = pd.DataFrame(daily_records)
    if daily_df.empty:
        return daily_df
        
    # Calculate RVOL: v_today / Average(v_today over past 14 trading days)
    daily_df['avg_vol_14'] = daily_df['v_today'].rolling(window=14, min_periods=1).mean().shift(1)
    # Fill first values where MA is NaN with the current value
    daily_df['avg_vol_14'] = daily_df['avg_vol_14'].fillna(daily_df['v_today'])
    daily_df['rvol'] = daily_df['v_today'] / (daily_df['avg_vol_14'] + 1e-9)
    daily_df['rvol'] = daily_df['rvol'].round(4)
    
    return daily_df

def process_orb_features(filename: str) -> dict:
    """
    Reads raw 5m CSV, processes ORB features, and saves output dataset.
    """
    raw_path = os.path.join(RAW_INTRADAY_DIR, filename)
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Intraday raw dataset not found: {filename}")
        
    df = pd.read_csv(raw_path)
    logger.info(f"Processing ORB features for: {filename} ({len(df)} rows)")
    
    features_df = calculate_orb_features(df)
    
    output_filename = filename.replace('.csv', '_orb_features.csv')
    os.makedirs(PROCESSED_INTRADAY_DIR, exist_ok=True)
    output_path = os.path.join(PROCESSED_INTRADAY_DIR, output_filename)
    features_df.to_csv(output_path, index=False)
    
    logger.info(f"Successfully saved ORB features to: {output_filename} ({len(features_df)} rows)")
    
    preview_df = features_df.copy()
    for col in preview_df.columns:
        if col != 'Date' and preview_df[col].dtype in [np.float64, np.float32]:
            preview_df[col] = preview_df[col].round(6)
            
    preview_head = preview_df.head(10).to_dict(orient='records')
    preview_tail = preview_df.tail(5).to_dict(orient='records')
    
    avg_atr_pct = float((features_df['atr14'] / features_df['open_today'] * 100.0).mean()) if not features_df.empty else 0.0
    
    return {
        'success': True,
        'filename': output_filename,
        'rows': len(features_df),
        'columns': list(features_df.columns),
        'preview_head': preview_head,
        'preview_tail': preview_tail,
        'avg_atr_pct': round(avg_atr_pct, 4)
    }
