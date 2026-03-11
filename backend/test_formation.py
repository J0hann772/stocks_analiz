import asyncio
import logging
logging.basicConfig(level=logging.WARNING)

from services.formation_scanner import analyze_symbol
from services.fmp_client import fmp_client

async def test():
    # Тестируем акцию, которая должна попасть в список (значительно упавшая)
    for sym in ['GME', 'BBBY', 'CLOV', 'SPCE', 'WISH']:
        result = await analyze_symbol(sym)
        print(f'{sym}: {result}')
    await fmp_client.close()

asyncio.run(test())
