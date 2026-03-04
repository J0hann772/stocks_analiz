import asyncio
import websockets
import os
import json

api_key = os.environ.get('FMP_API_KEY')

urls_to_try = [
     "wss://ws.financialmodelingprep.com/ws/us-stocks",
     "wss://websockets.financialmodelingprep.com",
     "wss://financialmodelingprep.com/ws/us-stocks",
     "wss://site.financialmodelingprep.com/ws/us-stocks",
     "wss://websockets.financialmodelingprep.com/ws/us-stocks"
]

async def test_ws(url):
    print(f"\n--- Testing {url} ---")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        async with websockets.connect(url, extra_headers=headers) as ws:
            print("  Connected! HTTP Upgrade successful.")
            login_msg = {"event": "login", "data": {"apiKey": api_key}}
            print(f"  Sending: {login_msg}")
            await ws.send(json.dumps(login_msg))
            res = await ws.recv()
            print("  Response:", res)
            return True
            
    except websockets.exceptions.InvalidURI as e:
         print("  InvalidURI:", e)
    except Exception as e:
        print("  Error:", str(e))
    return False

async def main():
    if not api_key:
        print("FMP_API_KEY NOT SET!")
        return
    for u in urls_to_try:
        await test_ws(u)

asyncio.run(main())
