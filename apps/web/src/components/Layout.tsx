import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, FolderKanban, Plus, Shield, User, Menu, X, ChevronRight, ChevronDown, GripVertical, Settings } from 'lucide-react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { useThemeStore } from '../stores/theme';
import { useSpaceStore } from '../stores/space';
import { spacesApi, authApi } from '../lib/api';

import { DevModeToggle, DevDbStatus } from './DevDbStatus';
import { ViewModeSelector } from './ViewModeSelector';
import { UserProfileModal } from './UserProfileModal';
import { CommunitySelector } from './CommunitySelector';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { useViewModeStore, VIEW_MODES } from '../stores/viewMode';
import { useDashboardTabStore, DASHBOARD_TABS } from '../stores/dashboardTab';
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

/** Collect all descendant IDs of a tree node recursively */
function collectDescendantIds(node: SpaceTreeNode): string[] {
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

function SpaceTreeItem({
  node,
  level,
  currentSpaceId,
  expandedIds,
  onToggle,
  draggedId,
}: {
  node: SpaceTreeNode;
  level: number;
  currentSpaceId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  draggedId: string | null;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isDragged = draggedId === node.id;

  const { includeChildrenSpaceIds, toggleIncludeChildren } = useSpaceStore();
  const isIncludeChildren = includeChildrenSpaceIds.has(node.id);

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: `drag-${node.id}`,
    data: { spaceId: node.id, name: node.name, parentId: node.parentId },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    data: { spaceId: node.id },
    disabled: isDragged,
  });

  return (
    <>
      <div
        ref={(el) => { setDragRef(el); setDropRef(el); }}
        className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors text-sm group ${
          isDragged ? 'opacity-30' :
          isOver && !isDragged ? 'bg-primary/20 ring-1 ring-primary' :
          currentSpaceId === node.id
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 rounded hover:bg-accent flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="w-3 h-3" />
        </button>
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
          {node.avatarUrl ? (
            <img src={node.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
          ) : (
            <FolderKanban className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </Link>
        <input
          type="checkbox"
          checked={isIncludeChildren}
          onChange={(e) => { e.stopPropagation(); toggleIncludeChildren(node.id, collectDescendantIds(node)); }}
          onClick={(e) => e.stopPropagation()}
          className={`w-3.5 h-3.5 rounded flex-shrink-0 cursor-pointer accent-primary transition-opacity ${
            isIncludeChildren ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
          }`}
          title="Inclure les éléments des sous-espaces"
        />
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
            draggedId={draggedId}
          />
        ))
      )}
    </>
  );
}

function RootDropZone({ isVisible }: { isVisible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-root',
    data: { spaceId: null },
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mx-3 mb-1 px-3 py-1.5 rounded-md border border-dashed text-xs text-muted-foreground transition-colors ${
        isOver ? 'border-primary bg-primary/10 text-primary' : 'border-border'
      }`}
    >
      Déplacer à la racine
    </div>
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Drag & drop spaces
  const queryClient = useQueryClient();
  const [draggedSpace, setDraggedSpace] = useState<{ id: string; name: string } | null>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const moveSpaceMutation = useMutation({
    mutationFn: ({ spaceId, parentId }: { spaceId: string; parentId: string | null }) =>
      spacesApi.update(spaceId, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data) {
      setDraggedSpace({ id: data.spaceId, name: data.name });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggedSpace(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.data.current?.spaceId as string;
    const targetId = over.data.current?.spaceId as string | undefined;
    const isRootZone = over.id === 'drop-root';

    // Dropping on itself or same parent → no-op
    const currentParentId = active.data.current?.parentId as string | null;
    if (!isRootZone && targetId === draggedId) return;
    if (isRootZone && !currentParentId) return;
    if (!isRootZone && targetId === currentParentId) return;

    const newParentId = isRootZone ? null : (targetId ?? null);
    moveSpaceMutation.mutate({ spaceId: draggedId, parentId: newParentId });
  }, [moveSpaceMutation]);

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

  // Sync user from server on mount (only if authenticated)
  useEffect(() => {
    if (!user) return;
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
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close user menu on click outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Filter spaces by current community
  const { data: spaces } = useQuery({
    queryKey: ['spaces', currentCommunity?.id],
    queryFn: () => spacesApi.list(currentCommunity?.id || 'none'),
  });

  // Also fetch personal spaces (always visible, only for authenticated users)
  const { data: personalSpaces } = useQuery({
    queryKey: ['spaces', 'personal'],
    queryFn: () => spacesApi.list('none'),
    enabled: !!currentCommunity && !!user, // Only fetch when community is selected AND authenticated
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

  // Current view/function name helpers
  const { mode } = useViewModeStore();
  const { tab } = useDashboardTabStore();

  const getCurrentFunctionLabel = () => {
    const path = location.pathname;
    if (path.endsWith('/settings')) return 'Paramètres';
    if (path.endsWith('/history')) return 'Historique';
    if (currentSpace) {
      const viewMode = VIEW_MODES.find(v => v.value === mode);
      return viewMode?.label || '';
    }
    if (path === '/') {
      const dashTab = DASHBOARD_TABS.find(t => t.value === tab);
      return dashTab?.label || '';
    }
    if (path === '/tasks') return 'Mes tâches';
    return '';
  };

  // Page title based on current location (for header bar)
  const getPageTitle = () => {
    const fnLabel = getCurrentFunctionLabel();
    if (currentSpace) {
      return fnLabel ? `${currentSpace.name} — ${fnLabel}` : currentSpace.name;
    }
    if (location.pathname === '/') {
      return fnLabel ? `SPOK — ${fnLabel}` : 'SPOK';
    }
    if (location.pathname === '/tasks') return 'SPOK — Mes tâches';
    return 'SPOK';
  };

  // Update document title
  useEffect(() => {
    const path = location.pathname;
    const fnLabel = getCurrentFunctionLabel();
    let title = 'SPOK';

    if (currentSpace) {
      title = fnLabel
        ? `${currentSpace.name} — ${fnLabel}`
        : `SPOK — ${currentSpace.name}`;
    } else if (path === '/') {
      title = fnLabel
        ? `SPOK - Single Point Of Knowledge - ${fnLabel}`
        : 'SPOK - Single Point Of Knowledge';
    } else if (path === '/tasks') {
      title = 'SPOK - Single Point Of Knowledge - Mes tâches';
    } else if (path === '/community/settings') {
      title = 'SPOK — Paramètres communauté';
    }

    document.title = import.meta.env.DEV ? `[DEV] ${title}` : title;
  }, [currentSpace, location.pathname, mode, tab]);

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
      {/* Header sidebar - logo (image has built-in whitespace, negative margins compensate) */}
      <div className="px-1 border-b border-border flex-shrink-0 overflow-hidden">
        <Link to="/" className="block"><img src="/logo.png" alt="SPOK" className="w-full h-auto object-contain -my-[18%]" /></Link>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
        {/* Personal spaces (authenticated only) */}
        {user && mySpaces.length > 0 && (
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
                {space.avatarUrl ? (
                  <img src={space.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <FolderKanban className="w-4 h-4 flex-shrink-0" />
                )}
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
            <div className="flex items-center gap-1">
              {currentCommunity && currentCommunity.role && ['OWNER', 'ADMIN'].includes(currentCommunity.role) && (
                <Link to={`/communities/${currentCommunity.id}/settings`} title="Paramètres de la communauté">
                  <Settings className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </Link>
              )}
              {user && (
                <Link to="/?new=space" title="Créer un nouvel espace">
                  <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </Link>
              )}
            </div>
          </div>
          <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {communitySpaceTree.length > 0 ? (
              <>
                <RootDropZone isVisible={!!draggedSpace && !!draggedSpace.id} />
                {communitySpaceTree.map((node) => (
                  <SpaceTreeItem
                    key={node.id}
                    node={node}
                    level={0}
                    currentSpaceId={currentSpaceId}
                    expandedIds={expandedSpaceIds}
                    onToggle={toggleSpaceExpand}
                    draggedId={draggedSpace?.id ?? null}
                  />
                ))}
              </>
            ) : (
              <p className="px-3 text-xs text-muted-foreground">Aucun espace</p>
            )}
            <DragOverlay dropAnimation={null}>
              {draggedSpace && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-primary/40 shadow-lg text-sm">
                  <FolderKanban className="w-4 h-4 flex-shrink-0 text-primary" />
                  <span className="truncate font-medium">{draggedSpace.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </nav>

      {/* Footer sidebar */}
      <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
        <DevModeToggle />
        <DevDbStatus />
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
        <header className="border-b border-border bg-card flex items-center flex-shrink-0">
          {/* Left: hamburger + title + badges */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 px-4 md:px-5 py-2">
            {/* Hamburger menu (mobile) */}
            <button
              className="p-1 rounded-md hover:bg-accent md:hidden flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              title="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-semibold text-foreground truncate">{getPageTitle()}</h2>
              {currentSpace && (
                <div className="flex items-center gap-2">
                  {currentSpace.community && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {currentSpace.community.name}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/70 px-1.5 py-0.5 bg-muted/50 rounded">
                    {currentSpace.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Right: navbar menu + search + user avatar */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0 px-4 md:px-5">
            <ViewModeSelector />
            <GlobalSearch />
            {user ? (
              <>
                <NotificationBell />
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 flex-shrink-0 px-2 py-1 rounded-md hover:bg-accent transition-colors"
                    title="Menu utilisateur"
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="hidden md:flex flex-col items-start leading-tight">
                      <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{user.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {user.globalRole === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}
                      </span>
                    </div>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); setIsProfileOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Profil
                      </button>
                      {user.globalRole === 'ADMIN' && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Administration
                        </Link>
                      )}
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm text-foreground hover:text-primary transition-colors px-3 py-1.5">
                  Connexion
                </Link>
                <Link to="/register" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                  Inscription
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-auto">
          {user && <EmailVerificationBanner />}
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
