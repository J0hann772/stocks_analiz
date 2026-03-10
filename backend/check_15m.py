import asyncio
from services.fmp_client import fmp_client

async def run():
    print("Testing 15m history limits from FMP API...")
    data_15m = await fmp_client._get("historical-chart/15min", params={"symbol": "TSLA", "from": "2025-03-01", "to": "2026-03-10"})
    
    if isinstance(data_15m, list):
        print(f"Loaded {len(data_15m)} 15m candles")
        if len(data_15m) > 0:
            print(f"Oldest: {data_15m[-1]['date']}")
            print(f"Newest: {data_15m[0]['date']}")
    else:
        print(f"Unexpected response format: {type(data_15m)}")
        
    await fmp_client.close()

if __name__ == "__main__":
    asyncio.run(run())
