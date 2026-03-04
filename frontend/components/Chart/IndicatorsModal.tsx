import { useState } from 'react';
import styles from './IndicatorsModal.module.css';

export interface IndicatorConfig {
  id: string; // unique id
  type: 'SMA' | 'EMA' | 'RSI' | 'ADX';
  period: number;
  color: string;
  pane?: number; // 0 = main, 1 = pane 1 (bottom), 2 = pane 2 (bottom)
  source?: string; // 'close', 'open', 'high', 'low', or another indicator's ID
  visible?: boolean;
  lineWidth?: number;
  lineStyle?: number;
  offset?: number;
  upperBound?: number; // Top bound for RSI (e.g., 70)
  lowerBound?: number; // Bottom bound for RSI (e.g., 30)
  smoothing?: number; // ADX Smoothing length
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: Omit<IndicatorConfig, 'id'>) => void;
}

const INFO_TEXT = {
  SMA: "Простая скользящая средняя (SMA) рассчитывает среднюю цену за выбранный период. Она помогает сгладить ценовые колебания и определить общее направление тренда.",
  EMA: "Экспоненциальная скользящая средняя (EMA) аналогична SMA, но придает больший вес последним ценам. Она быстрее реагирует на резкие изменения курса.",
  RSI: "Индекс относительной силы (RSI) — это осциллятор, который измеряет скорость и силу изменения цены. Значения выше 70 обычно говорят о перекупленности, а ниже 30 — о перепроданности.",
  ADX: "Средний направленный индекс (ADX) используется для измерения силы или слабости тренда, а не его направления."
};

export function IndicatorsModal({ isOpen, onClose, onAdd }: Props) {
  if (!isOpen) return null;

  function handleSelect(type: 'SMA' | 'EMA' | 'RSI' | 'ADX') {
    // Default configs for instantaneous addition
    let defaultColor = '#f0b429';
    let defaultPeriod = 14;
    let defaultPane = 0;
    let defaultUpper = undefined;
    let defaultLower = undefined;

    if (type === 'RSI') {
      defaultColor = '#7e57c2';
      defaultPane = 1; // Try to put RSI on bottom by default
      defaultUpper = 70;
      defaultLower = 30;
    } else if (type === 'EMA') {
      defaultColor = '#29b6f6';
      defaultPeriod = 20;
    } else if (type === 'ADX') {
      defaultColor = '#ef5350';
      defaultPeriod = 14;
      defaultPane = 2; // Usually placed in a separate pane from RSI
    } else {
      defaultColor = '#f0b429';
      defaultPeriod = 20;
    }

    onAdd({ type, period: defaultPeriod, color: defaultColor, pane: defaultPane, source: 'close', visible: true, upperBound: defaultUpper, lowerBound: defaultLower, smoothing: type === 'ADX' ? 14 : undefined });
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Индикаторы, показатели и стратегии</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <div className={styles.body} style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button className={styles.listItemBtn} onClick={() => handleSelect('SMA')}>
            <span style={{ fontWeight: 600 }}>SMA</span> (Простая скользящая средняя)
          </button>
          <button className={styles.listItemBtn} onClick={() => handleSelect('EMA')}>
            <span style={{ fontWeight: 600 }}>EMA</span> (Экспоненциальная скользящая средняя)
          </button>
          <button className={styles.listItemBtn} onClick={() => handleSelect('RSI')}>
            <span style={{ fontWeight: 600 }}>RSI</span> (Индекс относительной силы)
          </button>
          <button className={styles.listItemBtn} onClick={() => handleSelect('ADX')}>
            <span style={{ fontWeight: 600 }}>ADX</span> (Средний направленный индекс)
          </button>
        </div>
      </div>
    </div>
  );
}
