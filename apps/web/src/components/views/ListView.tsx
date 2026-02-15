import { useMemo, useState, useRef, useCallback } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar, Search, X, MessageSquare, ArrowUp, ArrowDown, FolderInput, Copy } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';

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
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
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

function ImageThumbnail({ url }: { url: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowPreview(true);
  };

  return (
    <div
      ref={ref}
      className="relative flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPreview(false)}
    >
      <img
        src={url}
        alt=""
        className="w-6 h-6 object-cover rounded border border-border"
      />
      {showPreview && (
        <div
          className="fixed z-50 p-1 bg-background border border-border rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
        >
          <img
            src={url}
            alt=""
            className="max-w-xs max-h-48 object-contain rounded"
          />
        </div>
      )}
    </div>
  );
}

type SortField = 'title' | 'type' | 'status' | 'parent' | 'date' | 'contributions';
type SortDir = 'asc' | 'desc';

export function ListView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, referentiels, canEdit = true }: ListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      stripMarkup(item.description || '').toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Sort filtered items
  const sortedItems = useMemo(() => {
    if (!sortField) return filteredItems;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      switch (sortField) {
        case 'title':
          return mul * a.title.localeCompare(b.title, 'fr');
        case 'type':
          return mul * a.type.localeCompare(b.type);
        case 'status': {
          const sa = a.status || '';
          const sb = b.status || '';
          return mul * sa.localeCompare(sb);
        }
        case 'parent': {
          const pa = (a.parentId && parentNames[a.parentId]) || '';
          const pb = (b.parentId && parentNames[b.parentId]) || '';
          return mul * pa.localeCompare(pb, 'fr');
        }
        case 'date': {
          const da = a.startDate || a.createdAt || '';
          const db = b.startDate || b.createdAt || '';
          return mul * da.localeCompare(db);
        }
        case 'contributions': {
          const ca = (a as ItemWithContributions).contributionCount || 0;
          const cb = (b as ItemWithContributions).contributionCount || 0;
          return mul * (ca - cb);
        }
        default:
          return 0;
      }
    });
  }, [filteredItems, sortField, sortDir]);

  // Build parent name map
  const parentNames = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach(item => { map[item.id] = item.title; });
    return map;
  }, [items]);

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
      {sortedItems.length === 0 ? (
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
        <>
          {/* Header — fixed outside scroll */}
          <div className="grid grid-cols-[auto_1fr_8rem_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50 select-none flex-shrink-0">
            <span className="w-4" />
            <button className="flex items-center gap-1 hover:text-foreground transition-colors text-left" onClick={() => toggleSort('title')}>
              Titre
              {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="flex items-center gap-1 hover:text-foreground transition-colors text-left truncate" onClick={() => toggleSort('parent')}>
              Parent
              {sortField === 'parent' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('type')}>
              Type
              {sortField === 'type' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
              Statut
              {sortField === 'status' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('date')}>
              Info
              {sortField === 'date' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <span className="w-20" />
          </div>

          {/* Rows — scrollable */}
          <div className="flex-1 overflow-auto">
          <div className="divide-y divide-border">
            {sortedItems.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              const statusLabel = statusLabels[item.status || ''] || 'Non défini';
              const statusColor = statusColors[item.status || 'none'] || statusColors['none'];
              const typeLabel = typeLabelsShort[item.type] || item.type;
              const isDone = item.status === doneStatusId;
              const hasImage = item.type === 'IMAGE' && item.url;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[auto_1fr_8rem_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2.5 hover:bg-accent cursor-pointer group"
                  onClick={() => onEdit(item.id)}
                >
                  {hasImage ? (
                    <ImageThumbnail url={item.url!} />
                  ) : (
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}

                  <span className="truncate">{item.title}</span>

                  <span className="truncate text-xs text-muted-foreground" title={item.parentId ? parentNames[item.parentId] || '' : ''}>
                    {item.parentId ? parentNames[item.parentId] || '' : ''}
                  </span>

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

                  <span className="flex items-center justify-end w-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <ItemActionMenu
                        groups={[
                          {
                            actions: [
                              ...(item.status && !isDone ? [{ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, doneStatusId) }] : []),
                              { id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) },
                              ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => onDuplicateToSpace(item.id) }] : []),
                            ],
                          },
                          {
                            actions: [
                              ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(item.id) }] : []),
                            ],
                          },
                          {
                            actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }],
                          },
                        ].filter(g => g.actions.length > 0)}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
