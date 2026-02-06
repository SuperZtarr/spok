import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  FileText,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Trash2,
  GripVertical,
  ListChecks,
  ExternalLink,
  ArrowDownAZ,
  GitBranch,
  Settings,
  History,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import type { Item, ItemType } from '@spok/shared';
import { useReferentiels } from '../hooks/useReferentiels';
import { useSpaces } from '../hooks/useSpaces';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { ItemEditModal } from '../components/ItemEditModal';
import { useViewModeStore } from '../stores/viewMode';
import { useSelectionStore } from '../stores/selection';
import { ListView } from '../components/views/ListView';
import { SequenceView } from '../components/views/SequenceView';
import { KanbanView } from '../components/views/KanbanView';
import { TypesView } from '../components/views/TypesView';
import { TimelineView } from '../components/views/TimelineView';
import { MindMapView } from '../components/views/MindMapView';
import { PlanningView } from '../components/views/PlanningView';
import { SelectionActionBar } from '../components/SelectionActionBar';
import { MoveToSpaceModal } from '../components/MoveToSpaceModal';
import { DuplicateToSpaceModal } from '../components/DuplicateToSpaceModal';

import { TYPE_ICONS, TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, STORAGE_KEYS } from '../constants/ui';

export function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const queryClient = useQueryClient();
  const { mode: viewMode } = useViewModeStore();
  const { selectedIds, isSelectionMode, toggleSelection, setSelectionMode, clearSelection } = useSelectionStore();

  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<ItemType>('NOTE');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemParentId, setNewItemParentId] = useState<string>('');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  const [newItemStartDate, setNewItemStartDate] = useState('');
  const [newItemEndDate, setNewItemEndDate] = useState('');

  // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to get default dates for PROJECT type (today 00:00 -> tomorrow 00:00)
  const getDefaultProjectDates = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      startDate: formatDateForInput(today),
      endDate: formatDateForInput(tomorrow),
    };
  };

  // Helper to get default dates for MEETING type (next hour -> +1h)
  const getDefaultMeetingDates = () => {
    const now = new Date();
    // Round to next hour with 0 minutes
    const startDate = new Date(now);
    startDate.setHours(now.getHours() + 1, 0, 0, 0);
    // End date is 1 hour after start
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);
    return {
      startDate: formatDateForInput(startDate),
      endDate: formatDateForInput(endDate),
    };
  };

  // Handle item type change with default dates for PROJECT, PERIOD and MEETING
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
      // Clear dates for other types
      setNewItemStartDate('');
      setNewItemEndDate('');
    }
  };
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ItemType | 'ALL'>('ALL');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Clear selection when leaving the page or changing space
  useEffect(() => {
    return () => clearSelection();
  }, [spaceId, clearSelection]);

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  // Load referentiels for this space
  const { data: referentielsData } = useReferentiels(spaceId!);
  const referentiels = referentielsData?.referentiels;

  // Load spaces from the same community (for portal feature in mindmap)
  const { data: communitySpaces } = useSpaces(space?.communityId || undefined);

  // Tree-based views (mindmap, tree, timeline) need ALL items to rebuild hierarchy
  const isTreeView = viewMode === 'mindmap' || viewMode === 'tree' || viewMode === 'timeline';
  // Flat views (kanban, types, planning, list) show all items without hierarchy filtering
  const isFlatView = viewMode === 'kanban' || viewMode === 'types' || viewMode === 'list' || viewMode === 'planning';

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', spaceId, filter, viewMode],
    queryFn: () =>
      itemsApi.list(spaceId!, {
        type: filter === 'ALL' ? undefined : filter,
        // Tree views need all items (no parentId filter) to build the full hierarchy
        // Flat views also need all items
        // Only filter by parentId for non-tree, non-flat views
        parentId: filter === 'ALL' && !isFlatView && !isTreeView ? null : undefined,
        pageSize: 5000,
      }),
    enabled: !!spaceId,
  });

  // Load all items for parent selector (without filter)
  const { data: allItemsData } = useQuery({
    queryKey: ['items', spaceId, 'all'],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 5000 }),
    enabled: !!spaceId,
  });

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

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => itemsApi.delete(spaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; type?: ItemType; startDate?: string | null; endDate?: string | null } }) =>
      itemsApi.update(spaceId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: ({ id, parentId, position }: { id: string; parentId?: string | null; position: number }) =>
      itemsApi.move(spaceId!, id, { parentId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const createRelationMutation = useMutation({
    mutationFn: ({ fromItemId, toItemId, type }: { fromItemId: string; toItemId: string; type: string }) =>
      itemsApi.createRelation(spaceId!, fromItemId, { toItemId, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: ({ itemId, relationId }: { itemId: string; relationId: string }) =>
      itemsApi.deleteRelation(spaceId!, itemId, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'reorder' | 'nest'>('nest');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Track if Shift key is held for nest mode
  const [shiftHeld, setShiftHeld] = useState(false);

  // Listen for Shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverId(overId);

    // Default = nest (make child), Shift held = reorder
    if (event.over) {
      setDropMode(shiftHeld ? 'reorder' : 'nest');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropMode = dropMode;
    setActiveId(null);
    setOverId(null);
    setDropMode('nest');

    if (!over || active.id === over.id) return;

    // Use allItemsData to find any item (including children)
    const allItems = allItemsData?.data || [];
    const rootItems = itemsData?.data || [];
    const activeItem = allItems.find((item: Item) => item.id === active.id);

    if (!activeItem) return;

    // Handle drop on root zone
    if (over.id === 'root') {
      moveItemMutation.mutate({
        id: active.id as string,
        parentId: null,
        position: 0,
      });
      return;
    }

    const overItem = allItems.find((item: Item) => item.id === over.id);
    // Find position among siblings
    const siblings = overItem?.parentId
      ? allItems.filter((item: Item) => item.parentId === overItem.parentId)
      : rootItems;
    const overIndex = siblings.findIndex((item: Item) => item.id === over.id);

    if (!overItem) return;

    if (currentDropMode === 'nest') {
      // Make the active item a child of the over item
      moveItemMutation.mutate({
        id: active.id as string,
        parentId: over.id as string,
        position: 0,
      });
      // Auto-expand the parent to show the new child
      setExpandedItems((prev) => new Set([...prev, over.id as string]));
    } else {
      // Reorder at the same level (move to same parent as overItem)
      moveItemMutation.mutate({
        id: active.id as string,
        parentId: overItem.parentId ?? null,
        position: overIndex >= 0 ? overIndex : 0,
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDropMode('nest');
  };

  const activeItem = activeId ? allItemsData?.data?.find((item: Item) => item.id === activeId) : null;

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

  // Parent sort mode state (persisted in localStorage)
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

  // Build parent options for the creation form (with tree or alpha sort)
  const parentOptions = useMemo(() => {
    const allItems = allItemsData?.data || [];

    if (parentSortMode === 'alpha') {
      // Alphabetical sort
      const sorted = [...allItems].sort((a: Item, b: Item) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      );
      return [
        { value: '', label: 'Aucun parent (racine)' },
        ...sorted.map((item: Item) => ({
          value: item.id,
          label: item.title,
        })),
      ];
    } else {
      // Tree sort with indentation
      const buildTree = (parentId: string | null, depth: number): { value: string; label: string }[] => {
        const children = allItems
          .filter((item: Item) => (item.parentId || null) === parentId)
          .sort((a: Item, b: Item) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));

        const result: { value: string; label: string }[] = [];
        for (const child of children) {
          const indent = depth > 0 ? '—'.repeat(depth) + ' ' : '';
          result.push({
            value: child.id,
            label: `${indent}${child.title}`,
          });
          result.push(...buildTree(child.id, depth + 1));
        }
        return result;
      };

      return [
        { value: '', label: 'Aucun parent (racine)' },
        ...buildTree(null, 0),
      ];
    }
  }, [allItemsData?.data, parentSortMode]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddChild = (parentId: string) => {
    setNewItemParentId(parentId);
    handleItemTypeChange('NOTE');
    setShowNewItem(true);
    // Auto-expand the parent to show the new child after creation
    setExpandedItems((prev) => new Set([...prev, parentId]));
  };

  // Expand all items that have children (at any level)
  const expandAll = () => {
    const allItems = allItemsData?.data || [];
    // Find all items that are parents (have at least one child)
    const parentIds = new Set<string>();
    allItems.forEach((item: Item) => {
      if (item.parentId) {
        parentIds.add(item.parentId);
      }
    });
    // Also add items with childCount > 0 (from the API response)
    allItems.forEach((item: Item & { childCount?: number }) => {
      if ((item.childCount || 0) > 0) {
        parentIds.add(item.id);
      }
    });
    setExpandedItems(parentIds);
  };

  // Collapse all items
  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  // Check if any item is expanded
  const hasExpandedItems = expandedItems.size > 0;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{space?.name}</h1>
            <p className="text-muted-foreground mt-1">
              {space?.community && (
                <span className="text-sm font-medium text-primary/70 mr-2">{space.community.name} ·</span>
              )}
              {space?.itemCount || 0} élément{(space?.itemCount || 0) > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/spaces/${spaceId}/history`}>
              <Button variant="outline" title="Historique des modifications">
                <History className="w-4 h-4" />
              </Button>
            </Link>
            {(space?.role === 'OWNER' || space?.role === 'ADMIN') && (
              <Link to={`/spaces/${spaceId}/settings`}>
                <Button variant="outline" title="Paramètres de l'espace">
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Button
              variant={isSelectionMode ? 'default' : 'outline'}
              onClick={() => setSelectionMode(!isSelectionMode)}
              title={isSelectionMode ? 'Quitter le mode sélection' : 'Mode sélection'}
            >
              <ListChecks className="w-4 h-4 mr-2" />
              {isSelectionMode ? 'Annuler' : 'Sélectionner'}
            </Button>
            <Button onClick={() => {
              handleItemTypeChange(filter === 'ALL' ? 'NOTE' : filter);
              setShowNewItem(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap items-center">
          {(['ALL', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE'] as const).map((type) => (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type)}
            >
              {type === 'ALL' ? 'Tous' : TYPE_LABELS[type]}
            </Button>
          ))}

          {/* Mode indicator */}
          {filter !== 'ALL' && (
            viewMode === 'sequence' || viewMode === 'planning' || viewMode === 'timeline' || viewMode === 'mindmap' ? (
              <span className="text-xs ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 border border-yellow-300">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Mise en lumière
              </span>
            ) : (
              <span className="text-xs ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Filtre actif
              </span>
            )
          )}

          <div className="h-6 w-px bg-border mx-2" />

          <Button
            variant="outline"
            size="sm"
            onClick={hasExpandedItems ? collapseAll : expandAll}
            title={hasExpandedItems ? 'Tout réduire' : 'Tout étendre'}
          >
            {hasExpandedItems ? (
              <>
                <ChevronsDownUp className="w-4 h-4 mr-1" />
                Réduire
              </>
            ) : (
              <>
                <ChevronsUpDown className="w-4 h-4 mr-1" />
                Étendre
              </>
            )}
          </Button>
        </div>

        {/* New item form */}
        {showNewItem && (
          <div className="bg-card border rounded-lg p-4 mb-6">
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE'] as const).map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant={newItemType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleItemTypeChange(type)}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {TYPE_LABELS[type]}
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
                    <Input
                      type="datetime-local"
                      value={newItemStartDate}
                      onChange={(e) => setNewItemStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de fin</label>
                    <Input
                      type="datetime-local"
                      value={newItemEndDate}
                      onChange={(e) => setNewItemEndDate(e.target.value)}
                    />
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
                      <>
                        <GitBranch className="w-3 h-3" />
                        <span>Arborescence</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownAZ className="w-3 h-3" />
                        <span>A-Z</span>
                      </>
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
                <Button type="submit" disabled={createItemMutation.isPending}>
                  Créer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewItem(false);
                    setNewItemTitle('');
                    setNewItemUrl('');
                    setNewItemParentId('');
                    setNewItemDueDate('');
                    setNewItemStartDate('');
                    setNewItemEndDate('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Items list */}
        <div className="bg-card border rounded-lg flex-1 min-h-0">
          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : viewMode === 'list' ? (
            <ListView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
            />
          ) : viewMode === 'sequence' ? (
            <SequenceView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
              highlightType={filter !== 'ALL' ? filter : undefined}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
            />
          ) : viewMode === 'types' ? (
            <TypesView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateType={(id, type) => updateItemMutation.mutate({ id, data: { type } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
            />
          ) : viewMode === 'planning' ? (
            <PlanningView
              items={allItemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
              highlightType={filter !== 'ALL' ? filter : undefined}
            />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              items={allItemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onUpdateDates={(id, startDate, endDate) => updateItemMutation.mutate({ id, data: { startDate, endDate } })}
              onAddChild={handleAddChild}
              referentiels={referentiels}
              highlightType={filter !== 'ALL' ? filter : undefined}
            />
          ) : viewMode === 'mindmap' ? (
            <MindMapView
              items={allItemsData?.data || []}
              spaceName={space?.name || 'Espace'}
              spaceId={spaceId}
              communitySpaces={communitySpaces || []}
              highlightType={filter !== 'ALL' ? filter : undefined}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
              onAddChild={handleAddChild}
              onMove={(id, parentId, position) => moveItemMutation.mutate({ id, parentId, position })}
              onCreateRelation={(fromItemId, toItemId, type) => createRelationMutation.mutate({ fromItemId, toItemId, type })}
              onDeleteRelation={(itemId, relationId) => deleteRelationMutation.mutate({ itemId, relationId })}
              referentiels={referentiels}
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
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={itemsData?.data.map((item: Item) => item.id) || []}
                strategy={verticalListSortingStrategy}
              >
                <div className="py-2">
                  {itemsData?.data.map((item: Item & { childCount?: number }, index: number) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      depth={0}
                      orderNumber={`${index + 1}`}
                      isExpanded={expandedItems.has(item.id)}
                      onToggleExpand={toggleExpanded}
                      onEdit={setEditingItemId}
                      onDelete={(id) => deleteItemMutation.mutate(id)}
                      onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
                      onAddChild={handleAddChild}
                      spaceId={spaceId!}
                      isOver={overId === item.id}
                      dropMode={overId === item.id ? dropMode : undefined}
                      onMove={(id, parentId, position) => moveItemMutation.mutate({ id, parentId, position })}
                      globalOverId={overId}
                      globalDropMode={dropMode}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelection={toggleSelection}
                      expandedItems={expandedItems}
                    />
                  ))}
                  {/* Root drop zone - at the bottom to avoid interfering with first item */}
                  {activeId && (
                    <RootDropZone isOver={overId === 'root'} />
                  )}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-card border-2 border-primary rounded-md shadow-xl">
                      {TYPE_ICONS[activeItem.type] && (
                        <span className="w-4 h-4 text-muted-foreground">
                          {(() => { const Icon = TYPE_ICONS[activeItem.type]; return <Icon className="w-4 h-4" />; })()}
                        </span>
                      )}
                      <span className="truncate font-medium">{activeItem.title}</span>
                    </div>
                    <div className={`text-xs px-3 py-2 rounded-md shadow-lg ${
                      dropMode === 'nest'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {dropMode === 'nest' ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold">
                            <span>↳</span>
                            <span>Mode: Imbriquer comme enfant</span>
                          </div>
                          <div className="opacity-75 text-[10px]">Maintenez Shift pour réordonner</div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold">
                            <span>↕</span>
                            <span>Mode: Réordonner</span>
                          </div>
                          <div className="opacity-75 text-[10px]">Relâchez Shift pour imbriquer</div>
                        </div>
                      )}
                    </div>
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
        spaceId={spaceId!}
        itemId={editingItemId}
        allItems={allItemsData?.data || []}
        referentiels={referentiels}
      />

      {/* Selection action bar */}
      {isSelectionMode && (
        <SelectionActionBar
          onMoveToSpace={() => setShowMoveModal(true)}
          onDuplicateToSpace={() => setShowDuplicateModal(true)}
        />
      )}

      {/* Move to space modal */}
      <MoveToSpaceModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        currentSpaceId={spaceId!}
      />

      {/* Duplicate to space modal */}
      <DuplicateToSpaceModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        currentSpaceId={spaceId!}
      />
    </div>
  );
}

// Root drop zone to move items to root level
function RootDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'root' });

  return (
    <div
      ref={setNodeRef}
      className={`mx-3 mt-2 py-2 px-3 rounded-md border-2 border-dashed transition-colors ${
        isOver
          ? 'border-green-500 bg-green-50 text-green-700'
          : 'border-gray-300 text-gray-400'
      }`}
    >
      <span className="text-sm">↓ Déposer ici pour mettre à la racine</span>
    </div>
  );
}

// Sortable item component
function SortableItem({
  item,
  depth,
  orderNumber,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  spaceId,
  isOver,
  dropMode,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  expandedItems,
}: {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  orderNumber: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  spaceId: string;
  isOver: boolean;
  dropMode?: 'reorder' | 'nest';
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  expandedItems: Set<string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = TYPE_ICONS[item.type];
  const hasChildren = (item.childCount || 0) > 0;

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(item.id);
    } else {
      onEdit(item.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drop indicator for reorder mode - place above this item */}
      {isOver && dropMode === 'reorder' && (
        <div className="relative mx-3 my-1">
          <div className="h-1 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded whitespace-nowrap">
            Placer ici
          </span>
        </div>
      )}
      {/* Nest indicator - becomes child of this item */}
      {isOver && dropMode === 'nest' && (
        <div className="mx-3 mb-1 px-3 py-1 bg-blue-100 border-2 border-dashed border-blue-500 rounded-md text-xs text-blue-700 flex items-center gap-1">
          <span>↳</span>
          <span>Imbriquer comme enfant de "{item.title}"</span>
        </div>
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer transition-all duration-150 ${
          isOver && dropMode === 'nest' ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50 shadow-md' : ''
        } ${isOver && dropMode === 'reorder' ? 'border-t-2 border-primary bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 border border-primary' : ''}`}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
        onClick={handleClick}
      >
        {isSelectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded"
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className="text-xs text-muted-foreground font-mono min-w-[1.5rem]">{orderNumber}</span>

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate">{item.title}</span>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Ouvrir le lien"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {item.status && item.status !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(item.id, 'done');
            }}
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        )}

        <Badge
          className={`text-xs ${STATUS_COLORS[item.status || 'none']}`}
          variant="secondary"
        >
          {STATUS_LABELS[item.status || ''] || 'Non défini'}
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(item.id);
          }}
          title="Ajouter un enfant"
        >
          <Plus className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {isExpanded && hasChildren && (
        <ItemChildren
          spaceId={spaceId}
          parentId={item.id}
          depth={depth + 1}
          parentOrderNumber={orderNumber}
          onEditItem={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          onToggleSelection={onToggleSelection}
          expandedItems={expandedItems}
          onToggleExpand={onToggleExpand}
        />
      )}
    </div>
  );
}

// Sub-component to load children lazily
function ItemChildren({
  spaceId,
  parentId,
  depth,
  parentOrderNumber,
  onEditItem,
  onDelete,
  onUpdateStatus,
  onAddChild,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  onToggleSelection,
  expandedItems,
  onToggleExpand,
}: {
  spaceId: string;
  parentId: string;
  depth: number;
  parentOrderNumber: string;
  onEditItem: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  onToggleSelection?: (id: string) => void;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ['items', spaceId, 'children', parentId],
    queryFn: () => itemsApi.list(spaceId, { parentId, pageSize: 5000 }),
  });

  // Get selection store for checking selection state (must be before any early return)
  const { selectedIds: globalSelectedIds } = useSelectionStore();

  if (!data?.data.length) return null;

  return (
    <>
      {data.data.map((item: Item & { childCount?: number }, index: number) => (
        <DraggableChildItem
          key={item.id}
          item={item}
          depth={depth}
          orderNumber={`${parentOrderNumber}.${index + 1}`}
          isExpanded={expandedItems.has(item.id)}
          onToggleExpand={onToggleExpand}
          onEdit={onEditItem}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          spaceId={spaceId}
          isOver={globalOverId === item.id}
          dropMode={globalOverId === item.id ? globalDropMode : undefined}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          isSelected={globalSelectedIds.has(item.id)}
          onToggleSelection={onToggleSelection}
          expandedItems={expandedItems}
        />
      ))}
    </>
  );
}

// Draggable child item component (uses useDraggable instead of useSortable)
function DraggableChildItem({
  item,
  depth,
  orderNumber,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  spaceId,
  isOver,
  dropMode,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  expandedItems,
}: {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  orderNumber: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  spaceId: string;
  isOver: boolean;
  dropMode?: 'reorder' | 'nest';
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  expandedItems: Set<string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = TYPE_ICONS[item.type];
  const hasChildren = (item.childCount || 0) > 0;

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(item.id);
    } else {
      onEdit(item.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drop indicator for reorder mode - place above this item */}
      {isOver && dropMode === 'reorder' && (
        <div className="relative mx-3 my-1" style={{ marginLeft: `${12 + depth * 24}px` }}>
          <div className="h-1 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded whitespace-nowrap">
            Placer ici
          </span>
        </div>
      )}
      {/* Nest indicator - becomes child of this item */}
      {isOver && dropMode === 'nest' && (
        <div className="mx-3 mb-1 px-3 py-1 bg-blue-100 border-2 border-dashed border-blue-500 rounded-md text-xs text-blue-700 flex items-center gap-1" style={{ marginLeft: `${12 + depth * 24}px` }}>
          <span>↳</span>
          <span>Imbriquer comme enfant de "{item.title}"</span>
        </div>
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer transition-all duration-150 ${
          isOver && dropMode === 'nest' ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50 shadow-md' : ''
        } ${isOver && dropMode === 'reorder' ? 'border-t-2 border-primary bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 border border-primary' : ''}`}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
        onClick={handleClick}
      >
        {isSelectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded"
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className="text-xs text-muted-foreground font-mono min-w-[1.5rem]">{orderNumber}</span>

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate">{item.title}</span>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Ouvrir le lien"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {item.status && item.status !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(item.id, 'done');
            }}
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        )}

        <Badge
          className={`text-xs ${STATUS_COLORS[item.status || 'none']}`}
          variant="secondary"
        >
          {STATUS_LABELS[item.status || ''] || 'Non défini'}
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(item.id);
          }}
          title="Ajouter un enfant"
        >
          <Plus className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {isExpanded && hasChildren && (
        <ItemChildren
          spaceId={spaceId}
          parentId={item.id}
          depth={depth + 1}
          parentOrderNumber={orderNumber}
          onEditItem={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          onToggleSelection={onToggleSelection}
          expandedItems={expandedItems}
          onToggleExpand={onToggleExpand}
        />
      )}
    </div>
  );
}
