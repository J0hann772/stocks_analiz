import asyncio
import aiohttp
import os
from datetime import datetime
from zoneinfo import ZoneInfo

# Hardcoded or from env
API_KEY = "spx4FSrTi1TyqN5ob0qcO3pHu6TLvecq" # Extracted from .env

async def check_aapl():
    symbol = "AAPL"
    timeframe = "15min"
    url = f"https://financialmodelingprep.com/api/v3/historical-chart/{timeframe}/{symbol}?apikey={API_KEY}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            candles = await response.json()
    
    if not candles or "Error Message" in candles:
        print("API Error:", candles)
        return

    # Let's look at candles for 2026-03-06 (Friday)
    target_date = "2026-03-06"
    day_candles = [c for c in candles if c['date'].startswith(target_date)]
    day_candles.sort(key=lambda x: x['date'])
    
    print(f"Raw Data from FMP for {target_date}:")
    for c in day_candles[:20]:
        date_str = c['date']
        
        # Simulation of backend logic
        ny_tz = ZoneInfo("America/New_York")
        dt_ny = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ny_tz)
        ts = int(dt_ny.timestamp())
        
        print(f"FMP Date: {date_str} | UTC TS: {ts}")

if __name__ == "__main__":
    asyncio.run(check_aapl())
