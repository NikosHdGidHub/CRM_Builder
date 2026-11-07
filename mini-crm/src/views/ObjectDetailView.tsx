import { useParams } from 'react-router-dom';

export function ObjectDetailView() {
  const { objectId } = useParams<{ objectId: string }>();
  return <div>Объект: {objectId}</div>;
}