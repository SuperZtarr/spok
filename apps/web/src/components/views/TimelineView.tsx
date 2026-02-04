import { useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import type { Item, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { TYPE_ICONS } from '../../constants/ui';

interface TimelineViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
}

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

// Get status color from referentiels - utilise la même couleur que les badges de statut
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

  // First pass: create TreeItem for each item
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [], depth: 0 });
  });

  // Second pass: build hierarchy
  items.forEach(item => {
    const treeItem = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      parent.children.push(treeItem);
    } else {
      rootItems.push(treeItem);
    }
  });

  // Third pass: calculate depths and sort
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

// Flatten tree for rendering
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

export function TimelineView({ items, onEdit, onDelete: _onDelete, onUpdateStatus: _onUpdateStatus, onAddChild: _onAddChild, referentiels }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleStartDate, setVisibleStartDate] = useState<Date>(() => {
    const today = new Date();
    return startOfDay(addDays(today, -7)); // Start a week before today
  });
  const [daysToShow, setDaysToShow] = useState(28); // 4 weeks by default
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  // Build tree structure
  const tree = useMemo(() => buildTree(items), [items]);

  // Flatten tree for display
  const flatItems = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  // Count items with dates
  const itemsWithDatesCount = useMemo(() => {
    return items.filter(item => item.startDate || item.dueDate).length;
  }, [items]);

  // Generate days array for the header
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      result.push(addDays(visibleStartDate, i));
    }
    return result;
  }, [visibleStartDate, daysToShow]);

  // Group days by week for the header
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

  // Calculate day width based on container
  const dayWidth = 40; // pixels per day

  // Navigation functions
  const goToPreviousWeek = () => {
    setVisibleStartDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setVisibleStartDate(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setVisibleStartDate(addDays(new Date(), -7));
  };

  // Toggle collapse
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

  // Calculate bar position for an item
  const getBarStyle = (item: Item) => {
    const itemStartDate = item.startDate || item.dueDate;
    if (!itemStartDate) return null;

    const itemStart = startOfDay(new Date(itemStartDate));
    const itemEnd = startOfDay(new Date(item.endDate || item.dueDate || itemStartDate));

    const startOffset = differenceInDays(itemStart, visibleStartDate);
    const duration = differenceInDays(itemEnd, itemStart) + 1;

    // Check if item is visible
    if (startOffset + duration < 0 || startOffset > daysToShow) {
      return null; // Not visible
    }

    const left = Math.max(0, startOffset) * dayWidth;
    const adjustedDuration = Math.min(
      duration - Math.max(0, -startOffset),
      daysToShow - Math.max(0, startOffset)
    );
    const width = Math.max(adjustedDuration * dayWidth - 4, dayWidth - 4);

    return { left, width };
  };

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if a date is weekend
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const visibleEndDate = addDays(visibleStartDate, daysToShow);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDateFull(visibleStartDate)} - {formatDateFull(addDays(visibleEndDate, -1))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {items.length} éléments ({itemsWithDatesCount} planifiés)
          </span>
          <select
            className="text-sm border rounded px-2 py-1 bg-background"
            value={daysToShow}
            onChange={(e) => setDaysToShow(Number(e.target.value))}
          >
            <option value={14}>2 semaines</option>
            <option value={28}>4 semaines</option>
            <option value={56}>8 semaines</option>
            <option value={90}>3 mois</option>
          </select>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="min-w-max">
          {/* Header with weeks and days */}
          <div className="sticky top-0 bg-background z-10 border-b">
            {/* Weeks row */}
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
            {/* Days row */}
            <div className="flex">
              <div className="w-72 flex-shrink-0 px-3 py-2 text-sm font-medium border-r bg-muted/50">
                Élément
              </div>
              <div className="flex">
                {days.map((day, idx) => (
                  <div
                    key={idx}
                    className={`text-xs text-center py-2 border-r ${
                      isToday(day) ? 'bg-primary/20 font-bold' : isWeekend(day) ? 'bg-muted/50' : ''
                    }`}
                    style={{ width: dayWidth }}
                  >
                    <div>{day.getDate()}</div>
                    <div className="text-muted-foreground">
                      {day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Items rows - hierarchical */}
          {flatItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Aucun élément</p>
              <p className="text-sm">Créez des éléments pour les voir dans le planning</p>
            </div>
          ) : (
            flatItems.map((item) => {
              const barStyle = getBarStyle(item);
              const Icon = TYPE_ICONS[item.type];
              const statusColor = getStatusColor(item.status, statuses);
              const hasChildren = item.children.length > 0;
              const isCollapsed = collapsedIds.has(item.id);
              const hasDate = !!(item.startDate || item.dueDate);

              return (
                <div
                  key={item.id}
                  className="flex border-b hover:bg-muted/30 group"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Item label with indentation */}
                  <div
                    className="w-72 flex-shrink-0 px-2 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-muted/50"
                    style={{ paddingLeft: `${8 + item.depth * 20}px` }}
                  >
                    {/* Expand/collapse button */}
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
                      <span className="w-5" /> // Spacer for alignment
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

                    {/* Item bar (only if has dates) */}
                    {barStyle && (
                      <div
                        className={`absolute top-1 h-8 rounded cursor-pointer transition-all ${statusColor} shadow-md border border-black/20 ${
                          hoveredItem === item.id ? 'ring-2 ring-primary shadow-xl scale-[1.02]' : 'hover:shadow-lg'
                        }`}
                        style={{
                          left: barStyle.left + 2,
                          width: barStyle.width,
                        }}
                        onClick={() => onEdit(item.id)}
                        title={`${item.title}\n${formatDateShort(new Date(item.startDate || item.dueDate!))} - ${formatDateShort(new Date(item.endDate || item.dueDate || item.startDate!))}`}
                      >
                        <div className="px-2 py-1 text-xs truncate font-semibold">
                          {item.title}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
