import uvicorn
from app.config import HOST, PORT, ENV, WORKERS

if __name__ == "__main__":
    # Start the FastAPI app matching configured host and port settings
    is_dev = ENV == "development"
    
    print(f"Starting QuantML Research Platform in {ENV.upper()} mode...")
    print(f"Listening on http://{HOST}:{PORT}")
    
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=is_dev,
        workers=1 if is_dev else WORKERS
    )
