import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.globalRole !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
