import asyncio
from fastapi import APIRouter, HTTPException
from app.core.data.data_loader import download_stock_data, list_downloaded_stocks  #imports download_stock_data and lis_download_stocks from data_loader.py
from app.schemas.api_models import DownloadRequest
from app.core.logging import get_logger

logger = get_logger("api.data")
router = APIRouter()

@router.post("/download")
async def api_download(payload: DownloadRequest):
    logger.info(f"Received request to download stock: {payload.symbol}")
    
    # Run blocking network IO and file operations in a separate thread
    result = await asyncio.to_thread(
        download_stock_data,
        symbol=payload.symbol,
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    
    if not result.get("success", False):
        error_msg = result.get("message", "Failed to download data")
        logger.error(f"Failed download for {payload.symbol}: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
        
    logger.info(f"Successfully downloaded data for {payload.symbol}")
    return result

@router.get("/stocks")
async def api_stocks():
    logger.debug("Listing all downloaded stock datasets")
    # Run local disk file scanning in a separate thread
    stocks = await asyncio.to_thread(list_downloaded_stocks)
    return {"success": True, "stocks": stocks}
