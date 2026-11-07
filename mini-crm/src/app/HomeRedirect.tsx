import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useObjects } from './ObjectsProvider';

export function HomeRedirect() {
  const { status, profile } = useAuth();
  const { objects, loading } = useObjects();

  if (status === 'loading') return <div className="page-loading">Загрузка…</div>;
  if (!profile) return <Navigate to="/login" replace />;

  if (profile.role === 'executor') {
    return <Navigate to="/my-tasks" replace />;
  }

  if (loading && objects.length === 0) {
    return <div className="page-loading">Загрузка…</div>;
  }
  if (objects.length > 0) {
    return <Navigate to={`/objects/${objects[0].id}`} replace />;
  }
  return <Navigate to="/objects" replace />;
}