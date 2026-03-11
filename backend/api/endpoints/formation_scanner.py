"""
API endpoint для сканера формаций.
"""
import uuid
import json
import logging
from fastapi import APIRouter, HTTPException
from services.formation_scanner import run_formation_scan
from services.tg_notifier import send_scan_summary, send_formation_alert
from services.fmp_client import fmp_client

router = APIRouter(prefix="/formation-scanner", tags=["Formation Scanner"])
logger = logging.getLogger(__name__)

# Кэш последних результатов в Redis (ключ: formation_scan_results)
CACHE_KEY = "formation_scan_results"
PROGRESS_KEY_PREFIX = "formation_scan_progress:"


@router.get("/results")
async def get_results():
    """
    Получить последние результаты сканирования.
    Возвращает top (до 30) и watch (до 100) списки.
    """
    redis = await fmp_client._get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached:
        return json.loads(cached)
    return {"top": [], "watch": [], "scanned_total": 0, "scanned_at": None}


# Сет для хранения сильных ссылок на запущенные фоновые задачи (чтобы GC их не удалил)
background_tasks = set()

@router.post("/run")
async def trigger_scan():
    """
    Запускает сканирование в фоне и возвращает job_id. Задачу можно не ожидать на клиенте.
    """
    job_id = str(uuid.uuid4())
    progress_key = f"{PROGRESS_KEY_PREFIX}{job_id}"
    redis = await fmp_client._get_redis()

    await redis.set(progress_key, json.dumps({"status": "starting", "processed": 0, "total": 0}))

    # Запускаем в фоновом asyncio таске (сохраняем reference)
    import asyncio
    task = asyncio.create_task(_run_scan_task(job_id, progress_key, redis))
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

    return {"job_id": job_id, "status": "started"}


@router.get("/status/{job_id}")
async def get_scan_status(job_id: str):
    """Получить прогресс текущего скана."""
    redis = await fmp_client._get_redis()
    progress_key = f"{PROGRESS_KEY_PREFIX}{job_id}"
    data = await redis.get(progress_key)
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads(data)


async def _run_scan_task(job_id: str, progress_key: str, redis):
    """Внутренний корутин: запускает скан и сохраняет результаты."""
    try:
        # Получаем предыдущие top-символы, чтобы определить новых
        prev_data = await redis.get(CACHE_KEY)
        prev_top_symbols = set()
        if prev_data:
            prev = json.loads(prev_data)
            prev_top_symbols = {r["symbol"] for r in prev.get("top", [])}

        async def on_progress(processed: int, total: int):
            await redis.set(progress_key, json.dumps({
                "status": "running",
                "processed": processed,
                "total": total,
                "pct": round(processed / total * 100) if total else 0
            }))

        results = await run_formation_scan(progress_callback=on_progress)

        # Сохраняем в Redis (кэш на 25 часов)
        await redis.setex(CACHE_KEY, 90000, json.dumps(results))

        # Telegram уведомления
        # Отправляем алерт по НОВЫМ тикерам в top (которых не было раньше)
        new_top_symbols = {r["symbol"] for r in results.get("top", [])}
        newly_promoted = new_top_symbols - prev_top_symbols

        for result in results.get("top", []):
            if result["symbol"] in newly_promoted:
                moved = result["symbol"] in prev_top_symbols
                await send_formation_alert(result, moved_to_top=moved)

        await send_scan_summary(
            top_list=results.get("top", []),
            watch_list=results.get("watch", []),
            total_scanned=results.get("scanned_total", 0)
        )

        await redis.set(progress_key, json.dumps({
            "status": "completed",
            "processed": results.get("scanned_total", 0),
            "total": results.get("scanned_total", 0),
            "pct": 100,
        }))

        logger.info(f"Scan job {job_id} completed")

    except Exception as e:
        logger.error(f"Scan job {job_id} failed: {e}")
        await redis.set(progress_key, json.dumps({"status": "failed", "error": str(e)}))
