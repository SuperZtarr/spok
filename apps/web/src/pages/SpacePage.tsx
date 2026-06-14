import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  FileText,
  FolderKanban,
  ExternalLink,
  FolderInput,
  AlertTriangle,
  Loader2,
  CalendarClock,
  EyeOff,
  ChevronsUpDown,
} from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import type { Item, ItemType } from '@spok/shared';
import { buildStatusColorMap, buildStatusLabelMap, isItemDeferred } from '@spok/shared';
import { useReferentiels } from '../hooks/useReferentiels';
import { useViewOnboarding } from '../hooks/useOnboarding';
import { useSpaces } from '../hooks/useSpaces';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ItemEditModal } from '../components/ItemEditModal';
import { useViewModeStore, VIEWER_ALLOWED_VIEWS, type ViewMode } from '../stores/viewMode';
import { useSpaceStore } from '../stores/space';
import { ListView } from '../components/views/ListView';
import { KanbanView } from '../components/views/KanbanView';
import { TypesView } from '../components/views/TypesView';
import { TimelineView } from '../components/views/TimelineView';

import { MindMapView } from '../components/views/MindMapView';
import { PlanningView } from '../components/views/PlanningView';
import { CalendarView } from '../components/views/CalendarView';
import { MoveToSpaceModal } from '../components/MoveToSpaceModal';
import { DuplicateToSpaceModal } from '../components/DuplicateToSpaceModal';
import { GraphView } from '../components/views/GraphView';
import { TextView } from '../components/views/TextView';
import { ThreadView } from '../components/views/ThreadView';
import { SunburstView } from '../components/views/SunburstView';
import { RelationsMapView } from '../components/views/RelationsMapView';
import { BubbleView } from '../components/views/BubbleView';
import { RadialTreeView } from '../components/views/RadialTreeView';
import { TreemapView } from '../components/views/TreemapView';
import { BurndownView } from '../components/views/BurndownView';
import { CfdView } from '../components/views/CfdView';
import { ChordView } from '../components/views/ChordView';
import { CrossTableView } from '../components/views/CrossTableView';
import { HeatmapView } from '../components/views/HeatmapView';
import { EgoNetworkView } from '../components/views/EgoNetworkView';
import { MembersKanbanView } from '../components/views/MembersKanbanView';
import { PriorityView } from '../components/views/PriorityView';
import { ImagesView } from '../components/views/ImagesView';
import { LinksView } from '../components/views/LinksView';
import { DocumentsView } from '../components/views/DocumentsView';
import { BugsView } from '../components/views/BugsView';
import { TodoView } from '../components/views/TodoView';
import { PertView } from '../components/views/PertView';
import { OverviewView } from '../components/views/OverviewView';
import { RecentChangesView } from '../components/views/RecentChangesView';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { StatusPropagationModal } from '../components/StatusPropagationModal';
import { ConvertToSpaceModal } from '../components/ConvertToSpaceModal';
import { MergeItemModal } from '../components/MergeItemModal';

import { TYPE_ICONS, getTypeColor } from '../constants/ui';
import { stripMarkup } from '../lib/bbcode';

// Extracted components and hooks
import { TreeItem, RootDropZone } from './space-tree-view';
import { useSpaceActions } from './useSpaceActions';
import { type TreeSort, applyTreeSort } from '../lib/treeSort';
import { SpaceToolbar } from './SpaceToolbar';
import { ViewHelpButton } from '../components/ViewHelpButton';
import { SpaceExportButton } from '../components/SpaceExportButton';
import { useAuthStore } from '../stores/auth';
import { recordSpaceVisit } from '../hooks/useRecentSpaces';
import { useMenuItems } from '../hooks/useMenuItems';

export function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { mode: viewMode, setMode, setAllowedViews } = useViewModeStore();
  const { spaceViews } = useMenuItems();
  const { user } = useAuthStore();



  // --- UI state ---
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(`spok_expanded_${spaceId}`);
      if (stored) return new Set<string>(JSON.parse(stored));
    } catch {}
    return new Set<string>();
  });
  useEffect(() => {
    if (!spaceId) return;
    try { sessionStorage.setItem(`spok_expanded_${spaceId}`, JSON.stringify([...expandedItems])); } catch {}
  }, [spaceId, expandedItems]);
  const [filter, setFilter] = useState<ItemType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [treeSort, setTreeSort] = useState<TreeSort>('manual');
  const [highlightFilter, setHighlightFilter] = useState<ItemType | 'ALL'>('ALL');
  const [highlightStatus, setHighlightStatus] = useState<string>('ALL');
  const [highlightSearch, setHighlightSearch] = useState('');
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const viewReadyRef = useRef(false); // true once defaultView has been applied for current space
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [duplicateItemId, setDuplicateItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeferred, setShowDeferred] = useState(false);
  const { startViewTour, pulseHelp } = useViewOnboarding(viewMode);
  const { includeChildrenSpaceIds } = useSpaceStore();


  useEffect(() => {
    if (spaceId) recordSpaceVisit(spaceId);
  }, [spaceId]);

  // --- Queries ---
  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const canEdit = !!user && !!space?.role && space.role !== 'VIEWER';

  const canEditItem = useCallback((item: { createdById?: string }) => {
    if (!canEdit) return false;
    if (space?.role === 'OWNER') return true;
    return item.createdById === user?.id;
  }, [canEdit, space?.role, user?.id]);

  // Reset viewReady when navigating to a new space (must run before defaultView effect)
  useEffect(() => {
    viewReadyRef.current = false;
  }, [spaceId]);

  // Apply space defaultView — priorité : URL ?view= > vue active en cours (sticky) > defaultView espace > list
  // La vue active en cours (viewMode) persiste entre espaces : si l'utilisateur navigue en "images", tous les espaces suivants s'ouvrent en images
  useEffect(() => {
    if (!space || space.id !== spaceId) return;
    const urlView = searchParams.get('view') as Parameters<typeof setMode>[0] | null;
    const targetMode = urlView || viewMode || (space.defaultView as Parameters<typeof setMode>[0]) || 'list';
    setMode(targetMode);
    viewReadyRef.current = true;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', targetMode);
      return next;
    }, { replace: true });
  }, [spaceId, space?.id, space?.defaultView, setMode, setSearchParams]);
  // Note: searchParams lu à l'exécution de l'effet, pas en dep (évite boucle)

  // Sync viewMode → URL lors des changements de vue par l'utilisateur
  useEffect(() => {
    if (!spaceId || !viewMode || !viewReadyRef.current) return;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', viewMode);
      return next;
    }, { replace: true });
  }, [viewMode, spaceId, setSearchParams]);

  // Restrict views for VIEWER role
  useEffect(() => {
    setAllowedViews(canEdit ? null : VIEWER_ALLOWED_VIEWS);
    return () => setAllowedViews(null);
  }, [canEdit, setAllowedViews]);

  // Force allowed view when current view is not in VIEWER_ALLOWED_VIEWS
  useEffect(() => {
    if (!canEdit && !VIEWER_ALLOWED_VIEWS.includes(viewMode)) {
      setMode('list');
    }
  }, [canEdit, viewMode, setMode]);

  const { data: referentielsData } = useReferentiels(spaceId!);
  const referentiels = referentielsData?.referentiels;

  const statusColorMap = useMemo(
    () => buildStatusColorMap(referentiels?.statuses),
    [referentiels],
  );
  const statusLabelMap = useMemo(
    () => buildStatusLabelMap(referentiels?.statuses),
    [referentiels],
  );

  const { data: communitySpaces } = useSpaces(space?.communityId || undefined);

  const checkedDescendantIds = useMemo((): string[] => {
    if (!spaceId || includeChildrenSpaceIds.size === 0 || !communitySpaces) return [];
    const descendants = new Set<string>();
    const queue = [spaceId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const s of communitySpaces) {
        if (s.parentId === current && !descendants.has(s.id)) {
          descendants.add(s.id);
          queue.push(s.id);
        }
      }
    }
    return [...includeChildrenSpaceIds].filter(id => descendants.has(id));
  }, [spaceId, includeChildrenSpaceIds, communitySpaces]);

  // View mode categorization
  const isTreeView = viewMode === 'mindmap' || viewMode === 'tree' || viewMode === 'timeline' || viewMode === 'text' || viewMode === 'pert';
  const isFlatView = viewMode === 'kanban' || viewMode === 'types' || viewMode === 'list' || viewMode === 'planning' || viewMode === 'calendar' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' || viewMode === 'members' || viewMode === 'priority' || viewMode === 'images' || viewMode === 'links' || viewMode === 'documents' || viewMode === 'bugs' || viewMode === 'todo';
  const isHighlightMode = isTreeView || viewMode === 'planning' || viewMode === 'calendar' || viewMode === 'graph' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego';
  const activeTypeFilter = filter !== 'ALL' ? filter : undefined;
  const activeStatusFilter = statusFilter !== 'ALL' ? statusFilter : undefined;

  const highlightColor = useMemo(() => {
    if (activeTypeFilter) {
      const tc = getTypeColor(activeTypeFilter, referentiels?.typeLabels);
      return { border: tc.color, bg: tc.bgHover };
    }
    if (activeStatusFilter) {
      const statuses = referentiels?.statuses || [];
      const s = statuses.find((st: any) => st.id === activeStatusFilter);
      if (s) {
        const parts = s.borderColor.split(' ');
        return { border: parts[0] || '', bg: parts[1] || '' };
      }
    }
    return undefined;
  }, [activeTypeFilter, activeStatusFilter, referentiels]);

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', spaceId, isTreeView ? 'ALL' : filter, statusFilter, viewMode, checkedDescendantIds],
    queryFn: () =>
      itemsApi.list(spaceId!, {
        type: activeTypeFilter && !isHighlightMode ? activeTypeFilter : undefined,
        status: activeStatusFilter && !isHighlightMode ? (activeStatusFilter === 'undefined' ? 'none' : activeStatusFilter) : undefined,
        parentId: !activeTypeFilter && !activeStatusFilter && !isFlatView && !isTreeView ? null : undefined,
        additionalSpaceIds: checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined,
        pageSize: 5000,
      }),
    enabled: !!spaceId,
  });

  const rootItems = useMemo(() => {
    if (!itemsData?.data) return [];
    return itemsData.data.filter((item: Item) => !item.parentId && item.spaceId === spaceId);
  }, [itemsData?.data, spaceId]);

  const portalGroups = useMemo(() => {
    if (checkedDescendantIds.length === 0 || !itemsData?.data) return [];
    const groupedBySpace = new Map<string, Item[]>();
    for (const item of itemsData.data) {
      if (item.spaceId !== spaceId && !item.parentId) {
        const existing = groupedBySpace.get(item.spaceId) || [];
        existing.push(item);
        groupedBySpace.set(item.spaceId, existing);
      }
    }
    return [...groupedBySpace.entries()].map(([sid, items]) => {
      const space = communitySpaces?.find(s => s.id === sid);
      return {
        spaceId: sid,
        spaceName: space?.name || 'Espace',
        parentSpaceId: space?.parentId ?? null,
        items,
      };
    });
  }, [itemsData?.data, spaceId, checkedDescendantIds, communitySpaces]);

  const { data: allItemsData } = useQuery({
    queryKey: ['items', spaceId, 'all', checkedDescendantIds],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 5000, additionalSpaceIds: checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined }),
    enabled: !!spaceId,
  });

  const { data: textViewData } = useQuery({
    queryKey: ['items', spaceId, 'all-with-contributions', checkedDescendantIds],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 5000, include: 'contributions', additionalSpaceIds: checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined }),
    enabled: !!spaceId && (viewMode === 'text' || viewMode === 'thread'),
  });

  // All items for lookups (allItemsData preferred, fallback to itemsData)
  const allItems = useMemo(() => allItemsData?.data || itemsData?.data || [], [allItemsData?.data, itemsData?.data]);

  // --- Deferred items (statut planifié + startDate > 30j) ---
  const statuses = useMemo(() => referentiels?.statuses || [], [referentiels]);

  const deferredItems = useMemo(() => {
    const all = allItemsData?.data || itemsData?.data || [];
    return all.filter((item: Item) => isItemDeferred(item, statuses));
  }, [allItemsData?.data, itemsData?.data, statuses]);

  const deferredIds = useMemo(() => new Set(deferredItems.map((i: Item) => i.id)), [deferredItems]);

  // --- Search ---
  const filterBySearch = useCallback((items: Item[] | undefined, skipDeferredFilter = false): Item[] => {
    if (!items) return [];
    const visible = skipDeferredFilter || showDeferred ? items : items.filter((item: Item) => !deferredIds.has(item.id));
    if (!searchQuery.trim() || isHighlightMode) return visible;
    const query = searchQuery.toLowerCase();
    return visible.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      stripMarkup(item.description || '').toLowerCase().includes(query)
    );
  }, [searchQuery, isHighlightMode, showDeferred, deferredIds]);


  const searchMatchIds = useMemo((): Set<string> | undefined => {
    if (!searchQuery.trim()) return undefined;
    const query = searchQuery.toLowerCase();
    const matchIds = new Set<string>();
    for (const item of allItems) {
      if (
        item.title.toLowerCase().includes(query) ||
        stripMarkup(item.description || '').toLowerCase().includes(query)
      ) {
        matchIds.add(item.id);
      }
    }
    return matchIds.size > 0 || searchQuery.trim() ? matchIds : undefined;
  }, [searchQuery, allItems]);

  // --- Actions hook ---
  const actions = useSpaceActions({
    spaceId,
    allItems,
    communityId: space?.communityId,
    communitySpaces: communitySpaces || undefined,
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: (data: { type: ItemType; title: string; url?: string; parentId?: string; status?: string; dueDate?: string; startDate?: string; endDate?: string; targetSpaceId?: string }) => {
      const { targetSpaceId, ...itemData } = data;
      return itemsApi.create(targetSpaceId ?? spaceId!, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  // --- DnD state & handlers ---
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'reorder' | 'nest'>('nest');
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'nest'>('nest');
  const [treeViewSort] = useState<TreeSort>('manual');
  const pointerYRef = useRef(0);

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: PointerEvent) => { pointerYRef.current = e.clientY; };
    window.addEventListener('pointermove', handler);
    return () => window.removeEventListener('pointermove', handler);
  }, [activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const currentOverId = event.over?.id as string | null;
    setOverId(currentOverId);

    if (!event.over || !currentOverId || currentOverId === 'root') {
      setDropMode('nest');
      setDropPosition('nest');
      return;
    }

    const overElement = document.querySelector(`[data-item-id="${currentOverId}"]`) as HTMLElement | null;
    const liveRect = overElement?.getBoundingClientRect();
    const pointerY = pointerYRef.current;

    if (!liveRect || liveRect.height === 0) {
      setDropMode('nest');
      setDropPosition('nest');
      return;
    }

    const relativeY = pointerY - liveRect.top;
    const ratio = relativeY / liveRect.height;

    if (ratio < 0.33) {
      setDropMode('reorder');
      setDropPosition('before');
    } else if (ratio > 0.67) {
      setDropMode('reorder');
      setDropPosition('after');
    } else {
      setDropMode('nest');
      setDropPosition('nest');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropMode = dropMode;
    const currentDropPosition = dropPosition;
    setActiveId(null);
    setOverId(null);
    setDropMode('nest');
    setDropPosition('nest');

    if (!over || active.id === over.id) return;

    const rootItemsList = rootItems;
    const activeItem = allItems.find((item: Item) => item.id === active.id);
    if (!activeItem) return;

    if (over.id === 'root') {
      actions.handleMove(active.id as string, null, 0);
      return;
    }

    const overItem = allItems.find((item: Item) => item.id === over.id);
    if (!overItem) return;

    const siblings = overItem.parentId
      ? allItems.filter((item: Item) => item.parentId === overItem.parentId)
      : rootItemsList;
    const overIndex = siblings.findIndex((item: Item) => item.id === over.id);

    if (currentDropMode === 'nest') {
      actions.handleMove(active.id as string, over.id as string, 0);
      setExpandedItems((prev) => new Set([...prev, over.id as string]));
    } else {
      const targetPosition = currentDropPosition === 'after' ? overIndex + 1 : overIndex;
      actions.handleMove(active.id as string, overItem.parentId ?? null, targetPosition >= 0 ? targetPosition : 0);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDropMode('nest');
    setDropPosition('nest');
  };

  const activeItem = activeId ? allItems.find((item: Item) => item.id === activeId) : null;

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleAddChild = (parentId: string, parentSpaceId?: string) => {
    const targetSpaceId = parentSpaceId || allItems.find((i: Item) => i.id === parentId)?.spaceId || spaceId!;
    createItemMutation.mutate(
      { type: 'NOTE', title: '', status: '', parentId, targetSpaceId },
      { onSuccess: (created: any) => {
        setEditingItemId(created.id);
        setExpandedItems((prev) => new Set([...prev, parentId]));
      }},
    );
  };

  const handleSelfAssign = useCallback((id: string) => {
    const item = allItems.find((i: Item) => i.id === id);
    const newAssignee = item?.assignedToId === user?.id ? null : user?.id || null;
    actions.handleInlineUpdate(id, { assignedToId: newAssignee });
  }, [allItems, user, actions]);

  const expandAll = () => {
    const parentIds = new Set<string>();
    allItems.forEach((item: Item) => { if (item.parentId) parentIds.add(item.parentId); });
    allItems.forEach((item: Item & { childCount?: number }) => { if ((item.childCount || 0) > 0) parentIds.add(item.id); });
    setExpandedItems(parentIds);
  };

  const collapseAll = () => { setExpandedItems(new Set()); };
  const hasExpandedItems = expandedItems.size > 0;

  // --- Toolbar callbacks ---
  const handleToggleExpand = useCallback(() => {
    hasExpandedItems ? collapseAll() : expandAll();
  }, [hasExpandedItems]);



  const handleNewItem = useCallback(() => {
    const type = filter === 'ALL' ? 'NOTE' : filter;
    createItemMutation.mutate(
      { type, title: '', status: '' },
      { onSuccess: (created: any) => { setEditingItemId(created.id); } },
    );
  }, [filter, createItemMutation]);

  // Déclencher la création si ?newItem=true (venant du bouton header)
  const newItemHandledRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('newItem') === 'true' && !newItemHandledRef.current) {
      newItemHandledRef.current = true;
      setSearchParams(prev => { prev.delete('newItem'); return prev; }, { replace: true });
      setTimeout(() => {
        createItemMutation.mutate(
          { type: 'NOTE', title: '', status: '' },
          { onSuccess: (created: any) => { setEditingItemId(created.id); } }
        );
      }, 100);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ouvrir la modale si ?item=:itemId (lien "ouvrir dans un nouvel onglet" ou returnTo)
  // Ou restaurer depuis sessionStorage si item était ouvert avant F5 / reconnexion
  const itemParamHandledRef = useRef(false);
  useEffect(() => {
    const itemParam = searchParams.get('item');
    if (itemParam && !itemParamHandledRef.current) {
      itemParamHandledRef.current = true;
      setSearchParams(prev => { prev.delete('item'); return prev; }, { replace: true });
      setEditingItemId(itemParam);
    } else if (!itemParam && !itemParamHandledRef.current) {
      itemParamHandledRef.current = true;
      const saved = sessionStorage.getItem('spok_current_item');
      if (saved) {
        const [savedSpace, savedItem] = saved.split(':');
        if (savedSpace === spaceId && savedItem) setEditingItemId(savedItem);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist current item in sessionStorage for reconnection (sans modifier l'URL)
  useEffect(() => {
    if (editingItemId) {
      sessionStorage.setItem('spok_current_item', `${spaceId}:${editingItemId}`);
    } else {
      sessionStorage.removeItem('spok_current_item');
    }
  }, [editingItemId, spaceId]);

  // --- Render ---
  // Overview mode — full page, no toolbar
  if (viewMode === 'overview') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <OverviewView spaceId={spaceId!} space={space} />
      </div>
    );
  }

  return (
    <div className={`px-0 py-2 sm:p-4 flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' || viewMode === 'members' || viewMode === 'priority' || viewMode === 'calendar' || viewMode === 'pert' || viewMode === 'thread' || viewMode === 'timeline' ? ' h-full overflow-hidden' : ''}`}>
      <div className={`w-full flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' || viewMode === 'members' || viewMode === 'priority' || viewMode === 'calendar' || viewMode === 'pert' || viewMode === 'thread' || viewMode === 'timeline' ? ' h-full' : ''}`}>
        {/* Toolbar */}
        <SpaceToolbar
          filter={filter}
          onFilterChange={setFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          highlightFilter={highlightFilter}
          onHighlightFilterChange={setHighlightFilter}
          highlightStatus={highlightStatus}
          onHighlightStatusChange={setHighlightStatus}
          highlightSearch={highlightSearch}
          onHighlightSearchChange={setHighlightSearch}
          totalItemCount={allItemsData?.data?.length ?? itemsData?.data?.length ?? space?.itemCount ?? 0}
          filteredItemCount={itemsData?.total ?? itemsData?.data?.length ?? (space?.itemCount || 0)}
          searchMatchCount={searchMatchIds?.size}
          referentiels={referentiels}
          viewMode={viewMode}
          onSetMode={setMode}
          allowedViews={canEdit ? null : VIEWER_ALLOWED_VIEWS}
          spaceViews={spaceViews}
          defaultView={space?.defaultView as ViewMode | undefined}
          treeSort={treeSort}
          onTreeSortChange={setTreeSort}
          canEdit={canEdit}
          onNewItem={handleNewItem}
          spaceId={spaceId}
          spaceRole={space?.role}
        />

        {/* Deferred items banner */}
        {deferredItems.length > 0 && (
          <button
            onClick={() => setShowDeferred(v => !v)}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-md mb-1 border transition-colors ${
              showDeferred
                ? 'bg-sky-100 border-sky-300 text-sky-800'
                : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {showDeferred ? <EyeOff className="w-3.5 h-3.5 flex-shrink-0" /> : <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>
              {showDeferred
                ? `Masquer les ${deferredItems.length} élément${deferredItems.length > 1 ? 's' : ''} planifiés à long terme`
                : `${deferredItems.length} élément${deferredItems.length > 1 ? 's' : ''} planifié${deferredItems.length > 1 ? 's' : ''} à long terme (démarrage dans plus de 30 jours) — cliquer pour afficher`}
            </span>
          </button>
        )}

        {/* Items / Views */}
        <div ref={viewContainerRef} className={`bg-card border rounded-lg flex-1 min-h-0${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'members' || viewMode === 'types' || viewMode === 'priority' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' || viewMode === 'images' || viewMode === 'links' || viewMode === 'documents' || viewMode === 'pert' ? ' overflow-hidden flex flex-col' : ''}`}>
          {itemsLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement des éléments…
            </div>
          ) : viewMode === 'list' ? (
            <ListView
              items={filterBySearch(itemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceId={spaceId}
              spaceRole={space?.role}
              treeSort={treeSort}
              onTreeSortChange={setTreeSort}
            />
          ) : viewMode === 'text' ? (
            <TextView
              items={filterBySearch(textViewData?.data || allItemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              spaceId={spaceId}
              spaceRole={space?.role}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'recent' ? (
            <RecentChangesView
              items={filterBySearch(itemsData?.data)}
              spaceId={spaceId}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'thread' ? (
            <ThreadView
              items={filterBySearch(textViewData?.data || allItemsData?.data)}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              searchMatchIds={searchMatchIds}
              spaceId={spaceId}
              spaceRole={space?.role}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              treeSort={treeSort}
              onTreeSortChange={setTreeSort}
            />
          ) : viewMode === 'kanban' ? (
              <KanbanView
              items={filterBySearch(itemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onMoveItemToSpace={actions.handleMoveItemToSpace}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'types' ? (
            <TypesView
              items={filterBySearch(itemsData?.data)}
              spaceId={spaceId!}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateType={(id, type) => actions.handleInlineUpdate(id, { type })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
              onMoveItemToSpace={actions.handleMoveItemToSpace}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              onNewItem={canEdit ? handleNewItem : undefined}
            />
          ) : viewMode === 'planning' ? (
              <PlanningView
              items={filterBySearch(allItemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'calendar' ? (
            <CalendarView
              items={filterBySearch(allItemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onUpdateDates={(id, startDate, endDate) => actions.handleInlineUpdate(id, { startDate, endDate })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
              spaceId={spaceId}
              onNewItem={canEdit ? handleNewItem : undefined}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
            />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              items={filterBySearch(allItemsData?.data, true)}
              relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
              currentSpaceId={spaceId}
              spaceId={spaceId}
              spaceName={space?.name ?? ''}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onUpdateDates={(id, startDate, endDate) => actions.handleInlineUpdate(id, { startDate, endDate })}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
              onUpdateRelation={actions.handleUpdateRelation}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onMove={actions.handleMove}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              treeSort={treeSort}
              onTreeSortChange={setTreeSort}
            />
          ) : viewMode === 'pert' ? (
            <PertView
              items={filterBySearch(allItemsData?.data)}
              relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
              spaceName={space?.name ?? ''}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMove={actions.handleMove}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
              onUpdateRelation={actions.handleUpdateRelation}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              spaceId={spaceId}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
              treeSort={treeSort}
              onTreeSortChange={setTreeSort}
            />
          ) : viewMode === 'mindmap' ? (
            <MindMapView
              key={spaceId}
              items={filterBySearch(allItemsData?.data)}
              spaceName={space?.name || 'Espace'}
              spaceId={spaceId}
              communitySpaces={communitySpaces || []}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMove={actions.handleMove}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onMoveToSpaceDirect={actions.handleMoveItemToSpace}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onReorder={actions.handleReorder}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
              onUpdateRelation={actions.handleUpdateRelation}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'graph' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="graph" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="graph" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <GraphView
                level="space"
                entityId={spaceId}
                spaceId={spaceId}
                spaceName={space?.name}
                communityId={space?.communityId || undefined}
                communityName={space?.community?.name}
                onNodeClick={(itemId) => setEditingItemId(itemId)}
                highlightType={activeTypeFilter}
                highlightStatus={activeStatusFilter}
                highlightColor={highlightColor}
                searchMatchIds={searchMatchIds}
                additionalSpaceIds={checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined}
              />
              </div>
            </div>
          ) : viewMode === 'sunburst' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="sunburst" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="sunburst" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <SunburstView
                  spaceId={spaceId}
                  spaceName={space?.name}
                  onNodeClick={(itemId) => setEditingItemId(itemId)}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  highlightColor={highlightColor}
                  searchMatchIds={searchMatchIds}
                  additionalSpaceIds={checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined}
                />
              </div>
            </div>
          ) : viewMode === 'relations' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="relations" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="relations" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <RelationsMapView
                  items={(itemsData?.data || []) as Item[]}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onNodeClick={(itemId) => setEditingItemId(itemId)}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  highlightColor={highlightColor}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'bubble' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="bubble" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="bubble" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <BubbleView
                  items={(allItemsData?.data || []) as Item[]}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onItemClick={(itemId) => setEditingItemId(itemId)}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  highlightColor={highlightColor}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'radialTree' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="radialTree" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="radialTree" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <RadialTreeView
                  items={(allItemsData?.data || []) as Item[]}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onItemClick={(itemId) => setEditingItemId(itemId)}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'treemap' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="treemap" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="treemap" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <TreemapView
                items={(allItemsData?.data || []) as Item[]}
                portalGroups={portalGroups}
                currentSpaceId={spaceId}
                onItemClick={(itemId) => setEditingItemId(itemId)}
                highlightType={activeTypeFilter}
                highlightStatus={activeStatusFilter}
                searchMatchIds={searchMatchIds}
              />
              </div>
            </div>
          ) : viewMode === 'burndown' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="burndown" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="burndown" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <BurndownView
                items={(allItemsData?.data || []) as Item[]}
                portalGroups={portalGroups}
                currentSpaceId={spaceId}
                onItemClick={(itemId) => setEditingItemId(itemId)}
                highlightType={activeTypeFilter}
                highlightStatus={activeStatusFilter}
                searchMatchIds={searchMatchIds}
              />
              </div>
            </div>
          ) : viewMode === 'cfd' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="cfd" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="cfd" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <CfdView
                items={(allItemsData?.data || []) as Item[]}
                portalGroups={portalGroups}
                currentSpaceId={spaceId}
                onItemClick={(itemId) => setEditingItemId(itemId)}
                highlightType={activeTypeFilter}
                highlightStatus={activeStatusFilter}
                searchMatchIds={searchMatchIds}
              />
              </div>
            </div>
          ) : viewMode === 'chord' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="chord" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="chord" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <ChordView
                  items={(allItemsData?.data || []) as Item[]}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onItemClick={(itemId) => setEditingItemId(itemId)}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'crossTable' ? (
              <CrossTableView
              items={filterBySearch(allItemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'heatmap' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="heatmap" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="heatmap" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <HeatmapView
                  items={filterBySearch(allItemsData?.data)}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onEdit={setEditingItemId}
                  referentiels={referentiels}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'ego' ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
                {canEdit && (
                  <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    + Nouveau
                  </button>
                )}
                <div className="flex-1" />
                <ViewHelpButton viewMode="ego" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
                {space?.name && viewContainerRef && (
                  <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="ego" viewContainerRef={viewContainerRef} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <EgoNetworkView
                  items={filterBySearch(allItemsData?.data)}
                  relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
                  portalGroups={portalGroups}
                  currentSpaceId={spaceId}
                  onEdit={setEditingItemId}
                  referentiels={referentiels}
                  highlightType={activeTypeFilter}
                  highlightStatus={activeStatusFilter}
                  searchMatchIds={searchMatchIds}
                />
              </div>
            </div>
          ) : viewMode === 'members' ? (
            <MembersKanbanView
              items={filterBySearch(itemsData?.data)}
              spaceId={spaceId!}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateAssignee={(id, assignedToId) => actions.handleInlineUpdate(id, { assignedToId })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              spaceRole={space?.role}
              onNewItem={canEdit ? handleNewItem : undefined}
              exportSpaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'priority' ? (
              <PriorityView
              items={filterBySearch(itemsData?.data)}
              portalGroups={portalGroups}
              currentSpaceId={spaceId}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdatePriority={(id, priority) => actions.handleInlineUpdate(id, { priority })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'todo' ? (
              <TodoView
              items={filterBySearch(itemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'bugs' ? (
              <BugsView
              items={filterBySearch(itemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              referentiels={referentiels}
              canEdit={canEdit}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'documents' ? (
              <DocumentsView
              items={filterBySearch(itemsData?.data)}
              portalGroups={portalGroups}
              currentSpaceId={spaceId}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onMove={actions.handleMove}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'links' ? (
              <LinksView
              items={filterBySearch(itemsData?.data)}
              portalGroups={portalGroups}
              currentSpaceId={spaceId}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onMove={actions.handleMove}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : viewMode === 'images' ? (
              <ImagesView
              items={filterBySearch(itemsData?.data)}
              portalGroups={portalGroups}
              currentSpaceId={spaceId}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}
              onOpenInNewTab={actions.handleOpenInNewTab}
              onMove={actions.handleMove}
              referentiels={referentiels}
              canEdit={canEdit}
              canEditItem={canEditItem}
              onNewItem={canEdit ? handleNewItem : undefined}
              spaceName={space?.name}
              viewContainerRef={viewContainerRef}
              onStartTour={() => startViewTour(viewMode)}
              pulseHelp={pulseHelp}
            />
          ) : itemsData?.data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun élément</p>
              <p className="text-sm">Créez votre premier élément pour commencer</p>
            </div>
          ) : (
            /* Tree view (default) */
            <div className="flex flex-col h-full overflow-hidden">
            <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
              {canEdit && (
                <button onClick={handleNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  + Nouveau
                </button>
              )}
              <div className="h-4 w-px bg-border mx-1" />
              <button
                onClick={handleToggleExpand}
                className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={hasExpandedItems ? 'Tout réduire' : 'Tout étendre'}
              >
                {hasExpandedItems ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hasExpandedItems ? 'Réduire' : 'Étendre'}</span>
              </button>
              <div className="flex-1" />
              <ViewHelpButton viewMode="tree" onStartTour={() => startViewTour(viewMode)} pulse={pulseHelp} />
              {space?.name && viewContainerRef && (
                <SpaceExportButton items={itemsData?.data ?? []} spaceName={space.name} viewMode="tree" viewContainerRef={viewContainerRef} />
              )}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="flex-1 overflow-auto">
                <div className="py-2">
                  {filterBySearch(applyTreeSort(rootItems, treeViewSort)).map((item: Item & { childCount?: number }, index: number) => (
                    <TreeItem
                      key={item.id}
                      item={item}
                      depth={0}
                      orderNumber={`${index + 1}`}
                      isExpanded={expandedItems.has(item.id)}
                      onToggleExpand={toggleExpanded}
                      onEdit={setEditingItemId}
                      onDelete={actions.handleDelete}
                      onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
                      onAddChild={handleAddChild}
                      onMoveToSpace={(id) => setMoveItemId(id)}
                      onDuplicateToSpace={(id) => setDuplicateItemId(id)}
                      onConvertToSpace={actions.handleConvertToSpace}
                      onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
                      spaceId={spaceId!}
                      isOver={overId === item.id}
                      onMove={actions.handleMove}
                      globalOverId={overId}
                      globalDropMode={dropMode}
                      globalDropPosition={dropPosition}                      expandedItems={expandedItems}
                      canEdit={canEdit}
                      highlightType={activeTypeFilter}
                      highlightStatus={activeStatusFilter}
                      highlightColor={highlightColor}
                      searchMatchIds={searchMatchIds}
                      statusColorMap={statusColorMap}
                      statusLabelMap={statusLabelMap}
                      isFirstTreeItem={index === 0}
                    />
                  ))}
                  {/* Portal sections for items from checked child spaces */}
                  {portalGroups.map((group) => (
                    <div key={`portal-${group.spaceId}`} className="mt-2">
                      <Link
                        to={`/spaces/${group.spaceId}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/50 hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"
                      >
                        <FolderKanban className="w-4 h-4 text-primary" />
                        <span>{group.spaceName}</span>
                        <span className="text-xs text-muted-foreground/60">({group.items.length})</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                      </Link>
                      {group.items.map((item: Item & { childCount?: number }, index: number) => (
                        <TreeItem
                          key={item.id}
                          item={item}
                          depth={1}
                          orderNumber={`${index + 1}`}
                          isExpanded={expandedItems.has(item.id)}
                          onToggleExpand={toggleExpanded}
                          onEdit={setEditingItemId}
                          onDelete={actions.handleDelete}
                          onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
                          onAddChild={handleAddChild}
                          onMoveToSpace={(id) => setMoveItemId(id)}
                          onDuplicateToSpace={(id) => setDuplicateItemId(id)}
                          onConvertToSpace={actions.handleConvertToSpace}
                          onSelfAssign={handleSelfAssign}
              onMerge={actions.handleMerge}
              onAbsorbChildren={actions.handleAbsorbChildren}
              onSplitDescription={actions.handleSplitDescription}
              onOpen={actions.handleOpen}

              onOpenInNewTab={actions.handleOpenInNewTab}
                          spaceId={group.spaceId}
                          isOver={overId === item.id}
                          onMove={actions.handleMove}
                          globalOverId={overId}
                          globalDropMode={dropMode}
                          globalDropPosition={dropPosition}                          expandedItems={expandedItems}
                          canEdit={false}
                          highlightType={activeTypeFilter}
                          highlightStatus={activeStatusFilter}
                          highlightColor={highlightColor}
                          searchMatchIds={searchMatchIds}
                          statusColorMap={statusColorMap}
                          statusLabelMap={statusLabelMap}
                        />
                      ))}
                    </div>
                  ))}
                  {activeId && (
                    <RootDropZone isOver={overId === 'root'} />
                  )}
                </div>
              </div>
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-card border-2 border-primary rounded-md shadow-xl max-w-xs">
                    {TYPE_ICONS[activeItem.type] && (
                      <span className="w-4 h-4 text-muted-foreground">
                        {(() => { const Icon = TYPE_ICONS[activeItem.type]; return <Icon className="w-4 h-4" />; })()}
                      </span>
                    )}
                    <span className="truncate font-medium">{activeItem.title}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <ItemEditModal
        isOpen={!!editingItemId}
        onClose={() => setEditingItemId(null)}
        spaceId={(() => {
          const editItem = allItems.find((i: Item) => i.id === editingItemId);
          return editItem?.spaceId || spaceId!;
        })()}
        itemId={editingItemId}
        allItems={allItems}
        referentiels={referentiels}
        canEdit={canEdit}
        spaceRole={space?.role}
        spaceName={space?.name}
        communityName={space?.community?.name}
        onNavigate={setEditingItemId}
        onDelete={actions.handleDelete}
        onConvertToSpace={actions.handleConvertToSpace}
        onMerge={actions.handleMerge}
        onAbsorbChildren={actions.handleAbsorbChildren}
        onSplitDescription={actions.handleSplitDescription}
      />


      {canEdit && (
        <>
          {/* Move to space modal (selection mode) */}
          <MoveToSpaceModal isOpen={showMoveModal} onClose={() => setShowMoveModal(false)} currentSpaceId={spaceId!} />

          {/* Move to space modal (single item) */}
          <MoveToSpaceModal isOpen={!!moveItemId} onClose={() => setMoveItemId(null)} currentSpaceId={spaceId!} itemIds={moveItemId ? [moveItemId] : undefined} />

          {/* Duplicate to space modal (selection mode) */}
          <DuplicateToSpaceModal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} currentSpaceId={spaceId!} />

          {/* Duplicate to space modal (single item) */}
          <DuplicateToSpaceModal isOpen={!!duplicateItemId} onClose={() => setDuplicateItemId(null)} currentSpaceId={spaceId!} itemIds={duplicateItemId ? [duplicateItemId] : undefined} />
        </>
      )}

      {/* Convert to space modal */}
      <ConvertToSpaceModal
        isOpen={!!actions.convertingItem}
        onClose={() => actions.setConvertingItem(null)}
        onConfirm={actions.confirmConvertToSpace}
        itemTitle={actions.convertingItem?.title || ''}
        childCount={actions.convertingItem?.childCount || 0}
        isPending={actions.convertToSpacePending}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={!!actions.deletingItem}
        onClose={() => actions.setDeletingItem(null)}
        onConfirm={actions.confirmDelete}
        itemTitle={actions.deletingItem?.title || ''}
        itemType={actions.deletingItem?.type || 'NOTE'}
        childCount={actions.deletingItem?.childCount || 0}
        contributionCount={actions.deletingItem?.contributionCount || 0}
        description={actions.deletingItem?.description}
        status={actions.deletingItem?.status}
        priority={actions.deletingItem?.priority}
        dueDate={actions.deletingItem?.dueDate}
        startDate={actions.deletingItem?.startDate}
        endDate={actions.deletingItem?.endDate}
        url={actions.deletingItem?.url}
        assignedToName={actions.deletingItem?.assignedToName}
        tags={actions.deletingItem?.tags}
      />

      {/* Merge item modal */}
      <MergeItemModal
        isOpen={!!actions.mergingItemId}
        onClose={() => actions.setMergingItemId(null)}
        sourceItem={allItems.find(i => i.id === actions.mergingItemId) || null}
        allItems={allItems}
        spaceId={spaceId!}
      />

      {/* Cross-space move confirmation modal */}
      <Modal
        isOpen={!!actions.pendingCrossSpaceMove}
        onClose={() => actions.setPendingCrossSpaceMove(null)}
        title="Déplacer vers un autre espace"
        size="small"
      >
        {actions.pendingCrossSpaceMove && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <FolderInput className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold truncate">{actions.pendingCrossSpaceMove.itemTitle}</span>
            </div>

            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Cet élément a <strong>{actions.pendingCrossSpaceMove.childCount}</strong> descendant{actions.pendingCrossSpaceMove.childCount > 1 ? 's' : ''}.
                Voulez-vous aussi les déplacer vers <strong>{actions.pendingCrossSpaceMove.targetSpaceName}</strong> ?
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full"
                onClick={() => {
                  const m = actions.pendingCrossSpaceMove!;
                  actions.setPendingCrossSpaceMove(null);
                  actions.executeCrossSpaceMove(m.itemId, m.sourceSpaceId, m.targetSpaceId, true, m.updates);
                }}
              >
                Déplacer avec les {actions.pendingCrossSpaceMove.childCount} descendant{actions.pendingCrossSpaceMove.childCount > 1 ? 's' : ''}
              </Button>
              <Button
                variant="bordered"
                className="w-full"
                onClick={() => {
                  const m = actions.pendingCrossSpaceMove!;
                  actions.setPendingCrossSpaceMove(null);
                  actions.executeCrossSpaceMove(m.itemId, m.sourceSpaceId, m.targetSpaceId, false, m.updates);
                }}
              >
                Déplacer seul
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => actions.setPendingCrossSpaceMove(null)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Status propagation confirmation */}
      <StatusPropagationModal
        isOpen={!!actions.pendingStatusPropagation}
        itemTitle={actions.pendingStatusPropagation?.itemTitle || ''}
        childCount={actions.pendingStatusPropagation?.childCount || 0}
        onPropagate={() => actions.confirmStatusPropagation()}
        onKeepOnly={() => actions.setPendingStatusPropagation(null)}
        onCancel={() => actions.cancelStatusPropagation()}
      />
    </div>
  );
}
