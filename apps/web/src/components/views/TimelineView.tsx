import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';

import { ChevronLeft, ChevronRight, ChevronDown, ZoomIn, ZoomOut, ChevronsDownUp, ChevronsUpDown, ArrowUpDown, GitBranch, Plus } from 'lucide-react';
import { ViewHelpButton } from '../ViewHelpButton';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';

import { type TreeSort, applyTreeSort } from '../../lib/treeSort';
import { buildExportFilename, exportCSV, exportExcel, exportDataPDF, exportContainerPNG } from '../../lib/exportUtils';
import {
  DndContext, DragOverlay, pointerWithin,
  useSensors, useSensor, PointerSensor,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { itemsApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { ZoomLevel, ZOOM_CONFIGS, ZOOM_ORDER, RELATION_TYPES } from './timeline-constants';
import { startOfDay, addDays, differenceInDays, formatDateShort, formatDateFull, getWeekNumber, getMonthName, getStatusColor, computeCriticalPath } from './timeline-utils';
import { buildTree, flattenTree, type TreeItem } from './timeline-tree';
import { RelationCommentIconSvg } from '../RelationCommentIcon';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { TreeItemRow } from './TreeItemRow';
import { useCollapsedIds } from '../../lib/useCollapsedIds';

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 24;

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  parentSpaceId?: string | null;
  items: Item[];
}

interface TimelineViewProps {
  items: Item[];
  relations?: ItemRelation[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateDates?: (id: string, startDate: string | null, endDate: string | null) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string, label?: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
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
  spaceId?: string;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  spaceName?: string;
  onNewItem?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  treeSort?: TreeSort;
  onTreeSortChange?: (sort: TreeSort) => void;
}


export function TimelineView({ items, relations, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onUpdateDates, onCreateRelation, onDeleteRelation, onUpdateRelation, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, onMove, spaceId, referentiels, highlightType, highlightStatus, highlightColor, searchMatchIds, canEdit = true, canEditItem, spaceName = '',
onNewItem, onStartTour, pulseHelp,
treeSort: treeSortProp,
}: TimelineViewProps) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [centerDate, setCenterDate] = useState<Date>(() => startOfDay(new Date()));
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { collapsedIds, setCollapsedIds, toggleCollapse: toggleCollapseFromHook } = useCollapsedIds(spaceId ?? '');
  const [compactMode, setCompactMode] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
const [reordering, setReordering] = useState(false);
  const [editingRelation, setEditingRelation] = useState<{
    relationId: string; fromItemId: string; toItemId: string;
    type: string; label: string; sourceName: string; targetName: string;
  } | null>(null);
  const [editRelationType, setEditRelationType] = useState<string>('');
  useEscapeKey(() => setEditingRelation(null), !!editingRelation);
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set());
  const toggleSpaceCollapse = useCallback((sid: string) => {
    setCollapsedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  // Drag state for resizing
  const [dragging, setDragging] = useState<{
    itemId: string;
    type: 'start' | 'end';
    initialX: number;
    initialDate: Date;
    lastDeltaDays: number;
  } | null>(null);

  // Preview local pendant le drag (aucun appel API) + confirmation après save
  const [dragPreview, setDragPreview] = useState<{ itemId: string; startDate: string | null; endDate: string | null } | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);

  // Drag state for creating relations
  const [relationDrag, setRelationDrag] = useState<{
    fromItemId: string;
    fromX: number;
    fromY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Pending connection awaiting type selection
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');

  // DnD state for left-panel reordering
  const [ganttActiveId, setGanttActiveId] = useState<string | null>(null);
  const [ganttOverId, setGanttOverId] = useState<string | null>(null);
  const [ganttDropPosition, setGanttDropPosition] = useState<'before' | 'after' | 'nest'>('nest');
  const ganttPointerYRef = useRef(0);

  const ganttSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const preDragCollapsedRef = useRef<Set<string>>(new Set());

  const zoomConfig = ZOOM_CONFIGS[zoomLevel];
  const LABEL_WIDTH = 288;
  const visibleDays = containerWidth > LABEL_WIDTH
    ? Math.max(7, Math.floor((containerWidth - LABEL_WIDTH) / zoomConfig.dayWidth))
    : zoomConfig.days;

  // visibleStartDate est calculé depuis centerDate — se recale automatiquement au resize
  const visibleStartDate = useMemo(
    () => startOfDay(addDays(centerDate, -Math.floor(visibleDays / 2))),
    [centerDate, visibleDays]
  );

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const statusOptions = useMemo(() => statuses.filter(s => s.visible).sort((a, b) => a.order - b.order), [statuses]);

  // Map portal spaceId → spaceName for quick lookup
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  // Sorted space order: current space first, then portal spaces sorted hierarchically + alphabetically
  const spaceOrder = useMemo(() => {
    if (!portalGroups?.length || !currentSpaceId) return currentSpaceId ? [currentSpaceId] : [];
    const portalIds = new Set(portalGroups.map(g => g.spaceId));
    const nameOf = new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
    const childrenOf = new Map<string | null, string[]>();
    for (const g of portalGroups) {
      const parent = portalIds.has(g.parentSpaceId ?? '') ? g.parentSpaceId! : null;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(g.spaceId);
    }
    for (const [, children] of childrenOf) {
      children.sort((a, b) => (nameOf.get(a) ?? '').localeCompare(nameOf.get(b) ?? '', 'fr'));
    }
    const result: string[] = [];
    function visit(id: string) {
      result.push(id);
      for (const child of (childrenOf.get(id) ?? [])) visit(child);
    }
    for (const rootId of (childrenOf.get(null) ?? [])) visit(rootId);
    return [currentSpaceId, ...result];
  }, [portalGroups, currentSpaceId]);

  const [localTreeSort] = useState<TreeSort>('manual');
  const treeSort = treeSortProp ?? localTreeSort;
  const visibleItems = useMemo(() => items, [items]);
  const sortedItems = useMemo(() => {
    const sorted = applyTreeSort(visibleItems, treeSort);
    if (!portalGroups?.length || !currentSpaceId) return sorted;
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
    const orderedRoots = spaceOrder.flatMap(sid => bySpace.get(sid) ?? []);
    return [...orderedRoots, ...children];
  }, [visibleItems, treeSort, portalGroups, currentSpaceId, spaceOrder]);
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
    const rawTree = buildTree(treeItems);
    if (!portalGroups?.length || !currentSpaceId) return rawTree;
    return [...rawTree].sort((a, b) => {
      const ai = spaceOrder.indexOf(a.spaceId ?? currentSpaceId);
      const bi = spaceOrder.indexOf(b.spaceId ?? currentSpaceId);
      return ai - bi;
    });
  }, [treeItems, portalGroups, currentSpaceId, spaceOrder]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds, compactMode), [tree, collapsedIds, compactMode]);

  type FlatRow =
    | { kind: 'header'; spaceId: string; spaceName: string; isCollapsed: boolean }
    | { kind: 'item'; item: TreeItem; itemIndex: number };

  const flatRows = useMemo((): FlatRow[] => {
    if (!portalGroups?.length || !currentSpaceId) {
      return flatItems.map((item, itemIndex) => ({ kind: 'item', item, itemIndex }));
    }
    const rows: FlatRow[] = [];
    const seenSpaces = new Set<string>();
    let idx = 0;
    for (const item of flatItems) {
      const sid = item.spaceId ?? currentSpaceId;
      if (item.depth === 0 && !seenSpaces.has(sid)) {
        const name = sid === currentSpaceId
          ? (spaceName || 'Espace courant')
          : (portalSpaceNames.get(sid) ?? sid);
        rows.push({ kind: 'header', spaceId: sid, spaceName: name, isCollapsed: collapsedSpaces.has(sid) });
        seenSpaces.add(sid);
      }
      if (collapsedSpaces.has(sid)) continue;
      rows.push({ kind: 'item', item, itemIndex: idx++ });
    }
    return rows;
  }, [flatItems, portalGroups, currentSpaceId, spaceName, portalSpaceNames, collapsedSpaces]);

  // Y pixel offset for each item, accounting for space headers
  const itemYOffset = useMemo(() => {
    const map = new Map<string, number>();
    let y = 0;
    for (const row of flatRows) {
      if (row.kind === 'header') { y += HEADER_HEIGHT; }
      else { map.set(row.item.id, y); y += ROW_HEIGHT; }
    }
    return map;
  }, [flatRows]);

  // Compute effective dates for parents without own dates — derived from descendants
  const effectiveDates = useMemo(() => {
    const result = new Map<string, { start: string; end: string }>();

    function computeDates(item: TreeItem): { start: Date | null; end: Date | null } {
      const ownStart = item.startDate || item.dueDate ? new Date(item.startDate || item.dueDate!) : null;
      const ownEnd   = item.endDate   || item.dueDate ? new Date(item.endDate   || item.dueDate!) : null;

      if (item.children.length === 0) return { start: ownStart, end: ownEnd };

      let minStart: Date | null = ownStart;
      let maxEnd:   Date | null = ownEnd;

      for (const child of item.children) {
        const c = computeDates(child);
        if (c.start && (!minStart || c.start < minStart)) minStart = c.start;
        if (c.end   && (!maxEnd   || c.end   > maxEnd))   maxEnd   = c.end;
      }

      // Only store if the item has no own dates but descendants do
      if (!ownStart && !ownEnd && (minStart || maxEnd)) {
        result.set(item.id, {
          start: (minStart ?? maxEnd!).toISOString(),
          end:   (maxEnd   ?? minStart!).toISOString(),
        });
      }

      return { start: minStart, end: maxEnd };
    }

    for (const root of tree) computeDates(root);
    return result;
  }, [tree]);

  // Gantt left-panel DnD handlers — defined after flatItems
  const handleGanttDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setGanttActiveId(id);
    preDragCollapsedRef.current = new Set(collapsedIds);
    setCollapsedIds(prev => { const s = new Set(prev); s.add(id); return s; });
  }, [collapsedIds]);

  const handleGanttDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setGanttOverId(overId);
    if (!overId) { setGanttDropPosition('nest'); return; }
    const el = document.querySelector(`[data-gantt-item-id="${overId}"]`) as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.height === 0) { setGanttDropPosition('nest'); return; }
    const ratio = (ganttPointerYRef.current - rect.top) / rect.height;
    if (ratio < 0.33) setGanttDropPosition('before');
    else if (ratio > 0.67) setGanttDropPosition('after');
    else setGanttDropPosition('nest');
  }, []);

  const handleGanttDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const pos = ganttDropPosition;
    const wasCollapsed = preDragCollapsedRef.current.has(activeId);
    setGanttActiveId(null);
    setGanttOverId(null);
    setGanttDropPosition('nest');
    if (!over || activeId === over.id || !onMove) {
      if (!wasCollapsed) setCollapsedIds(prev => { const s = new Set(prev); s.delete(activeId); return s; });
      return;
    }
    const overItem = flatItems.find(i => i.id === over.id);
    if (!overItem) {
      if (!wasCollapsed) setCollapsedIds(prev => { const s = new Set(prev); s.delete(activeId); return s; });
      return;
    }
    if (pos === 'nest') {
      onMove(activeId, over.id as string, 0);
      setCollapsedIds(prev => {
        const s = new Set(prev);
        s.delete(over.id as string);
        if (!wasCollapsed) s.delete(activeId);
        return s;
      });
    } else {
      const siblings = flatItems.filter(i => i.parentId === overItem.parentId);
      const overIndex = siblings.findIndex(i => i.id === over.id);
      const targetPos = pos === 'after' ? overIndex + 1 : overIndex;
      onMove(activeId, overItem.parentId ?? null, targetPos >= 0 ? targetPos : 0);
      if (!wasCollapsed) setCollapsedIds(prev => { const s = new Set(prev); s.delete(activeId); return s; });
    }
  }, [ganttDropPosition, flatItems, onMove]);

  const handleGanttDragCancel = useCallback(() => {
    const id = ganttActiveId;
    setGanttActiveId(null);
    setGanttOverId(null);
    setGanttDropPosition('nest');
    if (id && !preDragCollapsedRef.current.has(id)) {
      setCollapsedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [ganttActiveId]);

  useEffect(() => {
    if (!ganttActiveId) return;
    const handler = (e: PointerEvent) => { ganttPointerYRef.current = e.clientY; };
    window.addEventListener('pointermove', handler);
    return () => window.removeEventListener('pointermove', handler);
  }, [ganttActiveId]);

  const itemsWithDatesCount = useMemo(() => {
    return items.filter(item => item.startDate || item.dueDate).length;
  }, [items]);

  const criticalPathIds = useMemo(() => {
    if (!showCriticalPath || !relations || relations.length === 0) return new Set<string>();
    return computeCriticalPath(items, relations);
  }, [showCriticalPath, items, relations]);

  const parentIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: typeof tree) { for (const n of nodes) { if (n.children.length > 0) { ids.push(n.id); collect(n.children); } } }
    collect(tree);
    return ids;
  }, [tree]);

  // Generate days array
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < visibleDays; i++) {
      result.push(addDays(visibleStartDate, i));
    }
    return result;
  }, [visibleStartDate, visibleDays]);

  // Group days by week
  const weeks = useMemo(() => {
    const result: { weekNum: number; year: number; days: Date[] }[] = [];
    let currentWeek: { weekNum: number; year: number; days: Date[] } | null = null;

    days.forEach(day => {
      const weekNum = getWeekNumber(day);
      const year = day.getFullYear();

      if (!currentWeek || currentWeek.weekNum !== weekNum || currentWeek.year !== year) {
        currentWeek = { weekNum, year, days: [] };
        result.push(currentWeek);
      }
      currentWeek.days.push(day);
    });

    return result;
  }, [days]);

  // Group days by month
  const months = useMemo(() => {
    const result: { month: number; year: number; name: string; days: Date[] }[] = [];
    let currentMonth: { month: number; year: number; name: string; days: Date[] } | null = null;

    days.forEach(day => {
      const month = day.getMonth();
      const year = day.getFullYear();

      if (!currentMonth || currentMonth.month !== month || currentMonth.year !== year) {
        currentMonth = { month, year, name: getMonthName(day), days: [] };
        result.push(currentMonth);
      }
      currentMonth.days.push(day);
    });

    return result;
  }, [days]);

  const dayWidth = zoomConfig.dayWidth;

  // Navigation — déplace centerDate, visibleStartDate se recalcule
  const goToPrevious = () => setCenterDate(prev => addDays(prev, -zoomConfig.navStep));
  const goToNext = () => setCenterDate(prev => addDays(prev, zoomConfig.navStep));
  const goToToday = () => setCenterDate(startOfDay(new Date()));

  // Zoom controls
  const zoomIn = () => {
    const currentIndex = ZOOM_ORDER.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_ORDER[currentIndex - 1]);
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_ORDER.indexOf(zoomLevel);
    if (currentIndex < ZOOM_ORDER.length - 1) {
      setZoomLevel(ZOOM_ORDER[currentIndex + 1]);
    }
  };

  const canZoomIn = ZOOM_ORDER.indexOf(zoomLevel) > 0;
  const canZoomOut = ZOOM_ORDER.indexOf(zoomLevel) < ZOOM_ORDER.length - 1;

  const toggleCollapse = toggleCollapseFromHook;

  const handleChronoReorder = useCallback(async () => {
    if (!spaceId || reordering) return;
    // Build groups of siblings sorted by date
    function collectGroups(treeItems: TreeItem[], parentId: string | null): { parentId: string | null; itemIds: string[] }[] {
      const sorted = [...treeItems].sort((a, b) => {
        const dateA = a.startDate || a.dueDate;
        const dateB = b.startDate || b.dueDate;
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
      const groups: { parentId: string | null; itemIds: string[] }[] = [
        { parentId, itemIds: sorted.map(i => i.id) },
      ];
      for (const item of sorted) {
        if (item.children.length > 0) {
          groups.push(...collectGroups(item.children, item.id));
        }
      }
      return groups;
    }
    const groups = collectGroups(tree, null);
    setReordering(true);
    try {
      await itemsApi.reorder(spaceId, groups);
      queryClient.invalidateQueries({ queryKey: ['items'] });
    } finally {
      setReordering(false);
    }
  }, [spaceId, tree, reordering, queryClient]);

  // Handle drag start for resizing
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    itemId: string,
    type: 'start' | 'end',
    currentDate: Date
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({
      itemId,
      type,
      initialX: e.clientX,
      initialDate: currentDate,
      lastDeltaDays: 0,
    });
  }, []);

  // Handle drag move — mise à jour visuelle locale uniquement, pas d'appel API
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    const deltaX = e.clientX - dragging.initialX;
    const rawDays = deltaX / dayWidth;
    const snap = zoomConfig.snapDays;

    // Date brute avec précision fractionnaire (addDays tronque, on utilise les ms)
    const rawMs = dragging.initialDate.getTime() + rawDays * 86400000;
    const raw = new Date(rawMs);

    let newDate: Date;
    if (snap === 7) {
      const dow = raw.getDay(); // 0=dim, 1=lun…6=sam
      if (dragging.type === 'end') {
        // Snap au dimanche le plus proche
        const daysFromSunday = dow === 0 ? 0 : dow;
        newDate = addDays(raw, daysFromSunday <= 3.5 ? -daysFromSunday : 7 - daysFromSunday);
      } else {
        // Snap au lundi le plus proche
        const daysFromMonday = dow === 0 ? 6 : dow - 1;
        newDate = addDays(raw, daysFromMonday <= 3.5 ? -daysFromMonday : 7 - daysFromMonday);
      }
    } else if (snap === 30) {
      if (dragging.type === 'end') {
        // Snap au dernier jour du mois le plus proche
        const d1 = new Date(raw.getFullYear(), raw.getMonth() + 1, 0); // fin mois courant
        const d2 = new Date(raw.getFullYear(), raw.getMonth(), 0);      // fin mois précédent
        newDate = (raw.getDate() / d1.getDate()) >= 0.5 ? d1 : d2;
      } else {
        // Snap au 1er du mois le plus proche
        const d1 = new Date(raw.getFullYear(), raw.getMonth(), 1);
        const d2 = new Date(raw.getFullYear(), raw.getMonth() + 1, 1);
        newDate = raw.getDate() <= 15 ? d1 : d2;
      }
    } else {
      newDate = addDays(dragging.initialDate, Math.round(rawDays / snap) * snap);
    }

    const deltaDays = Math.round((newDate.getTime() - dragging.initialDate.getTime()) / 86400000);
    if (deltaDays === dragging.lastDeltaDays) return;
    const item = items.find(i => i.id === dragging.itemId);
    if (!item) return;

    const hasExistingDates = !!(item.startDate || item.endDate);
    const today = startOfDay(new Date());
    const currentStart = (dragPreview?.itemId === item.id && dragPreview.startDate)
      ? new Date(dragPreview.startDate)
      : item.startDate ? new Date(item.startDate) : today;
    const currentEnd = (dragPreview?.itemId === item.id && dragPreview.endDate)
      ? new Date(dragPreview.endDate)
      : item.endDate ? new Date(item.endDate) : currentStart;

    if (dragging.type === 'start') {
      if (!hasExistingDates || newDate <= currentEnd) {
        setDragPreview({
          itemId: dragging.itemId,
          startDate: newDate.toISOString(),
          endDate: dragPreview?.endDate ?? item.endDate ?? (hasExistingDates ? null : newDate.toISOString()),
        });
        setDragging(prev => prev ? { ...prev, lastDeltaDays: deltaDays } : null);
      }
    } else {
      if (!hasExistingDates || newDate >= currentStart) {
        setDragPreview({
          itemId: dragging.itemId,
          startDate: dragPreview?.startDate ?? item.startDate ?? (hasExistingDates ? null : newDate.toISOString()),
          endDate: newDate.toISOString(),
        });
        setDragging(prev => prev ? { ...prev, lastDeltaDays: deltaDays } : null);
      }
    }
  }, [dragging, dragPreview, dayWidth, items]);

  // Handle drag end — un seul appel API avec la position finale
  const handleDragEnd = useCallback(() => {
    const preview = dragPreview;
    setDragging(null);
    setDragPreview(null);
    if (preview && onUpdateDates) {
      onUpdateDates(preview.itemId, preview.startDate, preview.endDate);
      const itemId = preview.itemId;
      setSavedItemId(itemId);
      setTimeout(() => setSavedItemId(prev => prev === itemId ? null : prev), 1500);
    }
  }, [dragPreview, onUpdateDates]);

  // Effect for drag listeners
  useEffect(() => {
    if (dragging) {
      const moveHandler = (e: MouseEvent) => handleDragMove(e);
      const upHandler = () => handleDragEnd();
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', upHandler);
      return () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // Ref for the scrollable timeline area (used for relation drag coordinate calculations)
  const timelineAreaRef = useRef<HTMLDivElement>(null);

  // Handle relation drag start (barLeft & barWidth passed from template to avoid getBarStyle dependency)
  const handleRelationDragStart = useCallback((e: React.MouseEvent, itemId: string, barLeft: number, barWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = flatItems.findIndex(i => i.id === itemId);
    if (idx === -1) return;

    const centerX = barLeft + barWidth / 2;
    const centerY = idx * 40 + 20; // ROW_HEIGHT / 2
    setRelationDrag({
      fromItemId: itemId,
      fromX: centerX,
      fromY: centerY,
      currentX: centerX,
      currentY: centerY,
    });
  }, [flatItems]);

  // Handle relation drag move
  const handleRelationDragMove = useCallback((e: MouseEvent) => {
    if (!relationDrag) return;
    const area = timelineAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    // Coordinates relative to the timeline area, offset by 288px for the label column
    setRelationDrag(prev => prev ? {
      ...prev,
      currentX: e.clientX - rect.left - 288,
      currentY: e.clientY - rect.top,
    } : null);
  }, [relationDrag]);

  // Handle relation drag end - open type selection modal
  const handleRelationDragEnd = useCallback((e: MouseEvent) => {
    if (!relationDrag || !onCreateRelation) {
      setRelationDrag(null);
      return;
    }

    const area = timelineAreaRef.current;
    if (!area) { setRelationDrag(null); return; }
    const rect = area.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const targetIdx = Math.floor(relY / 40); // ROW_HEIGHT

    if (targetIdx >= 0 && targetIdx < flatItems.length) {
      const targetItem = flatItems[targetIdx];
      if (targetItem.id !== relationDrag.fromItemId) {
        setPendingConnection({ source: relationDrag.fromItemId, target: targetItem.id });
      }
    }

    setRelationDrag(null);
  }, [relationDrag, flatItems, onCreateRelation]);

  // Handle relation type selection from modal
  const handleRelationTypeSelect = useCallback((type: string) => {
    if (pendingConnection) {
      onCreateRelation?.(pendingConnection.source, pendingConnection.target, type, pendingLabel || undefined);
      setPendingConnection(null);
      setPendingLabel('');
    }
  }, [pendingConnection, pendingLabel, onCreateRelation]);

  // Get item titles for relation dialog
  const pendingSourceItem = pendingConnection ? items.find(i => i.id === pendingConnection.source) : null;
  const pendingTargetItem = pendingConnection ? items.find(i => i.id === pendingConnection.target) : null;

  // Effect for relation drag listeners
  useEffect(() => {
    if (relationDrag) {
      window.addEventListener('mousemove', handleRelationDragMove);
      window.addEventListener('mouseup', handleRelationDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleRelationDragMove);
        window.removeEventListener('mouseup', handleRelationDragEnd);
      };
    }
  }, [relationDrag, handleRelationDragMove, handleRelationDragEnd]);

  // Auto-scroll when dragging a relation near edges
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!relationDrag) return;
    const EDGE = 80;
    const SPEED = 10;
    // Find the actual scrollable ancestor at drag start
    function findScrollParent(el: HTMLElement | null): HTMLElement | null {
      if (!el) return null;
      const { overflowY } = window.getComputedStyle(el);
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      return findScrollParent(el.parentElement);
    }
    const scrollEl = findScrollParent(timelineAreaRef.current);
    if (!scrollEl) return;
    const onMove = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);
    let raf: number;
    const tick = () => {
      const rect = scrollEl.getBoundingClientRect();
      const { y } = mousePosRef.current;
      if (y < rect.top + EDGE && scrollEl.scrollTop > 0) scrollEl.scrollTop -= SPEED;
      else if (y > rect.bottom - EDGE) scrollEl.scrollTop += SPEED;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [!!relationDrag]);

  // Track container width via ResizeObserver — visibleStartDate se recale automatiquement
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute hovered row index during relation drag
  const relationDragTargetIdx = relationDrag
    ? Math.floor(relationDrag.currentY / 40)
    : -1;

  const getBarStyle = (item: Item, overrideStartDate?: string | null, overrideEndDate?: string | null) => {
    const rawStart = overrideStartDate !== undefined ? overrideStartDate : item.startDate;
    const rawEnd = overrideEndDate !== undefined ? overrideEndDate : item.endDate;
    const itemStartDate = rawStart || item.dueDate;
    const hasDate = !!itemStartDate;

    // Si pas de date, utiliser aujourd'hui
    const today = startOfDay(new Date());
    const itemStart = hasDate ? startOfDay(new Date(itemStartDate)) : today;
    const itemEnd = hasDate
      ? startOfDay(new Date(rawEnd || today))
      : today;

    const startOffset = differenceInDays(itemStart, visibleStartDate);
    const duration = differenceInDays(itemEnd, itemStart) + 1;

    if (startOffset + duration < 0 || startOffset > visibleDays) {
      return null;
    }

    const left = Math.max(0, startOffset) * dayWidth;
    const adjustedDuration = Math.min(
      duration - Math.max(0, -startOffset),
      visibleDays - Math.max(0, startOffset)
    );
    const width = Math.max(adjustedDuration * dayWidth - 2, Math.min(dayWidth, 20));

    return { left, width, hasDate };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const visibleEndDate = addDays(visibleStartDate, visibleDays);

  // Compute dependency arrows between related items
  const dependencyArrows = useMemo(() => {
    if (!relations || relations.length === 0) return [];

    const arrows: { fromX: number; fromY: number; toX: number; toY: number; type: string; relationId: string; fromItemId: string; toItemId: string; label: string; fromTitle: string; toTitle: string }[] = [];
    const rowIndexMap = new Map<string, number>();
    flatItems.forEach((item, idx) => rowIndexMap.set(item.id, idx));

    for (const rel of relations) {
      const fromIdx = rowIndexMap.get(rel.fromItemId);
      const toIdx = rowIndexMap.get(rel.toItemId);
      if (fromIdx === undefined || toIdx === undefined) continue;

      const fromItem = flatItems[fromIdx];
      const toItem = flatItems[toIdx];

      const fromBar = getBarStyle(fromItem);
      const toBar = getBarStyle(toItem);
      if (!fromBar || !toBar) continue;

      // Arrow: always from end of source bar to start of target bar
      const fromX = fromBar.left + fromBar.width;
      const toX = toBar.left;
      const fromY = (itemYOffset.get(fromItem.id) ?? fromIdx * ROW_HEIGHT) + ROW_HEIGHT / 2;
      const toY = (itemYOffset.get(toItem.id) ?? toIdx * ROW_HEIGHT) + ROW_HEIGHT / 2;

      arrows.push({ fromX, fromY, toX, toY, type: rel.type, relationId: rel.id, fromItemId: rel.fromItemId, toItemId: rel.toItemId, label: rel.label ?? '', fromTitle: fromItem.title, toTitle: toItem.title });
    }

    return arrows;
  }, [relations, flatItems, itemYOffset, visibleStartDate, zoomConfig, dayWidth]);

  // Determine which header rows to show based on zoom level
  const showMonthRow = true; // Toujours afficher les mois
  const showWeekRow = zoomLevel === 'day' || zoomLevel === 'week' || zoomLevel === 'month' || zoomLevel === 'quarter';

  return (
    <div className="flex flex-col h-full" ref={viewContainerRef}>
      {/* ViewHeader */}
      <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        {canEdit && onNewItem && (
          <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
        <div className="h-4 w-px bg-border mx-1" />
        {/* Navigation */}
        <Button variant="bordered" size="sm" onClick={goToPrevious} title="Précédent">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="bordered" size="sm" onClick={goToToday} title="Centrer sur la date du jour">
          Aujourd'hui
        </Button>
        <Button variant="bordered" size="sm" onClick={goToNext} title="Suivant">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="text-sm text-muted-foreground hidden sm:block">
          {formatDateFull(visibleStartDate)} - {formatDateFull(addDays(visibleEndDate, -1))}
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        {/* Timeline-specific controls */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {itemsWithDatesCount} planifiés
        </span>
        {canEdit && spaceId && (
          <Button variant="bordered" size="sm" onClick={handleChronoReorder} disabled={reordering} title="Réordonner chronologiquement (persisté)">
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant={compactMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCompactMode(prev => !prev)}
          title={compactMode ? 'Afficher tous les éléments' : 'Masquer les éléments sans date'}
        >
          {compactMode ? <ChevronsUpDown className="w-4 h-4" /> : <ChevronsDownUp className="w-4 h-4" />}
        </Button>
        {parentIds.length > 0 && (
          <CollapseToggleButton
            isCollapsed={collapsedIds.size > 0}
            onToggle={() => collapsedIds.size > 0 ? setCollapsedIds(new Set()) : setCollapsedIds(new Set(parentIds))}
          />
        )}
<Button
          variant={showCriticalPath ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowCriticalPath(prev => !prev)}
          title={showCriticalPath ? 'Masquer le chemin critique' : 'Afficher le chemin critique'}
          className={showCriticalPath ? 'bg-red-600 hover:bg-red-700 border-red-600' : ''}
        >
          <GitBranch className="w-4 h-4" />
        </Button>
        <div data-tour="timeline-zoom" className="flex items-center gap-1 border rounded-md">
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={!canZoomIn} title="Zoom avant" className="h-8 px-2">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <select
            className="text-sm bg-transparent px-2 py-1 border-0 focus:ring-0 min-w-[100px] text-center"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(e.target.value as ZoomLevel)}
            title="Niveau de zoom"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
            <option value="quarter">Trimestre</option>
            <option value="year">Année</option>
          </select>
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={!canZoomOut} title="Zoom arrière" className="h-8 px-2">
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1" />
        <ViewHelpButton viewMode="timeline" onStartTour={onStartTour} pulse={pulseHelp} />
        <ExportDropdownButton
          groups={[
            { options: [
              { label: 'CSV (.csv)',    onClick: () => exportCSV(items, buildExportFilename(spaceName, 'timeline')) },
              { label: 'Excel (.xlsx)', onClick: () => exportExcel(items, buildExportFilename(spaceName, 'timeline')) },
            ]},
            { options: [
              { label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, buildExportFilename(spaceName, 'timeline'), spaceName) },
            ]},
            { options: [
              { label: 'PNG — vue (.png)', onClick: () => viewContainerRef.current ? exportContainerPNG(viewContainerRef.current, buildExportFilename(spaceName, 'timeline')) : Promise.resolve() },
            ]},
          ]}
        />
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={containerRef}>
        <div>
          {/* Header */}
          <div className="sticky top-0 bg-background z-10 border-b">
            {/* Month row (for quarter/year zoom) */}
            {showMonthRow && (
              <div className="flex border-b">
                <div className="w-72 flex-shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground border-r bg-muted/50 sticky left-0 z-20">
                  Mois
                </div>
                <div className="flex">
                  {months.map((month, idx) => (
                    <div
                      key={`${month.year}-${month.month}-${idx}`}
                      className="text-xs font-medium text-center py-1 border-r bg-muted/30"
                      style={{ width: month.days.length * dayWidth }}
                    >
                      {month.name} {month.year}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Week row (for day/week/month zoom) */}
            {showWeekRow && (
              <div className="flex border-b">
                <div className="w-72 flex-shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground border-r bg-muted/50 sticky left-0 z-20">
                  Semaine
                </div>
                <div className="flex">
                  {weeks.map((week, idx) => (
                    <div
                      key={`${week.year}-${week.weekNum}-${idx}`}
                      className="text-xs font-medium text-center py-1 border-r bg-muted/30"
                      style={{ width: week.days.length * dayWidth }}
                    >
                      S{week.weekNum}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Days row */}
            <div className="flex">
              <div className="w-72 flex-shrink-0 px-3 py-2 text-sm font-medium border-r bg-muted/50 sticky left-0 z-20">
                Élément
              </div>
              <div className="flex">
                {zoomConfig.showDayNumbers ? (
                  days.map((day, idx) => (
                    <div
                      key={idx}
                      className={`text-xs text-center border-r ${
                        isToday(day) ? 'bg-primary/20 font-bold' : isWeekend(day) ? 'bg-muted/50' : ''
                      } py-2`}
                      style={{ width: dayWidth }}
                    >
                      <div>{day.getDate()}</div>
                      {zoomConfig.showWeekdays && (
                        <div className="text-muted-foreground">
                          {day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  // quarter/year : cellule vide de la bonne largeur totale
                  <div style={{ width: visibleDays * dayWidth }} />
                )}
              </div>
            </div>
          </div>

          {/* Items rows */}
          {flatItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Aucun élément</p>
              <p className="text-sm">Créez des éléments pour les voir dans le planning</p>
            </div>
          ) : (<div className="relative" ref={timelineAreaRef}>
            <DndContext
              sensors={ganttSensors}
              collisionDetection={pointerWithin}
              onDragStart={handleGanttDragStart}
              onDragOver={handleGanttDragOver}
              onDragEnd={handleGanttDragEnd}
              onDragCancel={handleGanttDragCancel}
            >
            {flatRows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <div
                    key={`header-${row.spaceId}-${flatRows.indexOf(row)}`}
                    className="flex border-b bg-muted/40 cursor-pointer hover:bg-muted/60 select-none"
                    style={{ height: HEADER_HEIGHT }}
                    onClick={() => toggleSpaceCollapse(row.spaceId)}
                  >
                    <div
                      className="px-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground truncate"
                      style={{ width: 288, flexShrink: 0 }}
                    >
                      {row.isCollapsed
                        ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                      {row.spaceName}
                    </div>
                    <div className="flex-1 border-l" />
                  </div>
                );
              }
              const { item, itemIndex } = row;
              const isPreview = dragPreview?.itemId === item.id;
              const derived = !isPreview ? effectiveDates.get(item.id) : undefined;
              const barStyle = isPreview
                ? getBarStyle(item, dragPreview!.startDate, dragPreview!.endDate)
                : derived
                  ? getBarStyle(item, derived.start, derived.end)
                  : getBarStyle(item);
              const statusColor = getStatusColor(item.status, statuses);
              const hasChildren = item.children.length > 0;
              const isCollapsed = collapsedIds.has(item.id);
              const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
              const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
              const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
              const isPortal = !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId);
              const portalSpaceName = isPortal ? portalSpaceNames.get(item.spaceId) : undefined;

              return (
                <div
                  key={item.id}
                  data-gantt-item-id={item.id}
                  className={`flex border-b hover:bg-muted/30 group h-10 relative ${
                    isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''
                  } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''} ${isPortal ? 'bg-muted/10' : ''}`}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Item label — extracted as component to allow useDraggable/useDroppable hooks */}
                  <TreeItemRow
                    item={item}
                    hasChildren={hasChildren}
                    isCollapsed={isCollapsed}
                    isPortal={isPortal}
                    isOver={ganttOverId === item.id}
                    dropPosition={ganttDropPosition}
                    canEdit={canEdit}
                    onMove={onMove}
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

                  {/* Timeline bar area */}
                  <div className="relative flex-1" style={{ minHeight: 40 }}>
                    {/* Grid lines — per-day (day/week/month), per-week (quarter), per-month (year) */}
                    <div className="absolute inset-0 flex">
                      {zoomConfig.showDayNumbers ? (
                        days.map((day, idx) => (
                          <div
                            key={idx}
                            className={`border-r ${isToday(day) ? 'bg-primary/10' : isWeekend(day) ? 'bg-muted/30' : ''}`}
                            style={{ width: dayWidth }}
                          />
                        ))
                      ) : zoomLevel === 'quarter' ? (
                        weeks.map((week, idx) => (
                          <div key={idx} className="border-r border-muted/50" style={{ width: week.days.length * dayWidth }} />
                        ))
                      ) : (
                        months.map((month, idx) => (
                          <div key={idx} className="border-r border-muted/50" style={{ width: month.days.length * dayWidth }} />
                        ))
                      )}
                    </div>

                    {/* Item bar */}
                    {barStyle && (
                      <div
                        {...(itemIndex === 0 ? { 'data-tour': 'timeline-bar' } : {})}
                        className={`absolute top-1 h-8 rounded transition-all group/bar hover:z-10 ${
                          derived
                            ? 'opacity-40 border-2 border-dashed border-muted-foreground/70 bg-muted-foreground/20'
                            : `${statusColor} ${barStyle.hasDate
                                ? isPortal ? 'border-2 border-dashed border-primary/30' : 'shadow-md border border-black/20'
                                : 'border-2 border-dashed border-gray-400 opacity-60'}`
                        } ${
                          !derived && (hoveredItem === item.id || dragging?.itemId === item.id
                            ? 'ring-2 ring-primary shadow-xl opacity-100'
                            : 'hover:shadow-lg hover:opacity-100')
                        } ${dragging?.itemId === item.id ? 'cursor-grabbing' : ''} ${
                          relationDrag && relationDragTargetIdx === itemIndex && item.id !== relationDrag.fromItemId
                            ? 'ring-2 ring-green-500 shadow-xl'
                            : ''
                        } ${criticalPathIds.has(item.id) ? 'ring-2 ring-red-500' : ''
                        } ${savedItemId === item.id ? 'ring-2 ring-green-400 shadow-green-200' : ''
                        } ${(() => { const v = (item as any).viewedAt; return (v === null || (v && new Date(item.updatedAt) > new Date(v))) ? 'animate-unseen-blink' : ''; })()}`}
                        style={{
                          left: barStyle.left + 1,
                          width: barStyle.width,
                        }}
                        title={derived
                          ? `${item.title}\n${formatDateShort(new Date(derived.start))} - ${formatDateShort(new Date(derived.end))} (étendue des enfants)`
                          : barStyle.hasDate
                            ? `${item.title}${isPortal && portalSpaceName ? ` (${portalSpaceName})` : ''}\n${formatDateShort(new Date(item.startDate || item.dueDate!))} - ${item.endDate ? formatDateShort(new Date(item.endDate)) : "aujourd'hui"}`
                            : `${item.title}\n(Sans date - cliquer pour définir)`
                        }
                      >
                        {/* Left resize handle — arrow pointing left, outside bar */}
                        {!derived && canEdit && onUpdateDates && (
                          <div
                            className="absolute -left-5 top-1/2 -translate-y-1/2 cursor-ew-resize opacity-0 group-hover/bar:opacity-80 hover:!opacity-100 transition-opacity z-20"
                            onMouseDown={(e) => handleDragStart(
                              e,
                              item.id,
                              'start',
                              item.startDate ? new Date(item.startDate) : new Date()
                            )}
                            title="Ajuster la date de début"
                          >
                            <svg width="14" height="20" viewBox="0 0 14 20" className="text-primary drop-shadow-sm">
                              <path d="M12 2 L2 10 L12 18" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}

                        {/* Content - clickable */}
                        {!derived && (
                          <div
                            className="h-full flex items-center cursor-pointer px-1 min-w-0"
                            onClick={() => onEdit(item.id)}
                          >
                            {barStyle.width > 50 && (
                              <span className="text-xs truncate font-semibold">
                                {item.title}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Right resize handle — arrow pointing right, outside bar */}
                        {!derived && canEdit && onUpdateDates && (
                          <div
                            className="absolute -right-5 top-1/2 -translate-y-1/2 cursor-ew-resize opacity-0 group-hover/bar:opacity-80 hover:!opacity-100 transition-opacity z-20"
                            onMouseDown={(e) => handleDragStart(
                              e,
                              item.id,
                              'end',
                              item.endDate ? new Date(item.endDate) : (item.startDate ? new Date(item.startDate) : new Date())
                            )}
                            title="Ajuster la date de fin"
                          >
                            <svg width="14" height="20" viewBox="0 0 14 20" className="text-primary drop-shadow-sm">
                              <path d="M2 2 L12 10 L2 18" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}

                        {/* Relation connector handle — center of bar */}
                        {canEdit && onCreateRelation && (
                          <div
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-md cursor-crosshair opacity-0 group-hover/bar:opacity-80 hover:!opacity-100 transition-all z-20 flex items-center justify-center"
                            onMouseDown={(e) => handleRelationDragStart(e, item.id, barStyle.left + 1, barStyle.width)}
                            title="Glisser vers un élément pour créer une liaison"
                          >
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Due date marker (red diamond) */}
                    {item.dueDate && (() => {
                      const dueDateObj = startOfDay(new Date(item.dueDate));
                      const dueOffset = differenceInDays(dueDateObj, visibleStartDate);
                      // Only render if visible
                      if (dueOffset < -1 || dueOffset > visibleDays + 1) return null;
                      const dueX = dueOffset * dayWidth + dayWidth / 2;
                      const barEnd = barStyle ? barStyle.left + 1 + barStyle.width : null;
                      return (
                        <>
                          {/* Arrow line from bar end to due date marker */}
                          {barEnd !== null && Math.abs(dueX - barEnd) > 10 && (
                            <svg
                              className="absolute top-0 left-0 w-full h-full pointer-events-none"
                              style={{ overflow: 'visible' }}
                            >
                              <line
                                x1={barEnd}
                                y1={20}
                                x2={dueX}
                                y2={20}
                                stroke="hsl(var(--destructive))"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                                opacity={0.6}
                              />
                              {/* Small arrowhead */}
                              <polygon
                                points={dueX > barEnd
                                  ? `${dueX - 5},${17} ${dueX},${20} ${dueX - 5},${23}`
                                  : `${dueX + 5},${17} ${dueX},${20} ${dueX + 5},${23}`
                                }
                                fill="hsl(var(--destructive))"
                                opacity={0.6}
                              />
                            </svg>
                          )}
                          {/* Diamond marker */}
                          <div
                            className="absolute top-1 z-10 pointer-events-none"
                            style={{ left: dueX - 6 }}
                            title={`Échéance : ${formatDateShort(dueDateObj)}`}
                          >
                            <svg width="12" height="32" viewBox="0 0 12 32">
                              {/* Vertical line */}
                              <line x1="6" y1="0" x2="6" y2="32" stroke="hsl(var(--destructive))" strokeWidth="1.5" opacity="0.5" />
                              {/* Diamond */}
                              <polygon points="6,4 10,10 6,16 2,10" fill="hsl(var(--destructive))" opacity="0.8" />
                            </svg>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows SVG overlay */}
            {dependencyArrows.length > 0 && (
              <svg
                className="absolute top-0"
                style={{ left: 288, width: visibleDays * dayWidth, height: flatRows.reduce((acc, r) => acc + (r.kind === 'header' ? HEADER_HEIGHT : ROW_HEIGHT), 0), pointerEvents: 'none' }}
              >
                <defs>
                  <marker id="arrowhead-blocks"     markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" opacity="0.8" /></marker>
                  <marker id="arrowhead-implements" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#22c55e" opacity="0.8" /></marker>
                  <marker id="arrowhead-relates"    markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3b82f6" opacity="0.8" /></marker>
                </defs>
                {dependencyArrows.map((arrow, idx) => {
                  const color = arrow.type === 'blocks' ? '#ef4444' : arrow.type === 'implements' ? '#22c55e' : '#3b82f6';
                  const markerId = `arrowhead-${arrow.type === 'blocks' ? 'blocks' : arrow.type === 'implements' ? 'implements' : 'relates'}`;
                  const relType = RELATION_TYPES.find(t => t.id === arrow.type);
                  const relLabel = relType?.label || arrow.type;

                  const dx = arrow.toX - arrow.fromX;
                  const dy = arrow.toY - arrow.fromY;
                  const gap = 16; // horizontal offset before turning
                  const rowH = 40;

                  // Route horizontal segments at row boundaries (between rows) to avoid overlapping bars
                  // fromY and toY are at row centers; midY goes to the nearest row edge
                  const fromRowEdge = dy > 0 ? arrow.fromY + rowH / 2 + 2 : arrow.fromY - rowH / 2 - 2;

                  let path: string;
                  if (Math.abs(dy) < 2) {
                    // Same row — straight line
                    path = `M ${arrow.fromX} ${arrow.fromY} H ${arrow.toX}`;
                  } else if (dx >= gap * 2) {
                    // Forward: right → down at row edge → across → down to target → right
                    const midX = arrow.fromX + dx / 2;
                    path = `M ${arrow.fromX} ${arrow.fromY} H ${midX} V ${arrow.toY} H ${arrow.toX}`;
                  } else {
                    // Backward or short forward: route through row edges
                    const exitX = arrow.fromX + gap;
                    const entryX = arrow.toX - gap;
                    const midY = fromRowEdge;
                    path = `M ${arrow.fromX} ${arrow.fromY} H ${exitX} V ${midY} H ${entryX} V ${arrow.toY} H ${arrow.toX}`;
                  }

                  return (
                    <g key={idx}>
                      {/* Visible arrow */}
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                        strokeOpacity={0.6}
                        markerEnd={`url(#${markerId})`}
                      />
                      {/* Invisible wider clickable path */}
                      {canEdit && (onDeleteRelation || onUpdateRelation) && (
                        <path
                          d={path}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={12}
                          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                          onClick={() => {
                            const sourceItem = flatItems.find(i => i.id === arrow.fromItemId);
                            const targetItem = flatItems.find(i => i.id === arrow.toItemId);
                            setEditingRelation({
                              relationId: arrow.relationId,
                              fromItemId: arrow.fromItemId,
                              toItemId: arrow.toItemId,
                              type: arrow.type,
                              label: '',
                              sourceName: sourceItem?.title || '',
                              targetName: targetItem?.title || '',
                            });
                            setEditRelationType(arrow.type);
                          }}
                        >
                          <title>{`${relLabel} - Cliquer pour modifier`}</title>
                        </path>
                      )}
                      {arrow.label && (
                        <RelationCommentIconSvg
                          x={(arrow.fromX + arrow.toX) / 2}
                          y={(arrow.fromY + arrow.toY) / 2}
                          label={arrow.label}
                          relationType={arrow.type}
                          fromTitle={arrow.fromTitle}
                          toTitle={arrow.toTitle}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Temporary relation drag line */}
            {relationDrag && (
              <svg
                className="absolute top-0 pointer-events-none z-20"
                style={{ left: 288, width: visibleDays * dayWidth, height: flatRows.reduce((acc, r) => acc + (r.kind === 'header' ? HEADER_HEIGHT : ROW_HEIGHT), 0) }}
              >
                <line
                  x1={relationDrag.fromX}
                  y1={relationDrag.fromY}
                  x2={relationDrag.currentX}
                  y2={relationDrag.currentY}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.8}
                />
                <circle
                  cx={relationDrag.fromX}
                  cy={relationDrag.fromY}
                  r={4}
                  fill="hsl(var(--primary))"
                />
                {/* Target indicator */}
                {relationDragTargetIdx >= 0 && relationDragTargetIdx < flatItems.length &&
                  flatItems[relationDragTargetIdx].id !== relationDrag.fromItemId && (
                  <circle
                    cx={relationDrag.currentX}
                    cy={relationDrag.currentY}
                    r={6}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    opacity={0.8}
                  />
                )}
              </svg>
            )}
            <DragOverlay dropAnimation={null}>
              {ganttActiveId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-card border-2 border-primary rounded-md shadow-xl max-w-xs text-sm font-medium">
                  {flatItems.find(i => i.id === ganttActiveId)?.title ?? ganttActiveId}
                </div>
              ) : null}
            </DragOverlay>
            </DndContext>
          </div>)}
        </div>
      </div>

      {/* Relation type selection modal */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Type de relation</h3>
            <p className="text-sm text-muted-foreground mb-3">
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
            <div className="grid grid-cols-2 gap-2">
              {RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleRelationTypeSelect(type.id)}
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left group"
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
            {pendingLabel && (
              <button
                onClick={() => handleRelationTypeSelect('relates')}
                className="mt-2 w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Créer avec type par défaut
              </button>
            )}
            <button
              onClick={() => { setPendingConnection(null); setPendingLabel(''); }}
              className="mt-4 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {/* Edit relation dialog */}
      {editingRelation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Modifier la relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{editingRelation.sourceName}</span>
              {' → '}
              <span className="font-medium">{editingRelation.targetName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {RELATION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setEditRelationType(type.id)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${
                        editRelationType === type.id ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/30' : 'hover:bg-purple-50 hover:border-purple-300'
                      }`}
                    >
                      <type.Icon className={`w-4 h-4 ${type.color}`} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={editingRelation.label}
                  onChange={(e) => setEditingRelation({ ...editingRelation, label: e.target.value })}
                  placeholder="Justification de la relation (optionnel)"
                  rows={2}
                  className="w-full text-sm px-3 py-1.5 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
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
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
