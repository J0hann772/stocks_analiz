'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { portfolioApi } from '@/lib/api';
import styles from './RightSidebar.module.css';

type AssetType = 'Stocks' | 'Crypto' | 'Forex';

interface PortfolioItem {
  id: number;
  symbol: string;
  asset_type: string;
}

export function RightSidebar() {
  const { isSidebarOpen, toggleSidebar } = useAppStore();
  const [activeTab, setActiveTab] = useState<AssetType>('Stocks');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  
  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const data = await portfolioApi.get();
      setItems(data);
    } catch (err) {
      console.error('Failed to load portfolio', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSidebarOpen) {
      fetchPortfolio();
    }
  }, [isSidebarOpen]);

  // Optionally, close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, toggleSidebar]);

  if (!isSidebarOpen) return null;

  const currentItems = items.filter(item => item.asset_type === activeTab);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    try {
      await portfolioApi.add(newSymbol.trim().toUpperCase(), activeTab);
      setNewSymbol('');
      await fetchPortfolio();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить тикер. Возможно он уже есть в портфеле.');
    }
  };

  const handleDelete = async (symbol: string) => {
    try {
      await portfolioApi.delete(symbol);
      setItems(prev => prev.filter(i => i.symbol !== symbol));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={toggleSidebar} />
      <div className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2>💼 Мой Портфель</h2>
          <button className={styles.closeBtn} onClick={toggleSidebar}>×</button>
        </div>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'Stocks' ? styles.active : ''}`}
            onClick={() => setActiveTab('Stocks')}
          >
            US Stocks
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'Crypto' ? styles.active : ''}`}
            onClick={() => setActiveTab('Crypto')}
          >
            Crypto 24/7
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'Forex' ? styles.active : ''}`}
            onClick={() => setActiveTab('Forex')}
          >
            Forex
          </button>
        </div>
        
        <div className={styles.content}>
          <form className={styles.addForm} onSubmit={handleAdd}>
            <input 
              className={styles.input}
              placeholder={`Добавить тикер (${activeTab})...`}
              value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
            />
            <button type="submit" className={styles.addBtn} disabled={!newSymbol.trim()}>
              +
            </button>
          </form>

          {loading ? (
            <div className={styles.emptyState}>Загрузка...</div>
          ) : currentItems.length === 0 ? (
            <div className={styles.emptyState}>
              В этой вкладке пока пусто.<br/>Добавьте свой первый тикер.
            </div>
          ) : (
            currentItems.map(item => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemSymbol}>{item.symbol}</div>
                <button 
                  className={styles.deleteBtn} 
                  onClick={() => handleDelete(item.symbol)}
                  title="Удалить"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
