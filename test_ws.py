import asyncio
import json
import os
import ssl
import certifi
from websockets.asyncio.client import connect as ws_connect
from dotenv import load_dotenv

load_dotenv('d:/antigravity/stock_analiz/.env')
api_key = os.environ.get('FMP_API_KEY')

urls_to_try = [
    "wss://websockets.financialmodelingprep.com",
    "wss://websockets.financialmodelingprep.com/ws/us-stocks",
    "wss://financialmodelingprep.com/ws/us-stocks",
    f"wss://websockets.financialmodelingprep.com?apikey={api_key}",
]

ssl_ctx = ssl.create_default_context(cafile=certifi.where())

async def test_ws(url):
    print(f"\n--- Testing {url} ---")
    try:
        async with ws_connect(
            url,
            ssl=ssl_ctx,
            origin="https://financialmodelingprep.com",
            user_agent_header="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ) as ws:
            print("  ✓ Connected!")
            login_msg = {"event": "login", "data": {"apiKey": api_key}}
            await ws.send(json.dumps(login_msg))
            res = await asyncio.wait_for(ws.recv(), timeout=5)
            print("  Login response:", res)

            sub_msg = {"event": "subscribe", "data": {"ticker": ["AAPL"]}}
            await ws.send(json.dumps(sub_msg))
            print("  Subscribing to AAPL...")
            res2 = await asyncio.wait_for(ws.recv(), timeout=5)
            print("  Subscribe response:", res2)

            print("  Waiting for ticks (5 sec)...")
            try:
                for _ in range(5):
                    tick = await asyncio.wait_for(ws.recv(), timeout=5)
                    print("  Tick:", tick)
            except asyncio.TimeoutError:
                print("  No ticks (market may be closed).")
            return True

    except Exception as e:
        print(f"  Error: {type(e).__name__}: {e}")
    return False

async def main():
    if not api_key:
        print("ERROR: FMP_API_KEY not found!")
        return
    print(f"API key: {api_key[:8]}...")
    for u in urls_to_try:
        if await test_ws(u):
            print(f"\n✓ WORKING URL: {u}")
            break
    else:
        print("\n✗ No working URL found.")

asyncio.run(main())
