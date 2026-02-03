import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  FolderKanban,
  CheckSquare,
  Calendar,
  ChevronRight,
  ChevronDown,
  Trash2,
  GripVertical,
  Link2,
  Settings,
  File,
  Image,
  ListChecks,
} from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import type { Item, ItemType } from '@spok/shared';
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
import { SelectionActionBar } from '../components/SelectionActionBar';
import { MoveToSpaceModal } from '../components/MoveToSpaceModal';

const TYPE_ICONS: Record<ItemType, typeof FileText> = {
  NOTE: FileText,
  PROJECT: FolderKanban,
  TASK: CheckSquare,
  APPOINTMENT: Calendar,
  LINK: Link2,
  CONFIG: Settings,
  DOCUMENT: File,
  IMAGE: Image,
};

const TYPE_LABELS: Record<ItemType, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tache',
  APPOINTMENT: 'Rendez-vous',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-500 border-dashed',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  cancelled: 'Annulé',
};

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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ItemType | 'ALL'>('ALL');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  // Clear selection when leaving the page or changing space
  useEffect(() => {
    return () => clearSelection();
  }, [spaceId, clearSelection]);

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', spaceId, filter],
    queryFn: () =>
      itemsApi.list(spaceId!, {
        type: filter === 'ALL' ? undefined : filter,
        // Only filter by parentId when showing all types (hierarchical view)
        // When filtering by type, show all items of that type regardless of hierarchy
        parentId: filter === 'ALL' ? null : undefined,
        pageSize: 100,
      }),
    enabled: !!spaceId,
  });

  // Load all items for parent selector (without filter)
  const { data: allItemsData } = useQuery({
    queryKey: ['items', spaceId, 'all'],
    queryFn: () => itemsApi.list(spaceId!, { pageSize: 100 }),
    enabled: !!spaceId,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: { type: ItemType; title: string; url?: string; parentId?: string; status?: string }) =>
      itemsApi.create(spaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      setNewItemTitle('');
      setNewItemUrl('');
      setNewItemParentId('');
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
    mutationFn: ({ id, data }: { id: string; data: { status?: string } }) =>
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

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'reorder' | 'nest'>('reorder');

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

    // Use Shift key to determine drop mode
    // Shift held = nest (make child), otherwise = reorder
    if (event.over) {
      setDropMode(shiftHeld ? 'nest' : 'reorder');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropMode = dropMode;
    setActiveId(null);
    setOverId(null);
    setDropMode('reorder');

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
    setDropMode('reorder');
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
      });
    }
  };

  // Build parent options for the creation form
  const parentOptions = [
    { value: '', label: 'Aucun parent (racine)' },
    ...(allItemsData?.data || []).map((item: Item) => ({
      value: item.id,
      label: item.title,
    })),
  ];

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

  return (
    <div className={`p-6 h-full flex flex-col ${viewMode === 'kanban' ? '' : ''}`}>
      <div className={`${viewMode === 'kanban' ? 'w-full h-full flex flex-col' : 'max-w-4xl mx-auto'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{space?.name}</h1>
            <p className="text-muted-foreground mt-1">
              {space?.itemCount || 0} élément{(space?.itemCount || 0) > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={isSelectionMode ? 'default' : 'outline'}
              onClick={() => setSelectionMode(!isSelectionMode)}
              title={isSelectionMode ? 'Quitter le mode sélection' : 'Mode sélection'}
            >
              <ListChecks className="w-4 h-4 mr-2" />
              {isSelectionMode ? 'Annuler' : 'Sélectionner'}
            </Button>
            <Button onClick={() => {
              setNewItemType(filter === 'ALL' ? 'NOTE' : filter);
              setShowNewItem(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['ALL', 'NOTE', 'PROJECT', 'TASK', 'APPOINTMENT', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE'] as const).map((type) => (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type)}
            >
              {type === 'ALL' ? 'Tous' : TYPE_LABELS[type]}
            </Button>
          ))}
        </div>

        {/* New item form */}
        {showNewItem && (
          <div className="bg-card border rounded-lg p-4 mb-6">
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE'] as const).map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant={newItemType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewItemType(type)}
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Parent (optionnel)</label>
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
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Items list */}
        <div className={`bg-card border rounded-lg ${viewMode === 'kanban' ? 'flex-1 min-h-0' : ''}`}>
          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : viewMode === 'list' ? (
            <ListView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
            />
          ) : viewMode === 'sequence' ? (
            <SequenceView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              items={itemsData?.data || []}
              onEdit={setEditingItemId}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
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
                  {/* Root drop zone - to move items to root level */}
                  {activeId && (
                    <RootDropZone isOver={overId === 'root'} />
                  )}
                  {itemsData?.data.map((item: Item & { childCount?: number }) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      depth={0}
                      isExpanded={expandedItems.has(item.id)}
                      onToggleExpand={toggleExpanded}
                      onEdit={setEditingItemId}
                      onDelete={(id) => deleteItemMutation.mutate(id)}
                      onUpdateStatus={(id, status) => updateItemMutation.mutate({ id, data: { status } })}
                      spaceId={spaceId!}
                      isOver={overId === item.id}
                      dropMode={overId === item.id ? dropMode : undefined}
                      onMove={(id, parentId, position) => moveItemMutation.mutate({ id, parentId, position })}
                      globalOverId={overId}
                      globalDropMode={dropMode}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelection={toggleSelection}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md shadow-lg">
                      {TYPE_ICONS[activeItem.type] && (
                        <span className="w-4 h-4 text-muted-foreground">
                          {(() => { const Icon = TYPE_ICONS[activeItem.type]; return <Icon className="w-4 h-4" />; })()}
                        </span>
                      )}
                      <span className="truncate">{activeItem.title}</span>
                    </div>
                    {overId && overId !== 'root' && (
                      <div className={`text-xs mt-1 px-2 py-1 rounded ${
                        dropMode === 'nest'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {dropMode === 'nest'
                          ? '↳ Imbriquer comme enfant (Shift)'
                          : '↕ Réordonner • Shift = imbriquer'}
                      </div>
                    )}
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
      />

      {/* Selection action bar */}
      {isSelectionMode && (
        <SelectionActionBar
          onMoveToSpace={() => setShowMoveModal(true)}
        />
      )}

      {/* Move to space modal */}
      <MoveToSpaceModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
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
      className={`mx-3 mb-2 py-2 px-3 rounded-md border-2 border-dashed transition-colors ${
        isOver
          ? 'border-green-500 bg-green-50 text-green-700'
          : 'border-gray-300 text-gray-400'
      }`}
    >
      <span className="text-sm">↑ Déposer ici pour mettre à la racine</span>
    </div>
  );
}

// Sortable item component
function SortableItem({
  item,
  depth,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUpdateStatus,
  spaceId,
  isOver,
  dropMode,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}: {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  spaceId: string;
  isOver: boolean;
  dropMode?: 'reorder' | 'nest';
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
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
      {/* Drop indicator for reorder mode */}
      {isOver && dropMode === 'reorder' && (
        <div className="h-0.5 bg-primary mx-3 rounded-full" />
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer ${
          isOver && dropMode === 'nest' ? 'bg-blue-100 border-2 border-dashed border-blue-500' : ''
        } ${isSelected ? 'bg-primary/10 border border-primary' : ''}`}
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

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate">{item.title}</span>

        <Badge
          className={`text-xs ${STATUS_COLORS[item.status || 'none']}`}
          variant="secondary"
        >
          {STATUS_LABELS[item.status || ''] || 'Non défini'}
        </Badge>

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
          onEditItem={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          onToggleSelection={onToggleSelection}
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
  onEditItem,
  onDelete,
  onUpdateStatus,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  onToggleSelection,
}: {
  spaceId: string;
  parentId: string;
  depth: number;
  onEditItem: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  onToggleSelection?: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ['items', spaceId, 'children', parentId],
    queryFn: () => itemsApi.list(spaceId, { parentId, pageSize: 100 }),
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Get selection store for checking selection state (must be before any early return)
  const { selectedIds: globalSelectedIds } = useSelectionStore();

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

  if (!data?.data.length) return null;

  return (
    <>
      {data.data.map((item: Item & { childCount?: number }) => (
        <DraggableChildItem
          key={item.id}
          item={item}
          depth={depth}
          isExpanded={expandedItems.has(item.id)}
          onToggleExpand={toggleExpanded}
          onEdit={onEditItem}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          spaceId={spaceId}
          isOver={globalOverId === item.id}
          dropMode={globalOverId === item.id ? globalDropMode : undefined}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          isSelected={globalSelectedIds.has(item.id)}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </>
  );
}

// Draggable child item component (uses useDraggable instead of useSortable)
function DraggableChildItem({
  item,
  depth,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUpdateStatus,
  spaceId,
  isOver,
  dropMode,
  onMove,
  globalOverId,
  globalDropMode,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}: {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  spaceId: string;
  isOver: boolean;
  dropMode?: 'reorder' | 'nest';
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
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
      {isOver && dropMode === 'reorder' && (
        <div className="h-0.5 bg-primary mx-3 rounded-full" />
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer ${
          isOver && dropMode === 'nest' ? 'bg-blue-100 border-2 border-dashed border-blue-500' : ''
        } ${isSelected ? 'bg-primary/10 border border-primary' : ''}`}
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

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate">{item.title}</span>

        <Badge
          className={`text-xs ${STATUS_COLORS[item.status || 'none']}`}
          variant="secondary"
        >
          {STATUS_LABELS[item.status || ''] || 'Non défini'}
        </Badge>

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
          onEditItem={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          isSelectionMode={isSelectionMode}
          onToggleSelection={onToggleSelection}
        />
      )}
    </div>
  );
}
