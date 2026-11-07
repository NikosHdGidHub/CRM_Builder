import { useParams } from 'react-router-dom';

export function TaskDetailView() {
  const { objectId, taskId } = useParams<{ objectId: string; taskId: string }>();
  return <div>Задача: {taskId} (объект {objectId})</div>;
}