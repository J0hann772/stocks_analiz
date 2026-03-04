import { useState, useEffect } from 'react';
import styles from './IndicatorSettings.module.css';
import type { IndicatorConfig } from './IndicatorsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorConfig | null;
  allIndicators: IndicatorConfig[];
  onSave: (updated: IndicatorConfig) => void;
}

type TabKey = 'arguments' | 'style' | 'visibility';

export function IndicatorSettingsModal({ isOpen, onClose, indicator, allIndicators, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('arguments');
  const [period, setPeriod] = useState(14);
  const [color, setColor] = useState('#7e57c2');
  const [botColor, setBotColor] = useState('#f44336');
  const [pane, setPane] = useState(0);
  const [source, setSource] = useState('close');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [upperBound, setUpperBound] = useState(70);
  const [lowerBound, setLowerBound] = useState(30);
  const [smoothing, setSmoothing] = useState(14);
  const [topPeriod, setTopPeriod] = useState(20);
  const [botPeriod, setBotPeriod] = useState(20);
  const [topSrc, setTopSrc] = useState('high');
  const [botSrc, setBotSrc] = useState('low');
  const [smoothingType, setSmoothingType] = useState<'RMA' | 'SMA' | 'EMA' | 'WMA'>('RMA');

  useEffect(() => {
    if (indicator) {
      setPeriod(indicator.period || 14);
      setColor(indicator.color || '#7e57c2');
      setBotColor(indicator.botColor || '#f44336');
      setPane(indicator.pane || 0);
      setSource(indicator.source || 'close');
      setActiveTab('arguments');
      setOffset(indicator.offset || 0);
      setLineWidth(indicator.lineWidth || 2);
      setLineStyle(indicator.lineStyle || 0);
      setIsVisible(indicator.visible !== false);
      if (indicator.type === 'RSI') {
        setUpperBound(indicator.upperBound !== undefined ? indicator.upperBound : 70);
        setLowerBound(indicator.lowerBound !== undefined ? indicator.lowerBound : 30);
      }
      if (indicator.type === 'ADX') {
        setSmoothing(indicator.smoothing !== undefined ? indicator.smoothing : 14);
      }
      if (indicator.type === 'HHLL') {
        setTopPeriod(indicator.topPeriod !== undefined ? indicator.topPeriod : 20);
        setBotPeriod(indicator.botPeriod !== undefined ? indicator.botPeriod : 20);
        setTopSrc(indicator.topSrc || 'high');
        setBotSrc(indicator.botSrc || 'low');
        setPeriod(indicator.topPeriod !== undefined ? indicator.topPeriod : 20);
      }
      if (indicator.type === 'ATR' || indicator.type === 'RSI' || indicator.type === 'ADX') {
        setSmoothingType(indicator.smoothingType || 'RMA');
      }
    }
  }, [indicator]);

  if (!isOpen || !indicator) return null;

  function handleSave() {
    if (!indicator) return;
    onSave({ 
      ...indicator, 
      period, color, botColor, pane, source,
      lineWidth, lineStyle, offset,
      visible: isVisible,
      upperBound: indicator.type === 'RSI' ? upperBound : undefined,
      lowerBound: indicator.type === 'RSI' ? lowerBound : undefined,
      smoothing: indicator.type === 'ADX' ? smoothing : undefined,
      topPeriod: indicator.type === 'HHLL' ? topPeriod : undefined,
      botPeriod: indicator.type === 'HHLL' ? botPeriod : undefined,
      topSrc: indicator.type === 'HHLL' ? (topSrc as any) : undefined,
      botSrc: indicator.type === 'HHLL' ? (botSrc as any) : undefined,
      smoothingType: ['ATR', 'RSI', 'ADX'].includes(indicator.type) ? smoothingType : undefined,
    });
    onClose();
  }

  function handleReset() {
    if (!indicator) return;
    if (indicator.type === 'RSI') {
      setPeriod(14); setColor('#7e57c2'); setSource('close'); setPane(1);
      setUpperBound(70); setLowerBound(30);
    } else if (indicator.type === 'EMA') {
      setPeriod(20); setColor('#29b6f6'); setSource('close'); setPane(0);
    } else if (indicator.type === 'ADX') {
      setPeriod(14); setSmoothing(14); setColor('#ef5350'); setSource('close'); setPane(2);
    } else if (indicator.type === 'HHLL') {
      setTopPeriod(20); setBotPeriod(20); setTopSrc('high'); setBotSrc('low'); setColor('#3fb950'); setBotColor('#f44336'); setPane(0); setPeriod(20);
    } else if (indicator.type === 'ATR') {
      setPeriod(14); setColor('#ec407a'); setSource('close'); setPane(1); setSmoothingType('RMA');
    } else {
      setPeriod(20); setColor('#f0b429'); setSource('close'); setPane(0);
    }
    setLineWidth(2); setLineStyle(0); setOffset(0); setIsVisible(true);
  }

  const availableSources = allIndicators.filter(i => i.id !== indicator?.id);
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'arguments', label: 'Аргументы' },
    { key: 'style', label: 'Стиль' },
    { key: 'visibility', label: 'Видимость' },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>{indicator.type}</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={styles.body}>
          {activeTab === 'arguments' && (
            <div className={styles.fields}>
              {indicator.type !== 'HHLL' ? (
                <div className={styles.field}>
                  <label className={styles.label}>{indicator.type === 'ADX' ? 'DI Длина' : 'Длина'}</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={period}
                    onChange={e => setPeriod(parseInt(e.target.value) || 1)}
                    min="1" max="500"
                  />
                </div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Top Band Lookback</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={topPeriod}
                      onChange={e => setTopPeriod(parseInt(e.target.value) || 1)}
                      min="1" max="500"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Bot Band Lookback</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={botPeriod}
                      onChange={e => setBotPeriod(parseInt(e.target.value) || 1)}
                      min="1" max="500"
                    />
                  </div>
                </>
              )}

              {indicator.type === 'ADX' && (
                <div className={styles.field}>
                  <label className={styles.label}>Сглаживание ADX</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={smoothing}
                    onChange={e => setSmoothing(parseInt(e.target.value) || 1)}
                    min="1" max="500"
                  />
                </div>
              )}

              {['ATR', 'RSI', 'ADX'].includes(indicator.type) && (
                <div className={styles.field}>
                  <label className={styles.label}>Сглаживание</label>
                  <select
                    className={styles.select}
                    value={smoothingType}
                    onChange={e => setSmoothingType(e.target.value as any)}
                  >
                    <option value="RMA">Без учёта скользящих средних (RMA)</option>
                    <option value="SMA">Простое скользящее среднее (SMA)</option>
                    <option value="EMA">Экспоненциальное скользящее среднее (EMA)</option>
                    <option value="WMA">Взвешенное скользящее среднее (WMA)</option>
                  </select>
                </div>
              )}

              {indicator.type !== 'HHLL' ? (
                <div className={styles.field}>
                  <label className={styles.label}>Данные</label>
                  <select
                    className={styles.select}
                    value={source}
                    disabled={indicator.type === 'ADX' || indicator.type === 'ATR'}
                    onChange={e => setSource(e.target.value)}
                  >
                    <option value="atr">ATR</option>
                    <option value="close">Close</option>
                    <option value="open">Open</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    {availableSources.map(src => (
                      <option key={src.id} value={src.id}>{src.type} {src.period}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>TopSrc</label>
                    <select
                      className={styles.select}
                      value={topSrc}
                      onChange={e => setTopSrc(e.target.value)}
                    >
                      <option value="high">Максимум (High)</option>
                      <option value="low">Минимум (Low)</option>
                      <option value="close">Закрытие (Close)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>BotSrc</label>
                    <select
                      className={styles.select}
                      value={botSrc}
                      onChange={e => setBotSrc(e.target.value)}
                    >
                      <option value="high">Максимум (High)</option>
                      <option value="low">Минимум (Low)</option>
                      <option value="close">Закрытие (Close)</option>
                    </select>
                  </div>
                </>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Отступ</label>
                <input
                  type="number"
                  className={styles.input}
                  value={offset}
                  onChange={e => setOffset(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className={styles.separator} />

              {indicator.type === 'RSI' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Верхняя граница (Overbought)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={upperBound}
                      onChange={e => setUpperBound(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Нижняя граница (Oversold)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={lowerBound}
                      onChange={e => setLowerBound(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className={styles.separator} />
                </>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Расположение</label>
                <select
                  className={styles.select}
                  value={pane}
                  onChange={e => setPane(parseInt(e.target.value) || 0)}
                >
                  <option value={0}>Основной график</option>
                  <option value={1}>Нижняя панель 1</option>
                  <option value={2}>Нижняя панель 2</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>{indicator.type === 'HHLL' ? 'Цвет верхней линии' : 'Цвет линии'}</label>
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    className={styles.colorPicker}
                    value={color}
                    onChange={e => setColor(e.target.value)}
                  />
                  <span className={styles.colorHex}>{color}</span>
                </div>
              </div>

              {indicator.type === 'HHLL' && (
                <div className={styles.field}>
                  <label className={styles.label}>Цвет нижней линии</label>
                  <div className={styles.colorRow}>
                    <input
                      type="color"
                      className={styles.colorPicker}
                      value={botColor}
                      onChange={e => setBotColor(e.target.value)}
                    />
                    <span className={styles.colorHex}>{botColor}</span>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Тип линии</label>
                <select
                  className={styles.select}
                  value={lineStyle}
                  onChange={e => setLineStyle(parseInt(e.target.value))}
                >
                  <option value={0}>Сплошная ────</option>
                  <option value={2}>Пунктир - - - -</option>
                  <option value={1}>Точечная · · · ·</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Толщина линии</label>
                <input
                  type="range"
                  className={styles.rangeInput}
                  min="1" max="5" step="1"
                  value={lineWidth}
                  onChange={e => setLineWidth(parseInt(e.target.value))}
                />
                <span className={styles.rangeValue}>{lineWidth}px</span>
              </div>
            </div>
          )}

          {activeTab === 'visibility' && (
            <div className={styles.fields}>
              <div className={styles.visibilityItem}>
                <label className={styles.checkLabel}>
                  <input 
                    type="checkbox" 
                    checked={isVisible}
                    onChange={e => setIsVisible(e.target.checked)}
                    className={styles.checkbox} 
                  />
                  <span>Видимость на графике</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>
            По умол. ↺
          </button>
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button className={styles.okBtn} onClick={handleSave}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
