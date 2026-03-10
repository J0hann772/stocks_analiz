'use client';

import { useState } from 'react';
import { backtestApi } from '../../lib/api';
import { BacktestPanel, BacktestResult } from '../../components/Chart/BacktestPanel';
import styles from './page.module.css';

const ASSET_TYPES = [
  { value: 'Stocks', label: '📈 US Stocks' },
  { value: 'Crypto', label: '₿ Crypto 24/7' },
  { value: 'Forex', label: '💱 Forex' },
];

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3); // 3 months back
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function BacktestPage() {
  const defaults = getDefaultDates();
  const [symbol, setSymbol] = useState('AAPL');
  const [assetType, setAssetType] = useState('Stocks');
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await backtestApi.run(symbol.trim().toUpperCase(), assetType, fromDate, toDate);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Не удалось запустить бэктест');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>📊 Бэктестер — Стратегия Spring 4H/5m</h1>
        <p className={styles.subtitle}>
          Алгоритмическая стратегия скальпинга: коридор 4 часа → Spring 5m → вход с RR 1:2
        </p>
      </div>

      <form className={styles.form} onSubmit={handleRun}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Тикер</label>
            <input
              className={styles.input}
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL, BTCUSD, EURUSD..."
              spellCheck={false}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Тип актива</label>
            <div className={styles.typeGroup}>
              {ASSET_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.typeBtn} ${assetType === t.value ? styles.typeActive : ''}`}
                  onClick={() => setAssetType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Период с</label>
            <input
              type="date"
              className={styles.input}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>По</label>
            <input
              type="date"
              className={styles.input}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup} style={{ justifyContent: 'flex-end', alignSelf: 'flex-end' }}>
            <button type="submit" className={styles.runBtn} disabled={loading}>
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Расчёт...</>
              ) : (
                <>▶ Запустить бэктест</>
              )}
            </button>
          </div>
        </div>

        <div className={styles.hint}>
          <strong>Примечание:</strong> FMP API для 1-минутных данных предоставляет исторические данные
          за последние месяцы. Для акций US: коридор 06:00–10:00 EST, позиция закрывается до 15:59.
          Для Crypto/Forex: коридор 00:00–04:00 UTC.
        </div>
      </form>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚡</div>
          <h2>Готов к бэктесту</h2>
          <p>Введите тикер, выберите тип актива и период, затем нажмите «Запустить».</p>
          <div className={styles.examples}>
            <span className={styles.exLabel}>Примеры:</span>
            {['AAPL', 'TSLA', 'SPY', 'BTCUSD', 'EURUSD'].map(sym => (
              <button key={sym} className={styles.exBtn} onClick={() => setSymbol(sym)}>
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className={styles.resultWrap}>
          <BacktestPanel
            result={result}
            symbol={symbol}
            onClose={() => setResult(null)}
          />
        </div>
      )}
    </div>
  );
}
