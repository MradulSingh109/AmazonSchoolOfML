import os

# Base directory is the /backend folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Application Environment Settings
ENV = os.getenv("ENV", "development")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))
WORKERS = int(os.getenv("WORKERS", "1"))

# Data storage directories
RAW_DIR = os.getenv("RAW_DIR", os.path.join(BASE_DIR, 'data', 'raw'))
PROCESSED_DIR = os.getenv("PROCESSED_DIR", os.path.join(BASE_DIR, 'data', 'processed'))
RAW_INTRADAY_DIR = os.getenv("RAW_INTRADAY_DIR", os.path.join(BASE_DIR, 'data', 'raw_intraday'))
PROCESSED_INTRADAY_DIR = os.getenv("PROCESSED_INTRADAY_DIR", os.path.join(BASE_DIR, 'data', 'processed_intraday'))
MODELS_DIR = os.getenv("MODELS_DIR", os.path.join(BASE_DIR, 'models'))

# Logging settings
LOG_DIR = os.getenv("LOG_DIR", os.path.join(BASE_DIR, 'logs'))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - [%(levelname)s] - %(message)s")

# Database settings
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{os.path.join(BASE_DIR, 'quantml_v2.db')}")
SYNC_DATABASE_URL = os.getenv("SYNC_DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'quantml_v2.db')}")

# Ensure critical application directories exist
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(RAW_INTRADAY_DIR, exist_ok=True)
os.makedirs(PROCESSED_INTRADAY_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
