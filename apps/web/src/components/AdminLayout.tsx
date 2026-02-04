import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Users, ArrowLeft, Shield, FolderKanban, Building2 } from 'lucide-react';
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
      return 'Administration';
    };
    document.title = `${getPageTitle()} - SPOK Admin`;
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">SPOK Admin</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{user?.name}</p>
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
      <div className="flex-1 flex flex-col bg-background">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
