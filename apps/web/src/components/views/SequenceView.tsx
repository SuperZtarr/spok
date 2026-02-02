import { FileText, CheckSquare, Trash2, ArrowDown, FolderKanban, Calendar, Link2, Settings, File, Image } from 'lucide-react';
import type { Item, ItemType } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-gray-300 bg-gray-50',
  in_progress: 'border-blue-300 bg-blue-50',
  done: 'border-green-300 bg-green-50',
  cancelled: 'border-red-300 bg-red-50',
  none: 'border-gray-200 bg-white',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'A faire',
  in_progress: 'En cours',
  done: 'Termine',
  cancelled: 'Annule',
};

interface SequenceViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export function SequenceView({ items, onEdit, onDelete, onUpdateStatus }: SequenceViewProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun element</p>
        <p className="text-sm">Creez votre premier element pour commencer</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-2">
        {items.map((item, index) => {
          const Icon = TYPE_ICONS[item.type];
          return (
            <div key={item.id} className="w-full max-w-md">
              {/* Connector arrow */}
              {index > 0 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              {/* Sequence item card */}
              <div
                className={`relative border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow group ${
                  STATUS_COLORS[item.status || 'none']
                }`}
                onClick={() => onEdit(item.id)}
              >
                {/* Step number */}
                <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {STATUS_LABELS[item.status || ''] || 'Non defini'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.status && item.status !== 'done' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(item.id, 'done');
                        }}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
