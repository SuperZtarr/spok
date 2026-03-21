import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderKanban, User, Menu, X, ChevronRight, ChevronDown, Settings, Building2, HelpCircle, Clock, Star, GripVertical } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useSpaceStore } from '../stores/space';
import { spacesApi, communitiesApi, authApi } from '../lib/api';

import { DevModeToggle, AdminModeToggle, DevDbStatus } from './DevDbStatus';
import { RoleGuard } from './RoleGuard';
import { useOnboarding } from '../hooks/useOnboarding';
import { WelcomeModal } from './WelcomeModal';
// ViewModeSelector replaced by MainMenu
import { UserProfileModal } from './UserProfileModal';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { MainMenu } from './MainMenu';
import { useViewModeStore } from '../stores/viewMode';
import { useMenuItems } from '../hooks/useMenuItems';
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

function SortableCommunitySection({
  community, spaceTree, isExpanded, spaceCount, groupIndex, isActive,
  onToggleExpand, currentSpaceId, expandedSpaceIds, onToggleSpace, mySpacesEmpty, favoriteIds, onToggleFavorite,
}: {
  community: any; spaceTree: any[]; isExpanded: boolean; spaceCount: number; groupIndex: number; isActive: boolean;
  onToggleExpand: (id: string) => void; currentSpaceId: string | null;
  expandedSpaceIds: Set<string>; onToggleSpace: (id: string) => void;
  mySpacesEmpty: boolean; favoriteIds: Set<string>; onToggleFavorite: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: community.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} id={groupIndex === 0 ? 'sidebar-communities' : undefined} className="pt-2 pb-2 border-b border-border">
      <div className="flex items-center justify-between px-3 mb-1">
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab p-0.5 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0">
            <GripVertical className="w-3 h-3" />
          </div>
          <button
            onClick={() => onToggleExpand(community.id)}
            className="p-0.5 rounded hover:bg-accent flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <Link
            to={`/communities/${community.id}`}
            className={`flex items-center gap-1.5 min-w-0 group ${isActive ? 'text-primary' : ''}`}
          >
            {community.avatarUrl ? (
              <img src={community.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
            <span className={`text-xs font-medium uppercase tracking-wider truncate group-hover:text-foreground transition-colors ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
              {community.name}
            </span>
            {!isExpanded && spaceCount > 0 && (
              <span className="text-[10px] text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {spaceCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {community.role === 'OWNER' && (
            <RoleGuard role="OWNER">
              <Link to={`/communities/${community.id}/settings`} title="Paramètres">
                <Settings className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </Link>
            </RoleGuard>
          )}
        </div>
      </div>
      {isExpanded && (
        spaceTree.length > 0 ? (
          spaceTree.map((node: any, nodeIndex: number) => (
            <SpaceTreeItem
              key={node.id}
              node={node}
              level={0}
              currentSpaceId={currentSpaceId}
              expandedIds={expandedSpaceIds}
              onToggle={onToggleSpace}
              htmlId={groupIndex === 0 && nodeIndex === 0 && mySpacesEmpty ? 'sidebar-first-space' : undefined}
              favoriteIds={favoriteIds}
              onToggleFavorite={onToggleFavorite}
            />
          ))
        ) : (
          <p className="px-3 text-xs text-muted-foreground">Aucun espace</p>
        )
      )}
    </div>
  );
}

function SpaceTreeItem({
  node,
  level,
  currentSpaceId,
  expandedIds,
  onToggle,
  htmlId,
  favoriteIds,
  onToggleFavorite,
}: {
  node: SpaceTreeNode;
  level: number;
  currentSpaceId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  htmlId?: string;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  const { includeChildrenSpaceIds, toggleIncludeChildren } = useSpaceStore();
  const isIncludeChildren = includeChildrenSpaceIds.has(node.id);

  return (
    <>
      <div
        id={htmlId}
        className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors text-sm group ${
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
          {node.avatarUrl ? (
            <img src={node.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
          ) : (
            <FolderKanban className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </Link>
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.id); }}
            className={`p-0.5 flex-shrink-0 transition-opacity ${
              favoriteIds?.has(node.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={favoriteIds?.has(node.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star className={`w-3 h-3 ${
              favoriteIds?.has(node.id) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
            }`} />
          </button>
        )}
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
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
          />
        ))
      )}
    </>
  );
}

export function Layout() {
  const location = useLocation();
  const { user, updateUser } = useAuthStore();
  const { initTheme } = useThemeStore();
  const { spaceViews } = useMenuItems();
  const { startTour, showWelcome, closeWelcome, pulseHelp } = useOnboarding();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Community reorder drag & drop
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const reorderMutation = useMutation({
    mutationFn: communitiesApi.reorder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communities'] }),
  });

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

  // Collapsed community IDs (inverted: communities are expanded by default)
  const [collapsedCommunityIds, setCollapsedCommunityIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('spok-collapsed-communities');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggleCommunityExpand = useCallback((id: string) => {
    setCollapsedCommunityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('spok-collapsed-communities', JSON.stringify([...next]));
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
  }, [location.pathname]);

  // Fetch ALL spaces — poll every 30s so sidebar never goes stale
  const { data: allSpaces, refetch: refetchSpaces } = useQuery({
    queryKey: ['sidebar-spaces', user?.id],
    queryFn: () => spacesApi.list(),
    placeholderData: (prev: any) => prev,
    staleTime: 10_000,
    refetchInterval: user ? 30_000 : undefined,
    refetchOnWindowFocus: 'always',
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch communities — authenticated: user's communities, anonymous: public communities
  const { data: communities, refetch: refetchCommunities } = useQuery({
    queryKey: ['communities', user?.id || 'public'],
    queryFn: user ? communitiesApi.list : (() => communitiesApi.listPublic().then(list => list.map(c => ({ ...c, role: null, order: 0 })))) as typeof communitiesApi.list,
    placeholderData: (prev: any) => prev,
    staleTime: 10_000,
    refetchInterval: user ? 30_000 : undefined,
    refetchOnWindowFocus: 'always',
  });

  // Refetch sidebar data on every route change
  useEffect(() => {
    if (user) {
      refetchSpaces();
      refetchCommunities();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCommunityDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !communities) return;
    const ids = communities.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)).map(c => c.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newIds = arrayMove(ids, oldIndex, newIndex);
    reorderMutation.mutate(newIds);
  }, [communities, reorderMutation]);

  // Fetch favorite space IDs (stabilize reference with select)
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['space-favorites'],
    queryFn: spacesApi.getFavorites,
    enabled: !!user,
    select: (data) => data, // structural sharing handles stability
  });

  const queryClient = useQueryClient();
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;


  // Separate personal, per-community, and independent spaces
  const { mySpaces, communityGroups, independentSpaces } = useMemo(() => {
    const all = allSpaces || [];
    const sortByName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

    const personalList = all.filter(s => s.type === 'PERSONAL').sort(sortByName);
    const independent = all.filter(s => s.type !== 'PERSONAL' && !s.communityId).sort(sortByName);

    // Group by community
    const byCommunity = new Map<string, SpaceWithRole[]>();
    for (const space of all) {
      if (space.type !== 'PERSONAL' && space.communityId) {
        const list = byCommunity.get(space.communityId) || [];
        list.push(space);
        byCommunity.set(space.communityId, list);
      }
    }

    // Sort spaces within each community
    for (const [, spaces] of byCommunity) {
      spaces.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    }

    // Build groups ordered by user preference (order field), fallback to name
    const sortedCommunities = (communities || []).slice().sort((a, b) =>
      (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    );

    const groups = sortedCommunities.map(c => ({
      community: c,
      spaceTree: buildSpaceTree(byCommunity.get(c.id) || []),
    }));

    return {
      mySpaces: personalList,
      communityGroups: groups,
      independentSpaces: buildSpaceTree(independent),
    };
  }, [allSpaces, communities]);

  // Favorite & recent spaces (separate memo to avoid coupling with main space memo)
  const favoriteIdKey = JSON.stringify(favoriteIds);
  const favoriteSpaces = useMemo(() => {
    const all = allSpaces || [];
    return favoriteIds
      .map(id => all.find(s => s.id === id))
      .filter((s): s is SpaceWithRole => !!s);
  }, [allSpaces, favoriteIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentSpaces = useMemo(() => {
    const all = allSpaces || [];
    const favSet = new Set(favoriteIds);
    try {
      const stored = JSON.parse(localStorage.getItem('spok_recent_spaces') || '[]') as string[];
      return stored
        .filter(id => !favSet.has(id))
        .map(id => all.find(s => s.id === id))
        .filter((s): s is SpaceWithRole => !!s)
        .slice(0, 5);
    } catch { return []; }
  }, [allSpaces, favoriteIdKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current space from URL - fetch independently from sidebar list
  const spaceMatch = location.pathname.match(/\/spaces\/([^/]+)/);
  const currentSpaceId = spaceMatch ? spaceMatch[1] : null;
  const { data: currentSpace } = useQuery({
    queryKey: ['space', currentSpaceId],
    queryFn: () => spacesApi.get(currentSpaceId!),
    enabled: !!currentSpaceId,
  });

  // Detect current community from URL or from current space
  const communityMatch = location.pathname.match(/\/communities\/([^/]+)/);
  const currentCommunityId = communityMatch?.[1] || currentSpace?.communityId || null;

  // Auto-expand community in sidebar when navigating to one of its spaces
  useEffect(() => {
    if (currentCommunityId && collapsedCommunityIds.has(currentCommunityId)) {
      setCollapsedCommunityIds(prev => {
        const next = new Set(prev);
        next.delete(currentCommunityId);
        localStorage.setItem('spok-collapsed-communities', JSON.stringify([...next]));
        return next;
      });
    }
  }, [currentCommunityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track recent spaces in localStorage
  const RECENTS_KEY = 'spok_recent_spaces';
  const MAX_RECENTS = 8;
  useEffect(() => {
    if (!currentSpaceId || !user) return;
    try {
      const stored = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') as string[];
      const filtered = stored.filter(id => id !== currentSpaceId);
      filtered.unshift(currentSpaceId);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(filtered.slice(0, MAX_RECENTS)));
    } catch { /* ignore */ }
  }, [currentSpaceId, user]);

  // Current view/function name helpers
  const { mode } = useViewModeStore();
  const { tab } = useDashboardTabStore();

  const getCurrentFunctionLabel = () => {
    const path = location.pathname;
    if (path.endsWith('/settings')) return 'Paramètres';
    if (path.endsWith('/history')) return 'Historique';
    if (currentSpace) {
      const viewItem = spaceViews.find(v => v.viewMode === mode);
      return viewItem?.label || '';
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

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const handleToggleFavorite = useCallback(async (spaceId: string) => {
    try {
      if (favoriteIdsRef.current.includes(spaceId)) {
        await spacesApi.removeFavorite(spaceId);
      } else {
        await spacesApi.addFavorite(spaceId);
      }
      queryClient.invalidateQueries({ queryKey: ['space-favorites'] });
    } catch { /* ignore */ }
  }, [queryClient]);

  // Sidebar content for anonymous visitors
  const visitorSidebarContent = (
    <>
      <div className="px-1 border-b border-border flex-shrink-0 overflow-hidden">
        <Link to="/" className="block"><img src="/logo.png" alt="SPOK" className="w-full h-auto object-contain -my-[18%]" /></Link>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
        {communityGroups.map(({ community, spaceTree }) => (
          <div key={community.id} className="pt-2 pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 px-3 mb-1">
              {community.avatarUrl ? (
                <img src={community.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <Link to={`/communities/${community.id}`} className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate hover:text-foreground transition-colors">
                {community.name}
              </Link>
            </div>
            {spaceTree.map((node) => (
              <SpaceTreeItem
                key={node.id}
                node={node}
                level={0}
                currentSpaceId={currentSpaceId}
                expandedIds={expandedSpaceIds}
                onToggle={toggleSpaceExpand}
                favoriteIds={new Set()}
                onToggleFavorite={() => {}}
              />
            ))}
          </div>
        ))}
        {communityGroups.length === 0 && (
          <p className="text-xs text-muted-foreground px-3">Aucun espace public disponible.</p>
        )}
      </nav>
    </>
  );

  // Sidebar content (shared between mobile and desktop)
  const sidebarContent = user ? (
    <>
      {/* Header sidebar - logo (image has built-in whitespace, negative margins compensate) */}
      <div id="sidebar-logo" className="px-1 border-b border-border flex-shrink-0 overflow-hidden">
        <Link to="/" onClick={() => useDashboardTabStore.getState().setTab('home')} className="block"><img src="/logo.png" alt="SPOK" className="w-full h-auto object-contain -my-[18%]" /></Link>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
        {/* Favorites */}
        {favoriteSpaces.length > 0 && (
          <div id="sidebar-favorites" className="pt-2 pb-2 border-b border-border">
            <div className="flex items-center px-3 mb-2">
              <Star className="w-3 h-3 text-yellow-500 mr-1.5 flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Favoris</span>
            </div>
            {favoriteSpaces.map((space) => (
              <div key={space.id} className="group flex items-center">
                <Link
                  to={`/spaces/${space.id}`}
                  className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
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
                <button
                  onClick={() => handleToggleFavorite(space.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Retirer des favoris"
                >
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recents */}
        {user && recentSpaces.length > 0 && (
          <div id="sidebar-recents" className="pt-2 pb-2 border-b border-border">
            <div className="flex items-center px-3 mb-2">
              <Clock className="w-3 h-3 text-muted-foreground mr-1.5 flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Récents</span>
            </div>
            {recentSpaces.map((space) => (
              <div key={space.id} className="group flex items-center">
                <Link
                  to={`/spaces/${space.id}`}
                  className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
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
                <button
                  onClick={() => handleToggleFavorite(space.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Ajouter aux favoris"
                >
                  <Star className="w-3 h-3 text-muted-foreground hover:text-yellow-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Personal spaces (authenticated only) */}
        {user && mySpaces.length > 0 && (
          <div className="pt-2 pb-2 border-b border-border">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mes espaces</span>
            </div>
            {mySpaces.map((space, i) => (
              <Link
                key={space.id}
                id={i === 0 ? 'sidebar-first-space' : undefined}
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

        {/* Communities with their spaces — drag to reorder */}
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCommunityDragEnd}>
          <SortableContext items={communityGroups.map(g => g.community.id)} strategy={verticalListSortingStrategy}>
            {communityGroups.map(({ community, spaceTree }, groupIndex) => {
              const isExpanded = !collapsedCommunityIds.has(community.id);
              const spaceCount = (allSpaces || []).filter(s => s.type !== 'PERSONAL' && s.communityId === community.id).length;
              return (
                <SortableCommunitySection
                  key={community.id}
                  community={community}
                  spaceTree={spaceTree}
                  isExpanded={isExpanded}
                  isActive={currentCommunityId === community.id}
                  spaceCount={spaceCount}
                  groupIndex={groupIndex}
                  onToggleExpand={toggleCommunityExpand}
                  currentSpaceId={currentSpaceId}
                  expandedSpaceIds={expandedSpaceIds}
                  onToggleSpace={toggleSpaceExpand}
                  mySpacesEmpty={mySpaces.length === 0}
                  favoriteIds={favoriteIdSet}
                  onToggleFavorite={handleToggleFavorite}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Independent group spaces (no community) */}
        {independentSpaces.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Autres espaces
              </span>
            </div>
            {independentSpaces.map((node) => (
              <SpaceTreeItem
                key={node.id}
                node={node}
                level={0}
                currentSpaceId={currentSpaceId}
                expandedIds={expandedSpaceIds}
                onToggle={toggleSpaceExpand}
                favoriteIds={favoriteIdSet}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Footer sidebar */}
      <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
        <button
          id="sidebar-help-button"
          onClick={() => startTour()}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-md transition-colors ${
            pulseHelp
              ? 'text-primary-foreground bg-primary animate-pulse'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Guide de démarrage
        </button>
        <span className="text-[10px] text-muted-foreground/50 px-3">
          MEP {new Date(__BUILD_DATE__).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <AdminModeToggle />
        <DevModeToggle />
        <DevDbStatus />
      </div>
    </>
  ) : visitorSidebarContent;

  // Hide sidebar on auth/public pages and landing page (non-authenticated)
  const noSidebarRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/invitation', '/sitemap', '/contact'];
  const isAuthPage = noSidebarRoutes.includes(location.pathname) || (!user && location.pathname === '/');

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && !isAuthPage && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop: static resizable, mobile: slide-over (hidden on auth pages) */}
      {!isAuthPage && <aside
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
      </aside>}

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Top header */}
        <header className="border-b border-border bg-card flex items-center flex-shrink-0">
          {/* Left: hamburger + title + badges */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 px-4 md:px-5 py-2">
            {/* Hamburger menu (mobile, hidden on auth pages) */}
            {!isAuthPage && (
              <button
                className="p-1 rounded-md hover:bg-accent md:hidden flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
                title="Ouvrir le menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
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
          {/* Right: Menu principal + Recherche + Notifications + Vignette utilisateur */}
          <div className="flex items-center gap-2 ml-auto flex-shrink min-w-0 px-4 md:px-5">
            <MainMenu onOpenProfile={() => setIsProfileOpen(true)} currentSpaceName={currentSpace?.name || null} />
            <div id="header-global-search" className="hidden sm:block"><GlobalSearch /></div>
            {user ? (
              <>
                <NotificationBell />
                <div className="flex items-center gap-2 flex-shrink-0 px-1">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-foreground truncate max-w-[80px] hidden md:inline">{user.name}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">Connexion</Link>
                <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">S'inscrire</Link>
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

      <WelcomeModal
        isOpen={showWelcome}
        onClose={closeWelcome}
        onStartTour={startTour}
      />

    </div>
  );
}
