import { useState, useEffect } from 'react';
import styles from './IndicatorsModal.module.css';
import type { IndicatorConfig } from './IndicatorsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorConfig | null;
  allIndicators: IndicatorConfig[];
  onSave: (updated: IndicatorConfig) => void;
}

export function IndicatorSettingsModal({ isOpen, onClose, indicator, allIndicators, onSave }: Props) {
  const [period, setPeriod] = useState(14);
  const [color, setColor] = useState('#ffffff');
  const [pane, setPane] = useState(0);
  const [source, setSource] = useState('close');

  // Reset form when indicator changes
  useEffect(() => {
    if (indicator) {
      setPeriod(indicator.period || 14);
      setColor(indicator.color || '#ffffff');
      setPane(indicator.pane || 0);
      setSource(indicator.source || 'close');
    }
  }, [indicator]);

  if (!isOpen || !indicator) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!indicator) return;
    onSave({
      ...indicator,
      period,
      color,
      pane,
      source
    });
    onClose();
  }

  // Find other indicators that can be used as sources
  // Basic rule: can't select itself as source
  const availableSources = allIndicators.filter(i => i.id !== indicator.id);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Настройки: {indicator.type}</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <form className={styles.body} style={{ padding: '20px', gap: '16px' }} onSubmit={handleSubmit}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Длина (Период)</label>
            <input 
              type="number" 
              value={period} 
              onChange={e => setPeriod(parseInt(e.target.value) || 1)} 
              min="1" 
              max="500" 
              style={{ padding: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Источник данных</label>
            <select 
              value={source} 
              onChange={e => setSource(e.target.value)}
              style={{ padding: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '4px' }}
            >
              <optgroup label="Базовые">
                <option value="close">Close (Закрытие)</option>
                <option value="open">Open (Открытие)</option>
                <option value="high">High (Максимум)</option>
                <option value="low">Low (Минимум)</option>
              </optgroup>
              {availableSources.length > 0 && (
                <optgroup label="Индикаторы">
                  {availableSources.map(src => (
                    <option key={src.id} value={src.id}>{src.type} {src.period}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Расположение (Панель)</label>
            <select 
              value={pane} 
              onChange={e => setPane(parseInt(e.target.value) || 0)}
              style={{ padding: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '4px' }}
            >
              <option value={0}>Основной график (сверху)</option>
              <option value={1}>Нижняя панель 1</option>
              <option value={2}>Нижняя панель 2</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Цвет</label>
            <input 
              type="color" 
              value={color} 
              onChange={e => setColor(e.target.value)} 
              style={{ height: '38px', width: '100%', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px', background: 'var(--color-surface-2)' }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Отмена</button>
            <button type="submit" style={{ background: 'var(--color-primary)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>OK</button>
          </div>
        </form>
      </div>
    </div>
  );
}
