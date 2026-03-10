import asyncio
from core.backtester import SpringBacktester
from services.fmp_client import fmp_client

async def run():
    symbols = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMZN', 'GOOGL', 'AMD']
    start_date = '2026-03-03'
    end_date = '2026-03-10'
    
    print(f"Testing Spring Strategy on {len(symbols)} symbols from {start_date} to {end_date}")
    
    total_trades_all = 0
    
    for symbol in symbols:
        try:
            data = await fmp_client.get_historical_chart(symbol, '1min', start_date, end_date)
            if not data:
                print(f"[{symbol}] No data loaded.")
                continue
                
            bt = SpringBacktester(data, 'Stocks')
            res = bt.run()
            trades_count = res['metrics']['totalTrades']
            total_trades_all += trades_count
            
            print(f"[{symbol}] Loaded {len(data)} candles. Trades found: {trades_count}")
            if trades_count > 0:
                for t in res['trades']:
                    # entryTime is timestamp, format it
                    from datetime import datetime
                    import pytz
                    ny = pytz.timezone('America/New_York')
                    dt = datetime.fromtimestamp(t['entryTime'], tz=ny).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"  -> Trade: {dt} NY | Entry: {t['entryPrice']} | PNL: {t['pnl']} | Reason: {t['reason']}")
                    
        except Exception as e:
            print(f"[{symbol}] Error: {e}")

    print(f"\nTotal trades found across all symbols: {total_trades_all}")

if __name__ == '__main__':
    asyncio.run(run())
