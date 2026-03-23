import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Loader2,
  Target,
} from 'lucide-react';
import { userTasksApi, spacesApi } from '../../lib/api';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS } from '@spok/shared';
import type { GlobalTask } from '../../lib/api';
import { getPriorityConfig, TYPE_ICONS } from '../../constants/ui';
import { ItemEditModal } from '../ItemEditModal';
import { Badge } from '../ui/Badge';
import { GanttChart } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatShortDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}
function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DONE_STATUSES = ['done', 'cancelled'];

// ---------------------------------------------------------------------------
// KPI Badge
// ---------------------------------------------------------------------------

function KpiBadge({ label, count, color, icon: Icon }: {
  label: string;
  count: number;
  color: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact Task Row
// ---------------------------------------------------------------------------

function CompactTaskRow({ task, onEdit, showDaysLate }: {
  task: GlobalTask;
  onEdit: (id: string) => void;
  showDaysLate?: boolean;
}) {
  const Icon = TYPE_ICONS[task.type] || TYPE_ICONS.NOTE;
  const pConfig = getPriorityConfig(task.priority);
  const isOverdue = !!(task.dueDate && new Date(task.dueDate) < new Date() && !DONE_STATUSES.includes(task.status || ''));

  const daysLate = showDaysLate && task.dueDate
    ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000)
    : 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
      onClick={() => onEdit(task.id)}
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate text-sm">{task.title}</span>
      {pConfig && (
        <span className={`text-[10px] font-bold ${pConfig.textColor} flex-shrink-0`}>
          {pConfig.shortLabel}
        </span>
      )}
      <Badge variant="outline" className="text-[10px] flex-shrink-0 max-w-[80px] truncate">
        {task.spaceName}
      </Badge>
      {showDaysLate && daysLate > 0 && (
        <span className="text-[10px] text-red-600 font-medium flex-shrink-0 whitespace-nowrap">
          -{daysLate}j
        </span>
      )}
      {!showDaysLate && task.dueDate && (
        <span className={`text-[10px] flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Panel
// ---------------------------------------------------------------------------

function Panel({ title, icon, count, children, variant = 'default', emptyMessage, className = '' }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  emptyMessage?: string;
  className?: string;
}) {
  const variantStyles = {
    default: '',
    danger: 'border-red-200 dark:border-red-900',
    warning: 'border-orange-200 dark:border-orange-900',
    success: 'border-green-200 dark:border-green-900',
  };
  const countStyles = {
    default: 'bg-muted text-muted-foreground',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    warning: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <div className={`bg-card border rounded-lg flex flex-col ${variantStyles[variant]} ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${countStyles[variant]}`}>
          {count}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage || 'Rien ici'}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Distribution Bar
// ---------------------------------------------------------------------------

const STATUS_BAR_COLORS: Record<string, string> = {
  undefined: '#94a3b8', // slate
  todo: '#eab308',      // yellow
  in_progress: '#f97316', // orange
  late: '#ef4444',      // red
  to_validate: '#a855f7', // purple
  done: '#22c55e',      // green
  cancelled: '#9ca3af', // gray
};

const TYPE_BAR_COLORS: Record<string, string> = {
  NOTE: '#3b82f6',      // blue
  PROJECT: '#a855f7',   // purple
  TASK: '#22c55e',      // green
  MEETING: '#f97316',   // orange
  PERIOD: '#14b8a6',    // teal
  LINK: '#06b6d4',      // cyan
  CONFIG: '#6b7280',    // gray
  DOCUMENT: '#f59e0b',  // amber
  IMAGE: '#ec4899',     // pink
  BUG: '#ef4444',       // red
  DIAGRAM: '#6366f1',   // indigo
};

function DistributionBar({ counts, total, colorMap }: { counts: { id: string; label: string; count: number }[]; total: number; colorMap: Record<string, string> }) {
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-4">Aucun élément</p>;
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex h-6 rounded-full overflow-hidden">
        {counts.filter(s => s.count > 0).map(s => (
          <div
            key={s.id}
            className="h-full transition-all"
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: colorMap[s.id] || '#94a3b8' }}
            title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {counts.filter(s => s.count > 0).map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[s.id] || '#94a3b8' }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{s.count}</span>
            <span className="text-muted-foreground">({Math.round((s.count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar per space
// ---------------------------------------------------------------------------

function SpaceProgressBar({ name, done, total }: { name: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <span className="text-sm truncate min-w-0 flex-1">{name}</span>
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden flex-shrink-0">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">
        {done}/{total} ({pct}%)
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini Gantt Widget
// ---------------------------------------------------------------------------

const GANTT_STATUS_COLORS: Record<string, string> = {
  undefined: 'bg-slate-400',
  todo: 'bg-yellow-500',
  in_progress: 'bg-orange-500',
  to_validate: 'bg-violet-500',
  done: 'bg-green-500',
  cancelled: 'bg-gray-400',
};

function MiniGantt({ tasks, onEdit }: { tasks: GlobalTask[]; onEdit: (id: string) => void }) {
  const today = startOfDay(new Date());

  // Filter tasks that have at least a dueDate or startDate
  const ganttTasks = useMemo(() => {
    return tasks
      .filter(t => t.dueDate || t.startDate)
      .map(t => {
        const start = t.startDate ? startOfDay(new Date(t.startDate)) : t.dueDate ? startOfDay(new Date(t.dueDate)) : today;
        const end = t.endDate ? startOfDay(new Date(t.endDate)) : t.dueDate ? startOfDay(new Date(t.dueDate)) : start;
        return { ...t, ganttStart: start, ganttEnd: end };
      })
      .sort((a, b) => a.ganttStart.getTime() - b.ganttStart.getTime());
  }, [tasks, today]);

  if (ganttTasks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Aucun élément avec échéance</p>;
  }

  // Compute date range: from min(today-7, earliest start) to max(latest end, today+30)
  const minDate = useMemo(() => {
    const earliest = ganttTasks.reduce((min, t) => t.ganttStart < min ? t.ganttStart : min, ganttTasks[0].ganttStart);
    const weekAgo = addDays(today, -7);
    return earliest < weekAgo ? earliest : weekAgo;
  }, [ganttTasks, today]);

  const maxDate = useMemo(() => {
    const latest = ganttTasks.reduce((max, t) => t.ganttEnd > max ? t.ganttEnd : max, ganttTasks[0].ganttEnd);
    const monthAhead = addDays(today, 30);
    return latest > monthAhead ? latest : monthAhead;
  }, [ganttTasks, today]);

  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);

  // Generate month markers
  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = [];
    let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (d <= maxDate) {
      const monthStart = d < minDate ? minDate : d;
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthEnd = nextMonth > maxDate ? maxDate : addDays(nextMonth, -1);
      const left = Math.ceil((monthStart.getTime() - minDate.getTime()) / 86400000);
      const width = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86400000) + 1;
      result.push({
        label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        left: (left / totalDays) * 100,
        width: (width / totalDays) * 100,
      });
      d = nextMonth;
    }
    return result;
  }, [minDate, maxDate, totalDays]);

  // Today marker position
  const todayPos = ((today.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;

  return (
    <div className="space-y-0">
      {/* Month headers */}
      <div className="relative h-5 mb-1 mx-2">
        {months.map((m, i) => (
          <div
            key={i}
            className="absolute text-[10px] text-muted-foreground font-medium border-l border-border pl-1 truncate"
            style={{ left: `${m.left}%`, width: `${m.width}%` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Gantt rows */}
      <div className="relative">
        {/* Today line */}
        {todayPos >= 0 && todayPos <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
            style={{ left: `${todayPos}%` }}
          />
        )}

        {ganttTasks.map(t => {
          const barStart = Math.max(0, (t.ganttStart.getTime() - minDate.getTime()) / 86400000);
          const barEnd = (t.ganttEnd.getTime() - minDate.getTime()) / 86400000;
          const barWidth = Math.max(0.5, barEnd - barStart + 1);
          const leftPct = (barStart / totalDays) * 100;
          const widthPct = (barWidth / totalDays) * 100;
          const isOverdue = t.dueDate && new Date(t.dueDate) < today && !DONE_STATUSES.includes(t.status || '');
          const statusColor = GANTT_STATUS_COLORS[t.status || 'undefined'] || GANTT_STATUS_COLORS.undefined;

          return (
            <div
              key={t.id}
              className="flex items-center h-7 hover:bg-accent/50 cursor-pointer group px-2"
              onClick={() => onEdit(t.id)}
            >
              {/* Label */}
              <div className="w-[140px] flex-shrink-0 flex items-center gap-1 min-w-0 pr-2">
                <span className={`text-[11px] truncate ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  {t.title}
                </span>
              </div>
              {/* Bar area */}
              <div className="flex-1 relative h-5">
                <div
                  className={`absolute top-0.5 h-4 rounded-sm ${statusColor} ${isOverdue ? 'ring-1 ring-red-500' : ''} opacity-80 group-hover:opacity-100 transition-opacity`}
                  style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
                  title={`${t.title}\n${t.spaceName}\n${t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : ''}`}
                >
                  {widthPct > 5 && (
                    <span className="text-[9px] text-white px-1 truncate block leading-4">
                      {t.dueDate && new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardCockpitView
// ---------------------------------------------------------------------------

export function DashboardCockpitView() {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Fetch all non-done items
  const { data: allData, isLoading } = useQuery({
    queryKey: ['dashboard-cockpit'],
    queryFn: () => userTasksApi.list({
      type: 'NOTE,PROJECT,TASK,MEETING,PERIOD,LINK,CONFIG,DOCUMENT,IMAGE,BUG,DIAGRAM',
      status: 'none,todo,in_progress,to_validate',
      pageSize: 500,
    }),
  });

  // Fetch done items this week for KPI
  const weekStart = getMonday(addDays(today, weekOffset * 7));
  const { data: doneThisWeekData } = useQuery({
    queryKey: ['dashboard-cockpit-done', localDateKey(weekStart)],
    queryFn: () => userTasksApi.list({
      type: 'NOTE,PROJECT,TASK,MEETING,PERIOD,LINK,CONFIG,DOCUMENT,IMAGE,BUG,DIAGRAM',
      status: 'done',
      pageSize: 500,
    }),
  });

  // Fetch spaces for progress
  const { data: spaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  const allTasks = allData?.data || [];
  const doneTasks = doneThisWeekData?.data || [];

  // --- Computed lists ---

  const overdueTasks = useMemo(() =>
    allTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < today && !DONE_STATUSES.includes(t.status || '')
    ).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [allTasks, today]
  );

  const urgentTasks = useMemo(() =>
    allTasks.filter(t =>
      t.priority && t.priority >= 3 && !DONE_STATUSES.includes(t.status || '')
    ).sort((a, b) => {
      // Sort by priority desc, then by due date asc
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    }),
    [allTasks]
  );

  const inProgressTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'in_progress')
      .sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return aDate - bDate;
      }),
    [allTasks]
  );

  const todayTasks = useMemo(() =>
    allTasks.filter(t => {
      if (!t.dueDate && !t.startDate) return false;
      const d = new Date(t.dueDate || t.startDate!);
      return d >= today && d <= todayEnd;
    }),
    [allTasks, today, todayEnd]
  );

  const upcomingTasks = useMemo(() =>
    allTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d > todayEnd && !DONE_STATUSES.includes(t.status || '');
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [allTasks, todayEnd]
  );

  const toValidateTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'to_validate'),
    [allTasks]
  );

  // Done this week
  const doneThisWeekCount = useMemo(() => {
    const weekEnd = addDays(weekStart, 7);
    return doneTasks.filter(t => {
      const d = new Date(t.updatedAt);
      return d >= weekStart && d < weekEnd;
    }).length;
  }, [doneTasks, weekStart]);

  // --- Week view ---
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekTasksByDay = useMemo(() => {
    const map = new Map<string, GlobalTask[]>();
    for (const day of weekDays) {
      map.set(localDateKey(day), []);
    }
    for (const t of allTasks) {
      const dateStr = t.dueDate || t.startDate;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = localDateKey(d);
      if (map.has(key)) {
        map.get(key)!.push(t);
      }
    }
    return map;
  }, [allTasks, weekDays]);

  // --- Status distribution ---
  const statusDistribution = useMemo(() => {
    const allItems = [...allTasks, ...doneTasks];
    const countMap = new Map<string, number>();
    for (const t of allItems) {
      const status = t.status || 'undefined';
      countMap.set(status, (countMap.get(status) || 0) + 1);
    }
    return {
      counts: DEFAULT_STATUSES
        .filter(s => s.visible)
        .sort((a, b) => a.order - b.order)
        .map(s => ({ id: s.id, label: s.label, count: countMap.get(s.id) || 0 })),
      total: allItems.length,
    };
  }, [allTasks, doneTasks]);

  // --- Type distribution ---
  const typeDistribution = useMemo(() => {
    const allItems = [...allTasks, ...doneTasks];
    const countMap = new Map<string, number>();
    for (const t of allItems) {
      countMap.set(t.type, (countMap.get(t.type) || 0) + 1);
    }
    const typeEntries = Object.entries(DEFAULT_TYPE_LABELS)
      .map(([id, config]) => ({ id, label: config.label, count: countMap.get(id) || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);
    return { counts: typeEntries, total: allItems.length };
  }, [allTasks, doneTasks]);

  // --- Progress per space ---
  const spaceProgress = useMemo(() => {
    if (!spaces) return [];
    // Build a map of spaceId → { done, total }
    const statsMap = new Map<string, { name: string; done: number; total: number }>();

    // Count from active tasks
    for (const t of allTasks) {
      if (!statsMap.has(t.spaceId)) {
        statsMap.set(t.spaceId, { name: t.spaceName, done: 0, total: 0 });
      }
      statsMap.get(t.spaceId)!.total++;
      if (DONE_STATUSES.includes(t.status || '')) {
        statsMap.get(t.spaceId)!.done++;
      }
    }
    // Count from done tasks
    for (const t of doneTasks) {
      if (!statsMap.has(t.spaceId)) {
        statsMap.set(t.spaceId, { name: t.spaceName, done: 0, total: 0 });
      }
      statsMap.get(t.spaceId)!.total++;
      statsMap.get(t.spaceId)!.done++;
    }

    return Array.from(statsMap.values())
      .filter(s => s.total > 0)
      .sort((a, b) => {
        // Sort by % ascending (least progress first)
        const pctA = a.done / a.total;
        const pctB = b.done / b.total;
        return pctA - pctB;
      });
  }, [allTasks, doneTasks, spaces]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* KPI Banner */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-b bg-card" data-tour="dashboard-kpis">
        <KpiBadge
          label="en retard"
          count={overdueTasks.length}
          color={overdueTasks.length > 0 ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' : 'border-border text-muted-foreground'}
          icon={AlertTriangle}
        />
        <KpiBadge
          label="aujourd'hui"
          count={todayTasks.length}
          color={todayTasks.length > 0 ? 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' : 'border-border text-muted-foreground'}
          icon={Clock}
        />
        <KpiBadge
          label="en cours"
          count={inProgressTasks.length}
          color={inProgressTasks.length > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' : 'border-border text-muted-foreground'}
          icon={Loader2}
        />
        <KpiBadge
          label="à échéance"
          count={upcomingTasks.length}
          color={upcomingTasks.length > 0 ? 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800' : 'border-border text-muted-foreground'}
          icon={CalendarDays}
        />
        <KpiBadge
          label="à valider"
          count={toValidateTasks.length}
          color={toValidateTasks.length > 0 ? 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' : 'border-border text-muted-foreground'}
          icon={Target}
        />
        <KpiBadge
          label="terminés cette semaine"
          count={doneThisWeekCount}
          color={doneThisWeekCount > 0 ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 dark:border-green-800' : 'border-border text-muted-foreground'}
          icon={CheckCircle2}
        />
      </div>

      {/* Main content: 2 columns */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] gap-4 p-4 overflow-y-auto">

        {/* Left column: 3 stacked panels */}
        <div className="flex flex-col gap-4 min-h-0" data-tour="dashboard-panels">
          <Panel
            title="En retard"
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
            count={overdueTasks.length}
            variant="danger"
            emptyMessage="Rien en retard"
            className="max-h-[25%]"
          >
            <div className="space-y-0.5">
              {overdueTasks.map(t => (
                <CompactTaskRow key={t.id} task={t} onEdit={setEditingItemId} showDaysLate />
              ))}
            </div>
          </Panel>

          <Panel
            title="Urgent & Prioritaire"
            icon={<Flame className="w-4 h-4 text-orange-500" />}
            count={urgentTasks.length}
            variant="warning"
            emptyMessage="Aucune priorité haute"
            className="max-h-[25%]"
          >
            <div className="space-y-0.5">
              {urgentTasks.map(t => (
                <CompactTaskRow key={t.id} task={t} onEdit={setEditingItemId} />
              ))}
            </div>
          </Panel>

          <Panel
            title="Échéances"
            icon={<GanttChart className="w-4 h-4 text-yellow-500" />}
            count={[...overdueTasks, ...upcomingTasks, ...todayTasks].length}
            emptyMessage="Aucune échéance"
            className="flex-1"
          >
            <MiniGantt tasks={[...overdueTasks, ...upcomingTasks, ...todayTasks]} onEdit={setEditingItemId} />
          </Panel>

          <Panel
            title="En cours"
            icon={<Loader2 className="w-4 h-4 text-blue-500" />}
            count={inProgressTasks.length}
            emptyMessage="Rien en cours"
            className="max-h-[25%]"
          >
            <div className="space-y-0.5">
              {inProgressTasks.map(t => (
                <CompactTaskRow key={t.id} task={t} onEdit={setEditingItemId} />
              ))}
            </div>
          </Panel>
        </div>

        {/* Right column: week + progress */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* Week view */}
          <div className="bg-card border rounded-lg flex flex-col" style={{ height: '300px' }} data-tour="dashboard-week">
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Ma semaine</h3>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 hover:bg-accent rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs px-2 py-1 hover:bg-accent rounded"
                >
                  Aujourd'hui
                </button>
                <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 hover:bg-accent rounded">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <div className="grid grid-cols-7 gap-1 h-full">
                {weekDays.map(day => {
                  const key = localDateKey(day);
                  const tasks = weekTasksByDay.get(key) || [];
                  const isToday = isSameDay(day, today);
                  const isPast = day < today && !isToday;
                  return (
                    <div
                      key={key}
                      className={`border rounded-md p-1.5 flex flex-col ${isToday ? 'border-primary bg-primary/5' : isPast ? 'bg-muted/30' : ''}`}
                    >
                      <div className={`text-[11px] font-medium mb-1 text-center ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {formatShortDate(day)}
                      </div>
                      <div className="flex-1 space-y-0.5 overflow-y-auto">
                        {tasks.slice(0, 5).map(t => {
                          const pConfig = getPriorityConfig(t.priority);
                          const TIcon = TYPE_ICONS[t.type] || TYPE_ICONS.NOTE;
                          return (
                            <div
                              key={t.id}
                              className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] hover:bg-accent cursor-pointer truncate"
                              onClick={() => setEditingItemId(t.id)}
                              title={`${t.title} — ${t.spaceName}`}
                            >
                              <TIcon className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                              {pConfig && <span className={`${pConfig.textColor} font-bold flex-shrink-0`}>{pConfig.shortLabel}</span>}
                              <span className="truncate">{t.title}</span>
                            </div>
                          );
                        })}
                        {tasks.length > 5 && (
                          <div className="text-[9px] text-muted-foreground text-center">+{tasks.length - 5}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status distribution */}
          <div className="bg-card border rounded-lg flex flex-col" style={{ maxWidth: '600px' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Target className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold">Répartition par statut</h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {statusDistribution.total}
              </span>
            </div>
            <DistributionBar counts={statusDistribution.counts} total={statusDistribution.total} colorMap={STATUS_BAR_COLORS} />
          </div>

          {/* Type distribution */}
          <div className="bg-card border rounded-lg flex flex-col" style={{ maxWidth: '600px' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Flame className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold">Répartition par type</h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {typeDistribution.total}
              </span>
            </div>
            <DistributionBar counts={typeDistribution.counts} total={typeDistribution.total} colorMap={TYPE_BAR_COLORS} />
          </div>

          {/* Progress per space */}
          <div className="bg-card border rounded-lg flex flex-col border-green-200 dark:border-green-900" style={{ maxHeight: '1000px', maxWidth: '600px' }} data-tour="dashboard-progress">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold">Progression par espace</h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {spaceProgress.length}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {spaceProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun espace avec des items</p>
              ) : (
                <div className="space-y-0.5">
                  {spaceProgress.map(s => (
                    <SpaceProgressBar key={s.name} name={s.name} done={s.done} total={s.total} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <ItemEditModal
        isOpen={!!editingItemId}
        onClose={() => setEditingItemId(null)}
        spaceId={allTasks.find(t => t.id === editingItemId)?.spaceId || doneTasks.find(t => t.id === editingItemId)?.spaceId || ''}
        itemId={editingItemId}
        allItems={[...allTasks, ...doneTasks] as any}
        onNavigate={setEditingItemId}
      />
    </div>
  );
}
