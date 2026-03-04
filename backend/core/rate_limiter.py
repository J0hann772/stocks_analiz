import asyncio
from typing import Callable, Coroutine

class AsyncRateLimiter:
    def __init__(self, requests: int, per_seconds: float):
        self.requests = requests
        self.per_seconds = per_seconds
        self.semaphore = asyncio.Semaphore(requests)
        
    async def acquire(self):
        await self.semaphore.acquire()
        asyncio.create_task(self._release_later())
        
    async def _release_later(self):
        await asyncio.sleep(self.per_seconds)
        self.semaphore.release()

# Global limiter for FMP API: max 12 requests per second (720 per minute, safely below 750)
fmp_limiter = AsyncRateLimiter(requests=12, per_seconds=1.0)
