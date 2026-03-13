import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { PRIORITIES, getPriorityConfig, getTypeIcon, getTypeTextColor } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';
import { TagBadge } from '../ui/TagBadge';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { Trash2, Plus, Copy, FolderInput, FolderPlus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const PRIORITY_COLUMNS = [
  ...PRIORITIES.map(p => ({
    id: `priority-${p.value}`,
    value: p.value as number | null,
    label: p.label,
    shortLabel: p.shortLabel,
    borderColor: p.color,
    bgColor: p.bgColor,
    textColor: p.textColor,
  })),
  {
    id: 'priority-null',
    value: null as number | null,
    label: 'Sans priorité',
    shortLabel: 'P—',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50/50',
    textColor: 'text-gray-400',
  },
];

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function PriorityCard({
  item,
  onEdit,
  onDelete,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  isDragging,
  canEdit = true,
  referentiels,
}: {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isDragging?: boolean;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
}) {
  const Icon = getTypeIcon(item.type);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(item.id)}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour changer la priorité"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate" title={item.title}>{item.title}</h4>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {stripMarkup(item.description)}
            </p>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemActionMenu
            groups={[
              {
                actions: [
                  { id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) },
                  ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => onDuplicateToSpace(item.id) }] : []),
                ],
              },
              {
                actions: [
                  ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(item.id) }] : []),
                  ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) }] : []),
                ],
              },
              {
                actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }],
              },
            ].filter(g => g.actions.length > 0)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function PriorityColumn({
  column,
  items,
  isOver,
  onEdit,
  onDelete,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  canEdit,
  referentiels,
  draggedItemId,
}: {
  column: typeof PRIORITY_COLUMNS[number];
  items: Item[];
  isOver: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
  draggedItemId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div
      className={`flex-1 min-w-[200px] bg-muted/50 rounded-lg border-t-4 flex flex-col transition-colors ${column.borderColor} ${
        isOver ? 'bg-primary/5' : ''
      }`}
    >
      <div className={`p-3 border-b border-border sticky top-0 z-10 rounded-t-lg ${column.bgColor}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${column.textColor}`}>{column.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full bg-background ${column.textColor}`}>{items.length}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 flex-1 overflow-y-auto min-h-[60px] ${
          isOver ? 'ring-2 ring-primary ring-inset' : ''
        }`}
      >
        {items.map((item) => (
          <PriorityCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onMoveToSpace={onMoveToSpace}
            onDuplicateToSpace={onDuplicateToSpace}
            onConvertToSpace={onConvertToSpace}
            isDragging={item.id === draggedItemId}
            canEdit={canEdit}
            referentiels={referentiels}
          />
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Aucun item</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

interface PriorityViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePriority: (id: string, priority: number | null) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

export function PriorityView({
  items,
  onEdit,
  onDelete,
  onUpdatePriority,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  referentiels,
  canEdit = true,
}: PriorityViewProps) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group items by priority
  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const col of PRIORITY_COLUMNS) {
      map.set(col.id, []);
    }
    for (const item of items) {
      const colId = item.priority ? `priority-${item.priority}` : 'priority-null';
      const arr = map.get(colId);
      if (arr) {
        arr.push(item);
      } else {
        map.get('priority-null')!.push(item);
      }
    }
    return map;
  }, [items]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedItemId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItemId(null);
    setOverId(null);

    if (!over) return;

    const targetColId = over.id as string;
    const targetCol = PRIORITY_COLUMNS.find(c => c.id === targetColId);
    if (!targetCol) return;

    const item = items.find(i => i.id === active.id);
    if (!item) return;

    const currentPriority = item.priority ?? null;
    if (currentPriority === targetCol.value) return;

    onUpdatePriority(item.id, targetCol.value);
  }, [items, onUpdatePriority]);

  const handleDragCancel = useCallback(() => {
    setDraggedItemId(null);
    setOverId(null);
  }, []);

  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="p-4 overflow-x-auto overflow-y-hidden h-full">
        <div className="flex gap-3 h-full min-w-min">
          {PRIORITY_COLUMNS.map(col => (
            <PriorityColumn
              key={col.id}
              column={col}
              items={itemsByColumn.get(col.id) || []}
              isOver={overId === col.id}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveToSpace={onMoveToSpace}
              onDuplicateToSpace={onDuplicateToSpace}
              onConvertToSpace={onConvertToSpace}
              canEdit={canEdit}
              referentiels={referentiels}
              draggedItemId={draggedItemId}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggedItem && (
          <div className="bg-card border rounded-lg p-3 shadow-lg max-w-[250px] opacity-90">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = getTypeIcon(draggedItem.type);
                return <Icon className={`w-4 h-4 flex-shrink-0 ${getTypeTextColor(draggedItem.type, referentiels?.typeLabels)}`} />;
              })()}
              <span className="text-sm font-medium truncate">{draggedItem.title}</span>
              {(() => {
                const pConfig = getPriorityConfig(draggedItem.priority);
                return pConfig ? (
                  <span className={`text-[10px] font-bold ${pConfig.textColor}`}>{pConfig.shortLabel}</span>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
