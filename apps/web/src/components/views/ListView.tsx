import { useMemo } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar } from 'lucide-react';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS } from '../../constants/ui';

interface ListViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
}

// Format date for display
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ListView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, referentiels }: ListViewProps) {
  // Build status and type maps from referentiels
  const { statusLabels, statusColors, typeLabelsShort } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const types = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;

    const sLabels: Record<string, string> = {};
    const sColors: Record<string, string> = {};
    statuses.forEach((s) => {
      sLabels[s.id] = s.label;
      sColors[s.id] = s.color;
    });
    // Add 'none' color for items without status
    sColors['none'] = 'bg-gray-100 text-gray-500 border-dashed';

    const tLabels: Record<string, string> = {};
    Object.entries(types).forEach(([type, config]) => {
      tLabels[type] = config.labelShort;
    });

    return { statusLabels: sLabels, statusColors: sColors, typeLabelsShort: tLabels };
  }, [referentiels]);

  // Find the "done" status (or last visible status) for the complete button
  const doneStatusId = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const visibleStatuses = statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    // Look for "done" status or use the last one
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    return doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';
  }, [referentiels]);

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
        const statusLabel = statusLabels[item.status || ''] || 'Non defini';
        const statusColor = statusColors[item.status || 'none'] || statusColors['none'];
        const typeLabel = typeLabelsShort[item.type] || item.type;
        const isDone = item.status === doneStatusId;

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer group"
            onClick={() => onEdit(item.id)}
          >
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

            <span className="flex-1 truncate">{item.title}</span>

            {item.type === 'APPOINTMENT' && item.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDate(item.dueDate)}
              </span>
            )}

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
              {typeLabel}
            </Badge>

            <Badge
              className={`text-xs ${statusColor}`}
              variant="secondary"
            >
              {statusLabel}
            </Badge>

            {item.status && !isDone && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(item.id, doneStatusId);
                }}
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(item.id);
              }}
              title="Ajouter un enfant"
            >
              <Plus className="w-4 h-4" />
            </Button>

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
