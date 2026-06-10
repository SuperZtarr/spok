import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import { getTypeIcon } from '../../constants/ui';
import type { TreeItem } from './timeline-tree';

export interface TreeItemRowProps {
  item: TreeItem;
  hasChildren: boolean;
  isCollapsed: boolean;
  isPortal: boolean;
  isOver: boolean;
  dropPosition: 'before' | 'after' | 'nest';
  canEdit?: boolean;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (id: string, spaceId?: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  toggleCollapse: (id: string) => void;
  statusOptions: { id: string; label: string; visible: boolean; order: number }[];
  canEditItem?: (item: { createdById?: string }) => boolean;
}

export function TreeItemRow({
  item,
  hasChildren,
  isCollapsed,
  isPortal,
  isOver,
  dropPosition,
  canEdit,
  onMove,
  onEdit,
  onDelete,
  onUpdateStatus,
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
  toggleCollapse,
  statusOptions,
  canEditItem,
}: TreeItemRowProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: item.id, disabled: !canEdit || !onMove });
  const { setNodeRef: setDropRef } = useDroppable({ id: item.id, disabled: !onMove });
  const Icon = getTypeIcon(item.type, item.url);

  const nestHighlight = isOver && dropPosition === 'nest';

  return (
    <div ref={setDropRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {isOver && dropPosition === 'before' && (
        <div className="relative h-0.5 mx-2" style={{ marginLeft: `${8 + item.depth * 20}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}
      <div
        className={`w-72 flex-shrink-0 px-2 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-muted/50 sticky left-0 z-10 bg-background ${nestHighlight ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-400' : ''}`}
        style={{ paddingLeft: `${8 + item.depth * 20}px` }}
      >
        {canEdit && onMove && (
          <button
            ref={setDragRef}
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-muted rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span
          className="truncate text-sm flex-1"
          onClick={() => onEdit(item.id)}
          title={item.title}
        >
          {item.title}
        </span>
        {!isPortal && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <ItemActionMenu
              groups={buildItemMenuGroups(item.id, {
                onEdit, onDelete, onUpdateStatus, onAddChild,
                onMoveToSpace, onDuplicateToSpace, onConvertToSpace,
                onSelfAssign, onMerge, onAbsorbChildren,
                onSplitDescription: onSplitDescription && hasHeadings(item.description) ? onSplitDescription : undefined,
                onOpen, onOpenInNewTab,
              }, {
                canEdit: canEditItem ? canEditItem(item) : canEdit ?? true,
                statusOptions,
                currentStatusId: item.status || undefined,
                itemSpaceId: item.spaceId,
              })}
            />
          </div>
        )}
      </div>
      {isOver && dropPosition === 'after' && (
        <div className="relative h-0.5 mx-2" style={{ marginLeft: `${8 + item.depth * 20}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}
    </div>
  );
}
