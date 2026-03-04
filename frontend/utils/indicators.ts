export function calculateSMA(data: { value?: number, time: any }[], period: number) {
  const result: { time: any; value?: number }[] = [];
  for (let i = 0; i < period - 1; i++) {
    if (data[i]) result.push({ time: data[i].time });
  }
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      if (data[i - j].value === undefined || Number.isNaN(data[i - j].value)) {
        valid = false;
        break;
      }
      sum += data[i - j].value as number;
    }
    if (valid) {
      result.push({ time: data[i].time, value: sum / period });
    } else {
      result.push({ time: data[i].time });
    }
  }
  return result;
}

export function calculateEMA(data: { value?: number, time: any }[], period: number) {
  const result: { time: any; value?: number }[] = [];
  
  // Find first valid value index
  let firstValidIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].value !== undefined && !Number.isNaN(data[i].value)) {
      firstValidIdx = i;
      break;
    }
  }

  if (firstValidIdx === -1 || data.length - firstValidIdx < period) {
    return data.map(d => ({ time: d.time }));
  }

  for (let i = 0; i < firstValidIdx + period - 1; i++) {
    result.push({ time: data[i].time });
  }

  const k = 2 / (period + 1);
  let ema = 0;
  
  // Initial SMA for first EMA value
  for (let i = firstValidIdx; i < firstValidIdx + period; i++) {
    ema += data[i].value as number;
  }
  ema = ema / period;
  result.push({ time: data[firstValidIdx + period - 1].time, value: ema });

  for (let i = firstValidIdx + period; i < data.length; i++) {
    if (data[i].value === undefined || Number.isNaN(data[i].value)) {
      result.push({ time: data[i].time });
    } else {
      ema = ((data[i].value as number) - ema) * k + ema;
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

export function calculateRSI(data: { value?: number, time: any }[], period: number = 14) {
  const result: { time: any; value?: number }[] = [];
  
  // Find first valid value index
  let firstValidIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].value !== undefined && !Number.isNaN(data[i].value)) {
      firstValidIdx = i;
      break;
    }
  }

  if (firstValidIdx === -1 || data.length - firstValidIdx <= period) {
    return data.map(d => ({ time: d.time }));
  }

  for (let i = 0; i < firstValidIdx + period; i++) {
    result.push({ time: data[i].time });
  }

  let avgGain = 0;
  let avgLoss = 0;
  let validCount = 0;
  let lastValidValue = data[firstValidIdx].value as number;

  // First period (need 'period' number of valid changes)
  let currentIndex = firstValidIdx + 1;
  while (validCount < period && currentIndex < data.length) {
    if (data[currentIndex].value !== undefined && !Number.isNaN(data[currentIndex].value)) {
      const currentValue = data[currentIndex].value as number;
      const diff = currentValue - lastValidValue;
      if (diff >= 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
      validCount++;
      lastValidValue = currentValue;
    }
    if (validCount < period) {
        result.push({ time: data[currentIndex].time });
    }
    currentIndex++;
  }

  if (validCount < period) {
      // Not enough data points
      while (currentIndex < data.length) {
          result.push({ time: data[currentIndex].time });
          currentIndex++;
      }
      return result;
  }

  avgGain /= period;
  avgLoss /= period;

  let rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
  let rsi = 100 - 100 / (1 + rs);
  result.push({ time: data[currentIndex - 1].time, value: rsi });

  // Smoothed Wilder's Moving Average
  for (let i = currentIndex; i < data.length; i++) {
    if (data[i].value === undefined || Number.isNaN(data[i].value)) {
      result.push({ time: data[i].time });
    } else {
      const currentValue = data[i].value as number;
      const diff = currentValue - lastValidValue;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
      rsi = 100 - 100 / (1 + rs);
      result.push({ time: data[i].time, value: rsi });
      lastValidValue = currentValue;
    }
  }
  return result;
}

export function calculateADX(data: { high?: number, low?: number, close?: number, time: any }[], period: number = 14, smoothing: number = 14) {
  const result: { time: any; value?: number }[] = [];
  
  if (data.length <= period) {
    return data.map(d => ({ time: d.time }));
  }

  // Calculate True Range (TR), +DM, -DM
  const tr: number[] = new Array(data.length).fill(0);
  const pDM: number[] = new Array(data.length).fill(0);
  const nDM: number[] = new Array(data.length).fill(0);

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;

    if (high === undefined || low === undefined || prevHigh === undefined || prevLow === undefined || prevClose === undefined) {
      continue;
    }

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    if (upMove > downMove && upMove > 0) pDM[i] = upMove;
    if (downMove > upMove && downMove > 0) nDM[i] = downMove;

    tr[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
  }

  // Wilder's Smoothing Function
  const wilderSmooth = (arr: number[], length: number) => {
    const smoothed = new Array(arr.length).fill(0);
    let sum = 0;
    for (let i = 1; i <= length; i++) {
      if (i < arr.length) sum += arr[i];
    }
    smoothed[length] = sum;
    for (let i = length + 1; i < arr.length; i++) {
      smoothed[i] = smoothed[i - 1] - (smoothed[i - 1] / length) + arr[i];
    }
    return smoothed;
  };

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPDM = wilderSmooth(pDM, period);
  const smoothedNDM = wilderSmooth(nDM, period);

  const dx: number[] = new Array(data.length).fill(0);
  for (let i = period; i < data.length; i++) {
    if (smoothedTR[i] === 0) continue;
    const diPlus = (smoothedPDM[i] / smoothedTR[i]) * 100;
    const diMinus = (smoothedNDM[i] / smoothedTR[i]) * 100;
    const diff = Math.abs(diPlus - diMinus);
    const sum = diPlus + diMinus;
    dx[i] = sum === 0 ? 0 : (diff / sum) * 100;
  }

  // First ADX is average of DX
  const adx: number[] = new Array(data.length).fill(0);
  const firstAdxIndex = period + smoothing - 1;
  
  if (firstAdxIndex < data.length) {
    let adxSum = 0;
    for (let i = period; i < period + smoothing; i++) {
        adxSum += dx[i];
    }
    adx[firstAdxIndex] = adxSum / smoothing;

    for (let i = firstAdxIndex + 1; i < data.length; i++) {
      adx[i] = (adx[i - 1] * (smoothing - 1) + dx[i]) / smoothing;
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (i < firstAdxIndex) {
      result.push({ time: data[i].time });
    } else {
      result.push({ time: data[i].time, value: adx[i] });
    }
  }

  return result;
}

export function calculateHHLL(
  data: { high?: number, low?: number, close?: number, time: any }[],
  topPeriod: number = 20,
  botPeriod: number = 20,
  topSrc: 'high' | 'low' | 'close' = 'high',
  botSrc: 'high' | 'low' | 'close' = 'low'
) {
  const topResult: { time: any; value?: number }[] = [];
  const botResult: { time: any; value?: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    const time = data[i].time;

    // Top Band (Highest High over topPeriod)
    if (i < topPeriod - 1) {
      topResult.push({ time });
    } else {
      let maxVal = -Infinity;
      let validTop = true;
      for (let j = 0; j < topPeriod; j++) {
        const val = data[i - j][topSrc];
        if (val === undefined || Number.isNaN(val)) {
          validTop = false;
          break;
        }
        maxVal = Math.max(maxVal, val);
      }
      if (validTop && maxVal !== -Infinity) {
        topResult.push({ time, value: maxVal });
      } else {
        topResult.push({ time });
      }
    }

    // Bottom Band (Lowest Low over botPeriod)
    if (i < botPeriod - 1) {
      botResult.push({ time });
    } else {
      let minVal = Infinity;
      let validBot = true;
      for (let j = 0; j < botPeriod; j++) {
        const val = data[i - j][botSrc];
        if (val === undefined || Number.isNaN(val)) {
          validBot = false;
          break;
        }
        minVal = Math.min(minVal, val);
      }
      if (validBot && minVal !== Infinity) {
        botResult.push({ time, value: minVal });
      } else {
        botResult.push({ time });
      }
    }
  }

  return { top: topResult, bot: botResult };
}

export function calculateATR(
  data: { high?: number; low?: number; close?: number; time: any }[],
  period: number = 14,
  smoothingType: 'RMA' | 'SMA' | 'EMA' | 'WMA' = 'RMA'
) {
  const result: { time: any; value?: number }[] = [];
  if (data.length === 0) return result;

  const tr: number[] = new Array(data.length).fill(0);
  
  // 1. Calculate True Range (TR)
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      const h = data[i].high;
      const l = data[i].low;
      if (h !== undefined && l !== undefined && !Number.isNaN(h) && !Number.isNaN(l)) {
         tr[i] = h - l;
      } else {
         tr[i] = 0;
      }
    } else {
      const h = data[i].high;
      const l = data[i].low;
      const pc = data[i - 1].close;

      if (h !== undefined && l !== undefined && pc !== undefined && !Number.isNaN(h) && !Number.isNaN(l) && !Number.isNaN(pc)) {
        tr[i] = Math.max(
          h - l,
          Math.abs(h - pc),
          Math.abs(l - pc)
        );
      } else {
        tr[i] = 0;
      }
    }
  }

  // 2. Smooth TR using the selected method
  const atr: number[] = new Array(data.length).fill(0);
  const firstValid = period - 1;

  if (firstValid < data.length) {
    if (smoothingType === 'SMA') {
      // Simple Moving Average
      for (let i = firstValid; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += tr[j];
        atr[i] = sum / period;
      }
    } else if (smoothingType === 'EMA') {
      // Exponential Moving Average (alpha = 2 / (period + 1))
      const alpha = 2 / (period + 1);
      let sum = 0;
      for (let i = 0; i < period; i++) sum += tr[i];
      atr[firstValid] = sum / period;
      for (let i = firstValid + 1; i < data.length; i++) {
        atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1];
      }
    } else if (smoothingType === 'WMA') {
      // Weighted Moving Average
      const wSum = (period * (period + 1)) / 2;
      for (let i = firstValid; i < data.length; i++) {
        let weighted = 0;
        for (let j = 0; j < period; j++) {
          weighted += tr[i - period + 1 + j] * (j + 1);
        }
        atr[i] = weighted / wSum;
      }
    } else {
      // RMA (default — Wilder's smoothing, alpha = 1/period)
      let sum = 0;
      for (let i = 0; i < period; i++) sum += tr[i];
      atr[firstValid] = sum / period;
      for (let i = firstValid + 1; i < data.length; i++) {
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
      }
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (i < firstValid) {
      result.push({ time: data[i].time });
    } else {
      result.push({ time: data[i].time, value: atr[i] });
    }
  }

  return result;
}
