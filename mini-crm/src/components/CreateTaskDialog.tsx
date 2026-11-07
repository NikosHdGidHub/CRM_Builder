import { useEffect, useState, type FormEvent } from 'react';
import { displayUser, listExecutors, type DirectoryUser } from '../services/usersService';
import { createTask, sendTask, updateTaskDraft } from '../services/tasksService';

export function CreateTaskDialog({
  objectId,
  onClose,
  onCreated,
}: {
  objectId: string;
  onClose: () => void;
  onCreated: (taskId: string, sent: boolean) => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [executorId, setExecutorId] = useState('');
  const [executors, setExecutors] = useState<DirectoryUser[]>([]);
  const [executorsLoading, setExecutorsLoading] = useState(true);
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
      .finally(() => { if (!cancelled) setExecutorsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function performSubmit(send: boolean) {
    setError(null);
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }
    if (send && !executorId) {
      setError('Перед отправкой выберите исполнителя');
      return;
    }

    setSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim() || null;

      const taskId = await createTask(trimmedTitle, trimmedDescription, objectId);

      if (executorId) {
        await updateTaskDraft({
          taskId,
          title: trimmedTitle,
          description: trimmedDescription,
          objectId,
          executorId,
        });
      }

      if (send) {
        await sendTask(taskId);
      }

      await onCreated(taskId, send);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать задачу');
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void performSubmit(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новая задача</h2>
        <form onSubmit={handleFormSubmit} className="stack">
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
              rows={3}
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
              disabled={executorsLoading || submitting}
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

          <div className="row row--between">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <div className="row">
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? '…' : 'Сохранить черновик'}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void performSubmit(true)}
                disabled={submitting || !executorId}
              >
                {submitting ? '…' : 'Сохранить и отправить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}