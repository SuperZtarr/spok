import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { InvitationPage } from './pages/InvitationPage';
import { LandingPage } from './pages/LandingPage';
// DashboardPage now accessed via SpacesListPage
import { SpacePage } from './pages/SpacePage';
import { SpaceOverviewPage } from './pages/SpaceOverviewPage';
import { SpaceSettingsPage } from './pages/SpaceSettingsPage';
import { SpaceHistoryPage } from './pages/SpaceHistoryPage';
import { CommunitySettingsPage } from './pages/CommunitySettingsPage';
import { CommunityPage } from './pages/CommunityPage';
import { GlobalTasksPage } from './pages/GlobalTasksPage';
import { Layout } from './components/Layout';
// AdminLayout removed — admin pages now inside main Layout
import { AdminRoute } from './components/AdminRoute';
import { UsersPage } from './pages/admin/UsersPage';
import { SpacesPage } from './pages/admin/SpacesPage';
import { CommunitiesPage } from './pages/admin/CommunitiesPage';
import { AnomaliesPage } from './pages/admin/AnomaliesPage';
import { ReferentielsPage } from './pages/admin/ReferentielsPage';
import { StatsPage } from './pages/admin/StatsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ViewsConfigPage } from './pages/admin/ViewsConfigPage';
import { SitemapPage } from './pages/SitemapPage';
import { SearchPage } from './pages/SearchPage';
import { HomePage } from './pages/HomePage';
import { CommunitiesListPage } from './pages/CommunitiesListPage';
import { SpacesListPage } from './pages/SpacesListPage';
import { DashboardViewPage } from './pages/DashboardViewPage';
import { GraphPage } from './pages/GraphPage';
import { SunburstPage } from './pages/SunburstPage';
import { MindMapPage } from './pages/MindMapPage';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function HomeRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Root → landing page
    if (location.pathname === '/') return <LandingPage />;

    // Protected paths → redirect to login
    if (location.pathname === '/tasks' ||
        location.pathname.includes('/settings') ||
        location.pathname.includes('/history')) {
      return <Navigate to="/login" replace />;
    }

    // Public paths (communities, spaces) → Layout in anonymous mode
  }

  return <Layout />;
}

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/login$/, 'LoginPage'],
  [/^\/register$/, 'RegisterPage'],
  [/^\/forgot-password$/, 'ForgotPasswordPage'],
  [/^\/reset-password$/, 'ResetPasswordPage'],
  [/^\/verify-email$/, 'VerifyEmailPage'],
  [/^\/invitation$/, 'InvitationPage'],
  [/^\/sitemap$/, 'SitemapPage'],
  [/^\/communities$/, 'CommunitiesListPage'],
  [/^\/spaces$/, 'SpacesListPage'],
  [/^\/dashboard$/, 'DashboardViewPage'],
  [/^\/graph$/, 'GraphPage'],
  [/^\/sunburst$/, 'SunburstPage'],
  [/^\/mindmap$/, 'MindMapPage'],
  [/^\/tasks$/, 'GlobalTasksPage'],
  [/^\/search$/, 'SearchPage'],
  [/^\/spaces\/[^/]+\/content$/, 'SpacePage'],
  [/^\/spaces\/[^/]+\/settings$/, 'SpaceSettingsPage'],
  [/^\/spaces\/[^/]+\/history$/, 'SpaceHistoryPage'],
  [/^\/spaces\/[^/]+$/, 'SpaceOverviewPage'],
  [/^\/communities\/[^/]+\/settings$/, 'CommunitySettingsPage'],
  [/^\/communities\/[^/]+$/, 'CommunityPage'],
  [/^\/admin\/users$/, 'Admin/UsersPage'],
  [/^\/admin\/spaces$/, 'Admin/SpacesPage'],
  [/^\/admin\/communities$/, 'Admin/CommunitiesPage'],
  [/^\/admin\/anomalies$/, 'Admin/AnomaliesPage'],
  [/^\/admin\/referentiels$/, 'Admin/ReferentielsPage'],
  [/^\/admin\/stats$/, 'Admin/StatsPage'],
  [/^\/admin\/audit-logs$/, 'Admin/AuditLogsPage'],
  [/^\/admin\/views$/, 'Admin/ViewsConfigPage'],
  [/^\/$/, 'HomePage / LandingPage'],
];

export { PAGE_NAMES };

function DevPageName() {
  const location = useLocation();
  const [path, setPath] = useState(location.pathname);

  useEffect(() => {
    setPath(location.pathname);
  }, [location.pathname]);

  const isDevMode = !import.meta.env.PROD || localStorage.getItem('devMode') === 'true';
  if (!isDevMode) return null;

  const name = PAGE_NAMES.find(([re]) => re.test(path))?.[1];
  return (
    <>
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] bg-black/80 text-white text-lg font-bold px-4 py-1.5 rounded-lg pointer-events-none font-mono shadow-lg">
        {name || path}
      </div>
      <div className="fixed bottom-1 left-1 z-[9999] bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none font-mono">
        {path}
      </div>
    </>
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
    <DevPageName />
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
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invitation" element={<InvitationPage />} />
      <Route path="/sitemap" element={<SitemapPage />} />
      <Route
        path="/"
        element={<HomeRoute />}
      >
        <Route index element={<HomePage />} />
        <Route path="communities" element={<CommunitiesListPage />} />
        <Route path="spaces" element={<SpacesListPage />} />
        <Route path="dashboard" element={<DashboardViewPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="sunburst" element={<SunburstPage />} />
        <Route path="mindmap" element={<MindMapPage />} />
        <Route path="tasks" element={<GlobalTasksPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="spaces/:spaceId" element={<SpaceOverviewPage />} />
        <Route path="spaces/:spaceId/content" element={<SpacePage />} />
        <Route path="spaces/:spaceId/settings" element={<SpaceSettingsPage />} />
        <Route path="spaces/:spaceId/history" element={<SpaceHistoryPage />} />
        <Route path="communities/:communityId" element={<CommunityPage />} />
        <Route path="communities/:communityId/settings" element={<CommunitySettingsPage />} />
        <Route path="admin" element={<AdminRoute><Navigate to="/admin/users" replace /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="admin/spaces" element={<AdminRoute><SpacesPage /></AdminRoute>} />
        <Route path="admin/communities" element={<AdminRoute><CommunitiesPage /></AdminRoute>} />
        <Route path="admin/anomalies" element={<AdminRoute><AnomaliesPage /></AdminRoute>} />
        <Route path="admin/referentiels" element={<AdminRoute><ReferentielsPage /></AdminRoute>} />
        <Route path="admin/stats" element={<AdminRoute><StatsPage /></AdminRoute>} />
        <Route path="admin/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
        <Route path="admin/views" element={<AdminRoute><ViewsConfigPage /></AdminRoute>} />
      </Route>
    </Routes>
  </>
  );
}
