import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import type { Item, ItemType, ItemRelation, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { TYPE_ICONS } from '../../constants/ui';

interface TimelineViewProps {
  items: Item[];
  relations?: ItemRelation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateDates?: (id: string, startDate: string | null, endDate: string | null) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
}

// Zoom level configuration
type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface ZoomConfig {
  label: string;
  days: number;
  dayWidth: number;
  navStep: number; // days to navigate
  showDayNumbers: boolean;
  showWeekdays: boolean;
}

const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  day: { label: 'Jour', days: 7, dayWidth: 80, navStep: 1, showDayNumbers: true, showWeekdays: true },
  week: { label: 'Semaine', days: 42, dayWidth: 40, navStep: 7, showDayNumbers: true, showWeekdays: true },
  month: { label: 'Mois', days: 90, dayWidth: 20, navStep: 30, showDayNumbers: true, showWeekdays: false },
  quarter: { label: 'Trimestre', days: 180, dayWidth: 8, navStep: 30, showDayNumbers: false, showWeekdays: false },
  year: { label: 'Année', days: 365, dayWidth: 4, navStep: 90, showDayNumbers: false, showWeekdays: false },
};

const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

// Utility functions
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function differenceInDays(date1: Date, date2: Date): number {
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short' });
}

// Get status color from referentiels
function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
  if (!status) {
    const undefinedStatus = statuses.find(s => s.id === 'undefined');
    return undefinedStatus?.color || 'bg-slate-100 text-slate-600';
  }
  const statusConfig = statuses.find(s => s.id === status);
  if (!statusConfig) return 'bg-gray-100 text-gray-800';
  return statusConfig.color;
}

// Build tree structure from flat items
interface TreeItem extends Item {
  children: TreeItem[];
  depth: number;
}

function buildTree(items: Item[]): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const rootItems: TreeItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [], depth: 0 });
  });

  items.forEach(item => {
    const treeItem = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      parent.children.push(treeItem);
    } else {
      rootItems.push(treeItem);
    }
  });

  function setDepths(items: TreeItem[], depth: number) {
    items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    items.forEach(item => {
      item.depth = depth;
      setDepths(item.children, depth + 1);
    });
  }
  setDepths(rootItems, 0);

  return rootItems;
}

function flattenTree(items: TreeItem[], collapsedIds: Set<string>): TreeItem[] {
  const result: TreeItem[] = [];

  function traverse(items: TreeItem[]) {
    items.forEach(item => {
      result.push(item);
      if (item.children.length > 0 && !collapsedIds.has(item.id)) {
        traverse(item.children);
      }
    });
  }

  traverse(items);
  return result;
}

export function TimelineView({ items, relations, onEdit, onDelete: _onDelete, onUpdateStatus: _onUpdateStatus, onUpdateDates, onAddChild: _onAddChild, referentiels, highlightType }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [visibleStartDate, setVisibleStartDate] = useState<Date>(() => {
    const today = new Date();
    return startOfDay(addDays(today, -7));
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Drag state for resizing
  const [dragging, setDragging] = useState<{
    itemId: string;
    type: 'start' | 'end';
    initialX: number;
    initialDate: Date;
  } | null>(null);

  const zoomConfig = ZOOM_CONFIGS[zoomLevel];

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const tree = useMemo(() => buildTree(items), [items]);
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

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
    const offset = Math.floor(zoomConfig.days / 4);
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

  const getBarStyle = (item: Item) => {
    const itemStartDate = item.startDate || item.dueDate;
    const hasDate = !!itemStartDate;

    // Si pas de date, utiliser aujourd'hui
    const today = startOfDay(new Date());
    const itemStart = hasDate ? startOfDay(new Date(itemStartDate)) : today;
    const itemEnd = hasDate
      ? startOfDay(new Date(item.endDate || item.dueDate || itemStartDate))
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

    const arrows: { fromX: number; fromY: number; toX: number; toY: number; type: string }[] = [];
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

      // Arrow from end of source bar to start of target bar
      const fromX = fromBar.left + fromBar.width;
      const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toX = toBar.left;
      const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      arrows.push({ fromX, fromY, toX, toY, type: rel.type });
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
          <Button variant="outline" size="sm" onClick={goToToday}>
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
                <div className="w-72 flex-shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground border-r bg-muted/50">
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
                <div className="w-72 flex-shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground border-r bg-muted/50">
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
              <div className="w-72 flex-shrink-0 px-3 py-2 text-sm font-medium border-r bg-muted/50">
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
          ) : (<div className="relative">
            {flatItems.map((item) => {
              const barStyle = getBarStyle(item);
              const Icon = TYPE_ICONS[item.type];
              const statusColor = getStatusColor(item.status, statuses);
              const hasChildren = item.children.length > 0;
              const isCollapsed = collapsedIds.has(item.id);
              const hasDate = !!(item.startDate || item.dueDate);
              const isHighlighted = highlightType && item.type === highlightType;
              const isDimmed = highlightType && item.type !== highlightType;

              return (
                <div
                  key={item.id}
                  className={`flex border-b hover:bg-muted/30 group ${
                    isHighlighted ? 'bg-primary/10 ring-1 ring-primary ring-inset' : ''
                  } ${isDimmed ? 'opacity-40' : ''}`}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Item label */}
                  <div
                    className="w-72 flex-shrink-0 px-2 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-muted/50"
                    style={{ paddingLeft: `${8 + item.depth * 20}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(item.id);
                        }}
                        className="p-0.5 hover:bg-muted rounded"
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
                      className={`truncate text-sm ${!hasDate ? 'text-muted-foreground' : ''}`}
                      onClick={() => onEdit(item.id)}
                    >
                      {item.title}
                    </span>
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
                        className={`absolute top-1 h-8 rounded transition-all ${statusColor} ${
                          barStyle.hasDate
                            ? 'shadow-md border border-black/20'
                            : 'border-2 border-dashed border-gray-400 opacity-60'
                        } ${
                          hoveredItem === item.id || dragging?.itemId === item.id
                            ? 'ring-2 ring-primary shadow-xl opacity-100'
                            : 'hover:shadow-lg hover:opacity-100'
                        } ${dragging?.itemId === item.id ? 'cursor-grabbing' : ''}`}
                        style={{
                          left: barStyle.left + 1,
                          width: barStyle.width,
                        }}
                        title={barStyle.hasDate
                          ? `${item.title}\n${formatDateShort(new Date(item.startDate || item.dueDate!))} - ${formatDateShort(new Date(item.endDate || item.dueDate || item.startDate!))}`
                          : `${item.title}\n(Sans date - cliquer pour définir)`
                        }
                      >
                        {/* Left resize handle */}
                        {onUpdateDates && (
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
                        {onUpdateDates && (
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows SVG overlay */}
            {dependencyArrows.length > 0 && (
              <svg
                className="absolute top-0 pointer-events-none"
                style={{ left: 288, width: zoomConfig.days * dayWidth, height: flatItems.length * ROW_HEIGHT }}
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

                  // Curved path: from end of source bar to start of target bar
                  const dx = arrow.toX - arrow.fromX;
                  const midX = arrow.fromX + dx / 2;
                  // If going backwards (target starts before source ends), route around
                  const curveOffset = dx < 20 ? 30 : 0;

                  const path = curveOffset > 0
                    ? `M ${arrow.fromX} ${arrow.fromY} C ${arrow.fromX + curveOffset} ${arrow.fromY}, ${arrow.toX - curveOffset} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`
                    : `M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`;

                  return (
                    <path
                      key={idx}
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeOpacity={0.6}
                      markerEnd={`url(#${markerId})`}
                    />
                  );
                })}
              </svg>
            )}
          </div>)}
        </div>
      </div>
    </div>
  );
}
