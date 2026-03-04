'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { strategiesApi, scannerApi } from '@/lib/api';
import { StockChart } from '@/components/Chart/StockChart';
import type { Timeframe, ScannerResult } from '@/types';
import styles from './page.module.css';

const TIMEFRAMES: Timeframe[] = ['1min', '5min', '15min', '1hour', '4hour', '1day'];

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) return <td className={styles.cell}>—</td>;
  const cls = value >= 0 ? styles.up : styles.down;
  return <td className={`${styles.cell} ${cls}`}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</td>;
}

export default function ScannerPage() {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<Timeframe>('1day');
  const [tickers, setTickers] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ScannerResult[]>([]);

  // Placeholder user_id — заменить на реальный из auth
  const USER_ID = 1;

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies', USER_ID],
    queryFn: () => strategiesApi.list(USER_ID),
  });

  const scanMutation = useMutation({
    mutationFn: (params: any) => scannerApi.scan(params),
    onSuccess: (data) => setResults(data),
  });

  function handleScan() {
    const strategy = strategies.find((s: any) => s.id === selectedStrategy);
    const tickerList = tickers.trim()
      ? tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : null;
    scanMutation.mutate({
      tickers: tickerList,
      timeframe,
      indicators: strategy?.indicators ?? {},
      limit: 50,
    });
  }

  function toggleMulti(ticker: string) {
    setMultiSelected(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Panel ── */}
      <aside className={styles.panel}>
        <h2 className={styles.panelTitle}>Скринер</h2>

        <div className={styles.field}>
          <label className={styles.label}>Стратегия</label>
          <select
            className={styles.select}
            value={selectedStrategy ?? ''}
            onChange={e => setSelectedStrategy(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Без стратегии —</option>
            {strategies.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Таймфрейм</label>
          <div className={styles.tfGroup}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                className={`${styles.tfBtn} ${timeframe === tf ? styles.tfActive : ''}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Тикеры (через запятую)</label>
          <input
            className={styles.input}
            placeholder="AAPL, MSFT, GOOGL"
            value={tickers}
            onChange={e => setTickers(e.target.value)}
          />
          <span className={styles.hint}>Пусто = S&P 500 (первые 100)</span>
        </div>

        <button className={styles.scanBtn} onClick={handleScan} disabled={scanMutation.isPending}>
          {scanMutation.isPending ? <><span className="spinner" /> Сканирую...</> : '🔍 Запустить скан'}
        </button>

        {multiSelected.length > 0 && (
          <button
            className={styles.multiBtn}
            onClick={() => router.push(`/multichart?tickers=${multiSelected.join(',')}`)}
          >
            📊 Multi-Chart ({multiSelected.length})
          </button>
        )}
      </aside>

      {/* ── Results ── */}
      <main className={styles.results}>
        {scanMutation.isError && (
          <div className={styles.error}>Ошибка скана: {(scanMutation.error as any)?.message}</div>
        )}

        {results.length > 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.resultsMeta}>
              Найдено: <strong>{results.length}</strong> акций •{' '}
              Подходят: <strong className={styles.matchCount}>{results.filter(r => r.matched).length}</strong>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Multi</th>
                  <th className={styles.th}>Тикер</th>
                  <th className={styles.th}>Цена</th>
                  <th className={styles.th}>Изм.%</th>
                  {results[0] && Object.keys(results[0].indicators).map(k => (
                    <th key={k} className={styles.th}>{k}</th>
                  ))}
                  <th className={styles.th}>Статус</th>
                  <th className={styles.th}>График</th>
                </tr>
              </thead>
              <tbody>
                {results.map(row => (
                  <tr key={row.ticker} className={`${styles.tr} ${row.matched ? styles.matched : ''}`}>
                    <td className={styles.cell}>
                      <input
                        type="checkbox"
                        checked={multiSelected.includes(row.ticker)}
                        onChange={() => toggleMulti(row.ticker)}
                      />
                    </td>
                    <td className={`${styles.cell} ${styles.ticker}`}>{row.ticker}</td>
                    <td className={styles.cell}>${row.price?.toFixed(2) ?? '—'}</td>
                    <ChangeCell value={row.change_pct} />
                    {Object.values(row.indicators).map((v, i) => (
                      <td key={i} className={styles.cell}>
                        {v !== null ? Number(v).toFixed(2) : '—'}
                      </td>
                    ))}
                    <td className={styles.cell}>
                      {row.matched ? <span className={styles.badge}>✅</span> : <span className={styles.badgeMiss}>❌</span>}
                    </td>
                    <td className={styles.cell}>
                      <button className={styles.chartBtn} onClick={() => router.push(`/chart/${row.ticker}`)}>
                        ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Настройте параметры слева и нажмите «Запустить скан»</p>
          </div>
        )}
      </main>
    </div>
  );
}
