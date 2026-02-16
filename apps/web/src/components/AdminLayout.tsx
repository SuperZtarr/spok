import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Users, ArrowLeft, FolderKanban, Building2, AlertTriangle, Settings, BarChart3, History } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../lib/api';
import { Button } from './ui/Button';

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshToken } = useAuthStore();

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      logout();
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Update document title
  useEffect(() => {
    const getPageTitle = () => {
      if (location.pathname === '/admin/users') return 'Utilisateurs';
      if (location.pathname === '/admin/spaces') return 'Espaces';
      if (location.pathname === '/admin/communities') return 'Communautes';
      if (location.pathname === '/admin/anomalies') return 'Diagnostics';
      if (location.pathname === '/admin/referentiels') return 'Referentiels';
      if (location.pathname === '/admin/stats') return 'Statistiques';
      if (location.pathname === '/admin/audit-logs') return 'Audit Logs';
      return 'Administration';
    };
    document.title = `SPOK Admin — ${getPageTitle()}`;
  }, [location.pathname]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <img src="/logo.png" alt="SPOK" className="w-full h-auto mb-3" />
          <div className="flex items-center justify-between p-2 rounded-md bg-accent/50">
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">Administrateur</p>
            </div>
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>

          <div className="pt-4">
            <span className="text-xs font-medium text-muted-foreground px-3 mb-2 block">
              Administration
            </span>

            <Link
              to="/admin/users"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/users')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <Users className="w-4 h-4" />
              Utilisateurs
            </Link>

            <Link
              to="/admin/spaces"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/spaces')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              Espaces
            </Link>

            <Link
              to="/admin/communities"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/communities')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Communautes
            </Link>

            <Link
              to="/admin/anomalies"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/anomalies')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Diagnostics
            </Link>

            <Link
              to="/admin/referentiels"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/referentiels')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Referentiels
            </Link>

            <Link
              to="/admin/stats"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/stats')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Statistiques
            </Link>

            <Link
              to="/admin/audit-logs"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/admin/audit-logs')
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <History className="w-4 h-4" />
              Audit Logs
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Deconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <main className="flex-1 overflow-auto min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
