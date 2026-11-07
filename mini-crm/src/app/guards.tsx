import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { homePathFor } from './homePath';
import type { AppRole } from '../types/db';

export function RequireAuth({ requiredRole }: { requiredRole?: AppRole }) {
  const { status, profile } = useAuth();

  if (status === 'loading') return <div>Загрузка…</div>;
  if (status === 'unauthenticated' || !profile) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={homePathFor(profile.role)} replace />;
  }
  return <Outlet />;
}
