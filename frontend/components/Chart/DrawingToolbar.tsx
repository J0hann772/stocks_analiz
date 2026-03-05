'use client';

import React from 'react';
import type { DrawingToolType } from './DrawingTools.types';
import styles from './DrawingToolbar.module.css';

interface Props {
  activeTool: DrawingToolType;
  onToolChange: (tool: DrawingToolType) => void;
  onClearAll: () => void;
  onSyncRun: () => void;
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// SVG-иконки для каждого инструмента
function CursorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  );
}

function HLineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function TrendLineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="20" x2="20" y2="4" />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" />
      <circle cx="20" cy="4" r="1.5" fill="currentColor" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <line x1="7" y1="6" x2="7" y2="10" />
      <line x1="11" y1="6" x2="11" y2="10" />
      <line x1="15" y1="6" x2="15" y2="10" />
      <line x1="19" y1="6" x2="19" y2="10" />
    </svg>
  );
}

function SLTPIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="7" rx="1" stroke="#3fb950" />
      <rect x="4" y="14" width="16" height="7" rx="1" stroke="#f44336" />
      <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4z" />
      <path d="M9 14c-2.5 2-4 4-4 6 0 1 1 2 2 2s2-.5 3-1c1-.5 2-1.5 3-3" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z" />
      <line x1="18" y1="11" x2="8" y2="21" />
    </svg>
  );
}

const TOOLS: { type: DrawingToolType; icon: React.ReactNode; label: string }[] = [
  { type: 'cursor', icon: <CursorIcon />, label: 'Курсор' },
  { type: 'hline', icon: <HLineIcon />, label: 'Горизонтальная линия' },
  { type: 'trendline', icon: <TrendLineIcon />, label: 'Трендовая линия' },
  { type: 'ruler', icon: <RulerIcon />, label: 'Линейка (one-shot)' },
  { type: 'sltp', icon: <SLTPIcon />, label: 'Стоп-Лосс / Тейк-Профит' },
  { type: 'brush', icon: <BrushIcon />, label: 'Кисточка (свободное рисование)' },
  { type: 'eraser', icon: <EraserIcon />, label: 'Ластик (Удаление фигур)' },
];

export function DrawingToolbar({ activeTool, onToolChange, onClearAll, onSyncRun }: Props) {
  return (
    <div className={styles.toolbar}>
      {TOOLS.map(tool => (
        <button
          key={tool.type}
          className={`${styles.toolBtn} ${activeTool === tool.type ? styles.active : ''}`}
          onClick={() => onToolChange(tool.type)}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <div className={styles.separator} />
      <button
        className={styles.toolBtn}
        onClick={onSyncRun}
        title="Синхронизировать (загрузить с сервера)"
      >
        <SyncIcon />
      </button>
      <button
        className={styles.toolBtn}
        onClick={onClearAll}
        title="Очистить все рисунки"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
