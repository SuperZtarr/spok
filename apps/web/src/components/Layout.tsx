import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Home, FolderKanban, Plus, Shield, User, Menu, X, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { useThemeStore } from '../stores/theme';
import { spacesApi, authApi } from '../lib/api';
import { Button } from './ui/Button';
import { DevModeToggle, DevDbStatus } from './DevDbStatus';
import { ViewModeSelector } from './ViewModeSelector';
import { UserProfileModal } from './UserProfileModal';
import { CommunitySelector } from './CommunitySelector';
import { GlobalSearch } from './GlobalSearch';
import type { SpaceWithRole } from '@spok/shared';

interface SpaceTreeNode extends SpaceWithRole {
  children: SpaceTreeNode[];
}

function buildSpaceTree(spaces: SpaceWithRole[]): SpaceTreeNode[] {
  const map = new Map<string, SpaceTreeNode>();
  const roots: SpaceTreeNode[] = [];

  spaces.forEach(s => map.set(s.id, { ...s, children: [] }));
  spaces.forEach(s => {
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(map.get(s.id)!);
    } else {
      roots.push(map.get(s.id)!);
    }
  });

  return roots;
}

function SpaceTreeItem({
  node,
  level,
  currentSpaceId,
  expandedIds,
  onToggle,
}: {
  node: SpaceTreeNode;
  level: number;
  currentSpaceId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <>
      <div
        className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors text-sm ${
          currentSpaceId === node.id
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 rounded hover:bg-accent flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <Link
          to={`/spaces/${node.id}`}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <FolderKanban className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </Link>
      </div>
      {hasChildren && isExpanded && (
        node.children.map((child) => (
          <SpaceTreeItem
            key={child.id}
            node={child}
            level={level + 1}
            currentSpaceId={currentSpaceId}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))
      )}
    </>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshToken, updateUser } = useAuthStore();
  const { currentCommunity } = useCommunityStore();
  const { initTheme } = useThemeStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Expand/collapse state for space tree (persisted in localStorage)
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('spok-expanded-spaces');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggleSpaceExpand = useCallback((id: string) => {
    setExpandedSpaceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('spok-expanded-spaces', JSON.stringify([...next]));
      return next;
    });
  }, []);

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

  // Sync user from server on mount
  useEffect(() => {
    authApi.me().then((serverUser) => {
      if (serverUser) {
        updateUser(serverUser);
        initTheme(serverUser.themePreference || 'system');
      }
    }).catch(() => {
      // Token invalid — will be handled by 401 interceptor
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Separate personal and community/group spaces, then build trees
  const { mySpaces, communitySpaceTree } = useMemo(() => {
    const sortByName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

    let personalList: SpaceWithRole[];
    let groupList: SpaceWithRole[];

    if (currentCommunity) {
      personalList = (personalSpaces?.filter(s => s.type === 'PERSONAL') || []).sort(sortByName);
      groupList = (spaces || []).slice().sort(sortByName);
    } else {
      const all = spaces || [];
      personalList = all.filter(s => s.type === 'PERSONAL').sort(sortByName);
      groupList = all.filter(s => s.type !== 'PERSONAL').sort(sortByName);
    }

    return {
      mySpaces: personalList,
      communitySpaceTree: buildSpaceTree(groupList),
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

  // Page title based on current location (for header bar)
  const getPageTitle = () => {
    if (currentSpace) return currentSpace.name;
    if (location.pathname === '/') return 'Tableau de bord';
    return 'SPOK';
  };

  // Update document title
  useEffect(() => {
    const path = location.pathname;
    let title = 'SPOK';

    if (currentSpace) {
      if (path.endsWith('/settings')) {
        title = `SPOK — ${currentSpace.name} — Paramètres`;
      } else if (path.endsWith('/history')) {
        title = `SPOK — ${currentSpace.name} — Historique`;
      } else {
        title = `SPOK — ${currentSpace.name}`;
      }
    } else if (path === '/') {
      title = 'SPOK — Tableau de bord';
    } else if (path === '/community/settings') {
      title = 'SPOK — Paramètres communauté';
    }

    document.title = title;
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
        <Link to="/" className="block mb-3"><img src="/logo.png" alt="SPOK" className="w-full h-auto max-h-32 object-contain object-left" /></Link>
        <button
          onClick={() => setIsProfileOpen(true)}
          className={`w-full flex items-center p-2 rounded-md hover:bg-accent transition-colors text-left ${sidebarWidth < 200 ? 'justify-center' : 'justify-between'}`}
          title="Voir le profil"
        >
          {sidebarWidth >= 200 && (
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.globalRole === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}
              </p>
            </div>
          )}
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className={`rounded-full object-cover flex-shrink-0 ${sidebarWidth < 200 ? 'w-9 h-9' : 'w-7 h-7'}`} />
          ) : (
            <User className={`text-muted-foreground flex-shrink-0 ${sidebarWidth < 200 ? 'w-7 h-7' : 'w-4 h-4'}`} />
          )}
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

        {/* Personal spaces */}
        {mySpaces.length > 0 && (
          <div className="pt-2 pb-2 border-b border-border">
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

        {/* Community Selector */}
        <div className="pt-2 pb-2 border-b border-border">
          <CommunitySelector />
        </div>

        {/* Community / Group spaces */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {currentCommunity ? currentCommunity.name : 'Espaces de groupe'}
            </span>
            <Link to="/?new=space" title="Créer un nouvel espace">
              <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </Link>
          </div>
          {communitySpaceTree.length > 0 ? (
            communitySpaceTree.map((node) => (
              <SpaceTreeItem
                key={node.id}
                node={node}
                level={0}
                currentSpaceId={currentSpaceId}
                expandedIds={expandedSpaceIds}
                onToggle={toggleSpaceExpand}
              />
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
          title="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-2 md:gap-3 px-3 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Hamburger menu (mobile) */}
            <button
              className="p-1 rounded-md hover:bg-accent md:hidden flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              title="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base md:text-lg font-semibold truncate max-w-[120px] sm:max-w-[180px] md:max-w-[200px] lg:max-w-none">{getPageTitle()}</h2>
            {currentSpace && (
              <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
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
          <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1 justify-end">
            <div className="flex-shrink-0">
              <GlobalSearch />
            </div>
            {currentSpace && (
              <div className="min-w-0 flex-1">
                <ViewModeSelector />
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-auto">
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
