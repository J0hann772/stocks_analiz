import asyncio
import httpx

async def run():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            'http://localhost:8000/api/v1/backtest/AAPL', 
            params={'asset_type': 'Stocks', 'from_date': '2026-02-10', 'to_date': '2026-03-10'}
        )
        if r.status_code != 200:
            print(f"Error: {r.status_code} - {r.text}")
            return
            
        data = r.json()
        trades = data.get('trades', [])
        print(f"Found {len(trades)} trades for AAPL over last month.")
        
        if trades:
            print("First trade:", trades[0])
            print("Metrics:", data.get('metrics'))

if __name__ == "__main__":
    asyncio.run(run())
