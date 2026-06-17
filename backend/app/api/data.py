import os
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.data.data_loader import download_stock_data
from app.schemas.api_models import DownloadRequest
from app.config import RAW_DIR
from app.core.logging import get_logger
from app.db.session import get_db
from app.db.models import DBStock

logger = get_logger("api.data")
router = APIRouter()

@router.post("/download")
async def api_download(payload: DownloadRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Received request to download stock: {payload.symbol}")
    
    symbol_upper = payload.symbol.upper()
    
    # Check if stock exists or create it
    stmt = select(DBStock).where(DBStock.symbol == symbol_upper)
    db_res = await db.execute(stmt)
    db_stock = db_res.scalars().first()
    
    if not db_stock:
        db_stock = DBStock(symbol=symbol_upper, download_status="pending")
        db.add(db_stock)
        await db.commit()
        await db.refresh(db_stock)

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
        db_stock.download_status = "failed"
        await db.commit()
        raise HTTPException(status_code=400, detail=error_msg)
        
    logger.info(f"Successfully downloaded data for {payload.symbol}")
    
    # Update status and info in the DB
    db_stock.download_status = "completed"
    db_stock.start_date = payload.start_date
    db_stock.end_date = payload.end_date
    db_stock.row_count = result.get("rows", 0)
    db_stock.file_path = result.get("filename", "")
    await db.commit()
    
    return result

@router.get("/stocks")
async def api_stocks(db: AsyncSession = Depends(get_db)):
    logger.debug("Listing all downloaded stock datasets from DB")
    
    stmt = select(DBStock).where(DBStock.download_status == "completed")
    db_res = await db.execute(stmt)
    stocks_db = db_res.scalars().all()
    
    stocks = []
    for s in stocks_db:
        size_kb = 0.0
        if s.file_path:
            full_path = os.path.join(RAW_DIR, s.file_path)
            if os.path.exists(full_path):
                size_kb = round(os.path.getsize(full_path) / 1024, 1)
                
        stocks.append({
            'filename': s.file_path or f"{s.symbol.lower()}.csv",
            'symbol': s.symbol,
            'size_kb': size_kb,
            'rows': s.row_count,
            'modified': s.updated_at.strftime('%Y-%m-%d %H:%M')
        })
        
    return {"success": True, "stocks": stocks}

