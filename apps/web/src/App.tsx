import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { InvitationPage } from './pages/InvitationPage';
// DashboardPage now accessed via SpacesListPage
import { SpacePage } from './pages/SpacePage';
import { useParams } from 'react-router-dom';
import { SpaceSettingsPage } from './pages/SpaceSettingsPage';
import { SpaceHistoryPage } from './pages/SpaceHistoryPage';
import { CommunitySettingsPage } from './pages/CommunitySettingsPage';
import { CommunityPage } from './pages/CommunityPage';
import { GlobalTasksPage } from './pages/GlobalTasksPage';
import { GlobalLinksPage } from './pages/GlobalLinksPage';
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
import { MenuConfigPage } from './pages/admin/MenuConfigPage';
import { ApiDocPage } from './pages/admin/ApiDocPage';
import { ContactPage } from './pages/ContactPage';
import { BookmarksPage } from './pages/BookmarksPage';
import { SitemapPage } from './pages/SitemapPage';
import { SearchPage } from './pages/SearchPage';
import { HomePage } from './pages/HomePage';
import { CommunitiesListPage } from './pages/CommunitiesListPage';
import { SpacesListPage } from './pages/SpacesListPage';
import { DashboardViewPage } from './pages/DashboardViewPage';
import { GraphPage } from './pages/GraphPage';
import { SunburstPage } from './pages/SunburstPage';
import { MindMapPage } from './pages/MindMapPage';

function HomeRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Protected paths → redirect to login
    if (location.pathname === '/tasks' ||
        location.pathname === '/links' ||
        location.pathname === '/bookmarks' ||
        location.pathname.includes('/settings') ||
        location.pathname.includes('/history')) {
      return <Navigate to="/login" replace />;
    }

    // All other paths (including /) → Layout in anonymous mode (no sidebar on auth pages)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <Layout />;
}

// Redirect /spaces/:id/content → /spaces/:id
function SpaceContentRedirect() {
  const { spaceId } = useParams();
  return <Navigate to={`/spaces/${spaceId}`} replace />;
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
  [/^\/links$/, 'GlobalLinksPage'],
  [/^\/bookmarks$/, 'BookmarksPage'],
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
  [/^\/admin\/menu$/, 'Admin/MenuConfigPage'],
  [/^\/$/, 'HomePage / LandingPage'],
];

export { PAGE_NAMES };

function DevPageName() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [path, setPath] = useState(location.pathname);

  useEffect(() => {
    setPath(location.pathname);
  }, [location.pathname]);

  const isDevMode = !import.meta.env.PROD || localStorage.getItem('devMode') === 'true';
  if (!isDevMode) return null;

  let name = PAGE_NAMES.find(([re]) => re.test(path))?.[1];
  // Disambiguate home route based on auth state
  if (path === '/' && name) {
    name = isAuthenticated ? 'HomePage' : 'LandingPage';
  }
  return (
    <>
      <div className="fixed bottom-1 right-1 z-[9999] bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none font-mono">
        {name || path} — {path}
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
        path="/"
        element={<HomeRoute />}
      >
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="invitation" element={<InvitationPage />} />
        <Route path="sitemap" element={<SitemapPage />} />
        <Route path="communities" element={<CommunitiesListPage />} />
        <Route path="spaces" element={<SpacesListPage />} />
        <Route path="dashboard" element={<DashboardViewPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="sunburst" element={<SunburstPage />} />
        <Route path="mindmap" element={<MindMapPage />} />
        <Route path="tasks" element={<GlobalTasksPage />} />
        <Route path="links" element={<GlobalLinksPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="spaces/:spaceId" element={<SpacePage />} />
        <Route path="spaces/:spaceId/content" element={<SpaceContentRedirect />} />
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
        <Route path="admin/menu" element={<AdminRoute><MenuConfigPage /></AdminRoute>} />
        <Route path="admin/api-doc" element={<AdminRoute><ApiDocPage /></AdminRoute>} />
      </Route>
    </Routes>
  </>
  );
}
