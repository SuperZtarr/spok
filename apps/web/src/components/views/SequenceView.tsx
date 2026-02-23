import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, ExternalLink, FileText, CheckSquare, Plus, Calendar, Link2, Ban, ArrowLeft, Copy, Cog, FlaskConical, FolderInput, FolderPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS, getTypeTextColor, getTypeColor } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

// Relation type options (same as MindMap)
const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'relates', label: 'Est lié à', Icon: Link2, description: 'Lien simple entre deux éléments', color: 'text-purple-500' },
  { id: 'blocks', label: 'Bloque', Icon: Ban, description: 'A doit être terminé avant B', color: 'text-red-500' },
  { id: 'depends', label: 'Dépend de', Icon: ArrowLeft, description: 'A nécessite B pour avancer', color: 'text-orange-500' },
  { id: 'duplicates', label: 'Duplique', Icon: Copy, description: 'A est un doublon de B', color: 'text-gray-500' },
  { id: 'implements', label: 'Implémente', Icon: Cog, description: 'A réalise/concrétise B', color: 'text-blue-500' },
  { id: 'tests', label: 'Teste', Icon: FlaskConical, description: 'A valide le bon fonctionnement de B', color: 'text-green-500' },
];

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
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

// --- Graph types ---

interface ConnectorEdge {
  from: string;
  to: string;
  type: 'depends' | 'blocks' | 'hierarchy' | 'relates' | 'duplicates' | 'implements' | 'tests';
}

interface Chain {
  levels: Item[][];          // items grouped by depth (column), left to right
  edges: ConnectorEdge[];    // all edges: hierarchy + relations within this chain
}

/**
 * Build branches from parent-child hierarchy, with relations affecting positioning.
 *
 * Step 1: Compute levels GLOBALLY across all items (hierarchy + relations combined).
 *         If C blocks A, A is pushed after C even if they're in different subtrees.
 * Step 2: Split into branches per root (first child continues, others fork).
 * Step 3: Each branch = one horizontal line with items at their global level.
 */
function computeHierarchyChains(
  items: Item[],
  relations: ItemRelation[]
): { chains: Chain[]; standalone: Item[] } {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const itemIds = new Set(items.map(i => i.id));

  // Build children map
  const childrenMap = new Map<string, Item[]>();
  const roots: Item[] = [];

  items.forEach(item => {
    if (!item.parentId || !itemMap.has(item.parentId)) {
      roots.push(item);
    } else {
      if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
      childrenMap.get(item.parentId)!.push(item);
    }
  });

  // Sort roots and children by position
  roots.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const [, children] of childrenMap) {
    children.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // --- Step 1: Compute levels GLOBALLY (all items, all edges) ---
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const dagEdgeSet = new Set<string>();
  const allHierarchyEdges: { from: string; to: string }[] = [];
  const allRelEdges: ConnectorEdge[] = [];

  items.forEach(item => {
    successors.set(item.id, []);
    inDegree.set(item.id, 0);
  });

  // Add all hierarchy edges (parent → child)
  items.forEach(item => {
    if (item.parentId && itemMap.has(item.parentId)) {
      const key = `${item.parentId}→${item.id}`;
      if (!dagEdgeSet.has(key)) {
        dagEdgeSet.add(key);
        successors.get(item.parentId)!.push(item.id);
        inDegree.set(item.id, (inDegree.get(item.id) || 0) + 1);
        allHierarchyEdges.push({ from: item.parentId, to: item.id });
      }
    }
  });

  // Add all relation edges
  relations.forEach(rel => {
    if (!itemIds.has(rel.fromItemId) || !itemIds.has(rel.toItemId)) return;

    let from: string, to: string;
    if (rel.type === 'depends') {
      from = rel.toItemId;
      to = rel.fromItemId;
    } else if (rel.type === 'blocks') {
      from = rel.fromItemId;
      to = rel.toItemId;
    } else return;

    allRelEdges.push({ from, to, type: rel.type as 'depends' | 'blocks' });

    const key = `${from}→${to}`;
    if (!dagEdgeSet.has(key)) {
      dagEdgeSet.add(key);
      successors.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  });

  // Compute levels via longest path (Kahn's algorithm)
  const level = new Map<string, number>();
  items.forEach(item => level.set(item.id, 0));

  const topoQueue: string[] = [];
  items.forEach(item => {
    if ((inDegree.get(item.id) || 0) === 0) topoQueue.push(item.id);
  });

  while (topoQueue.length > 0) {
    const id = topoQueue.shift()!;
    for (const s of successors.get(id) || []) {
      level.set(s, Math.max(level.get(s)!, level.get(id)! + 1));
      const deg = (inDegree.get(s) || 0) - 1;
      inDegree.set(s, deg);
      if (deg === 0) topoQueue.push(s);
    }
  }

  // Handle cycles
  const maxLevel = Math.max(...Array.from(level.values()), 0);
  items.forEach(item => {
    if ((inDegree.get(item.id) || 0) > 0) level.set(item.id, maxLevel + 1);
  });

  const globalMaxLevel = Math.max(...Array.from(level.values()), 0);

  // --- Step 2: Extract branches per root via DFS ---
  const allChains: Chain[] = [];
  const assignedIds = new Set<string>();

  roots.forEach(root => {
    // Collect all descendants of this root
    const subtreeIds = new Set<string>();
    const collectQueue = [root];
    while (collectQueue.length > 0) {
      const item = collectQueue.shift()!;
      subtreeIds.add(item.id);
      assignedIds.add(item.id);
      const children = childrenMap.get(item.id) || [];
      children.forEach(child => {
        if (!subtreeIds.has(child.id)) collectQueue.push(child);
      });
    }

    // DFS to extract branches
    const branches: Item[][] = [];

    function dfs(node: Item, currentBranch: Item[]) {
      currentBranch.push(node);
      const children = childrenMap.get(node.id) || [];

      if (children.length === 0) {
        branches.push([...currentBranch]);
      } else {
        dfs(children[0], currentBranch);
        for (let i = 1; i < children.length; i++) {
          dfs(children[i], []);
        }
      }
    }

    dfs(root, []);

    // Convert branches to Chains
    branches.forEach(branchItems => {
      const branchIds = new Set(branchItems.map(i => i.id));

      // Build levels array with global alignment
      const levels: Item[][] = Array.from({ length: globalMaxLevel + 1 }, () => []);
      branchItems.forEach(item => {
        levels[level.get(item.id)!].push(item);
      });

      // Remove trailing empty levels
      while (levels.length > 0 && levels[levels.length - 1].length === 0) {
        levels.pop();
      }

      // Build edges within this branch
      const branchEdges: ConnectorEdge[] = [];
      allHierarchyEdges.forEach(e => {
        if (branchIds.has(e.from) && branchIds.has(e.to)) {
          branchEdges.push({ from: e.from, to: e.to, type: 'hierarchy' });
        }
      });
      allRelEdges.forEach(e => {
        if (branchIds.has(e.from) && branchIds.has(e.to)) {
          branchEdges.push(e);
        }
      });

      allChains.push({ levels, edges: branchEdges });
    });
  });

  // Handle orphan items
  const orphans = items.filter(i => !assignedIds.has(i.id));
  orphans.forEach(item => {
    const levels: Item[][] = Array.from({ length: (level.get(item.id) || 0) + 1 }, () => []);
    levels[level.get(item.id) || 0] = [item];
    allChains.push({ levels, edges: [] });
    assignedIds.add(item.id);
  });

  // Separate: branches with >1 item or edges vs standalone single items
  const multiChains: Chain[] = [];
  const standaloneItems: Item[] = [];

  allChains.forEach(chain => {
    const totalItems = chain.levels.reduce((s, l) => s + l.length, 0);
    if (totalItems > 1 || chain.edges.length > 0) {
      multiChains.push(chain);
    } else {
      const firstItem = chain.levels.find(l => l.length > 0)?.[0];
      if (firstItem) standaloneItems.push(firstItem);
    }
  });

  return { chains: multiChains, standalone: standaloneItems };
}

// --- SVG connector drawing ---

interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'depends' | 'blocks' | 'hierarchy' | 'relates' | 'duplicates' | 'implements' | 'tests';
  relationId?: string;
  fromItemId?: string;
}

function SVGConnectors({ lines, onClickRelation }: { lines: ConnectorLine[]; onClickRelation?: (fromItemId: string, relationId: string) => void }) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%', zIndex: 0 }}
    >
      <defs>
        {[
          { id: 'arrow-depends', color: '#3b82f6' },
          { id: 'arrow-blocks', color: '#ef4444' },
          { id: 'arrow-hierarchy', color: '#9ca3af' },
          { id: 'arrow-relates', color: '#8b5cf6' },
          { id: 'arrow-duplicates', color: '#6b7280' },
          { id: 'arrow-implements', color: '#3b82f6' },
          { id: 'arrow-tests', color: '#22c55e' },
        ].map(m => (
          <marker
            key={m.id}
            id={m.id}
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth={m.id === 'arrow-hierarchy' ? 7 : 8}
            markerHeight={m.id === 'arrow-hierarchy' ? 5 : 6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 z" fill={m.color} />
          </marker>
        ))}
      </defs>
      {lines.map((line, i) => {
        const midX = (line.x1 + line.x2) / 2;
        const isHierarchy = line.type === 'hierarchy';
        const colorMap: Record<string, string> = {
          hierarchy: '#9ca3af',
          depends: '#3b82f6',
          blocks: '#ef4444',
          relates: '#8b5cf6',
          duplicates: '#6b7280',
          implements: '#3b82f6',
          tests: '#22c55e',
        };
        const color = colorMap[line.type] || '#8b5cf6';
        const markerId = `arrow-${line.type}`;
        const isClickable = !isHierarchy && line.relationId && onClickRelation;
        return (
          <g key={i}>
            {/* Invisible wider hit area for clickable relations */}
            {isClickable && (
              <path
                d={`M ${line.x1},${line.y1} C ${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`}
                stroke="transparent"
                strokeWidth={12}
                fill="none"
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Supprimer cette relation ?')) {
                    onClickRelation!(line.fromItemId!, line.relationId!);
                  }
                }}
              />
            )}
            <path
              d={`M ${line.x1},${line.y1} C ${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`}
              stroke={color}
              strokeWidth={isHierarchy ? 1.5 : 2}
              strokeDasharray={isHierarchy ? '4 3' : undefined}
              fill="none"
              markerEnd={`url(#${markerId})`}
              opacity={isHierarchy ? 0.5 : 0.7}
              className={isClickable ? 'pointer-events-auto cursor-pointer hover:opacity-100' : ''}
              onClick={isClickable ? (e) => {
                e.stopPropagation();
                if (confirm('Supprimer cette relation ?')) {
                  onClickRelation!(line.fromItemId!, line.relationId!);
                }
              } : undefined}
            />
          </g>
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
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
  canEdit = true,
}: SequenceViewProps) {
  // Link mode state
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
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

  // Compute hierarchy chains
  const { chains, standalone } = useMemo(() => {
    return computeHierarchyChains(items, relations || []);
  }, [items, relations]);

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

  // Handle card click in link mode
  const handleCardClick = useCallback(
    (itemId: string) => {
      if (linkMode) {
        if (!linkSource) {
          setLinkSource(itemId);
        } else if (linkSource !== itemId) {
          setPendingConnection({ source: linkSource, target: itemId });
          setLinkSource(null);
          setLinkMode(false);
        }
      } else {
        onEdit(itemId);
      }
    },
    [linkMode, linkSource, onEdit]
  );

  // Handle relation type selection
  const handleRelationTypeSelect = useCallback(
    (type: string) => {
      if (pendingConnection) {
        onCreateRelation?.(pendingConnection.source, pendingConnection.target, type);
        setPendingConnection(null);
      }
    },
    [pendingConnection, onCreateRelation]
  );

  // Card renderer (compact version for chains, full for standalone)
  const renderCard = useCallback(
    (item: Item, compact: boolean, ref?: (el: HTMLDivElement | null) => void) => {
      const Icon = TYPE_ICONS[item.type];
      const statusLabel = statusLabels[item.status || ''] || 'Non défini';
      const borderColor =
        statusBorderColors[item.status || 'none'] || statusBorderColors['none'];
      const isDone = item.status === doneStatusId;
      const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
      const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
      const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
      const isLinkSource = linkMode && linkSource === item.id;

      const itemDependsOn = dependsOnMap.get(item.id) || [];
      const itemBlocks = blocksMap.get(item.id) || [];
      const hasUnsatisfiedDeps = itemDependsOn.length > 0 && !isDone;

      return (
        <div
          key={item.id}
          ref={ref}
          data-item-id={item.id}
          className={`relative border-2 rounded-lg cursor-pointer hover:shadow-md transition-all group ${borderColor} ${
            isHighlighted && highlightColor ? `${highlightColor.border} ${highlightColor.bg} ring-1 ring-offset-1 scale-[1.02]` : ''
          } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''} ${
            hasUnsatisfiedDeps ? 'ring-1 ring-orange-300' : ''
          } ${isLinkSource ? 'ring-2 ring-purple-500 ring-offset-2 bg-purple-50' : ''} ${
            linkMode && !isLinkSource ? 'hover:ring-2 hover:ring-purple-300' : ''
          } ${compact ? 'p-3 w-52' : 'p-4 w-full max-w-md'}`}
          onClick={() => handleCardClick(item.id)}
        >
          <div className="flex items-start gap-2">
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />
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
              {!compact && item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url) && (
                <img src={item.url} alt="" className="w-full max-h-32 object-cover rounded border border-border mt-1.5" />
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

            {/* Action menu on hover */}
            {canEdit && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                        ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) }] : []),
                      ],
                    },
                    {
                      actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }],
                    },
                  ].filter(g => g.actions.length > 0)}
                />
              </div>
            )}
          </div>
        </div>
      );
    },
    [
      statusLabels,
      statusBorderColors,
      doneStatusId,
      highlightType,
      highlightStatus,
      highlightColor,
      dependsOnMap,
      blocksMap,
      handleCardClick,
      onDelete,
      onUpdateStatus,
      onAddChild,
      onMoveToSpace,
      onDuplicateToSpace,
      onConvertToSpace,
      linkMode,
      linkSource,
      canEdit,
    ]
  );

  const hasAnyChains = chains.length > 0;
  const hasRelations = relations && relations.length > 0;

  // Global card refs for cross-branch relation connectors
  const globalCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const globalContainerRef = useRef<HTMLDivElement>(null);
  const [globalLines, setGlobalLines] = useState<ConnectorLine[]>([]);

  // Build all relation edges for the global SVG overlay (with relationId for deletion)
  const allRelationEdges = useMemo(() => {
    if (!relations) return [];
    const ids = new Set(items.map(i => i.id));
    const edges: (ConnectorEdge & { relationId: string; originalFromItemId: string })[] = [];
    relations.forEach(rel => {
      if (!ids.has(rel.fromItemId) || !ids.has(rel.toItemId)) return;
      if (rel.type === 'depends') {
        edges.push({ from: rel.toItemId, to: rel.fromItemId, type: 'depends', relationId: rel.id, originalFromItemId: rel.fromItemId });
      } else if (rel.type === 'blocks') {
        edges.push({ from: rel.fromItemId, to: rel.toItemId, type: 'blocks', relationId: rel.id, originalFromItemId: rel.fromItemId });
      } else {
        // Other relation types (relates, duplicates, implements, tests)
        edges.push({ from: rel.fromItemId, to: rel.toItemId, type: rel.type as any, relationId: rel.id, originalFromItemId: rel.fromItemId });
      }
    });
    return edges;
  }, [relations, items]);

  // Compute global relation lines after layout
  const computeGlobalLines = useCallback(() => {
    if (!globalContainerRef.current || allRelationEdges.length === 0) return;
    const containerRect = globalContainerRef.current.getBoundingClientRect();
    const newLines: ConnectorLine[] = [];

    allRelationEdges.forEach(edge => {
      const fromEl = globalCardRefs.current.get(edge.from);
      const toEl = globalCardRefs.current.get(edge.to);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const x1 = fromRect.right - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.left - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;

      newLines.push({ x1, y1, x2, y2, type: edge.type, relationId: edge.relationId, fromItemId: edge.originalFromItemId });
    });

    setGlobalLines(newLines);
  }, [allRelationEdges]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(computeGlobalLines);
    });
  }, [computeGlobalLines, chains, standalone]);

  useEffect(() => {
    const handleResize = () => requestAnimationFrame(computeGlobalLines);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [computeGlobalLines]);

  // Ref callback for cards: register in global refs
  const registerCardRef = useCallback((itemId: string) => (el: HTMLDivElement | null) => {
    if (el) globalCardRefs.current.set(itemId, el);
    else globalCardRefs.current.delete(itemId);
  }, []);

  // Handle relation delete from SVG click
  const handleRelationClick = useCallback(
    (fromItemId: string, relationId: string) => {
      onDeleteRelation?.(fromItemId, relationId);
    },
    [onDeleteRelation]
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

  // Item title lookup for dialog
  const pendingSourceItem = pendingConnection ? items.find(i => i.id === pendingConnection.source) : null;
  const pendingTargetItem = pendingConnection ? items.find(i => i.id === pendingConnection.target) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar: Legend + Link mode */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          {(hasAnyChains || hasRelations) && (
            <>
              <div className="flex items-center gap-2">
                <svg width="40" height="12">
                  <line x1="0" y1="6" x2="32" y2="6" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
                  <polygon points="32,2 40,6 32,10" fill="#9ca3af" />
                </svg>
                <span>parent → enfant</span>
              </div>
              {hasRelations && (
                <>
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
                </>
              )}
            </>
          )}
        </div>

        {/* Link mode button */}
        {canEdit && onCreateRelation && (
          <div className="flex items-center gap-2">
            {linkMode && (
              <span className="text-xs text-purple-600 font-medium">
                {linkSource ? 'Cliquez sur la cible...' : 'Cliquez sur la source...'}
              </span>
            )}
            <Button
              variant={linkMode ? 'default' : 'outline'}
              size="sm"
              className={linkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
              onClick={() => {
                setLinkMode(!linkMode);
                setLinkSource(null);
              }}
              title="Créer une relation entre deux éléments"
            >
              <Link2 className="w-4 h-4 mr-1" />
              {linkMode ? 'Annuler' : 'Lier'}
            </Button>
          </div>
        )}
      </div>

      {/* All branches + global relation overlay */}
      <div ref={globalContainerRef} className="relative">
        {/* Hierarchy branches */}
        {chains.map((chain, chainIndex) => (
          <ChainRow
            key={chainIndex}
            chain={chain}
            renderCard={renderCard}
            chainIndex={chainIndex}
            registerCardRef={registerCardRef}
          />
        ))}

        {/* Standalone items - columnar layout */}
        {standalone.length > 0 && (
          <div className={hasAnyChains ? 'mt-6' : ''}>
            {hasAnyChains && (
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Éléments isolés
              </h3>
            )}
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[auto_1fr_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                <span className="w-4" />
                <span>Titre</span>
                <span className="text-center">Type</span>
                <span className="text-center">Statut</span>
                <span className="text-center">Info</span>
                <span className="w-20" />
              </div>
              {/* Rows */}
              <div className="divide-y divide-border">
                {standalone.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  const sLabel = statusLabels[item.status || ''] || 'Non défini';
                  const sBorderColor = statusBorderColors[item.status || 'none'] || statusBorderColors['none'];
                  const isDone = item.status === doneStatusId;
                  const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
                  const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
                  const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
                  const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                  const typeLabel = typeLabels[item.type]?.labelShort || item.type;

                  return (
                    <div
                      key={item.id}
                      ref={registerCardRef(item.id)}
                      data-item-id={item.id}
                      className={`grid grid-cols-[auto_1fr_5rem_6rem_5rem_auto] items-center gap-3 px-4 py-2.5 hover:bg-accent cursor-pointer group ${
                        isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''
                      } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''} ${
                        linkMode ? 'hover:ring-2 hover:ring-purple-300' : ''
                      }`}
                      onClick={() => handleCardClick(item.id)}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />

                      <span className="truncate">{item.title}</span>

                      <span className="flex justify-center">
                        <Badge variant="outline" className={`text-xs border ${getTypeColor(item.type, referentiels?.typeLabels).color}`}>
                          {typeLabel}
                        </Badge>
                      </span>

                      <span className="flex justify-center">
                        <Badge variant="secondary" className={`text-xs ${sBorderColor}`}>
                          {sLabel}
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
                                  ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) }] : []),
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
          </div>
        )}

        {/* Global relation connectors (cross-branch) - clickable for deletion */}
        <SVGConnectors lines={globalLines} onClickRelation={canEdit && onDeleteRelation ? handleRelationClick : undefined} />
      </div>

      {/* Relation type selection dialog */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Type de relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{pendingSourceItem?.title}</span>
              {' → '}
              <span className="font-medium">{pendingTargetItem?.title}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleRelationTypeSelect(type.id)}
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
                  title={type.description}
                >
                  <type.Icon className={`w-4 h-4 ${type.color}`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{type.label}</span>
                    <span className="text-[10px] text-muted-foreground">{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingConnection(null)}
              className="mt-4 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
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
  registerCardRef,
}: {
  chain: Chain;
  renderCard: (item: Item, compact: boolean, ref?: (el: HTMLDivElement | null) => void) => React.ReactNode;
  chainIndex: number;
  registerCardRef: (itemId: string) => (el: HTMLDivElement | null) => void;
}) {
  return (
    <div>
      {chainIndex > 0 && <div className="border-t border-dashed border-gray-200 mb-4" />}
      <div className="flex flex-row items-start gap-8 pb-2 min-w-min">
        {chain.levels.map((levelItems, levelIndex) => (
          <div
            key={levelIndex}
            className={`flex flex-col gap-3 min-w-[220px] ${
              levelItems.length === 0 ? 'h-0 overflow-hidden' : ''
            }`}
          >
            {levelItems.map(item =>
              renderCard(item, true, registerCardRef(item.id))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
