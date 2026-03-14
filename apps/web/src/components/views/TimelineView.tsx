import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, ZoomIn, ZoomOut, Plus, Copy, ChevronsDownUp, ChevronsUpDown, ArrowUpDown, Trash2, CheckSquare, FolderInput, FolderPlus, FolderKanban, UserPlus, Merge, ArrowDownToLine } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { useQueryClient } from '@tanstack/react-query';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { itemsApi } from '../../lib/api';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ConfirmModal';
import { getTypeIcon } from '../../constants/ui';
import { ZoomLevel, ZOOM_CONFIGS, ZOOM_ORDER, RELATION_TYPES } from './timeline-constants';
import { startOfDay, addDays, differenceInDays, formatDateShort, formatDateFull, getWeekNumber, getMonthName, getStatusColor } from './timeline-utils';
import { buildTree, flattenTree, type TreeItem } from './timeline-tree';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
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
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  spaceId?: string;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

export function TimelineView({ items, relations, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onUpdateDates, onCreateRelation, onDeleteRelation, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, spaceId, referentiels, highlightType, highlightStatus, highlightColor, searchMatchIds, canEdit = true }: TimelineViewProps) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [visibleStartDate, setVisibleStartDate] = useState<Date>(() => {
    const today = new Date();
    // Center today in the view at init
    const offset = Math.floor(ZOOM_CONFIGS['month'].days / 2);
    return startOfDay(addDays(today, -offset));
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [compactMode, setCompactMode] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [pendingDeleteRelation, setPendingDeleteRelation] = useState<{ fromItemId: string; relationId: string; label: string } | null>(null);

  // Drag state for resizing
  const [dragging, setDragging] = useState<{
    itemId: string;
    type: 'start' | 'end';
    initialX: number;
    initialDate: Date;
  } | null>(null);

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

  const zoomConfig = ZOOM_CONFIGS[zoomLevel];

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const doneStatusId = useMemo(() => {
    const visibleStatuses = statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    return doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';
  }, [statuses]);

  // Map portal spaceId → spaceName for quick lookup
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  const tree = useMemo(() => buildTree(items), [items]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds, compactMode), [tree, collapsedIds, compactMode]);

  const itemsWithDatesCount = useMemo(() => {
    return items.filter(item => item.startDate || item.dueDate).length;
  }, [items]);

  // Generate days array
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < zoomConfig.days; i++) {
      result.push(addDays(visibleStartDate, i));
    }
    return result;
  }, [visibleStartDate, zoomConfig.days]);

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

  // Navigation
  const goToPrevious = () => {
    setVisibleStartDate(prev => addDays(prev, -zoomConfig.navStep));
  };

  const goToNext = () => {
    setVisibleStartDate(prev => addDays(prev, zoomConfig.navStep));
  };

  const goToToday = () => {
    const today = new Date();
    // Center today in the view
    const offset = Math.floor(zoomConfig.days / 2);
    setVisibleStartDate(startOfDay(addDays(today, -offset)));
  };

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

  const toggleCollapse = (itemId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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
    });
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging || !onUpdateDates) return;

    const deltaX = e.clientX - dragging.initialX;
    const deltaDays = Math.round(deltaX / dayWidth);

    if (deltaDays !== 0) {
      const newDate = addDays(dragging.initialDate, deltaDays);
      const item = items.find(i => i.id === dragging.itemId);
      if (!item) return;

      const hasExistingDates = !!(item.startDate || item.endDate);
      const today = startOfDay(new Date());
      const currentStart = item.startDate ? new Date(item.startDate) : today;
      const currentEnd = item.endDate ? new Date(item.endDate) : currentStart;

      if (dragging.type === 'start') {
        // Don't allow start date to go past end date (only if item has existing dates)
        if (!hasExistingDates || newDate <= currentEnd) {
          onUpdateDates(
            dragging.itemId,
            newDate.toISOString(),
            // Pour les éléments sans date, définir aussi la date de fin
            item.endDate || (hasExistingDates ? null : newDate.toISOString())
          );
        }
      } else {
        // Don't allow end date to go before start date (only if item has existing dates)
        if (!hasExistingDates || newDate >= currentStart) {
          onUpdateDates(
            dragging.itemId,
            // Pour les éléments sans date, définir aussi la date de début
            item.startDate || (hasExistingDates ? null : newDate.toISOString()),
            newDate.toISOString()
          );
        }
      }

      // Update initial values for continuous dragging
      setDragging(prev => prev ? {
        ...prev,
        initialX: e.clientX,
        initialDate: newDate,
      } : null);
    }
  }, [dragging, dayWidth, items, onUpdateDates]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

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
      onCreateRelation?.(pendingConnection.source, pendingConnection.target, type);
      setPendingConnection(null);
    }
  }, [pendingConnection, onCreateRelation]);

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

  // Compute hovered row index during relation drag
  const relationDragTargetIdx = relationDrag
    ? Math.floor(relationDrag.currentY / 40)
    : -1;

  const getBarStyle = (item: Item) => {
    const itemStartDate = item.startDate || item.dueDate;
    const hasDate = !!itemStartDate;

    // Si pas de date, utiliser aujourd'hui
    const today = startOfDay(new Date());
    const itemStart = hasDate ? startOfDay(new Date(itemStartDate)) : today;
    const itemEnd = hasDate
      ? startOfDay(new Date(item.endDate || today))
      : today;

    const startOffset = differenceInDays(itemStart, visibleStartDate);
    const duration = differenceInDays(itemEnd, itemStart) + 1;

    if (startOffset + duration < 0 || startOffset > zoomConfig.days) {
      return null;
    }

    const left = Math.max(0, startOffset) * dayWidth;
    const adjustedDuration = Math.min(
      duration - Math.max(0, -startOffset),
      zoomConfig.days - Math.max(0, startOffset)
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

  const visibleEndDate = addDays(visibleStartDate, zoomConfig.days);

  const ROW_HEIGHT = 40;

  // Compute dependency arrows between related items
  const dependencyArrows = useMemo(() => {
    if (!relations || relations.length === 0) return [];

    const arrows: { fromX: number; fromY: number; toX: number; toY: number; type: string; relationId: string; fromItemId: string }[] = [];
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
      const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      arrows.push({ fromX, fromY, toX, toY, type: rel.type, relationId: rel.id, fromItemId: rel.fromItemId });
    }

    return arrows;
  }, [relations, flatItems, visibleStartDate, zoomConfig, dayWidth]);

  // Determine which header rows to show based on zoom level
  const showMonthRow = true; // Toujours afficher les mois
  const showWeekRow = zoomLevel === 'day' || zoomLevel === 'week' || zoomLevel === 'month';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevious} title="Précédent">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} title="Centrer sur la date du jour">
            Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext} title="Suivant">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          {formatDateFull(visibleStartDate)} - {formatDateFull(addDays(visibleEndDate, -1))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {items.length} ({itemsWithDatesCount} planifiés)
          </span>

          {/* Chronological reorder */}
          {canEdit && spaceId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleChronoReorder}
              disabled={reordering}
              title="Réordonner chronologiquement (persisté)"
            >
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          )}

          {/* Compact mode toggle */}
          <Button
            variant={compactMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompactMode(prev => !prev)}
            title={compactMode ? 'Afficher tous les éléments' : 'Masquer les éléments sans date'}
          >
            {compactMode ? (
              <ChevronsUpDown className="w-4 h-4" />
            ) : (
              <ChevronsDownUp className="w-4 h-4" />
            )}
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={!canZoomIn}
              title="Zoom avant"
              className="h-8 px-2"
            >
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
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={!canZoomOut}
              title="Zoom arrière"
              className="h-8 px-2"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="min-w-max">
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
                {days.map((day, idx) => (
                  <div
                    key={idx}
                    className={`text-xs text-center border-r ${
                      isToday(day) ? 'bg-primary/20 font-bold' : isWeekend(day) ? 'bg-muted/50' : ''
                    } ${zoomConfig.showDayNumbers ? 'py-2' : 'py-1'}`}
                    style={{ width: dayWidth }}
                  >
                    {zoomConfig.showDayNumbers && (
                      <>
                        <div>{day.getDate()}</div>
                        {zoomConfig.showWeekdays && (
                          <div className="text-muted-foreground">
                            {day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
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
            {flatItems.map((item, itemIndex) => {
              const barStyle = getBarStyle(item);
              const Icon = getTypeIcon(item.type);
              const statusColor = getStatusColor(item.status, statuses);
              const hasChildren = item.children.length > 0;
              const isCollapsed = collapsedIds.has(item.id);
              const hasDate = !!(item.startDate || item.dueDate);
              const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
              const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
              const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
              const isPortal = !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId);
              const portalSpaceName = isPortal ? portalSpaceNames.get(item.spaceId) : undefined;

              return (
                <div
                  key={item.id}
                  className={`flex border-b hover:bg-muted/30 group h-10 relative ${
                    isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''
                  } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''} ${isPortal ? 'bg-muted/10' : ''}`}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Item label */}
                  <div
                    className="w-72 flex-shrink-0 px-2 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-muted/50 sticky left-0 z-10 bg-background"
                    style={{ paddingLeft: `${8 + item.depth * 20}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(item.id);
                        }}
                        className="p-0.5 hover:bg-muted rounded"
                        title={isCollapsed ? 'Développer' : 'Réduire'}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span
                      className={`truncate text-sm flex-1 ${!hasDate ? 'text-muted-foreground' : ''}`}
                      onClick={() => onEdit(item.id)}
                    >
                      {item.title}
                    </span>
                    {isPortal && portalSpaceName && (
                      <Link
                        to={`/spaces/${item.spaceId}/content`}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        title={`Espace : ${portalSpaceName}`}
                      >
                        <FolderKanban className="w-3 h-3" />
                        <span className="truncate max-w-[60px]">{portalSpaceName}</span>
                      </Link>
                    )}
                    {canEdit && !isPortal && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <ItemActionMenu
                          groups={[
                            {
                              actions: [
                                ...(item.status !== doneStatusId ? [{ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, doneStatusId) }] : []),
                                { id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) },
                                ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(item.id) }] : []),
                                ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(item.id) }] : []),
                                ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(item.id) }] : []),
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

                  {/* Timeline bar area */}
                  <div className="relative flex-1" style={{ minHeight: 40 }}>
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex">
                      {days.map((day, idx) => (
                        <div
                          key={idx}
                          className={`border-r ${isToday(day) ? 'bg-primary/10' : isWeekend(day) ? 'bg-muted/30' : ''}`}
                          style={{ width: dayWidth }}
                        />
                      ))}
                    </div>

                    {/* Item bar */}
                    {barStyle && (
                      <div
                        className={`absolute top-1 h-8 rounded transition-all group/bar hover:z-10 ${statusColor} ${
                          barStyle.hasDate
                            ? isPortal ? 'border-2 border-dashed border-primary/30' : 'shadow-md border border-black/20'
                            : 'border-2 border-dashed border-gray-400 opacity-60'
                        } ${
                          hoveredItem === item.id || dragging?.itemId === item.id
                            ? 'ring-2 ring-primary shadow-xl opacity-100'
                            : 'hover:shadow-lg hover:opacity-100'
                        } ${dragging?.itemId === item.id ? 'cursor-grabbing' : ''} ${
                          relationDrag && relationDragTargetIdx === itemIndex && item.id !== relationDrag.fromItemId
                            ? 'ring-2 ring-green-500 shadow-xl'
                            : ''
                        }`}
                        style={{
                          left: barStyle.left + 1,
                          width: barStyle.width,
                        }}
                        title={barStyle.hasDate
                          ? `${item.title}${isPortal && portalSpaceName ? ` (${portalSpaceName})` : ''}\n${formatDateShort(new Date(item.startDate || item.dueDate!))} - ${item.endDate ? formatDateShort(new Date(item.endDate)) : "aujourd'hui"}`
                          : `${item.title}\n(Sans date - cliquer pour définir)`
                        }
                      >
                        {/* Left resize handle */}
                        {canEdit && !isPortal && onUpdateDates && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-black/20 rounded-l group/handle"
                            onMouseDown={(e) => handleDragStart(
                              e,
                              item.id,
                              'start',
                              item.startDate ? new Date(item.startDate) : new Date()
                            )}
                            title="Ajuster la date de début"
                          >
                            <div className="w-0.5 h-4 bg-black/30 group-hover/handle:bg-black/50 rounded" />
                          </div>
                        )}

                        {/* Content - clickable */}
                        <div
                          className="h-full flex items-center cursor-pointer px-3"
                          onClick={() => onEdit(item.id)}
                        >
                          {barStyle.width > 50 && (
                            <span className="text-xs truncate font-semibold">
                              {item.title}
                            </span>
                          )}
                        </div>

                        {/* Right resize handle */}
                        {canEdit && !isPortal && onUpdateDates && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-black/20 rounded-r group/handle"
                            onMouseDown={(e) => handleDragStart(
                              e,
                              item.id,
                              'end',
                              item.endDate ? new Date(item.endDate) : (item.startDate ? new Date(item.startDate) : new Date())
                            )}
                            title="Ajuster la date de fin"
                          >
                            <div className="w-0.5 h-4 bg-black/30 group-hover/handle:bg-black/50 rounded" />
                          </div>
                        )}

                        {/* Relation connector handle (right end of bar) */}
                        {canEdit && onCreateRelation && (
                          <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary border-2 border-white shadow-md cursor-crosshair opacity-0 group-hover/bar:opacity-80 hover:!opacity-100 transition-all z-20 flex items-center justify-center"
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
                      if (dueOffset < -1 || dueOffset > zoomConfig.days + 1) return null;
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
                style={{ left: 288, width: zoomConfig.days * dayWidth, height: flatItems.length * ROW_HEIGHT, pointerEvents: 'none' }}
              >
                <defs>
                  <marker id="arrowhead-depends" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" opacity="0.7" />
                  </marker>
                  <marker id="arrowhead-blocks" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--destructive))" opacity="0.7" />
                  </marker>
                </defs>
                {dependencyArrows.map((arrow, idx) => {
                  const isBlocks = arrow.type === 'blocks';
                  const color = isBlocks ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
                  const markerId = isBlocks ? 'arrowhead-blocks' : 'arrowhead-depends';
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
                      {canEdit && onDeleteRelation && (
                        <path
                          d={path}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={12}
                          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                          onClick={() => {
                            setPendingDeleteRelation({ fromItemId: arrow.fromItemId, relationId: arrow.relationId, label: relLabel });
                          }}
                        >
                          <title>{`${relLabel} - Cliquer pour supprimer`}</title>
                        </path>
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
                style={{ left: 288, width: zoomConfig.days * dayWidth, height: flatItems.length * ROW_HEIGHT }}
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
          </div>)}
        </div>
      </div>

      {/* Relation type selection modal */}
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
            <button
              onClick={() => setPendingConnection(null)}
              className="mt-4 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!pendingDeleteRelation}
        onClose={() => setPendingDeleteRelation(null)}
        onConfirm={() => {
          if (pendingDeleteRelation && onDeleteRelation) {
            onDeleteRelation(pendingDeleteRelation.fromItemId, pendingDeleteRelation.relationId);
          }
          setPendingDeleteRelation(null);
        }}
        title="Supprimer cette relation ?"
        message={`Supprimer la relation « ${pendingDeleteRelation?.label || ''} » ?`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
