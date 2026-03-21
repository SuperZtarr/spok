import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useAdminMode } from './DevDbStatus';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const adminMode = useAdminMode();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!adminMode) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
