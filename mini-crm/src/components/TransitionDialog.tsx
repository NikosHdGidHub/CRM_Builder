import { useState, type FormEvent } from 'react';

export function TransitionDialog({
  title,
  submitLabel,
  commentRequired,
  commentPlaceholder,
  submitVariant,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  commentRequired: boolean;
  commentPlaceholder?: string;
  submitVariant?: 'primary' | 'danger';
  onClose: () => void;
  onSubmit: (comment: string | null) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = comment.trim();
    if (commentRequired && !trimmed) {
      setError('Комментарий обязателен — объясните причину');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить переход');
      setSubmitting(false);
    }
  }

  const variantClass =
    submitVariant === 'danger' ? 'btn btn--danger' : 'btn btn--primary';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">
              {commentRequired ? 'Комментарий (обязателен)' : 'Комментарий (опционально)'}
            </span>
            <textarea
              className="input"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={commentPlaceholder}
              required={commentRequired}
              autoFocus
              disabled={submitting}
            />
          </label>
          {error && <div className="error-alert">{error}</div>}
          <div className="row row--end">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className={variantClass} disabled={submitting}>
              {submitting ? '…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}