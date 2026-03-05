'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { strategiesApi } from '../../lib/api';
import type { Timeframe } from '../../types';
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
  onLoadPreset: (inds: IndicatorConfig[]) => void;
}

const USER_ID = 1; // TODO: get from auth context

export function ChartToolbar({
  symbol,
  timeframe,
  onTimeframeChange,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onSymbolChange,
  onFullscreen,
  onLoadPreset,
}: Props) {
  const [inputSymbol, setInputSymbol] = useState(symbol);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [presetName, setPresetName] = useState('');
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const queryClient = useQueryClient();

  // Fetch presets
  const { data: strategies = [], isLoading: loadingStrategies } = useQuery({
    queryKey: ['strategies', USER_ID],
    queryFn: () => strategiesApi.list(USER_ID),
  });

  // Save preset mutation
  const saveMutation = useMutation({
    mutationFn: (name: string) => 
      strategiesApi.create(USER_ID, {
        name,
        description: 'Saved Chart Preset',
        indicators: { configs: activeIndicators }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies', USER_ID] });
      setPresetName('');
    },
    onError: () => alert('Ошибка при сохранении пресета')
  });

  // Delete preset mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => strategiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies', USER_ID] });
    },
    onError: () => alert('Ошибка при удалении пресета')
  });

  function handleSymbolSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSymbolChange?.(inputSymbol.toUpperCase());
  }

  function handleSavePreset() {
    if (!presetName.trim()) {
      alert('Введите название пресета');
      return;
    }
    saveMutation.mutate(presetName);
  }

  function handleLoadPreset(strategyId: number) {
    if (!strategyId) return;
    
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy && strategy.indicators && strategy.indicators.configs) {
      onLoadPreset(strategy.indicators.configs);
    }
    setIsPresetDropdownOpen(false);
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

      <div className={styles.divider} />

      {/* Presets */}
      <div className={styles.presetGroup}>
        <input 
          className={styles.presetInput}
          placeholder="Имя пресета"
          value={presetName}
          onChange={e => setPresetName(e.target.value)}
        />
        <button 
          className={styles.presetBtn}
          onClick={handleSavePreset}
          disabled={saveMutation.isPending || loadingStrategies}
        >
          {saveMutation.isPending ? '...' : 'Сохранить пресет'}
        </button>
        <div className={styles.presetDropdown} ref={presetDropdownRef}>
          <button
            className={styles.presetSelect}
            onClick={() => setIsPresetDropdownOpen(prev => !prev)}
            disabled={loadingStrategies}
          >
            Загрузить пресет...
            <span className={styles.presetChevron}>&#9660;</span>
          </button>
          {isPresetDropdownOpen && strategies.length > 0 && (
            <div className={styles.presetMenu}>
              {strategies.map(s => (
                <div key={s.id} className={styles.presetMenuItem}>
                  <button
                    className={styles.presetMenuBtn}
                    onClick={() => handleLoadPreset(s.id)}
                  >
                    {s.name}
                  </button>
                  <button
                    className={styles.presetDeleteBtn}
                    title="Удалить пресет"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить пресет "${s.name}"?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
