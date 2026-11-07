import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useObjects } from '../app/ObjectsProvider';
import { StatusBadge } from '../components/StatusBadge';
import { useMyTasks } from '../hooks/useMyTasks';
import type { TaskStatus } from '../types/db';

type Filter = 'all' | 'active' | 'in_review' | 'revision';

const FILTERS: { key: Filter; label: string; statuses: TaskStatus[] | null }[] = [
  { key: 'all', label: 'Все', statuses: null },
  { key: 'active', label: 'В работе', statuses: ['new', 'in_progress'] },
  { key: 'in_review', label: 'На проверке', statuses: ['in_review'] },
  { key: 'revision', label: 'На доработке', statuses: ['revision'] },
];

export function MyTasksView() {
  const { tasks, loading, error } = useMyTasks();
  const { objects } = useObjects();
  const [filter, setFilter] = useState<Filter>('all');

  const objectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objects) m.set(o.id, o.name);
    return m;
  }, [objects]);

  const filteredTasks = useMemo(() => {
    const spec = FILTERS.find((f) => f.key === filter);
    if (!spec || !spec.statuses) return tasks;
    const allowed = new Set(spec.statuses);
    return tasks.filter((t) => allowed.has(t.status));
  }, [tasks, filter]);

  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (error) return <div className="error-alert">{error}</div>;

  return (
    <div className="stack">
      <div className="page-head">
        <h1 style={{ margin: 0 }}>Мои задачи</h1>
      </div>

      <div className="tabs">
        {FILTERS.map((f) => {
          const count =
            f.statuses === null
              ? tasks.length
              : tasks.filter((t) => f.statuses!.includes(t.status)).length;
          return (
            <button
              key={f.key}
              type="button"
              className={'tab' + (filter === f.key ? ' tab--active' : '')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="tab__count">{count}</span>
            </button>
          );
        })}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <p className="muted">
            {tasks.length === 0
              ? 'Менеджер ещё не поставил вам ни одной задачи.'
              : 'В этой категории задач нет.'}
          </p>
        </div>
      ) : (
        <div className="stack">
          {filteredTasks.map((t) => {
            const objectName = objectNames.get(t.object_id);
            return (
              <Link
                key={t.id}
                to={`/objects/${t.object_id}/tasks/${t.id}`}
                className="task-card"
              >
                <div className="task-card__head">
                  <div className="task-card__title">{t.title}</div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="task-card__meta muted">
                  {objectName ?? 'Объект'} · обновлена{' '}
                  {formatRelative(t.updated_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн назад`;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}