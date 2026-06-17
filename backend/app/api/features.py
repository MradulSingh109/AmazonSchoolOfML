import os
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.features.feature_engineering import generate_features
from app.core.features.target_generation import generate_target
from app.schemas.api_models import ProcessFeaturesRequest
from app.config import RAW_DIR, PROCESSED_DIR
from app.core.logging import get_logger

logger = get_logger("api.features")
router = APIRouter()

def _process_features_sync(symbol: str) -> dict:
    raw_filepath = os.path.join(RAW_DIR, f"{symbol}.csv")
    if not os.path.exists(raw_filepath):
        raise FileNotFoundError(f"Raw data for {symbol.upper()} not found. Download it first.")

    # Load raw data
    df = pd.read_csv(raw_filepath)

    # Generate features
    feat_df = generate_features(df)

    # Generate targets
    final_df = generate_target(feat_df)

    # Drop NaN values resulting from rolling indicators
    clean_df = final_df.dropna().copy()

    processed_filename = f"{symbol}_features.csv"
    processed_filepath = os.path.join(PROCESSED_DIR, processed_filename)
    clean_df.to_csv(processed_filepath, index=False)

    # Get summary stats
    total_rows = len(clean_df)

    # Target class balance
    target_counts = clean_df['Target'].value_counts().to_dict()
    ups = int(target_counts.get(1, 0))
    downs = int(target_counts.get(0, 0))
    up_percentage = round((ups / total_rows) * 100, 2) if total_rows > 0 else 0

    # Features calculated list
    added_features = [
        'EMA20', 'EMA50', 'EMA200', 'RSI', 'MACD', 'MACD_Signal', 'ROC',
        'ATR', 'BB_Width', 'Vol_MA', 'Vol_Ratio', 'Return_1D', 'Return_5D', 'Return_10D',
        'Regime_Trend_Strength', 'Regime_Return_5D', 'Regime_Return_20D',
        'Regime_Volatility', 'Regime_ATR', 'Regime_BB_Width', 'Regime_ADX'
    ]

    # Preview Data
    preview_head = clean_df.head(10).to_dict(orient='records')
    preview_tail = clean_df.tail(5).to_dict(orient='records')

    return {
        'success': True,
        'message': f'Feature engineering completed for {symbol.upper()}. Saved to data/processed/{processed_filename}',
        'filename': processed_filename,
        'rows': total_rows,
        'columns': list(clean_df.columns),
        'added_features': added_features,
        'class_balance': {
            'ups': ups,
            'downs': downs,
            'up_percentage': up_percentage
        },
        'preview_head': preview_head,
        'preview_tail': preview_tail,
        'chart_data': {
            'dates': clean_df['Date'].tolist(),
            'close': clean_df['Close'].tolist(),
            'rsi': clean_df['RSI'].tolist(),
            'macd': clean_df['MACD'].tolist(),
            'macd_signal': clean_df['MACD_Signal'].tolist()
        }
    }

@router.post("/process")
async def api_process_features(payload: ProcessFeaturesRequest):
    symbol = payload.symbol.lower()
    logger.info(f"Received request to process features for symbol: {symbol}")
    
    try:
        # Offload feature engineering to thread pool
        result = await asyncio.to_thread(_process_features_sync, symbol)
        logger.info(f"Successfully engineered features for {symbol}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Error engineering features for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error engineering features: {str(e)}")

def _list_features_sync() -> list:
    files = []
    if os.path.exists(PROCESSED_DIR):
        for f in os.listdir(PROCESSED_DIR):
            if f.endswith('_features.csv'):
                symbol = f.replace('_features.csv', '').upper()
                filepath = os.path.join(PROCESSED_DIR, f)
                df = pd.read_csv(filepath)
                files.append({
                    'filename': f,
                    'symbol': symbol,
                    'rows': len(df),
                    'features_count': len(df.columns) - 7  # Date, OHLCV, Target
                })
    return files

@router.get("/list")
async def api_list_features():
    logger.debug("Listing all processed feature datasets")
    datasets = await asyncio.to_thread(_list_features_sync)
    return {'success': True, 'datasets': datasets}
