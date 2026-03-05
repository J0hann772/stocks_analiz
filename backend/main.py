from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncEngine
import os, asyncio

from core.database.base import Base
from core.database.session import engine, redis_client
from core.logging_config import setup_logging, logger
from api.router import api_router
from api.websockets.market import router as ws_market_router
from services.fmp_ws_client import FMPWebSocketClient

# Apply logging config as early as possible (before any other imports that log)
setup_logging()

APP_ENV = os.getenv("APP_ENV", "development")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev). In prod — Alembic migrations only."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    logger.warning("Starting FMP WebSocket client...")
    fmp_client = FMPWebSocketClient(redis_client)
    fmp_task = asyncio.create_task(fmp_client.connect_and_listen())
    
    yield
    # Teardown
    fmp_task.cancel()
    await redis_client.close()
    await engine.dispose()


app = FastAPI(
    title="Stock Analysis API",
    description="Backend API for the custom Stock Analysis & Screener platform",
    version="0.1.0",
    lifespan=lifespan,
    # Disable FastAPI docs in production to reduce attack surface
    docs_url=None if APP_ENV == "production" else "/docs",
    redoc_url=None if APP_ENV == "production" else "/redoc",
)

# CORS — restrict to own domain in production
ALLOWED_ORIGINS = (
    ["https://stockscreener.ru", "https://www.stockscreener.ru"]
    if APP_ENV == "production"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_market_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Stock Analysis API", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=APP_ENV != "production",
        log_config=None,  # Logging configured via logging_config.py
    )

