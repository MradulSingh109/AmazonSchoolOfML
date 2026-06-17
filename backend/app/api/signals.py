import os
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.signals.signal_generator import generate_signals
from app.schemas.api_models import GenerateSignalsRequest
from app.config import PROCESSED_DIR, MODELS_DIR
from app.core.logging import get_logger

logger = get_logger("api.signals")
router = APIRouter()

def _generate_signals_sync(symbol: str, model_filename: str, threshold: float, short_style: str) -> dict:
    features_filepath = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    if not os.path.exists(features_filepath):
        raise FileNotFoundError(f"Engineered dataset for {symbol.upper()} not found.")

    model_filepath = os.path.join(MODELS_DIR, model_filename)
    if not os.path.exists(model_filepath):
        raise FileNotFoundError(f"Model file {model_filename} not found.")

    df = pd.read_csv(features_filepath)

    # Signal generation runs on out-of-sample (last 20% of data)
    split_idx = int(len(df) * 0.8)
    df_test = df.iloc[split_idx:].reset_index(drop=True)

    if len(df_test) < 10:
        raise ValueError(f"Dataset size is too small ({len(df)} rows) to generate out-of-sample signals.")

    # Generate signals
    sig_df = generate_signals(
        df_test,
        model_filepath,
        threshold=threshold,
        short_style=short_style
    )

    # Save signals to CSV
    signals_filename = f"{symbol}_signals.csv"
    signals_filepath = os.path.join(PROCESSED_DIR, signals_filename)
    sig_df.to_csv(signals_filepath, index=False)

    # Calculate signal statistics
    total_rows = len(sig_df)
    buys = int((sig_df['Signal'] == 1).sum())
    sells = int((sig_df['Signal'] == (-1 if short_style == 'short' else 0)).sum())
    
    buy_percentage = round((buys / total_rows) * 100, 2) if total_rows > 0 else 0
    sell_percentage = round((sells / total_rows) * 100, 2) if total_rows > 0 else 0
    trades_count = int((sig_df['Position_Change'] != 0).sum())

    preview_head = sig_df.head(10).to_dict(orient='records')
    preview_tail = sig_df.tail(5).to_dict(orient='records')

    return {
        'success': True,
        'message': f"Signals successfully generated for {symbol.upper()}.",
        'filename': signals_filename,
        'rows': total_rows,
        'buys': buys,
        'sells': sells,
        'buy_percentage': buy_percentage,
        'sell_percentage': sell_percentage,
        'trades_count': trades_count,
        'columns': list(sig_df.columns),
        'preview_head': preview_head,
        'preview_tail': preview_tail,
        'chart_data': {
            'dates': sig_df['Date'].tolist(),
            'close': sig_df['Close'].tolist(),
            'probability': sig_df['Probability'].tolist(),
            'signals': sig_df['Signal'].tolist()
        }
    }

@router.post("/generate")
async def api_generate_signals(payload: GenerateSignalsRequest):
    symbol = payload.symbol.lower()
    model_filename = payload.model_filename
    threshold = payload.threshold
    short_style = payload.short_style
    
    logger.info(f"Received request to generate signals: symbol={symbol}, model={model_filename}, threshold={threshold}")
    
    try:
        result = await asyncio.to_thread(_generate_signals_sync, symbol, model_filename, threshold, short_style)
        logger.info(f"Successfully generated signals for {symbol}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error generating signals for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating signals: {str(e)}")

def _list_signals_sync() -> list:
    files = []
    if os.path.exists(PROCESSED_DIR):
        for f in os.listdir(PROCESSED_DIR):
            if f.endswith('_signals.csv'):
                symbol = f.replace('_signals.csv', '').upper()
                filepath = os.path.join(PROCESSED_DIR, f)
                df = pd.read_csv(filepath)
                
                buys = int((df['Signal'] == 1).sum())
                total_rows = len(df)
                buy_percentage = round((buys / total_rows) * 100, 1) if total_rows > 0 else 0

                files.append({
                    'filename': f,
                    'symbol': symbol,
                    'rows': total_rows,
                    'buy_percentage': buy_percentage
                })
    return files

@router.get("/list")
async def api_list_signals():
    logger.debug("Listing all signal datasets")
    datasets = await asyncio.to_thread(_list_signals_sync)
    return {'success': True, 'datasets': datasets}
