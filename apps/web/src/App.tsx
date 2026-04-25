import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { InvitationPage } from './pages/InvitationPage';
// DashboardPage now accessed via SpacesListPage
import { SpacePage } from './pages/SpacePage';
import { SpaceOverviewPage } from './pages/SpaceOverviewPage';
import { useParams } from 'react-router-dom';
import { SpaceSettingsPage } from './pages/SpaceSettingsPage';
import { SpaceHistoryPage } from './pages/SpaceHistoryPage';
import { CommunitySettingsPage } from './pages/CommunitySettingsPage';
import { CommunityPage } from './pages/CommunityPage';
import { GlobalTasksPage } from './pages/GlobalTasksPage';
import { GlobalLinksPage } from './pages/GlobalLinksPage';
import { ActivityPage } from './pages/ActivityPage';
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
import { PerfPage } from './pages/admin/PerfPage';
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
  const { search } = useLocation();
  return <Navigate to={`/spaces/${spaceId}${search}`} replace />;
}

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/login$/, 'pages/LoginPage.tsx'],
  [/^\/register$/, 'pages/RegisterPage.tsx'],
  [/^\/forgot-password$/, 'pages/ForgotPasswordPage.tsx'],
  [/^\/reset-password$/, 'pages/ResetPasswordPage.tsx'],
  [/^\/verify-email$/, 'pages/VerifyEmailPage.tsx'],
  [/^\/invitation$/, 'pages/InvitationPage.tsx'],
  [/^\/sitemap$/, 'pages/SitemapPage.tsx'],
  [/^\/communities$/, 'pages/CommunitiesListPage.tsx \u2192 views/CommunityListView.tsx'],
  [/^\/spaces$/, 'pages/SpacesListPage.tsx'],
  [/^\/dashboard$/, 'pages/DashboardViewPage.tsx'],
  [/^\/graph$/, 'pages/GraphPage.tsx'],
  [/^\/sunburst$/, 'pages/SunburstPage.tsx'],
  [/^\/mindmap$/, 'pages/MindMapPage.tsx'],
  [/^\/tasks$/, 'pages/GlobalTasksPage.tsx'],
  [/^\/links$/, 'pages/GlobalLinksPage.tsx'],
  [/^\/bookmarks$/, 'pages/BookmarksPage.tsx'],
  [/^\/search$/, 'pages/SearchPage.tsx'],
  [/^\/spaces\/[^/]+\/content$/, 'pages/SpacePage.tsx'],
  [/^\/spaces\/[^/]+\/settings$/, 'pages/SpaceSettingsPage.tsx'],
  [/^\/spaces\/[^/]+\/history$/, 'pages/SpaceHistoryPage.tsx'],
  [/^\/spaces\/[^/]+$/, 'pages/SpacePage.tsx \u2192 views/OverviewView.tsx'],
  [/^\/communities\/[^/]+\/settings$/, 'pages/CommunitySettingsPage.tsx'],
  [/^\/communities\/[^/]+$/, 'pages/CommunityPage.tsx'],
  [/^\/admin\/users$/, 'pages/admin/UsersPage.tsx'],
  [/^\/admin\/spaces$/, 'pages/admin/SpacesPage.tsx'],
  [/^\/admin\/communities$/, 'pages/admin/CommunitiesPage.tsx'],
  [/^\/admin\/anomalies$/, 'pages/admin/AnomaliesPage.tsx'],
  [/^\/admin\/referentiels$/, 'pages/admin/ReferentielsPage.tsx'],
  [/^\/admin\/stats$/, 'pages/admin/StatsPage.tsx'],
  [/^\/admin\/audit-logs$/, 'pages/admin/AuditLogsPage.tsx'],
  [/^\/admin\/views$/, 'pages/admin/ViewsConfigPage.tsx'],
  [/^\/admin\/menu$/, 'pages/admin/MenuConfigPage.tsx'],
  [/^\/$/, 'pages/HomePage.tsx \u2192 views/HomeView.tsx'],
];

export { PAGE_NAMES };

function DevPageName() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [path, setPath] = useState(location.pathname);
  const [devMode, setDevMode] = useState(() => localStorage.getItem('devMode') === 'true');

  useEffect(() => {
    setPath(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: Event) => setDevMode((e as CustomEvent).detail);
    window.addEventListener('spok:devmode', handler);
    return () => window.removeEventListener('spok:devmode', handler);
  }, []);

  if (!devMode) return null;

  let name = PAGE_NAMES.find(([re]) => re.test(path))?.[1];
  // Disambiguate home route based on auth state
  if (path === '/' && name) {
    name = isAuthenticated ? 'pages/HomePage.tsx \u2192 views/HomeView.tsx' : 'pages/LandingPage.tsx';
  }
  return (
    <>
      <div className="fixed bottom-1 right-1 z-[9999] bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono select-all cursor-pointer" onClick={(e) => { navigator.clipboard.writeText((e.target as HTMLElement).textContent || ''); }}>
        {name || path} — {path}
      </div>
    </>
  );
}

export default function App() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = () => {
      logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout, navigate]);

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
        <Route path="activity" element={<ActivityPage />} />
        <Route path="links" element={<GlobalLinksPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="spaces/:spaceId" element={<SpacePage />} />
        <Route path="spaces/:spaceId/overview" element={<SpaceOverviewPage />} />
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
        <Route path="admin/perf" element={<AdminRoute><PerfPage /></AdminRoute>} />
      </Route>
    </Routes>
  </>
  );
}
