import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS, getTypeColor } from '../../constants/ui';
import {
  getCalendarDays,
  isSameDay,
  addMonths,
  MONTH_NAMES_FR,
  DAY_NAMES_SHORT_FR,
} from '../../lib/dateUtils';

interface CalendarViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

/** Get all dates an item spans (dueDate as single day, or startDate→endDate range) */
function getItemDates(item: Item): Date[] {
  const dates: Date[] = [];

  if (item.startDate && item.endDate) {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  } else if (item.startDate) {
    const d = new Date(item.startDate);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }

  if (item.dueDate) {
    const d = new Date(item.dueDate);
    d.setHours(0, 0, 0, 0);
    // Avoid duplicate if dueDate falls within startDate→endDate range
    if (!dates.some(existing => isSameDay(existing, d))) {
      dates.push(d);
    }
  }

  return dates;
}

export function CalendarView({
  items,
  onEdit,
  referentiels,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);

  // Map: dateKey → items for that day
  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const dates = getItemDates(item);
      for (const d of dates) {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const list = map.get(key) || [];
        list.push(item);
        map.set(key, list);
      }
    }
    return map;
  }, [items]);

  // Status config
  const statusMap = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const map: Record<string, { label: string; color: string }> = {};
    statuses.forEach(s => {
      map[s.id] = { label: s.label, color: s.color };
    });
    return map;
  }, [referentiels]);

  // Count items with dates
  const itemsWithDates = useMemo(() => {
    return items.filter(i => i.startDate || i.endDate || i.dueDate).length;
  }, [items]);

  const goToPrevMonth = () => setCurrentDate(d => addMonths(d, -1));
  const goToNextMonth = () => setCurrentDate(d => addMonths(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex flex-col h-full">
      {/* Header: navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center capitalize">
            {MONTH_NAMES_FR[month]} {year}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
        <span className="text-sm text-muted-foreground">
          {itemsWithDates} / {items.length} élément{items.length > 1 ? 's' : ''} avec date
        </span>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES_SHORT_FR.map((name, i) => (
          <div
            key={i}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-hidden">
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayItems = itemsByDate.get(key) || [];

          return (
            <div
              key={i}
              className={`border-b border-r border-border p-1 overflow-hidden flex flex-col ${
                !isCurrentMonth ? 'bg-muted/30' : ''
              } ${isToday ? 'bg-blue-50/50' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : !isCurrentMonth
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayItems.length - 3}
                  </span>
                )}
              </div>

              {/* Items (max 3 visible) */}
              <div className="flex-1 overflow-hidden space-y-0.5">
                {dayItems.slice(0, 3).map(item => {
                  const Icon = TYPE_ICONS[item.type];
                  const statusCfg = statusMap[item.status || ''];
                  const typeColor = getTypeColor(item.type, referentiels?.typeLabels);
                  const isHighlighted =
                    (highlightType ? item.type === highlightType : false) ||
                    (highlightStatus
                      ? highlightStatus === 'undefined'
                        ? !item.status
                        : item.status === highlightStatus
                      : false);
                  const isDimmed =
                    (highlightType ? item.type !== highlightType : false) ||
                    (highlightStatus
                      ? highlightStatus === 'undefined'
                        ? !!item.status
                        : item.status !== highlightStatus
                      : false) ||
                    (searchMatchIds ? !searchMatchIds.has(item.id) : false);
                  const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));

                  return (
                    <button
                      key={item.id}
                      onClick={() => onEdit(item.id)}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1 hover:ring-1 hover:ring-ring transition-all ${
                        isHighlighted && highlightColor
                          ? `${highlightColor.bg} ${highlightColor.border} border-l-2`
                          : `${typeColor.bg} border-l-2 ${typeColor.color}`
                      } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-30' : ''}`}
                      title={`${item.title}${statusCfg ? ` — ${statusCfg.label}` : ''}`}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
