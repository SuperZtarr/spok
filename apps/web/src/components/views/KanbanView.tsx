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
import { Trash2, ExternalLink, GripVertical, CheckSquare, Plus, Calendar, FolderInput, Copy, FolderPlus, FolderKanban, GripHorizontal, UserPlus, Merge, ArrowDownToLine, Printer, FileDown, Pencil } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, ItemType, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon, getTypeTextColor, getPriorityConfig } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';
import { printItem, exportItemPDF } from '../../lib/itemExport';
import { TagBadge } from '../ui/TagBadge';
import { RoleGuard } from '../RoleGuard';

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
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onMoveItemToSpace?: (itemId: string, sourceSpaceId: string, targetSpaceId: string, updates?: { status?: string; type?: ItemType }) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

interface KanbanColumnProps {
  column: StatusConfig;
  items: Item[];
  droppableId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isOver: boolean;
  nextStatus?: string;
  nextStatusLabel?: string;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
  isFirstColumn?: boolean;
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
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  isDragging?: boolean;
  nextStatus?: string;
  nextStatusLabel?: string;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
  isFirstCard?: boolean;
}

const MIN_BOARD_HEIGHT = 200;
const DEFAULT_BOARD_HEIGHT = 400;

function KanbanCard({ item, columnId, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, isDragging, nextStatus, nextStatusLabel, canEdit = true, referentiels, isFirstCard }: KanbanCardProps) {
  const Icon = getTypeIcon(item.type, item.url);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item, columnId },
    disabled: !canEdit,
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
      {...(isFirstCard ? { 'data-tour': 'kanban-card' } : {})}
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(item.id)}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <RoleGuard role="MEMBER">
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          </RoleGuard>
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium truncate" title={item.title}>{item.title}</h4>
            {(() => {
              const pConfig = getPriorityConfig(item.priority);
              return pConfig ? (
                <span className={`text-[10px] font-bold ${pConfig.textColor} flex-shrink-0`} title={pConfig.label}>
                  {pConfig.shortLabel}
                </span>
              ) : null;
            })()}
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
      {canEdit && (
        <RoleGuard role="MEMBER">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemActionMenu
            groups={[
              {
                actions: [
                  { id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(item.id) },
                  ...(nextStatus !== undefined ? [{ id: 'next-status', label: nextStatusLabel || 'Suivant', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, nextStatus!) }] : []),
                  { id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) },
                  ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(item.id) }] : []),
                  ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(item.id) }] : []),
                  ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(item.id) }] : []),
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
                actions: [
                  { id: 'print', label: 'Imprimer', icon: Printer, onClick: () => { printItem({ item: item as any }); } },
                  { id: 'pdf', label: 'Export PDF', icon: FileDown, onClick: () => { exportItemPDF({ item: item as any }); } },
                ],
              },
              {
                actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }],
              },
            ].filter(g => g.actions.length > 0)}
          />
        </div>
        </RoleGuard>
      )}
    </div>
  );
}

function KanbanColumn({ column, items, droppableId, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, isOver, nextStatus, nextStatusLabel, canEdit, referentiels, isFirstColumn }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: droppableId,
  });

  // Extract border color from borderColor (e.g., "border-gray-300 bg-gray-50" -> "border-gray-300")
  const borderColorClass = column.borderColor.split(' ')[0] || 'border-gray-300';
  // Extract bg color for hover (e.g., "border-gray-300 bg-gray-50" -> "bg-gray-50")
  const bgHoverClass = column.borderColor.split(' ')[1] || 'bg-gray-50';

  return (
    <div
      {...(isFirstColumn ? { 'data-tour': 'kanban-column' } : {})}
      className={`flex-1 min-w-[180px] bg-muted/50 rounded-lg border-t-4 flex flex-col ${borderColorClass} transition-colors ${
        isOver ? bgHoverClass : ''
      }`}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-muted/95 backdrop-blur-sm rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{column.label}</h3>
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
        {items.map((item, cardIdx) => (
          <KanbanCard
            key={item.id}
            item={item}
            columnId={droppableId}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateStatus={onUpdateStatus}
            onAddChild={onAddChild}
            onMoveToSpace={onMoveToSpace}
            onDuplicateToSpace={onDuplicateToSpace}
            onConvertToSpace={onConvertToSpace}
            onSelfAssign={onSelfAssign}
            onMerge={onMerge}
            onAbsorbChildren={onAbsorbChildren}
            nextStatus={nextStatus}
            nextStatusLabel={nextStatusLabel}
            canEdit={canEdit}
            referentiels={referentiels}
            isFirstCard={isFirstColumn && cardIdx === 0}
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

export function KanbanView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onMoveItemToSpace, referentiels, canEdit = true }: KanbanViewProps) {
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

  // Build space sections: main space + portal spaces
  const spaceSections = useMemo(() => {
    if (!currentSpaceId || !portalGroups?.length) {
      return [{ spaceId: currentSpaceId || 'default', spaceName: null, isPortal: false, items }];
    }
    const mainItems = items.filter(i => i.spaceId === currentSpaceId);
    const sections = [{ spaceId: currentSpaceId, spaceName: null as string | null, isPortal: false, items: mainItems }];
    for (const pg of portalGroups) {
      const spaceItems = items.filter(i => i.spaceId === pg.spaceId);
      if (spaceItems.length > 0 || true) { // Always show portal board even if empty
        sections.push({ spaceId: pg.spaceId, spaceName: pg.spaceName, isPortal: true, items: spaceItems });
      }
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

  // Group items by status per space
  const groupedBySpace = useMemo(() => {
    const result: Record<string, Record<string, Item[]>> = {};
    for (const section of spaceSections) {
      result[section.spaceId] = statuses.reduce((acc, status) => {
        if (status.id === 'undefined') {
          acc[status.id] = section.items.filter((item) => !item.status);
        } else {
          acc[status.id] = section.items.filter((item) => item.status === status.id);
        }
        return acc;
      }, {} as Record<string, Item[]>);
    }
    return result;
  }, [spaceSections, statuses]);

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

    // Parse droppable ID: "spaceId::statusId"
    const separatorIdx = droppableId.indexOf('::');
    const targetSpaceId = separatorIdx >= 0 ? droppableId.slice(0, separatorIdx) : currentSpaceId;
    const targetStatusId = separatorIdx >= 0 ? droppableId.slice(separatorIdx + 2) : droppableId;

    const newStatus = targetStatusId === 'undefined' ? '' : targetStatusId;
    const currentStatus = item.status || '';

    // Cross-space move
    if (targetSpaceId && item.spaceId !== targetSpaceId && onMoveItemToSpace) {
      onMoveItemToSpace(itemId, item.spaceId, targetSpaceId, { status: newStatus });
      return;
    }

    // Same space: status change only
    if (currentStatus !== newStatus) {
      onUpdateStatus(itemId, newStatus);
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
                <div className="flex gap-3 h-full min-h-0">
                  {statuses.map((status, statusIdx) => {
                    const droppableId = `${section.spaceId}::${status.id}`;
                    return (
                      <KanbanColumn
                        key={droppableId}
                        column={status}
                        items={grouped[status.id] || []}
                        droppableId={droppableId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onUpdateStatus={onUpdateStatus}
                        onAddChild={onAddChild}
                        onMoveToSpace={onMoveToSpace}
                        onDuplicateToSpace={onDuplicateToSpace}
                        onConvertToSpace={onConvertToSpace}
                        onSelfAssign={onSelfAssign}
                        onMerge={onMerge}
                        onAbsorbChildren={onAbsorbChildren}
                        isOver={overId === droppableId}
                        nextStatus={nextStatusMap[status.id]?.id}
                        nextStatusLabel={nextStatusMap[status.id]?.label}
                        canEdit={canEdit}
                        referentiels={referentiels}
                        isFirstColumn={idx === 0 && statusIdx === 0}
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
