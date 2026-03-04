'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { chartsApi } from '@/lib/api';
import { StockChart } from '@/components/Chart/StockChart';
import { ChartToolbar } from '@/components/Chart/ChartToolbar';
import { IndicatorConfig } from '@/components/Chart/IndicatorsModal';
import { IndicatorSettingsModal } from '@/components/Chart/IndicatorSettingsModal';
import { calculateSMA, calculateEMA, calculateRSI } from '@/utils/indicators';
import type { Timeframe } from '@/types';
import styles from './page.module.css';

export default function ChartPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const [symbol, setSymbol] = useState(params.symbol.toUpperCase());
  const [timeframe, setTimeframe] = useState<Timeframe>('1day');
  const [activeIndicators, setActiveIndicators] = useState<IndicatorConfig[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorConfig | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['chart', symbol, timeframe],
    queryFn: () => chartsApi.getOHLCV(symbol, timeframe),
    select: (queryData) => {
      const MSK_OFFSET = 3 * 3600;
      return queryData.map((d: any) => {
        if (typeof d.time === 'number') {
          return { ...d, time: d.time + MSK_OFFSET };
        }
        return d;
      });
    },
    enabled: !!symbol,
    refetchInterval: 5000, // Живое обновление каждые 5 сек, склейка теперь на бэкенде
  });

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

  // 1. First Pass: Calculate Base Indicators (source = 'close', 'open', 'high', 'low')
  const baseIndicators: any[] = [];
  const dependentIndicators: any[] = [];

  activeIndicators.forEach((conf: IndicatorConfig) => {
    if (['close', 'open', 'high', 'low'].includes((conf.source || 'close').toLowerCase())) {
      baseIndicators.push(conf);
    } else {
      dependentIndicators.push(conf);
    }
  });

  const computedLines: any[] = [];
  const linesMap = new Map<string, { time: string, value: number }[]>();

  // Use raw OHLCV as source arrays
  const sourceArrays: Record<string, any[]> = {
    close: (data as any[]).map((d: any) => ({ time: d.time, value: d.close })),
    open: (data as any[]).map((d: any) => ({ time: d.time, value: d.open })),
    high: (data as any[]).map((d: any) => ({ time: d.time, value: d.high })),
    low: (data as any[]).map((d: any) => ({ time: d.time, value: d.low })),
  };

  // Helper to process one config
  function processIndicator(conf: IndicatorConfig, sourceData: any[]) {
    let vals: any[] = [];
    if (conf.type === 'SMA') vals = calculateSMA(sourceData, conf.period);
    if (conf.type === 'EMA') vals = calculateEMA(sourceData, conf.period);
    if (conf.type === 'RSI') vals = calculateRSI(sourceData, conf.period);

    linesMap.set(conf.id, vals);

    // Add to render array regardless of visibility so inline UI can map it
    computedLines.push({
      key: conf.id,
      id: conf.id, // Keep raw id for StockChart internal tracking
      config: conf, // Pass config for inline menus
      color: conf.color,
      pane: conf.pane || 0,
      values: vals
    });

    // Default TradingView style RSI smoothing line if RSI is added
    if (conf.type === 'RSI' && vals.length > 14) {
      const rsiMA = calculateSMA(vals, 14); // 14-period SMA of RSI
      computedLines.push({
        key: `${conf.id}_MA`,
        id: `${conf.id}_MA`,
        config: { ...conf, type: 'MA', id: `${conf.id}_MA` }, // Pseudo config for the MA
        color: '#FFD700', // Gold/Yellow for smoothing
        pane: conf.pane || 0,
        values: rsiMA
      });
    }
  }

  // Calculate Base
  baseIndicators.forEach(conf => {
    const src = (conf.source || 'close').toLowerCase();
    processIndicator(conf, sourceArrays[src] || sourceArrays.close);
  });

  // Calculate Dependent (Indicators on Indicators)
  // Max 2 passes (e.g. SMA of RSI of Close)
  let pending = [...dependentIndicators];
  let maxIters = 5;
  while (pending.length > 0 && maxIters > 0) {
    const nextPending: any[] = [];
    pending.forEach(conf => {
      const srcData = linesMap.get(conf.source as string);
      if (srcData) {
        processIndicator(conf, srcData);
      } else {
        nextPending.push(conf); // source not ready yet, keep waiting
      }
    });
    pending = nextPending;
    maxIters--;
  }

  const indicatorLines = computedLines;

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
      />

      <div className={styles.chartWrap}>
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
        {!isLoading && !error && data.length > 0 && (
          <StockChart
            data={data as any}
            indicators={indicatorLines}
            height={560} // This is now minHeight/fallback
            showVolume
            onRemoveIndicator={handleRemoveIndicator}
            onUpdateIndicator={handleUpdateIndicator}
            onSettingsClick={setSelectedIndicator}
          />
        )}
      </div>

      <IndicatorSettingsModal
        isOpen={!!selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
        indicator={selectedIndicator}
        allIndicators={activeIndicators}
        onSave={handleUpdateIndicator}
      />

      {/* Price info bar */}
      {data.length > 0 && (() => {
        const last = (data as any[])[data.length - 1];
        const prev = (data as any[])[data.length - 2];
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
