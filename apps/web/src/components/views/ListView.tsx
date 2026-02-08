import { useMemo, useState } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar, Search, X, MessageSquare } from 'lucide-react';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS, getTypeColor } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

// Extended Item type with contribution count
interface ItemWithContributions extends Item {
  contributionCount?: number;
}

interface ListViewProps {
  items: ItemWithContributions[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
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

export function ListView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, referentiels, canEdit = true }: ListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      stripMarkup(item.description || '').toLowerCase().includes(query)
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
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50 sticky top-0">
            <span className="w-4" title="Type d'élément" />
            <span title="Nom de l'élément">Titre</span>
            <span className="text-center" title="Catégorie de l'élément">Type</span>
            <span className="text-center" title="État d'avancement">Statut</span>
            <span className="text-center" title="Lien, date, contributions">Info</span>
            <span className="w-20" title="Actions rapides (survol)" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filteredItems.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              const statusLabel = statusLabels[item.status || ''] || 'Non défini';
              const statusColor = statusColors[item.status || 'none'] || statusColors['none'];
              const typeLabel = typeLabelsShort[item.type] || item.type;
              const isDone = item.status === doneStatusId;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[auto_1fr_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2.5 hover:bg-accent cursor-pointer group"
                  onClick={() => onEdit(item.id)}
                >
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <span className="truncate">{item.title}</span>

                  <span className="flex justify-center">
                    <Badge variant="outline" className={`text-xs border ${getTypeColor(item.type, referentiels?.typeLabels).color}`}>
                      {typeLabel}
                    </Badge>
                  </span>

                  <span className="flex justify-center">
                    <Badge
                      className={`text-xs ${statusColor}`}
                      variant="secondary"
                    >
                      {statusLabel}
                    </Badge>
                  </span>

                  <span className="flex items-center justify-center gap-1.5">
                    {item.type === 'MEETING' && item.startDate && (
                      <span className="text-xs text-muted-foreground" title={formatDate(item.startDate) || ''}>
                        <Calendar className="w-3 h-3" />
                      </span>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                        onClick={(e) => e.stopPropagation()}
                        title="Ouvrir le lien"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {item.contributionCount !== undefined && item.contributionCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs text-muted-foreground"
                        title={`${item.contributionCount} contribution(s)`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {item.contributionCount}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-0.5 w-20 justify-end">
                    {canEdit && item.status && !isDone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(item.id, doneStatusId);
                        }}
                        title="Marquer terminé"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddChild(item.id);
                        }}
                        title="Ajouter un enfant"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
