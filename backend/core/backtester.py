import pandas as pd
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class SpringBacktester:
    """
    Бэктестер для стратегии 4H/5m Spring & Upthrust.
    Использует 5m исторические данные от FMP (лимиты больше, чем у 1m).
    """
    def __init__(self, data: List[Dict[str, Any]], asset_type: str = "Stocks"):
        self.data = data
        self.asset_type = asset_type.capitalize() # "Stocks", "Crypto", "Forex", "Gold"
        
        # Настройки стратегии
        # Для Stocks: коридор 06:00 - 10:00, закрытие позиций в 15:59
        # Для Crypto: коридор 00:00 - 04:00, закрытие позиций в 23:59
        if self.asset_type == "Stocks":
            self.corridor_start = "06:00"
            self.corridor_end = "10:00"
            self.end_of_day = "15:59"
        else:
            self.corridor_start = "00:00"
            self.corridor_end = "04:00"
            self.end_of_day = "23:59"
            
        self.position_size = 100  # Фиксированно 100 лотов/акций

    def run(self) -> Dict[str, Any]:
        if not self.data:
            return {"trades": [], "equity": []}
            
        # Преобразуем в Pandas DataFrame для удобства
        df = pd.DataFrame(self.data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        df.set_index('date', inplace=True)
        
        logger.info(f"Backtesting {self.asset_type} with {len(df)} 5m candles.")
        
        # Данные уже 5m, агрегация не нужна
        df_5m = df

        days = df_5m.index.normalize().unique()
        
        trades = []
        equity_curve = []
        current_equity = 10000.0 # Стартовый капитал
        
        from zoneinfo import ZoneInfo
        ny_tz = ZoneInfo("America/New_York")
        
        for current_day in days:
            day_str = current_day.strftime("%Y-%m-%d")
            
            # 1. Формирование 4H Коридора (по 5m свечам)
            corridor_start_time = pd.Timestamp(f"{day_str} {self.corridor_start}")
            corridor_end_time = pd.Timestamp(f"{day_str} {self.corridor_end}")
            
            corridor_df = df_5m.loc[corridor_start_time : corridor_end_time - pd.Timedelta(minutes=1)]
            if corridor_df.empty:
                continue
                
            c_high = corridor_df['high'].max()
            c_low = corridor_df['low'].min()
            c_width = c_high - c_low
            
            if c_width <= 0:
                continue
            
            # 2. Поиск сигналов после коридора
            search_start_time = corridor_end_time
            end_of_day_time = pd.Timestamp(f"{day_str} {self.end_of_day}")
            
            day_5m = df_5m.loc[search_start_time : end_of_day_time].copy()
            if day_5m.empty:
                continue
            
            # Состояния пробоев
            state_long = 0
            state_short = 0
            lowest_low = float('inf')
            highest_high = float('-inf')
            
            for index, row in day_5m.iterrows():
                # Мы не можем входить в самом конце дня
                if index >= end_of_day_time - pd.Timedelta(minutes=10):
                    break
                    
                # Ищем лонг (Spring)
                if state_long == 0 and state_short != 2: # Если еще не в шорте
                    if row['close'] < c_low:
                        state_long = 1
                        lowest_low = row['low']
                elif state_long == 1:
                    lowest_low = min(lowest_low, row['low'])
                    if row['close'] > c_low:
                        tail_length = c_low - lowest_low
                        if tail_length <= 1.0 * c_width:
                            # ВХОД В ЛОНГ
                            entry_price = row['close']
                            risk = c_low - lowest_low
                            if risk > 0:
                                sl = entry_price - risk
                                tp = entry_price + 2 * risk
                                self._execute_trade(
                                    entry_idx=index, entry_price=entry_price, sl=sl, tp=tp,
                                    c_high=c_high, c_low=c_low, is_long=True,
                                    day_5m=day_5m, end_of_day_time=end_of_day_time,
                                    trades=trades, equity_curve=equity_curve,
                                    current_equity=current_equity, ny_tz=ny_tz
                                )
                                current_equity = equity_curve[-1]['value'] if equity_curve else current_equity
                                state_long = 2 # В сделке/Закончили
                                break # 1 сделка в день максимум
                        else:
                            state_long = 0 # Отмена
                            
                # Ищем шорт (Upthrust)
                if state_short == 0 and state_long != 2:
                    if row['close'] > c_high:
                        state_short = 1
                        highest_high = row['high']
                elif state_short == 1:
                    highest_high = max(highest_high, row['high'])
                    if row['close'] < c_high:
                        tail_length = highest_high - c_high
                        if tail_length <= 1.0 * c_width:
                            # ВХОД В ШОРТ
                            entry_price = row['close']
                            risk = highest_high - c_high
                            if risk > 0:
                                sl = entry_price + risk
                                tp = entry_price - 2 * risk
                                self._execute_trade(
                                    entry_idx=index, entry_price=entry_price, sl=sl, tp=tp,
                                    c_high=c_high, c_low=c_low, is_long=False,
                                    day_5m=day_5m, end_of_day_time=end_of_day_time,
                                    trades=trades, equity_curve=equity_curve,
                                    current_equity=current_equity, ny_tz=ny_tz
                                )
                                current_equity = equity_curve[-1]['value'] if equity_curve else current_equity
                                state_short = 2 # В сделке
                                break
                        else:
                            state_short = 0 # Отмена

        # Считаем базовые метрики
        win_trades = len([t for t in trades if t['pnl'] > 0])
        total_trades = len(trades)
        winrate = round((win_trades / total_trades) * 100, 2) if total_trades > 0 else 0.0
        
        return {
            "metrics": {
                "totalTrades": total_trades,
                "winRate": winrate,
                "finalEquity": round(current_equity, 2),
                "totalReturn": round(current_equity - 10000.0, 2)
            },
            "trades": trades,
            "equity": equity_curve
        }

    def _execute_trade(self, entry_idx, entry_price, sl, tp, c_high, c_low, is_long, day_5m, end_of_day_time, trades, equity_curve, current_equity, ny_tz):
        exec_start_time = entry_idx + pd.Timedelta(minutes=5)
        exec_df = day_5m.loc[exec_start_time : end_of_day_time]
        
        exit_price = None
        exit_time = None
        exit_reason = None
        
        for exec_idx, exec_row in exec_df.iterrows():
            if is_long:
                if exec_row['low'] <= sl:
                    exit_price = sl
                    exit_time = exec_idx
                    exit_reason = "SL"
                    break
                elif exec_row['high'] >= tp:
                    exit_price = tp
                    exit_time = exec_idx
                    exit_reason = "TP"
                    break
            else:
                if exec_row['high'] >= sl:
                    exit_price = sl
                    exit_time = exec_idx
                    exit_reason = "SL"
                    break
                elif exec_row['low'] <= tp:
                    exit_price = tp
                    exit_time = exec_idx
                    exit_reason = "TP"
                    break
                    
        if not exit_price:
            if not exec_df.empty:
                exit_price = exec_df.iloc[-1]['close']
                exit_time = exec_df.index[-1]
                exit_reason = "EOD"
            else:
                exit_price = entry_price
                exit_time = entry_idx
                exit_reason = "EOD"
        
        if is_long:
            pnl = (exit_price - entry_price) * self.position_size
        else:
            pnl = (entry_price - exit_price) * self.position_size
            
        current_equity += pnl
        
        entry_ts = int(entry_idx.tz_localize(ny_tz).timestamp())
        exit_ts = int(exit_time.tz_localize(ny_tz).timestamp())

        trades.append({
            "entryTime": entry_ts,
            "exitTime": exit_ts,
            "entryPrice": round(entry_price, 4),
            "exitPrice": round(exit_price, 4),
            "type": "Long" if is_long else "Short",
            "pnl": round(pnl, 2),
            "reason": exit_reason,
            "sl": round(sl, 4),
            "tp": round(tp, 4),
            "corridorHigh": round(c_high, 4),
            "corridorLow": round(c_low, 4)
        })
        
        equity_curve.append({
            "time": exit_ts,
            "value": round(current_equity, 2)
        })
