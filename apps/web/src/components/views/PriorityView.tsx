/* Vue Priorités : matrice/groupes par priorité 1-4, DnD entre groupes. */
import { useState, useMemo, useCallback } from 'react';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
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
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';

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
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen, onOpenInNewTab,
  isDragging,
  canEdit = true,
  canEditItem,
  referentiels,
  spaceName,
  currentSpaceId,
}: {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  isDragging?: boolean;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels;
  spaceName?: string;
  currentSpaceId?: string;
}) {
  const Icon = getTypeIcon(item.type, item.url);
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
      {canEdit && (
        <span
          draggable
          className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded bg-black/20 z-10"
          title="Glisser vers un espace"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-spok-item', JSON.stringify({ itemId: item.id, spaceId: item.spaceId || currentSpaceId }));
          }}
        >
          <GripVertical className="w-3 h-3 text-white" />
        </span>
      )}
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
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium truncate" title={item.title}>{item.title}</h4>
            {spaceName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate">{spaceName}</span>
            )}
          </div>
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

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemActionMenu
          groups={buildItemMenuGroups(item.id, { onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined, onOpen,
            onOpenInNewTab }, { canEdit: canEditItem ? canEditItem(item) : canEdit })}
        />
      </div>
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
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen,
            onOpenInNewTab,
  canEdit,
  canEditItem,
  referentiels,
  draggedItemId,
  portalSpaceNames,
  currentSpaceId,
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
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels;
  draggedItemId: string | null;
  portalSpaceNames?: Map<string, string>;
  currentSpaceId?: string;
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
            onSelfAssign={onSelfAssign}
            onMerge={onMerge}
            onAbsorbChildren={onAbsorbChildren}
            onSplitDescription={onSplitDescription}
            onOpen={onOpen}

            onOpenInNewTab={onOpenInNewTab}
            isDragging={item.id === draggedItemId}
            canEdit={canEdit}
            canEditItem={canEditItem}
            referentiels={referentiels}
            spaceName={portalSpaceNames && currentSpaceId && (item as any).spaceId !== currentSpaceId ? portalSpaceNames.get((item as any).spaceId) : undefined}
            currentSpaceId={currentSpaceId}
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

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface PriorityViewProps {
  items: Item[];
  portalGroups?: PortalGroup[];
  currentSpaceId?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePriority: (id: string, priority: number | null) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  onNewItem?: () => void;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function PriorityView({
  items,
  portalGroups,
  currentSpaceId,
  onEdit,
  onDelete,
  onUpdatePriority,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen,
            onOpenInNewTab,
  onConvertToSpace,
  referentiels,
  canEdit = true,
  canEditItem,
  onNewItem,
  spaceName,
  viewContainerRef,
  onStartTour,
  pulseHelp,
}: PriorityViewProps) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const hasPortals = !!(portalGroups && portalGroups.length > 0);
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Combine local items with portal items
  const allItems = useMemo(() => {
    if (!portalGroups?.length) return items;
    const portalItems = portalGroups.flatMap(g => g.items);
    return [...items, ...portalItems];
  }, [items, portalGroups]);

  // Group items by priority
  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const col of PRIORITY_COLUMNS) {
      map.set(col.id, []);
    }
    for (const item of allItems) {
      const colId = item.priority ? `priority-${item.priority}` : 'priority-null';
      const arr = map.get(colId);
      if (arr) {
        arr.push(item);
      } else {
        map.get('priority-null')!.push(item);
      }
    }
    return map;
  }, [allItems]);

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

    const item = allItems.find(i => i.id === active.id);
    if (!item) return;

    const currentPriority = item.priority ?? null;
    if (currentPriority === targetCol.value) return;

    onUpdatePriority(item.id, targetCol.value);
  }, [allItems, onUpdatePriority]);

  const handleDragCancel = useCallback(() => {
    setDraggedItemId(null);
    setOverId(null);
  }, []);

  const draggedItem = draggedItemId ? allItems.find(i => i.id === draggedItemId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        {canEdit && onNewItem && (
          <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            + Nouveau
          </button>
        )}
        <div className="flex-1" />
        <ViewHelpButton viewMode="priority" onStartTour={onStartTour} pulse={pulseHelp} />
        {spaceName && viewContainerRef && (
          <SpaceExportButton items={items} spaceName={spaceName} viewMode="priority" viewContainerRef={viewContainerRef} />
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
      <div className="p-4 overflow-x-auto overflow-y-hidden flex-1">
        <div className="flex gap-3 h-full min-w-min" data-tour="priority-column">
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
              onSelfAssign={onSelfAssign}
              onMerge={onMerge}
              onAbsorbChildren={onAbsorbChildren}
              onSplitDescription={onSplitDescription}
              onOpen={onOpen}

              onOpenInNewTab={onOpenInNewTab}
              canEdit={canEdit}
              canEditItem={canEditItem}
              referentiels={referentiels}
              draggedItemId={draggedItemId}
              portalSpaceNames={hasPortals ? portalSpaceNames : undefined}
              currentSpaceId={currentSpaceId}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggedItem && (
          <div className="bg-card border rounded-lg p-3 shadow-lg max-w-[250px] opacity-90">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = getTypeIcon(draggedItem.type, draggedItem.url);
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
    </div>
  );
}
