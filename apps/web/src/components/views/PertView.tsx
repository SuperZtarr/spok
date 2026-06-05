import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Ban, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { PertToolbar } from './PertToolbar';
import { type TreeSort, applyTreeSort } from '../../lib/treeSort';
import { RelationCommentIconSvg } from '../RelationCommentIcon';
import type { Item, ItemType, ItemRelation, SpaceReferentiels, MenuItemConfig } from '@spok/shared';
import type { ViewMode } from '../../stores/viewMode';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { buildTree, flattenTree } from './timeline-tree';
import { buildPertGraph, computePertRanks, computeCriticalPathNaive } from './pert-utils';
import { useCollapsedIds } from '../../lib/useCollapsedIds';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';

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
  spaceId?: string;
  spaceName?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string, label?: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
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
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  spaceViews?: MenuItemConfig[];
  allowedViews?: ViewMode[] | null;
  onSetMode?: (mode: ViewMode) => void;
  defaultView?: ViewMode;
  spaceRole?: string;
  onNewItem?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  totalItemCount?: number;
}

export function PertView({
  items,
  relations = [],
  spaceId,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  onCreateRelation,
  onDeleteRelation,
  onUpdateRelation,
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
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
  spaceName = '',
  spaceViews, allowedViews, onSetMode, defaultView,
  spaceRole, onNewItem, onStartTour, pulseHelp,
  filter = 'ALL', onFilterChange, statusFilter = 'ALL', onStatusFilterChange, totalItemCount,
}: PertViewProps) {
  const { collapsedIds, setCollapsedIds, toggleCollapse } = useCollapsedIds(spaceId ?? '');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [relationDrag, setRelationDrag] = useState<{
    fromItemId: string;
    fromX: number; fromY: number;
    currentX: number; currentY: number;
  } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [editingRelation, setEditingRelation] = useState<{
    relationId: string; fromItemId: string; toItemId: string;
    type: string; label: string; sourceName: string; targetName: string;
  } | null>(null);
  const [editRelationType, setEditRelationType] = useState<string>('');

  const [zoom, setZoom] = useState(1);
  const zoomIn = useCallback(() => setZoom(z => Math.min(3, parseFloat((z + 0.1).toFixed(2)))), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.25, parseFloat((z - 0.1).toFixed(2)))), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  useEscapeKey(() => setEditingRelation(null), !!editingRelation);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const svgScrollRef = useRef<HTMLDivElement>(null);
  const pertContainerRef = useRef<HTMLDivElement>(null);
  const pertSvgRef = useRef<SVGSVGElement>(null);

  // Ctrl+scroll to zoom
  useEffect(() => {
    const el = svgScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(z => Math.min(3, Math.max(0.25, parseFloat((z + delta).toFixed(2)))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const statusOptions = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;

  const [pertSortMode, setPertSortMode] = useState<'rank' | 'alpha'>('rank');
  const [treeSort, setTreeSort] = useState<TreeSort>('manual');
  const sortedItems = useMemo(() => applyTreeSort(items, treeSort), [items, treeSort]);

  const pertRelations = useMemo(
    () => relations.filter(r => r.type === 'blocks' || r.type === 'depends'),
    [relations]
  );

  const { predecessors, successors } = useMemo(
    () => buildPertGraph(sortedItems, pertRelations),
    [sortedItems, pertRelations]
  );

  const ranks = useMemo(
    () => computePertRanks(sortedItems, predecessors, successors),
    [sortedItems, predecessors, successors]
  );

  const criticalPathIds = useMemo(
    () => computeCriticalPathNaive(sortedItems, predecessors, successors),
    [sortedItems, predecessors, successors]
  );

  const pertSortFn = useMemo(
    () => (a: { id: string; title: string }, b: { id: string; title: string }) => {
      if (pertSortMode === 'alpha') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      const rankDiff = (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    },
    [ranks, pertSortMode]
  );

  const tree = useMemo(() => buildTree(sortedItems, pertSortFn), [sortedItems, pertSortFn]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  const parentIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: typeof tree) { for (const n of nodes) { if (n.children.length > 0) { ids.push(n.id); collect(n.children); } } }
    collect(tree);
    return ids;
  }, [tree]);

const rowIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [flatItems]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.parentId) map.set(item.id, item.parentId);
    }
    return map;
  }, [items]);

  // For each pertRelation, resolve endpoints to their visible ancestor when collapsed.
  // Self-loops and duplicates are filtered out.
  const effectiveRelations = useMemo(() => {
    function getVisibleAncestor(id: string): string | null {
      let cur: string | undefined = id;
      while (cur) {
        if (rowIndex.has(cur)) return cur;
        cur = parentMap.get(cur);
      }
      return null;
    }

    const seen = new Set<string>();
    const result: Array<{ rel: ItemRelation; visibleFrom: string; visibleTo: string; proxied: boolean }> = [];

    for (const rel of pertRelations) {
      let fromId: string;
      let toId: string;
      if (rel.type === 'blocks') { fromId = rel.fromItemId; toId = rel.toItemId; }
      else                        { fromId = rel.toItemId;   toId = rel.fromItemId; }

      const visibleFrom = getVisibleAncestor(fromId);
      const visibleTo   = getVisibleAncestor(toId);

      if (!visibleFrom || !visibleTo) continue;
      if (visibleFrom === visibleTo) continue;

      const key = `${visibleFrom}:${visibleTo}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({ rel, visibleFrom, visibleTo, proxied: visibleFrom !== fromId || visibleTo !== toId });
    }

    return result;
  }, [pertRelations, rowIndex, parentMap]);

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
      x: (e.clientX - rect.left + container.scrollLeft) / zoom,
      y: (e.clientY - rect.top  + container.scrollTop)  / zoom,
    };
  }, [zoom]);

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
      onCreateRelation?.(pendingConnection.source, pendingConnection.target, type, pendingLabel || undefined);
      setPendingConnection(null);
      setPendingLabel('');
    }
  }, [pendingConnection, pendingLabel, onCreateRelation]);

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

  function renderArrow(
    { rel, visibleFrom, visibleTo, proxied }: { rel: ItemRelation; visibleFrom: string; visibleTo: string; proxied: boolean },
    key: string,
  ) {
    const x1 = nodeX(visibleFrom) + NODE_WIDTH;
    const y1 = nodeY(visibleFrom) + NODE_HEIGHT / 2;
    const x2 = nodeX(visibleTo);
    const y2 = nodeY(visibleTo) + NODE_HEIGHT / 2;
    const cpOffset = Math.abs(x2 - x1) * 0.4;

    const isCritical = !proxied && criticalPathIds.has(visibleFrom) && criticalPathIds.has(visibleTo);
    const stroke = isCritical ? '#f97316' : '#94a3b8';
    const strokeWidth = isCritical ? 2.5 : 1.5;

    const pathD = `M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}`;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const fromItem = items.find(i => i.id === rel.fromItemId);
    const toItem = items.find(i => i.id === rel.toItemId);
    return (
      <g key={key}>
        <path
          d={pathD}
          fill="none" stroke={stroke} strokeWidth={strokeWidth}
          markerEnd={`url(#arrow-${isCritical ? 'critical' : 'normal'})`}
          strokeDasharray={proxied ? '5 3' : undefined}
        />
        {!proxied && canEdit && (onDeleteRelation || onUpdateRelation) && (
          <path
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth={12}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={() => {
              const sourceItem = items.find(i => i.id === rel.fromItemId);
              const targetItem = items.find(i => i.id === rel.toItemId);
              setEditingRelation({
                relationId: rel.id,
                fromItemId: rel.fromItemId,
                toItemId: rel.toItemId,
                type: rel.type,
                label: rel.label || '',
                sourceName: sourceItem?.title || '',
                targetName: targetItem?.title || '',
              });
              setEditRelationType(rel.type);
            }}
          >
            <title>Cliquer pour modifier</title>
          </path>
        )}
        {rel.label && !proxied && (
          <RelationCommentIconSvg
            x={mx} y={my}
            label={rel.label}
            relationType={rel.type}
            fromTitle={fromItem?.title || rel.fromItemId}
            toTitle={toItem?.title || rel.toItemId}
          />
        )}
      </g>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border rounded-lg" ref={pertContainerRef}>
      <PertToolbar
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        hasParents={parentIds.length > 0}
        hasCollapsed={collapsedIds.size > 0}
        onCollapseAll={() => setCollapsedIds(new Set(parentIds))}
        onExpandAll={() => setCollapsedIds(new Set())}
        items={items}
        spaceName={spaceName}
        containerRef={pertContainerRef}
        svgRef={pertSvgRef}
        sortMode={pertSortMode}
        onSortModeChange={setPertSortMode}
        treeSort={treeSort}
        onTreeSortChange={setTreeSort}
        spaceViews={spaceViews}
        allowedViews={allowedViews}
        onSetMode={onSetMode}
        defaultView={defaultView}
        onNewItem={onNewItem}
        canEdit={canEdit}
        spaceId={spaceId}
        spaceRole={spaceRole}
        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
        filter={filter}
        onFilterChange={onFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        totalItemCount={totalItemCount}
        referentiels={referentiels}
      />
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel — tree */}
      <div
        className="flex-shrink-0 border-r overflow-y-auto overflow-x-hidden"
        style={{ width: LEFT_PANEL_WIDTH }}
        ref={scrollContainerRef}
        onScroll={(e) => { if (svgScrollRef.current) svgScrollRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop * zoom; }}
      >
        {flatItems.map((item) => {
          const hasChildren = item.children.length > 0;
          const isCollapsed = collapsedIds.has(item.id);
          const Icon = getTypeIcon(item.type as ItemType, item.url);
          const canEditThis = canEditItem ? canEditItem(item) : canEdit ?? true;
          const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
          const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
          const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
          return (
            <div
              key={item.id}
              className={`group flex items-center gap-1 border-b border-border/50 hover:bg-muted/50 cursor-pointer ${isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''} ${isSearchMatch ? 'ring-2 ring-inset ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''}`}
              style={{ height: ROW_HEIGHT, paddingLeft: `${8 + item.depth * 20}px` }}
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
              ) : <span className="w-5 flex-shrink-0" />}
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-sm flex-1 pr-1">{item.title}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pr-1">
                <ItemActionMenu
                  groups={buildItemMenuGroups(item.id, {
                    onEdit, onDelete, onUpdateStatus, onAddChild,
                    onMoveToSpace, onDuplicateToSpace, onConvertToSpace,
                    onSelfAssign, onMerge, onAbsorbChildren,
                    onSplitDescription: onSplitDescription && hasHeadings(item.description) ? onSplitDescription : undefined,
                    onOpen, onOpenInNewTab,
                  }, {
                    canEdit: canEditThis,
                    statusOptions,
                    currentStatusId: item.status || undefined,
                  })}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Right panel — PERT SVG */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={svgScrollRef}
          className="w-full h-full overflow-auto"
          style={{ cursor: relationDrag ? 'crosshair' : undefined }}
          onScroll={(e) => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop / zoom; }}
        >
        {flatItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun item dans cet espace</div>
        ) : (
          <div style={{ width: svgWidth * zoom, height: Math.max(svgHeight, 100) * zoom, position: 'relative', flexShrink: 0 }}>
          <svg ref={pertSvgRef} width={svgWidth} height={Math.max(svgHeight, 100)} style={{ transformOrigin: 'top left', transform: `scale(${zoom})`, position: 'absolute', top: 0, left: 0, display: 'block' }}>
            <defs>
              <marker id="arrow-normal"   markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" /></marker>
              <marker id="arrow-critical" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#f97316" /></marker>
            </defs>

            {effectiveRelations.map((er, i) => renderArrow(er, `rel-${i}`))}

            {flatItems.map((item) => {
              const x = nodeX(item.id);
              const y = nodeY(item.id);
              const isCritical = criticalPathIds.has(item.id);
              const isDragTarget = dragTargetId === item.id;
              const Icon = getTypeIcon(item.type as ItemType, item.url);
              const showHandle = canEdit && onCreateRelation && (hoveredNodeId === item.id) && !relationDrag;
              const nodeIsHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
              const nodeIsDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
              const nodeIsSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));

              return (
                <g
                  key={item.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: relationDrag ? 'crosshair' : 'pointer', opacity: nodeIsDimmed ? 0.3 : 1 }}
                  onClick={() => { if (!relationDrag) onEdit(item.id); }}
                  onMouseEnter={() => setHoveredNodeId(item.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <title>{item.title}</title>
                  <rect
                    width={NODE_WIDTH} height={NODE_HEIGHT} rx={4}
                    className={
                      isDragTarget
                        ? 'fill-primary/10 stroke-primary'
                        : nodeIsSearchMatch
                          ? 'fill-yellow-50 dark:fill-yellow-950/30 stroke-yellow-400'
                          : nodeIsHighlighted && highlightColor
                            ? `stroke-current`
                            : isCritical
                              ? 'fill-orange-50 dark:fill-orange-950/30 stroke-orange-400'
                              : 'fill-background stroke-border'
                    }
                    strokeWidth={isDragTarget ? 2 : nodeIsSearchMatch ? 2 : nodeIsHighlighted ? 2 : isCritical ? 2 : 1}
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
          </div>
        )}
        </div>

      </div>

      {/* Edit relation dialog */}
      {editingRelation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold mb-1">Modifier la relation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              <span className="font-medium">{editingRelation.sourceName}</span>
              {' → '}
              <span className="font-medium">{editingRelation.targetName}</span>
            </p>
            <div className="grid grid-cols-1 gap-2 mb-3">
              {PERT_RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEditRelationType(type.id)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${
                    editRelationType === type.id ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/30' : 'hover:bg-purple-50 hover:border-purple-300'
                  }`}
                >
                  <type.Icon className={`w-4 h-4 ${type.color}`} />
                  <div>
                    <span className="text-sm font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <textarea
              value={editingRelation.label}
              onChange={(e) => setEditingRelation({ ...editingRelation, label: e.target.value })}
              placeholder="Justification de la relation (optionnel)"
              rows={2}
              className="w-full text-sm px-3 py-1.5 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring mb-3"
            />
            <div className="flex gap-2">
              {onUpdateRelation && (
                <button
                  onClick={() => {
                    onUpdateRelation(editingRelation.fromItemId, editingRelation.relationId, { type: editRelationType, label: editingRelation.label || null });
                    setEditingRelation(null);
                  }}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
                >
                  Enregistrer
                </button>
              )}
              {onDeleteRelation && (
                <button
                  onClick={() => {
                    onDeleteRelation(editingRelation.fromItemId, editingRelation.relationId);
                    setEditingRelation(null);
                  }}
                  className="px-3 py-2 bg-destructive text-destructive-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
                >
                  Supprimer
                </button>
              )}
              <button
                onClick={() => setEditingRelation(null)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</label>
              <textarea
                value={pendingLabel}
                onChange={e => setPendingLabel(e.target.value)}
                placeholder="Décrivez cette relation…"
                rows={2}
                className="w-full text-sm border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
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
            {pendingLabel && (
              <button
                onClick={() => handleRelationTypeSelect('relates')}
                className="mt-2 w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Créer avec type par défaut
              </button>
            )}
            <button onClick={() => { setPendingConnection(null); setPendingLabel(''); }} className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
