import { FileText, CheckSquare, Trash2, FolderKanban, Calendar, Link2, Settings, File, Image, ExternalLink } from 'lucide-react';
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

const TYPE_LABELS: Record<ItemType, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tache',
  APPOINTMENT: 'RDV',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Doc',
  IMAGE: 'Image',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-500 border-dashed',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'A faire',
  in_progress: 'En cours',
  done: 'Termine',
  cancelled: 'Annule',
};

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
              {TYPE_LABELS[item.type]}
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
