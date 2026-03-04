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
