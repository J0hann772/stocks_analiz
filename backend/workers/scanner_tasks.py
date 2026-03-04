import asyncio
import logging
import json
from datetime import datetime, timezone
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import importlib.util

from core.database.session import async_session_maker
from models.schemas import ScannerResult
from models.models import Strategy
from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

async def background_scan_batch(ctx, job_id: str, strategy_id: int, symbols: list[str], timeframe: str) -> dict:
    """
    Фоновая ARQ-задача по сканированию пакета символов.
    Запускается из backend/api/endpoints/scanner.py (выдает пользователю job_id для опроса статуса).
    Возвращает dict: {"status": "completed", "results": [ScannerResult, ...]}
    """
    logger.info("Запуск задачи %s сканирования %d символов по стратегии %s", job_id, len(symbols), strategy_id)
    redis = await fmp_client._get_redis()
    progress_key = f"scan_progress:{job_id}"
    
    # Init progress
    await redis.set(progress_key, json.dumps({"status": "running", "total": len(symbols), "processed": 0}))
    
    # 1. Загружаем стратегию из БД для получения кода и параметров
    async with async_session_maker() as session:
        result = await session.execute(select(Strategy).where(Strategy.id == strategy_id))
        strategy = result.scalar_one_or_none()
        
        if not strategy:
            error_msg = f"Стратегия {strategy_id} не найдена."
            await redis.set(progress_key, json.dumps({"status": "failed", "error": error_msg}))
            return {"status": "failed", "error": error_msg}
            
        params = strategy.parameters

    # 2. Динамическая загрузка кастомного кода стратегии
    # Если logic_code пустой, используем дефолтный pandas_ta (из services/screener.py логики)
    # Для MVP используем базовую проверку на SMA/RSI

    results = []
    processed = 0

    # 3. Батч-обработка. RateLimiter вшит внутри fmp_client, он гарантирует <= 12 запросов/сек.
    for symbol in symbols:
        try:
            # Используем purpose="calc", скачиваем только 250 свечей
            # Внимание: для 1D нам нужно достаточно истории. Считаем, что лимитов 250 свечей
            # хватит для RSI(14) или SMA(200) + 50 свечей запаса.
            
            # TODO: Для сканера мы можем запрашивать меньше свечей (например, from_date месяц назад)
            # чтобы еще быстрее получать ответ. Здесь идет полный график.
            klines = await fmp_client.get_historical_chart(
                symbol=symbol,
                timeframe=timeframe,
                purpose="calc"
            )
            
            if klines and len(klines) > 0:
                # Переворачиваем, FMP отдает новые сверху
                df = pd.DataFrame(klines).iloc[::-1].reset_index(drop=True)
                
                # Применяем условия стратегии (Пример, базовый RSI)
                # Требуется портировать полную логику из services/screener.py
                # Для этого MVP:
                passed, indicators = evaluate_strategy(df, params)
                
                if passed:
                    latest = df.iloc[-1]
                    res = {
                        "ticker": symbol,
                        "price": round(float(latest.get("close", 0)), 2),
                        "change_pct": 0.0, # Можно вычислить, если нужно
                        "indicators": indicators,
                        "matched": True
                    }
                    results.append(res)

        except Exception as e:
            logger.error(f"Ошибка парсинга {symbol}: {e}")
            
        processed += 1
        # Обновляем прогресс в Redis каждые 10 символов
        if processed % 10 == 0 or processed == len(symbols):
            await redis.set(progress_key, json.dumps({"status": "running", "total": len(symbols), "processed": processed}))

    # 4. Финализация
    await redis.set(progress_key, json.dumps({"status": "completed", "total": len(symbols), "processed": processed}))
    return {"status": "completed", "results": results}

def evaluate_strategy(df: pd.DataFrame, params: dict):
    """
    Базовая оценка индикаторов из services/screener.py
    (перемещена сюда для использования в воркере)
    """
    import pandas_ta as ta
    
    passed = True
    indicator_values = {}
    
    if df.empty or len(df) < 50: # Нужен минимальный запас свечей
        return False, {}

    # Обработка RSI
    if "rsi" in params:
        rsi_params = params["rsi"]
        if rsi_params.get("enabled"):
            length = rsi_params.get("length", 14)
            df.ta.rsi(length=length, append=True)
            col_name = f"RSI_{length}"
            if col_name in df.columns:
                last_rsi = float(df[col_name].iloc[-1])
                indicator_values["RSI"] = round(last_rsi, 2)
                
                # Check oversold condition
                if last_rsi > rsi_params.get("oversold", 30):
                    passed = False

    # Сюда можно добавить MACD, EMA, SMA и т.д.
    
    return passed, indicator_values
