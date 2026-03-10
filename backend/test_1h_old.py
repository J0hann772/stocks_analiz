import asyncio
from services.fmp_client import fmp_client

async def main():
    data = await fmp_client.get_historical_chart('AAPL', '1hour', from_date='2000-01-01')
    print(f'1hour Total returned with old from_date: {len(data) if data else 0}')
    
if __name__ == '__main__':
    asyncio.run(main())
