import asyncio
from core.backtester import SpringBacktester
from services.fmp_client import fmp_client

async def run():
    # ФМП возвращает 1m исторические графики обычно только на 2-3 месяца назад (с текущей даты)
    # 2025-12-10 to 2026-03-10
    data = await fmp_client.get_historical_chart('AAPL', '1min', '2025-12-10', '2026-03-10')
    print(f'Loaded {len(data)} 1m candles')
    
    if data:
        print(f"First candle: {data[-1]}")
        print(f"Last candle: {data[0]}")
    
    bt = SpringBacktester(data, 'Stocks')
    res = bt.run()
    print(f"Trades found: {res['metrics']['totalTrades']}")
    
    if res['metrics']['totalTrades'] == 0:
        print("Debugging why 0 trades...")
        # Check if corridor setup succeeds
        import pandas as pd
        df = pd.DataFrame(data)
        if not df.empty:
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date').reset_index(drop=True)
            df.set_index('date', inplace=True)
            
            df_5m = df.resample('5min').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
            print(f"Aggregated out {len(df_5m)} 5m candles")
            
            days = df.index.normalize().unique()
            print(f"Found {len(days)} trading days in dataset")
            
            for current_day in days[:5]: # just check first 5 days
                day_str = current_day.strftime("%Y-%m-%d")
                print(f"--- Day {day_str} ---")
                corridor_start_time = pd.Timestamp(f"{day_str} 06:00:00")
                corridor_end_time = pd.Timestamp(f"{day_str} 10:00:00")
                corridor_df = df.loc[corridor_start_time : corridor_end_time - pd.Timedelta(minutes=1)]
                print(f"Corridor candles (1min): {len(corridor_df)}")
                
                if not corridor_df.empty:
                    c_high = corridor_df['high'].max()
                    c_low = corridor_df['low'].min()
                    c_width = c_high - c_low
                    print(f"Corridor size: High={c_high}, Low={c_low}, Width={c_width}")
                    
                    search_start_time = corridor_end_time
                    end_of_day_time = pd.Timestamp(f"{day_str} 15:59:00")
                    day_5m = df_5m.loc[search_start_time : end_of_day_time]
                    print(f"5m candles to search: {len(day_5m)}")
                    
                    state = 0
                    for index, row in day_5m.iterrows():
                        if state == 0 and row['close'] < c_low:
                            print(f"  [BreakDown] at {index} (close: {row['close']} < c_low: {c_low})")
                            state = 1
                            lowest_low = row['low']
                        elif state == 1:
                            lowest_low = min(lowest_low, row['low'])
                            if row['close'] > c_low:
                                print(f"  [Spring Signal Candidate] at {index} (close: {row['close']} > c_low: {c_low})")
                                tail_length = c_low - lowest_low
                                print(f"    Tail: {tail_length}, C_Width: {c_width}")
                                if tail_length <= 1.0 * c_width:
                                    print("    >>> TRADE EXECUTED <<<")
                                else:
                                    print("    Filter failed (Tail too long)")

if __name__ == '__main__':
    asyncio.run(run())
