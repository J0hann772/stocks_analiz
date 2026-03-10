import pandas as pd
import datetime
from typing import List, Dict, Any

class SpringBacktesterDebug:
    def __init__(self, data_1m: List[Dict[str, Any]], asset_type: str = "Stocks"):
        self.data_1m = data_1m
        self.asset_type = asset_type.capitalize()
        if self.asset_type == "Stocks":
            self.corridor_start = "06:00"
            self.corridor_end = "10:00"
            self.end_of_day = "15:59"
        else:
            self.corridor_start = "00:00"
            self.corridor_end = "04:00"
            self.end_of_day = "23:59"
            
        self.position_size = 100

    def run(self):
        df = pd.DataFrame(self.data_1m)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        df.set_index('date', inplace=True)
        
        df_5m = df.resample('5min').agg({
            'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
        }).dropna()

        days = df.index.normalize().unique()
        trades = []
        
        for current_day in days:
            day_str = current_day.strftime("%Y-%m-%d")
            corridor_start_time = pd.Timestamp(f"{day_str} {self.corridor_start}")
            corridor_end_time = pd.Timestamp(f"{day_str} {self.corridor_end}")
            
            corridor_df = df.loc[corridor_start_time : corridor_end_time - pd.Timedelta(minutes=1)]
            if corridor_df.empty:
                print(f"{day_str}: Corridor empty")
                continue
                
            c_high = corridor_df['high'].max()
            c_low = corridor_df['low'].min()
            c_width = c_high - c_low
            print(f"{day_str}: Corridor {c_low:.2f} - {c_high:.2f} (width: {c_width:.2f})")
            
            search_start_time = corridor_end_time
            end_of_day_time = pd.Timestamp(f"{day_str} {self.end_of_day}")
            day_5m = df_5m.loc[search_start_time : end_of_day_time]
            
            state = 0
            lowest_low = float('inf')
            
            for index, row in day_5m.iterrows():
                if state == 0:
                    if row['close'] < c_low:
                        state = 1
                        lowest_low = row['low']
                        print(f"  {index.time()}: Break below {c_low:.2f}")
                elif state == 1:
                    lowest_low = min(lowest_low, row['low'])
                    if row['close'] > c_low:
                        tail_length = c_low - lowest_low
                        print(f"  {index.time()}: Close back! Tail: {tail_length:.2f}, limit: {0.5*c_width:.2f}")
                        if tail_length <= 0.5 * c_width:
                            print(f"  SIGNAL FOUND")
                            trades.append(index)
                        state = 0
                        break
        return trades

# Mock Data Generation
def generate_mock_day(date_str, base_price):
    # Generating 1m data
    times = pd.date_range(f"{date_str} 04:00", f"{date_str} 18:00", freq='1min')
    data = []
    for t in times:
        h = t.hour
        m = t.minute
        price = base_price
        
        if h < 10:
            price = base_price - (h-4)*0.1
        elif h == 10 and m < 20:
            price = base_price - 1.0 # corridor low breaker
        elif h == 10 and m >= 20:
            price = base_price + 2.0 # recovery
            
        data.append({
            "date": t.strftime("%Y-%m-%d %H:%M:%S"),
            "open": price, "high": price + 0.05, "low": price - 0.05, "close": price, "volume": 1000
        })
    return data

mock_data = generate_mock_day("2024-03-08", 200)
tester = SpringBacktesterDebug(mock_data)
trades = tester.run()
print(f"Total trades: {len(trades)}")
