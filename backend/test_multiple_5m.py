import asyncio
import pandas as pd
from core.backtester import SpringBacktester
from services.fmp_client import fmp_client

SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'SPY', 'QQQ', 'NVDA']

async def run():
    print(f"Testing Spring + Upthrust strategy over 5m candles (1 month)...")
    total_trades = 0
    
    for symbol in SYMBOLS:
        data = await fmp_client.get_historical_backtest_data(
            symbol=symbol,
            from_date="2026-02-10",
            to_date="2026-03-10",
            timeframe="5min"
        )
        if not data:
            print(f"[{symbol}] Failed to load data")
            continue
            
        bt = SpringBacktester(data=data, asset_type="Stocks")
        res = bt.run()
        
        trades = res.get('trades', [])
        total_trades += len(trades)
        print(f"[{symbol}] Loaded {len(data)} candles. Trades found: {len(trades)}")
        
        for t in trades:
            from datetime import datetime
            et = datetime.fromtimestamp(t['entryTime']).strftime('%Y-%m-%d %H:%M')
            print(f"  -> Trade: {t['type']} at {et} | Entry: {t['entryPrice']} | PNL: {t['pnl']} | Reason: {t['reason']}")
            
    print(f"\nTotal trades across all symbols: {total_trades}")
    await fmp_client.close()

if __name__ == "__main__":
    asyncio.run(run())
