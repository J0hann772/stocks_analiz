import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../lib/api';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, admin_password?: string) => Promise<any>;
  register: (email: string, password: string, admin_password?: string) => Promise<any>;
  logout: () => void;
  setToken: (token: string | null) => void;
}

interface TickerState {
  activeTickers: string[];
  addTicker: (symbol: string) => void;
  removeTicker: (symbol: string) => void;
  clearTickers: () => void;
}

type AppStore = AuthState & TickerState;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Auth State
      token: null,
      isAuthenticated: false,
      loading: true, // Initially true until hydration completes
      
      setToken: (token) => set({ token, isAuthenticated: !!token, loading: false }),
      
      login: async (email, password, admin_password) => {
        const data = await authApi.login(email, password, admin_password);
        set({ token: data.access_token, isAuthenticated: !!data.access_token, loading: false });
        return data;
      },
      
      register: async (email, password, admin_password) => {
        const data = await authApi.register(email, password, admin_password);
        const loginData = await authApi.login(email, password, admin_password);
        set({ token: loginData.access_token, isAuthenticated: !!loginData.access_token, loading: false });
        return data;
      },
      
      logout: () => set({ token: null, isAuthenticated: false, loading: false }),
      
      // Tickers State
      activeTickers: [],
      addTicker: (symbol) => 
        set((state) => ({
          activeTickers: state.activeTickers.includes(symbol) 
            ? state.activeTickers 
            : [...state.activeTickers, symbol]
        })),
      removeTicker: (symbol) => 
        set((state) => ({
          activeTickers: state.activeTickers.filter(t => t !== symbol)
        })),
      clearTickers: () => set({ activeTickers: [] }),
    }),
    {
      name: 'stock-analyzer-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ 
        token: state.token, 
        isAuthenticated: state.isAuthenticated,
        activeTickers: state.activeTickers
      }), // only save these fields
      onRehydrateStorage: () => (state) => {
        // Once state is hydrated from localStorage, set loading to false
        if (state) {
          state.loading = false;
        }
      },
    }
  )
);
