'use client';

import { useRouter } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chartsApi, portfolioApi } from '../../lib/api';
import { StockChart } from '../../components/Chart/StockChart';
import type { Timeframe } from '../../types';
import styles from './page.module.css';

function ChartCard({ symbol, timeframe, onExpand, onRemove }: {
  symbol: string;
  timeframe: Timeframe;
  onExpand: () => void;
  onRemove?: () => void;
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
          {onRemove && (
            <button className={styles.cardBtnRemove} onClick={onRemove} title="Удалить">×</button>
          )}
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

// ─── Portfolio Tab ──────────────────────────────────────────
function PortfolioTab({ timeframe }: { timeframe: Timeframe }) {
  const { data: portfolioItems = [], isLoading, refetch } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => portfolioApi.get(),
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [activeType, setActiveType] = useState<'Stocks' | 'Crypto' | 'Forex'>('Stocks');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    try {
      await portfolioApi.add(newSymbol.trim().toUpperCase(), activeType);
      setNewSymbol('');
      refetch();
    } catch {
      alert('Тикер уже есть в портфеле или произошла ошибка добавления.');
    }
  };

  const handleDelete = async (symbol: string) => {
    await portfolioApi.delete(symbol);
    refetch();
  };

  if (isLoading) return <div className={styles.loading}><span className="spinner" /></div>;

  return (
    <div className={styles.portfolioTab}>
      <div className={styles.portfolioToolbar}>
        <div className={styles.typeGroup}>
          {(['Stocks', 'Crypto', 'Forex'] as const).map(t => (
            <button
              key={t}
              className={`${styles.typeBtn} ${activeType === t ? styles.typeActive : ''}`}
              onClick={() => setActiveType(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input
            className={styles.addInput}
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            placeholder={`Тикер (${activeType})...`}
          />
          <button type="submit" className={styles.addBtn}>+ Добавить</button>
        </form>
      </div>

      {portfolioItems.length === 0 ? (
        <div className={styles.emptyPortfolio}>
          <p>Портфель пуст. Добавьте ваш первый тикер выше.</p>
        </div>
      ) : (
        <div className={`${styles.grid} ${portfolioItems.length > 4 ? styles.grid3 : styles.grid2}`}>
          {portfolioItems.map((item: any) => (
            <ChartCard
              key={item.id}
              symbol={item.symbol}
              timeframe={timeframe}
              onExpand={() => {}}
              onRemove={() => handleDelete(item.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Custom Tab Content ──────────────────────────────────────
function CustomTab({ timeframe }: { timeframe: Timeframe }) {
  const [tickers, setTickers] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN']);
  const [inputTicker, setInputTicker] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function addTicker() {
    const t = inputTicker.trim().toUpperCase();
    if (t && !tickers.includes(t)) setTickers(prev => [...prev, t]);
    setInputTicker('');
  }

  function removeTicker(t: string) {
    setTickers(prev => prev.filter(x => x !== t));
  }

  if (expanded) {
    return (
      <div className={styles.expandedWrap}>
        <div className={styles.expandedHeader}>
          <span className={styles.expandedTitle}>{expanded}</span>
          <button className={styles.collapseBtn} onClick={() => setExpanded(null)}>← Назад к сетке</button>
        </div>
        <StockChart data={[]} height={Math.round(window.innerHeight * 0.75)} showVolume />
      </div>
    );
  }

  return (
    <>
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
      <div className={`${styles.grid} ${tickers.length > 4 ? styles.grid3 : styles.grid2}`}>
        {tickers.map(sym => (
          <ChartCard key={sym} symbol={sym} timeframe={timeframe} onExpand={() => setExpanded(sym)} />
        ))}
      </div>
    </>
  );
}

function MultiChartContent() {
  const [activeTab, setActiveTab] = useState<'custom' | 'portfolio'>('portfolio');
  const [timeframe, setTimeframe] = useState<Timeframe>('1day');

  const TF_OPTIONS: Timeframe[] = ['5min', '15min', '1hour', '4hour', '1day'];

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Tab switcher */}
        <div className={styles.tabGroup}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'portfolio' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('portfolio')}
          >
            💼 Мой Портфель
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'custom' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            📊 Мои список
          </button>
        </div>

        <div className={styles.divider} />

        {/* Timeframe switcher */}
        <div className={styles.tfGroup}>
          {TF_OPTIONS.map(tf => (
            <button key={tf} className={`${styles.tfBtn} ${timeframe === tf ? styles.tfActive : ''}`}
              onClick={() => setTimeframe(tf)}>{tf}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'portfolio'
        ? <PortfolioTab timeframe={timeframe} />
        : <CustomTab timeframe={timeframe} />
      }
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
