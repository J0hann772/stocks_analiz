import { useEffect, useRef, useState, useCallback } from 'react';

// Тип сообщения от FMP (нормализованный)
export interface FMPTckMessage {
  type: string; // "T" (Trade), "Q" (Quote), "B" (Break)
  s: string;    // symbol (например "AAPL")
  p: number;    // normalized price (lp for Trade/Break, ap or bp for Quote)
  t: number;    // timestamp
  v: number;    // normalized volume (ls)
  // Raw FMP fields
  lp?: number;  // last price (Trade/Break)
  ls?: number;  // last size (Trade/Break)
  ap?: number;  // ask price (Quote)
  bp?: number;  // bid price (Quote)
  as?: number;  // ask size (Quote)
  bs?: number;  // bid size (Quote)
}

export function useMarketWebsocket(symbols: string[]) {
  const [ticks, setTicks] = useState<Record<string, FMPTckMessage>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Стабилизируем зависимость через строку, чтобы избежать бесконечного реконнекта
  const symbolsKey = JSON.stringify(symbols);

  const connect = useCallback(() => {
    let wsUrl = '';
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      wsUrl = envUrl.replace(/^http/, 'ws') + '/api/v1/ws/market';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/v1/ws/market`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Market WS Connected');
      const parsedSymbols = JSON.parse(symbolsKey);
      if (parsedSymbols.length > 0) {
        ws.send(JSON.stringify({ action: 'subscribe', symbols: parsedSymbols }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // FMP отправляет type: "T" (Trade), "Q" (Quote), "B" (Break)
        if ((data.type === 'T' || data.type === 'Q' || data.type === 'B') && data.s) {
          // Нормализуем цену: lp для Trade/Break, ap или bp для Quote
          const price = data.lp ?? data.ap ?? data.bp ?? 0;
          const volume = data.ls ?? 0;
          
          const normalized: FMPTckMessage = {
            ...data,
            p: price,
            v: volume,
          };
          
          setTicks(prev => ({
            ...prev,
            [data.s]: normalized
          }));
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    ws.onclose = () => {
      console.log('Market WS Disconnected. Reconnecting in 3s...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('Market WS Error', err);
      ws.close();
    };
  }, [symbolsKey]); // Стабильная зависимость — строка, а не массив

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { ticks };
}
