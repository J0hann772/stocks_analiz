from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from services.fmp_client import fmp_client

router = APIRouter(prefix="/charts", tags=["Charts"])


@router.get("/{symbol:path}")
async def get_chart_data(
    symbol: str,
    timeframe: str = Query("1day", description="Таймфрейм: 1min, 5min, 15min, 30min, 1hour, 4hour, 1day"),
    from_date: Optional[str] = Query(None, alias="from", description="Дата начала YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, alias="to", description="Дата конца YYYY-MM-DD"),
    limit: int = Query(600, description="Максимальное количество свечей"),
):
    """
    Получить исторические OHLCV данные для тикера.
    Формат совместим с lightweight-charts.

    Пример: GET /api/v1/charts/AAPL?timeframe=1day&from=2024-01-01
    """
    try:
        import asyncio
        # ─── Symbol normalization ─────────────────────────────
        # FMP uses concatenated format: BTC/USD → BTCUSD, EUR/USD → EURUSD
        clean_symbol = symbol.upper().replace('/', '')
        
        # FMP returns only a few candles for intraday if from_date is not provided
        if not from_date and timeframe != "1day":
            from_date = "2000-01-01"
            
        candles_task = fmp_client.get_historical_chart(
            symbol=clean_symbol,
            timeframe=timeframe,
            from_date=from_date,
            to_date=to_date,
        )
        quote_task = fmp_client.get_quote(clean_symbol)
        candles, quote = await asyncio.gather(candles_task, quote_task)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ошибка получения данных FMP: {e}")

    if not candles:
        raise HTTPException(status_code=404, detail=f"Данные для {symbol} не найдены")

    # Формат lightweight-charts: { time, open, high, low, close, volume }
    result = []
    # FMP возвращает данные от новых к старым. Берем [:limit] чтобы получить самые свежие
    for c in candles[:limit]:
        date_str = c.get("date", "")
        # Для дневок оставляем YYYY-MM-DD (строка).
        # Для интрадей данных конвертируем в unix timestamp (число секунд).
        if timeframe == "1day":
            time_val = date_str[:10]
        else:
            try:
                # FMP возвращает локальное время New York (EST/EDT) `2024-03-03 15:00:00`
                from zoneinfo import ZoneInfo
                ny_tz = ZoneInfo("America/New_York")
                dt_ny = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ny_tz)
                # Возвращаем НАСТОЯЩИЙ UTC timestamp
                time_val = int(dt_ny.timestamp())
            except ValueError:
                time_val = date_str[:10]
                
        result.append({
            "time": time_val,
            "open": c.get("open"),
            "high": c.get("high"),
            "low": c.get("low"),
            "close": c.get("close"),
            "volume": c.get("volume"),
        })

    # lightweight-charts требует данные в возрастающем порядке
    result.sort(key=lambda x: x["time"])

    # Подшивка свежей котировки
    if quote and result:
        last_bar = result[-1]
        q_price = quote.get("price")
        q_timestamp = quote.get("timestamp")
        
        if q_price is not None and q_timestamp is not None:
            if timeframe == "1day":
                from zoneinfo import ZoneInfo
                q_ny_dt = datetime.fromtimestamp(q_timestamp, tz=ZoneInfo("America/New_York"))
                q_time_val = q_ny_dt.strftime("%Y-%m-%d")
                
                if q_time_val == last_bar["time"]:
                    last_bar["close"] = q_price
                    last_bar["high"] = max(last_bar.get("high", q_price), q_price)
                    last_bar["low"] = min(last_bar.get("low", q_price), q_price)
                elif q_time_val > last_bar["time"]:
                    result.append({
                        "time": q_time_val,
                        "open": last_bar["close"],
                        "high": q_price,
                        "low": q_price,
                        "close": q_price,
                        "volume": 0
                    })
            else:
                sec = 60
                if timeframe == "5min": sec = 300
                elif timeframe == "15min": sec = 900
                elif timeframe == "30min": sec = 1800
                elif timeframe == "1hour": sec = 3600
                elif timeframe == "4hour": sec = 14400
                
                diff = q_timestamp - last_bar["time"]
                intervals = diff // sec
                
                if intervals <= 0:
                    last_bar["close"] = q_price
                    last_bar["high"] = max(last_bar.get("high", q_price), q_price)
                    last_bar["low"] = min(last_bar.get("low", q_price), q_price)
                else:
                    q_time_val = last_bar["time"] + intervals * sec
                    result.append({
                        "time": q_time_val,
                        "open": last_bar["close"],
                        "high": q_price,
                        "low": q_price,
                        "close": q_price,
                        "volume": 0
                    })

    return result

@router.get("/quote/{symbol:path}")
async def get_realtime_quote(symbol: str):
    """
    Получить актуальную цену онлайн.
    Используется для подшивки последней (свежей) свечи, так как intraday график 
    FMP иногда отстает на 15 минут для бесплатных аккаунтов.
    """
    try:
        quote = await fmp_client.get_quote(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ошибка получения quote FMP: {e}")
        
    if not quote:
        raise HTTPException(status_code=404, detail=f"Котировка для {symbol} не найдена")
        
    return quote
