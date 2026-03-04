from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncEngine

from core.database.base import Base
from core.database.session import engine
from api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Создаём таблицы при запуске (dev-режим). В проде — только Alembic миграции."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Закрываем движок при остановке
    await engine.dispose()


app = FastAPI(
    title="Stock Analysis API",
    description="Backend API for the custom Stock Analysis & Screener platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Настройка CORS для Next.js фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: ограничить в production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем все роутеры
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Stock Analysis API", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
