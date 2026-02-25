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
  ArrowDownAZ,
  GitBranch,
  FolderKanban,
  ExternalLink,
  FolderInput,
  AlertTriangle,
} from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import type { Item, ItemType } from '@spok/shared';
import { ITEM_TYPES } from '@spok/shared';
import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';
import { useReferentiels } from '../hooks/useReferentiels';
import { useSpaces } from '../hooks/useSpaces';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ItemEditModal } from '../components/ItemEditModal';
import { useViewModeStore } from '../stores/viewMode';
import { useSpaceStore } from '../stores/space';
import { useSelectionStore } from '../stores/selection';
import { ListView } from '../components/views/ListView';
import { SequenceView } from '../components/views/SequenceView';
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
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ConvertToSpaceModal } from '../components/ConvertToSpaceModal';

import { TYPE_ICONS, TYPE_LABELS, STORAGE_KEYS, getTypeColor } from '../constants/ui';
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

  // --- New item form state ---
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<ItemType>('NOTE');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemParentId, setNewItemParentId] = useState<string>('');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  const [newItemStartDate, setNewItemStartDate] = useState('');
  const [newItemEndDate, setNewItemEndDate] = useState('');

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getDefaultProjectDates = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { startDate: formatDateForInput(today), endDate: formatDateForInput(tomorrow) };
  };

  const getDefaultMeetingDates = () => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(now.getHours() + 1, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);
    return { startDate: formatDateForInput(startDate), endDate: formatDateForInput(endDate) };
  };

  const handleItemTypeChange = (type: ItemType) => {
    setNewItemType(type);
    if (type === 'PROJECT' || type === 'PERIOD') {
      const { startDate, endDate } = getDefaultProjectDates();
      setNewItemStartDate(startDate);
      setNewItemEndDate(endDate);
    } else if (type === 'MEETING') {
      const { startDate, endDate } = getDefaultMeetingDates();
      setNewItemStartDate(startDate);
      setNewItemEndDate(endDate);
    } else {
      setNewItemStartDate('');
      setNewItemEndDate('');
    }
  };

  // --- UI state ---
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ItemType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const mindmapRef = useRef<MindMapViewHandle>(null);
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
  const isFlatView = viewMode === 'kanban' || viewMode === 'types' || viewMode === 'list' || viewMode === 'planning' || viewMode === 'calendar';
  const isHighlightMode = isTreeView || viewMode === 'sequence' || viewMode === 'planning' || viewMode === 'calendar' || viewMode === 'graph' || viewMode === 'sunburst';
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

  // Create item mutation (kept here because onSuccess clears form state)
  const createItemMutation = useMutation({
    mutationFn: (data: { type: ItemType; title: string; url?: string; parentId?: string; status?: string; dueDate?: string; startDate?: string; endDate?: string }) =>
      itemsApi.create(spaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      setNewItemTitle('');
      setNewItemUrl('');
      setNewItemParentId('');
      setNewItemDueDate('');
      setNewItemStartDate('');
      setNewItemEndDate('');
      setShowNewItem(false);
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

  // --- Form handlers ---
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemTitle.trim()) {
      createItemMutation.mutate({
        type: newItemType,
        title: newItemTitle,
        url: newItemUrl || undefined,
        parentId: newItemParentId || undefined,
        status: 'todo',
        dueDate: newItemDueDate ? new Date(newItemDueDate).toISOString() : undefined,
        startDate: newItemStartDate ? new Date(newItemStartDate).toISOString() : undefined,
        endDate: newItemEndDate ? new Date(newItemEndDate).toISOString() : undefined,
      });
    }
  };

  type ParentSortMode = 'tree' | 'alpha';
  const [parentSortMode, setParentSortMode] = useState<ParentSortMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PARENT_SORT_MODE);
    return (saved as ParentSortMode) || 'tree';
  });

  const toggleParentSortMode = () => {
    const newMode = parentSortMode === 'tree' ? 'alpha' : 'tree';
    setParentSortMode(newMode);
    localStorage.setItem(STORAGE_KEYS.PARENT_SORT_MODE, newMode);
  };

  const parentOptions = useMemo(() => {
    if (parentSortMode === 'alpha') {
      const sorted = [...allItems].sort((a: Item, b: Item) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      );
      return [
        { value: '', label: 'Aucun parent (racine)' },
        ...sorted.map((item: Item) => ({ value: item.id, label: item.title })),
      ];
    } else {
      const buildTree = (parentId: string | null, depth: number): { value: string; label: string }[] => {
        const children = allItems
          .filter((item: Item) => (item.parentId || null) === parentId)
          .sort((a: Item, b: Item) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
        const result: { value: string; label: string }[] = [];
        for (const child of children) {
          const indent = depth > 0 ? '—'.repeat(depth) + ' ' : '';
          result.push({ value: child.id, label: `${indent}${child.title}` });
          result.push(...buildTree(child.id, depth + 1));
        }
        return result;
      };
      return [{ value: '', label: 'Aucun parent (racine)' }, ...buildTree(null, 0)];
    }
  }, [allItems, parentSortMode]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleAddChild = (parentId: string) => {
    setNewItemParentId(parentId);
    handleItemTypeChange('NOTE');
    setShowNewItem(true);
    setExpandedItems((prev) => new Set([...prev, parentId]));
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
    mindmapRef.current?.resetLayout();
  }, []);

  const handleNewItem = useCallback(() => {
    handleItemTypeChange(filter === 'ALL' ? 'NOTE' : filter);
    setShowNewItem(true);
  }, [filter]);

  // --- Render ---
  return (
    <div className={`p-4 flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' ? ' h-full overflow-hidden' : ''}`}>
      <div className={`w-full flex flex-col${viewMode === 'list' || viewMode === 'kanban' || viewMode === 'types' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' ? ' h-full' : ''}`}>
        {/* Toolbar */}
        <SpaceToolbar
          filter={filter}
          onFilterChange={setFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          isHighlightMode={isHighlightMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          totalItemCount={space?.itemCount || 0}
          filteredItemCount={itemsData?.total ?? itemsData?.data?.length ?? (space?.itemCount || 0)}
          searchMatchCount={searchMatchIds?.size}
          referentiels={referentiels}
          viewMode={viewMode}
          isExpanded={viewMode === 'mindmap' ? mindmapExpanded : hasExpandedItems}
          onToggleExpand={handleToggleExpand}
          onResetLayout={handleResetLayout}
          canEdit={canEdit}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => setSelectionMode(!isSelectionMode)}
          onNewItem={handleNewItem}
          spaceId={spaceId}
          spaceRole={space?.role}
        />

        {/* New item form */}
        {showNewItem && (
          <div className="bg-card border rounded-lg p-4 mb-6">
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {ITEM_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t];
                  const isActive = newItemType === t;
                  const typeColor = getTypeColor(t, referentiels?.typeLabels);
                  return (
                    <Button
                      key={t}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleItemTypeChange(t)}
                      className={isActive ? `border-2 ${typeColor.color}` : ''}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {TYPE_LABELS[t]}
                    </Button>
                  );
                })}
              </div>

              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder={`Titre de la ${TYPE_LABELS[newItemType].toLowerCase()}`}
                autoFocus
              />

              {(newItemType === 'LINK' || newItemType === 'DOCUMENT' || newItemType === 'IMAGE') && (
                <Input
                  type="url"
                  value={newItemUrl}
                  onChange={(e) => setNewItemUrl(e.target.value)}
                  placeholder="URL (https://...)"
                />
              )}

              {(newItemType === 'MEETING' || newItemType === 'PERIOD' || newItemType === 'PROJECT' || newItemType === 'TASK') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de début</label>
                    <Input type="datetime-local" value={newItemStartDate} onChange={(e) => setNewItemStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de fin</label>
                    <Input type="datetime-local" value={newItemEndDate} onChange={(e) => setNewItemEndDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Parent (optionnel)</label>
                  <button
                    type="button"
                    onClick={toggleParentSortMode}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}
                  >
                    {parentSortMode === 'tree' ? (
                      <><GitBranch className="w-3 h-3" /><span>Arborescence</span></>
                    ) : (
                      <><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></>
                    )}
                  </button>
                </div>
                <Select
                  value={newItemParentId}
                  onChange={(e) => setNewItemParentId(e.target.value)}
                  options={parentOptions}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createItemMutation.isPending}>Créer</Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowNewItem(false);
                  setNewItemTitle('');
                  setNewItemUrl('');
                  setNewItemParentId('');
                  setNewItemDueDate('');
                  setNewItemStartDate('');
                  setNewItemEndDate('');
                }}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Items / Views */}
        <div className={`bg-card border rounded-lg flex-1 min-h-0${viewMode === 'list' || viewMode === 'graph' || viewMode === 'mindmap' || viewMode === 'sunburst' ? ' overflow-hidden flex flex-col' : ''}`}>
          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
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
          ) : viewMode === 'sequence' ? (
            <SequenceView
              items={filterBySearch(allItemsData?.data)}
              relations={(allItemsData?.data || []).flatMap((item: any) => item.relationsFrom || [])}
              currentSpaceId={spaceId}
              portalGroups={portalGroups}
              onEdit={setEditingItemId}
              onDelete={actions.handleDelete}
              onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
              onAddChild={handleAddChild}
              onMoveToSpace={(id) => setMoveItemId(id)}
              onDuplicateToSpace={(id) => setDuplicateItemId(id)}
              onConvertToSpace={actions.handleConvertToSpace}
              onCreateRelation={actions.handleCreateRelation}
              onDeleteRelation={actions.handleDeleteRelation}
              referentiels={referentiels}
              highlightType={activeTypeFilter}
              highlightStatus={activeStatusFilter}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
              canEdit={canEdit}
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
