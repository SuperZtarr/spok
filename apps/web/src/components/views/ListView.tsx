import { useMemo, useState } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar, Search, X } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchQuery ? (
            <>
              <p>Aucun résultat</p>
              <p className="text-sm">Aucun élément ne correspond à "{searchQuery}"</p>
            </>
          ) : (
            <>
              <p>Aucun element</p>
              <p className="text-sm">Creez votre premier element pour commencer</p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border flex-1 overflow-auto">
          {filteredItems.map((item) => {
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

            {item.type === 'MEETING' && item.startDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDate(item.startDate)}
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
      )}
    </div>
  );
}
