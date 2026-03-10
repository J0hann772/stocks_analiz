import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import styles from './BacktestPanel.module.css';

interface Trade {
  entryTime: string;
  exitTime?: string;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  type: string;
  reason: string;
  corridorHigh: number;
  corridorLow: number;
  sl: number;
  tp: number;
}

interface Metrics {
  totalTrades: number;
  winRate: number;
  finalEquity: number;
  totalReturn: number;
}

// Actual backend response shape from SpringBacktester.run()
export interface BacktestResult {
  metrics: Metrics;
  trades: Trade[];
  equity: { time: string; value: number }[];
}

interface Props {
  result: BacktestResult;
  symbol: string;
  onClose: () => void;
  onTradeClick?: (trade: Trade) => void;
}

export function BacktestPanel({ result, symbol, onClose, onTradeClick }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current || !result.equity || result.equity.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b949e' },
      grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      timeScale: { borderColor: 'var(--color-border)', rightOffset: 5 },
      rightPriceScale: { borderColor: 'var(--color-border)' },
      height: 180,
    });
    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#29b6f6',
      topColor: 'rgba(41, 182, 246, 0.4)',
      bottomColor: 'rgba(41, 182, 246, 0.05)',
      lineWidth: 2,
    });

    const data = result.equity
      .map(d => ({
        time: d.time as any, // backend returns unix timestamp seconds here
        value: d.value,
      }))
      .sort((a, b) => a.time - b.time);
    areaSeries.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.resize(chartContainerRef.current.clientWidth, 180);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [result.equity]);

  const { metrics, trades } = result;

  return (
    <div className={`${styles.panel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span>Бэктест ({symbol})</span>
          <span className={styles.metric}>Win Rate: {metrics.winRate.toFixed(1)}%</span>
          <span className={styles.metric}>Trades: {metrics.totalTrades}</span>
          <span className={`${styles.metric} ${metrics.totalReturn >= 0 ? styles.metricUp : styles.metricDown}`}>
            PNL: ${metrics.totalReturn.toFixed(2)}
          </span>
          <span className={styles.metric}>Equity: ${metrics.finalEquity.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className={styles.toggleBtn} onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? 'Развернуть ▲' : 'Свернуть ▼'}
          </button>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.chartCol}>
          <h3>Equity Curve</h3>
          {(!result.equity || result.equity.length === 0)
            ? <div className={styles.emptyChart}>Нет сделок за период</div>
            : <div ref={chartContainerRef} className={styles.chartContainer} />
          }
        </div>

        <div className={styles.tableCol}>
          <h3>Сделки ({trades.length})</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Вход</th>
                  <th>Цена входа</th>
                  <th>Выход</th>
                  <th>Цена выхода</th>
                  <th>Причина</th>
                  <th>PNL ($)</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr
                    key={i}
                    className={t.pnl && t.pnl > 0 ? styles.win : (t.pnl && t.pnl < 0 ? styles.loss : '')}
                    onClick={() => onTradeClick?.(t)}
                  >
                    <td>{new Date(Number(t.entryTime) * 1000).toLocaleString('ru-RU')}</td>
                    <td>${t.entryPrice.toFixed(2)}</td>
                    <td>{t.exitTime ? new Date(Number(t.exitTime) * 1000).toLocaleString('ru-RU') : '-'}</td>
                    <td>{t.exitPrice !== undefined ? `$${t.exitPrice.toFixed(2)}` : '-'}</td>
                    <td>
                      <span className={t.reason === 'TP' ? styles.tp : t.reason === 'SL' ? styles.sl : styles.eod}>
                        {t.reason}
                      </span>
                    </td>
                    <td className={styles.pnlCol}>{t.pnl !== undefined ? t.pnl.toFixed(2) : '-'}</td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                      Нет сделок за выбранный период.<br />
                      <small>Попробуйте другой тикер.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
