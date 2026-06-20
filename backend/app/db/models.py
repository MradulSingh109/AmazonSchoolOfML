from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.session import Base

class DBStock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    download_status = Column(String, default="pending")
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    row_count = Column(Integer, default=0)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DBTrainedModel(Base):
    __tablename__ = "trained_models"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    model_type = Column(String, nullable=False)
    regime_aware = Column(Boolean, default=False)
    file_path = Column(String, nullable=False)
    metrics_json = Column(JSON, nullable=True)
    hyperparameters_json = Column(JSON, nullable=True)
    latest_signals_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to Backtest
    backtests = relationship("DBBacktest", back_populates="model", cascade="all, delete-orphan")

class DBBacktest(Base):
    __tablename__ = "backtests"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("trained_models.id", ondelete="CASCADE"), nullable=True)
    symbol = Column(String, index=True, nullable=False)
    model_type = Column(String, nullable=True)
    regime_aware = Column(Boolean, default=False)
    n_regimes = Column(Integer, nullable=True)
    initial_capital = Column(Float, default=100000.0)
    short_style = Column(String, default="short")
    total_return_pct = Column(Float, default=0.0)
    cagr_pct = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)
    win_rate_pct = Column(Float, default=0.0)
    trades_count = Column(Integer, default=0)
    metrics_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to Model
    model = relationship("DBTrainedModel", back_populates="backtests")


class DBORBStrategyNifty50(Base):
    __tablename__ = "orb_strategy_nifty_50"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("trained_models.id", ondelete="CASCADE"), nullable=True)
    symbol = Column(String, index=True, nullable=False)
    model_type = Column(String, nullable=True)
    regime_aware = Column(Boolean, default=False)
    n_regimes = Column(Integer, nullable=True)
    initial_capital = Column(Float, default=100000.0)
    short_style = Column(String, default="short")
    total_return_pct = Column(Float, default=0.0)
    cagr_pct = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)
    win_rate_pct = Column(Float, default=0.0)
    trades_count = Column(Integer, default=0)
    metrics_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBITSMStrategy(Base):
    __tablename__ = "itsm_strategy"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("trained_models.id", ondelete="CASCADE"), nullable=True)
    symbol = Column(String, index=True, nullable=False)
    model_type = Column(String, nullable=True)
    regime_aware = Column(Boolean, default=False)
    initial_capital = Column(Float, default=100000.0)
    total_return_pct = Column(Float, default=0.0)
    cagr_pct = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    sortino_ratio = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)
    win_rate_pct = Column(Float, default=0.0)
    trades_count = Column(Integer, default=0)
    avg_trade_return_pct = Column(Float, default=0.0)
    metrics_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

