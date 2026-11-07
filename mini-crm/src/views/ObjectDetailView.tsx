import { useParams } from 'react-router-dom';

export function ObjectDetailView() {
  const { id } = useParams<{ id: string }>();
  return <div>Объект: {id}</div>;
}
