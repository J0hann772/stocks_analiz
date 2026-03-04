import asyncio
import logging
from datetime import datetime
from pydantic import BaseModel
import pandas as pd

from services.fmp_client import fmp_client
from services.telegram_signals import send_signal_notification

logger = logging.getLogger(__name__)

async def monitor_tickers_job(ctx):
    """
    Периодическая ARQ cron-задача для проверки 2-3 избранных тикеров.
    Имитирует проход по БД (для MVP - хардкод пара тикеров).
    """
    logger.info("Запуск периодического мониторинга тикеров - %s", datetime.now())
    
    # В реальном приложении здесь будет select(MonitorList)
    tickers_to_monitor = ["AAPL", "TSLA"]
    strategy_id = 1
    timeframe = "1day"
    
    for symbol in tickers_to_monitor:
        try:
            # Используем кэш ARQ/FMPClient
            klines = await fmp_client.get_historical_chart(
                symbol=symbol,
                timeframe=timeframe,
                purpose="calc"
            )
            
            if klines and len(klines) > 0:
                df = pd.DataFrame(klines).iloc[::-1].reset_index(drop=True)
                
                # Базовая проверка (RSI oversold)
                passed, price = _mock_strategy_check(df)
                
                if passed:
                    logger.info("Сигнал BUY по %s, отправка в Telegram", symbol)
                    await send_signal_notification(
                        symbol=symbol,
                        timeframe=timeframe,
                        strategy_id=strategy_id,
                        signal_type="BUY",
                        price=price
                    )

        except Exception as e:
            logger.error("Ошибка при мониторинге %s: %s", symbol, e)
            
    logger.info("Мониторинг завершен")

def _mock_strategy_check(df: pd.DataFrame) -> tuple[bool, float]:
    """Простая симуляция проверки (RSI < 30)"""
    import pandas_ta as ta
    
    if len(df) < 20:
        return False, 0.0

    df.ta.rsi(length=14, append=True)
    last_rsi = float(df["RSI_14"].iloc[-1])
    last_price = float(df["close"].iloc[-1])
    
    return last_rsi < 30, last_price
