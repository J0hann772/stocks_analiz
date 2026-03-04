'use client';

import React, { useState } from 'react';
import type { Timeframe } from '@/types';
import styles from './ChartToolbar.module.css';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1H', value: '1hour' },
  { label: '4H', value: '4hour' },
  { label: '1D', value: '1day' },
];

import { IndicatorsModal, IndicatorConfig } from './IndicatorsModal';

interface Props {
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeIndicators: IndicatorConfig[];
  onAddIndicator: (ind: Omit<IndicatorConfig, 'id'>) => void;
  onRemoveIndicator: (id: string) => void;
  onSymbolChange?: (symbol: string) => void;
  onFullscreen?: () => void;
}

export function ChartToolbar({
  symbol,
  timeframe,
  onTimeframeChange,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onSymbolChange,
  onFullscreen,
}: Props) {
  const [inputSymbol, setInputSymbol] = useState(symbol);
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleSymbolSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSymbolChange?.(inputSymbol.toUpperCase());
  }

  return (
    <div className={styles.toolbar}>
      {/* Ticker input */}
      <form onSubmit={handleSymbolSubmit} className={styles.tickerForm}>
        <input
          className={styles.tickerInput}
          value={inputSymbol}
          onChange={e => setInputSymbol(e.target.value.toUpperCase())}
          placeholder="AAPL"
          spellCheck={false}
        />
      </form>

      <div className={styles.divider} />

      {/* Timeframe switcher */}
      <div className={styles.tfGroup}>
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            className={`${styles.tfBtn} ${timeframe === tf.value ? styles.tfActive : ''}`}
            onClick={() => onTimeframeChange(tf.value)}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      {/* Indicators */}
      <div className={styles.indGroup}>
        <button 
          className={styles.indBtn} 
          onClick={() => setIsModalOpen(true)}
          style={{ background: 'var(--color-primary)', color: 'white', border: 'none', opacity: 0.9 }}
        >
          + Индикаторы
        </button>
      </div>

      <IndicatorsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={onAddIndicator} 
      />

      <div className={styles.spacer} />

      {/* Fullscreen */}
      {onFullscreen && (
        <button className={styles.iconBtn} onClick={onFullscreen} title="Полный экран">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      )}
    </div>
  );
}
