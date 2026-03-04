import logging
import httpx
from core.config import settings

logger = logging.getLogger(__name__)

async def send_signal_notification(symbol: str, timeframe: str, strategy_id: int, signal_type: str, price: float):
    """
    Асинхронно отправляет PUSH-уведомление через фонового Telegram-бота.
    """
    bot_token = settings.TG_SIGNAL_BOT_TOKEN
    chat_id = settings.TG_CHAT_ID

    if not bot_token or not chat_id:
        logger.warning("TG_SIGNAL_BOT_TOKEN или TG_CHAT_ID не настроены. Сигнал не отправлен.")
        return

    emoji = "🟢 КУПИТЬ" if signal_type.lower() == "buy" else "🔴 ПРОДАТЬ"
    
    text = (
        f"🚨 <b>ТОРГОВЫЙ СИГНАЛ</b> 🚨\n\n"
        f"<b>Тикер:</b> #{symbol}\n"
        f"<b>Сигнал:</b> {emoji}\n"
        f"<b>Цена:</b> {price:,.2f}$\n"
        f"<b>Таймфрейм:</b> {timeframe}\n"
        f"<b>Стратегия ID:</b> {strategy_id}\n\n"
        f"<i>Сгенерировано StockAnalyzer</i>"
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            response.raise_for_status()
            logger.info("Уведомление о сигнале %s отправлено успешно", symbol)
    except Exception as e:
        logger.error("Ошибка при отправке сигнала в Telegram: %s", str(e))
