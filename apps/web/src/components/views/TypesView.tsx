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
import { Trash2, ExternalLink, GripVertical } from 'lucide-react';
import type { Item, ItemType } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS, TYPE_COLUMNS, STATUS_COLORS, STATUS_LABELS } from '../../constants/ui';

interface TypesViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateType: (id: string, type: ItemType) => void;
}

interface TypeColumnProps {
  column: (typeof TYPE_COLUMNS)[0];
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isOver: boolean;
}

interface TypeCardProps {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

function TypeCard({ item, onEdit, onDelete, isDragging }: TypeCardProps) {
  const Icon = TYPE_ICONS[item.type];
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
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
          {item.status && (
            <Badge
              className={`text-xs mt-2 ${STATUS_COLORS[item.status] || ''}`}
              variant="secondary"
            >
              {STATUS_LABELS[item.status] || item.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

function TypeColumn({ column, items, onEdit, onDelete, isOver }: TypeColumnProps) {
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
          <TypeCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
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

export function TypesView({ items, onEdit, onDelete, onUpdateType }: TypesViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group items by type
  const groupedItems = TYPE_COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = items.filter((item) => item.type === column.id);
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
    const newType = over.id as ItemType;
    const item = items.find((i) => i.id === itemId);

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
          {TYPE_COLUMNS.map((column) => (
            <TypeColumn
              key={column.id}
              column={column}
              items={groupedItems[column.id] || []}
              onEdit={onEdit}
              onDelete={onDelete}
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
