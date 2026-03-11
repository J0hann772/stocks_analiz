'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface CriteriaResult {
  drop_70_95: boolean;
  flat_range: boolean;
  buyout_candles: boolean;
  low_volume: boolean;
  insider_ownership: boolean;
}

interface FormationResult {
  symbol: string;
  score: number;
  badge: 'green' | 'yellow' | 'orange';
  list_type: 'top' | 'watch';
  criteria: CriteriaResult;
  details: {
    drop_pct?: number;
    flat_days?: number;
    buyout_candles?: number;
    vol_ratio?: number;
    insider_pct?: number;
    current_price?: number;
  };
  scanned_at: string;
}

interface ScanData {
  top: FormationResult[];
  watch: FormationResult[];
  scanned_total: number;
  scanned_at: string | null;
}

const CRITERIA_LABELS: Record<keyof CriteriaResult, string> = {
  drop_70_95:        'Падение 70-95%',
  flat_range:        'Боков. диапазон',
  buyout_candles:    'Свечи выкупа',
  low_volume:        'Низкий объём',
  insider_ownership: 'Инсайдеры ≥18%',
};

const BADGE_COLOR: Record<string, string> = {
  green:  '#3fb950',
  yellow: '#f0b429',
  orange: '#fb8c00',
};

function CriteriaCell({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? '#3fb950' : '#f85149', fontWeight: 700 }}>{ok ? '✅' : '❌'}</span>;
}

function ScoreBadge({ score, badge }: { score: number; badge: string }) {
  const color = BADGE_COLOR[badge] || '#8b949e';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: `${color}22`, color,
      border: `1px solid ${color}66`,
      borderRadius: '12px', padding: '2px 10px', fontWeight: 700, fontSize: '12px',
    }}>
      {score}/5
    </span>
  );
}

export default function FormationScannerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'top' | 'watch'>('top');
  const [scanData, setScanData] = useState<ScanData>({ top: [], watch: [], scanned_total: 0, scanned_at: null });
  const [progress, setProgress] = useState<{ status: string; pct: number; processed: number; total: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Загружаем кэшированные результаты при монтировании
  useEffect(() => {
    fetchResults();
  }, []);

  async function fetchResults() {
    try {
      const res = await fetch(`${API}/api/v1/formation-scanner/results`);
      const data: ScanData = await res.json();
      setScanData(data);
      if (data.scanned_at) {
        setLastUpdated(new Date(data.scanned_at).toLocaleString('ru-RU'));
      }
    } catch (e) {
      console.error('Failed to fetch results', e);
    }
  }

  async function startScan() {
    setIsScanning(true);
    setProgress({ status: 'starting', pct: 0, processed: 0, total: 0 });

    try {
      const res = await fetch(`${API}/api/v1/formation-scanner/run`, { method: 'POST' });
      const { job_id } = await res.json();

      // Поллим прогресс
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${API}/api/v1/formation-scanner/status/${job_id}`);
          const data = await pr.json();
          setProgress(data);

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollRef.current!);
            setIsScanning(false);
            if (data.status === 'completed') {
              await fetchResults();
            }
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch (e) {
      console.error('Scan start failed', e);
      setIsScanning(false);
    }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const displayList = tab === 'top' ? scanData.top : scanData.watch;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🔍 Сканер формаций</h1>
          <p className={styles.subtitle}>
            Поиск акций США с падением 70-95% в боковом коридоре — потенциальные разворотные кандидаты
          </p>
        </div>
        <div className={styles.headerActions}>
          {lastUpdated && (
            <span className={styles.lastUpdated}>Обновлено: {lastUpdated}</span>
          )}
          <button
            className={styles.scanBtn}
            onClick={startScan}
            disabled={isScanning}
            id="start-scan-btn"
          >
            {isScanning ? '⏳ Сканирую...' : '🚀 Запустить скан'}
          </button>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {isScanning && progress && (
        <div className={styles.progressWrap}>
          <div className={styles.progressHeader}>
            <span>Проверено: <strong>{progress.processed}</strong> из <strong>{progress.total || '...'}</strong></span>
            <span>{progress.pct || 0}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress.pct || 0}%` }} />
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'top' ? styles.tabActive : ''}`}
          onClick={() => setTab('top')}
        >
          🟢 Лучшие
          <span className={styles.tabCount}>{scanData.top.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'watch' ? styles.tabActive : ''}`}
          onClick={() => setTab('watch')}
        >
          🟡 На наблюдении
          <span className={styles.tabCount}>{scanData.watch.length}</span>
        </button>
      </div>

      {/* ── Empty State ── */}
      {displayList.length === 0 && !isScanning && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <p>Нет данных. Нажмите «Запустить скан», чтобы сканировать весь рынок US.</p>
          <p className={styles.emptyHint}>Сканирование ~500 акций занимает ~3-5 минут.</p>
        </div>
      )}

      {/* ── Table ── */}
      {displayList.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Тикер</th>
                <th className={styles.th}>Цена</th>
                <th className={styles.th}>Оценка</th>
                {(Object.keys(CRITERIA_LABELS) as (keyof CriteriaResult)[]).map(key => (
                  <th key={key} className={styles.th}>{CRITERIA_LABELS[key]}</th>
                ))}
                <th className={styles.th}>Детали</th>
                <th className={styles.th}>График</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(row => (
                <tr key={row.symbol} className={styles.tr}>
                  <td className={`${styles.cell} ${styles.ticker}`}>
                    <strong>{row.symbol}</strong>
                  </td>
                  <td className={styles.cell}>
                    ${row.details.current_price?.toFixed(2) ?? '—'}
                  </td>
                  <td className={styles.cell}>
                    <ScoreBadge score={row.score} badge={row.badge} />
                  </td>
                  {(Object.keys(CRITERIA_LABELS) as (keyof CriteriaResult)[]).map(key => (
                    <td key={key} className={styles.cell} style={{ textAlign: 'center' }}>
                      <CriteriaCell ok={row.criteria[key]} />
                    </td>
                  ))}
                  <td className={styles.cell}>
                    <div className={styles.detailsCell}>
                      <span title="Падение от максимума">📉 {row.details.drop_pct?.toFixed(0) ?? '—'}%</span>
                      <span title="Дней в боковике">📅 {row.details.flat_days ?? '—'} дн</span>
                      <span title="Доля инсайдеров">👔 {row.details.insider_pct?.toFixed(0) ?? '—'}%</span>
                    </div>
                  </td>
                  <td className={styles.cell}>
                    <button
                      className={styles.chartBtn}
                      onClick={() => router.push(`/chart/${row.symbol}`)}
                      title={`Открыть график ${row.symbol}`}
                    >
                      ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
