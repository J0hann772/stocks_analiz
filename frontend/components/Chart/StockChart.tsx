'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ColorType,
  CrosshairMode,
  ISeriesApi,
} from 'lightweight-charts';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { OHLCVBar, ChartMarker } from '@/types';
import type { FMPTckMessage } from '@/hooks/useMarketWebsocket';
import styles from './StockChart.module.css';

export interface StockIndicator {
  key: string;
  id: string; // The raw config ID
  config: any; // The raw config object
  color: string;
  values: { time: string; value: number }[];
  extraValues?: { time: string; value: number }[]; // For bottom band of HHLL
  extraValues2?: { time: string; value: number }[]; // For 3-line indicators like Alligator
  pane?: number;
}

interface Props {
  data: OHLCVBar[];
  markers?: ChartMarker[];
  indicators?: StockIndicator[];
  height?: number;
  showVolume?: boolean;
  onUpdateIndicator?: (config: any) => void;
  onRemoveIndicator?: (id: string) => void;
  onSettingsClick?: (config: any) => void;
  onChartReady?: (chartApi: IChartApi, seriesApi: ISeriesApi<any>) => void;
}

const DARK_OPTS = {
  layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#8b949e' },
  grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { labelBackgroundColor: '#1c2128' },
    horzLine: { labelBackgroundColor: '#1c2128' },
  },
};

const LIGHT_OPTS = {
  layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#656d76' },
  grid: { vertLines: { color: '#e2e7ed' }, horzLines: { color: '#e2e7ed' } },
  crosshair: { mode: CrosshairMode.Normal },
};

// SVG Icons for inline controls
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const EyeOffIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
const GearIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;

export function StockChart({ data, markers = [], indicators = [], height = 500, showVolume = true, onUpdateIndicator, onRemoveIndicator, onSettingsClick, onChartReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const extraContainersRef = useRef<(HTMLDivElement | null)[]>([]);

  // Refs to preserve chart state across raw data updates without resetting zoom/layout
  const chartsRef = useRef<IChartApi[]>([]);
  const seriesMapRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const mainCandleRef = useRef<ISeriesApi<any> | null>(null);
  const mainVolRef = useRef<ISeriesApi<any> | null>(null);
  const prevConfigRef = useRef<string>('');
  const roRef = useRef<ResizeObserver | null>(null);

  const [indicatorValues, setIndicatorValues] = useState<Record<string, string>>({});
  const { theme } = useTheme();

  const mainIndicators = indicators.filter(i => (i.pane || 0) === 0 && !i.key.includes('_MA'));
  const extraPanesMap = new Map<number, StockIndicator[]>();
  indicators.forEach(ind => {
    if (ind.pane && ind.pane > 0 && !ind.key.includes('_MA')) {
      if (!extraPanesMap.has(ind.pane)) extraPanesMap.set(ind.pane, []);
      extraPanesMap.get(ind.pane)!.push(ind);
    }
  });
  const renderExtraPaneKeys = Array.from(extraPanesMap.keys()).sort();

  useEffect(() => {
    const currentConfigStr = JSON.stringify({
      theme,
      showVolume,
      inds: indicators.map(i => ({ id: i.id, config: i.config, pane: i.pane, color: i.color }))
    });

    const isConfigChanged = currentConfigStr !== prevConfigRef.current;
    
    if (isConfigChanged || chartsRef.current.length === 0) {
      // FULL REBUILD: Config changed
      prevConfigRef.current = currentConfigStr;

      if (roRef.current) roRef.current.disconnect();
      chartsRef.current.forEach(c => c.remove());
      chartsRef.current = [];
      seriesMapRef.current.clear();
      mainCandleRef.current = null;
      mainVolRef.current = null;

      if (!mainChartContainerRef.current) return;

      const renderMainIndicators = indicators.filter(i => (i.pane || 0) === 0);
      const renderExtraPanesMap = new Map<number, StockIndicator[]>();
      indicators.forEach(ind => {
        if (ind.pane && ind.pane > 0) {
          if (!renderExtraPanesMap.has(ind.pane)) renderExtraPanesMap.set(ind.pane, []);
          renderExtraPanesMap.get(ind.pane)!.push(ind);
        }
      });
      const renderExtraPaneKeysArr = Array.from(renderExtraPanesMap.keys()).sort();

      const charts: IChartApi[] = [];
      const opts = theme === 'dark' ? DARK_OPTS : LIGHT_OPTS;
      const baseChartOpts = {
        ...opts,
        timeScale: { 
          rightOffset: 5, 
          borderColor: 'var(--color-border)', 
          timeVisible: true,
          shiftVisibleRangeOnNewBar: true,
        },
        rightPriceScale: {
          scaleMargins: { top: 0.1, bottom: 0.1 },
          borderColor: 'var(--color-border)',
          minimumWidth: 95, // Increased further to guarantee exact alignment
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      };

      const hasExtraPanes = renderExtraPaneKeysArr.length > 0;

      const mainChart = createChart(mainChartContainerRef.current, {
        ...baseChartOpts,
        width: mainChartContainerRef.current.clientWidth,
        height: mainChartContainerRef.current.clientHeight,
        timeScale: {
          ...baseChartOpts.timeScale,
          visible: !hasExtraPanes, // Hide time scale if there are bottom panes
        }
      });
      charts.push(mainChart);

      // Expose chart API to parent for drawing tools (will be called after candle series is created)
      // We defer the call to after the candle series is added below

      const candle = mainChart.addCandlestickSeries({
        upColor: '#3fb950',
        downColor: '#f85149',
        borderUpColor: '#3fb950',
        borderDownColor: '#f85149',
        wickUpColor: '#3fb950',
        wickDownColor: '#f85149',
      });
      candle.setData(data as any);
      if (markers.length) candle.setMarkers(markers as any);
      mainCandleRef.current = candle;

      // Notify parent about chart readiness (for drawing tools)
      if (onChartReady) onChartReady(mainChart, candle);

      if (showVolume) {
        const vol = mainChart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
        });
        vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        vol.setData(data.map(d => ({
          time: (d as any).time,
          value: (d as any).volume,
          color: d.close >= d.open ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)',
        })) as any);
        mainVolRef.current = vol;
      }

      renderMainIndicators.forEach(ind => {
        // Main pane indicators: share the right price scale with candles
        // but do NOT affect auto-scale range (candles drive the scaling)
        const line = mainChart.addLineSeries({ 
          color: ind.color, 
          lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2,
          lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
          visible: ind.config.visible !== false,
          // No priceScaleId — stays on default right scale with candles
          autoscaleInfoProvider: () => ({
            priceRange: null, // Don't affect auto-scale range
          }),
        });
        const cleanData = ind.values.map(v => {
          if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
            return { time: v.time, value: Number(v.value) };
          }
          return { time: v.time };
        });
        line.setData(cleanData as any);
        seriesMapRef.current.set(ind.id, line);

        if (ind.extraValues) {
          const line2 = mainChart.addLineSeries({ 
            color: ind.config.type === 'Alligator' ? ind.config.teethColor : (ind.config.botColor || '#f85149'), 
            lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2,
            lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
            visible: ind.config.visible !== false,
            autoscaleInfoProvider: () => ({
              priceRange: null,
            }),
          });
          const cleanData2 = ind.extraValues.map(v => {
            if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
              return { time: v.time, value: Number(v.value) };
            }
            return { time: v.time };
          });
          line2.setData(cleanData2 as any);
          seriesMapRef.current.set(ind.id + '_extra', line2);
        }

        if (ind.extraValues2) {
          const line3 = mainChart.addLineSeries({ 
            color: ind.config.type === 'Alligator' ? ind.config.lipsColor : '#12aa52', 
            lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2,
            lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
            visible: ind.config.visible !== false,
            autoscaleInfoProvider: () => ({
              priceRange: null,
            }),
          });
          const cleanData3 = ind.extraValues2.map((v: any) => {
            if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
              return { time: v.time, value: Number(v.value) };
            }
            return { time: v.time };
          });
          line3.setData(cleanData3 as any);
          seriesMapRef.current.set(ind.id + '_extra2', line3);
        }
      });

      renderExtraPaneKeysArr.forEach((paneKey, idx) => {
        const container = extraContainersRef.current[idx];
        if (!container) return;

        const inds = renderExtraPanesMap.get(paneKey)!;
        const isLastPane = idx === renderExtraPaneKeysArr.length - 1;

        const extraChart = createChart(container, {
          ...baseChartOpts,
          width: container.clientWidth,
          height: container.clientHeight,
          timeScale: {
            ...baseChartOpts.timeScale,
            visible: isLastPane,
          }
        });
        charts.push(extraChart);

        inds.forEach(ind => {
          const isMA = ind.key.includes('_MA');
          
          if (ind.key.includes('RSI') && !isMA) {
            // === RSI: Native color-coding with strict data mapping ===

            const currentLineWidth = ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2;
            const currentLineStyle = ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0;
            const isVisible = ind.config.visible !== false;
            
            const upperBound = ind.config.upperBound !== undefined ? ind.config.upperBound : 70;
            const lowerBound = ind.config.lowerBound !== undefined ? ind.config.lowerBound : 30;
            
            // Helper to clean values (prevent NaN crashes in BaselineSeries)
            const cleanData = ind.values.map(v => {
              if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
                return { time: v.time, value: Number(v.value) };
              }
              return { time: v.time };
            });

            // 1. Background Fill (Purple Band)
            try {
              const bgSeries = extraChart.addBaselineSeries({
                baseValue: { type: 'price', price: lowerBound },
                topFillColor1: 'rgba(126, 87, 194, 0.12)',
                topFillColor2: 'rgba(126, 87, 194, 0.12)',
                bottomFillColor1: 'transparent',
                bottomFillColor2: 'transparent',
                topLineColor: 'transparent',
                bottomLineColor: 'transparent',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
                visible: isVisible,
              });
              const bandData = cleanData.map(v => {
                if ('value' in v) return { time: v.time, value: upperBound };
                return { time: v.time };
              });
              bgSeries.setData(bandData as any);
            } catch (err) { console.error("RSI Band Error:", err); }

            // 2. Overbought Fill (> upperBound)
            try {
              const obSeries = extraChart.addBaselineSeries({
                baseValue: { type: 'price', price: upperBound },
                topFillColor1: 'rgba(248, 81, 73, 0.35)',
                topFillColor2: 'rgba(248, 81, 73, 0.05)',
                bottomFillColor1: 'transparent',
                bottomFillColor2: 'transparent',
                topLineColor: 'transparent',
                bottomLineColor: 'transparent',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
                visible: isVisible,
              });
              obSeries.setData(cleanData as any);
            } catch (err) { console.error("RSI OB Error:", err); }

            // 3. Oversold Fill (< lowerBound)
            try {
              const osSeries = extraChart.addBaselineSeries({
                baseValue: { type: 'price', price: lowerBound },
                topFillColor1: 'transparent',
                topFillColor2: 'transparent',
                bottomFillColor1: 'rgba(63, 185, 80, 0.05)',
                bottomFillColor2: 'rgba(63, 185, 80, 0.35)',
                topLineColor: 'transparent',
                bottomLineColor: 'transparent',
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
                visible: isVisible,
              });
              osSeries.setData(cleanData as any);
            } catch (err) { console.error("RSI OS Error:", err); }

            // 4. Base RSI Line (Colored Breakouts)
            const rsiLine = extraChart.addLineSeries({
              color: ind.color || '#7e57c2',
              lineWidth: currentLineWidth,
              lineStyle: currentLineStyle,
              visible: isVisible,
              lastValueVisible: true,
              priceLineVisible: false,
            });
            rsiLine.createPriceLine({ price: upperBound, color: 'rgba(248, 81, 73, 0.5)', lineWidth: 1, lineStyle: 2, title: '' });
            rsiLine.createPriceLine({ price: lowerBound, color: 'rgba(63, 185, 80, 0.5)', lineWidth: 1, lineStyle: 2, title: '' });
            
            const rsiColoredData = cleanData.map(v => {
              if ('value' in v) {
                const val = (v as any).value;
                let ptColor = undefined;
                if (val > upperBound) ptColor = '#f85149';
                else if (val < lowerBound) ptColor = '#3fb950';
                return { time: v.time, value: val, color: ptColor };
              }
              return { time: v.time };
            });
            
            rsiLine.setData(rsiColoredData as any);
            seriesMapRef.current.set(ind.id, rsiLine);

          } else {
            // Non-RSI indicators (SMA on RSI, HHLL, etc.)
            const line = extraChart.addLineSeries({
              color: ind.color,
              lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : (isMA ? 1 : 2),
              lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
              visible: ind.config.visible !== false
            });
            const cleanData = ind.values.map(v => {
              if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
                return { time: v.time, value: Number(v.value) };
              }
              return { time: v.time };
            });
            line.setData(cleanData as any);
            seriesMapRef.current.set(ind.id, line);

            if (ind.extraValues) {
              const line2 = extraChart.addLineSeries({ 
                color: '#f85149', 
                lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2,
                lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
                visible: ind.config.visible !== false
              });
              const cleanData2 = ind.extraValues.map(v => {
                if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
                  return { time: v.time, value: Number(v.value) };
                }
                return { time: v.time };
              });
              line2.setData(cleanData2 as any);
              seriesMapRef.current.set(ind.id + '_extra', line2);
            }

            if (ind.extraValues2) {
              const line3 = extraChart.addLineSeries({ 
                color: ind.config.type === 'Alligator' ? ind.config.lipsColor : '#12aa52', 
                lineWidth: ind.config.lineWidth !== undefined ? ind.config.lineWidth : 2,
                lineStyle: ind.config.lineStyle !== undefined ? ind.config.lineStyle : 0,
                visible: ind.config.visible !== false
              });
              const cleanData3 = ind.extraValues2.map((v: any) => {
                if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
                  return { time: v.time, value: Number(v.value) };
                }
                return { time: v.time };
              });
              line3.setData(cleanData3 as any);
              seriesMapRef.current.set(ind.id + '_extra2', line3);
            }
          }
        });
      });

      // Synchronize zooming and panning across all panes
      let syncLock = false;
      charts.forEach((chart, i) => {
        chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
          if (!logicalRange || syncLock) return;
          syncLock = true;
          charts.forEach((otherChart, j) => {
            if (i !== j) {
              otherChart.timeScale().setVisibleLogicalRange(logicalRange);
            }
          });
          syncLock = false;
        });

        chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
          if (!timeRange || syncLock) return;
          syncLock = true;
          charts.forEach((otherChart, j) => {
            if (i !== j) {
              // TimeRange syncing is supplementary to logical range to ensure pixel perfection
              try {
                const logical = chart.timeScale().getVisibleLogicalRange();
                if (logical) {
                  otherChart.timeScale().setVisibleLogicalRange(logical);
                }
              } catch {}
            }
          });
          syncLock = false;
        });
      });

      charts.forEach((sourceChart, i) => {
        sourceChart.subscribeCrosshairMove((param: any) => {
          if (param.time === undefined || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
             charts.forEach((targetChart, j) => {
               if (i !== j) targetChart.clearCrosshairPosition();
             });
             setIndicatorValues({});
             return;
          }

          charts.forEach((targetChart, j) => {
            if (i !== j) {
              let targetSeries: ISeriesApi<any> | null = null;
              if (j === 0 && mainCandleRef.current) {
                targetSeries = mainCandleRef.current;
              } else if (j > 0) {
                const paneKey = renderExtraPaneKeysArr[j - 1];
                const firstInd = renderExtraPanesMap.get(paneKey)?.[0];
                if (firstInd) targetSeries = seriesMapRef.current.get(firstInd.id) || null;
              }
              
              if (targetSeries) {
                try {
                  // We provide a fictional price just to make the vertical line appear at the correct time
                  targetChart.setCrosshairPosition(1, param.time, targetSeries);
                } catch (e) {}
              }
            }
          });

          if (param.time) {
            let normalizedTime: string | number = param.time;
            
            // Handle BusinessDay object { year, month, day } from LightweightCharts
            if (typeof param.time === 'object' && 'year' in param.time) {
              const { year, month, day } = param.time;
              const mm = String(month).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              normalizedTime = `${year}-${mm}-${dd}`;
            }

            const newVals: Record<string, string> = {};
            indicators.forEach(ind => {
              const pt = ind.values.find(v => v.time === normalizedTime);
              if (pt && pt.value !== undefined && pt.value !== null && !isNaN(pt.value as any)) {
                 newVals[ind.id] = Number(pt.value).toFixed(2);
              }
              if (ind.extraValues) {
                 const pt2 = ind.extraValues.find(v => v.time === normalizedTime);
                 if (pt2 && pt2.value !== undefined && pt2.value !== null && !isNaN(pt2.value as any)) {
                   if (newVals[ind.id]) {
                     newVals[ind.id] += ' / ' + Number(pt2.value).toFixed(2);
                   } else {
                     newVals[ind.id] = Number(pt2.value).toFixed(2);
                   }
                 }
              }
              if (ind.extraValues2) {
                 const pt3 = ind.extraValues2.find(v => v.time === normalizedTime);
                 if (pt3 && pt3.value !== undefined && pt3.value !== null && !isNaN(pt3.value as any)) {
                   if (newVals[ind.id]) {
                     newVals[ind.id] += ' / ' + Number(pt3.value).toFixed(2);
                   } else {
                     newVals[ind.id] = Number(pt3.value).toFixed(2);
                   }
                 }
              }
            });
            setIndicatorValues(newVals);
          } else {
            setIndicatorValues({});
          }
        });
      });

      // Force auto-scale ON for the right price scale after adding all indicator series
      mainChart.priceScale('right').applyOptions({
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      });
      mainChart.timeScale().fitContent();

      // Fit all extra pane charts as well
      charts.slice(1).forEach(c => {
        c.priceScale('right').applyOptions({ autoScale: true });
        c.timeScale().fitContent();
      });

      roRef.current = new ResizeObserver(() => {
        if (mainChartContainerRef.current) {
           mainChart.resize(mainChartContainerRef.current.clientWidth, mainChartContainerRef.current.clientHeight);
        }
        renderExtraPaneKeysArr.forEach((_, idx) => {
          const c = extraContainersRef.current[idx];
          if (c) charts[idx + 1].resize(c.clientWidth, c.clientHeight);
        });
      });
      
      if (containerRef.current) roRef.current.observe(containerRef.current);

      chartsRef.current = charts;
    } else {
      // SOFT DATA UPDATE ONLY: Preserves Zoom and manual Y-Scale
      if (mainCandleRef.current) {
        mainCandleRef.current.setData(data as any);
        if (markers.length) mainCandleRef.current.setMarkers(markers as any);
      }
      
      if (mainVolRef.current && showVolume) {
        mainVolRef.current.setData(data.map(d => ({
          time: (d as any).time,
          value: (d as any).volume,
          color: d.close >= d.open ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)',
        })) as any);
      }

      indicators.forEach(ind => {
        const line = seriesMapRef.current.get(ind.id);
        if (line) {
          const cleanData = ind.values.map(v => {
            if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
              return { time: v.time, value: Number(v.value) };
            }
            return { time: v.time };
          });
          
          if (ind.key.includes('RSI') && !ind.key.includes('_MA')) {
             const upperBound = ind.config.upperBound !== undefined ? ind.config.upperBound : 70;
             const lowerBound = ind.config.lowerBound !== undefined ? ind.config.lowerBound : 30;
             const rsiColoredData = cleanData.map(v => {
               if ('value' in v) {
                 const val = (v as any).value;
                 let ptColor = undefined;
                 if (val > upperBound) ptColor = '#f85149';
                 else if (val < lowerBound) ptColor = '#3fb950';
                 return { time: v.time, value: val, color: ptColor };
               }
               return { time: v.time };
             });
             line.setData(rsiColoredData as any);
          } else {
             line.setData(cleanData as any);
          }
          line.applyOptions({ visible: ind.config.visible !== false });
        }

        if (ind.extraValues) {
          const lineExtra = seriesMapRef.current.get(ind.id + '_extra');
          if (lineExtra) {
            const cleanDataExtra = ind.extraValues.map(v => {
              if ('value' in v && v.value !== undefined && v.value !== null && !isNaN(v.value as number)) {
                return { time: v.time, value: Number(v.value) };
              }
              return { time: v.time };
            });
            lineExtra.setData(cleanDataExtra as any);
            lineExtra.applyOptions({ visible: ind.config.visible !== false });
          }
        }
      });
    }
  }, [data, markers, indicators, showVolume, theme]);

  // Real unmount cleanup 
  useEffect(() => {
    return () => {
      if (roRef.current) roRef.current.disconnect();
      chartsRef.current.forEach(c => c.remove());
    };
  }, []);

  function renderInlineOverlay(inds: StockIndicator[]) {
    return (
      <div className={styles.inlineIndicators}>
        {inds.map(ind => {
          const val = indicatorValues[ind.id];
          const isVisible = ind.config.visible !== false;
          return (
            <div key={ind.key} className={styles.indicatorRow}>
              <span className={styles.indicatorTitle}>{ind.config.type} {ind.config.period}</span>
              {val && (
                <span className={styles.indicatorValue}>
                  {(() => {
                    if (typeof val === 'string' && val.includes(' / ')) {
                      const parts = val.split(' / ');
                      if (ind.config.type === 'Alligator' && parts.length === 3) {
                        return (
                          <>
                            <span style={{ color: ind.config.jawColor || ind.color || '#1848bb' }}>{parts[0]}</span>
                            <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>/</span>
                            <span style={{ color: ind.config.teethColor || '#e2323e' }}>{parts[1]}</span>
                            <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>/</span>
                            <span style={{ color: ind.config.lipsColor || '#12aa52' }}>{parts[2]}</span>
                          </>
                        );
                      }
                      if (parts.length >= 2) {
                        return (
                          <>
                            <span style={{ color: ind.color }}>{parts[0]}</span>
                            <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>/</span>
                            <span style={{ color: ind.config.botColor || '#f44336' }}>{parts[1]}</span>
                          </>
                        );
                      }
                    }
                    return <span style={{ color: ind.color }}>{val}</span>;
                  })()}
                </span>
              )}
              <div className={styles.indicatorActions}>
                <button 
                  className={styles.actionBtn} 
                  title={isVisible ? "Скрыть" : "Показать"}
                  onClick={() => onUpdateIndicator?.({ ...ind.config, visible: !isVisible })}
                >
                  {isVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <button 
                  className={styles.actionBtn} 
                  title="Настройки"
                  onClick={() => onSettingsClick?.(ind.config)}
                >
                  <GearIcon />
                </button>
                <button 
                  className={styles.actionBtn}
                  title="Удалить"
                  onClick={() => onRemoveIndicator?.(ind.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.chart}
      style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--color-border)' }}
    >
      <div className={styles.paneContainer} style={{ flex: 1, minHeight: '300px' }}>
        <div ref={mainChartContainerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
        {renderInlineOverlay(mainIndicators)}
      </div>
      
      {renderExtraPaneKeys.map((key, idx) => (
        <div key={key} className={styles.paneContainer} style={{ height: '25%', minHeight: '150px' }}>
          <div 
            ref={(el) => { extraContainersRef.current[idx] = el; }} 
            style={{ width: '100%', height: '100%', position: 'absolute' }}
          />
          {renderInlineOverlay(extraPanesMap.get(key) || [])}
        </div>
      ))}
    </div>
  );
}
