/**
 * PertView — Réseau PERT (dépendances/jalons) affiché comme diagramme + panneau arborescence à gauche.
 * Panneau gauche : lignes via TreeItemRow (composant partagé avec le Gantt, variant "sticky" par défaut).
 * Pas de drag & drop de réorganisation ici (onMove non câblé) — le tri est géré par PertToolbar (rang/alpha).
 */
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Ban, ArrowRight, Link2, ChevronDown, ChevronRight } from 'lucide-react';
import { PertToolbar } from './PertToolbar';
import { type TreeSort, applyTreeSort } from '../../lib/treeSort';
import { RelationCommentIconSvg } from '../RelationCommentIcon';
import type { Item, ItemType, ItemRelation, SpaceReferentiels, MenuItemConfig, StatusConfig } from '@spok/shared';
import type { ViewMode } from '../../stores/viewMode';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { buildTree, flattenTree } from './timeline-tree';
import { tailwindBgToHex } from './mindmap-utils';
import { buildPertGraph, computeCriticalPathNaive } from './pert-utils';
import { useCollapsedIds } from '../../lib/useCollapsedIds';
import { TreeItemRow } from './TreeItemRow';

const LEFT_PANEL_WIDTH = 288;
const ROW_HEIGHT = 36;
const SPACE_HEADER_HEIGHT = 32;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 28;
const COLUMN_WIDTH = 220;
const H_PADDING = 24;
const V_PADDING = 4;

const SPACE_COLORS = [
  { fill: 'rgba(99,102,241,0.06)',  stroke: 'rgba(99,102,241,0.30)',  text: 'rgba(99,102,241,0.75)'  },
  { fill: 'rgba(16,185,129,0.06)',  stroke: 'rgba(16,185,129,0.30)',  text: 'rgba(16,185,129,0.75)'  },
  { fill: 'rgba(245,158,11,0.06)',  stroke: 'rgba(245,158,11,0.30)',  text: 'rgba(245,158,11,0.75)'  },
  { fill: 'rgba(239,68,68,0.06)',   stroke: 'rgba(239,68,68,0.30)',   text: 'rgba(239,68,68,0.75)'   },
  { fill: 'rgba(168,85,247,0.06)',  stroke: 'rgba(168,85,247,0.30)',  text: 'rgba(168,85,247,0.75)'  },
];

const PERT_RELATION_TYPES = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        hexColor: '#ef4444', tailwindColor: 'text-red-500',   selectedClass: 'bg-red-50   border-red-400   dark:bg-red-950/30',   hoverClass: 'hover:bg-red-50   hover:border-red-300'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, hexColor: '#22c55e', tailwindColor: 'text-green-500', selectedClass: 'bg-green-50 border-green-400 dark:bg-green-950/30', hoverClass: 'hover:bg-green-50 hover:border-green-300' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      hexColor: '#3b82f6', tailwindColor: 'text-blue-500',  selectedClass: 'bg-blue-50  border-blue-400  dark:bg-blue-950/30',  hoverClass: 'hover:bg-blue-50  hover:border-blue-300'  },
] as const;

const RELATION_HEX: Record<string, string> = {
  blocks: '#ef4444',
  implements: '#22c55e',
  relates: '#3b82f6',
};
function getRelationColor(type: string): string {
  return RELATION_HEX[type] ?? '#94a3b8';
}
function ItemChip({ name, status, statusOptions, borderColor }: {
  name: string;
  status?: string | null;
  statusOptions: StatusConfig[];
  borderColor?: string;
}) {
  const statusColor = statusOptions.find(s => s.id === status)?.color ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`block w-full rounded px-2 py-0.5 text-xs font-semibold break-words ${statusColor}`}
      style={{ border: `1.5px solid ${borderColor ?? '#d1d5db'}` }}
    >
      {name}
    </span>
  );
}
function RelationRow({ typeId, sourceName, targetName, sourceStatus, targetStatus, statusOptions }: {
  typeId: string;
  sourceName: string;
  targetName: string;
  sourceStatus?: string | null;
  targetStatus?: string | null;
  statusOptions: StatusConfig[];
}) {
  const borderColor = RELATION_HEX[typeId] ?? '#94a3b8';
  const [item1, verb, item2, s1, s2]: [string, string, string, string | null | undefined, string | null | undefined] = (() => {
    switch (typeId) {
      case 'blocks':     return [sourceName, 'bloque',    targetName, sourceStatus, targetStatus];
      case 'implements': return [sourceName, 'permet',    targetName, sourceStatus, targetStatus];
      case 'relates':    return [sourceName, 'est lié à', targetName, sourceStatus, targetStatus];
      default:           return [sourceName, '→',         targetName, sourceStatus, targetStatus];
    }
  })();
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="w-[42%] flex-shrink-0"><ItemChip name={item1} status={s1} statusOptions={statusOptions} borderColor={borderColor} /></div>
      <div className="w-[20%] flex-shrink-0 text-center">
        <span className="text-xs font-bold text-foreground whitespace-nowrap">{verb}</span>
      </div>
      <div className="flex-1 min-w-0"><ItemChip name={item2} status={s2} statusOptions={statusOptions} borderColor={borderColor} /></div>
    </div>
  );
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  parentSpaceId?: string | null;
  items: Item[];
}

interface PertViewProps {
  items: Item[];
  relations?: ItemRelation[];
  spaceId?: string;
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  spaceName?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string, label?: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
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
  treeSort?: TreeSort;
  onTreeSortChange?: (sort: TreeSort) => void;
}

export function PertView({
  items,
  relations = [],
  spaceId,
  currentSpaceId,
  portalGroups,
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
  spaceViews: _spaceViews, allowedViews: _allowedViews, onSetMode: _onSetMode, defaultView: _defaultView,
  spaceRole: _spaceRole, onNewItem, onStartTour, pulseHelp,
  treeSort: treeSortProp,
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
  const [collapsedSpaces, setCollapsedSpaces] = React.useState<Set<string>>(new Set());
  const toggleSpaceCollapse = React.useCallback((sid: string) => {
    setCollapsedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  const [localTreeSort] = useState<TreeSort>('manual');
  const treeSort = treeSortProp ?? localTreeSort;
  const [activeRelFilters, setActiveRelFilters] = useState<Set<string>>(new Set());
  const [pertRankSort, setPertRankSort] = useState(false);

  const pertRelations = useMemo(
    () => relations.filter(r => r.type === 'blocks' || r.type === 'implements' || r.type === 'relates'),
    [relations]
  );

  // Rangs calculés depuis les items bruts — indépendant de sortedItems pour éviter la circularité
  const rawRanks = useMemo(() => {
    const idSet = new Set(items.map(i => i.id));
    const parentMap = new Map(items.map(i => [i.id, i.parentId]));
    const pertPreds = new Map<string, string[]>();
    for (const rel of pertRelations) {
      let predId: string, succId: string;
      if (rel.type === 'blocks' || rel.type === 'implements') { predId = rel.fromItemId; succId = rel.toItemId; }
      else { predId = rel.toItemId; succId = rel.fromItemId; }
      if (idSet.has(predId) && idSet.has(succId)) {
        if (!pertPreds.has(succId)) pertPreds.set(succId, []);
        pertPreds.get(succId)!.push(predId);
      }
    }
    const rank = new Map<string, number>();
    const inStack = new Set<string>();
    function assignRank(id: string): number {
      if (rank.has(id)) return rank.get(id)!;
      if (inStack.has(id)) return 0;
      inStack.add(id);
      let r = 0;
      for (const predId of (pertPreds.get(id) ?? [])) r = Math.max(r, assignRank(predId) + 1);
      const parentId = parentMap.get(id);
      if (parentId && idSet.has(parentId)) r = Math.max(r, assignRank(parentId));
      inStack.delete(id);
      rank.set(id, r);
      return r;
    }
    for (const item of items) assignRank(item.id);
    return rank;
  }, [items, pertRelations]);

  // IDs des items impliqués dans les types de relation actifs + leurs ancêtres
  const filteredRelItemIds = useMemo(() => {
    if (activeRelFilters.size === 0) return null;
    const direct = new Set<string>();
    for (const r of relations) {
      if (activeRelFilters.has(r.type)) {
        direct.add(r.fromItemId);
        direct.add(r.toItemId);
      }
    }
    // Remonter les ancêtres pour conserver l'arborescence
    const parentMap = new Map(items.map(i => [i.id, i.parentId]));
    const ids = new Set<string>(direct);
    for (const id of direct) {
      let cur = parentMap.get(id);
      while (cur) { ids.add(cur); cur = parentMap.get(cur); }
    }
    return ids;
  }, [relations, activeRelFilters, items]);

  const toggleRelFilter = (type: string) => {
    setActiveRelFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const sortedItems = useMemo(() => {
    const filtered = filteredRelItemIds
      ? items.filter(i => filteredRelItemIds.has(i.id))
      : items;
    const sorted = pertRankSort
      ? [...filtered].sort((a, b) => {
          const rd = (rawRanks.get(a.id) ?? 0) - (rawRanks.get(b.id) ?? 0);
          return rd !== 0 ? rd : a.title.localeCompare(b.title);
        })
      : applyTreeSort(filtered, treeSort);
    if (!portalGroups?.length || !currentSpaceId) return sorted;
    // Reorder root-level items: current space first, then portal groups in order
    // Use effective roots = items whose parent is not in the list (same logic as buildTree)
    const portalOrder = portalGroups.map(g => g.spaceId);
    const sortedIds = new Set(sorted.map(i => i.id));
    const rootIds = new Set(sorted.filter(i => !i.parentId || !sortedIds.has(i.parentId)).map(i => i.id));
    const bySpace = new Map<string, Item[]>();
    for (const item of sorted) {
      if (!rootIds.has(item.id)) continue;
      const sid = item.spaceId ?? currentSpaceId;
      const arr = bySpace.get(sid) ?? [];
      arr.push(item);
      bySpace.set(sid, arr);
    }
    const children = sorted.filter(i => !rootIds.has(i.id));
    const orderedRoots: Item[] = [
      ...(bySpace.get(currentSpaceId) ?? []),
      ...portalOrder.flatMap(sid => bySpace.get(sid) ?? []),
    ];
    return [...orderedRoots, ...children];
  }, [items, treeSort, pertRankSort, rawRanks, filteredRelItemIds, portalGroups, currentSpaceId]);

  const { predecessors, successors } = useMemo(
    () => buildPertGraph(sortedItems, pertRelations),
    [sortedItems, pertRelations]
  );

  const ranks = useMemo(() => {
    const idSet = new Set(sortedItems.map(i => i.id));
    const itemMap = new Map(sortedItems.map(i => [i.id, i]));

    // PERT predecessors per item (items that must come strictly before)
    const pertPreds = new Map<string, string[]>();
    for (const rel of pertRelations) {
      let predId: string, succId: string;
      if (rel.type === 'blocks' || rel.type === 'implements') { predId = rel.fromItemId; succId = rel.toItemId; }
      else { predId = rel.toItemId; succId = rel.fromItemId; }
      if (idSet.has(predId) && idSet.has(succId)) {
        if (!pertPreds.has(succId)) pertPreds.set(succId, []);
        pertPreds.get(succId)!.push(predId);
      }
    }

    // Combined rank: max(rank(pert_preds) + 1, rank(parent))
    const rank = new Map<string, number>();
    const inStack = new Set<string>(); // cycle guard

    function assignRank(id: string): number {
      if (rank.has(id)) return rank.get(id)!;
      if (inStack.has(id)) return 0; // cycle — fallback
      inStack.add(id);
      let r = 0;
      for (const predId of (pertPreds.get(id) ?? [])) {
        r = Math.max(r, assignRank(predId) + 1);
      }
      const parentId = itemMap.get(id)?.parentId;
      if (parentId && idSet.has(parentId)) {
        r = Math.max(r, assignRank(parentId));
      }
      inStack.delete(id);
      rank.set(id, r);
      return r;
    }

    for (const item of sortedItems) assignRank(item.id);
    return rank;
  }, [sortedItems, pertRelations]);

  const criticalPathIds = useMemo(
    () => computeCriticalPathNaive(sortedItems, predecessors, successors),
    [sortedItems, predecessors, successors]
  );

  const pertSortFn = useMemo(
    () => (a: { id: string; title: string }, b: { id: string; title: string }) => {
      const rankDiff = (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    },
    [ranks]
  );

  // Sorted space order: current space first, then portal spaces sorted hierarchically + alphabetically
  const spaceOrder = useMemo(() => {
    if (!portalGroups?.length || !currentSpaceId) return currentSpaceId ? [currentSpaceId] : [];
    const portalIds = new Set(portalGroups.map(g => g.spaceId));
    const nameOf = new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));

    // Build children map (only within portal spaces)
    const childrenOf = new Map<string | null, string[]>();
    for (const g of portalGroups) {
      const parent = portalIds.has(g.parentSpaceId ?? '') ? g.parentSpaceId! : null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(g.spaceId);
    }
    // Sort each level alphabetically
    for (const [, children] of childrenOf) {
      children.sort((a, b) => (nameOf.get(a) ?? '').localeCompare(nameOf.get(b) ?? '', 'fr'));
    }

    // DFS from roots (parentSpaceId not in portal set → treated as root)
    const result: string[] = [];
    function visit(id: string) {
      result.push(id);
      for (const child of (childrenOf.get(id) ?? [])) visit(child);
    }
    for (const rootId of (childrenOf.get(null) ?? [])) visit(rootId);

    return [currentSpaceId, ...result];
  }, [portalGroups, currentSpaceId]);

  // Break cross-space parent-child links so each space forms its own independent tree
  const treeItems = useMemo(() => {
    if (!portalGroups?.length || !currentSpaceId) return sortedItems;
    const itemSpaceMap = new Map(sortedItems.map(i => [i.id, i.spaceId ?? currentSpaceId]));
    return sortedItems.map(item => {
      if (!item.parentId) return item;
      const parentSpace = itemSpaceMap.get(item.parentId);
      const itemSpace = item.spaceId ?? currentSpaceId;
      if (parentSpace && parentSpace !== itemSpace) return { ...item, parentId: null };
      return item;
    });
  }, [sortedItems, portalGroups, currentSpaceId]);

  const tree = useMemo(() => {
    const rawTree = buildTree(treeItems, pertSortFn);
    if (!portalGroups?.length || !currentSpaceId) return rawTree;
    return [...rawTree].sort((a, b) => {
      const ai = spaceOrder.indexOf(a.spaceId ?? currentSpaceId);
      const bi = spaceOrder.indexOf(b.spaceId ?? currentSpaceId);
      return ai - bi;
    });
  }, [treeItems, pertSortFn, portalGroups, currentSpaceId, spaceOrder]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);


  const visibleFlatItems = useMemo(() => {
    if (!collapsedSpaces.size) return flatItems;
    return flatItems.filter(item => !collapsedSpaces.has(item.spaceId ?? currentSpaceId ?? ''));
  }, [flatItems, collapsedSpaces, currentSpaceId]);

  const parentIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: typeof tree) { for (const n of nodes) { if (n.children.length > 0) { ids.push(n.id); collect(n.children); } } }
    collect(tree);
    return ids;
  }, [tree]);

  type SvgRow =
    | { kind: 'space-header'; spaceId: string; spaceName: string; colorIdx: number }
    | { kind: 'item'; item: (typeof visibleFlatItems)[0] };

  const svgRows = useMemo<SvgRow[]>(() => {
    if (!portalGroups?.length) {
      return visibleFlatItems.map(item => ({ kind: 'item' as const, item }));
    }
    const spaceNames = new Map<string, string>();
    if (currentSpaceId && spaceName) spaceNames.set(currentSpaceId, spaceName);
    portalGroups.forEach(g => spaceNames.set(g.spaceId, g.spaceName));
    const rows: SvgRow[] = [];
    let lastSpaceId: string | null = null;
    const spaceColorMap = new Map<string, number>(spaceOrder.map((sid, i) => [sid, i % SPACE_COLORS.length]));
    for (const item of flatItems) {
      const sid = item.spaceId ?? currentSpaceId ?? '';
      if (sid !== lastSpaceId) {
        if (!spaceColorMap.has(sid)) spaceColorMap.set(sid, spaceColorMap.size % SPACE_COLORS.length);
        rows.push({ kind: 'space-header', spaceId: sid, spaceName: spaceNames.get(sid) ?? sid, colorIdx: spaceColorMap.get(sid)! });
        lastSpaceId = sid;
      }
      if (!collapsedSpaces.has(sid)) rows.push({ kind: 'item', item });
    }
    return rows;
  }, [flatItems, collapsedSpaces, portalGroups, currentSpaceId, spaceName, spaceOrder]);

  const rowIndex = useMemo(() => {
    const map = new Map<string, number>();
    let y = 0;
    for (const row of svgRows) {
      if (row.kind === 'space-header') { y += SPACE_HEADER_HEIGHT; }
      else { map.set(row.item.id, y); y += ROW_HEIGHT; }
    }
    return map;
  }, [svgRows]);

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
      fromId = rel.fromItemId;
      toId   = rel.toItemId;

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
    for (const item of visibleFlatItems) {
      const r = ranks.get(item.id) ?? 0;
      if (r > max) max = r;
    }
    return max;
  }, [visibleFlatItems, ranks]);

  // Branch boxes: enclosing rect around each parent + visible descendants
  const branchBoxes = useMemo(() => {
    const visibleIds = new Set(visibleFlatItems.map(i => i.id));
    const childrenOf = new Map<string, string[]>();
    for (const item of visibleFlatItems) {
      if (item.parentId && visibleIds.has(item.parentId)) {
        if (!childrenOf.has(item.parentId)) childrenOf.set(item.parentId, []);
        childrenOf.get(item.parentId)!.push(item.id);
      }
    }
    function allDescendants(id: string): string[] {
      return [id, ...(childrenOf.get(id) ?? []).flatMap(c => allDescendants(c))];
    }
    // Only top-level parents (not nested parents whose own parent is also a parent)
    const topParents = [...childrenOf.keys()].filter(id => {
      const parentId = visibleFlatItems.find(i => i.id === id)?.parentId;
      return !parentId || !childrenOf.has(parentId);
    });
    return topParents.map(parentId => {
      const ids = allDescendants(parentId);
      const ys = ids.map(id => rowIndex.get(id) ?? 0);
      const xs = ids.map(id => H_PADDING + (ranks.get(id) ?? 0) * COLUMN_WIDTH);
      return {
        id: parentId,
        minX: Math.min(...xs),
        maxX: Math.max(...xs) + NODE_WIDTH,
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    });
  }, [visibleFlatItems, rowIndex, ranks]);

  const svgWidth = (maxRank + 1) * COLUMN_WIDTH + H_PADDING * 2 + NODE_WIDTH;
  const svgHeight = svgRows.reduce((h, row) => h + (row.kind === 'space-header' ? SPACE_HEADER_HEIGHT : ROW_HEIGHT), 0);

  function nodeX(id: string) { return H_PADDING + (ranks.get(id) ?? 0) * COLUMN_WIDTH; }
  function nodeY(id: string) { return (rowIndex.get(id) ?? 0) + V_PADDING; }

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
  }, [visibleFlatItems, ranks, rowIndex]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!relationDrag) return;
    const { x, y } = getSvgCoords(e);
    setRelationDrag(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  }, [relationDrag, getSvgCoords]);

  const handleDragEnd = useCallback((e: MouseEvent) => {
    if (!relationDrag || !onCreateRelation) { setRelationDrag(null); return; }
    const { x, y } = getSvgCoords(e);
    const target = visibleFlatItems.find(item => {
      const nx = nodeX(item.id);
      const ny = nodeY(item.id);
      return x >= nx && x <= nx + NODE_WIDTH && y >= ny && y <= ny + NODE_HEIGHT;
    });
    if (target && target.id !== relationDrag.fromItemId) {
      setPendingConnection({ source: relationDrag.fromItemId, target: target.id });
    }
    setRelationDrag(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationDrag, visibleFlatItems, ranks, rowIndex, getSvgCoords, onCreateRelation]);

  useEffect(() => {
    if (!relationDrag) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [relationDrag, handleDragMove, handleDragEnd]);

  // Auto-scroll both panels when dragging near edges
  useEffect(() => {
    if (!relationDrag) return;
    const EDGE = 60;
    const SPEED = 12;
    let mouseX = 0, mouseY = 0;
    const onMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener('mousemove', onMove);
    let raf: number;
    const tick = () => {
      for (const el of [svgScrollRef.current, scrollContainerRef.current]) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (mouseY < rect.top + EDGE) el.scrollTop -= SPEED;
        else if (mouseY > rect.bottom - EDGE) el.scrollTop += SPEED;
        if (mouseX < rect.left + EDGE) el.scrollLeft -= SPEED;
        else if (mouseX > rect.right - EDGE) el.scrollLeft += SPEED;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [!!relationDrag]);

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
  const dragTargetId = relationDrag ? (visibleFlatItems.find(item => {
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
    const isRelates = rel.type === 'relates';
    const x1 = isRelates ? nodeX(visibleFrom) + NODE_WIDTH / 2 : nodeX(visibleFrom) + NODE_WIDTH;
    const y1 = nodeY(visibleFrom) + NODE_HEIGHT / 2;
    const x2 = isRelates ? nodeX(visibleTo) + NODE_WIDTH / 2 : nodeX(visibleTo);
    const y2 = nodeY(visibleTo) + NODE_HEIGHT / 2;
    const cpOffset = Math.abs(x2 - x1) * 0.4;

    const isCritical = !proxied && criticalPathIds.has(visibleFrom) && criticalPathIds.has(visibleTo);
    const stroke = getRelationColor(rel.type);
    const strokeWidth = isCritical ? 2.5 : 1.5;
    const markerType = rel.type in RELATION_HEX ? rel.type : 'normal';

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
          markerEnd={isRelates ? undefined : `url(#arrow-${markerType})`}
          strokeDasharray={proxied ? '5 3' : (isRelates ? '6 3' : undefined)}
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
        svgRef={pertSvgRef}
        activeRelFilters={activeRelFilters}
        onToggleRelFilter={toggleRelFilter}
        pertRankSort={pertRankSort}
        onTogglePertRankSort={() => setPertRankSort(v => !v)}
        totalItemCount={items.length}
        filteredItemCount={filteredRelItemIds ? sortedItems.length : undefined}
        onNewItem={onNewItem}
        canEdit={canEdit}
        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
      />
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel — tree */}
      <div
        className="flex-shrink-0 border-r overflow-y-auto overflow-x-hidden no-scrollbar"
        style={{ width: LEFT_PANEL_WIDTH }}
        ref={scrollContainerRef}
        onScroll={(e) => { if (svgScrollRef.current) svgScrollRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop * zoom; }}
      >
          {svgRows.map((row, rowIdx) => {
            if (row.kind === 'space-header') {
              const c = SPACE_COLORS[row.colorIdx];
              const isCollapsed = collapsedSpaces.has(row.spaceId);
              return (
                <div
                  key={`lh-${row.spaceId}-${rowIdx}`}
                  className="flex items-center gap-1 px-2 text-xs font-semibold border-b cursor-pointer select-none"
                  style={{ height: SPACE_HEADER_HEIGHT, backgroundColor: c.fill, borderColor: c.stroke, borderLeftWidth: 3, borderLeftColor: c.stroke }}
                  onClick={() => toggleSpaceCollapse(row.spaceId)}
                >
                  {isCollapsed
                    ? <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: c.text }} />
                    : <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: c.text }} />}
                  <span className="text-sm font-semibold leading-tight" style={{ color: c.text }}>{row.spaceName}</span>
                </div>
              );
            }
            const { item } = row;
            const hasChildren = item.children.length > 0;
            const isCollapsed = collapsedIds.has(item.id);
            const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
            const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
            const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
            const isPortal = !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId);
            return (
              <div
                key={item.id}
                data-pert-item-id={item.id}
                className={`group ${isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''} ${isSearchMatch ? 'ring-2 ring-inset ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''}`}
                style={{ height: ROW_HEIGHT }}
              >
                <TreeItemRow
                  item={item}
                  depth={item.depth}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  isPortal={isPortal}
                  isOver={false}
                  dropPosition="nest"
                  canEdit={canEdit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onUpdateStatus={onUpdateStatus}
                  onAddChild={onAddChild}
                  onMoveToSpace={onMoveToSpace}
                  onDuplicateToSpace={onDuplicateToSpace}
                  onConvertToSpace={onConvertToSpace}
                  onSelfAssign={onSelfAssign}
                  onMerge={onMerge}
                  onAbsorbChildren={onAbsorbChildren}
                  onSplitDescription={onSplitDescription}
                  onOpen={onOpen}
                  onOpenInNewTab={onOpenInNewTab}
                  toggleCollapse={toggleCollapse}
                  statusOptions={statusOptions}
                  canEditItem={canEditItem}
                />
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
        {visibleFlatItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun item dans cet espace</div>
        ) : (
          <div style={{ width: svgWidth * zoom, height: Math.max(svgHeight, 100) * zoom, position: 'relative', flexShrink: 0 }}>
          <svg ref={pertSvgRef} width={svgWidth} height={Math.max(svgHeight, 100)} style={{ transformOrigin: 'top left', transform: `scale(${zoom})`, position: 'absolute', top: 0, left: 0, display: 'block' }}>
            <defs>
              <marker id="arrow-normal"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" /></marker>
              <marker id="arrow-blocks"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ef4444" /></marker>
              <marker id="arrow-implements" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22c55e" /></marker>
              <marker id="arrow-relates"    markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" /></marker>
            </defs>

            {/* Branch enclosing boxes */}
            {branchBoxes.map(b => (
              <rect key={`branch-${b.id}`}
                x={b.minX - 10} y={b.minY - 5}
                width={b.maxX - b.minX + 20} height={b.maxY - b.minY + ROW_HEIGHT + 10}
                rx={8} ry={8}
                fill="rgba(148,163,184,0.07)" stroke="rgba(148,163,184,0.30)" strokeWidth={1} strokeDasharray="5,3"
              />
            ))}

            {effectiveRelations.map((er, i) => renderArrow(er, `rel-${i}`))}

            {(() => {
              let accY = 0;
              return svgRows.map(row => {
                const rowY = accY;
                accY += row.kind === 'space-header' ? SPACE_HEADER_HEIGHT : ROW_HEIGHT;

              if (row.kind === 'space-header') {
                const c = SPACE_COLORS[row.colorIdx];
                return (
                  <g key={`sh-${row.spaceId}-${rowY}`}>
                    <rect x={0} y={rowY} width={svgWidth} height={SPACE_HEADER_HEIGHT} fill={c.fill} />
                    <rect x={0} y={rowY} width={3} height={SPACE_HEADER_HEIGHT} fill={c.stroke} />
                    <line x1={0} y1={rowY} x2={svgWidth} y2={rowY} stroke={c.stroke} strokeWidth={1} opacity={0.5} />
                    <text x={10} y={rowY + SPACE_HEADER_HEIGHT / 2 + 4} fontSize={12} fontWeight={700} fill={c.text} style={{ userSelect: 'none' }}>{row.spaceName}</text>
                  </g>
                );
              }

              const { item } = row;
              const x = nodeX(item.id);
              const y = nodeY(item.id);
              const isDragTarget = dragTargetId === item.id;
              const Icon = getTypeIcon(item.type as ItemType, item.url);
              const showHandle = canEdit && onCreateRelation && (hoveredNodeId === item.id) && !relationDrag;
              const nodeIsDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
              const nodeIsSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
              const nodeRelationStroke = (() => {
                const nodeRels = pertRelations.filter(r => r.fromItemId === item.id || r.toItemId === item.id);
                if (nodeRels.some(r => r.type === 'blocks' && r.fromItemId === item.id)) return '#ef4444'; // bloque → rouge
                if (nodeRels.some(r => r.type === 'blocks' && r.toItemId   === item.id)) return '#fb923c'; // est bloqué → orange clair
                if (nodeRels.some(r => r.type === 'implements')) return RELATION_HEX.implements;
                if (nodeRels.some(r => r.type === 'relates'))    return null;
                return null;
              })();

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
                    className="fill-none"
                    style={(() => {
                      if (isDragTarget) return { fill: 'transparent', stroke: 'var(--primary)' };
                      if (nodeIsSearchMatch) return { fill: '#fefce8', stroke: '#facc15' };
                      const statusEntry = statusOptions.find(s => s.id === (item.status ?? 'undefined'));
                      const bgClass = statusEntry?.color.split(' ').find(c => c.startsWith('bg-'));
                      return {
                        fill: bgClass ? tailwindBgToHex(bgClass) : '#ffffff',
                        stroke: nodeRelationStroke ?? '#e2e8f0',
                        strokeWidth: nodeRelationStroke ? 2 : 1,
                      };
                    })()}
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
              });
            })()}

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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-xl w-full mx-4">
            <h3 className="text-base font-semibold mb-1">Modifier la relation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              <span className="font-medium">{editingRelation.sourceName}</span>
              {' → '}
              <span className="font-medium">{editingRelation.targetName}</span>
            </p>
            <div className="flex flex-col gap-2 mb-3">
              {PERT_RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEditRelationType(type.id)}
                  className={`flex items-center gap-3 px-3 py-2 border rounded-lg transition-colors w-full ${
                    editRelationType === type.id ? type.selectedClass : `border-border ${type.hoverClass}`
                  }`}
                >
                  <type.Icon className={`w-4 h-4 flex-shrink-0 ${type.tailwindColor}`} />
                  <RelationRow
                    typeId={type.id}
                    sourceName={editingRelation.sourceName}
                    targetName={editingRelation.targetName}
                    sourceStatus={items.find(i => i.id === editingRelation.fromItemId)?.status}
                    targetStatus={items.find(i => i.id === editingRelation.toItemId)?.status}
                    statusOptions={statusOptions}
                  />
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
          <div className="bg-white dark:bg-card rounded-lg shadow-xl p-4 max-w-xl w-full mx-4">
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
                  className={`flex items-center gap-3 px-3 py-2 border border-border rounded-lg transition-colors w-full ${type.hoverClass}`}
                >
                  <type.Icon className={`w-4 h-4 flex-shrink-0 ${type.tailwindColor}`} />
                  <RelationRow
                    typeId={type.id}
                    sourceName={pendingSourceItem?.title ?? ''}
                    targetName={pendingTargetItem?.title ?? ''}
                    sourceStatus={pendingSourceItem?.status}
                    targetStatus={pendingTargetItem?.status}
                    statusOptions={statusOptions}
                  />
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
