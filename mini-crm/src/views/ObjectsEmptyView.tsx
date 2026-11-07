import { Link } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useObjects } from '../app/ObjectsProvider';

export function ObjectsEmptyView() {
  const { profile } = useAuth();
  const { objects, loading, error } = useObjects();

  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (error) return <div className="error-alert">{error}</div>;

  const isManager = profile?.role === 'manager';
  const hasObjects = objects.length > 0;

  return (
    <div className="empty-state">
      <h1>{hasObjects ? 'Выберите объект' : 'Пока нет объектов'}</h1>
      <p className="muted">
        {hasObjects
          ? 'Откройте объект в сайдбаре слева.'
          : isManager
            ? 'Создайте первый объект кнопкой «+» в разделе «Объекты».'
            : 'Менеджер ещё не поставил вам ни одной задачи.'}
      </p>
      {hasObjects && (
        <div className="stack" style={{ marginTop: 20 }}>
          {objects.map((o) => (
            <Link key={o.id} to={`/objects/${o.id}`} className="list-link">
              <div>{o.name}</div>
              <div className="muted">{o.address}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}