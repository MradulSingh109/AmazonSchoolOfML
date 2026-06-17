import os
import logging
from logging.handlers import RotatingFileHandler
from app.config import LOG_DIR, LOG_LEVEL, LOG_FORMAT

# Set up logging configuration
log_file_path = os.path.join(LOG_DIR, "quantml.log")

# Setup root logger or specific named logger
logger = logging.getLogger("quantml")
logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

# Clear existing handlers to prevent duplicate logs during hot-reload
if logger.hasHandlers():
    logger.handlers.clear()

# Create formatter
formatter = logging.Formatter(LOG_FORMAT)

# Console Handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
console_handler.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger.addHandler(console_handler)

# Rotating File Handler (Max 10MB per file, keeping 5 backups)
try:
    file_handler = RotatingFileHandler(
        log_file_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    logger.addHandler(file_handler)
except Exception as e:
    print(f"Warning: Could not configure rotating file logger: {e}")

def get_logger(module_name: str) -> logging.Logger:
    """
    Returns a configured logger prefixed with the sub-module's name.
    """
    return logging.getLogger(f"quantml.{module_name}")
