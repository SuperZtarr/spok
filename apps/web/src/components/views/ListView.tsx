import { Trash2, ExternalLink, FileText, CheckSquare } from 'lucide-react';
import type { Item } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS, TYPE_LABELS_SHORT, STATUS_COLORS, STATUS_LABELS } from '../../constants/ui';

interface ListViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export function ListView({ items, onEdit, onDelete, onUpdateStatus }: ListViewProps) {
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
    <div className="divide-y divide-border">
      {items.map((item) => {
        const Icon = TYPE_ICONS[item.type];
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer group"
            onClick={() => onEdit(item.id)}
          >
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

            <span className="flex-1 truncate">{item.title}</span>

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50"
                onClick={(e) => e.stopPropagation()}
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS_SHORT[item.type]}
            </Badge>

            <Badge
              className={`text-xs ${STATUS_COLORS[item.status || 'none']}`}
              variant="secondary"
            >
              {STATUS_LABELS[item.status || ''] || 'Non defini'}
            </Badge>

            {item.status && item.status !== 'done' && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100"
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
              className="opacity-0 group-hover:opacity-100 text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
