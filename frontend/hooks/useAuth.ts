'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useAuth() {
  const store = useAppStore();
  const [hydrationLoading, setHydrationLoading] = useState(true);

  // Quick hydration fix for Next.js to avoid mismatches
  useEffect(() => {
    useAppStore.persist.rehydrate();
    setHydrationLoading(false);
  }, []);

  return { 
    token: store.token, 
    isAuthenticated: store.isAuthenticated, 
    loading: hydrationLoading || store.loading, 
    login: store.login, 
    register: store.register, 
    logout: store.logout 
  };
}

