import { useState, type FormEvent } from 'react';

export interface ObjectFormValues {
  name: string;
  address: string;
}

export function ObjectFormDialog({
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: ObjectFormValues;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: ObjectFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), address: address.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span className="field__label">Название</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
          </label>
          <label className="field">
            <span className="field__label">Адрес</span>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              disabled={submitting}
            />
          </label>
          {error && <div className="error-alert">{error}</div>}
          <div className="row row--end">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Сохраняем…' : (submitLabel ?? 'Сохранить')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}