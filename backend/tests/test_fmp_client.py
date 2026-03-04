"""
Тесты для FMPClient и логики скринера (без реальных HTTP-запросов, мок через unittest.mock).
"""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
import pandas as pd

from services.fmp_client import FMPClient
from services.screener import _calc_indicators, _check_filters, run_scan
from models.schemas import ScannerParams


# ──────────────── FMPClient тесты ────────────────

@pytest.fixture
def fmp():
    return FMPClient()


@pytest.mark.asyncio
async def test_fmp_get_uses_cache(fmp: FMPClient):
    """Второй запрос должен идти из кэша (Redis), а не в API."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=json.dumps([{"symbol": "AAPL"}]))
    fmp._redis = mock_redis

    result = await fmp._get("quote/AAPL")
    assert result == [{"symbol": "AAPL"}]
    mock_redis.get.assert_called_once()


@pytest.mark.asyncio
async def test_fmp_get_stores_in_cache(fmp: FMPClient):
    """При cache miss — должен сделать HTTP запрос и сохранить в Redis."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()
    fmp._redis = mock_redis

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = AsyncMock(return_value=[{"symbol": "TSLA", "price": 250.0}])
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        result = await fmp._get("quote/TSLA")

    assert result[0]["symbol"] == "TSLA"
    mock_redis.setex.assert_called_once()


# ──────────────── Screener логика ────────────────

def _make_df(closes: list[float]) -> pd.DataFrame:
    """Создать тестовый DataFrame с ценами закрытия."""
    return pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=len(closes), freq="D"),
        "open": closes,
        "high": [c * 1.01 for c in closes],
        "low": [c * 0.99 for c in closes],
        "close": closes,
        "volume": [1_000_000] * len(closes),
    })


def test_calc_rsi():
    """RSI должен считаться для достаточного кол-ва свечей."""
    closes = [100 + i * 0.5 + (i % 3) * -2 for i in range(50)]
    df = _make_df(closes)
    result = _calc_indicators(df, {"RSI": {"period": 14}})
    assert "RSI_14" in result
    assert result["RSI_14"] is not None
    assert 0 <= result["RSI_14"] <= 100


def test_calc_sma():
    closes = [float(100 + i) for i in range(60)]
    df = _make_df(closes)
    result = _calc_indicators(df, {"SMA": {"period": 20}})
    assert "SMA_20" in result
    assert result["SMA_20"] is not None


def test_check_filters_pass():
    values = {"RSI_14": 35.0, "SMA_50": 400.0}
    config = {"RSI": {"period": 14, "max": 40}, "SMA": {"period": 50}}
    assert _check_filters(values, config) is True


def test_check_filters_fail():
    values = {"RSI_14": 55.0}
    config = {"RSI": {"period": 14, "max": 40}}
    assert _check_filters(values, config) is False


def test_check_filters_missing_indicator():
    """Если индикатор не рассчитался — тикер не проходит фильтр."""
    values = {}
    config = {"RSI": {"period": 14, "max": 40}}
    assert _check_filters(values, config) is False
