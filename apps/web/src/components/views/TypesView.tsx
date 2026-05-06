import { useState, useMemo, useCallback, useRef } from 'react';
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
  closestCenter,
} from '@dnd-kit/core';
import { ExternalLink, GripVertical, FolderKanban, GripHorizontal } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS, ITEM_TYPES } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { getTypeIcon } from '../../constants/ui';
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
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onMoveItemToSpace?: (itemId: string, sourceSpaceId: string, targetSpaceId: string, updates?: { status?: string; type?: ItemType }) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
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
  droppableId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
  isOver: boolean;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  currentSpaceId?: string;
}

interface TypeCardProps {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
  isDragging?: boolean;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  currentSpaceId?: string;
}

const MIN_BOARD_HEIGHT = 200;
const DEFAULT_BOARD_HEIGHT = 400;

function TypeCard({ item, onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, isDragging, statusLabels, statusColors, canEdit = true, canEditItem, currentSpaceId }: TypeCardProps) {
  const Icon = getTypeIcon(item.type, item.url);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
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
          {item.url && (item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url)) && (
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
      <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemActionMenu
          groups={buildItemMenuGroups(item.id, { onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined, onOpen,
            onOpenInNewTab }, { canEdit: canEditItem ? canEditItem(item) : canEdit })}
        />
      </div>
    </div>
  );
}

function TypeColumn({ column, items, droppableId, onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, isOver, statusLabels, statusColors, canEdit, canEditItem, currentSpaceId }: TypeColumnProps) {
  const { setNodeRef } = useDroppable({
    id: droppableId,
  });

  const Icon = getTypeIcon(column.id);

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
            {items.length}
          </span>
        </div>
      </div>

      {/* Column items - droppable area */}
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 flex-1 overflow-y-auto min-h-[60px] ${
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
            onSelfAssign={onSelfAssign}
            onMerge={onMerge}
            onAbsorbChildren={onAbsorbChildren}
            onSplitDescription={onSplitDescription}
            onOpen={onOpen}

            onOpenInNewTab={onOpenInNewTab}
            statusLabels={statusLabels}
            statusColors={statusColors}
            canEdit={canEdit}
            canEditItem={canEditItem}
            currentSpaceId={currentSpaceId}
          />
        ))}

        {items.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Aucun element
          </div>
        )}
      </div>
    </div>
  );
}

// Resize handle between boards
function ResizeHandle({ onResize }: { onResize: (deltaY: number) => void }) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startYRef.current = e.clientY;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = e.clientY - startYRef.current;
    startYRef.current = e.clientY;
    onResize(delta);
  }, [onResize]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={handleRef}
      className="flex items-center justify-center h-3 cursor-row-resize group hover:bg-muted/50 transition-colors -my-0.5 z-10"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <GripHorizontal className="w-5 h-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
    </div>
  );
}

export function TypesView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateType, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen,
            onOpenInNewTab, onMoveItemToSpace, referentiels, canEdit = true, canEditItem }: TypesViewProps) {
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

  // Build space sections: main space + portal spaces
  const spaceSections = useMemo(() => {
    if (!currentSpaceId || !portalGroups?.length) {
      return [{ spaceId: currentSpaceId || 'default', spaceName: null, isPortal: false, items }];
    }
    const mainItems = items.filter(i => i.spaceId === currentSpaceId);
    const sections = [{ spaceId: currentSpaceId, spaceName: null as string | null, isPortal: false, items: mainItems }];
    for (const pg of portalGroups) {
      const spaceItems = items.filter(i => i.spaceId === pg.spaceId);
      sections.push({ spaceId: pg.spaceId, spaceName: pg.spaceName, isPortal: true, items: spaceItems });
    }
    return sections;
  }, [items, currentSpaceId, portalGroups]);

  // Resizable heights per space
  const [boardHeights, setBoardHeights] = useState<Record<string, number>>({});
  const getHeight = (spaceId: string) => boardHeights[spaceId] || DEFAULT_BOARD_HEIGHT;

  const handleResize = useCallback((spaceId: string, delta: number) => {
    setBoardHeights(prev => ({
      ...prev,
      [spaceId]: Math.max(MIN_BOARD_HEIGHT, (prev[spaceId] || DEFAULT_BOARD_HEIGHT) + delta),
    }));
  }, []);

  // Group items by type per space
  const groupedBySpace = useMemo(() => {
    const result: Record<string, Record<string, Item[]>> = {};
    for (const section of spaceSections) {
      result[section.spaceId] = typeColumns.reduce((acc, column) => {
        acc[column.id] = section.items.filter((item) => item.type === column.id);
        return acc;
      }, {} as Record<string, Item[]>);
    }
    return result;
  }, [spaceSections, typeColumns]);

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

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
    const droppableId = String(over.id);
    const item = items.find((i) => i.id === itemId);

    if (!item) return;

    // Parse droppable ID: "spaceId::typeId"
    const separatorIdx = droppableId.indexOf('::');
    const targetSpaceId = separatorIdx >= 0 ? droppableId.slice(0, separatorIdx) : currentSpaceId;
    const targetTypeId = separatorIdx >= 0 ? droppableId.slice(separatorIdx + 2) : droppableId;

    const newType = targetTypeId as ItemType;

    // Cross-space move
    if (targetSpaceId && item.spaceId !== targetSpaceId && onMoveItemToSpace) {
      onMoveItemToSpace(itemId, item.spaceId, targetSpaceId, { type: newType });
      return;
    }

    // Same space: type change only
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="p-4 overflow-y-auto h-full space-y-2">
        {spaceSections.map((section, idx) => {
          const grouped = groupedBySpace[section.spaceId] || {};
          return (
            <div key={section.spaceId}>
              {/* Resize handle between boards */}
              {idx > 0 && (
                <ResizeHandle onResize={(delta) => handleResize(spaceSections[idx - 1].spaceId, delta)} />
              )}

              {/* Portal header */}
              {section.isPortal && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <FolderKanban className="w-4 h-4 text-primary/70" />
                  <Link
                    to={`/spaces/${section.spaceId}`}
                    className="text-sm font-medium text-primary/70 hover:text-primary hover:underline"
                  >
                    {section.spaceName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    ({section.items.length} item{section.items.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {/* Board */}
              <div
                className={`overflow-x-auto ${section.isPortal ? 'border border-dashed border-primary/20 rounded-lg p-2' : ''}`}
                style={{ height: spaceSections.length > 1 ? getHeight(section.spaceId) : undefined }}
              >
                <div className="flex gap-3 h-full min-h-0" {...(idx === 0 ? { 'data-tour': 'types-column' } : {})}>
                  {typeColumns.map((column) => {
                    const droppableId = `${section.spaceId}::${column.id}`;
                    return (
                      <TypeColumn
                        key={droppableId}
                        column={column}
                        items={grouped[column.id] || []}
                        droppableId={droppableId}
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
                        isOver={overId === droppableId}
                        statusLabels={statusLabels}
                        statusColors={statusColors}
                        canEdit={canEdit}
                        canEditItem={canEditItem}
                        currentSpaceId={section.spaceId}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem ? (
          <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 w-[200px]">
            <div className="flex items-start gap-2">
              {(() => {
                const Icon = getTypeIcon(activeItem.type, activeItem.url);
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
