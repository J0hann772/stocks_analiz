// In Docker: browser → Next.js (port 3000) → rewrites → api:8000.
// API_URL is empty so all requests go to the same origin (/api/v1/...).
// In pure local dev (no Docker), set NEXT_PUBLIC_API_URL=http://localhost:8000.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = res.statusText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detail = parsed.detail;
    } catch (e) {}
    throw new Error(detail || 'API error');
  }

  // Если 204 No Content (часто при DELETE), не парсим JSON
  if (res.status === 204) {
    return null as unknown as T;
  }
  
  const text = await res.text();
  return text ? JSON.parse(text) : (null as unknown as T);
}

// ─── Auth ───────────────────────────────────────
export const authApi = {
  login: (email: string, password: string, admin_password?: string) =>
    request<{ access_token: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, admin_password: admin_password || '' }),
    }),
  register: (email: string, password: string, admin_password?: string) =>
    request<{ id: number; email: string }>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, admin_password: admin_password || '' }),
    }),
  updateTimezone: (timezone: string, token: string) =>
    request<any>(`/users/me/timezone?timezone=${timezone}&token=${token}`, {
      method: 'PUT',
    }),
};

// ─── Strategies ─────────────────────────────────
export const strategiesApi = {
  list: (userId: number) => request<any[]>(`/strategies/?user_id=${userId}`),
  create: (userId: number, data: any) =>
    request<any>(`/strategies/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    request<any>(`/strategies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/strategies/${id}`, { method: 'DELETE' }),
};

// ─── Scanner ─────────────────────────────────────
export const scannerApi = {
  scan: (params: any) =>
    request<any[]>('/scanner/scan', { method: 'POST', body: JSON.stringify(params) }),
};

// ─── Charts ──────────────────────────────────────
export const chartsApi = {
  getOHLCV: (symbol: string, timeframe = '1day', from?: string, to?: string) => {
    const params = new URLSearchParams({ timeframe });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<any[]>(`/charts/${symbol}?${params}`);
  },
  getQuote: (symbol: string) => request<any[]>(`/charts/quote/${symbol}`),
};

// ─── Drawings (Logical Coordinates) ────────────────────────────────────
export const drawingsApi = {
  get: (symbol: string) => 
    request<any[]>(`/drawings/${symbol}`),
  save: (symbol: string, drawings: any[]) => 
    request<any[]>(`/drawings/${symbol}`, { 
      method: 'POST', 
      body: JSON.stringify(drawings) 
    }),
  delete: (symbol: string) => 
    request<void>(`/drawings/${symbol}`, { method: 'DELETE' }),
};

// ─── Portfolio ───────────────────────────────────
export const portfolioApi = {
  get: () => request<any[]>('/portfolio'),
  add: (symbol: string, asset_type: string) =>
    request<any>('/portfolio', {
      method: 'POST',
      body: JSON.stringify({ symbol, asset_type }),
    }),
  delete: (symbol: string) =>
    request<void>(`/portfolio/${symbol}`, { method: 'DELETE' }),
};

// ─── Backtest ────────────────────────────────────
export const backtestApi = {
  run: (symbol: string, asset_type: string, from_date?: string, to_date?: string) => {
    const params = new URLSearchParams({ asset_type });
    if (from_date) params.set('from_date', from_date);
    if (to_date) params.set('to_date', to_date);
    return request<any>(`/backtest/${symbol}?${params}`, { method: 'POST' });
  }
};
