import pytest
from datetime import datetime
from core.backtester import SpringBacktester

def test_fake_breakout_take_profit_before_stop():
    # Simulate a scenario where price breaks down forming a fake breakout, 
    # enters trade, then hits Take Profit before hitting Stop Loss in the 1m data execution.
    # 4H Corridor High: 150, Low: 100
    # 5m candle breaks below 100 and closes back above.
    
    data_1m = [
        # Corridor setup (06:00 - 10:00)
        {"date": "2023-01-01 06:00:00", "open": 100, "high": 150, "low": 100, "close": 120, "volume": 1000},
        {"date": "2023-01-01 09:59:00", "open": 120, "high": 120, "low": 110, "close": 115, "volume": 1000},
        
        # 5m candle 1 (10:00 - 10:04): breaks down and CLOSES below c_low
        {"date": "2023-01-01 10:00:00", "open": 115, "high": 115, "low": 95, "close": 96, "volume": 1000},
        
        # 5m candle 2 (10:05 - 10:09): opens below, and CLOSES back above c_low
        {"date": "2023-01-01 10:05:00", "open": 96, "high": 103, "low": 96, "close": 102, "volume": 1000},
        
        # execution begins at 10:10:00. Entry = 102. sl = 97. tp = 112.
        {"date": "2023-01-01 10:10:00", "open": 102, "high": 105, "low": 101, "close": 104, "volume": 100},
        {"date": "2023-01-01 10:11:00", "open": 104, "high": 104, "low": 98,  "close": 99,  "volume": 100},
        {"date": "2023-01-01 10:12:00", "open": 99,  "high": 120, "low": 99,  "close": 119, "volume": 100},
        {"date": "2023-01-01 10:13:00", "open": 119, "high": 119, "low": 90,  "close": 90,  "volume": 100},
    ]
    
    backtester = SpringBacktester(data_1m, "Stocks")
    res = backtester.run()
    
    assert res['metrics']['totalTrades'] == 1
    t = res['trades'][0]
    assert t['exitPrice'] == 112.0
    assert t['reason'] == "TP"
    assert t['pnl'] > 0
