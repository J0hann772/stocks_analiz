import asyncio
import pandas as pd
from core.backtester import SpringBacktester
from services.fmp_client import fmp_client

async def run():
    # Загружаем данные
    data = await fmp_client.get_historical_chart('AAPL', '1min', '2026-03-08', '2026-03-11')
    print(f'Loaded {len(data)} 1m candles')
    
    if not data:
        return
        
    df = pd.DataFrame(data)
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
    
    days = df.index.normalize().unique()
    
    for current_day in days:
        day_str = current_day.strftime("%Y-%m-%d")
        print(f"\n--- Day {day_str} ---")
        
        corridor_start_time = pd.Timestamp(f"{day_str} 06:00:00")
        corridor_end_time = pd.Timestamp(f"{day_str} 10:00:00")
        
        corridor_df = df.loc[corridor_start_time : corridor_end_time - pd.Timedelta(minutes=1)]
        if corridor_df.empty:
            print("No corridor data")
            continue
            
        c_high = corridor_df['high'].max()
        c_low = corridor_df['low'].min()
        c_width = c_high - c_low
        print(f"Corridor: Low={c_low}, High={c_high}, Width={round(c_width,2)}")
        
        search_start_time = corridor_end_time
        end_of_day_time = pd.Timestamp(f"{day_str} 15:59:00")
        
        day_5m = df_5m.loc[search_start_time : end_of_day_time].copy()
        
        min_5m_low = day_5m['low'].min()
        print(f"Lowest price in rest of day: {min_5m_low}")
        if min_5m_low >= c_low:
            print("  -> Price NEVER went below c_low! No chance for Spring.")
            continue
            
        state = 0
        for index, row in day_5m.iterrows():
            if state == 0:
                if row['close'] < c_low:
                    print(f"  [{index}] BreakDown! close={row['close']} < c_low={c_low}")
                    state = 1
                    lowest_low = row['low']
                elif row['low'] < c_low:
                    print(f"  [{index}] Pierced below c_low ({row['low']}) but CLOSED above it ({row['close']}). State is still 0.")
            elif state == 1:
                lowest_low = min(lowest_low, row['low'])
                if row['close'] > c_low:
                    print(f"  [{index}] Spring Up! close={row['close']} > c_low={c_low}")
                    tail = c_low - lowest_low
                    print(f"    Tail={round(tail,2)}, Allowed={round(1.0*c_width, 2)}")
                    if tail <= 1.0 * c_width:
                        print("    >>> TRADE EXECUTED <<<")
                    else:
                        print("    Tail too big, rejected.")
                    state = 0 # reset for analysis
                else:
                    print(f"  [{index}] Still below c_low. close={row['close']}")

if __name__ == '__main__':
    asyncio.run(run())
