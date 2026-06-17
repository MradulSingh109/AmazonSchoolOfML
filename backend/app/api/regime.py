import os
import pickle
import asyncio
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.core.regime.regime_detector import fit_regime_detector
from app.schemas.api_models import DetectRegimeRequest
from app.config import PROCESSED_DIR, MODELS_DIR
from app.core.logging import get_logger

logger = get_logger("api.regime")
router = APIRouter()

def _detect_regimes_sync(symbol: str, n_regimes: int, method: str) -> dict:
    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    if not os.path.exists(features_path):
        raise FileNotFoundError(f"Engineered dataset for {symbol.upper()} not found. Run Feature Engineering first.")

    # 1. Load dataset
    df = pd.read_csv(features_path)

    # 2. Run clustering and stats
    results = fit_regime_detector(df, n_regimes=n_regimes, method=method)

    # 3. Map labels and probabilities back to original dataframe (including raw NaN rows)
    dates = results['dates']
    labels = results['labels']
    probabilities = results['probabilities']

    regime_map = dict(zip(dates, labels))
    df['Regime_Cluster'] = df['Date'].map(regime_map).fillna(-1).astype(int)

    # Map probabilities for Bear (0), Sideways (1), and Bull (2)
    if n_regimes == 3:
        bear_map = dict(zip(dates, [p[0] for p in probabilities]))
        sideways_map = dict(zip(dates, [p[1] for p in probabilities]))
        bull_map = dict(zip(dates, [p[2] for p in probabilities]))
        df['Regime_Prob_Bear'] = df['Date'].map(bear_map).fillna(0.0)
        df['Regime_Prob_Sideways'] = df['Date'].map(sideways_map).fillna(0.0)
        df['Regime_Prob_Bull'] = df['Date'].map(bull_map).fillna(0.0)
    else:
        # Dynamic naming for arbitrary cluster sizes
        for r in range(n_regimes):
            r_map = dict(zip(dates, [p[r] for p in probabilities]))
            df[f'Regime_Prob_{r}'] = df['Date'].map(r_map).fillna(0.0)

    # Save the updated processed features CSV
    df.to_csv(features_path, index=False)

    # 4. Save the fitted model package to MODELS_DIR
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)

    model_filename = f"{symbol}_regime.pkl"
    model_path = os.path.join(MODELS_DIR, model_filename)

    with open(model_path, 'wb') as f:
        pickle.dump(results['package'], f)

    return {
        'success': True,
        'message': f"Successfully ran {method.upper()} regime detection on {symbol.upper()}.",
        'symbol': symbol.upper(),
        'method': method,
        'regimes_count': n_regimes,
        'dates': dates,
        'close': results['close'],
        'labels': labels,
        'probabilities': probabilities,
        'stats': results['stats']
    }

@router.post("/detect")
async def api_detect_regimes(payload: DetectRegimeRequest):
    symbol = payload.symbol.lower()
    n_regimes = payload.n_regimes
    method = payload.method.lower()
    
    logger.info(f"Received regime detection request: symbol={symbol}, regimes={n_regimes}, method={method}")
    
    try:
        result = await asyncio.to_thread(_detect_regimes_sync, symbol, n_regimes, method)
        logger.info(f"Successfully finished regime detection for {symbol}")
        return result
    except FileNotFoundError as e:
        logger.warning(str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Error executing regime detection for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing regime detection: {str(e)}")

def _list_regime_models_sync() -> list:
    regime_models = []
    if os.path.exists(MODELS_DIR):
        for f in os.listdir(MODELS_DIR):
            if f.endswith('_regime.pkl'):
                filepath = os.path.join(MODELS_DIR, f)
                try:
                    with open(filepath, 'rb') as file:
                        package = pickle.load(file)
                        symbol = f.replace('_regime.pkl', '').upper()
                        regime_models.append({
                            'filename': f,
                            'symbol': symbol,
                            'method': package.get('method', 'gmm'),
                            'n_regimes': package.get('n_regimes', 3),
                            'stats': package.get('regime_stats', {})
                        })
                except Exception as e:
                    logger.error(f"Error loading regime file {f}: {e}")
    return regime_models

@router.get("/list")
async def api_list_regime_models():
    logger.debug("Listing all regime models")
    models = await asyncio.to_thread(_list_regime_models_sync)
    return {'success': True, 'regime_models': models}
