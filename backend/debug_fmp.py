import asyncio
from services.fmp_client import fmp_client

async def run():
    # Симулируем запрос пользователя из UI: 3 месяца
    data_3m = await fmp_client.get_historical_1m_data('TSLA', '2025-12-10', '2026-03-10')
    print(f"TSLA (3 months req): {len(data_3m)} candles")
    if data_3m:
        print(f"  Oldest: {data_3m[-1]['date']}")
        print(f"  Newest: {data_3m[0]['date']}")
        
    print("-" * 30)
    
    # Симулируем короткий запрос (1 неделя) 
    data_1w = await fmp_client.get_historical_1m_data('TSLA', '2026-03-03', '2026-03-10')
    print(f"TSLA (1 week req): {len(data_1w)} candles")
    if data_1w:
        print(f"  Oldest: {data_1w[-1]['date']}")
        print(f"  Newest: {data_1w[0]['date']}")

if __name__ == '__main__':
    asyncio.run(run())
