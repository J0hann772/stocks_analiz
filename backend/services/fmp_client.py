import json
import logging
import aiohttp
import redis.asyncio as aioredis
from typing import Optional, Any

from core.config import settings
from core.rate_limiter import fmp_limiter

logger = logging.getLogger(__name__)

# Время жизни кэша
CACHE_TTL_4H = 60 * 15      # 15 минут для 4-часовиков
CACHE_TTL_1D = 60 * 60 * 4  # 4 часа для дневок


class FMPClient:
    """
    Асинхронный клиент для Financial Modeling Prep API.
    Автоматически кэширует ответы в Redis.
    """

    def __init__(self):
        self.base_url = settings.FMP_BASE_URL
        self.api_key = settings.FMP_API_KEY
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _get(self, endpoint: str, params: dict = None, ttl: int = None, quiet_errors: list[int] = None) -> Any:
        """Выполнить GET-запрос к FMP, используя Redis-кэш."""
        params = params or {}
        fmp_params = params.copy()
        
        # Извлекаем внутренние параметры, которые не должны идти в FMP
        purpose = fmp_params.pop("purpose", "general")
        timeframe = fmp_params.pop("timeframe", "")
        
        # Ключ кэша формируем ДО добавления apikey и ПОСЛЕ очистки внутренних параметров
        # Но purpose включаем в префикс для разделения контекстов (calc vs chart)
        cache_key = f"fmp:{purpose}:{endpoint}:{json.dumps(fmp_params, sort_keys=True)}"
        
        # Теперь добавляем ключ для самого запроса
        fmp_params["apikey"] = self.api_key

        redis = await self._get_redis()

        # Пробуем взять из кэша
        cached = await redis.get(cache_key)
        if cached:
            logger.debug("Cache HIT для %s", cache_key)
            return json.loads(cached)

        # Rate Limiting перед запросом
        await fmp_limiter.acquire()

        # Идём в API
        url = f"{self.base_url}/{endpoint}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=fmp_params) as response:
                if response.status != 200:
                    text = await response.text()
                    if quiet_errors and response.status in quiet_errors:
                        logger.debug("FMP API Error %d on %s (muted)", response.status, url)
                    else:
                        logger.error("FMP API Error %d on %s: %s", response.status, url, text)
                    response.raise_for_status()
                
                data = await response.json()


        # Динамический TTL в зависимости от timeframe (если есть)
        actual_ttl = ttl
        if actual_ttl is None:
            if timeframe == "1day":
                actual_ttl = 60 * 60 * 4  # 4 часа
            elif timeframe == "4hour":
                actual_ttl = 60 * 60 * 2  # 2 часа
            elif timeframe == "1hour":
                actual_ttl = 60 * 30      # 30 минут
            elif timeframe == "30min":
                actual_ttl = 60 * 15      # 15 минут
            elif timeframe == "15min":
                actual_ttl = 60 * 5       # 5 минут
            elif timeframe == "5min":
                actual_ttl = 60 * 2       # 2 минуты
            elif timeframe == "1min":
                actual_ttl = 60           # 1 минута
            else:
                actual_ttl = 60 * 5       # 5 минут по умолчанию

        # Сохраняем в кэш
        await redis.setex(cache_key, actual_ttl, json.dumps(data))
        logger.debug("Cache SET для %s (TTL=%ds)", cache_key, actual_ttl)
        return data

    # ─────────────── Публичные методы ───────────────

    async def get_historical_chart(
        self,
        symbol: str,
        timeframe: str = "1day",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        purpose: str = "chart", # "chart" (500 bars) or "calc" (250 bars)
    ) -> list[dict]:
        """
        Получить исторические данные (OHLCV) для тикера.
        timeframe: 1min, 5min, 15min, 30min, 1hour, 4hour, 1day (daily)
        """
        if timeframe == "1day":
            endpoint = "historical-price-eod/full"
        else:
            endpoint = f"historical-chart/{timeframe}"

        params = {
            "symbol": symbol,
            "timeframe": timeframe,
            "purpose": purpose
        }
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        data = await self._get(endpoint, params=params, ttl=None)

        # FMP возвращает либо список напрямую, либо {"historical": [...]}
        if isinstance(data, list):
            return data
        return data.get("historical", [])

    async def get_quote(self, symbol: str) -> Optional[dict]:
        """Текущая котировка тикера."""
        data = await self._get("quote", params={"symbol": symbol})
        return data[0] if data else None

    async def get_sp500_constituents(self) -> list[str]:
        """Список тикеров S&P 500."""
        data = await self._get("sp500-constituent", ttl=60 * 60 * 4)  # 4 часа
        return [item["symbol"] for item in data] if data else []

    async def get_company_profile(self, symbol: str) -> Optional[dict]:
        """Профиль компании (сектор, описание, капитализация и т.д.)."""
        data = await self._get("profile", params={"symbol": symbol})
        return data[0] if data else None

    async def get_historical_backtest_data(
        self,
        symbol: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        timeframe: str = "5min",
    ) -> list[dict]:
        """
        Получить исторические данные для бэктестов.
        Используем 5min или 15min, чтобы обойти ограничение FMP в 2 дня для 1min графиков.
        Активно кэшируется в Redis, чтобы избежать перерасхода лимитов API.
        """
        params = {
            "symbol": symbol,
            "timeframe": timeframe,
            "purpose": "backtest" # Специальный purpose для генерации уникального ключа
        }
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        endpoint = f"historical-chart/{timeframe}"
        
        # Кэшируем результаты бэктеста на неделю
        data = await self._get(endpoint, params=params, ttl=60 * 60 * 24 * 7)

        if isinstance(data, list):
            return data
        return data.get("historical", [])

    async def close(self):
        if self._redis:
            await self._redis.aclose()


fmp_client = FMPClient()
