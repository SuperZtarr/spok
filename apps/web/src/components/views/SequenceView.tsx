import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar } from 'lucide-react';
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

// --- Graph algorithms ---

interface Edge {
  from: string;
  to: string;
  type: 'depends' | 'blocks';
}

interface Chain {
  levels: Item[][];       // items grouped by level (column), left to right
  edges: Edge[];          // edges within this chain
}

/**
 * Compute connected components and assign levels within each.
 * Returns chains (components with items by level) and unlinked items.
 */
function computeChains(
  items: Item[],
  relations: ItemRelation[]
): { chains: Chain[]; unlinked: Item[] } {
  const itemIds = new Set(items.map(i => i.id));
  const itemMap = new Map(items.map(i => [i.id, i]));

  // Build directed graph: predecessor -> successor (same as topological sort)
  // + undirected adjacency for connected components
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const neighbors = new Map<string, Set<string>>();
  const edges: Edge[] = [];

  items.forEach(item => {
    successors.set(item.id, []);
    predecessors.set(item.id, []);
    neighbors.set(item.id, new Set());
  });

  relations.forEach(rel => {
    const from = rel.fromItemId;
    const to = rel.toItemId;
    if (!itemIds.has(from) || !itemIds.has(to)) return;

    if (rel.type === 'depends') {
      // fromItem depends on toItem => toItem before fromItem
      successors.get(to)!.push(from);
      predecessors.get(from)!.push(to);
      edges.push({ from: to, to: from, type: 'depends' });
    } else if (rel.type === 'blocks') {
      // fromItem blocks toItem => fromItem before toItem
      successors.get(from)!.push(to);
      predecessors.get(to)!.push(from);
      edges.push({ from, to, type: 'blocks' });
    }

    neighbors.get(from)!.add(to);
    neighbors.get(to)!.add(from);
  });

  // Find connected components via BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  items.forEach(item => {
    if (visited.has(item.id)) return;
    // Only start BFS if this item has at least one neighbor
    if (neighbors.get(item.id)!.size === 0) return;

    const component: string[] = [];
    const queue = [item.id];
    visited.add(item.id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      for (const n of neighbors.get(id) || []) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    components.push(component);
  });

  // Unlinked items: not in any component
  const linkedIds = new Set(components.flat());
  const unlinked = items.filter(i => !linkedIds.has(i.id));

  // For each component, compute levels via longest path from roots
  const chains: Chain[] = components.map(comp => {
    const compSet = new Set(comp);

    // Roots = items with no predecessors within this component
    const roots = comp.filter(id => {
      const preds = predecessors.get(id) || [];
      return preds.filter(p => compSet.has(p)).length === 0;
    });

    // BFS/longest-path to assign levels
    const level = new Map<string, number>();
    // Initialize all to 0
    comp.forEach(id => level.set(id, 0));

    // Process in topological order (Kahn's within component)
    const inDeg = new Map<string, number>();
    comp.forEach(id => {
      const preds = (predecessors.get(id) || []).filter(p => compSet.has(p));
      inDeg.set(id, preds.length);
    });

    const queue = roots.slice();
    while (queue.length > 0) {
      const id = queue.shift()!;
      const succs = (successors.get(id) || []).filter(s => compSet.has(s));
      for (const s of succs) {
        // Longest path
        level.set(s, Math.max(level.get(s)!, level.get(id)! + 1));
        const deg = inDeg.get(s)! - 1;
        inDeg.set(s, deg);
        if (deg === 0) queue.push(s);
      }
    }

    // Handle any remaining (cycles) — just put at max+1
    const maxLevel = Math.max(...Array.from(level.values()), 0);
    comp.forEach(id => {
      if (inDeg.get(id)! > 0) level.set(id, maxLevel + 1);
    });

    // Group by level
    const levelCount = Math.max(...Array.from(level.values())) + 1;
    const levels: Item[][] = Array.from({ length: levelCount }, () => []);
    comp.forEach(id => {
      const item = itemMap.get(id);
      if (item) levels[level.get(id)!].push(item);
    });

    // Filter edges to this component
    const compEdges = edges.filter(e => compSet.has(e.from) && compSet.has(e.to));

    return { levels, edges: compEdges };
  });

  // Sort chains by size (largest first)
  chains.sort((a, b) => {
    const sizeA = a.levels.reduce((s, l) => s + l.length, 0);
    const sizeB = b.levels.reduce((s, l) => s + l.length, 0);
    return sizeB - sizeA;
  });

  return { chains, unlinked };
}

// --- SVG connector drawing ---

interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'depends' | 'blocks';
}

function SVGConnectors({ lines }: { lines: ConnectorLine[] }) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%', zIndex: 0 }}
    >
      <defs>
        <marker
          id="arrow-depends"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#3b82f6" />
        </marker>
        <marker
          id="arrow-blocks"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8 z" fill="#ef4444" />
        </marker>
      </defs>
      {lines.map((line, i) => {
        const midX = (line.x1 + line.x2) / 2;
        const color = line.type === 'depends' ? '#3b82f6' : '#ef4444';
        const markerId = line.type === 'depends' ? 'arrow-depends' : 'arrow-blocks';
        return (
          <path
            key={i}
            d={`M ${line.x1},${line.y1} C ${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`}
            stroke={color}
            strokeWidth={2}
            fill="none"
            markerEnd={`url(#${markerId})`}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}

// --- Main component ---

export function SequenceView({
  items,
  relations,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  referentiels,
  highlightType,
}: SequenceViewProps) {
  // Build status maps from referentiels
  const { statusLabels, statusBorderColors, doneStatusId } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;

    const labels: Record<string, string> = {};
    const borderColors: Record<string, string> = {};
    statuses.forEach((s) => {
      labels[s.id] = s.label;
      borderColors[s.id] = s.borderColor;
    });
    borderColors['none'] = 'border-gray-200 bg-white';

    const visibleStatuses = statuses
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order);
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    const doneId =
      doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';

    return {
      statusLabels: labels,
      statusBorderColors: borderColors,
      doneStatusId: doneId,
    };
  }, [referentiels]);

  // Compute chains and dependency maps
  const hasRelations = relations && relations.length > 0;

  const { chains, unlinked } = useMemo(() => {
    if (!hasRelations) return { chains: [], unlinked: items };
    return computeChains(items, relations!);
  }, [items, relations, hasRelations]);

  // Dependency lookup maps (for badges)
  const { dependsOnMap, blocksMap } = useMemo(() => {
    const dependsOn = new Map<string, { id: string; title: string }[]>();
    const blocks = new Map<string, { id: string; title: string }[]>();

    if (!relations) return { dependsOnMap: dependsOn, blocksMap: blocks };

    const itemMap = new Map(items.map(i => [i.id, i]));
    const itemIds = new Set(items.map(i => i.id));

    relations.forEach(rel => {
      if (!itemIds.has(rel.fromItemId) || !itemIds.has(rel.toItemId)) return;

      if (rel.type === 'depends') {
        const fromItem = itemMap.get(rel.fromItemId);
        const toItem = itemMap.get(rel.toItemId);
        if (fromItem && toItem) {
          if (!dependsOn.has(rel.fromItemId)) dependsOn.set(rel.fromItemId, []);
          dependsOn.get(rel.fromItemId)!.push({ id: toItem.id, title: toItem.title });
          if (!blocks.has(rel.toItemId)) blocks.set(rel.toItemId, []);
          blocks.get(rel.toItemId)!.push({ id: fromItem.id, title: fromItem.title });
        }
      } else if (rel.type === 'blocks') {
        const fromItem = itemMap.get(rel.fromItemId);
        const toItem = itemMap.get(rel.toItemId);
        if (fromItem && toItem) {
          if (!blocks.has(rel.fromItemId)) blocks.set(rel.fromItemId, []);
          blocks.get(rel.fromItemId)!.push({ id: toItem.id, title: toItem.title });
          if (!dependsOn.has(rel.toItemId)) dependsOn.set(rel.toItemId, []);
          dependsOn.get(rel.toItemId)!.push({ id: fromItem.id, title: fromItem.title });
        }
      }
    });

    return { dependsOnMap: dependsOn, blocksMap: blocks };
  }, [items, relations]);

  // Card renderer (compact version for chains, full for list)
  const renderCard = useCallback(
    (item: Item, compact: boolean, ref?: (el: HTMLDivElement | null) => void) => {
      const Icon = TYPE_ICONS[item.type];
      const statusLabel = statusLabels[item.status || ''] || 'Non défini';
      const borderColor =
        statusBorderColors[item.status || 'none'] || statusBorderColors['none'];
      const isDone = item.status === doneStatusId;
      const isHighlighted = highlightType && item.type === highlightType;
      const isDimmed = highlightType && item.type !== highlightType;

      const itemDependsOn = dependsOnMap.get(item.id) || [];
      const itemBlocks = blocksMap.get(item.id) || [];
      const hasUnsatisfiedDeps = itemDependsOn.length > 0 && !isDone;

      return (
        <div
          key={item.id}
          ref={ref}
          data-item-id={item.id}
          className={`relative border-2 rounded-lg cursor-pointer hover:shadow-md transition-all group ${borderColor} ${
            isHighlighted ? 'ring-2 ring-primary ring-offset-2 scale-[1.02]' : ''
          } ${isDimmed ? 'opacity-40' : ''} ${
            hasUnsatisfiedDeps ? 'ring-1 ring-orange-300' : ''
          } ${compact ? 'p-3 w-52' : 'p-4 w-full max-w-md'}`}
          onClick={() => onEdit(item.id)}
        >
          <div className="flex items-start gap-2">
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3
                  className={`font-medium truncate ${compact ? 'text-sm' : ''}`}
                  title={item.title}
                >
                  {item.title}
                </h3>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title="Ouvrir le lien"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Description only in full mode */}
              {!compact && item.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {stripMarkup(item.description)}
                </p>
              )}

              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="secondary" className="text-[11px]">
                  {statusLabel}
                </Badge>
                {item.type === 'MEETING' && item.startDate && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.startDate)}
                  </span>
                )}
              </div>

              {/* Dependency badges */}
              {(itemDependsOn.length > 0 || itemBlocks.length > 0) && (
                <div className="mt-1.5 space-y-0.5">
                  {itemDependsOn.length > 0 && (
                    <p className="text-[10px] text-orange-600 truncate" title={`Dépend de : ${itemDependsOn.map(d => d.title).join(', ')}`}>
                      <span className="font-medium">Dépend de :</span>{' '}
                      {itemDependsOn.map(d => d.title).join(', ')}
                    </p>
                  )}
                  {itemBlocks.length > 0 && (
                    <p className="text-[10px] text-red-600 truncate" title={`Bloque : ${itemBlocks.map(b => b.title).join(', ')}`}>
                      <span className="font-medium">Bloque :</span>{' '}
                      {itemBlocks.map(b => b.title).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons on hover */}
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.status && !isDone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(item.id, doneStatusId);
                  }}
                  title="Marquer terminé"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(item.id);
                }}
                title="Ajouter un enfant"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    },
    [
      statusLabels,
      statusBorderColors,
      doneStatusId,
      highlightType,
      dependsOnMap,
      blocksMap,
      onEdit,
      onDelete,
      onUpdateStatus,
      onAddChild,
    ]
  );

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun élément</p>
        <p className="text-sm">Créez votre premier élément pour commencer</p>
      </div>
    );
  }

  // --- No relations: fallback to simple vertical list ---
  if (!hasRelations) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center gap-3">
          {items.map((item) => (
            <div key={item.id}>{renderCard(item, false)}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- With relations: horizontal chain layout ---
  return (
    <div className="p-6 space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg width="40" height="12">
            <line x1="0" y1="6" x2="32" y2="6" stroke="#3b82f6" strokeWidth="2" />
            <polygon points="32,2 40,6 32,10" fill="#3b82f6" />
          </svg>
          <span>dépend de</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="40" height="12">
            <line x1="0" y1="6" x2="32" y2="6" stroke="#ef4444" strokeWidth="2" />
            <polygon points="32,2 40,6 32,10" fill="#ef4444" />
          </svg>
          <span>bloque</span>
        </div>
      </div>

      {/* Chains */}
      {chains.map((chain, chainIndex) => (
        <ChainRow
          key={chainIndex}
          chain={chain}
          renderCard={renderCard}
          chainIndex={chainIndex}
        />
      ))}

      {/* Unlinked items */}
      {unlinked.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Éléments sans dépendance
          </h3>
          <div className="flex flex-wrap gap-3">
            {unlinked.map((item) => (
              <div key={item.id}>{renderCard(item, true)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Chain row with SVG connectors ---

function ChainRow({
  chain,
  renderCard,
  chainIndex,
}: {
  chain: Chain;
  renderCard: (item: Item, compact: boolean, ref?: (el: HTMLDivElement | null) => void) => React.ReactNode;
  chainIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  // Compute SVG lines after layout
  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLines: ConnectorLine[] = [];

      chain.edges.forEach(edge => {
        const fromEl = cardRefs.current.get(edge.from);
        const toEl = cardRefs.current.get(edge.to);
        if (!fromEl || !toEl) return;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        // Right edge of source -> left edge of target
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;

        newLines.push({ x1, y1, x2, y2, type: edge.type });
      });

      setLines(newLines);
    };

    // Compute after DOM paint
    requestAnimationFrame(() => {
      requestAnimationFrame(compute);
    });
  }, [chain]);

  // Re-compute on window resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLines: ConnectorLine[] = [];

        chain.edges.forEach(edge => {
          const fromEl = cardRefs.current.get(edge.from);
          const toEl = cardRefs.current.get(edge.to);
          if (!fromEl || !toEl) return;

          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          const x1 = fromRect.right - containerRect.left;
          const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
          const x2 = toRect.left - containerRect.left;
          const y2 = toRect.top + toRect.height / 2 - containerRect.top;

          newLines.push({ x1, y1, x2, y2, type: edge.type });
        });

        setLines(newLines);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chain]);

  return (
    <div>
      {chainIndex > 0 && <div className="border-t border-dashed border-gray-200 mb-4" />}
      <div
        ref={containerRef}
        className="relative overflow-x-auto"
      >
        <div className="flex flex-row items-start gap-8 pb-2 min-w-min">
          {chain.levels.map((levelItems, levelIndex) => (
            <div
              key={levelIndex}
              className="flex flex-col gap-3 min-w-[220px]"
            >
              {levelItems.map(item =>
                renderCard(item, true, (el) => {
                  if (el) cardRefs.current.set(item.id, el);
                  else cardRefs.current.delete(item.id);
                })
              )}
            </div>
          ))}
        </div>
        <SVGConnectors lines={lines} />
      </div>
    </div>
  );
}
