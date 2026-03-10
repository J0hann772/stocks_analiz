import asyncio
from services.fmp_client import fmp_client

async def main():
    data = await fmp_client.get_historical_chart('AAPL', '4hour', from_date='2025-01-01', to_date='2026-03-08')
    print(f'Total returned with dates: {len(data) if data else 0}')
    
if __name__ == '__main__':
    asyncio.run(main())
