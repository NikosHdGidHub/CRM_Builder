import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useObjects } from '../app/ObjectsProvider';
import { ObjectFormDialog, type ObjectFormValues } from '../components/ObjectFormDialog';
import { CreateTaskDialog } from '../components/CreateTaskDialog';
import { StatusBadge } from '../components/StatusBadge';
import { getObject, softDeleteObject, updateObject } from '../services/objectsService';
import { listTasksByObject } from '../services/tasksService';
import type { ConstructionObject, Task } from '../types/db';

export function ObjectDetailView() {
  const { objectId } = useParams<{ objectId: string }>();
  const { profile } = useAuth();
  const { refresh: refreshObjects } = useObjects();
  const navigate = useNavigate();

  const [object, setObject] = useState<ConstructionObject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isManager = profile?.role === 'manager';

  const load = useCallback(async () => {
    if (!objectId) return;
    setLoading(true);
    setError(null);
    try {
      const [obj, t] = await Promise.all([
        getObject(objectId),
        listTasksByObject(objectId),
      ]);
      setObject(obj);
      setTasks(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить объект');
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleEdit(values: ObjectFormValues) {
    if (!objectId) return;
    await updateObject(objectId, values.name, values.address);
    await refreshObjects();
    await load();
    setEditing(false);
  }

  async function handleDelete() {
    if (!objectId || !object) return;
    if (!window.confirm(`Удалить объект «${object.name}»?\nВсе его задачи будут скрыты.`)) {
      return;
    }
    setDeleting(true);
    try {
      await softDeleteObject(objectId);
      await refreshObjects();
      navigate('/objects', { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить объект');
      setDeleting(false);
    }
  }

  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (error) return <div className="error-alert">{error}</div>;
  if (!object) {
    return (
      <div className="empty-state">
        <h1>Объект не найден</h1>
        <p className="muted">Возможно, он был удалён.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{object.name}</h1>
          <div className="muted">{object.address}</div>
        </div>
        {isManager && (
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(true)}
              disabled={deleting}
            >
              Редактировать
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Удаляем…' : 'Удалить'}
            </button>
          </div>
        )}
      </div>

      <div className="page-head page-head--tight">
        <h2>Задачи</h2>
        {isManager && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setCreatingTask(true)}
          >
            + Создать задачу
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p className="muted">
            {isManager
              ? 'На этом объекте пока нет задач. Создайте первую.'
              : 'На этом объекте у вас нет задач.'}
          </p>
        </div>
      ) : (
        <div className="stack">
          {tasks.map((t) => (
            <Link
              key={t.id}
              to={`/objects/${objectId}/tasks/${t.id}`}
              className="task-card"
            >
              <div className="task-card__head">
                <div className="task-card__title">{t.title}</div>
                <StatusBadge status={t.status} />
              </div>
              {t.description && (
                <div className="task-card__desc muted">{t.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}

      {editing && (
        <ObjectFormDialog
          title="Редактировать объект"
          initial={{ name: object.name, address: object.address }}
          submitLabel="Сохранить"
          onClose={() => setEditing(false)}
          onSubmit={handleEdit}
        />
      )}

      {creatingTask && objectId && (
        <CreateTaskDialog
          objectId={objectId}
          onClose={() => setCreatingTask(false)}
          onCreated={async (taskId, sent) => {
            await load();
            setCreatingTask(false);
            if (sent) {
              navigate(`/objects/${objectId}/tasks/${taskId}`);
            }
          }}
        />
      )}
    </div>
  );
}