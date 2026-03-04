'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chartsApi } from '@/lib/api';
import { StockChart } from '@/components/Chart/StockChart';
import type { Timeframe } from '@/types';
import styles from './page.module.css';

function ChartCard({ symbol, timeframe, onExpand }: {
  symbol: string;
  timeframe: Timeframe;
  onExpand: () => void;
}) {
  const router = useRouter();
  const { data = [], isLoading } = useQuery({
    queryKey: ['chart', symbol, timeframe],
    queryFn: () => chartsApi.getOHLCV(symbol, timeframe),
  });

  const last = (data as any[]).at(-1);
  const prev = (data as any[]).at(-2);
  const change = last && prev ? ((last.close - prev.close) / prev.close * 100) : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardSymbol}>{symbol}</span>
        {last && (
          <>
            <span className={styles.cardPrice}>${last.close.toFixed(2)}</span>
            {change !== null && (
              <span className={change >= 0 ? styles.up : styles.down}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </>
        )}
        <div className={styles.cardActions}>
          <button className={styles.cardBtn} onClick={() => router.push(`/chart/${symbol}`)} title="Полный экран">↗</button>
          <button className={styles.cardBtn} onClick={onExpand} title="Развернуть">⛶</button>
        </div>
      </div>
      <div className={styles.cardChart}>
        {isLoading ? (
          <div className={styles.loading}><span className="spinner" /></div>
        ) : (
          <StockChart data={data as any} height={220} showVolume={false} />
        )}
      </div>
    </div>
  );
}

function MultiChartContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTickers = searchParams.get('tickers') || 'AAPL,MSFT,GOOGL,AMZN';
  const [tickers, setTickers] = useState<string[]>(rawTickers.split(',').map(t => t.trim()));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1day');
  const [inputTicker, setInputTicker] = useState('');

  function addTicker() {
    const t = inputTicker.trim().toUpperCase();
    if (t && !tickers.includes(t)) {
      const updated = [...tickers, t];
      setTickers(updated);
      router.push(`/multichart?tickers=${updated.join(',')}`);
    }
    setInputTicker('');
  }

  function removeTicker(t: string) {
    const updated = tickers.filter(x => x !== t);
    setTickers(updated);
    router.push(`/multichart?tickers=${updated.join(',')}`);
  }

  const TF_OPTIONS: Timeframe[] = ['5min', '15min', '1hour', '4hour', '1day'];

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.tfGroup}>
          {TF_OPTIONS.map(tf => (
            <button key={tf} className={`${styles.tfBtn} ${timeframe === tf ? styles.tfActive : ''}`}
              onClick={() => setTimeframe(tf)}>{tf}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); addTicker(); }} className={styles.addForm}>
          <input
            className={styles.addInput}
            value={inputTicker}
            onChange={e => setInputTicker(e.target.value.toUpperCase())}
            placeholder="+ Добавить тикер"
          />
          <button type="submit" className={styles.addBtn}>Добавить</button>
        </form>
        <div className={styles.chips}>
          {tickers.map(t => (
            <span key={t} className={styles.chip}>
              {t}
              <button onClick={() => removeTicker(t)} className={styles.chipRemove}>×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      {expanded ? (
        <div className={styles.expandedWrap}>
          <div className={styles.expandedHeader}>
            <span className={styles.expandedTitle}>{expanded}</span>
            <button className={styles.collapseBtn} onClick={() => setExpanded(null)}>← Назад к сетке</button>
          </div>
          <StockChart
            data={[]}
            height={Math.round(window.innerHeight * 0.75)}
            showVolume
          />
        </div>
      ) : (
        <div className={`${styles.grid} ${tickers.length > 4 ? styles.grid3 : styles.grid2}`}>
          {tickers.map(sym => (
            <ChartCard key={sym} symbol={sym} timeframe={timeframe} onExpand={() => setExpanded(sym)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MultiChartPage() {
  return (
    <Suspense fallback={<div className="flex-center" style={{ height: '80vh' }}><span className="spinner" /></div>}>
      <MultiChartContent />
    </Suspense>
  );
}
