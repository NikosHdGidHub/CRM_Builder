import { useState, type FormEvent } from 'react';

export function RevisionDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Комментарий обязателен — объясните, что нужно доработать');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(comment.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось вернуть задачу');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Вернуть на доработку</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">Комментарий для исполнителя</span>
            <textarea
              className="input"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
          </label>
          {error && <div className="error-alert">{error}</div>}
          <div className="row row--end">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn--danger" disabled={submitting}>
              {submitting ? 'Возвращаем…' : 'Вернуть на доработку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}