import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Ban, ArrowLeft } from 'lucide-react';
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

const PERT_RELATION_TYPES = [
  { id: 'blocks',  label: 'Bloque',     Icon: Ban,       description: 'A doit être terminé avant B', color: 'text-red-500'    },
  { id: 'depends', label: 'Dépend de',  Icon: ArrowLeft, description: 'A nécessite B pour avancer',  color: 'text-orange-500' },
];

interface PertViewProps {
  items: Item[];
  relations?: ItemRelation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string) => void;
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
  onCreateRelation,
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [relationDrag, setRelationDrag] = useState<{
    fromItemId: string;
    fromX: number; fromY: number;
    currentX: number; currentY: number;
  } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const svgScrollRef = useRef<HTMLDivElement>(null);

  const statusOptions = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;

  const tree = useMemo(() => buildTree(items), [items]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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

  function nodeX(id: string) { return H_PADDING + (ranks.get(id) ?? 0) * COLUMN_WIDTH; }
  function nodeY(id: string) { return (rowIndex.get(id) ?? 0) * ROW_HEIGHT + V_PADDING; }

  // ── Relation drag ──────────────────────────────────────────────

  const getSvgCoords = useCallback((e: MouseEvent) => {
    const container = svgScrollRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + container.scrollLeft,
      y: e.clientY - rect.top  + container.scrollTop,
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const fx = nodeX(itemId) + NODE_WIDTH;
    const fy = nodeY(itemId) + NODE_HEIGHT / 2;
    setRelationDrag({ fromItemId: itemId, fromX: fx, fromY: fy, currentX: fx, currentY: fy });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatItems, ranks, rowIndex]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!relationDrag) return;
    const { x, y } = getSvgCoords(e);
    setRelationDrag(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  }, [relationDrag, getSvgCoords]);

  const handleDragEnd = useCallback((e: MouseEvent) => {
    if (!relationDrag || !onCreateRelation) { setRelationDrag(null); return; }
    const { x, y } = getSvgCoords(e);
    // Find target node under cursor
    const target = flatItems.find(item => {
      const nx = nodeX(item.id);
      const ny = nodeY(item.id);
      return x >= nx && x <= nx + NODE_WIDTH && y >= ny && y <= ny + NODE_HEIGHT;
    });
    if (target && target.id !== relationDrag.fromItemId) {
      setPendingConnection({ source: relationDrag.fromItemId, target: target.id });
    }
    setRelationDrag(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationDrag, flatItems, ranks, rowIndex, getSvgCoords, onCreateRelation]);

  useEffect(() => {
    if (!relationDrag) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [relationDrag, handleDragMove, handleDragEnd]);

  const handleRelationTypeSelect = useCallback((type: string) => {
    if (pendingConnection) {
      onCreateRelation?.(pendingConnection.source, pendingConnection.target, type);
      setPendingConnection(null);
    }
  }, [pendingConnection, onCreateRelation]);

  const pendingSourceItem = pendingConnection ? items.find(i => i.id === pendingConnection.source) : null;
  const pendingTargetItem = pendingConnection ? items.find(i => i.id === pendingConnection.target) : null;

  // Detect node under cursor during drag (for highlight)
  const dragTargetId = relationDrag ? (flatItems.find(item => {
    const nx = nodeX(item.id);
    const ny = nodeY(item.id);
    return relationDrag.currentX >= nx && relationDrag.currentX <= nx + NODE_WIDTH
      && relationDrag.currentY >= ny && relationDrag.currentY <= ny + NODE_HEIGHT;
  })?.id ?? null) : null;

  // ── Arrow rendering ────────────────────────────────────────────

  function renderArrow(rel: ItemRelation, key: string) {
    let fromId: string;
    let toId: string;
    if (rel.type === 'blocks') { fromId = rel.fromItemId; toId = rel.toItemId; }
    else                        { fromId = rel.toItemId;   toId = rel.fromItemId; }

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
        fill="none" stroke={stroke} strokeWidth={strokeWidth}
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
        onScroll={(e) => { if (svgScrollRef.current) svgScrollRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop; }}
      >
        {flatItems.map((item) => {
          const hasChildren = item.children.length > 0;
          const isCollapsed = collapsedIds.has(item.id);
          const Icon = getTypeIcon(item.type as ItemType, item.url);
          const menuGroups = buildItemMenuGroups(
            item.id,
            { onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab },
            { statusOptions, currentStatusId: item.status || undefined, canEdit: !!(canEdit && canEditItem?.(item)) }
          );
          return (
            <div
              key={item.id}
              className="group flex items-center gap-1 border-b border-border/50 hover:bg-muted/50 cursor-pointer"
              style={{ height: ROW_HEIGHT, paddingLeft: `${8 + item.depth * 20}px` }}
              onClick={() => onEdit(item.id)}
            >
              {hasChildren ? (
                <button onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }} className="p-0.5 hover:bg-muted rounded flex-shrink-0">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              ) : <span className="w-5 flex-shrink-0" />}
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-sm flex-1 pr-1">{item.title}</span>
              <ItemActionMenu groups={menuGroups} />
            </div>
          );
        })}
      </div>

      {/* Right panel — PERT SVG */}
      <div
        ref={svgScrollRef}
        className="flex-1 overflow-auto"
        style={{ cursor: relationDrag ? 'crosshair' : undefined }}
        onScroll={(e) => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop; }}
      >
        {flatItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun item dans cet espace</div>
        ) : (
          <svg width={svgWidth} height={Math.max(svgHeight, 100)} className="block">
            <defs>
              <marker id="arrow-normal"   markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" /></marker>
              <marker id="arrow-critical" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#f97316" /></marker>
            </defs>

            {pertRelations.map((rel, i) => renderArrow(rel, `rel-${i}`))}

            {flatItems.map((item) => {
              const x = nodeX(item.id);
              const y = nodeY(item.id);
              const isCritical = criticalPathIds.has(item.id);
              const isDragTarget = dragTargetId === item.id;
              const Icon = getTypeIcon(item.type as ItemType, item.url);
              const showHandle = canEdit && onCreateRelation && (hoveredNodeId === item.id) && !relationDrag;

              return (
                <g
                  key={item.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: relationDrag ? 'crosshair' : 'pointer' }}
                  onClick={() => { if (!relationDrag) onEdit(item.id); }}
                  onMouseEnter={() => setHoveredNodeId(item.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <rect
                    width={NODE_WIDTH} height={NODE_HEIGHT} rx={4}
                    className={
                      isDragTarget
                        ? 'fill-primary/10 stroke-primary'
                        : isCritical
                          ? 'fill-orange-50 dark:fill-orange-950/30 stroke-orange-400'
                          : 'fill-background stroke-border'
                    }
                    strokeWidth={isDragTarget ? 2 : isCritical ? 2 : 1}
                  />
                  <foreignObject x={4} y={2} width={NODE_WIDTH - 8} height={NODE_HEIGHT - 4}>
                    <div className="flex items-center gap-1 h-full overflow-hidden">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs truncate">{item.title}</span>
                    </div>
                  </foreignObject>

                  {/* Relation handle — right edge of node */}
                  {showHandle && (
                    <circle
                      cx={NODE_WIDTH} cy={NODE_HEIGHT / 2} r={6}
                      className="fill-primary stroke-white"
                      strokeWidth={2}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => handleDragStart(e, item.id)}
                    />
                  )}
                </g>
              );
            })}

            {/* Drag line */}
            {relationDrag && (
              <>
                <line
                  x1={relationDrag.fromX} y1={relationDrag.fromY}
                  x2={relationDrag.currentX} y2={relationDrag.currentY}
                  stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" opacity={0.8}
                />
                <circle cx={relationDrag.fromX} cy={relationDrag.fromY} r={4} fill="hsl(var(--primary))" />
                {dragTargetId && (
                  <circle cx={relationDrag.currentX} cy={relationDrag.currentY} r={6} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} opacity={0.8} />
                )}
              </>
            )}
          </svg>
        )}
      </div>

      {/* Relation type selection modal */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-lg shadow-xl p-4 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold mb-1">Type de relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{pendingSourceItem?.title}</span>
              {' → '}
              <span className="font-medium">{pendingTargetItem?.title}</span>
            </p>
            <div className="flex flex-col gap-2">
              {PERT_RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleRelationTypeSelect(type.id)}
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors text-left"
                  title={type.description}
                >
                  <type.Icon className={`w-4 h-4 ${type.color}`} />
                  <div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setPendingConnection(null)} className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
