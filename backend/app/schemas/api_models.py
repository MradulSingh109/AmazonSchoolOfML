from pydantic import BaseModel, Field

class DownloadRequest(BaseModel):
    symbol: str = Field(..., description="Stock symbol to download, e.g. RELIANCE, BTC-USD")
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")

class ProcessFeaturesRequest(BaseModel):
    symbol: str = Field(..., description="Symbol of downloaded dataset to process")

class TrainModelRequest(BaseModel):
    symbol: str = Field(..., description="Symbol of processed dataset to train on")
    model_type: str = Field(..., description="Model algorithm: logistic_regression, random_forest, or xgboost")
    hyperparameters: dict = Field(default={}, description="Optional dictionary of model-specific hyperparameters")
    regime_aware: bool = Field(default=False, description="Whether to train separate models for each detected market regime")

class GenerateSignalsRequest(BaseModel):
    symbol: str = Field(..., description="Symbol of dataset to predict on")
    model_filename: str = Field(..., description="Trained model filename, e.g. reliance_xgboost.pkl")
    threshold: float = Field(default=0.55, ge=0.5, le=0.95, description="Probability threshold for BUY signals")
    short_style: str = Field(default="short", description="Trading style: 'short' (long-short) or 'flat' (long-only)")

class RunBacktestRequest(BaseModel):
    signal_filename: str = Field(..., description="Filename of generated signals dataset")
    initial_capital: float = Field(default=100000.0, gt=0, description="Initial capital amount in INR")
    risk_free_rate: float = Field(default=0.05, ge=0.0, le=0.25, description="Risk-free rate ratio")
    stop_loss: float = Field(default=0.0, ge=0.0, le=50.0, description="Stop loss ratio percentage (e.g. 1.0 for 1%)")
    take_profit: float = Field(default=0.0, ge=0.0, le=100.0, description="Take profit ratio percentage (e.g. 6.0 for 6%)")

class ExplainRequest(BaseModel):
    symbol: str = Field(..., description="Symbol of dataset to explain")
    model_filename: str = Field(..., description="Model filename to calculate SHAP values for")

class DetectRegimeRequest(BaseModel):
    symbol: str = Field(..., description="Stock symbol to detect regimes for")
    n_regimes: int = Field(default=3, ge=2, le=5, description="Number of clusters/states to segment")
    method: str = Field(default="gmm", description="Clustering algorithm: 'gmm' or 'kmeans'")
