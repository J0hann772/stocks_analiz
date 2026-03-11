"""
Telegram-уведомления для сканера формаций.
Читает TG_SIGNAL_BOT_TOKEN и TG_CHAT_ID из .env
"""
import os
import logging
import aiohttp

logger = logging.getLogger(__name__)

TG_TOKEN = os.getenv("TG_SIGNAL_BOT_TOKEN", "")
TG_CHAT_IDS = [cid.strip() for cid in os.getenv("TG_CHAT_ID", "").replace(",", " ").split() if cid.strip()]

BADGE_EMOJI = {
    "green":  "🟢",
    "yellow": "🟡",
    "orange": "🟠",
}

CRITERIA_LABELS = {
    "drop_70_95":        "Падение 70-95%",
    "flat_range":        "Боковой диапазон",
    "buyout_candles":    "Свечи выкупа",
    "low_volume":        "Низкий объём",
    "insider_ownership": "Инсайдеры ≥18%",
}


async def send_formation_alert(result: dict, moved_to_top: bool = False) -> bool:
    """
    Отправляет уведомление в Telegram о новом кандидате или переходе из Watch → Top.
    """
    if not TG_TOKEN or not TG_CHAT_IDS:
        logger.warning("TG_SIGNAL_BOT_TOKEN or TG_CHAT_ID not set, skipping notification")
        return False

    symbol = result["symbol"]
    score = result["score"]
    badge = result.get("badge", "orange")
    details = result.get("details", {})
    criteria = result.get("criteria", {})

    emoji = BADGE_EMOJI.get(badge, "⚪")
    header = f"{'🚀 Перешел в Топ' if moved_to_top else '👁 Новый кандидат'}: ${symbol}"

    lines = [
        f"{emoji} *{header}*",
        f"Оценка: *{score}/5*",
        "",
        f"📉 Падение: *{details.get('drop_pct', 0):.1f}%* (макс: ${details.get('peak_price', 0):.2f})",
        f"📅 В диапазоне: *{details.get('flat_days', 0)} дн.*",
        f"🕯 Свечи выкупа: *{details.get('buyout_candles', 0)}*",
        f"📊 Объём/Падение: *{details.get('vol_ratio', 0):.0%}*",
        f"👔 Инсайдеры: *{details.get('insider_pct', 0):.1f}%*",
        "",
        "*Критерии:*",
    ]

    for key, label in CRITERIA_LABELS.items():
        icon = "✅" if criteria.get(key) else "❌"
        lines.append(f"{icon} {label}")

    lines.append(f"\n[📈 Открыть график](https://stockscreener.ru/chart/{symbol})")
    text = "\n".join(lines)

    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    
    success = False
    for chat_id in TG_CHAT_IDS:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        logger.info(f"TG alert sent for {symbol} to {chat_id}")
                        success = True
                    else:
                        body = await resp.text()
                        logger.error(f"TG API error {resp.status} to {chat_id}: {body}")
        except Exception as e:
            logger.error(f"TG send error to {chat_id}: {e}")

    return success


async def send_scan_summary(top_list: list[dict], watch_list: list[dict], total_scanned: int) -> bool:
    """Краткий итог по завершении скана со списками тикеров."""
    if not TG_TOKEN or not TG_CHAT_IDS:
        return False

    top_count = len(top_list)
    watch_count = len(watch_list)
    
    top_symbols = ", ".join([item["symbol"] for item in top_list])
    watch_symbols = ", ".join([item["symbol"] for item in watch_list])

    lines = [
        f"✅ *Скан завершён*",
        f"Проверено: *{total_scanned}* акций\n",
        f"🟢 Топ: *{top_count}*"
    ]
    if top_count > 0:
        lines.append(f"`{top_symbols}`")
        
    lines.append(f"\n🟡 На наблюдении: *{watch_count}*")
    if watch_count > 0:
        lines.append(f"`{watch_symbols}`")

    text = "\n".join(lines)
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    
    success = False
    for chat_id in TG_CHAT_IDS:
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        success = True
                    else:
                        logger.error(f"TG summary API error {resp.status} to {chat_id}")
        except Exception as e:
            logger.error(f"TG summary error to {chat_id}: {e}")
            
    return success
