import asyncio
from services.fmp_client import fmp_client

async def run():
    print("Testing 5m history limits from FMP API...")
    data_5m = await fmp_client._get("historical-chart/5min", params={"symbol": "TSLA", "from": "2025-12-10", "to": "2026-03-10"})
    
    if isinstance(data_5m, list):
        print(f"Loaded {len(data_5m)} 5m candles")
        if len(data_5m) > 0:
            print(f"Oldest: {data_5m[-1]['date']}")
            print(f"Newest: {data_5m[0]['date']}")
    else:
        print(f"Unexpected response format: {type(data_5m)}")
        
    await fmp_client.close()

if __name__ == "__main__":
    asyncio.run(run())
