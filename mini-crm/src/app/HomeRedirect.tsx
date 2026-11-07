import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { homePathFor } from './homePath';

export function HomeRedirect() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <div>Загрузка…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(profile.role)} replace />;
}
