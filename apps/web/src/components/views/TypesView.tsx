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
import { Trash2, ExternalLink, GripVertical, Plus, FolderInput, Copy, FolderPlus, FolderKanban } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS, ITEM_TYPES } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
}

interface TypesViewProps {
  items: Item[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateType: (id: string, type: ItemType) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

interface TypeColumnConfig {
  id: ItemType;
  label: string;
  color: string;
  bgHover: string;
}

interface TypeColumnProps {
  column: TypeColumnConfig;
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isOver: boolean;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  canEdit?: boolean;
}

interface TypeCardProps {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isDragging?: boolean;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  canEdit?: boolean;
}

function TypeCard({ item, onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, isDragging, statusLabels, statusColors, canEdit = true, portalSpaceName }: TypeCardProps & { portalSpaceName?: string }) {
  const Icon = TYPE_ICONS[item.type];
  const isPortal = !!portalSpaceName;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
    disabled: isPortal,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const statusLabel = item.status ? (statusLabels[item.status] || item.status) : null;
  const statusColor = item.status ? (statusColors[item.status] || '') : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
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
            title="Glisser pour changer de type"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
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
          {statusLabel && (
            <Badge
              className={`text-xs mt-2 ${statusColor}`}
              variant="secondary"
            >
              {statusLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Action menu */}
      {canEdit && !isPortal && (
        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

interface TypeColumnProps2 extends TypeColumnProps {
  portalItems?: (Item & { _spaceName: string })[];
}

function TypeColumn({ column, items, portalItems, onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, isOver, statusLabels, statusColors, canEdit }: TypeColumnProps2) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const Icon = TYPE_ICONS[column.id];

  return (
    <div
      className={`flex-1 min-w-[180px] bg-muted/50 rounded-lg border-t-4 flex flex-col ${column.color} transition-colors ${
        isOver ? column.bgHover : ''
      }`}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <h3 className="font-medium">{column.label}</h3>
          </div>
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
          <TypeCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onMoveToSpace={onMoveToSpace}
            onDuplicateToSpace={onDuplicateToSpace}
            onConvertToSpace={onConvertToSpace}
            statusLabels={statusLabels}
            statusColors={statusColors}
            canEdit={canEdit}
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
              <TypeCard
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                statusLabels={statusLabels}
                statusColors={statusColors}
                canEdit={false}
                portalSpaceName={item._spaceName}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function TypesView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateType, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, referentiels, canEdit = true }: TypesViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Use referentiels or defaults
  const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;

  // Build type columns from referentiels
  const typeColumns = useMemo(() => {
    return ITEM_TYPES
      .filter((type) => typeLabels[type]?.visible !== false)
      .map((type) => {
        const config = typeLabels[type] || DEFAULT_REFERENTIELS.typeLabels[type];
        return {
          id: type as ItemType,
          label: config?.label || type,
          color: config?.color || 'border-gray-400',
          bgHover: config?.bgHover || 'bg-gray-50',
          order: config?.order ?? 999,
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [typeLabels]);

  // Build status maps from referentiels
  const { statusLabels, statusColors } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};
    statuses.forEach((s) => {
      labels[s.id] = s.label;
      colors[s.id] = s.color;
    });
    return { statusLabels: labels, statusColors: colors };
  }, [referentiels]);

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

  // Group main items by type
  const groupedItems = useMemo(() => {
    return typeColumns.reduce(
      (acc, column) => {
        acc[column.id] = mainItems.filter((item) => item.type === column.id);
        return acc;
      },
      {} as Record<string, Item[]>
    );
  }, [typeColumns, mainItems]);

  // Group portal items by type
  const portalGroupedItems = useMemo(() => {
    if (portalItemsWithSpace.length === 0) return {} as Record<string, (Item & { _spaceName: string })[]>;
    return typeColumns.reduce(
      (acc, column) => {
        acc[column.id] = portalItemsWithSpace.filter((item) => item.type === column.id);
        return acc;
      },
      {} as Record<string, (Item & { _spaceName: string })[]>
    );
  }, [typeColumns, portalItemsWithSpace]);

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
    const newType = over.id as ItemType;
    const item = mainItems.find((i) => i.id === itemId);

    if (!item) return;

    // Only update if type changed
    if (item.type !== newType) {
      onUpdateType(itemId, newType);
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
          {typeColumns.map((column) => (
            <TypeColumn
              key={column.id}
              column={column}
              items={groupedItems[column.id] || []}
              portalItems={portalGroupedItems[column.id]}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveToSpace={onMoveToSpace}
              onDuplicateToSpace={onDuplicateToSpace}
              onConvertToSpace={onConvertToSpace}
              isOver={overId === column.id}
              statusLabels={statusLabels}
              statusColors={statusColors}
              canEdit={canEdit}
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
                return <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />;
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
