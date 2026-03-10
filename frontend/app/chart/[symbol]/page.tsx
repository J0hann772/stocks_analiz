'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chartsApi, drawingsApi, backtestApi } from '../../../lib/api';
import { StockChart } from '../../../components/Chart/StockChart';
import { ChartToolbar } from '../../../components/Chart/ChartToolbar';
import { IndicatorConfig } from '../../../components/Chart/IndicatorsModal';
import { IndicatorSettingsModal } from '../../../components/Chart/IndicatorSettingsModal';
import { DrawingToolbar } from '../../../components/Chart/DrawingToolbar';
import { DrawingCanvas } from '../../../components/Chart/DrawingCanvas';
import type { DrawingToolType, DrawnObject } from '../../../components/Chart/DrawingTools.types';
import { BacktestPanel } from '../../../components/Chart/BacktestPanel';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { calculateSMA, calculateEMA, calculateRSI, calculateADX, calculateHHLL, calculateATR, calculateAlligator, calculateHL2 } from '../../../utils/indicators';
import type { Timeframe } from '../../../types';
import styles from './page.module.css';

import { useMarketWebsocket } from '../../../hooks/useMarketWebsocket';
import { useAppStore } from '../../../store/useAppStore';

export default function ChartPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const rawSymbol = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const [symbol, setSymbol] = useState((rawSymbol || 'AAPL').toUpperCase());
  const [timeframe, setTimeframe] = useState<Timeframe>('1day');
  const [activeIndicators, setActiveIndicators] = useState<IndicatorConfig[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorConfig | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawing tools state
  const [activeTool, setActiveTool] = useState<DrawingToolType>('cursor');
  const [drawings, setDrawings] = useState<DrawnObject[]>([]);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesApiRef = useRef<ISeriesApi<any> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // Backtest State
  const [backtestResult, setBacktestResult] = useState<any>(null);

  const runBacktestMutation = useMutation({
    mutationFn: async () => {
      // Basic heuristic: check if symbol looks like Crypto/Forex, else assume Stock
      let type = 'Stocks';
      if (symbol.endsWith('USD') || symbol.endsWith('EUR')) type = 'Crypto';
      if (symbol.length === 6 && !symbol.includes('-')) type = 'Forex';
      
      const toObj = new Date();
      const fromObj = new Date();
      fromObj.setMonth(fromObj.getMonth() - 3);
      const toDate = toObj.toISOString().split('T')[0];
      const fromDate = fromObj.toISOString().split('T')[0];

      return await backtestApi.run(symbol, type, fromDate, toDate);
    },
    onSuccess: (data) => setBacktestResult(data),
    onError: (err: any) => alert('Ошибка бэктеста: ' + err.message)
  });

  const handleRunBacktest = () => runBacktestMutation.mutate();

  const handleChartReady = useCallback((chart: IChartApi, series: ISeriesApi<any>) => {
    chartApiRef.current = chart;
    seriesApiRef.current = series;
  }, []);

  const handleAddDrawing = useCallback((drawing: DrawnObject) => {
    setDrawings(prev => [...prev, drawing]);
  }, []);

  const handleToolComplete = useCallback(() => {
    setActiveTool('cursor');
  }, []);

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
  }, []);

  const handleRemoveDrawing = useCallback((id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
  }, []);

  const handleUpdateDrawing = useCallback((updated: DrawnObject) => {
    setDrawings(prev => prev.map(d => d.id === updated.id ? updated : d));
  }, []);

  // --- Persistence Logic ---
  const queryClient = useQueryClient();
  const isInitialLoadRef = useRef(true);
  
  // Загрузка начальных рисунков
  const { data: sessionData, refetch: refetchDrawings } = useQuery({
    queryKey: ['drawings', symbol],
    queryFn: () => drawingsApi.get(symbol),
    enabled: !!symbol,
    staleTime: Infinity, // Только ручная инвалидация
  });

  useEffect(() => {
    if (Array.isArray(sessionData)) {
      setDrawings(sessionData);
      isInitialLoadRef.current = true; // При загрузке новых данных мы сбрасываем флаг изменений
    } else {
      setDrawings([]);
    }
  }, [sessionData]);

  // Debounced сохранение
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (drawings.length === 0) {
          await drawingsApi.delete(symbol);
        } else {
          await drawingsApi.save(symbol, drawings);
        }
        // Опционально: обновить кэш
        queryClient.setQueryData(['drawings', symbol], (old: any) => ({
          ...old,
          symbol,
          drawings
        }));
      } catch (err) {
        console.error('Failed to save drawing session', err);
      }
    }, 5000); // 5 секунд задержка после последнего изменения

    return () => clearTimeout(timer);
  }, [drawings, symbol, queryClient]);
  // -------------------------

  // Подключаемся к WebSocket для получения живых тиков
  const { ticks } = useMarketWebsocket([symbol]);
  const currentTick = ticks[symbol];

  const { timezone } = useAppStore();
  
  const timeConverter = useMemo(() => {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
      return (utcSeconds: number) => {
        const d = new Date(utcSeconds * 1000);
        const parts = dtf.formatToParts(d);
        const map: Record<string, string> = {};
        for (const p of parts) map[p.type] = p.value;
        const hr = +map.hour === 24 ? 0 : +map.hour;
        const targetTarget = Date.UTC(+map.year, +map.month - 1, +map.day, hr, +map.minute, +map.second);
        const browserNominal = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
        return utcSeconds + ((targetTarget - browserNominal) / 1000);
      };
    } catch (e) {
      console.error("Timezone converter failed", e);
      return (utcSec: number) => utcSec;
    }
  }, [timezone]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['chart', symbol, timeframe, timezone], 
    queryFn: () => chartsApi.getOHLCV(symbol, timeframe),
    select: (queryData) => {
      return queryData.map((d: any) => {
        if (typeof d.time === 'number') {
          return { ...d, time: timeConverter(d.time) };
        }
        // For string dates (YYYY-MM-DD), no offset shift needed as hours aren't shown
        return d;
      });
    },
    enabled: !!symbol,
    refetchInterval: false, // Отключаем polling, теперь WebSockets!
  });

  const [liveData, setLiveData] = useState<any[]>([]);

  // Инициализация при получении исторических данных
  useEffect(() => {
    if (data && data.length > 0) {
      setLiveData(data as any[]);
    }
  }, [data]);


  // Утилита для получения длительности таймфрейма в миллисекундах
  const getIntervalMs = (tf: Timeframe) => {
    switch (tf) {
      case '1min': return 60 * 1000;
      case '5min': return 5 * 60 * 1000;
      case '15min': return 15 * 60 * 1000;
      case '30min': return 30 * 60 * 1000;
      case '1hour': return 60 * 60 * 1000;
      case '4hour': return 4 * 60 * 60 * 1000;
      case '1day': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000; // по умолчанию 1 минута
    }
  };

  // Обработка живых тиков с троттлингом (ограничение до ~4 кадров в сек)
  const lastTickTime = useRef<number>(0);
  useEffect(() => {
    if (currentTick && liveData.length > 0) {
      const now = Date.now();
      if (now - lastTickTime.current > 250) {
        lastTickTime.current = now;
        
        setLiveData(prev => {
          const newData = [...prev];
          const last = { ...newData[newData.length - 1] };
          
          const tickTimeMs = currentTick.t;
          const intervalMs = getIntervalMs(timeframe);
          
          // Для Lightweight Charts время в секундах
          // Округляем входящий тик до начала текущего интервала (свечи)
          const currentCandleStartTime = Math.floor(tickTimeMs / intervalMs) * intervalMs / 1000;
          // Но LightweightCharts может менять часовой пояс, MSK_OFFSET мы добавляли выше (3 часа).
          // Однако FMP отдает историю тоже с определенным смещением.
          // Проще всего проверить `last.time`.
          
          let lastTimeSec = 0;
          if (typeof last.time === 'number') {
             lastTimeSec = last.time;
          } else if (typeof last.time === 'string') {
             // 'YYYY-MM-DD'
             // Для '1day' мы можем просто считать, что один день это всегда одна свеча.
             // У FMP для дня история обычно обрывается "сегодняшним днем". 
             const ms = new Date(last.time).getTime();
             lastTimeSec = Math.floor(ms / 1000);
          }
          
          // Проверка: относится ли текущий тик к той же свече?
          // Так как исторические данные уже сдвинуты на MSK_OFFSET (3 * 3600), 
          // свечи в базе выровнены по другому.
          // Чтобы не заморачиваться со сложной математикой часовых поясов,
          // просто проверяем: если tickTime (в сек) > last.time + intervalSec, то создаем новую свечу.
          const intervalSec = intervalMs / 1000;
          
          // Если это '1day', там дата строка, лучше опираться на это:
          if (timeframe === '1day') {
            const todayStr = new Date(tickTimeMs).toISOString().split('T')[0];
            if (last.time !== todayStr) {
               // Новая дневная свеча
               newData.push({
                 time: todayStr,
                 open: currentTick.p,
                 high: currentTick.p,
                 low: currentTick.p,
                 close: currentTick.p,
                 volume: currentTick.v || 0
               });
            } else {
               last.close = currentTick.p;
               if (currentTick.p > last.high) last.high = currentTick.p;
               if (currentTick.p < last.low) last.low = currentTick.p;
               if (currentTick.v) last.volume = currentTick.v; // FMP v - кумулятивный объем за день
               newData[newData.length - 1] = last;
            }
          } else {
            // Внутридневные таймфреймы. Свечи из базы имеют time в секундах c shift
            // Мы должны округлить текущее время по отрезкам `intervalSec`
            // Убираем смещение (shift) для правильного округления времени в UTC (свечи выравниваются по UTC минутам/часам)
            const tickTimeUTC = (tickTimeMs / 1000); 
            const candleStartUTC = Math.floor(tickTimeUTC / intervalSec) * intervalSec;
            const expectedTimeWithOffset = timeConverter(candleStartUTC);

            if (expectedTimeWithOffset > last.time) {
              // Новая свеча
              newData.push({
                time: expectedTimeWithOffset,
                open: currentTick.p,
                high: currentTick.p,
                low: currentTick.p,
                close: currentTick.p,
                volume: currentTick.v || 0
              });
            } else {
              // Обновляем текущую (последнюю) свечу
              last.close = currentTick.p;
              if (currentTick.p > last.high) last.high = currentTick.p;
              if (currentTick.p < last.low) last.low = currentTick.p;
              if (currentTick.v) last.volume = currentTick.v;
              newData[newData.length - 1] = last;
            }
          }

          return newData;
        });
      }
    }
  }, [currentTick, timeframe, timeConverter]); // добавили timeConverter в зависимости

  function handleSymbolChange(newSymbol: string) {
    setSymbol(newSymbol);
    router.replace(`/chart/${newSymbol}`);
  }

  function handleAddIndicator(config: Omit<IndicatorConfig, 'id'>) {
    const newInd = { ...config, id: Math.random().toString(36).substr(2, 9) };
    setActiveIndicators((prev: IndicatorConfig[]) => [...prev, newInd]);
  }

  function handleRemoveIndicator(id: string) {
    setActiveIndicators((prev: IndicatorConfig[]) => prev.filter(i => i.id !== id));
  }

  function handleUpdateIndicator(updated: IndicatorConfig) {
    setActiveIndicators((prev: IndicatorConfig[]) => 
      prev.map(i => i.id === updated.id ? updated : i)
    );
  }

  const indicatorLines = useMemo(() => {
    // 1. First Pass: Calculate Base Indicators (source = 'close', 'open', 'high', 'low')
    const baseIndicators: any[] = [];
    const dependentIndicators: any[] = [];

    activeIndicators.forEach((conf: IndicatorConfig) => {
      if (['close', 'open', 'high', 'low', 'hl2'].includes((conf.source || 'close').toLowerCase())) {
        baseIndicators.push(conf);
      } else {
        dependentIndicators.push(conf);
      }
    });

    const computedLines: any[] = [];
    const linesMap = new Map<string, { time: string, value: number }[]>();

    // Use raw OHLCV as source arrays
    const sourceArrays: Record<string, any[]> = {
      close: liveData.map((d: any) => ({ time: d.time, value: d.close })),
      open: liveData.map((d: any) => ({ time: d.time, value: d.open })),
      high: liveData.map((d: any) => ({ time: d.time, value: d.high })),
      low: liveData.map((d: any) => ({ time: d.time, value: d.low })),
      hl2: calculateHL2(liveData),
    };

    // Helper to process one config
    function processIndicator(conf: IndicatorConfig, sourceData: any[]) {
      let vals: any[] = [];
      let extraVals: any[] | undefined = undefined;
      let extraVals2: any[] | undefined = undefined;

      if (conf.type === 'SMA') vals = calculateSMA(sourceData, conf.period);
      if (conf.type === 'EMA') vals = calculateEMA(sourceData, conf.period);
      if (conf.type === 'RSI') vals = calculateRSI(sourceData, conf.period);
      if (conf.type === 'ADX') {
        const ohclArgs = liveData.map((d: any) => ({
          time: d.time,
          high: d.high,
          low: d.low,
          close: d.close
        }));
        vals = calculateADX(ohclArgs, conf.period, conf.smoothing || 14);
      }
      if (conf.type === 'HHLL') {
        const ohclArgs = liveData.map((d: any) => ({
          time: d.time,
          high: d.high,
          low: d.low,
          close: d.close
        }));
        const hhll = calculateHHLL(ohclArgs, conf.topPeriod || 20, conf.botPeriod || 20, conf.topSrc || 'high', conf.botSrc || 'low');
        vals = hhll.top;
        extraVals = hhll.bot;
      }
      if (conf.type === 'ATR') {
        const ohclArgs = liveData.map((d: any) => ({
          time: d.time,
          high: d.high,
          low: d.low,
          close: d.close
        }));
        vals = calculateATR(ohclArgs, conf.period || 14, conf.smoothingType || 'RMA');
      }
      if (conf.type === 'Alligator') {
        const alligatorData = calculateAlligator(
          sourceData, 
          conf.jawPeriod, conf.jawOffset,
          conf.teethPeriod, conf.teethOffset,
          conf.lipsPeriod, conf.lipsOffset
        );
        vals = alligatorData.jaw;
        extraVals = alligatorData.teeth;
        extraVals2 = alligatorData.lips;
      }

      linesMap.set(conf.id, vals);

      computedLines.push({
        key: conf.id,
        id: conf.id,
        config: conf,
        color: conf.color,
        pane: conf.pane || 0,
        values: vals,
        extraValues: extraVals,
        extraValues2: extraVals2,
      });

      // Yellow RSI MA line removed per user request
    }

    baseIndicators.forEach(conf => {
      const src = (conf.source || 'close').toLowerCase();
      processIndicator(conf, sourceArrays[src] || sourceArrays.close);
    });

    let pending = [...dependentIndicators];
    let maxIters = 5;
    while (pending.length > 0 && maxIters > 0) {
      const nextPending: any[] = [];
      pending.forEach(conf => {
        const srcData = linesMap.get(conf.source as string);
        if (srcData) {
          processIndicator(conf, srcData);
        } else {
          nextPending.push(conf);
        }
      });
      pending = nextPending;
      maxIters--;
    }

    return computedLines;
  }, [liveData, activeIndicators]);

  // Compute markers and corridors from backtestResult
  const { backtestMarkers, backtestDrawings } = useMemo(() => {
    if (!backtestResult) return { backtestMarkers: [], backtestDrawings: [] };
    
    const markers: any[] = [];
    const derivedDrawings: DrawnObject[] = [];
    
    // Sort trades by entry time so we can assign IDs easily
    const trades = backtestResult.trades || [];
    trades.forEach((trade: any, idx: number) => {
      // Apply the same timezone shift to marker times
      // trade.entryTime is now a UTC timestamp in seconds
      const markerTime = timeConverter(trade.entryTime);
      
      // Create Marker for Entry
      const isLong = trade.type === 'Long';
      markers.push({
        time: markerTime as any,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: isLong ? '#3fb950' : '#f85149',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: isLong ? 'Buy' : 'Sell',
      });

      // Create Marker for Exit
      const exitMarkerTime = timeConverter(trade.exitTime);
      if (exitMarkerTime) {
        markers.push({
          time: exitMarkerTime as any,
          position: isLong ? 'aboveBar' : 'belowBar',
          color: isLong ? '#f85149' : '#3fb950',
          shape: isLong ? 'arrowDown' : 'arrowUp',
          text: trade.reason || 'Exit',
        });
      }

      // Add SL/TP zone drawings
      if (trade.tp && trade.sl && exitMarkerTime) {
        derivedDrawings.push({
          id: `bt_sltp_${idx}`,
          type: 'sltp',
          points: [
            { price: trade.entryPrice, time: markerTime, x: 0, y: 0 },
            { price: trade.tp, time: exitMarkerTime, x: 0, y: 0 },
            { price: trade.sl, time: exitMarkerTime, x: 0, y: 0 }
          ],
          color: '#8b949e',
          lineWidth: 1
        });
      }

      // Show Corridor only on 5m timeframe (as requested)
      if (timeframe === '5min' || timeframe === '1min') {
        const cHigh = trade.corridorHigh;
        const cLow = trade.corridorLow;
        
        // trade.entryTime is UTC timestamp in seconds. Compute NY start of day?
        // Let's just create a timestamp for the start of the day in UTC, then add shift.
        // Convert to milliseconds to format it to string
        let entryDt = new Date(trade.entryTime * 1000);
        
        // Find 06:00 NY or 00:00 NY equivalent depending on asset_type
        // For simplicity, we just draw from the entry time going forward or slightly backward
        // Actually, FMP data is in UTC or EST. 
        // We'll draw 2 horizontal lines covering the whole day of the trade.
        const tradeDateStr = entryDt.toISOString().split('T')[0];
        const dayStartUTC = Math.floor(new Date(`${tradeDateStr}T00:00:00Z`).getTime() / 1000);
        const dayEndUTC = Math.floor(new Date(`${tradeDateStr}T23:59:59Z`).getTime() / 1000);
        const dayStart = timeConverter(dayStartUTC);
        const dayEnd = timeConverter(dayEndUTC);

        derivedDrawings.push({
          id: `bt_cHigh_${idx}`,
          type: 'trendline',
          color: 'rgba(255, 255, 255, 0.4)',
          lineWidth: 1,
          points: [
            { price: cHigh, time: dayStart, x: 0, y: 0 },
            { price: cHigh, time: dayEnd, x: 0, y: 0 }
          ]
        });
        derivedDrawings.push({
          id: `bt_cLow_${idx}`,
          type: 'trendline',
          color: 'rgba(255, 255, 255, 0.4)',
          lineWidth: 1,
          points: [
            { price: cLow, time: dayStart, x: 0, y: 0 },
            { price: cLow, time: dayEnd, x: 0, y: 0 }
          ]
        });
      }
    });

    return { backtestMarkers: markers, backtestDrawings: derivedDrawings };
  }, [backtestResult, timeframe, timeConverter]);

  return (
    <div className={`${styles.page} ${isFullscreen ? styles.fullscreen : ''}`}>
      <ChartToolbar
        symbol={symbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        activeIndicators={activeIndicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onSymbolChange={handleSymbolChange}
        onFullscreen={() => setIsFullscreen((f: boolean) => !f)}
        onLoadPreset={(inds) => setActiveIndicators(inds)}
        onRunBacktest={handleRunBacktest}
      />

      <div className={styles.chartArea}>
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClearAll={handleClearDrawings}
          onSyncRun={refetchDrawings}
        />
        <div className={styles.chartWrap} ref={chartContainerRef}>
          {isLoading && (
            <div className={styles.loading}>
              <span className="spinner" />
              <span>Загрузка {symbol}...</span>
            </div>
          )}
          {error && (
            <div className={styles.error}>
              Ошибка загрузки: {(error as any).message}
            </div>
          )}
          {!isLoading && !error && liveData.length > 0 && (
            <>
              <StockChart
                data={liveData as any}
                markers={backtestMarkers}
                indicators={indicatorLines}
                height={560}
                showVolume
                onRemoveIndicator={handleRemoveIndicator}
                onUpdateIndicator={handleUpdateIndicator}
                onSettingsClick={setSelectedIndicator}
                onChartReady={handleChartReady}
              />
              <DrawingCanvas
                chartApi={chartApiRef.current}
                seriesApi={seriesApiRef.current}
                activeTool={activeTool}
                drawings={[...drawings, ...backtestDrawings]}
                onAddDrawing={handleAddDrawing}
                onRemoveDrawing={handleRemoveDrawing}
                onUpdateDrawing={handleUpdateDrawing}
                onToolComplete={handleToolComplete}
                containerRef={chartContainerRef}
                data={liveData as any}
              />
              {backtestResult && (
                <BacktestPanel result={backtestResult} symbol={symbol} onClose={() => setBacktestResult(null)} />
              )}
            </>
          )}
        </div>
      </div>

      <IndicatorSettingsModal
        isOpen={!!selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
        indicator={selectedIndicator}
        allIndicators={activeIndicators}
        onSave={handleUpdateIndicator}
      />

      {/* Price info bar */}
      {liveData.length > 0 && (() => {
        const last = liveData[liveData.length - 1];
        const prev = liveData[liveData.length - 2];
        const change = prev ? ((last.close - prev.close) / prev.close * 100) : 0;
        const isUp = change >= 0;
        return (
          <div className={styles.priceBar}>
            <span className={styles.symLabel}>{symbol}</span>
            <span className={styles.price}>${last.close.toFixed(2)}</span>
            <span className={isUp ? styles.up : styles.down}>
              {isUp ? '+' : ''}{change.toFixed(2)}%
            </span>
            <span className="text-muted text-sm">O: {last.open.toFixed(2)}</span>
            <span className="text-muted text-sm">H: {last.high.toFixed(2)}</span>
            <span className="text-muted text-sm">L: {last.low.toFixed(2)}</span>
            <span className="text-muted text-sm">V: {(last.volume / 1e6).toFixed(1)}M</span>
          </div>
        );
      })()}
    </div>
  );
}
