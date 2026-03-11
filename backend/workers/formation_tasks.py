"""
ARQ-задачи для сканирования формаций.
"""
import logging
import json
from services.formation_scanner import run_formation_scan
from services.tg_notifier import send_scan_summary, send_formation_alert
from core.database.session import redis_client

logger = logging.getLogger(__name__)

CACHE_KEY = "formation_scan_results"

async def daily_formation_scan(ctx):
    """
    Ежедневный скан всего рынка.
    Запускается по расписанию через ARQ cron.
    """
    logger.info("Starting daily formation scan...")
    
    # Сохраняем предыдущие топы для уведомлений
    prev_data = await redis_client.get(CACHE_KEY)
    prev_top_symbols = set()
    if prev_data:
        try:
            prev = json.loads(prev_data)
            prev_top_symbols = {r["symbol"] for r in prev.get("top", [])}
        except Exception:
            pass

    # Запуск сканирования
    results = await run_formation_scan()
    
    # Сохраняем в кэш
    await redis_client.setex(CACHE_KEY, 90000, json.dumps(results)) # 25 часов

    # Уведомления о продвижении в ТОП
    new_top_symbols = {r["symbol"] for r in results.get("top", [])}
    newly_promoted = new_top_symbols - prev_top_symbols

    for result in results.get("top", []):
        if result["symbol"] in newly_promoted:
            moved = result["symbol"] in prev_top_symbols # Хотя newly_promoted уже учитывает это
            await send_formation_alert(result, moved_to_top=True) # Все новые в топе - алертим

    # Итог в ТГ
    await send_scan_summary(
        top_list=results.get("top", []),
        watch_list=results.get("watch", []),
        total_scanned=results.get("scanned_total", 0)
    )
    
    logger.info("Daily formation scan completed.")
