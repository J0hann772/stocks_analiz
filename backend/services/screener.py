import logging
import pandas as pd
import pandas_ta as ta
from typing import Optional

from services.fmp_client import fmp_client
from models.schemas import ScannerParams, ScannerResult

logger = logging.getLogger(__name__)

# Поддерживаемые индикаторы и их расчёт через pandas_ta
SUPPORTED_INDICATORS = {"RSI", "SMA", "EMA", "ADX"}


async def _fetch_dataframe(symbol: str, timeframe: str, bars: int = 200) -> Optional[pd.DataFrame]:
    """Загрузить исторические OHLCV данные в DataFrame."""
    try:
        candles = await fmp_client.get_historical_chart(symbol, timeframe)
        if not candles:
            return None

        df = pd.DataFrame(candles[:bars])                          # берём последние N свечей
        df = df.rename(columns={"open": "open", "high": "high",
                                 "low": "low", "close": "close", "volume": "volume"})
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)
        return df
    except Exception as exc:
        logger.warning("Ошибка загрузки данных для %s: %s", symbol, exc)
        return None


def _calc_indicators(df: pd.DataFrame, indicator_config: dict) -> dict:
    """
    Рассчитать запрошенные индикаторы на последней свече.
    indicator_config: {"RSI": {"period": 14}, "SMA": {"period": 50}}
    Возвращает: {"RSI_14": 38.5, "SMA_50": 412.3, ...}
    """
    values: dict = {}

    for ind_name, params in indicator_config.items():
        ind_upper = ind_name.upper()
        if ind_upper not in SUPPORTED_INDICATORS:
            logger.debug("Индикатор %s не поддерживается, пропускаем", ind_name)
            continue

        period = params.get("period", 14)
        key = f"{ind_upper}_{period}"

        if ind_upper == "RSI":
            series = ta.rsi(df["close"], length=period)
        elif ind_upper == "SMA":
            series = ta.sma(df["close"], length=period)
        elif ind_upper == "EMA":
            series = ta.ema(df["close"], length=period)
        elif ind_upper == "ADX":
            adx_df = ta.adx(df["high"], df["low"], df["close"], length=period)
            series = adx_df[f"ADX_{period}"] if adx_df is not None else None

        if series is not None and not series.empty:
            val = series.iloc[-1]
            values[key] = round(float(val), 4) if pd.notna(val) else None

    return values


def _check_filters(indicator_values: dict, indicator_config: dict) -> bool:
    """
    Проверить, удовлетворяет ли тикер заданным фильтрам.
    Фильтры задаются в indicator_config:
      {"RSI": {"period": 14, "max": 40, "min": 20}}  -> RSI_14 от 20 до 40
    """
    for ind_name, params in indicator_config.items():
        period = params.get("period", 14)
        key = f"{ind_name.upper()}_{period}"
        value = indicator_values.get(key)

        if value is None:
            return False

        if "min" in params and value < params["min"]:
            return False
        if "max" in params and value > params["max"]:
            return False

    return True


async def run_scan(params: ScannerParams) -> list[ScannerResult]:
    """
    Запустить скрининг акций по заданным параметрам.
    Если tickers не указан — берём S&P 500 (ограничиваем 100 для скорости).
    """
    tickers = params.tickers
    if not tickers:
        sp500 = await fmp_client.get_sp500_constituents()
        tickers = sp500[:100]  # Ограничиваем для скорости

    results: list[ScannerResult] = []

    for symbol in tickers:
        try:
            # Загружаем данные
            df = await _fetch_dataframe(symbol, params.timeframe)
            if df is None or df.empty:
                continue

            # Рассчитываем индикаторы
            indicator_values = _calc_indicators(df, params.indicators)

            # Проверяем фильтры
            matched = _check_filters(indicator_values, params.indicators)

            # Текущая цена
            last_close = float(df["close"].iloc[-1])
            prev_close = float(df["close"].iloc[-2]) if len(df) >= 2 else last_close
            change_pct = round((last_close - prev_close) / prev_close * 100, 2)

            results.append(ScannerResult(
                ticker=symbol,
                price=round(last_close, 2),
                change_pct=change_pct,
                indicators=indicator_values,
                matched=matched,
            ))

        except Exception as exc:
            logger.warning("Скипаем %s — ошибка: %s", symbol, exc)
            continue

    # Сначала показываем тикеры прошедшие фильтрацию
    results.sort(key=lambda r: (not r.matched, r.ticker))
    return results[:params.limit]
