from fastapi import APIRouter, HTTPException, Depends
import uuid
import json
from arq.connections import create_pool, RedisSettings
from core.config import settings
from models.schemas import ScannerParams, ScannerResult, JobResponse, JobProgress
from services.fmp_client import fmp_client

router = APIRouter(prefix="/scanner", tags=["Scanner"])

async def get_arq_redis():
    """Создает пул подключений к Redis для ARQ"""
    return await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))

@router.post("/scan", response_model=JobResponse)
async def start_scan_job(params: ScannerParams):
    """
    Запускает скрининг акций в фоновом режиме (ARQ Worker).
    Возвращает job_id для последующего опроса статуса.
    """
    tickers = params.tickers
    if not tickers:
        sp500 = await fmp_client.get_sp500_constituents()
        tickers = sp500[:100]  # Начинаем с первых 100 для скорости тестирования
        
    job_id = f"scan_{uuid.uuid4().hex[:8]}"
    
    # Инициализация статуса в кэше
    redis = await fmp_client._get_redis()
    progress_key = f"scan_progress:{job_id}"
    await redis.set(progress_key, json.dumps({"status": "queued", "total": len(tickers), "processed": 0}))
    
    # Отправка задачи в очередь ARQ.
    # Обратите внимание, что мы передаем "strategy_id" равным 1 (заглушка для MVP),
    # В реальности его нужно передавать из `params` фронтенда.
    strategy_id = 1
    
    arq_redis = await get_arq_redis()
    await arq_redis.enqueue_job(
        'background_scan_batch', 
        job_id, strategy_id, tickers, params.timeframe, 
        _job_id=job_id
    )
    
    return JobResponse(job_id=job_id, message="Скрининг запущен в фоне")


@router.get("/scan/{job_id}", response_model=JobProgress)
async def get_scan_status(job_id: str):
    """
    Возвращает текущий прогресс фоновой задачи сканирования.
    """
    redis = await fmp_client._get_redis()
    progress_key = f"scan_progress:{job_id}"
    
    data = await redis.get(progress_key)
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return JobProgress(**json.loads(data))

