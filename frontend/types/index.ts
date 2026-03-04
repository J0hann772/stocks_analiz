// Базовые TypeScript типы для всего фронтенда

// ─── Auth ───────────────────────────────────────
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

// ─── Strategy ───────────────────────────────────
export type IndicatorName = 'RSI' | 'SMA' | 'EMA' | 'ADX';

export interface IndicatorParams {
  period: number;
  min?: number;
  max?: number;
}

export interface Strategy {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  indicators: Record<IndicatorName | string, IndicatorParams>;
  created_at: string;
}

export interface StrategyCreate {
  name: string;
  description?: string;
  indicators: Record<string, IndicatorParams>;
}

// ─── Scanner ────────────────────────────────────
export type Timeframe = '1min' | '5min' | '15min' | '30min' | '1hour' | '4hour' | '1day';

export interface ScannerParams {
  tickers: string[] | null;
  timeframe: Timeframe;
  indicators: Record<string, IndicatorParams>;
  limit: number;
}

export interface ScannerResult {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  indicators: Record<string, number | null>;
  matched: boolean;
}

// ─── Chart ──────────────────────────────────────
export interface OHLCVBar {
  time: string;    // 'YYYY-MM-DD' или unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text: string;
}

export type Theme = 'dark' | 'light';
