import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api import data, features, models, signals, backtest, explain, regime
from app.api.errors import setup_exception_handlers
from app.core.logging import get_logger

logger = get_logger("app.main")

app = FastAPI(
    title="QuantML Research Platform API",
    description="Quantitative Machine Learning Pipeline Backend with FastAPI",
    version="1.0.0"
)

# Setup uniform error/exception handling
setup_exception_handlers(app)

# Create database tables on startup
from app.db.session import sync_engine
from app.db.models import Base

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=sync_engine)
    logger.info("Database tables initialized successfully.")
    
    # Synchronize existing local CSVs and PKL models into DB
    from app.db.session import SyncSessionLocal
    from app.db.sync import sync_local_files_to_db
    try:
        with SyncSessionLocal() as session:
            sync_local_files_to_db(session)
    except Exception as e:
        logger.error(f"Failed to synchronize filesystem with database: {e}")

# Request/Response Logging & Timing Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    path = request.url.path
    method = request.method
    client_host = request.client.host if request.client else "unknown"
    
    logger.info(f"Ingress: {method} {path} from {client_host}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"Egress: {method} {path} - Status: {response.status_code} - Latency: {process_time:.2f}ms")
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"Egress: {method} {path} - Failed - Latency: {process_time:.2f}ms - Error: {str(e)}")
        raise e

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Versioned API Routers (/api/v1)
app.include_router(data.router, prefix="/api/v1")
app.include_router(features.router, prefix="/api/v1/features")
app.include_router(regime.router, prefix="/api/v1/regime")
app.include_router(models.router, prefix="/api/v1/models")
app.include_router(signals.router, prefix="/api/v1/signals")
app.include_router(backtest.router, prefix="/api/v1/backtest")
app.include_router(explain.router, prefix="/api/v1/explain")

#We are using the versioned api routes and the legacy routes to create a smooth transition and to keep the
#routes separated. In future we need to update the app, we cannot just start writing new routes, it will
#break the frontend. So we let the app run of older routes and keep developing the new code. When the code
#is mature, we write new routes and make them compatible with the frontend, the older routes are kept as backup.
#Until the new routes are mature, we will use both the routes. But when the new routes are mature, we will remove
#the older routes and use only the new routes. This is called Backward Compatibility Design in System Design.
# Legacy/Compat Routers (/api)
app.include_router(data.router, prefix="/api")
app.include_router(features.router, prefix="/api/features")
app.include_router(regime.router, prefix="/api/regime")
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

@app.get("/health") #This is health check to output the status of the server. Used by Docker to check if the server is running.
def health_check():    
    """
    Service health check endpoint for deployment monitoring.
    """
    return {
        "status": "healthy",
        "time": time.time(),
        "version": "1.0.0"
    } 
