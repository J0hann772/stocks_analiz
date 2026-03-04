import asyncio
import json
import logging
import ssl
from websockets.asyncio.client import connect as ws_connect
from redis.asyncio import Redis
from core.config import settings

logger = logging.getLogger(__name__)

class FMPWebSocketClient:
    """Одиночный клиент для подключения к FMP WebSockets. Слушает FMP и пушит тики в Redis Pub/Sub."""
    def __init__(self, redis_client: Redis):
        self._redis = redis_client
        self.fmp_ws_url = "wss://websockets.financialmodelingprep.com"
        self.api_key = settings.FMP_API_KEY
        self.ws = None
        
        # Активные подписки, которые мы запросили у FMP.
        self._active_fmp_subscriptions = set()

    async def connect_and_listen(self):
        """Главный цикл переподключения и прослушивания FMP."""
        if not self.api_key:
            logger.warning("FMP_API_KEY is missing. FMP WebSocket client will not start.")
            return
            
        # Create an SSL context that doesn't strictly verify the CA certificates
        # because the python:3.12-slim Docker image may lack the specific ISRG Root used by FMP.
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        while True:
            try:
                # 1. Загружаем текущие нужные тикеры со всего кластера
                symbols = await self._redis.smembers("market:global_subscriptions")
                self._active_fmp_subscriptions = {s.decode("utf-8") for s in symbols}

                logger.info(f"Connecting to FMP WebSocket: {self.fmp_ws_url}")
                
                # websockets 12.0 new asyncio API — используем выделенные параметры
                async with ws_connect(
                    self.fmp_ws_url,
                    ssl=ssl_context,
                    origin="https://financialmodelingprep.com",
                    user_agent_header="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                ) as ws:
                    self.ws = ws
                    
                    # 2. Авторизация
                    login_msg = {"event": "login", "data": {"apiKey": self.api_key}}
                    await ws.send(json.dumps(login_msg))
                    response = await ws.recv()
                    logger.info(f"FMP Login response: {response}")
                    
                    # 3. Восстановление подписок
                    if self._active_fmp_subscriptions:
                        subscribe_msg = {
                            "event": "subscribe",
                            "data": {
                                "ticker": list(self._active_fmp_subscriptions)
                            }
                        }
                        await ws.send(json.dumps(subscribe_msg))
                        logger.info(f"Restored FMP subscriptions: {self._active_fmp_subscriptions}")

                    # 4. Запуск параллельной задачи для прослушивания внутренних команд управления
                    control_task = asyncio.create_task(self._listen_control_commands())
                    
                    # 5. Прием тиков от FMP
                    try:
                        async for message in ws:
                            data = json.loads(message)
                            # FMP присылает события типа "T" (Trade), "Q" (Quote), "B" (Break)
                            if data.get("type") in ("T", "Q") and "s" in data:
                                symbol = data["s"]
                                await self._redis.publish(f"market:ticks:{symbol}", json.dumps(data))
                            elif "event" in data and data["event"] != "ping":
                                logger.info(f"FMP Message: {data}")
                    finally:
                        control_task.cancel()

            except Exception as e:
                logger.error(f"FMP WebSocket error: {e}. Reconnecting in 5s...")
            
            await asyncio.sleep(5)

    async def _listen_control_commands(self):
        """Слушает Redis Pub/Sub на предмет команд (subscribe/unsubscribe) от других инстансов API."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe("market:control")
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    cmd = json.loads(message["data"].decode("utf-8"))
                    action = cmd.get("action")
                    symbol = cmd.get("symbol")
                    
                    if not symbol or not self.ws:
                        continue
                        
                    if action == "subscribe":
                        if symbol not in self._active_fmp_subscriptions:
                            await self._redis.sadd("market:global_subscriptions", symbol)
                            self._active_fmp_subscriptions.add(symbol)
                            
                            req = {
                                "event": "subscribe",
                                "data": {
                                    "ticker": [symbol]
                                }
                            }
                            await self.ws.send(json.dumps(req))
                            logger.info(f"FMP Client subscribed to {symbol}")
                            
                    elif action == "unsubscribe":
                        await self._redis.srem("market:global_subscriptions", symbol)
                        self._active_fmp_subscriptions.discard(symbol)
                        
                        req = {
                            "event": "unsubscribe",
                            "data": {
                                "ticker": [symbol]
                            }
                        }
                        await self.ws.send(json.dumps(req))
                        logger.info(f"FMP Client unsubscribed from {symbol}")
        except asyncio.CancelledError:
            pass
