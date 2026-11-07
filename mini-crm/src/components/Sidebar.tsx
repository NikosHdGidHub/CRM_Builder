import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useObjects } from '../app/ObjectsProvider';
import { roleLabels } from '../types/db';
import { createObject } from '../services/objectsService';

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { objects, loading, error, refresh } = useObjects();
  const navigate = useNavigate();
  const { objectId } = useParams<{ objectId: string }>();
  const [creatingOpen, setCreatingOpen] = useState(false);

  if (!profile) return null;
  const isManager = profile.role === 'manager';

  async function handleCreate(name: string, address: string) {
    const id = await createObject(name, address);
    await refresh();
    navigate(`/objects/${id}`);
    setCreatingOpen(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <div className="sidebar__brand">mini-CRM</div>
        <div className="sidebar__user-name">
          {profile.display_name || profile.email}
        </div>
        <div className="sidebar__user-role">{roleLabels[profile.role]}</div>
      </div>

      {!isManager && (
        <nav className="sidebar__nav">
          <NavLink to="/my-tasks" className="sidebar__link sidebar__link--primary">
            Мои задачи
          </NavLink>
        </nav>
      )}

      <div className="sidebar__section-head">
        <span>Объекты</span>
        {isManager && (
          <button
            type="button"
            className="sidebar__add"
            title="Создать объект"
            onClick={() => setCreatingOpen(true)}
          >
            +
          </button>
        )}
      </div>

      <nav className="sidebar__nav sidebar__nav--grow">
        {loading && objects.length === 0 && (
          <div className="sidebar__hint">Загрузка…</div>
        )}
        {error && <div className="sidebar__hint sidebar__hint--error">{error}</div>}
        {!loading && !error && objects.length === 0 && (
          <div className="sidebar__hint">
            {isManager
              ? 'Пока нет объектов'
              : 'Нет объектов с вашими задачами'}
          </div>
        )}
        {objects.map((obj) => (
          <Link
            key={obj.id}
            to={`/objects/${obj.id}`}
            className={
              'sidebar__link' +
              (objectId === obj.id ? ' sidebar__link--active' : '')
            }
          >
            <div className="sidebar__link-title">{obj.name}</div>
            <div className="sidebar__link-sub">{obj.address}</div>
          </Link>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="sidebar__user-email">{profile.email}</div>
        <button
          type="button"
          className="sidebar__signout"
          onClick={() => void signOut()}
        >
          Выйти
        </button>
      </div>

      {creatingOpen && (
        <CreateObjectDialog
          onClose={() => setCreatingOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </aside>
  );
}

function CreateObjectDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, address: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), address.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать объект');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый объект</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">Название</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Адрес</span>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>
          {error && <div className="error-alert">{error}</div>}
          <div className="row row--end">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}