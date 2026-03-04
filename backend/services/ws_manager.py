import asyncio
import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self, redis_client: Redis):
        self._redis = redis_client
        # Активные websocket-соединения (client -> set of symbols)
        self.active_connections: Dict[WebSocket, Set[str]] = {}
        # Маппинг symbol -> set of websockets, для быстрого броадкаста
        self.symbol_subscribers: Dict[str, Set[WebSocket]] = {}
        
        # Redis PubSub listener task
        self.pubsub = self._redis.pubsub()
        self._listener_task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[websocket] = set()
        logger.info(f"Client connected. Active clients: {len(self.active_connections)}")
        
        # Если это первый клиент, запускаем слушателя Redis
        if len(self.active_connections) == 1 and self._listener_task is None:
             self._listener_task = asyncio.create_task(self._listen_redis())

    def disconnect(self, websocket: WebSocket):
        symbols = self.active_connections.pop(websocket, set())
        for symbol in symbols:
            if symbol in self.symbol_subscribers:
                self.symbol_subscribers[symbol].discard(websocket)
                if not self.symbol_subscribers[symbol]:
                    del self.symbol_subscribers[symbol]
        
        logger.info(f"Client disconnected. Active clients: {len(self.active_connections)}")
        
        # Если клиентов больше нет, можно остановить слушателя
        if len(self.active_connections) == 0 and self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None

    async def subscribe(self, websocket: WebSocket, symbols: list[str]):
        """Подписывает WebSocket-клиента на указанные тикеры."""
        for symbol in symbols:
            # Локальная подписка клиента
            self.active_connections[websocket].add(symbol)
            if symbol not in self.symbol_subscribers:
                self.symbol_subscribers[symbol] = set()
            self.symbol_subscribers[symbol].add(websocket)
            
            # Подписка в Redis PubSub
            await self.pubsub.subscribe(f"market:ticks:{symbol}")
            # Также уведомляем FMP-воркера (через отдельный канал), что нам нужен этот тикер
            await self._redis.publish("market:control", json.dumps({"action": "subscribe", "symbol": symbol}))
            
        logger.info(f"Client subscribed to {symbols}")

    async def unsubscribe(self, websocket: WebSocket, symbols: list[str]):
        """Отписывает WebSocket-клиента от указанных тикеров."""
        for symbol in symbols:
            self.active_connections[websocket].discard(symbol)
            if symbol in self.symbol_subscribers:
                self.symbol_subscribers[symbol].discard(websocket)
                if not self.symbol_subscribers[symbol]:
                    # Если больше никто на сервере не слушает этот символ, отписываемся в Redis
                    del self.symbol_subscribers[symbol]
                    await self.pubsub.unsubscribe(f"market:ticks:{symbol}")
                    # Уведомляем FMP-воркера об отписке
                    await self._redis.publish("market:control", json.dumps({"action": "unsubscribe", "symbol": symbol}))
                    
        logger.info(f"Client unsubscribed from {symbols}")

    async def _listen_redis(self):
        """Слушает входящие тики из Redis PubSub и рассылает их локальным клиентам."""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    channel = message["channel"].decode("utf-8")
                    if channel.startswith("market:ticks:"):
                        symbol = channel.split(":")[2]
                        data = message["data"].decode("utf-8")
                        await self.broadcast(symbol, data)
        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled")
        except Exception as e:
            logger.error(f"Error in Redis listener: {e}")

    async def broadcast(self, symbol: str, message: str):
        """Рассылает сообщение всем `WebSocket`, подписанным на данный `symbol`."""
        websockets = self.symbol_subscribers.get(symbol, set())
        disconnected_ws = set()
        for websocket in websockets:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                disconnected_ws.add(websocket)
        
        # Очистка мертвых соединений
        for ws in disconnected_ws:
            self.disconnect(ws)
