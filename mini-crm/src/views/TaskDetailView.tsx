import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { EditTaskDialog } from '../components/EditTaskDialog';
import { TransitionDialog } from '../components/TransitionDialog';
import { StatusBadge } from '../components/StatusBadge';
import { getObject } from '../services/objectsService';
import {
  getTask,
  getTaskHistory,
  sendTask,
  softDeleteTask,
  transitionTask,
} from '../services/tasksService';
import { displayUser, getUserDirectory, type DirectoryUser } from '../services/usersService';
import { taskStatusLabels } from '../types/db';
import type {
  ConstructionObject,
  Task,
  TaskStatus,
  TaskStatusHistoryEntry,
} from '../types/db';

function transitionLabel(from: TaskStatus | null, to: TaskStatus): string {
  if (from === null) return 'Создана';
  if (from === 'draft' && to === 'new') return 'Отправлена в работу';
  return `${taskStatusLabels[from]} → ${taskStatusLabels[to]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Busy = 'send' | 'transition' | 'delete' | null;

type PendingTransition =
  | { kind: 'send' }
  | { kind: 'accepted' }
  | { kind: 'revision' }
  | { kind: 'in_progress' }
  | { kind: 'in_review' };

const TRANSITION_TITLES: Record<Exclude<PendingTransition['kind'], 'send'>, string> = {
  accepted: 'Принять задачу',
  revision: 'Вернуть на доработку',
  in_progress: 'Взять в работу',
  in_review: 'Отправить на проверку',
};

const TRANSITION_LABELS: Record<Exclude<PendingTransition['kind'], 'send'>, string> = {
  accepted: 'Принять',
  revision: 'Вернуть на доработку',
  in_progress: 'Перевести в работу',
  in_review: 'Отправить на проверку',
};

export function TaskDetailView() {
  const { objectId, taskId } = useParams<{ objectId: string; taskId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [object, setObject] = useState<ConstructionObject | null>(null);
  const [history, setHistory] = useState<TaskStatusHistoryEntry[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<PendingTransition | null>(null);

  const isManager = profile?.role === 'manager';
  const isAssignee = task?.executor_id === profile?.id;

  const directoryMap = useMemo(() => {
    const m = new Map<string, DirectoryUser>();
    for (const u of directory) m.set(u.id, u);
    return m;
  }, [directory]);

  const load = useCallback(async () => {
    if (!taskId || !objectId) return;
    setLoading(true);
    setError(null);
    try {
      const [t, h, o] = await Promise.all([
        getTask(taskId),
        getTaskHistory(taskId),
        getObject(objectId).catch(() => null),
      ]);
      setTask(t);
      setHistory(h);
      setObject(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить задачу');
    } finally {
      setLoading(false);
    }
  }, [taskId, objectId]);

  useEffect(() => {
    // load() вызывает setState только после await, но правило этого не видит
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getUserDirectory()
      .then((list) => { if (!cancelled) setDirectory(list); })
      .catch(() => { /* не критично, покажем fallback */ });
    return () => { cancelled = true; };
  }, []);

  async function runAction(
    kind: Exclude<Busy, null>,
    action: () => Promise<void>,
  ) {
    setBusy(kind);
    try {
      await action();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  async function submitPending(comment: string | null) {
    if (!pending || !task) return;
    if (pending.kind === 'send') {
      await runAction('send', () => sendTask(task.id, comment));
    } else {
      await runAction('transition', () => transitionTask(task.id, pending.kind, comment));
    }
    setPending(null);
  }

  async function handleDelete() {
    if (!task) return;
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setBusy('delete');
    try {
      await softDeleteTask(task.id);
      navigate(`/objects/${objectId}`, { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить задачу');
      setBusy(null);
    }
  }

  function userLabel(userId: string): string {
    if (profile && userId === profile.id) return 'Вы';
    return displayUser(directoryMap.get(userId));
  }

  // Последний комментарий в истории — показываем под описанием.
  const lastComment = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const h = history[i];
      if (h.comment && h.comment.trim()) return h;
    }
    return null;
  }, [history]);

  const showRevisionBanner =
    task?.status === 'revision' &&
    lastComment !== null &&
    lastComment.to_status === 'revision';

  if (loading && !task) return <div className="page-loading">Загрузка…</div>;
  if (error) return <div className="error-alert">{error}</div>;
  if (!task) {
    return (
      <div className="empty-state">
        <h1>Задача не найдена</h1>
        <p className="muted">Возможно, она была удалена.</p>
        <Link to={`/objects/${objectId}`} className="btn" style={{ marginTop: 16 }}>
          ← К объекту
        </Link>
      </div>
    );
  }

  const canManagerEdit = isManager && task.status === 'draft';
  const canManagerSend = isManager && task.status === 'draft';
  const canManagerReview = isManager && task.status === 'in_review';
  const canManagerDelete = isManager;

  const canExecutorTake = isAssignee && task.status === 'new';
  const canExecutorSubmit = isAssignee && task.status === 'in_progress';
  const canExecutorResume = isAssignee && task.status === 'revision';

  const hasActions =
    canManagerEdit || canManagerSend || canManagerReview || canManagerDelete ||
    canExecutorTake || canExecutorSubmit || canExecutorResume;

  const transitionTitle = pending
    ? pending.kind === 'send'
      ? 'Отправить задачу исполнителю'
      : TRANSITION_TITLES[pending.kind]
    : '';
  const pendingButtonLabel = pending
    ? pending.kind === 'send'
      ? 'Отправить'
      : TRANSITION_LABELS[pending.kind]
    : '';
  const transitionRequired = pending?.kind === 'revision';
  const transitionVariant =
    pending?.kind === 'revision' ? 'danger' : 'primary';

  return (
    <div>
      <Link to={`/objects/${objectId}`} className="back-link">
        ← {object ? `К объекту «${object.name}»` : 'К объекту'}
      </Link>

      <div className="task-detail">
        <div className="task-detail__main">
          <div className="task-header">
            <h1>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>

          <dl className="task-meta">
            <dt>Объект</dt>
            <dd>
              {object ? (
                <Link to={`/objects/${objectId}`}>{object.name}</Link>
              ) : (
                '—'
              )}
            </dd>

            <dt>Исполнитель</dt>
            <dd>{task.executor_id ? userLabel(task.executor_id) : '—'}</dd>

            <dt>Автор</dt>
            <dd>{userLabel(task.created_by)}</dd>

            <dt>Создана</dt>
            <dd>{formatDateTime(task.created_at)}</dd>

            <dt>Обновлена</dt>
            <dd>{formatDateTime(task.updated_at)}</dd>
          </dl>

          {hasActions && (
            <div className="task-actions">
              {canManagerEdit && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(true)}
                  disabled={busy !== null}
                >
                  Редактировать
                </button>
              )}
              {canManagerSend && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPending({ kind: 'send' })}
                  disabled={busy !== null || !task.executor_id}
                  title={!task.executor_id ? 'Сначала назначьте исполнителя' : undefined}
                >
                  Отправить
                </button>
              )}
              {canManagerReview && (
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setPending({ kind: 'accepted' })}
                    disabled={busy !== null}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setPending({ kind: 'revision' })}
                    disabled={busy !== null}
                  >
                    Вернуть на доработку
                  </button>
                </>
              )}
              {canExecutorTake && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPending({ kind: 'in_progress' })}
                  disabled={busy !== null}
                >
                  Взять в работу
                </button>
              )}
              {canExecutorSubmit && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPending({ kind: 'in_review' })}
                  disabled={busy !== null}
                >
                  Отправить на проверку
                </button>
              )}
              {canExecutorResume && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPending({ kind: 'in_progress' })}
                  disabled={busy !== null}
                >
                  Вернуться в работу
                </button>
              )}
              {canManagerDelete && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => void handleDelete()}
                  disabled={busy !== null}
                  style={{ marginLeft: 'auto' }}
                >
                  {busy === 'delete' ? 'Удаляем…' : 'Удалить'}
                </button>
              )}
            </div>
          )}

          <div>
            <h2>Описание</h2>
            {task.description ? (
              <div className="task-description">{task.description}</div>
            ) : (
              <p className="muted">Описание не заполнено.</p>
            )}
          </div>

          {lastComment && (
            <div className={showRevisionBanner ? 'last-comment last-comment--attention' : 'last-comment'}>
              <div className="last-comment__head">
                <span className="last-comment__label">
                  {showRevisionBanner ? 'Что доработать' : 'Последний комментарий'}
                </span>
                <span className="last-comment__meta">
                  {userLabel(lastComment.changed_by)} · {formatDateTime(lastComment.created_at)}
                </span>
              </div>
              <div className="last-comment__text">{lastComment.comment}</div>
            </div>
          )}
        </div>

        <aside className="task-detail__side">
          <h2>История</h2>
          <div className="history">
            {history.length === 0 && (
              <p className="muted">Пока нет записей.</p>
            )}
            {history.map((h) => (
              <div key={h.id} className="history-item">
                <div className="history-item__head">
                  <span className="history-item__transition">
                    {transitionLabel(h.from_status, h.to_status)}
                  </span>
                  <span className="history-item__time">
                    {formatDateTime(h.created_at)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {userLabel(h.changed_by)}
                </div>
                {h.comment && (
                  <div className="history-item__comment">{h.comment}</div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {editing && (
        <EditTaskDialog
          task={task}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}

      {pending && (
        <TransitionDialog
          title={transitionTitle}
          submitLabel={pendingButtonLabel}
          commentRequired={transitionRequired}
          commentPlaceholder={
            pending.kind === 'revision'
              ? 'Что нужно доработать'
              : 'Можно оставить пустым'
          }
          submitVariant={transitionVariant}
          onClose={() => setPending(null)}
          onSubmit={submitPending}
        />
      )}
    </div>
  );
}