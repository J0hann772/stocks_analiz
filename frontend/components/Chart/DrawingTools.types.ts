// Типы для инструментов рисования на графике

export type DrawingToolType = 'cursor' | 'hline' | 'trendline' | 'ruler' | 'sltp' | 'brush' | 'eraser';

// Точка в координатах графика (цена + время)
export interface ChartPoint {
  price: number;
  time: string | number; // lightweight-charts time format
  x: number; // pixel coordinate (for rendering)
  y: number; // pixel coordinate (for rendering)
}

// Базовый интерфейс нарисованного объекта
export interface DrawnObject {
  id: string;
  type: DrawingToolType;
  points: ChartPoint[];
  color: string;
  lineWidth?: number;
}

// Горизонтальная линия
export interface HLineObject extends DrawnObject {
  type: 'hline';
  // points[0].price = уровень цены
}

// Трендовая линия
export interface TrendLineObject extends DrawnObject {
  type: 'trendline';
  // points[0] = начало, points[1] = конец
}

// Линейка (измерительный прямоугольник)
export interface RulerObject extends DrawnObject {
  type: 'ruler';
  // points[0] = начало, points[1] = конец
  info?: {
    priceDiff: number;
    pctChange: number;
    bars: number;
  };
}

// Stop-Loss / Take-Profit
export interface SLTPObject extends DrawnObject {
  type: 'sltp';
  // points[0] = entry, points[1] = TP level, points[2] = SL level
  entryPrice?: number;
  tpPrice?: number;
  slPrice?: number;
}

// Кисточка (свободное рисование)
export interface BrushObject extends DrawnObject {
  type: 'brush';
  // points[] = массив точек для свободной линии
}
