import { useEffect, useState, type FormEvent } from 'react';
import { displayUser, listExecutors, type DirectoryUser } from '../services/usersService';
import { updateTaskDraft } from '../services/tasksService';
import type { Task } from '../types/db';

export function EditTaskDialog({
  task,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [executorId, setExecutorId] = useState(task.executor_id ?? '');
  const [executors, setExecutors] = useState<DirectoryUser[]>([]);
  const [loadingExecutors, setLoadingExecutors] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listExecutors()
      .then((list) => { if (!cancelled) setExecutors(list); })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить исполнителей');
        }
      })
      .finally(() => { if (!cancelled) setLoadingExecutors(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }
    setSubmitting(true);
    try {
      await updateTaskDraft({
        taskId: task.id,
        title: title.trim(),
        description: description.trim() || null,
        objectId: task.object_id,
        executorId: executorId || null,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Редактировать задачу</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">Название</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
          </label>
          <label className="field">
            <span className="field__label">Описание</span>
            <textarea
              className="input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="field">
            <span className="field__label">Исполнитель</span>
            <select
              className="input"
              value={executorId}
              onChange={(e) => setExecutorId(e.target.value)}
              disabled={loadingExecutors || submitting}
            >
              <option value="">— не выбран —</option>
              {executors.map((u) => (
                <option key={u.id} value={u.id}>
                  {displayUser(u)}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="error-alert">{error}</div>}
          <div className="row row--end">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}