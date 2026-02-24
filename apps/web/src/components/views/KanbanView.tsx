import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
} from '@dnd-kit/core';
import { Trash2, ExternalLink, GripVertical, CheckSquare, Plus, Calendar, FolderInput, Copy, FolderPlus, FolderKanban } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS, getTypeTextColor } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';
import { TagBadge } from '../ui/TagBadge';

// Format date for display
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
}

interface KanbanViewProps {
  items: Item[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

interface KanbanColumnProps {
  column: StatusConfig;
  items: Item[];
  portalItems?: (Item & { _spaceName: string })[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isOver: boolean;
  nextStatus?: string;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
}

interface KanbanCardProps {
  item: Item;
  columnId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isDragging?: boolean;
  nextStatus?: string;
  nextStatusLabel?: string;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
}

function KanbanCard({ item, columnId, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, isDragging, nextStatus, nextStatusLabel, canEdit = true, referentiels, portalSpaceName }: KanbanCardProps & { portalSpaceName?: string }) {
  const Icon = TYPE_ICONS[item.type];
  const isPortal = !!portalSpaceName;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item, columnId },
    disabled: isPortal,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-50' : ''
      } ${isPortal ? 'border-dashed border-primary/30' : ''}`}
      onClick={() => onEdit(item.id)}
    >
      {portalSpaceName && (
        <Link
          to={`/spaces/${item.spaceId}`}
          className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary mb-1.5 -mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderKanban className="w-3 h-3" />
          <span>{portalSpaceName}</span>
        </Link>
      )}
      <div className="flex items-start gap-2">
        {canEdit && !isPortal && (
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium truncate" title={item.title}>{item.title}</h4>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {stripMarkup(item.description)}
            </p>
          )}
          {item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url) && (
            <img src={item.url} alt="" className="w-full max-h-32 object-cover rounded border border-border mt-1.5" />
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
          {item.type === 'MEETING' && item.startDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3" />
              {formatDate(item.startDate)}
            </div>
          )}
        </div>
      </div>

      {/* Action menu */}
      {canEdit && !isPortal && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemActionMenu
            groups={[
              {
                actions: [
                  ...(nextStatus ? [{ id: 'next-status', label: nextStatusLabel || 'Suivant', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, nextStatus) }] : []),
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

function KanbanColumn({ column, items, portalItems, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, isOver, nextStatus, canEdit, referentiels }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  // Extract border color from borderColor (e.g., "border-gray-300 bg-gray-50" -> "border-gray-300")
  const borderColorClass = column.borderColor.split(' ')[0] || 'border-gray-300';
  // Extract bg color for hover (e.g., "border-gray-300 bg-gray-50" -> "bg-gray-50")
  const bgHoverClass = column.borderColor.split(' ')[1] || 'bg-gray-50';

  return (
    <div
      className={`flex-1 min-w-[180px] bg-muted/50 rounded-lg border-t-4 flex flex-col ${borderColorClass} transition-colors ${
        isOver ? bgHoverClass : ''
      }`}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-muted/95 backdrop-blur-sm rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{column.label}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {items.length + (portalItems?.length || 0)}
          </span>
        </div>
      </div>

      {/* Column items - droppable area */}
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 flex-1 overflow-y-auto min-h-[100px] ${
          isOver ? 'ring-2 ring-primary ring-inset' : ''
        }`}
      >
        {items.map((item) => (
          <KanbanCard
            key={item.id}
            item={item}
            columnId={column.id}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateStatus={onUpdateStatus}
            onAddChild={onAddChild}
            onMoveToSpace={onMoveToSpace}
            onDuplicateToSpace={onDuplicateToSpace}
            onConvertToSpace={onConvertToSpace}
            nextStatus={nextStatus}
            canEdit={canEdit}
            referentiels={referentiels}
          />
        ))}

        {items.length === 0 && (!portalItems || portalItems.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun element
          </div>
        )}

        {/* Portal items (read-only, from child spaces) */}
        {portalItems && portalItems.length > 0 && (
          <>
            {items.length > 0 && <div className="border-t border-dashed border-primary/20 my-2" />}
            {portalItems.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                columnId={column.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateStatus={onUpdateStatus}
                onAddChild={onAddChild}
                canEdit={false}
                referentiels={referentiels}
                portalSpaceName={item._spaceName}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, referentiels, canEdit = true }: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Separate main items from portal items
  const { mainItems, portalItemsWithSpace } = useMemo(() => {
    if (!currentSpaceId || !portalGroups?.length) {
      return { mainItems: items, portalItemsWithSpace: [] as (Item & { _spaceName: string })[] };
    }
    const main = items.filter(i => i.spaceId === currentSpaceId);
    const spaceNames = new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
    const portal = items
      .filter(i => i.spaceId !== currentSpaceId)
      .map(i => ({ ...i, _spaceName: spaceNames.get(i.spaceId) || 'Espace' }));
    return { mainItems: main, portalItemsWithSpace: portal };
  }, [items, currentSpaceId, portalGroups]);

  // Use referentiels or defaults
  const statuses = useMemo(() => {
    const statusList = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return statusList.filter((s) => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

  // Build next status map for quick actions
  const nextStatusMap = useMemo(() => {
    const map: Record<string, { id: string; label: string } | undefined> = {};
    statuses.forEach((status, index) => {
      if (index < statuses.length - 1) {
        const next = statuses[index + 1];
        map[status.id] = { id: next.id === 'undefined' ? '' : next.id, label: next.label };
      }
    });
    return map;
  }, [statuses]);

  // Group main items by status
  const groupedItems = useMemo(() => {
    return statuses.reduce(
      (acc, status) => {
        if (status.id === 'undefined') {
          acc[status.id] = mainItems.filter((item) => !item.status);
        } else {
          acc[status.id] = mainItems.filter((item) => item.status === status.id);
        }
        return acc;
      },
      {} as Record<string, Item[]>
    );
  }, [statuses, mainItems]);

  // Group portal items by status
  const portalGroupedItems = useMemo(() => {
    if (portalItemsWithSpace.length === 0) return {} as Record<string, (Item & { _spaceName: string })[]>;
    return statuses.reduce(
      (acc, status) => {
        if (status.id === 'undefined') {
          acc[status.id] = portalItemsWithSpace.filter((item) => !item.status);
        } else {
          acc[status.id] = portalItemsWithSpace.filter((item) => item.status === status.id);
        }
        return acc;
      },
      {} as Record<string, (Item & { _spaceName: string })[]>
    );
  }, [statuses, portalItemsWithSpace]);

  const activeItem = activeId ? mainItems.find((item) => item.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;
    const item = items.find((i) => i.id === itemId);

    if (!item) return;

    // Get current status
    const currentStatus = item.status || 'undefined';

    // Only update if status changed
    if (currentStatus !== newStatus) {
      // Convert 'undefined' column to empty status
      const statusToSet = newStatus === 'undefined' ? '' : newStatus;
      onUpdateStatus(itemId, statusToSet);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="p-4 overflow-x-auto h-full">
        <div className="flex gap-3 h-full min-h-0">
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              column={status}
              items={groupedItems[status.id] || []}
              portalItems={portalGroupedItems[status.id]}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
              onAddChild={onAddChild}
              onMoveToSpace={onMoveToSpace}
              onDuplicateToSpace={onDuplicateToSpace}
              onConvertToSpace={onConvertToSpace}
              isOver={overId === status.id}
              nextStatus={nextStatusMap[status.id]?.id}
              canEdit={canEdit}
              referentiels={referentiels}
            />
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem ? (
          <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 w-[200px]">
            <div className="flex items-start gap-2">
              {(() => {
                const Icon = TYPE_ICONS[activeItem.type];
                return <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(activeItem.type, referentiels?.typeLabels)}`} />;
              })()}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{activeItem.title}</h4>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
