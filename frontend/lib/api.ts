const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'API error');
  }
  return res.json();
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

// ─── Drawings ────────────────────────────────────
export const drawingsApi = {
  get: (symbol: string, timeframe: string) => 
    request<any>(`/drawings/${symbol}/${timeframe}`),
  save: (symbol: string, timeframe: string, drawings: any[]) => 
    request<any>(`/drawings/${symbol}/${timeframe}`, { 
      method: 'PUT', 
      body: JSON.stringify({ symbol, timeframe, drawings }) 
    }),
  delete: (symbol: string, timeframe: string) => 
    request<void>(`/drawings/${symbol}/${timeframe}`, { method: 'DELETE' }),
};
