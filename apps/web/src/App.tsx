import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';

function DevIndicator() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      document.title = '[DEV] SPOK';
      document.body.classList.add('dev-mode');
    }
    return () => {
      document.body.classList.remove('dev-mode');
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-2 right-2 z-[9999] bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded pointer-events-none opacity-80">
      DEV
    </div>
  );
}
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { SpacePage } from './pages/SpacePage';
import { SpaceSettingsPage } from './pages/SpaceSettingsPage';
import { SpaceHistoryPage } from './pages/SpaceHistoryPage';
import { CommunitySettingsPage } from './pages/CommunitySettingsPage';
import { CommunityPage } from './pages/CommunityPage';
import { GlobalTasksPage } from './pages/GlobalTasksPage';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { AdminRoute } from './components/AdminRoute';
import { UsersPage } from './pages/admin/UsersPage';
import { SpacesPage } from './pages/admin/SpacesPage';
import { CommunitiesPage } from './pages/admin/CommunitiesPage';
import { AnomaliesPage } from './pages/admin/AnomaliesPage';
import { ReferentielsPage } from './pages/admin/ReferentielsPage';
import { TestsPage } from './pages/admin/TestsPage';
import { StatsPage } from './pages/admin/StatsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function HomeRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

export default function App() {
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout]);

  return (
    <>
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={<HomeRoute />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<GlobalTasksPage />} />
        <Route path="spaces/:spaceId" element={<SpacePage />} />
        <Route path="spaces/:spaceId/settings" element={<SpaceSettingsPage />} />
        <Route path="spaces/:spaceId/history" element={<SpaceHistoryPage />} />
        <Route path="communities/:communityId" element={<CommunityPage />} />
        <Route path="communities/:communityId/settings" element={<CommunitySettingsPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="spaces" element={<SpacesPage />} />
        <Route path="communities" element={<CommunitiesPage />} />
        <Route path="anomalies" element={<AnomaliesPage />} />
        <Route path="referentiels" element={<ReferentielsPage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>
    </Routes>
    <DevIndicator />
  </>
  );
}
