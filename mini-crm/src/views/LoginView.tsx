import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { signInWithPassword } from '../services/authService';

function mapAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(message)) {
    return 'Неверный email или пароль';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Email не подтверждён. Обратитесь к администратору.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Не удалось связаться с сервером. Проверьте интернет.';
  }
  return message || 'Не удалось войти';
}

export function LoginView() {
  const { status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="login-page">
        <div className="page-loading">Загрузка…</div>
      </div>
    );
  }

  // Если пользователь уже вошёл — на главную. HomeRedirect сам разведёт
  // по роли и наличию объектов.
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      // AuthProvider отреагирует на SIGNED_IN, status станет
      // 'authenticated', и компонент сам отрендерит <Navigate to="/" />.
    } catch (e) {
      setError(mapAuthError(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">mini-CRM</h1>
        <p className="muted login-subtitle">Вход для сотрудников</p>

        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </label>

          {error && <div className="error-alert">{error}</div>}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="muted login-hint">
          Нет аккаунта? Обратитесь к администратору — регистрация закрыта.
        </p>
      </div>
    </div>
  );
}