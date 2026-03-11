import asyncio
import os
import aiohttp
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FMP_API_KEY")

async def test_fmp():
    base_url = "https://financialmodelingprep.com/stable"
    async with aiohttp.ClientSession() as session:
        # Test 1: pre-screener what fields it returns?
        url1 = f"{base_url}/company-screener?exchange=NYSE,NASDAQ&limit=1&apikey={api_key}"
        async with session.get(url1) as resp:
            data = await resp.json()
            print("Screener fields:", list(data[0].keys()) if data else data)
            
        # Test 2: Profile what fields it returns?
        url2 = f"{base_url}/profile?symbol=AAPL&apikey={api_key}"
        async with session.get(url2) as resp:
            data = await resp.json()
            print("Profile fields:", list(data[0].keys()) if data else data)
            
        # Test 3: Batch profile?
        url3 = f"{base_url}/profile?symbol=AAPL,MSFT&apikey={api_key}"
        async with session.get(url3) as resp:
            data = await resp.json()
            print("Batch Profile returned items:", len(data) if isinstance(data, list) else data)
            
asyncio.run(test_fmp())
