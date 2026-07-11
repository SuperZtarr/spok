/* Layout des pages /admin/* : navigation latérale admin + garde de rôle. */
import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, FolderKanban, Building2, AlertTriangle, Settings, BarChart3, History, Eye, LogOut, Shield, Search, Map as MapIcon, Activity } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../lib/api';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuthStore();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  useEffect(() => {
    const getPageTitle = () => {
      if (location.pathname === '/admin/users') return 'Utilisateurs';
      if (location.pathname === '/admin/spaces') return 'Espaces';
      if (location.pathname === '/admin/communities') return 'Communautes';
      if (location.pathname === '/admin/anomalies') return 'Diagnostics';
      if (location.pathname === '/admin/referentiels') return 'Referentiels';
      if (location.pathname === '/admin/views') return 'Vues';
      if (location.pathname === '/admin/stats') return 'Statistiques';
      if (location.pathname === '/admin/audit-logs') return 'Audit Logs';
      return 'Administration';
    };
    document.title = import.meta.env.DEV ? `[DEV] SPOK Admin — ${getPageTitle()}` : `SPOK Admin — ${getPageTitle()}`;
  }, [location.pathname]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            SPOK
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Administration
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          {user && <NotificationBell />}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-card border-r border-border flex flex-col flex-shrink-0">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Retour au site
            </Link>

            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 mb-1 block">Donnees</span>
            <Link
              to="/admin/communities"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/admin/communities') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <Building2 className="w-4 h-4" /> Communautes
            </Link>
            <Link
              to="/admin/spaces"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/admin/spaces') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Espaces
            </Link>
            <Link
              to="/admin/users"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive('/admin/users') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <Users className="w-4 h-4" /> Utilisateurs
            </Link>

            <div className="pt-3">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 mb-1 block">Outils</span>
              <Link
                to="/admin/stats"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/stats') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Statistiques
              </Link>
              <Link
                to="/admin/audit-logs"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/audit-logs') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <History className="w-4 h-4" /> Audit Logs
              </Link>
              <Link
                to="/admin/anomalies"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/anomalies') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Diagnostics
              </Link>
              <Link
                to="/admin/perf"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/perf') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <Activity className="w-4 h-4" /> Performances
              </Link>
            </div>

            <div className="pt-3">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 mb-1 block">Configuration</span>
              <Link
                to="/admin/views"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/views') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <Eye className="w-4 h-4" /> Vues
              </Link>
              <Link
                to="/admin/referentiels"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive('/admin/referentiels') ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                <Settings className="w-4 h-4" /> Referentiels
              </Link>
            </div>
          </nav>

          {/* User section */}
          {user && (
            <div className="border-t border-border p-3 space-y-1">
              <div className="flex items-center gap-2 px-3 py-2">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                    {(user.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <Link to="/search" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors">
                <Search className="w-3.5 h-3.5" /> Recherche
              </Link>
              <Link to="/sitemap" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors">
                <MapIcon className="w-3.5 h-3.5" /> Plan du site
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-destructive hover:bg-accent transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Deconnexion
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 bg-background">
          <main className="flex-1 overflow-auto min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
