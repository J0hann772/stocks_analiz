import asyncio; from core.backtester import SpringBacktester; from services.fmp_client import fmp_client; async def run(): data = await fmp_client.get_historical_chart('AAPL', '1min', '2025-12-10', '2026-03-10'); print(f'Loaded {len(data)} 1m candles'); bt = SpringBacktester(data, 'Stocks'); res = bt.run(); print(f\
Trades
found:
res['metrics']['totalTrades']
\); asyncio.run(run())
