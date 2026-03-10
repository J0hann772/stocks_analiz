import asyncio
import os
from services.fmp_client import fmp_client

async def test():
    data = await fmp_client.get_historical_chart('AAPL', '4hour')
    print(f"Total returned: {len(data)}")
    if data:
        print(data[:3])
    
    # Check what '1hour' returns
    data1 = await fmp_client.get_historical_chart('AAPL', '1hour')
    print(f"1hour Total returned: {len(data1)}")
    
    await fmp_client.close()

if __name__ == '__main__':
    asyncio.run(test())
