import { useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
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

// Get status color from referentiels
function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
  if (!status) return 'bg-gray-400';
  const statusConfig = statuses.find(s => s.id === status);
  if (!statusConfig) return 'bg-gray-400';
  // Extract color from borderColor (e.g., "border-yellow-500 bg-yellow-50" -> yellow)
  const match = statusConfig.borderColor.match(/border-(\w+)-/);
  if (match) {
    const colorName = match[1];
    return `bg-${colorName}-500`;
  }
  return 'bg-gray-400';
}

interface TimelineItem extends Item {
  startDate: string;
  endDate?: string | null;
}

export function TimelineView({ items, onEdit, onDelete: _onDelete, onUpdateStatus: _onUpdateStatus, onAddChild: _onAddChild, referentiels }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleStartDate, setVisibleStartDate] = useState<Date>(() => {
    const today = new Date();
    return startOfDay(addDays(today, -7)); // Start a week before today
  });
  const [daysToShow, setDaysToShow] = useState(28); // 4 weeks by default
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  // Filter items that have dates
  const timelineItems = useMemo(() => {
    return items.filter((item): item is TimelineItem => {
      return !!(item.startDate || item.dueDate);
    }).map(item => ({
      ...item,
      // Use startDate or dueDate as start
      startDate: item.startDate || item.dueDate!,
      // Use endDate, or if only dueDate, make it a single day
      endDate: item.endDate || item.dueDate || item.startDate,
    }));
  }, [items]);

  // Items without dates
  const itemsWithoutDates = useMemo(() => {
    return items.filter(item => !item.startDate && !item.dueDate);
  }, [items]);

  // Calculate the date range
  const visibleEndDate = useMemo(() => {
    return addDays(visibleStartDate, daysToShow);
  }, [visibleStartDate, daysToShow]);

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

  // Calculate bar position for an item
  const getBarStyle = (item: TimelineItem) => {
    const itemStart = startOfDay(new Date(item.startDate));
    const itemEnd = startOfDay(new Date(item.endDate || item.startDate));

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
          <span className="text-sm text-muted-foreground">{timelineItems.length} éléments planifiés</span>
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
              <div className="w-64 flex-shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground border-r bg-muted/50">
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
              <div className="w-64 flex-shrink-0 px-3 py-2 text-sm font-medium border-r bg-muted/50">
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

          {/* Items rows */}
          {timelineItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun élément avec des dates</p>
              <p className="text-sm">Ajoutez des dates de début/fin à vos éléments pour les voir ici</p>
            </div>
          ) : (
            timelineItems.map((item) => {
              const barStyle = getBarStyle(item);
              const Icon = TYPE_ICONS[item.type];
              const statusColor = getStatusColor(item.status, statuses);

              return (
                <div
                  key={item.id}
                  className="flex border-b hover:bg-muted/30 group"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Item label */}
                  <div
                    className="w-64 flex-shrink-0 px-3 py-2 border-r flex items-center gap-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => onEdit(item.id)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-sm">{item.title}</span>
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
                        className={`absolute top-1 h-8 rounded cursor-pointer transition-all ${statusColor} ${
                          hoveredItem === item.id ? 'ring-2 ring-primary shadow-lg' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          left: barStyle.left + 2,
                          width: barStyle.width,
                        }}
                        onClick={() => onEdit(item.id)}
                        title={`${item.title}\n${formatDateShort(new Date(item.startDate))} - ${formatDateShort(new Date(item.endDate || item.startDate))}`}
                      >
                        <div className="px-2 py-1 text-xs text-white truncate font-medium">
                          {item.title}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Items without dates section */}
          {itemsWithoutDates.length > 0 && (
            <div className="border-t-2 border-dashed">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  {itemsWithoutDates.length} élément(s) sans date
                </span>
              </div>
              {itemsWithoutDates.slice(0, 5).map((item) => {
                const Icon = TYPE_ICONS[item.type];
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() => onEdit(item.id)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Cliquer pour ajouter des dates</span>
                  </div>
                );
              })}
              {itemsWithoutDates.length > 5 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Et {itemsWithoutDates.length - 5} autre(s)...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
