"""
QuantML Research Platform - ITSM Feature Engineering Module
Calculates daily-level strategy inputs from 5-minute high-frequency data.
"""

import os
import pandas as pd
import numpy as np
from app.config import RAW_INTRADAY_DIR, PROCESSED_INTRADAY_DIR
from app.core.logging import get_logger

logger = get_logger("features.itsm")

def calculate_itsm_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate ITSM daily features from 5-minute OHLCV data.
    """
    df = df.copy()
    df['Datetime'] = pd.to_datetime(df['Datetime'])
    df['Date'] = df['Datetime'].dt.date
    df = df.sort_values('Datetime').reset_index(drop=True)
    
    unique_dates = sorted(df['Date'].unique())
    daily_records = []
    
    # Loop over dates starting from index 1 to allow access to previous day's close
    for i in range(1, len(unique_dates)):
        prev_date = unique_dates[i-1]
        curr_date = unique_dates[i]
        
        prev_day_data = df[df['Date'] == prev_date]
        curr_day_data = df[df['Date'] == curr_date]
        
        if prev_day_data.empty or curr_day_data.empty:
            continue
            
        # Previous Day Close (last 5-minute bar close)
        p_close_prev = prev_day_data.iloc[-1]['Close']
        
        # Get specific times of interest
        bar_0915 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '09:15']
        bar_0945 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '09:45']
        bar_1440 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '14:40']
        bar_1510 = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') == '15:10']
        
        if bar_0915.empty or bar_0945.empty or bar_1440.empty or bar_1510.empty:
            continue
            
        open_today = bar_0915.iloc[0]['Open']
        p_0945 = bar_0945.iloc[0]['Close']
        p_1440 = bar_1440.iloc[0]['Close']
        p_1510 = bar_1510.iloc[0]['Close']
        
        # Calculations
        onfh = np.log(p_0945 / p_close_prev)
        middle_return = np.log(p_1440 / p_0945)
        gap = (open_today - p_close_prev) / p_close_prev
        
        # Intraday Volatility: std of 5m log returns from 09:15 up to 14:40
        morning_data = curr_day_data[curr_day_data['Datetime'].dt.strftime('%H:%M') <= '14:40'].copy()
        morning_data['Log_Ret'] = np.log(morning_data['Close'] / morning_data['Close'].shift(1))
        intraday_vol = morning_data['Log_Ret'].std()
        if pd.isna(intraday_vol):
            intraday_vol = 0.0
            
        vol_1440 = bar_1440.iloc[0]['Volume']
        
        # VWAP calculation up to 14:40
        morning_vol_sum = morning_data['Volume'].sum()
        if morning_vol_sum > 0:
            vwap_val = float((morning_data['Close'] * morning_data['Volume']).sum() / morning_vol_sum)
        else:
            vwap_val = float(morning_data['Close'].mean())
            
        # Target variable (Last Hour return)
        lh_return = np.log(p_1510 / p_1440)
        
        # VWAP Distance: percentage deviation of entry price from session VWAP
        vwap_dist = (p_1440 - vwap_val) / vwap_val if vwap_val > 0 else 0.0
        
        daily_records.append({
            'Date': curr_date.strftime('%Y-%m-%d'),
            'p_close_prev': float(p_close_prev),
            'open_today': float(open_today),
            'p_0945': float(p_0945),
            'p_1440': float(p_1440),
            'p_1510': float(p_1510),
            'onfh': float(onfh),
            'middle_return': float(middle_return),
            'gap': float(gap),
            'intraday_volatility': float(intraday_vol),
            'vol_1440': float(vol_1440),
            'vwap_1440': float(vwap_val),
            'vwap_dist': float(vwap_dist),
            'lh_return': float(lh_return)
        })
        
    daily_df = pd.DataFrame(daily_records)
    if daily_df.empty:
        return daily_df
        
    # Relative Volume: current 14:40 volume compared to 20-day average daily volume
    # (Divided by 75, which is the approximate number of 5m bars in a 6.25 hr session)
    daily_vol_sum = df.groupby('Date')['Volume'].sum().reset_index()
    daily_vol_sum['Date'] = daily_vol_sum['Date'].astype(str)
    
    daily_df = daily_df.merge(daily_vol_sum, on='Date', how='left')
    daily_df['Vol_MA_20'] = daily_df['Volume'].rolling(window=20, min_periods=1).mean()
    daily_df['relative_volume'] = daily_df['vol_1440'] / (daily_df['Vol_MA_20'] / 75 + 1e-9)
    daily_df['relative_volume'] = daily_df['relative_volume'].fillna(1.0).round(4)
    daily_df = daily_df.drop(columns=['Volume', 'Vol_MA_20'])
    
    # ATR14 calculation on 5-minute candles directly
    high_low = df['High'] - df['Low']
    high_close = (df['High'] - df['Close'].shift()).abs()
    low_close = (df['Low'] - df['Close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['TR'] = tr
    
    # 14 trading days * 75 candles per day = 1050 candles window
    df['ATR_5m'] = df['TR'].rolling(window=1050, min_periods=1).mean()
    
    atr_1440 = df[df['Datetime'].dt.strftime('%H:%M') == '14:40'][['Date', 'ATR_5m']].copy()
    atr_1440['Date'] = atr_1440['Date'].astype(str)
    
    daily_df = daily_df.merge(atr_1440, on='Date', how='left')
    daily_df = daily_df.rename(columns={'ATR_5m': 'atr14'})
    daily_df['atr14'] = daily_df['atr14'].bfill().fillna(0.0).round(2)
    
    # Mock VIX and Breadth (if not available in yfinance)
    daily_df['vix'] = 16.5
    daily_df['breadth'] = 1.0
    
    return daily_df

def process_itsm_features(filename: str) -> dict:
    """
    Reads the raw 5m CSV, processes features, and saves the output dataset.
    """
    raw_path = os.path.join(RAW_INTRADAY_DIR, filename)
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Intraday raw dataset not found: {filename}")
        
    df = pd.read_csv(raw_path)
    logger.info(f"Processing features for intraday dataset: {filename} ({len(df)} rows)")
    
    features_df = calculate_itsm_features(df)
    
    output_filename = filename.replace('.csv', '_features.csv')
    os.makedirs(PROCESSED_INTRADAY_DIR, exist_ok=True)
    output_path = os.path.join(PROCESSED_INTRADAY_DIR, output_filename)
    features_df.to_csv(output_path, index=False)
    
    logger.info(f"Successfully saved ITSM features to: {output_filename} ({len(features_df)} rows)")
    
    # Generate previews rounded for display
    preview_df = features_df.copy()
    for col in preview_df.columns:
        if col != 'Date' and preview_df[col].dtype in [np.float64, np.float32]:
            preview_df[col] = preview_df[col].round(6)
            
    preview_head = preview_df.head(10).to_dict(orient='records')
    preview_tail = preview_df.tail(5).to_dict(orient='records')
    
    return {
        'success': True,
        'filename': output_filename,
        'rows': len(features_df),
        'columns': list(features_df.columns),
        'preview_head': preview_head,
        'preview_tail': preview_tail
    }
