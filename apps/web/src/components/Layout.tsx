import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Home, FolderKanban, Plus, Shield, User, Menu, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { spacesApi, authApi } from '../lib/api';
import { Button } from './ui/Button';
import { DevModeToggle, DevDbStatus } from './DevDbStatus';
import { ViewModeSelector } from './ViewModeSelector';
import { UserProfileModal } from './UserProfileModal';
import { CommunitySelector } from './CommunitySelector';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshToken } = useAuthStore();
  const { currentCommunity } = useCommunityStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Resizable sidebar (desktop only)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('spok-sidebar-width');
    return saved ? Math.max(160, Math.min(400, Number(saved))) : 208;
  });
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(160, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    localStorage.setItem('spok-sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Filter spaces by current community
  const { data: spaces } = useQuery({
    queryKey: ['spaces', currentCommunity?.id],
    queryFn: () => spacesApi.list(currentCommunity?.id || 'none'),
  });

  // Also fetch personal spaces (always visible)
  const { data: personalSpaces } = useQuery({
    queryKey: ['spaces', 'personal'],
    queryFn: () => spacesApi.list('none'),
    enabled: !!currentCommunity, // Only fetch when community is selected
  });

  // Separate personal and community/group spaces
  const { mySpaces, communitySpaces } = useMemo(() => {
    if (currentCommunity) {
      return {
        mySpaces: personalSpaces?.filter(s => s.type === 'PERSONAL') || [],
        communitySpaces: spaces || [],
      };
    }
    const all = spaces || [];
    return {
      mySpaces: all.filter(s => s.type === 'PERSONAL'),
      communitySpaces: all.filter(s => s.type !== 'PERSONAL'),
    };
  }, [currentCommunity, spaces, personalSpaces]);

  // Get current space from URL - fetch independently from sidebar list
  const spaceMatch = location.pathname.match(/\/spaces\/([^/]+)/);
  const currentSpaceId = spaceMatch ? spaceMatch[1] : null;
  const { data: currentSpace } = useQuery({
    queryKey: ['space', currentSpaceId],
    queryFn: () => spacesApi.get(currentSpaceId!),
    enabled: !!currentSpaceId,
  });

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

  // Sidebar content (shared between mobile and desktop)
  const sidebarContent = (
    <>
      {/* Header sidebar */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <img src="/logo.png" alt="SPOK" className="w-full h-auto mb-3" />
        <button
          onClick={() => setIsProfileOpen(true)}
          className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors text-left"
          title="Voir le profil"
        >
          <div>
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">
              {user?.globalRole === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}
            </p>
          </div>
          <User className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors"
        >
          <Home className="w-4 h-4" />
          Tableau de bord
        </Link>

        {/* Community Selector */}
        <div className="pt-2 pb-2 border-b border-border mb-2">
          <CommunitySelector />
        </div>

        {/* Personal spaces */}
        {mySpaces.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mes espaces</span>
            </div>
            {mySpaces.map((space) => (
              <Link
                key={space.id}
                to={`/spaces/${space.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${
                  currentSpaceId === space.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent'
                }`}
              >
                <FolderKanban className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{space.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Community / Group spaces */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {currentCommunity ? currentCommunity.name : 'Espaces de groupe'}
            </span>
            <Link to="/?new=space">
              <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </Link>
          </div>
          {communitySpaces.length > 0 ? (
            communitySpaces.map((space) => (
              <Link
                key={space.id}
                to={`/spaces/${space.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${
                  currentSpaceId === space.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent'
                }`}
              >
                <FolderKanban className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{space.name}</span>
              </Link>
            ))
          ) : (
            <p className="px-3 text-xs text-muted-foreground">Aucun espace</p>
          )}
        </div>
      </nav>

      {/* Footer sidebar */}
      <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
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
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop: static resizable, mobile: slide-over */}
      <aside
        className={`
          bg-card border-r border-border flex flex-col flex-shrink-0 h-full
          fixed md:relative z-50 md:z-auto
          transition-transform duration-200 md:transition-none md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: sidebarWidth }}
      >
        {/* Resize handle (desktop only) */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-10 hidden md:block"
          onMouseDown={handleMouseDown}
        />
        {/* Mobile close button */}
        <button
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent md:hidden z-20"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger menu (mobile) */}
            <button
              className="p-1 rounded-md hover:bg-accent md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold truncate">{getPageTitle()}</h2>
            {currentSpace && (
              <div className="hidden sm:flex items-center gap-2">
                {currentSpace.community && (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 text-primary rounded">
                    {currentSpace.community.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  {currentSpace.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
                </span>
              </div>
            )}
          </div>
          {currentSpace && <ViewModeSelector />}
        </header>

        {/* Page content - scrollable */}
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
