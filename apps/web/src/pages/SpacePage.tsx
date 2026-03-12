import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import type { Item, ItemType, ItemWithRelations } from '@spok/shared';
import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';
import { useReferentiels } from '../hooks/useReferentiels';
import { useSpaces } from '../hooks/useSpaces';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ItemEditModal } from '../components/ItemEditModal';
import { useViewModeStore } from '../stores/viewMode';
import { useSpaceStore } from '../stores/space';
import { useSelectionStore } from '../stores/selection';
import { ListView } from '../components/views/ListView';
import { KanbanView } from '../components/views/KanbanView';
import { TypesView } from '../components/views/TypesView';
import { TimelineView } from '../components/views/TimelineView';
import { MindMapView } from '../components/views/MindMapView';
import type { MindMapViewHandle } from '../components/views/MindMapView';
import { PlanningView } from '../components/views/PlanningView';
import { CalendarView } from '../components/views/CalendarView';
import { SelectionActionBar } from '../components/SelectionActionBar';
import { MoveToSpaceModal } from '../components/MoveToSpaceModal';
import { DuplicateToSpaceModal } from '../components/DuplicateToSpaceModal';
import { GraphView } from '../components/views/GraphView';
import { TextView } from '../components/views/TextView';
import { SunburstView } from '../components/views/SunburstView';
import { RelationsMapView } from '../components/views/RelationsMapView';
import { SchemaView } from '../components/views/SchemaView';
import { BubbleView } from '../components/views/BubbleView';
import { RadialTreeView } from '../components/views/RadialTreeView';
import { TreemapView } from '../components/views/TreemapView';
import { BurndownView } from '../components/views/BurndownView';
import { CfdView } from '../components/views/CfdView';
import { ChordView } from '../components/views/ChordView';
import { CrossTableView } from '../components/views/CrossTableView';
import { HeatmapView } from '../components/views/HeatmapView';
import { EgoNetworkView } from '../components/views/EgoNetworkView';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ConvertToSpaceModal } from '../components/ConvertToSpaceModal';

import { TYPE_ICONS, getTypeColor } from '../constants/ui';
import { stripMarkup } from '../lib/bbcode';

// Extracted components and hooks
import { TreeItem, RootDropZone } from './space-tree-view';
import { useSpaceActions } from './useSpaceActions';
import { SpaceToolbar } from './SpaceToolbar';

export function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const queryClient = useQueryClient();
  const { mode: viewMode } = useViewModeStore();
  const { selectedIds, isSelectionMode, toggleSelection, setSelectionMode, clearSelection } = useSelectionStore();



  // --- UI state ---
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ItemType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const mindmapRef = useRef<MindMapViewHandle>(null);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const schemaReorganizeRef = useRef<(() => void) | null>(null);
  const [mindmapExpanded, setMindmapExpanded] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [duplicateItemId, setDuplicateItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { includeChildrenSpaceIds } = useSpaceStore();

  // Clear selection when leaving the page or changing space
  useEffect(() => {
    return () => clearSelection();
  }, [spaceId, clearSelection]);

  // --- Queries ---
  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const canEdit = space?.role !== 'VIEWER';

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
  const isTreeView = viewMode === 'mindmap' || viewMode === 'tree' || viewMode === 'timeline' || viewMode === 'text';
  const isFlatView = viewMode === 'kanban' || viewMode === 'types' || viewMode === 'list' || viewMode === 'planning' || viewMode === 'calendar' || viewMode === 'schema' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego';
  const isHighlightMode = isTreeView || viewMode === 'planning' || viewMode === 'calendar' || viewMode === 'graph' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'schema' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego';
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
    return [...groupedBySpace.entries()].map(([sid, items]) => ({
      spaceId: sid,
      spaceName: communitySpaces?.find(s => s.id === sid)?.name || 'Espace',
      items,
    }));
  }, [itemsData?.data, spaceId, checkedDescendantIds, communitySpaces]);

  const { data: allItemsData } = useQuery({
    queryKey: ['items', spaceId, 'all', checkedDescendantIds],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 5000, additionalSpaceIds: checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined }),
    enabled: !!spaceId,
  });

  const { data: textViewData } = useQuery({
    queryKey: ['items', spaceId, 'all-with-contributions', checkedDescendantIds],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 5000, include: 'contributions', additionalSpaceIds: checkedDescendantIds.length > 0 ? checkedDescendantIds : undefined }),
    enabled: !!spaceId && viewMode === 'text',
  });

  // All items for lookups (allItemsData preferred, fallback to itemsData)
  const allItems = useMemo(() => allItemsData?.data || itemsData?.data || [], [allItemsData?.data, itemsData?.data]);

  // --- Search ---
  const filterBySearch = useCallback((items: Item[] | undefined): Item[] => {
    if (!items) return [];
    if (!searchQuery.trim() || isHighlightMode) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      stripMarkup(item.description || '').toLowerCase().includes(query)
    );
  }, [searchQuery, isHighlightMode]);

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
    mutationFn: (data: { type: ItemType; title: string; url?: string; parentId?: string; status?: string; dueDate?: string; startDate?: string; endDate?: string }) =>
      itemsApi.create(spaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  // --- DnD state & handlers ---
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'reorder' | 'nest'>('nest');
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'nest'>('nest');
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

    const rootItemsList = itemsData?.data || [];
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

  const handleAddChild = (parentId: string) => {
    createItemMutation.mutate(
      { type: 'NOTE', title: '', status: 'todo', parentId },
      { onSuccess: (created: any) => {
        setEditingItemId(created.id);
        setExpandedItems((prev) => new Set([...prev, parentId]));
      }},
    );
  };

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
    if (viewMode === 'mindmap') {
      if (mindmapExpanded) {
        mindmapRef.current?.collapseAll();
        setMindmapExpanded(false);
      } else {
        mindmapRef.current?.expandAll();
        setMindmapExpanded(true);
      }
    } else {
      hasExpandedItems ? collapseAll() : expandAll();
    }
  }, [viewMode, mindmapExpanded, hasExpandedItems]);

  const handleResetLayout = useCallback(() => {
    if (viewMode === 'schema') {
      schemaReorganizeRef.current?.();
    } else {
      mindmapRef.current?.resetLayout();
    }
  }, [viewMode]);

  const handleFitAll = useCallback(() => {
    mindmapRef.current?.fitAll();
  }, []);

  const handleNewItem = useCallback(() => {
    const type = filter === 'ALL' ? 'NOTE' : filter;
    createItemMutation.mutate(
      { type, title: '', status: 'todo' },
      { onSuccess: (created: any) => { setEditingItemId(created.id); } },
    );
  }, [filter, createItemMutation]);

  // --- Render ---
  return (
    <div className={`p-4 flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'schema' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' ? ' h-full overflow-hidden' : ''}`}>
      <div className={`w-full flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'schema' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' ? ' h-full' : ''}`}>
        {/* Toolbar */}
        <SpaceToolbar
          filter={filter}
          onFilterChange={setFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          isHighlightMode={isHighlightMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          totalItemCount={allItemsData?.data?.length ?? itemsData?.data?.length ?? space?.itemCount ?? 0}
          filteredItemCount={itemsData?.total ?? itemsData?.data?.length ?? (space?.itemCount || 0)}
          searchMatchCount={searchMatchIds?.size}
          referentiels={referentiels}
          viewMode={viewMode}
          isExpanded={viewMode === 'mindmap' ? mindmapExpanded : hasExpandedItems}
          onToggleExpand={handleToggleExpand}
          onResetLayout={handleResetLayout}
          onFitAll={viewMode === 'mindmap' ? handleFitAll : undefined}
          canEdit={canEdit}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => setSelectionMode(!isSelectionMode)}
          onNewItem={handleNewItem}
          spaceId={spaceId}
          spaceRole={space?.role}
          items={allItems}
          spaceName={space?.name}
          viewContainerRef={viewContainerRef}
        />

        {/* Items / Views */}
        <div ref={viewContainerRef} className={`bg-card border rounded-lg flex-1 min-h-0${viewMode === 'list' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' || viewMode === 'relations' || viewMode === 'schema' || viewMode === 'bubble' || viewMode === 'radialTree' || viewMode === 'treemap' || viewMode === 'burndown' || viewMode === 'cfd' || viewMode === 'chord' || viewMode === 'crossTable' || viewMode === 'heatmap' || viewMode === 'ego' ? ' overflow-hidden flex flex-col' : ''}`}>
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
              referentiels={referentiels}
              canEdit={canEdit}
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
              referentiels={referentiels}
              canEdit={canEdit}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
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
              onMoveItemToSpace={actions.handleMoveItemToSpace}
              referentiels={referentiels}
              canEdit={canEdit}
            />
          ) : viewMode === 'types' ? (
            <TypesView
              items={filterBySearch(itemsData?.data)}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateType={(id, type) => actions.handleInlineUpdate(id, { type })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onMoveItemToSpace={actions.handleMoveItemToSpace}
              referentiels={referentiels}
              canEdit={canEdit}
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
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
            />
          ) : viewMode === 'calendar' ? (
            <CalendarView
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
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
            />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              items={filterBySearch(allItemsData?.data)}
              relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
              currentSpaceId={spaceId}
              spaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onUpdateDates={(id, startDate, endDate) => actions.handleInlineUpdate(id, { startDate, endDate })}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
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
            />
          ) : viewMode === 'mindmap' ? (
            <MindMapView
              ref={mindmapRef}
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
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
              onUpdateRelation={actions.handleUpdateRelation}
              referentiels={referentiels}
              canEdit={canEdit}
            />
          ) : viewMode === 'graph' ? (
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
          ) : viewMode === 'sunburst' ? (
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
          ) : viewMode === 'relations' ? (
            <RelationsMapView
              items={(itemsData?.data || []) as Item[]}
              onNodeClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'schema' ? (
            <SchemaView
              items={(allItemsData?.data || []) as ItemWithRelations[]}
              spaceId={spaceId!}
              onEdit={(itemId) => setEditingItemId(itemId)}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              doneStatusId={referentiels?.statuses?.find(s => s.id === 'done')?.id || 'done'}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
              portalItems={portalGroups.flatMap(g => g.items) as ItemWithRelations[]}
              canEdit={canEdit}
              onReorganizeRef={schemaReorganizeRef}
            />
          ) : viewMode === 'bubble' ? (
            <BubbleView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'radialTree' ? (
            <RadialTreeView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'treemap' ? (
            <TreemapView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'burndown' ? (
            <BurndownView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'cfd' ? (
            <CfdView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'chord' ? (
            <ChordView
              items={(allItemsData?.data || []) as Item[]}
              onItemClick={(itemId) => setEditingItemId(itemId)}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'crossTable' ? (
            <CrossTableView
              items={filterBySearch(allItemsData?.data)}
              currentSpaceId={spaceId}
              onEdit={setEditingItemId}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'heatmap' ? (
            <HeatmapView
              items={filterBySearch(allItemsData?.data)}
              onEdit={setEditingItemId}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : viewMode === 'ego' ? (
            <EgoNetworkView
              items={filterBySearch(allItemsData?.data)}
              relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
              onEdit={setEditingItemId}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              searchMatchIds={searchMatchIds}
            />
          ) : itemsData?.data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun élément</p>
              <p className="text-sm">Créez votre premier élément pour commencer</p>
            </div>
          ) : (
            /* Tree view (default) */
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div>
                <div className="py-2">
                  {rootItems.map((item: Item & { childCount?: number }, index: number) => (
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
                      spaceId={spaceId!}
                      isOver={overId === item.id}
                      onMove={actions.handleMove}
                      globalOverId={overId}
                      globalDropMode={dropMode}
                      globalDropPosition={dropPosition}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelection={toggleSelection}
                      expandedItems={expandedItems}
                      canEdit={canEdit}
                      highlightType={activeTypeFilter}
                      highlightStatus={activeStatusFilter}
                      highlightColor={highlightColor}
                      searchMatchIds={searchMatchIds}
                      statusColorMap={statusColorMap}
                      statusLabelMap={statusLabelMap}
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
                          spaceId={group.spaceId}
                          isOver={overId === item.id}
                          onMove={actions.handleMove}
                          globalOverId={overId}
                          globalDropMode={dropMode}
                          globalDropPosition={dropPosition}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedIds.has(item.id)}
                          onToggleSelection={toggleSelection}
                          expandedItems={expandedItems}
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
        spaceName={space?.name}
        onNavigate={setEditingItemId}
        onDelete={actions.handleDelete}
      />

      {/* Selection action bar */}
      {isSelectionMode && (
        <SelectionActionBar
          onMoveToSpace={() => setShowMoveModal(true)}
          onDuplicateToSpace={() => setShowDuplicateModal(true)}
        />
      )}

      {/* Move to space modal (selection mode) */}
      <MoveToSpaceModal isOpen={showMoveModal} onClose={() => setShowMoveModal(false)} currentSpaceId={spaceId!} />

      {/* Move to space modal (single item) */}
      <MoveToSpaceModal isOpen={!!moveItemId} onClose={() => setMoveItemId(null)} currentSpaceId={spaceId!} itemIds={moveItemId ? [moveItemId] : undefined} />

      {/* Duplicate to space modal (selection mode) */}
      <DuplicateToSpaceModal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} currentSpaceId={spaceId!} />

      {/* Duplicate to space modal (single item) */}
      <DuplicateToSpaceModal isOpen={!!duplicateItemId} onClose={() => setDuplicateItemId(null)} currentSpaceId={spaceId!} itemIds={duplicateItemId ? [duplicateItemId] : undefined} />

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
                variant="outline"
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
    </div>
  );
}
