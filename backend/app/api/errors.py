from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from app.core.logging import get_logger

logger = get_logger("api.errors")

def setup_exception_handlers(app: FastAPI):
    """
    Registers custom exception handlers on the FastAPI application for uniform
    error handling and detailed logging.
    """
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(
            f"HTTPException on {request.method} {request.url.path}: "
            f"status_code={exc.status_code}, detail={exc.detail}"
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": exc.detail,
                "detail": exc.detail
            }
        )

    @app.exception_handler(Exception)  
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(
            f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}"
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Internal Server Error. Please contact administrator.",
                "detail": str(exc)
            }
        )
