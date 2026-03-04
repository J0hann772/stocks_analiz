'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        await register(email, password, adminPassword);
      } else {
        await login(email, password, adminPassword);
      }
      window.location.href = '/scanner';
    } catch (err: any) {
      setError(err.message || 'Ошибка ' + (isRegistering ? 'регистрации' : 'входа'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logo}>📈</span>
          <h1 className={styles.title}>Stock Analyzer</h1>
          <p className={styles.subtitle}>
            {isRegistering ? 'Создайте аккаунт для начала работы' : 'Войдите в систему для продолжения'}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль admin (инвайт-код)</label>
            <input
              className={styles.input}
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              placeholder="admin"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : (isRegistering ? 'Зарегистрироваться' : 'Войти')}
          </button>
        </form>

        <div className={styles.toggleText}>
          {isRegistering ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'}{' '}
          <button 
            type="button" 
            className={styles.toggleBtn} 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          >
            {isRegistering ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
    </div>
  );
}
