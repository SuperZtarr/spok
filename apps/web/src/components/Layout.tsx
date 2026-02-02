import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Home, FolderKanban, Plus } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { spacesApi, authApi } from '../lib/api';
import { Button } from './ui/Button';
import { DevModeToggle, DevDbStatus } from './DevDbStatus';

export function Layout() {
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuthStore();

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.list,
  });

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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold">SPOK</h1>
          <p className="text-sm text-muted-foreground">{user?.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </Link>

          <div className="pt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-sm font-medium text-muted-foreground">Espaces</span>
              <Link to="/?new=space">
                <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </Link>
            </div>

            {spaces?.map((space) => (
              <Link
                key={space.id}
                to={`/spaces/${space.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
              >
                <FolderKanban className="w-4 h-4" />
                <span className="truncate">{space.name}</span>
                {space.type === 'PERSONAL' && (
                  <span className="ml-auto text-xs text-muted-foreground">Perso</span>
                )}
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <DevModeToggle />
          <DevDbStatus />
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
}
