import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from redis.asyncio import Redis

from core.database.session import get_redis
from services.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSockets"])

# Глобальный (на инстанс) инстанс менеджера
# Мы проинициализируем его при первом запросе, либо в lifespan
manager = None

async def get_manager(redis: Redis = Depends(get_redis)):
    global manager
    if not manager:
        manager = ConnectionManager(redis)
    return manager

@router.websocket("/market")
async def market_websocket(websocket: WebSocket, manager: ConnectionManager = Depends(get_manager)):
    """
    Эндпоинт для подключения фронтенда к данным рынка в реальном времени.
    Клиент отправляет:
    {"action": "subscribe", "symbols": ["AAPL", "MSFT"]}
    {"action": "unsubscribe", "symbols": ["AAPL"]}
    """
    await manager.connect(websocket)
    try:
        while True:
            # Получаем команды от клиента
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")
                symbols = msg.get("symbols", [])
                
                if not isinstance(symbols, list):
                    symbols = [symbols]
                    
                if action == "subscribe" and symbols:
                    await manager.subscribe(websocket, symbols)
                elif action == "unsubscribe" and symbols:
                    await manager.unsubscribe(websocket, symbols)
                else:
                    await websocket.send_json({"error": "Invalid payload format."})
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON."})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
