import { useMemo } from 'react';
import { Trash2, ArrowDown, ExternalLink, FileText, CheckSquare, Plus, Calendar } from 'lucide-react';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

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

interface SequenceViewProps {
  items: Item[];
  relations?: ItemRelation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
}

// Topological sort using Kahn's algorithm
function topologicalSort(items: Item[], relations: ItemRelation[]): Item[] {
  const itemIds = new Set(items.map(i => i.id));

  // Build adjacency: "must come before" -> "item"
  // depends: fromItem depends on toItem => toItem before fromItem
  // blocks: fromItem blocks toItem => fromItem before toItem
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // predecessor -> successors

  items.forEach(item => {
    inDegree.set(item.id, 0);
    adj.set(item.id, []);
  });

  relations.forEach(rel => {
    const from = rel.fromItemId;
    const to = rel.toItemId;
    if (!itemIds.has(from) || !itemIds.has(to)) return;

    if (rel.type === 'depends') {
      // fromItem depends on toItem => toItem must come before fromItem
      adj.get(to)!.push(from);
      inDegree.set(from, (inDegree.get(from) || 0) + 1);
    } else if (rel.type === 'blocks') {
      // fromItem blocks toItem => fromItem must come before toItem
      adj.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  });

  // Items with no dependencies first, ordered by original position
  const itemPositionMap = new Map(items.map((item, idx) => [item.id, idx]));
  const queue: string[] = [];

  items.forEach(item => {
    if ((inDegree.get(item.id) || 0) === 0) {
      queue.push(item.id);
    }
  });

  // Sort queue by original position to maintain stable order
  queue.sort((a, b) => (itemPositionMap.get(a) || 0) - (itemPositionMap.get(b) || 0));

  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);

    const successors = adj.get(id) || [];
    // Sort successors by original position for stable ordering
    const readySuccessors: string[] = [];
    for (const succ of successors) {
      const deg = (inDegree.get(succ) || 0) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) {
        readySuccessors.push(succ);
      }
    }
    readySuccessors.sort((a, b) => (itemPositionMap.get(a) || 0) - (itemPositionMap.get(b) || 0));
    queue.push(...readySuccessors);
  }

  // Handle cycles: add remaining items at the end
  const sortedSet = new Set(sorted);
  items.forEach(item => {
    if (!sortedSet.has(item.id)) {
      sorted.push(item.id);
    }
  });

  const itemMap = new Map(items.map(i => [i.id, i]));
  return sorted.map(id => itemMap.get(id)!).filter(Boolean);
}

export function SequenceView({ items, relations, onEdit, onDelete, onUpdateStatus, onAddChild, referentiels, highlightType }: SequenceViewProps) {
  // Build status maps from referentiels
  const { statusLabels, statusBorderColors, doneStatusId } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;

    const labels: Record<string, string> = {};
    const borderColors: Record<string, string> = {};
    statuses.forEach((s) => {
      labels[s.id] = s.label;
      borderColors[s.id] = s.borderColor;
    });
    // Add 'none' border color for items without status
    borderColors['none'] = 'border-gray-200 bg-white';

    // Find the "done" status (or last visible status) for the complete button
    const visibleStatuses = statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    const doneId = doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';

    return { statusLabels: labels, statusBorderColors: borderColors, doneStatusId: doneId };
  }, [referentiels]);

  // Topological sort based on dependencies
  const sortedItems = useMemo(() => {
    if (!relations || relations.length === 0) return items;
    return topologicalSort(items, relations);
  }, [items, relations]);

  // Build dependency lookup maps
  const { dependsOnMap, blocksMap, directRelationMap } = useMemo(() => {
    // dependsOnMap: itemId -> list of item titles it depends on
    // blocksMap: itemId -> list of item titles it blocks
    const dependsOn = new Map<string, { id: string; title: string }[]>();
    const blocks = new Map<string, { id: string; title: string }[]>();
    // directRelationMap: [prevId, nextId] -> relation type ('depends' | 'blocks')
    const directRel = new Map<string, string>();

    if (!relations) return { dependsOnMap: dependsOn, blocksMap: blocks, directRelationMap: directRel };

    const itemMap = new Map(items.map(i => [i.id, i]));
    const itemIds = new Set(items.map(i => i.id));

    relations.forEach(rel => {
      if (!itemIds.has(rel.fromItemId) || !itemIds.has(rel.toItemId)) return;

      if (rel.type === 'depends') {
        // fromItem depends on toItem
        const fromItem = itemMap.get(rel.fromItemId);
        const toItem = itemMap.get(rel.toItemId);
        if (fromItem && toItem) {
          if (!dependsOn.has(rel.fromItemId)) dependsOn.set(rel.fromItemId, []);
          dependsOn.get(rel.fromItemId)!.push({ id: toItem.id, title: toItem.title });
          if (!blocks.has(rel.toItemId)) blocks.set(rel.toItemId, []);
          blocks.get(rel.toItemId)!.push({ id: fromItem.id, title: fromItem.title });
          // toItem should come before fromItem → connector from toItem to fromItem
          directRel.set(`${rel.toItemId}→${rel.fromItemId}`, 'depends');
        }
      } else if (rel.type === 'blocks') {
        // fromItem blocks toItem
        const fromItem = itemMap.get(rel.fromItemId);
        const toItem = itemMap.get(rel.toItemId);
        if (fromItem && toItem) {
          if (!blocks.has(rel.fromItemId)) blocks.set(rel.fromItemId, []);
          blocks.get(rel.fromItemId)!.push({ id: toItem.id, title: toItem.title });
          if (!dependsOn.has(rel.toItemId)) dependsOn.set(rel.toItemId, []);
          dependsOn.get(rel.toItemId)!.push({ id: fromItem.id, title: fromItem.title });
          // fromItem should come before toItem → connector from fromItem to toItem
          directRel.set(`${rel.fromItemId}→${rel.toItemId}`, 'blocks');
        }
      }
    });

    return { dependsOnMap: dependsOn, blocksMap: blocks, directRelationMap: directRel };
  }, [items, relations]);

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
        {sortedItems.map((item, index) => {
          const Icon = TYPE_ICONS[item.type];
          const statusLabel = statusLabels[item.status || ''] || 'Non defini';
          const borderColor = statusBorderColors[item.status || 'none'] || statusBorderColors['none'];
          const isDone = item.status === doneStatusId;
          const isHighlighted = highlightType && item.type === highlightType;
          const isDimmed = highlightType && item.type !== highlightType;

          // Dependency info for this item
          const itemDependsOn = dependsOnMap.get(item.id) || [];
          const itemBlocks = blocksMap.get(item.id) || [];
          const hasUnsatisfiedDeps = itemDependsOn.length > 0 && !isDone;

          // Determine connector type between previous and current item
          let connectorType: 'depends' | 'blocks' | 'none' = 'none';
          if (index > 0) {
            const prevItem = sortedItems[index - 1];
            const key = `${prevItem.id}→${item.id}`;
            const relType = directRelationMap.get(key);
            if (relType === 'depends') connectorType = 'depends';
            else if (relType === 'blocks') connectorType = 'blocks';
          }

          return (
            <div key={item.id} className="w-full max-w-md">
              {/* Connector arrow */}
              {index > 0 && (
                <div className="flex flex-col items-center py-1">
                  {connectorType === 'depends' ? (
                    <>
                      <div className="w-0.5 h-3 bg-blue-400" />
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                        dépend de
                      </span>
                      <ArrowDown className="w-5 h-5 text-blue-500" />
                    </>
                  ) : connectorType === 'blocks' ? (
                    <>
                      <div className="w-0.5 h-3 bg-red-400" />
                      <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        bloqué par
                      </span>
                      <ArrowDown className="w-5 h-5 text-red-500" />
                    </>
                  ) : (
                    <>
                      <div className="w-0.5 h-3 border-l-2 border-dashed border-gray-300" />
                      <ArrowDown className={`w-5 h-5 ${isDimmed ? 'text-muted-foreground/30' : 'text-gray-300'}`} />
                    </>
                  )}
                </div>
              )}

              {/* Sequence item card */}
              <div
                className={`relative border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all group ${borderColor} ${
                  isHighlighted ? 'ring-2 ring-primary ring-offset-2 scale-[1.02]' : ''
                } ${isDimmed ? 'opacity-40' : ''} ${hasUnsatisfiedDeps ? 'ring-1 ring-orange-300' : ''}`}
                onClick={() => onEdit(item.id)}
              >
                {/* Step number */}
                <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{item.title}</h3>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title="Ouvrir le lien"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {stripMarkup(item.description)}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {statusLabel}
                      </Badge>
                      {item.type === 'MEETING' && item.startDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.startDate)}
                        </span>
                      )}
                    </div>

                    {/* Dependency indicators */}
                    {(itemDependsOn.length > 0 || itemBlocks.length > 0) && (
                      <div className="mt-2 space-y-1">
                        {itemDependsOn.length > 0 && (
                          <p className="text-[11px] text-orange-600">
                            <span className="font-medium">Dépend de :</span>{' '}
                            {itemDependsOn.map(d => d.title).join(', ')}
                          </p>
                        )}
                        {itemBlocks.length > 0 && (
                          <p className="text-[11px] text-red-600">
                            <span className="font-medium">Bloque :</span>{' '}
                            {itemBlocks.map(b => b.title).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.status && !isDone && (
                      <Button
                        variant="ghost"
                        size="sm"
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
