import urllib.request
import urllib.parse
import json
import asyncio
from core.config import settings
import logging

logger = logging.getLogger(__name__)

async def send_telegram_notification(message: str):
    """Отправка уведомления в Telegram через HTTP."""
    bot_token = getattr(settings, "TG_BOT_TOKEN", None)
    chat_id = getattr(settings, "TG_CHAT_ID", None)
    
    if not bot_token or not chat_id:
        logger.warning("Telegram credentials not configured. Skipping notification.")
        return

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }).encode("utf-8")
    
    try:
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req) as response:
            res_data = response.read()
            logger.info(f"Telegram notification sent: {res_data}")
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
