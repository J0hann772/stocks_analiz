"""
Formation Scanner (Stage 1 Base detector)

Ищет акции США по 5 критериям:
1. Снижение цены от максимума за 24 мес. на 70-95%
2. Боковое движение (флет ±10%) в течение 10-365 дней
3. 1-2 свечи выкупа (объем +50% + рост +3%)
4. Объем периода флета на 50% ниже объема периода падения
5. Доля инсайдеров ≥ 18%
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import pandas as pd
from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

logger.setLevel(logging.DEBUG)

# ──────────────────────────────────────────────────────────
# Константы
# ──────────────────────────────────────────────────────────
DROP_MIN = 0.70       # минимальный спад 70%
DROP_MAX = 0.95       # максимальный спад 95%
RANGE_BAND = 0.10     # флет ±10%
RANGE_MIN_DAYS = 10
RANGE_MAX_DAYS = 365
BUYOUT_VOL_MULT = 1.5  # объем выкупа > 150% от среднего
BUYOUT_PRICE_PCT = 0.03  # рост в день выкупа > 3%
VOL_DECLINE_PCT = 0.50   # объем флета < 50% объема падения
INSIDER_MIN_PCT = 18.0   # доля инсайдеров ≥ 18%

CONCURRENCY = 20  # max parallel asyncio tasks


# ──────────────────────────────────────────────────────────
# Pre-screener: получаем предварительный список кандидатов
# ──────────────────────────────────────────────────────────
async def get_pre_screener_candidates() -> list[str]:
    """
    Используем FMP /stock-screener для предфильтрации:
    - Цена акции > $0.10 (исключаем penny stocks < 0.10)
    - Рыночная капитализация > $50M (только реальные компании)
    - Страна = US
    - Биржы = NASDAQ, NYSE, AMEX
    Возвращает список тикеров (~300-800 кандидатов).
    """
    try:
        data = await fmp_client._get("company-screener", params={
            "country": "US",
            "exchange": "NYSE,NASDAQ,AMEX",
            "priceLessThan": 50,
            "priceMoreThan": 0.10,
            "marketCapMoreThan": 50000000,
            "isEtf": "false",
            "isFund": "false",
            "isActivelyTrading": "true",
            "limit": 2000,
        }, ttl=60 * 60 * 4)  # Кэш на 4 часа
        if data:
            results = [item["symbol"] for item in data if "symbol" in item]
            logger.info("Found %d pre-screener candidates", len(results))
            return results
    except Exception as e:
        logger.error(f"Pre-screener error: {e}")
    return []


# ──────────────────────────────────────────────────────────
# Анализ одного тикера
# ──────────────────────────────────────────────────────────
async def analyze_symbol(symbol: str) -> Optional[dict]:
    """
    Полная проверка тикера по 5 критериям.
    Возвращает dict с результатами или None если данных мало.
    """
    try:
        # Загружаем дневные свечи за 26 месяцев через get_historical_chart
        since = (datetime.now() - timedelta(days=26 * 30)).strftime("%Y-%m-%d")
        to_date = datetime.now().strftime("%Y-%m-%d")

        raw = await fmp_client.get_historical_chart(
            symbol=symbol,
            timeframe="1day",
            from_date=since,
            to_date=to_date,
            purpose="calc"
        )
        if not raw or len(raw) < 60:
            return None

        df = pd.DataFrame(raw)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)
        df = df.rename(columns={"adjClose": "adj_close"} if "adjClose" in df.columns else {})

        score = 0
        criteria = {
            "drop_70_95": False,
            "flat_range": False,
            "buyout_candles": False,
            "low_volume": False,
            "insider_ownership": False,
        }
        details = {}

        # ── Критерий 1: Снижение на 70-95% от максимума за 24 мес. ──
        df_24m = df[df["date"] >= (datetime.now() - timedelta(days=24 * 30))]
        if df_24m.empty:
            return None

        peak_price = float(df_24m["high"].max())
        current_price = float(df.iloc[-1]["close"])
        if peak_price <= 0 or current_price <= 0:
            return None

        drop_pct = (peak_price - current_price) / peak_price
        details["drop_pct"] = round(drop_pct * 100, 1)
        details["peak_price"] = round(peak_price, 2)
        details["current_price"] = round(current_price, 2)

        if DROP_MIN <= drop_pct <= DROP_MAX:
            criteria["drop_70_95"] = True
            score += 1

        # ── Критерий 2: Флет ±10% в течение 10-365 дней ──
        # Ищем максимальный отрезок в конце, где диапазон high/low ≤ 10%
        flat_days = 0
        flat_start_idx = len(df) - 1
        base_level = current_price

        for i in range(len(df) - 1, -1, -1):
            row = df.iloc[i]
            row_close = float(row["close"])
            if abs(row_close - base_level) / base_level > RANGE_BAND:
                break
            flat_days += 1
            flat_start_idx = i

        details["flat_days"] = flat_days
        if RANGE_MIN_DAYS <= flat_days <= RANGE_MAX_DAYS:
            criteria["flat_range"] = True
            score += 1

        # ── Критерий 3: Свечи выкупа (объем +50%, рост +3%) ──
        if flat_days > 0:
            flat_df = df.iloc[flat_start_idx:]
            avg_vol = float(flat_df["volume"].mean()) if not flat_df.empty else 1
            buyout_count = 0
            for _, row in flat_df.iterrows():
                day_vol = float(row["volume"])
                day_open = float(row["open"])
                day_close = float(row["close"])
                if day_open > 0:
                    day_change = (day_close - day_open) / day_open
                    if day_vol > avg_vol * BUYOUT_VOL_MULT and day_change >= BUYOUT_PRICE_PCT:
                        buyout_count += 1

            details["buyout_candles"] = buyout_count
            if 1 <= buyout_count <= 10:  # 1 или более свечей выкупа
                criteria["buyout_candles"] = True
                score += 1

        # ── Критерий 4: Объем периода флета < 50% объема периода падения ──
        if flat_days > 0 and flat_start_idx > 0:
            decline_df = df.iloc[:flat_start_idx]
            flat_df2 = df.iloc[flat_start_idx:]

            avg_vol_decline = float(decline_df["volume"].mean()) if not decline_df.empty else 1
            avg_vol_flat = float(flat_df2["volume"].mean()) if not flat_df2.empty else 1

            vol_ratio = avg_vol_flat / avg_vol_decline if avg_vol_decline > 0 else 1
            details["vol_ratio"] = round(vol_ratio, 2)

            if vol_ratio <= (1 - VOL_DECLINE_PCT):
                criteria["low_volume"] = True
                score += 1

        # ── Критерий 5: Доля инсайдеров ≥ 18% ──
        # Пробуем получить данные, если endpoint недоступен — пропускаем критерий.
        # Для оптимизации запрашиваем API ТОЛЬКО если акция уже набрала хотя бы 2 балла
        # (упала на 70% и находится во флете), чтобы не спамить 404 ошибками.
        insider_pct = 0.0
        
        if score >= 2:
            try:
                import aiohttp as _aiohttp
                insider_data = await fmp_client._get(
                    "institutional-ownership/insider-ownership",
                    params={"symbol": symbol, "limit": 1},
                    ttl=60 * 60 * 24,
                    quiet_errors=[404, 403]
                )
                if insider_data and isinstance(insider_data, list) and len(insider_data) > 0:
                    insider_pct = float(insider_data[0].get("insidersOwnership", 0) or 0) * 100
            except (_aiohttp.ClientResponseError, Exception):
                pass  # Endpoint недоступен — не ломаем весь анализ
        
        details["insider_pct"] = round(insider_pct, 1)
        if insider_pct >= INSIDER_MIN_PCT:
            criteria["insider_ownership"] = True
            score += 1


        # Определяем список (top/watch/none)
        if score == 5:
            list_type = "top"
        elif score >= 3:
            list_type = "watch"
        else:
            return None  # Не интересно

        # Цветовой маркер
        if score == 5:
            badge = "green"
        elif score == 4:
            badge = "yellow"
        else:
            badge = "orange"

        return {
            "symbol": symbol,
            "score": score,
            "badge": badge,
            "list_type": list_type,
            "criteria": criteria,
            "details": details,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"[{symbol}] analyze error: {e}")
        return None


# ──────────────────────────────────────────────────────────
# Основная функция полного скана
# ──────────────────────────────────────────────────────────
async def run_formation_scan(
    progress_callback=None
) -> dict:
    """
    Полный скан: pre-filter → анализ → сортировка → два списка.
    progress_callback(processed, total) вызывается каждые 10 тикеров.
    """
    logger.info("Formation scan started")
    
    # 1. Pre-screener — получаем ~500-2000 кандидатов
    candidates = await get_pre_screener_candidates()
    if not candidates:
        logger.warning("Pre-screener returned 0 candidates, fallback to SP500")
        candidates = await fmp_client.get_sp500_constituents()

    total = len(candidates)
    logger.info(f"Analyzing {total} candidates...")

    results = []
    processed = 0

    # 2. Параллельная обработка пакетами по CONCURRENCY
    for i in range(0, total, CONCURRENCY):
        batch = candidates[i:i + CONCURRENCY]
        tasks = [analyze_symbol(sym) for sym in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=False)
        
        for r in batch_results:
            if r is not None:
                results.append(r)
        
        processed += len(batch)
        if progress_callback:
            await progress_callback(processed, total)

    # 3. Сортировка
    results.sort(key=lambda x: (x["score"], x["details"].get("flat_days", 0)), reverse=True)

    top_list = [r for r in results if r["list_type"] == "top"][:30]
    watch_list = [r for r in results if r["list_type"] == "watch"][:100]

    logger.info(f"Scan done. Top: {len(top_list)}, Watch: {len(watch_list)}")
    return {
        "scanned_total": total,
        "top": top_list,
        "watch": watch_list,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }
