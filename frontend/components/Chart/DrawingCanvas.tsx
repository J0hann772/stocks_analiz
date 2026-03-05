'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { DrawingToolType, DrawnObject, ChartPoint } from './DrawingTools.types';

interface Props {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<any> | null;
  activeTool: DrawingToolType;
  drawings: DrawnObject[];
  onAddDrawing: (drawing: DrawnObject) => void;
  onRemoveDrawing: (id: string) => void;
  onUpdateDrawing: (updated: DrawnObject) => void;
  onToolComplete: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  data: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
}

let drawingIdCounter = 0;
function nextId() {
  return `drawing_${++drawingIdCounter}_${Date.now()}`;
}

export function DrawingCanvas({
  chartApi,
  seriesApi,
  activeTool,
  drawings,
  onAddDrawing,
  onRemoveDrawing,
  onUpdateDrawing,
  onToolComplete,
  containerRef,
  data,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempPointsRef = useRef<ChartPoint[]>([]);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const dprRef = useRef<number>(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  // Drag state refs
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef<{ id: string; pointIndex: number } | null>(null);

  // Brush state refs
  const isBrushingRef = useRef(false);
  const brushPointsRef = useRef<ChartPoint[]>([]);

  // Pixel → Chart coords
  const pixelToChart = useCallback((px: number, py: number): ChartPoint | null => {
    if (!chartApi || !seriesApi) return null;
    try {
      const timeScale = chartApi.timeScale();
      const logicalIndex = timeScale.coordinateToLogical(px);
      if (logicalIndex === null) return null;
      const price = seriesApi.coordinateToPrice(py);
      if (price === null) return null;
      const roundedIndex = Math.round(logicalIndex);
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (!visibleRange) return null;
      let time: string | number = '';
      if (data.length > 0 && roundedIndex >= 0 && roundedIndex < data.length) {
        time = data[roundedIndex].time;
      } else {
        time = roundedIndex;
      }
      return { price: price as number, time, x: px, y: py };
    } catch {
      return null;
    }
  }, [chartApi, seriesApi, data]);

  // Chart coords → Pixel
  const chartToPixel = useCallback((point: ChartPoint): { x: number; y: number } | null => {
    if (!chartApi || !seriesApi) return null;
    try {
      const timeScale = chartApi.timeScale();
      const y = seriesApi.priceToCoordinate(point.price);
      if (y === null) return null;
      
      let targetTime = point.time;
      if (data && data.length > 0) {
        const targetMs = typeof targetTime === 'number' ? targetTime * 1000 : new Date(targetTime as string).getTime();
        let minDiff = Infinity;
        for (let i = 0; i < data.length; i++) {
          const dTime = data[i].time as any;
          const dMs = typeof dTime === 'number' ? dTime * 1000 : new Date(dTime).getTime();
          const diff = Math.abs(dMs - targetMs);
          if (diff < minDiff) {
            minDiff = diff;
            targetTime = dTime;
          } else if (dMs > targetMs) {
            break; // так как данные отсортированы по времени
          }
        }
      }

      const x = timeScale.timeToCoordinate(targetTime as any);
      // Если время вне зоны (null) — мы не должны фоллбечиться на старый пиксель x.
      // Возвращаем null, чтобы точка не рисовалась.
      if (x === null) return null;
      
      return { x: x as number, y: y as number };
    } catch {
      return null;
    }
  }, [chartApi, seriesApi, data]);

  // ——— Drawing loop ———
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale for HiDPI
    ctx.clearRect(0, 0, w, h);

    drawings.forEach(obj => drawObject(ctx, obj, w, h));

    // Brush in-progress (real-time freehand preview)
    if (isBrushingRef.current && brushPointsRef.current.length > 0) {
      ctx.strokeStyle = '#f0b429';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const pts = brushPointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    const tempPoints = tempPointsRef.current;
    const mousePos = mousePosRef.current;
    if (activeTool !== 'cursor' && activeTool !== 'brush' && mousePos) {
      drawTempObject(ctx, activeTool, tempPoints, mousePos, w, h);
    }

    ctx.restore();

    // NOTE: pointerEvents and cursor are handled by JSX style prop, not here

    rafRef.current = requestAnimationFrame(draw);
  }, [drawings, activeTool, chartApi, seriesApi]);

  // ——— Draw saved objects ———
  function drawObject(ctx: CanvasRenderingContext2D, obj: DrawnObject, w: number, _h: number) {
    ctx.lineWidth = obj.lineWidth || 2;

    if (obj.type === 'hline') {
      const p = chartToPixel(obj.points[0]);
      if (!p) return;
      ctx.strokeStyle = obj.color;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(w, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Price label
      const priceText = obj.points[0].price.toFixed(2);
      ctx.font = '600 11px "Inter", "SF Mono", monospace';
      const tw = ctx.measureText(priceText).width;
      ctx.fillStyle = obj.color;
      ctx.fillRect(w - tw - 14, p.y - 10, tw + 10, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(priceText, w - tw - 9, p.y + 4);
    }

    if (obj.type === 'trendline') {
      if (obj.points.length < 2) return;
      const p1 = chartToPixel(obj.points[0]);
      const p2 = chartToPixel(obj.points[1]);
      if (!p1 || !p2) return;
      ctx.strokeStyle = obj.color;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      [p1, p2].forEach(p => {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (obj.type === 'ruler') {
      if (obj.points.length < 2) return;
      const p1 = chartToPixel(obj.points[0]);
      const p2 = chartToPixel(obj.points[1]);
      if (!p1 || !p2) return;
      const isUp = obj.points[1].price > obj.points[0].price;
      const bgColor = isUp ? 'rgba(63, 185, 80, 0.18)' : 'rgba(244, 67, 54, 0.18)';
      const borderColor = isUp ? '#3fb950' : '#f44336';
      // Rectangle
      ctx.fillStyle = bgColor;
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      ctx.strokeStyle = borderColor;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      ctx.setLineDash([]);
      // Info label
      const priceDiff = obj.points[1].price - obj.points[0].price;
      const pctChange = (priceDiff / obj.points[0].price) * 100;
      const label = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)}  (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.font = '600 12px "Inter", "SF Mono", monospace';
      const tw = ctx.measureText(label).width;
      const lx = midX - tw / 2 - 10;
      const ly = midY - 12;
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 20, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, midX - tw / 2, midY + 4);
    }

    if (obj.type === 'sltp') {
      drawSLTP(ctx, obj, w);
    }

    if (obj.type === 'brush') {
      if (obj.points.length < 2) return;
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = obj.lineWidth || 2;
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const first = chartToPixel(obj.points[0]);
      if (!first) return;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < obj.points.length; i++) {
        const p = chartToPixel(obj.points[i]);
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    // Draw anchor points for all types (in cursor mode)
    if (activeTool === 'cursor') {
      drawAnchors(ctx, obj);
    }
  }

  // ——— Draw anchor points for dragging ———
  function drawAnchors(ctx: CanvasRenderingContext2D, obj: DrawnObject) {
    const SQ = 4;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#3d5af1';
    ctx.lineWidth = 1.5;

    function drawSquare(px: number, py: number) {
      ctx.fillRect(px - SQ, py - SQ, SQ * 2, SQ * 2);
      ctx.strokeRect(px - SQ, py - SQ, SQ * 2, SQ * 2);
    }

    if (obj.type === 'hline') {
      const p = chartToPixel(obj.points[0]);
      if (p) drawSquare(40, p.y);
    }

    if (obj.type === 'trendline' && obj.points.length >= 2) {
      const p1 = chartToPixel(obj.points[0]);
      const p2 = chartToPixel(obj.points[1]);
      if (p1) drawSquare(p1.x, p1.y);
      if (p2) drawSquare(p2.x, p2.y);
    }

    if (obj.type === 'ruler' && obj.points.length >= 2) {
      const p1 = chartToPixel(obj.points[0]);
      const p2 = chartToPixel(obj.points[1]);
      if (p1) drawSquare(p1.x, p1.y);
      if (p2) drawSquare(p2.x, p2.y);
    }

    // SLTP anchors are already drawn in drawSLTP
  }

  // ——— SL/TP: TradingView-style BOUNDED rectangles ———
  function drawSLTP(ctx: CanvasRenderingContext2D, obj: DrawnObject, _w: number) {
    if (obj.points.length < 3) return;
    const pEntry = chartToPixel(obj.points[0]);
    const pTP = chartToPixel(obj.points[1]);
    const pSL = chartToPixel(obj.points[2]);
    if (!pEntry || !pTP || !pSL) return;

    const entryPrice = obj.points[0].price;
    const tpPrice = obj.points[1].price;
    const slPrice = obj.points[2].price;

    // X bounds: entry.x → tp.x (tp click defines right edge)
    const left = Math.min(pEntry.x, pTP.x);
    const right = Math.max(pEntry.x, pTP.x);
    const boxW = right - left;
    if (boxW < 2) return;

    const tpDiff = Math.abs(tpPrice - entryPrice);
    const slDiff = Math.abs(entryPrice - slPrice);
    const tpPct = (tpDiff / entryPrice * 100);
    const slPct = (slDiff / entryPrice * 100);
    const rr = slDiff > 0 ? (tpDiff / slDiff) : Infinity;

    ctx.font = '600 11px "Inter", "SF Mono", monospace';

    // TP zone (green bounded rectangle)
    const tpTop = Math.min(pTP.y, pEntry.y);
    const tpH = Math.abs(pEntry.y - pTP.y);
    ctx.fillStyle = 'rgba(38, 166, 91, 0.20)';
    ctx.fillRect(left, tpTop, boxW, tpH);
    ctx.strokeStyle = 'rgba(38, 166, 91, 0.6)';
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(left, tpTop, boxW, tpH);
    ctx.setLineDash([]);

    // SL zone (red bounded rectangle)
    const slTop = Math.min(pEntry.y, pSL.y);
    const slH = Math.abs(pSL.y - pEntry.y);
    ctx.fillStyle = 'rgba(234, 57, 67, 0.20)';
    ctx.fillRect(left, slTop, boxW, slH);
    ctx.strokeStyle = 'rgba(234, 57, 67, 0.6)';
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(left, slTop, boxW, slH);
    ctx.setLineDash([]);

    // Entry line (only within bounds)
    ctx.strokeStyle = '#8b949e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, pEntry.y);
    ctx.lineTo(right, pEntry.y);
    ctx.stroke();

    // Corner anchor squares (like TradingView)
    const sq = 4;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#3d5af1';
    ctx.lineWidth = 1;
    // top-left, top-right of TP
    [[left, tpTop], [right, tpTop]].forEach(([ax, ay]) => {
      ctx.fillRect(ax - sq, ay - sq, sq * 2, sq * 2);
      ctx.strokeRect(ax - sq, ay - sq, sq * 2, sq * 2);
    });
    // bottom-left, bottom-right of SL
    [[left, pSL.y], [right, pSL.y]].forEach(([ax, ay]) => {
      ctx.fillRect(ax - sq, ay - sq, sq * 2, sq * 2);
      ctx.strokeRect(ax - sq, ay - sq, sq * 2, sq * 2);
    });
    // entry left
    ctx.fillRect(left - sq, pEntry.y - sq, sq * 2, sq * 2);
    ctx.strokeRect(left - sq, pEntry.y - sq, sq * 2, sq * 2);

    // TP label (above TP rectangle)
    const tpLabel = `Цель: ${tpPrice.toFixed(2)} (${tpPct.toFixed(2)}%)`;
    const tpTw = ctx.measureText(tpLabel).width;
    const tpLabelX = left + (boxW - tpTw) / 2 - 12;
    ctx.fillStyle = '#26a65b';
    ctx.beginPath();
    ctx.roundRect(tpLabelX, tpTop - 26, tpTw + 24, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(tpLabel, tpLabelX + 12, tpTop - 11);

    // SL label (below SL rectangle)
    const slLabel = `Стоп: ${slPrice.toFixed(2)} (${slPct.toFixed(2)}%)`;
    const slTw = ctx.measureText(slLabel).width;
    const slLabelX = left + (boxW - slTw) / 2 - 12;
    ctx.fillStyle = '#ea3943';
    ctx.beginPath();
    ctx.roundRect(slLabelX, pSL.y + 6, slTw + 24, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(slLabel, slLabelX + 12, pSL.y + 21);

    // Entry + R:R label (centered on entry line)
    const entryLabel = `Вход: ${entryPrice.toFixed(2)}  Р:П = 1:${rr === Infinity ? '∞' : rr.toFixed(2)}`;
    const eTw = ctx.measureText(entryLabel).width;
    const eLabelX = left + (boxW - eTw) / 2 - 12;
    ctx.fillStyle = 'rgba(30, 35, 44, 0.92)';
    ctx.beginPath();
    ctx.roundRect(eLabelX, pEntry.y - 12, eTw + 24, 24, 4);
    ctx.fill();
    ctx.strokeStyle = '#8b949e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(eLabelX, pEntry.y - 12, eTw + 24, 24, 4);
    ctx.stroke();
    ctx.fillStyle = '#ddd';
    ctx.fillText(entryLabel, eLabelX + 12, pEntry.y + 3);
  }

  // ——— Draw temp (in-progress) objects ———
  function drawTempObject(
    ctx: CanvasRenderingContext2D,
    tool: DrawingToolType,
    points: ChartPoint[],
    mouse: { x: number; y: number },
    w: number,
    _h: number
  ) {
    ctx.globalAlpha = 0.7;

    if (tool === 'hline') {
      ctx.strokeStyle = '#f0b429';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, mouse.y);
      ctx.lineTo(w, mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Preview price
      const cp = pixelToChart(mouse.x, mouse.y);
      if (cp) {
        const txt = cp.price.toFixed(2);
        ctx.font = '600 11px "Inter", monospace';
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = '#f0b429';
        ctx.fillRect(w - tw - 14, mouse.y - 10, tw + 10, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(txt, w - tw - 9, mouse.y + 4);
      }
    }

    if (tool === 'trendline' && points.length === 1) {
      const p1 = chartToPixel(points[0]);
      if (p1) {
        ctx.strokeStyle = '#29b6f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    if (tool === 'ruler' && points.length === 1) {
      const p1 = chartToPixel(points[0]);
      if (p1) {
        const isUp = mouse.y < p1.y;
        const bgColor = isUp ? 'rgba(63, 185, 80, 0.18)' : 'rgba(244, 67, 54, 0.18)';
        const borderColor = isUp ? '#3fb950' : '#f44336';
        ctx.fillStyle = bgColor;
        ctx.fillRect(p1.x, p1.y, mouse.x - p1.x, mouse.y - p1.y);
        ctx.strokeStyle = borderColor;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(p1.x, p1.y, mouse.x - p1.x, mouse.y - p1.y);
        ctx.setLineDash([]);
        const chartPoint = pixelToChart(mouse.x, mouse.y);
        if (chartPoint) {
          const priceDiff = chartPoint.price - points[0].price;
          const pctChange = (priceDiff / points[0].price) * 100;
          const label = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
          const midX = (p1.x + mouse.x) / 2;
          const midY = (p1.y + mouse.y) / 2;
          ctx.font = '600 12px "Inter", monospace';
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = borderColor;
          ctx.beginPath();
          ctx.roundRect(midX - tw / 2 - 10, midY - 12, tw + 20, 24, 4);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(label, midX - tw / 2, midY + 4);
        }
      }
    }

    if (tool === 'sltp') {
      if (points.length === 0) {
        // Entry preview: crosshair at mouse position
        ctx.strokeStyle = '#8b949e';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mouse.x, 0);
        ctx.lineTo(mouse.x, 9999);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, mouse.y);
        ctx.lineTo(w, mouse.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const cp = pixelToChart(mouse.x, mouse.y);
        if (cp) {
          ctx.font = '600 11px "Inter", monospace';
          const txt = `Вход: ${cp.price.toFixed(2)}`;
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = 'rgba(30,35,44,0.9)';
          ctx.fillRect(mouse.x + 10, mouse.y - 24, tw + 16, 20);
          ctx.fillStyle = '#ddd';
          ctx.fillText(txt, mouse.x + 18, mouse.y - 10);
        }
      } else if (points.length === 1) {
        // TP preview: bounded rectangle from entry to mouse
        const pEntry = chartToPixel(points[0]);
        if (pEntry) {
          const left = Math.min(pEntry.x, mouse.x);
          const right = Math.max(pEntry.x, mouse.x);
          const boxW = right - left;
          const tpY = Math.min(mouse.y, pEntry.y);
          const tpH = Math.abs(pEntry.y - mouse.y);
          ctx.fillStyle = 'rgba(38, 166, 91, 0.18)';
          ctx.fillRect(left, tpY, boxW, tpH);
          ctx.strokeStyle = 'rgba(38, 166, 91, 0.6)';
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(left, tpY, boxW, tpH);
          ctx.setLineDash([]);
          // Entry line within bounds
          ctx.strokeStyle = '#8b949e';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(left, pEntry.y);
          ctx.lineTo(right, pEntry.y);
          ctx.stroke();
        }
      } else if (points.length === 2) {
        // SL preview: TP zone (fixed) + SL zone (mouse.y)
        const pEntry = chartToPixel(points[0]);
        const pTP = chartToPixel(points[1]);
        if (pEntry && pTP) {
          const left = Math.min(pEntry.x, pTP.x);
          const right = Math.max(pEntry.x, pTP.x);
          const boxW = right - left;
          // TP zone
          const tpY = Math.min(pTP.y, pEntry.y);
          const tpH = Math.abs(pEntry.y - pTP.y);
          ctx.fillStyle = 'rgba(38, 166, 91, 0.18)';
          ctx.fillRect(left, tpY, boxW, tpH);
          ctx.strokeStyle = 'rgba(38, 166, 91, 0.6)';
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(left, tpY, boxW, tpH);
          // SL zone
          const slY = Math.min(pEntry.y, mouse.y);
          const slH = Math.abs(mouse.y - pEntry.y);
          ctx.fillStyle = 'rgba(234, 57, 67, 0.18)';
          ctx.fillRect(left, slY, boxW, slH);
          ctx.strokeStyle = 'rgba(234, 57, 67, 0.6)';
          ctx.strokeRect(left, slY, boxW, slH);
          ctx.setLineDash([]);
          // Entry line
          ctx.strokeStyle = '#8b949e';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(left, pEntry.y);
          ctx.lineTo(right, pEntry.y);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  // ——— Hit-test: find drawing near click point ———
  function hitTest(x: number, y: number): DrawnObject | null {
    const HIT_TOLERANCE = 10;

    for (let i = drawings.length - 1; i >= 0; i--) {
      const obj = drawings[i];

      if (obj.type === 'hline') {
        const p = chartToPixel(obj.points[0]);
        if (p && Math.abs(y - p.y) < HIT_TOLERANCE) return obj;
      }

      if (obj.type === 'trendline' && obj.points.length >= 2) {
        const p1 = chartToPixel(obj.points[0]);
        const p2 = chartToPixel(obj.points[1]);
        if (p1 && p2) {
          // Distance from point to line segment
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0) {
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const nearX = p1.x + t * dx;
            const nearY = p1.y + t * dy;
            const dist = Math.sqrt((x - nearX) ** 2 + (y - nearY) ** 2);
            if (dist < HIT_TOLERANCE) return obj;
          }
        }
      }

      if (obj.type === 'ruler' && obj.points.length >= 2) {
        const p1 = chartToPixel(obj.points[0]);
        const p2 = chartToPixel(obj.points[1]);
        if (p1 && p2) {
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          if (x >= minX - HIT_TOLERANCE && x <= maxX + HIT_TOLERANCE &&
              y >= minY - HIT_TOLERANCE && y <= maxY + HIT_TOLERANCE) return obj;
        }
      }

      if (obj.type === 'sltp' && obj.points.length >= 3) {
        const pEntry = chartToPixel(obj.points[0]);
        const pTP = chartToPixel(obj.points[1]);
        const pSL = chartToPixel(obj.points[2]);
        if (pEntry && pTP && pSL) {
          const left = Math.min(pEntry.x, pTP.x) - HIT_TOLERANCE;
          const right = Math.max(pEntry.x, pTP.x) + HIT_TOLERANCE;
          const top = Math.min(pTP.y, pEntry.y, pSL.y) - HIT_TOLERANCE;
          const bottom = Math.max(pTP.y, pEntry.y, pSL.y) + HIT_TOLERANCE;
          if (x >= left && x <= right && y >= top && y <= bottom) return obj;
        }
      }
    }
    return null;
  }

  // ——— Find anchor point near pixel coords ———
  function findAnchor(x: number, y: number): { id: string; pointIndex: number } | null {
    const TOL = 12;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const obj = drawings[i];
      if (obj.type === 'hline') {
        const p = chartToPixel(obj.points[0]);
        if (p && Math.abs(y - p.y) < TOL && x < 60) return { id: obj.id, pointIndex: 0 };
      }
      if ((obj.type === 'trendline' || obj.type === 'ruler') && obj.points.length >= 2) {
        for (let pi = 0; pi < 2; pi++) {
          const p = chartToPixel(obj.points[pi]);
          if (p && Math.abs(x - p.x) < TOL && Math.abs(y - p.y) < TOL) return { id: obj.id, pointIndex: pi };
        }
      }
      if (obj.type === 'sltp' && obj.points.length >= 3) {
        for (let pi = 0; pi < 3; pi++) {
          const p = chartToPixel(obj.points[pi]);
          if (p && Math.abs(x - p.x) < TOL && Math.abs(y - p.y) < TOL) return { id: obj.id, pointIndex: pi };
        }
      }
    }
    return null;
  }

  // ——— Click handler (for click-to-create tools) ———
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) return; // Don't fire click after drag
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Cursor/brush modes: handled elsewhere
    if (activeTool === 'cursor' || activeTool === 'brush') return;

    const point = pixelToChart(x, y);
    if (!point) return;

    if (activeTool === 'hline') {
      onAddDrawing({ id: nextId(), type: 'hline', points: [point], color: '#f0b429', lineWidth: 2 });
      onToolComplete();
    }

    if (activeTool === 'trendline') {
      const temp = tempPointsRef.current;
      if (temp.length === 0) {
        tempPointsRef.current = [point];
      } else {
        onAddDrawing({ id: nextId(), type: 'trendline', points: [temp[0], point], color: '#29b6f6', lineWidth: 2 });
        tempPointsRef.current = [];
        onToolComplete();
      }
    }

    if (activeTool === 'ruler') {
      const temp = tempPointsRef.current;
      if (temp.length === 0) {
        tempPointsRef.current = [point];
      } else {
        onAddDrawing({
          id: nextId(), type: 'ruler', points: [temp[0], point],
          color: point.price > temp[0].price ? '#3fb950' : '#f44336', lineWidth: 1,
        });
        tempPointsRef.current = [];
        onToolComplete();
      }
    }

    if (activeTool === 'sltp') {
      const temp = tempPointsRef.current;
      if (temp.length === 0) {
        tempPointsRef.current = [point];
      } else if (temp.length === 1) {
        tempPointsRef.current = [temp[0], point];
      } else if (temp.length === 2) {
        onAddDrawing({ id: nextId(), type: 'sltp', points: [temp[0], temp[1], point], color: '#8b949e', lineWidth: 1 });
        tempPointsRef.current = [];
        onToolComplete();
      }
    }
  }, [activeTool, pixelToChart, onAddDrawing, onToolComplete, onRemoveDrawing, drawings, chartToPixel]);

  // ——— Mouse down: start drag or brush ———
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // left button only
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Brush mode: start freehand
    if (activeTool === 'brush') {
      isBrushingRef.current = true;
      const p = pixelToChart(x, y);
      brushPointsRef.current = p ? [p] : [];
      return;
    }

    // Cursor mode: anchor drag is handled by container native listener below
    // so do nothing in canvas mousedown for cursor
  }, [activeTool, pixelToChart, drawings, chartToPixel]);

  // ——— Mouse up: end drag or brush ———
  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBrushingRef.current) {
      isBrushingRef.current = false;
      const pts = brushPointsRef.current;
      if (pts.length >= 2) {
        onAddDrawing({ id: nextId(), type: 'brush', points: [...pts], color: '#f0b429', lineWidth: 2 });
      }
      brushPointsRef.current = [];
      return;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragTargetRef.current = null;
    }
  }, [onAddDrawing]);

  // ——— Mouse move ———
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    // Brush: add point
    if (isBrushingRef.current && activeTool === 'brush') {
      const p = pixelToChart(x, y);
      if (p) brushPointsRef.current.push(p);
      return;
    }

    // Drag: update the anchored point
    if (isDraggingRef.current && dragTargetRef.current) {
      const { id, pointIndex } = dragTargetRef.current;
      const obj = drawings.find(d => d.id === id);
      if (!obj) return;
      const newPoint = pixelToChart(x, y);
      if (!newPoint) return;
      const newPoints = [...obj.points];
      newPoints[pointIndex] = newPoint;
      onUpdateDrawing({ ...obj, points: newPoints });
    }
  }, [activeTool, pixelToChart, drawings, onUpdateDrawing]);

  // ——— Right-click cancel ———
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    tempPointsRef.current = [];
  }, []);

  // Reset temp on tool change
  useEffect(() => {
    tempPointsRef.current = [];
  }, [activeTool]);

  // Cursor mode: drag-to-resize + click-to-delete via container native listeners
  useEffect(() => {
    if (activeTool !== 'cursor' || drawings.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    let dragStarted = false;
    let dragMoved = false;

    const handleDown = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      const anchor = findAnchor(x, y);
      if (anchor) {
        isDraggingRef.current = true;
        dragTargetRef.current = anchor;
        dragStarted = true;
        dragMoved = false;
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragTargetRef.current) return;
      dragMoved = true;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const { id, pointIndex } = dragTargetRef.current;
      const obj = drawings.find(d => d.id === id);
      if (!obj) return;
      const newPoint = pixelToChart(x, y);
      if (!newPoint) return;
      const newPoints = [...obj.points];
      newPoints[pointIndex] = newPoint;
      onUpdateDrawing({ ...obj, points: newPoints });
    };

    const handleUp = () => {
      if (dragStarted) {
        isDraggingRef.current = false;
        dragTargetRef.current = null;
        dragStarted = false;
      }
    };

    const handleCursorClick = (e: MouseEvent) => {
      // Курсор теперь только для выделения/перетаскивания (не удаляет).
      // Но мы можем оставить выделение, если появится такой функционал.
      // Само удаление перенесено в инструмент 'eraser' ("Ластик").
      return;
    };

    container.addEventListener('mousedown', handleDown, true);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    container.addEventListener('click', handleCursorClick);
    return () => {
      container.removeEventListener('mousedown', handleDown, true);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      container.removeEventListener('click', handleCursorClick);
    };
  }, [activeTool, drawings, chartToPixel, onRemoveDrawing, onUpdateDrawing, pixelToChart]);

  // Start draw loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ——— Resize with HiDPI scaling ———
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function resizeCanvas() {
      const canvas = canvasRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);
    resizeCanvas();

    return () => ro.disconnect();
  }, [containerRef]);

  // Поддержка клика ластиком (срабатывает на canvas)
  const handleEraserClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'eraser') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // hitTest (существующая функция, проверяет столкновение по x,y)
    const hit = hitTest(x, y);
    if (hit) {
      onRemoveDrawing(hit.id);
    }
  }, [activeTool, hitTest, onRemoveDrawing]);

  // Общий handleClick маршрутизатор
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'eraser') {
      handleEraserClick(e);
    } else {
      handleClick(e);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={onCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        // pointerEvents = auto для всех рисующих инструментов и ластика, чтобы ловить клики canvas.
        // Для cursor = none, чтобы события проходили сквозь холст на главный график (скролл, зум) 
        // и ловились слушателем на container.
        pointerEvents: activeTool === 'cursor' ? 'none' : 'auto',
        cursor: activeTool === 'eraser' 
          ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23f44336\' stroke-width=\'2\'><path d=\'M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z\'/><line x1=\'18\' y1=\'11\' x2=\'8\' y2=\'21\'/></svg>") 0 24, auto' 
          : activeTool === 'cursor' ? 'default' : 'crosshair',
      }}
    />
  );
}
