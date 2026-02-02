import { FileText, CheckSquare, Trash2, FolderKanban, Calendar, Link2, Settings, File, Image } from 'lucide-react';
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
  { id: 'todo', label: 'A faire', color: 'border-gray-300' },
  { id: 'in_progress', label: 'En cours', color: 'border-blue-400' },
  { id: 'done', label: 'Termine', color: 'border-green-400' },
  { id: 'cancelled', label: 'Annule', color: 'border-red-400' },
];

interface KanbanViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export function KanbanView({ items, onEdit, onDelete, onUpdateStatus }: KanbanViewProps) {
  // Group items by status
  const groupedItems = COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = items.filter((item) => (item.status || 'todo') === column.id);
      return acc;
    },
    {} as Record<string, Item[]>
  );

  // Items without status go to "todo"
  const noStatusItems = items.filter((item) => !item.status);
  groupedItems['todo'] = [...(groupedItems['todo'] || []), ...noStatusItems];

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className={`flex-shrink-0 w-72 bg-muted/50 rounded-lg border-t-4 ${column.color}`}
          >
            {/* Column header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{column.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {groupedItems[column.id]?.length || 0}
                </span>
              </div>
            </div>

            {/* Column items */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {groupedItems[column.id]?.map((item) => {
                const Icon = TYPE_ICONS[item.type];
                return (
                  <div
                    key={item.id}
                    className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => onEdit(item.id)}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {column.id !== 'done' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus =
                              column.id === 'todo'
                                ? 'in_progress'
                                : column.id === 'in_progress'
                                  ? 'done'
                                  : 'done';
                            onUpdateStatus(item.id, nextStatus);
                          }}
                        >
                          <CheckSquare className="w-3 h-3 mr-1" />
                          {column.id === 'todo' ? 'Demarrer' : 'Terminer'}
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
              })}

              {(!groupedItems[column.id] || groupedItems[column.id].length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun element
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
