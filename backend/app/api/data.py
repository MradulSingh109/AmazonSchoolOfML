from fastapi import APIRouter, HTTPException
from app.core.data.data_loader import download_stock_data, list_downloaded_stocks
from app.schemas.api_models import DownloadRequest

router = APIRouter()

@router.post("/download")
async def api_download(payload: DownloadRequest):
    result = download_stock_data(
        symbol=payload.symbol,
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to download data"))
    return result

@router.get("/stocks")
async def api_stocks():
    stocks = list_downloaded_stocks()
    return {"success": True, "stocks": stocks}
