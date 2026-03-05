import { useState } from 'react';
import styles from './IndicatorsModal.module.css';

export interface IndicatorConfig {
  id: string; // unique id
  type: 'SMA' | 'EMA' | 'RSI' | 'ADX' | 'HHLL' | 'ATR' | 'Alligator';
  period: number;
  color: string;
  botColor?: string; // Additional color field for dual-line indicators
  pane?: number; // 0 = main, 1 = pane 1 (bottom), 2 = pane 2 (bottom)
  source?: string; // 'close', 'open', 'high', 'low', or another indicator's ID
  visible?: boolean;
  lineWidth?: number;
  lineStyle?: number;
  offset?: number;
  upperBound?: number; // Top bound for RSI (e.g., 70)
  lowerBound?: number; // Bottom bound for RSI (e.g., 30)
  smoothing?: number;  // ADX Smoothing length
  smoothingType?: 'RMA' | 'SMA' | 'EMA' | 'WMA'; // Smoothing method for ATR, RSI, etc.
  topPeriod?: number;  // HHLL Top Band Lookback
  botPeriod?: number;  // HHLL Bot Band Lookback
  topSrc?: 'high' | 'low' | 'close'; // HHLL Top Source
  botSrc?: 'high' | 'low' | 'close'; // HHLL Bot Source

  // Alligator specific properties
  jawPeriod?: number;
  jawOffset?: number;
  jawColor?: string;
  teethPeriod?: number;
  teethOffset?: number;
  teethColor?: string;
  lipsPeriod?: number;
  lipsOffset?: number;
  lipsColor?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: Omit<IndicatorConfig, 'id'>) => void;
}

const INDICATOR_DESCRIPTIONS: Record<string, string> = {
  SMA: `Простая скользящая средняя (SMA) — один из самых базовых и популярных индикаторов технического анализа. Рассчитывается как среднее арифметическое цен закрытия за определённый период. Например, SMA(20) складывает цены закрытия за последние 20 свечей и делит на 20.

Назначение:
• Определение направления тренда — если цена выше SMA, тренд восходящий; ниже — нисходящий
• Уровни поддержки и сопротивления — цена часто отскакивает от линии SMA
• Сигналы пересечения — когда быстрая SMA пересекает медленную снизу вверх, это сигнал на покупку; сверху вниз — на продажу
• Сглаживание шума — помогает увидеть общую картину, отфильтровав случайные всплески

Типичные периоды: 20 (краткосрочный), 50 (среднесрочный), 200 (долгосрочный).`,

  EMA: `Экспоненциальная скользящая средняя (EMA) — усовершенствованная версия SMA, которая придаёт больший вес последним ценам. Благодаря этому EMA быстрее реагирует на изменения цены.

Формула: EMA = Цена × k + EMA(предыдущая) × (1 - k), где k = 2 / (Период + 1)

Назначение:
• Быстрое определение тренда — EMA раньше SMA показывает разворот
• Динамические уровни поддержки/сопротивления — цена чаще отскакивает от EMA, чем от SMA
• Торговые стратегии — пересечение EMA(12) и EMA(26) является основой MACD
• Подтверждение сигналов — используется вместе с другими индикаторами

Преимущество перед SMA: быстрее реагирует на резкие движения цены, но может давать больше ложных сигналов.`,

  RSI: `Индекс относительной силы (RSI) — осциллятор, измеряющий скорость и величину ценовых изменений. Значения RSI колеблются от 0 до 100.

Расчёт: RSI = 100 - (100 / (1 + RS)), где RS = среднее повышение / среднее понижение за период.

Интерпретация:
• RSI > 70 — зона перекупленности. Актив может быть переоценён, возможен разворот вниз
• RSI < 30 — зона перепроданности. Актив может быть недооценён, возможен разворот вверх
• RSI = 50 — нейтральная зона, без выраженного давления покупателей или продавцов

Сигналы:
• Дивергенция — если цена делает новый максимум, а RSI нет, это сигнал ослабления тренда
• Пересечение уровней 30/70 — классические сигналы на вход/выход
• Скрытая дивергенция — подтверждает продолжение тренда

Стандартный период: 14 свечей.`,

  ADX: `Средний направленный индекс (ADX) — индикатор, измеряющий СИЛУ тренда, а не его направление. Используется вместе с линиями +DI и -DI.

Компоненты:
• ADX (основная линия) — показывает силу тренда (от 0 до 100)
• +DI (положительная направленность) — сила движения вверх
• -DI (отрицательная направленность) — сила движения вниз

Интерпретация ADX:
• 0–20 — тренд отсутствует или очень слабый (боковик/флэт)
• 20–40 — развивающийся тренд
• 40–60 — сильный тренд
• 60–100 — очень сильный тренд (встречается редко)

Сигналы:
• +DI пересекает -DI снизу вверх — сигнал на покупку
• -DI пересекает +DI снизу вверх — сигнал на продажу
• ADX растёт — тренд усиливается, можно оставаться в позиции
• ADX падает — тренд ослабевает, стоит зафиксировать прибыль

Стандартные параметры: Период DI = 14, Сглаживание ADX = 14.`,

  HHLL: `Highest High / Lowest Low (HHLL) — индикатор, который отображает два канала: максимальный максимум (Highest High) и минимальный минимум (Lowest Low) за заданный период.

Назначение:
• Определение торгового канала — границы, в которых двигается цена
• Прорыв канала — выход цены за пределы HHLL сигнализирует о потенциальном сильном движении
• Оценка волатильности — ширина канала показывает текущую волатильность
• Установка стоп-лоссов — нижняя граница канала может служить уровнем для стоп-лосса

Параметры:
• Верхняя линия (зелёная) — максимальная цена за последние N свечей (источник: High)
• Нижняя линия (красная) — минимальная цена за последние N свечей (источник: Low)
• Периоды верхней и нижней линий могут быть разными

Стратегия прорыва: если цена закрывается выше Highest High — покупка; ниже Lowest Low — продажа.`,

  ATR: `Средний истинный диапазон (ATR) — индикатор волатильности, показывающий среднее отклонение цены за заданный период. Создан Уэллсом Уайлдером.

Расчёт True Range (истинный диапазон):
TR = максимум из трёх значений:
• High - Low (текущий диапазон свечи)
• |High - Close(пред.)| (гэп вверх)
• |Low - Close(пред.)| (гэп вниз)

ATR — это скользящее среднее TR за N периодов.

Назначение:
• Оценка волатильности — высокий ATR = высокая волатильность, низкий = спокойный рынок
• Установка стоп-лоссов — типичный стоп = 2 × ATR от цены входа
• Определение размера позиции — чем выше ATR, тем меньше размер позиции (риск-менеджмент)
• Фильтр ложных пробоев — прорыв считается значимым, если движение > 1 ATR

Методы сглаживания: RMA (по Уайлдеру, по умолчанию), SMA, EMA, WMA.
Стандартный период: 14 свечей.`,

  Alligator: `Аллигатор Билла Вильямса — трендовый индикатор, который состоит из трех сглаженных скользящих средних:
• Челюсть (Jaw, синяя линия) — 13-периодная SMMA, сдвинутая на 8 свечей в будущее
• Зубы (Teeth, красная линия) — 8-периодная SMMA, сдвинутая на 5 свечей в будущее
• Губы (Lips, зеленая линия) — 5-периодная SMMA, сдвинутая на 3 свечи в будущее

Интерпретация:
• Аллигатор "спит": Линии переплетены, тренда нет — не время для торговли.
• Аллигатор "просыпается": Губы (зеленая) первой реагирует на цену, затем Зубы (красная), затем Челюсть (синяя). Линии раскрываются веером.
• Аллигатор "ест": Расстояние между линиями растет, тренд сильный.
• Аллигатор "сыт": Линии снова начинают сходиться, фиксируйте прибыль.`
};

export function IndicatorsModal({ isOpen, onClose, onAdd }: Props) {
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSelect(type: 'SMA' | 'EMA' | 'RSI' | 'ADX' | 'HHLL' | 'ATR' | 'Alligator') {
    // Default configs for instantaneous addition
    let defaultColor = '#f0b429';
    let defaultBotColor: string | undefined = undefined;
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
      defaultColor = '#ef5350';
      defaultPeriod = 14;
      defaultPane = 2; // Usually placed in a separate pane from RSI
    } else if (type === 'HHLL') {
      defaultColor = '#3fb950'; // Green for top
      defaultBotColor = '#f44336'; // Red for bottom
      defaultPeriod = 20; // fallback, but we will use topPeriod/botPeriod
    } else if (type === 'ATR') {
      defaultColor = '#ec407a';
      defaultPeriod = 14;
      defaultPane = 1; // Put ATR in a separate pane
    } else if (type === 'Alligator') {
      defaultColor = '#2196f3'; // Jaw color
    } else {
      defaultColor = '#f0b429';
      defaultPeriod = 20;
    }

    onAdd({ 
      type, 
      period: defaultPeriod, 
      color: defaultColor, 
      botColor: defaultBotColor,
      pane: defaultPane, 
      source: type === 'Alligator' ? 'hl2' : 'close', 
      visible: true, 
      upperBound: defaultUpper, 
      lowerBound: defaultLower, 
      smoothing: type === 'ADX' ? 14 : undefined,
      smoothingType: type === 'ATR' ? 'RMA' : undefined,
      topPeriod: type === 'HHLL' ? 20 : undefined,
      botPeriod: type === 'HHLL' ? 20 : undefined,
      topSrc: type === 'HHLL' ? 'high' : undefined,
      botSrc: type === 'HHLL' ? 'low' : undefined,
      jawPeriod: type === 'Alligator' ? 13 : undefined,
      jawOffset: type === 'Alligator' ? 8 : undefined,
      jawColor: type === 'Alligator' ? '#1848bb' : undefined,
      teethPeriod: type === 'Alligator' ? 8 : undefined,
      teethOffset: type === 'Alligator' ? 5 : undefined,
      teethColor: type === 'Alligator' ? '#e2323e' : undefined,
      lipsPeriod: type === 'Alligator' ? 5 : undefined,
      lipsOffset: type === 'Alligator' ? 3 : undefined,
      lipsColor: type === 'Alligator' ? '#12aa52' : undefined,
    });
    onClose();
  }

  function toggleHelp(type: string) {
    setExpandedHelp(prev => prev === type ? null : type);
  }

  const indicators: { type: 'SMA' | 'EMA' | 'RSI' | 'ADX' | 'HHLL' | 'ATR' | 'Alligator'; label: string; short: string }[] = [
    { type: 'SMA', label: 'Простая скользящая средняя', short: 'SMA' },
    { type: 'EMA', label: 'Экспоненциальная скользящая средняя', short: 'EMA' },
    { type: 'RSI', label: 'Индекс относительной силы', short: 'RSI' },
    { type: 'ADX', label: 'Средний направленный индекс', short: 'ADX' },
    { type: 'HHLL', label: 'Highest High, Lowest Low', short: 'HHLL' },
    { type: 'ATR', label: 'Истинный средний диапазон', short: 'ATR' },
    { type: 'Alligator', label: 'Аллигатор Билла Вильямса', short: 'Alligator' },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Индикаторы, показатели и стратегии</h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <div className={styles.body} style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {indicators.map(ind => (
            <div key={ind.type} className={styles.indicatorItem}>
              <div className={styles.indicatorRow}>
                <button className={styles.listItemBtn} onClick={() => handleSelect(ind.type)}>
                  <span style={{ fontWeight: 600 }}>{ind.short}</span> ({ind.label})
                </button>
                <button
                  className={`${styles.helpBtn} ${expandedHelp === ind.type ? styles.helpBtnActive : ''}`}
                  onClick={() => toggleHelp(ind.type)}
                  title="Подробное описание"
                >
                  ?
                </button>
              </div>
              {expandedHelp === ind.type && (
                <div className={styles.helpPanel}>
                  {INDICATOR_DESCRIPTIONS[ind.type]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
