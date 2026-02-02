import { useState } from 'react';
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
import { FileText, CheckSquare, Trash2, FolderKanban, Calendar, Link2, Settings, File, Image, ExternalLink, GripVertical } from 'lucide-react';
import type { Item, ItemType } from '@spok/shared';
import { Button } from '../ui/Button';

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

const COLUMNS = [
  { id: 'undefined', label: 'Non défini', color: 'border-slate-400', bgHover: 'bg-slate-100' },
  { id: 'todo', label: 'À faire', color: 'border-gray-300', bgHover: 'bg-gray-100' },
  { id: 'in_progress', label: 'En cours', color: 'border-blue-400', bgHover: 'bg-blue-100' },
  { id: 'done', label: 'Terminé', color: 'border-green-400', bgHover: 'bg-green-100' },
  { id: 'cancelled', label: 'Annulé', color: 'border-red-400', bgHover: 'bg-red-100' },
];

interface KanbanViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

interface KanbanColumnProps {
  column: typeof COLUMNS[0];
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  isOver: boolean;
}

interface KanbanCardProps {
  item: Item;
  columnId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  isDragging?: boolean;
}

function KanbanCard({ item, columnId, onEdit, onDelete, onUpdateStatus, isDragging }: KanbanCardProps) {
  const Icon = TYPE_ICONS[item.type];
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item, columnId },
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
      className={`bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(item.id)}
    >
      <div className="flex items-start gap-2">
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium truncate">{item.title}</h4>
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
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {columnId !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus =
                columnId === 'undefined'
                  ? 'todo'
                  : columnId === 'todo'
                    ? 'in_progress'
                    : columnId === 'in_progress'
                      ? 'done'
                      : 'done';
              onUpdateStatus(item.id, nextStatus);
            }}
          >
            <CheckSquare className="w-3 h-3 mr-1" />
            {columnId === 'undefined' ? 'Planifier' : columnId === 'todo' ? 'Démarrer' : 'Terminer'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function KanbanColumn({ column, items, onEdit, onDelete, onUpdateStatus, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      className={`flex-1 min-w-[180px] bg-muted/50 rounded-lg border-t-4 flex flex-col ${column.color} transition-colors ${
        isOver ? column.bgHover : ''
      }`}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border">
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
          />
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun élément
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ items, onEdit, onDelete, onUpdateStatus }: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group items by status
  const groupedItems = COLUMNS.reduce(
    (acc, column) => {
      if (column.id === 'undefined') {
        acc[column.id] = items.filter((item) => !item.status);
      } else {
        acc[column.id] = items.filter((item) => item.status === column.id);
      }
      return acc;
    },
    {} as Record<string, Item[]>
  );

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
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              items={groupedItems[column.id] || []}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
              isOver={overId === column.id}
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
