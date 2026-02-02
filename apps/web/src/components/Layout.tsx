import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Home, FolderKanban, Plus, Shield, Search } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { spacesApi, authApi } from '../lib/api';
import { Button } from './ui/Button';
import { DevModeToggle, DevDbStatus } from './DevDbStatus';
import { ViewModeSelector } from './ViewModeSelector';
import { UserProfileModal } from './UserProfileModal';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshToken } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.list,
  });

  // Get current space from URL
  const spaceMatch = location.pathname.match(/\/spaces\/([^/]+)/);
  const currentSpaceId = spaceMatch ? spaceMatch[1] : null;
  const currentSpace = currentSpaceId ? spaces?.find(s => s.id === currentSpaceId) : null;

  // Page title based on current location
  const getPageTitle = () => {
    if (currentSpace) return currentSpace.name;
    if (location.pathname === '/') return 'Tableau de bord';
    return 'SPOK';
  };

  // Update document title
  useEffect(() => {
    const title = getPageTitle();
    document.title = title === 'SPOK' ? 'SPOK' : `${title} - SPOK`;
  }, [currentSpace, location.pathname]);

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
      <aside className="w-52 bg-card border-r border-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold">SPOK</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{user?.name}</p>
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Voir le profil"
            >
              <Search className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
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
          {user?.globalRole === 'ADMIN' && (
            <Link to="/admin">
              <Button variant="ghost" className="w-full justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Administration
              </Button>
            </Link>
          )}
          <DevModeToggle />
          <DevDbStatus />
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{getPageTitle()}</h2>
            {currentSpace && (
              <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                {currentSpace.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
              </span>
            )}
          </div>
          {currentSpace && <ViewModeSelector />}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
      />
    </div>
  );
}
