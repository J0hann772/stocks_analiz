'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { strategiesApi } from '@/lib/api';
import type { Strategy, StrategyCreate } from '@/types';
import styles from './page.module.css';

const USER_ID = 1; // TODO: из auth
const INDICATOR_NAMES = ['RSI', 'SMA', 'EMA', 'ADX'];

function StrategyCard({ strategy, onDelete }: { strategy: Strategy; onDelete: () => void }) {
  const router = useRouter();
  const inds = Object.entries(strategy.indicators || {});
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardName}>{strategy.name}</h3>
          {strategy.description && <p className={styles.cardDesc}>{strategy.description}</p>}
        </div>
        <div className={styles.cardActions}>
          <button className={styles.btnScan}
            onClick={() => router.push(`/scanner`)}>🔍 Скан</button>
          <button className={styles.btnDelete} onClick={onDelete}>🗑</button>
        </div>
      </div>
      {inds.length > 0 && (
        <div className={styles.indTags}>
          {inds.map(([name, params]: any) => (
            <span key={name} className={styles.indTag}>
              {name} ({params.period}){params.min !== undefined ? ` ≥${params.min}` : ''}{params.max !== undefined ? ` ≤${params.max}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStrategyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [indicators, setIndicators] = useState<{ name: string; period: number; min?: number; max?: number }[]>([]);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: StrategyCreate) => strategiesApi.create(USER_ID, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategies'] }); onSaved(); },
  });

  function addIndicator() {
    setIndicators(prev => [...prev, { name: 'RSI', period: 14 }]);
  }

  function updateInd(i: number, field: string, value: any) {
    setIndicators(prev => prev.map((ind, idx) => idx === i ? { ...ind, [field]: value } : ind));
  }

  function removeInd(i: number) {
    setIndicators(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    const indsObj = Object.fromEntries(
      indicators.map(ind => [ind.name, { period: ind.period, ...(ind.min !== undefined ? { min: ind.min } : {}), ...(ind.max !== undefined ? { max: ind.max } : {}) }])
    );
    mutation.mutate({ name, description: desc, indicators: indsObj });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Новая стратегия</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Oversold RSI" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <textarea className={styles.textarea} value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Описание стратегии..." />
          </div>

          <div className={styles.indSection}>
            <div className={styles.indHeader}>
              <span className={styles.label}>Индикаторы</span>
              <button className={styles.addIndBtn} onClick={addIndicator}>+ Добавить</button>
            </div>
            {indicators.map((ind, i) => (
              <div key={i} className={styles.indRow}>
                <select className={styles.indSelect} value={ind.name} onChange={e => updateInd(i, 'name', e.target.value)}>
                  {INDICATOR_NAMES.map(n => <option key={n}>{n}</option>)}
                </select>
                <label className={styles.indLabel}>Period</label>
                <input className={styles.indInput} type="number" value={ind.period} onChange={e => updateInd(i, 'period', Number(e.target.value))} min={1} />
                <label className={styles.indLabel}>Min</label>
                <input className={styles.indInput} type="number" placeholder="—" value={ind.min ?? ''} onChange={e => updateInd(i, 'min', e.target.value ? Number(e.target.value) : undefined)} />
                <label className={styles.indLabel}>Max</label>
                <input className={styles.indInput} type="number" placeholder="—" value={ind.max ?? ''} onChange={e => updateInd(i, 'max', e.target.value ? Number(e.target.value) : undefined)} />
                <button className={styles.removeBtn} onClick={() => removeInd(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!name || mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StrategiesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['strategies', USER_ID],
    queryFn: () => strategiesApi.list(USER_ID),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => strategiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Стратегии</h1>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>+ Новая стратегия</button>
      </div>
      {isLoading ? (
        <div className={styles.loading}><span className="spinner" /></div>
      ) : strategies.length === 0 ? (
        <div className={styles.empty}>
          <p>Нет стратегий. Создайте первую!</p>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>+ Создать</button>
        </div>
      ) : (
        <div className={styles.list}>
          {strategies.map((s: any) => (
            <StrategyCard key={s.id} strategy={s} onDelete={() => deleteMutation.mutate(s.id)} />
          ))}
        </div>
      )}
      {showModal && <AddStrategyModal onClose={() => setShowModal(false)} onSaved={() => setShowModal(false)} />}
    </div>
  );
}
