import { useParams } from 'react-router-dom';

export function TaskDetailView() {
  const { id } = useParams<{ id: string }>();
  return <div>Задача: {id}</div>;
}
