from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import data, features, models, signals, backtest, explain

app = FastAPI(
    title="QuantML Research Platform API",
    description="Quantitative Machine Learning Pipeline Backend with FastAPI",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with prefixes mapping to our original Flask endpoints
app.include_router(data.router, prefix="/api")
app.include_router(features.router, prefix="/api/features")
app.include_router(models.router, prefix="/api/models")
app.include_router(signals.router, prefix="/api/signals")
app.include_router(backtest.router, prefix="/api/backtest")
app.include_router(explain.router, prefix="/api/explain")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the QuantML Research Platform FastAPI. Interactive documentation is available at /docs or /redoc."
    }
