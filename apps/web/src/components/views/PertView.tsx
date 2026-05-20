import { useMemo, useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups } from '../../lib/itemMenuGroups';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { buildTree, flattenTree } from './timeline-tree';
import { buildPertGraph, computePertRanks, computeCriticalPathNaive } from './pert-utils';

const LEFT_PANEL_WIDTH = 288;
const ROW_HEIGHT = 36;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 28;
const COLUMN_WIDTH = 220;
const H_PADDING = 24;
const V_PADDING = 4;

interface PertViewProps {
  items: Item[];
  relations?: ItemRelation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
}

export function PertView({
  items,
  relations = [],
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen,
  onOpenInNewTab,
  referentiels,
  canEdit,
  canEditItem,
}: PertViewProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const statusOptions = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;

  const tree = useMemo(() => buildTree(items), [items]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pertRelations = useMemo(
    () => relations.filter(r => r.type === 'blocks' || r.type === 'depends'),
    [relations]
  );

  const { predecessors, successors } = useMemo(
    () => buildPertGraph(items, pertRelations),
    [items, pertRelations]
  );

  const ranks = useMemo(
    () => computePertRanks(items, predecessors, successors),
    [items, predecessors, successors]
  );

  const criticalPathIds = useMemo(
    () => computeCriticalPathNaive(items, predecessors, successors),
    [items, predecessors, successors]
  );

  const rowIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [flatItems]);

  const maxRank = useMemo(() => {
    let max = 0;
    for (const item of flatItems) {
      const r = ranks.get(item.id) ?? 0;
      if (r > max) max = r;
    }
    return max;
  }, [flatItems, ranks]);

  const svgWidth = (maxRank + 1) * COLUMN_WIDTH + H_PADDING * 2 + NODE_WIDTH;
  const svgHeight = flatItems.length * ROW_HEIGHT;

  function nodeX(id: string) {
    const rank = ranks.get(id) ?? 0;
    return H_PADDING + rank * COLUMN_WIDTH;
  }

  function nodeY(id: string) {
    const row = rowIndex.get(id) ?? 0;
    return row * ROW_HEIGHT + V_PADDING;
  }

  function renderArrow(rel: ItemRelation, key: string) {
    let fromId: string;
    let toId: string;
    if (rel.type === 'blocks') {
      fromId = rel.fromItemId;
      toId = rel.toItemId;
    } else {
      fromId = rel.toItemId;
      toId = rel.fromItemId;
    }

    if (!rowIndex.has(fromId) || !rowIndex.has(toId)) return null;

    const x1 = nodeX(fromId) + NODE_WIDTH;
    const y1 = nodeY(fromId) + NODE_HEIGHT / 2;
    const x2 = nodeX(toId);
    const y2 = nodeY(toId) + NODE_HEIGHT / 2;
    const cpOffset = Math.abs(x2 - x1) * 0.4;

    const isCritical = criticalPathIds.has(fromId) && criticalPathIds.has(toId);
    const stroke = isCritical ? '#f97316' : '#94a3b8';
    const strokeWidth = isCritical ? 2.5 : 1.5;

    return (
      <path
        key={key}
        d={`M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd={`url(#arrow-${isCritical ? 'critical' : 'normal'})`}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden border rounded-lg">
      {/* Left panel — tree */}
      <div
        className="flex-shrink-0 border-r overflow-y-auto overflow-x-hidden"
        style={{ width: LEFT_PANEL_WIDTH }}
        ref={scrollContainerRef}
        onScroll={(e) => {
          const svgScroll = document.getElementById('pert-svg-scroll');
          if (svgScroll) svgScroll.scrollTop = (e.target as HTMLDivElement).scrollTop;
        }}
      >
        {flatItems.map((item) => {
          const hasChildren = item.children.length > 0;
          const isCollapsed = collapsedIds.has(item.id);
          const Icon = getTypeIcon(item.type as ItemType, item.url);

          const menuGroups = buildItemMenuGroups(
            item.id,
            {
              onEdit,
              onDelete,
              onUpdateStatus,
              onAddChild,
              onMoveToSpace,
              onDuplicateToSpace,
              onConvertToSpace,
              onSelfAssign,
              onMerge,
              onAbsorbChildren,
              onSplitDescription,
              onOpen,
              onOpenInNewTab,
            },
            {
              statusOptions,
              currentStatusId: item.status || undefined,
              canEdit: !!(canEdit && canEditItem?.(item)),
            }
          );

          return (
            <div
              key={item.id}
              className="group flex items-center gap-1 border-b border-border/50 hover:bg-muted/50 cursor-pointer"
              style={{
                height: ROW_HEIGHT,
                paddingLeft: `${8 + item.depth * 20}px`,
              }}
              onClick={() => onEdit(item.id)}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
                  className="p-0.5 hover:bg-muted rounded flex-shrink-0"
                >
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              ) : (
                <span className="w-5 flex-shrink-0" />
              )}
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-sm flex-1 pr-1">{item.title}</span>
              <ItemActionMenu groups={menuGroups} />
            </div>
          );
        })}
      </div>

      {/* Right panel — PERT SVG */}
      <div
        id="pert-svg-scroll"
        className="flex-1 overflow-auto"
        onScroll={(e) => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
          }
        }}
      >
        {flatItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Aucun item dans cet espace
          </div>
        ) : (
          <svg
            width={svgWidth}
            height={Math.max(svgHeight, 100)}
            className="block"
          >
            <defs>
              <marker id="arrow-normal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
              </marker>
              <marker id="arrow-critical" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
              </marker>
            </defs>
            {pertRelations.map((rel, i) => renderArrow(rel, `rel-${i}`))}
            {flatItems.map((item) => {
              const x = nodeX(item.id);
              const y = nodeY(item.id);
              const isCritical = criticalPathIds.has(item.id);
              const Icon = getTypeIcon(item.type as ItemType, item.url);

              return (
                <g
                  key={item.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onEdit(item.id)}
                >
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={4}
                    className={isCritical
                      ? 'fill-orange-50 dark:fill-orange-950/30 stroke-orange-400'
                      : 'fill-background stroke-border'}
                    strokeWidth={isCritical ? 2 : 1}
                  />
                  <foreignObject x={4} y={2} width={NODE_WIDTH - 8} height={NODE_HEIGHT - 4}>
                    <div className="flex items-center gap-1 h-full overflow-hidden">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs truncate">{item.title}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
