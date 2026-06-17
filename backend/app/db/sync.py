import os
import pickle
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from app.config import RAW_DIR, MODELS_DIR, PROCESSED_DIR
from app.db.models import DBStock, DBTrainedModel
from app.core.logging import get_logger

logger = get_logger("db.sync")

def sync_local_files_to_db(session: Session):
    """
    Scans the local filesystem and populates the database with existing
    datasets and models. Ensures zero data loss when transitioning to a DB.
    """
    logger.info("Synchronizing local files with database...")

    # 1. Sync Stock CSVs
    if os.path.exists(RAW_DIR):
        for f in os.listdir(RAW_DIR):
            if f.endswith('.csv'):
                symbol = f.replace('.csv', '').upper()
                filepath = os.path.join(RAW_DIR, f)
                try:
                    # Check if already exists in DB
                    db_stock = session.query(DBStock).filter(DBStock.symbol == symbol).first()
                    if not db_stock:
                        logger.info(f"Sync: Registering stock {symbol} from filesystem.")
                        # Read CSV basic stats without loading whole file if possible, or read it
                        df = pd.read_csv(filepath)
                        row_count = len(df)
                        
                        start_date = None
                        end_date = None
                        if 'Date' in df.columns and len(df) > 0:
                            start_date = str(df['Date'].iloc[0])
                            end_date = str(df['Date'].iloc[-1])
                            
                        db_stock = DBStock(
                            symbol=symbol,
                            download_status="completed",
                            start_date=start_date,
                            end_date=end_date,
                            row_count=row_count,
                            file_path=f
                        )
                        session.add(db_stock)
                except Exception as e:
                    logger.error(f"Sync: Failed to process stock file {f}: {e}")

    # 2. Sync Trained Models
    if os.path.exists(MODELS_DIR):
        for f in os.listdir(MODELS_DIR):
            if f.endswith('.pkl') and not f.endswith('_regime.pkl'):
                filepath = os.path.join(MODELS_DIR, f)
                try:
                    with open(filepath, 'rb') as file:
                        m_data = pickle.load(file)
                        
                    # Parse symbol and type from filename
                    # Filename format: {symbol}_{model_type}.pkl or {symbol}_{model_type}_regime_aware.pkl
                    parts = f.replace('.pkl', '').split('_')
                    symbol = parts[0].upper()
                    
                    regime_aware = m_data.get('regime_aware', False)
                    model_type = m_data.get('model_type', 'random_forest') # fallback
                    
                    # Check if already exists in DB
                    db_model = session.query(DBTrainedModel).filter(
                        DBTrainedModel.symbol == symbol,
                        DBTrainedModel.model_type == model_type,
                        DBTrainedModel.regime_aware == regime_aware
                    ).first()
                    
                    if not db_model:
                        logger.info(f"Sync: Registering model {f} from filesystem.")
                        
                        # Check if a signals CSV exists for this stock
                        signals_filename = f"{symbol.lower()}_signals.csv"
                        signals_filepath = os.path.join(PROCESSED_DIR, signals_filename)
                        latest_signals_path = signals_filename if os.path.exists(signals_filepath) else None
                        
                        db_model = DBTrainedModel(
                            symbol=symbol,
                            model_type=model_type,
                            regime_aware=regime_aware,
                            file_path=f,
                            metrics_json=m_data.get('metrics', {}),
                            hyperparameters_json=m_data.get('hyperparameters', {}),
                            latest_signals_path=latest_signals_path
                        )
                        session.add(db_model)
                except Exception as e:
                    logger.error(f"Sync: Failed to process model file {f}: {e}")

    session.commit()
    logger.info("Local files synchronization completed.")
