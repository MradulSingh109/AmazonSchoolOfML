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

    # Cleanup any incorrect "ITSM" symbol records previously created by faulty sync
    try:
        session.query(DBTrainedModel).filter(DBTrainedModel.symbol == 'ITSM').delete(synchronize_session=False)
    except Exception as e:
        logger.error(f"Sync: Failed to clean up malformed 'ITSM' symbol records: {e}")

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
                    # Or for ITSM: itsm_{symbol}_{model_type}.pkl
                    parts = f.replace('.pkl', '').split('_')
                    if parts[0].lower() == 'itsm':
                        symbol = parts[1].upper()
                        regime_aware = False
                        model_type = f"ITSM_{m_data.get('model_type', 'linear_regression').upper()}"
                    else:
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

    # 3. Copy/Sync ORB RVOL backtests to orb_strategy_nifty_50 table
    try:
        from app.db.models import DBBacktest, DBORBStrategyNifty50
        orb_backtests = session.query(DBBacktest).filter(DBBacktest.model_type == 'ORB_RVOL').all()
        for ob in orb_backtests:
            exists = session.query(DBORBStrategyNifty50).filter(
                DBORBStrategyNifty50.symbol == ob.symbol,
                DBORBStrategyNifty50.model_type == ob.model_type,
                DBORBStrategyNifty50.total_return_pct == ob.total_return_pct,
                DBORBStrategyNifty50.trades_count == ob.trades_count
            ).first()
            if not exists:
                logger.info(f"Sync: Copying backtest record for {ob.symbol} to orb_strategy_nifty_50 table.")
                new_orb_record = DBORBStrategyNifty50(
                    model_id=ob.model_id,
                    symbol=ob.symbol,
                    model_type=ob.model_type,
                    regime_aware=ob.regime_aware,
                    n_regimes=ob.n_regimes,
                    initial_capital=ob.initial_capital,
                    short_style=ob.short_style,
                    total_return_pct=ob.total_return_pct,
                    cagr_pct=ob.cagr_pct,
                    sharpe_ratio=ob.sharpe_ratio,
                    max_drawdown_pct=ob.max_drawdown_pct,
                    win_rate_pct=ob.win_rate_pct,
                    trades_count=ob.trades_count,
                    metrics_json=ob.metrics_json,
                    created_at=ob.created_at
                )
                session.add(new_orb_record)
    except Exception as e:
        logger.error(f"Sync: Failed to copy backtest strategy data to orb_strategy_nifty_50: {e}")

    # 4. Copy/Sync ITSM backtests to itsm_strategy table
    try:
        from app.db.models import DBBacktest, DBITSMStrategy
        itsm_backtests = session.query(DBBacktest).filter(DBBacktest.model_type.like('ITSM_%')).all()
        for ib in itsm_backtests:
            exists = session.query(DBITSMStrategy).filter(
                DBITSMStrategy.symbol == ib.symbol,
                DBITSMStrategy.model_type == ib.model_type,
                DBITSMStrategy.total_return_pct == ib.total_return_pct,
                DBITSMStrategy.trades_count == ib.trades_count
            ).first()
            if not exists:
                logger.info(f"Sync: Copying backtest record for {ib.symbol} to itsm_strategy table.")
                metrics = ib.metrics_json or {}
                new_itsm_record = DBITSMStrategy(
                    model_id=ib.model_id,
                    symbol=ib.symbol,
                    model_type=ib.model_type,
                    regime_aware=ib.regime_aware,
                    initial_capital=ib.initial_capital,
                    total_return_pct=ib.total_return_pct,
                    cagr_pct=ib.cagr_pct,
                    sharpe_ratio=ib.sharpe_ratio,
                    sortino_ratio=float(metrics.get('sortino_ratio', 0.0)),
                    max_drawdown_pct=ib.max_drawdown_pct,
                    win_rate_pct=ib.win_rate_pct,
                    trades_count=ib.trades_count,
                    avg_trade_return_pct=float(metrics.get('avg_trade_return_pct', 0.0)),
                    metrics_json=ib.metrics_json,
                    created_at=ib.created_at
                )
                session.add(new_itsm_record)
    except Exception as e:
        logger.error(f"Sync: Failed to copy backtest strategy data to itsm_strategy: {e}")

    session.commit()
    logger.info("Local files synchronization completed.")
