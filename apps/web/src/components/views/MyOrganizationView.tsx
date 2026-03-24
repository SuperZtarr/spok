import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  Clock,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Flame,
  GripVertical,
  CheckCircle2,
  Loader2,
  Target,
} from 'lucide-react';
import { userTasksApi, spacesApi } from '../../lib/api';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS } from '@spok/shared';
import type { GlobalTask } from '../../lib/api';
import { getPriorityConfig, TYPE_ICONS } from '../../constants/ui';
import { useGlobalTaskFilters } from '../../hooks/useGlobalTaskFilters';
import { GlobalTaskFilterBar } from '../GlobalTaskFilterBar';
import { ItemEditModal } from '../ItemEditModal';
import { Badge } from '../ui/Badge';
import { DeadlinesView } from './DeadlinesView';
import { GlobalTasksPage } from '../../pages/GlobalTasksPage';

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
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
}
function getDaysOfMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const offset = startDay === 0 ? -6 : 1 - startDay;
  const start = new Date(year, month, offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

const DONE_STATUSES = ['done', 'cancelled'];

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
// Distribution Bar
// ---------------------------------------------------------------------------

const STATUS_BAR_COLORS: Record<string, string> = {
  undefined: '#94a3b8', todo: '#eab308', in_progress: '#f97316', late: '#ef4444',
  to_validate: '#a855f7', done: '#22c55e', cancelled: '#9ca3af',
};

const TYPE_BAR_COLORS: Record<string, string> = {
  NOTE: '#3b82f6', PROJECT: '#a855f7', TASK: '#22c55e', MEETING: '#f97316',
  PERIOD: '#14b8a6', LINK: '#06b6d4', CONFIG: '#6b7280', DOCUMENT: '#f59e0b',
  IMAGE: '#ec4899', BUG: '#ef4444', DIAGRAM: '#6366f1',
};

function DistributionBar({ counts, total, colorMap }: { counts: { id: string; label: string; count: number }[]; total: number; colorMap: Record<string, string> }) {
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-4">Aucun élément</p>;
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex h-6 rounded-full overflow-hidden">
        {counts.filter(s => s.count > 0).map(s => (
          <div key={s.id} className="h-full transition-all" style={{ width: `${(s.count / total) * 100}%`, backgroundColor: colorMap[s.id] || '#94a3b8' }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {counts.filter(s => s.count > 0).map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[s.id] || '#94a3b8' }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress per space
// ---------------------------------------------------------------------------

function SpaceProgressBar({ name, done, total }: { name: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <span className="text-sm truncate min-w-0 flex-1">{name}</span>
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">{done}/{total} ({pct}%)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Row
// ---------------------------------------------------------------------------

function TaskRowContent({ task, isOverdue, showGrip }: { task: GlobalTask; isOverdue: boolean; showGrip?: boolean }) {
  const Icon = TYPE_ICONS[task.type] || TYPE_ICONS.NOTE;
  const pConfig = getPriorityConfig(task.priority);

  return (
    <>
      {showGrip && (
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 cursor-grab" />
      )}
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate text-sm">{task.title}</span>
      {pConfig && (
        <span className={`text-[10px] font-bold ${pConfig.textColor} flex-shrink-0`} title={pConfig.label}>
          {pConfig.shortLabel}
        </span>
      )}
      <Badge variant="outline" className="text-[10px] flex-shrink-0">
        {task.spaceName}
      </Badge>
      {task.dueDate && (
        <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </>
  );
}

function TaskRow({ task, onEdit }: { task: GlobalTask; onEdit: (id: string) => void }) {
  const isOverdue = !!(task.dueDate && new Date(task.dueDate) < new Date() && !DONE_STATUSES.includes(task.status || ''));

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
      onClick={() => onEdit(task.id)}
    >
      <TaskRowContent task={task} isOverdue={isOverdue} />
    </div>
  );
}

function SortableTaskRow({ task, onEdit }: { task: GlobalTask; onEdit: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const isOverdue = !!(task.dueDate && new Date(task.dueDate) < new Date() && !DONE_STATUSES.includes(task.status || ''));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-grab transition-colors ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''} ${isDragging ? 'shadow-lg z-50 bg-card' : ''}`}
      onClick={() => onEdit(task.id)}
    >
      <TaskRowContent task={task} isOverdue={isOverdue} showGrip />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ title, icon, count, children, variant = 'default' }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 py-1">
        {icon}
        <h3 className={`text-sm font-semibold ${variant === 'danger' ? 'text-red-600' : ''}`}>{title}</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${variant === 'danger' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MyOrganizationView
// ---------------------------------------------------------------------------

export function MyOrganizationView() {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [priorityOrder, setPriorityOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filters = useGlobalTaskFilters({
    defaultTypes: ['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'],
    defaultSortBy: 'priority',
    defaultSortDir: 'desc',
    pageSize: 2000,
  });

  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Fetch all non-done items using filter params
  const { data: allData } = useQuery({
    queryKey: ['my-organization', filters.queryParams],
    queryFn: () => userTasksApi.list({
      ...filters.queryParams,
      status: filters.queryParams.status || 'none,todo,in_progress,to_validate,late',
    }),
  });

  // Fetch done items for KPIs
  const weekStart = getMonday(addDays(today, weekOffset * 7));
  const { data: doneData } = useQuery({
    queryKey: ['my-organization-done', localDateKey(weekStart)],
    queryFn: () => userTasksApi.list({
      type: 'NOTE,PROJECT,TASK,MEETING,PERIOD,LINK,CONFIG,DOCUMENT,IMAGE,BUG,DIAGRAM',
      status: 'done',
      pageSize: 2000,
    }),
  });

  // Fetch spaces for progress
  const { data: spaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  const rawAllTasks = allData?.data || [];
  const rawDoneTasks = doneData?.data || [];

  // Filter by selected communities (client-side)
  const allTasks = useMemo(() => {
    if (filters.selectedCommunities.length === 0) return rawAllTasks;
    return rawAllTasks.filter(t => t.communityId && filters.selectedCommunities.includes(t.communityId));
  }, [rawAllTasks, filters.selectedCommunities]);

  const doneTasks = useMemo(() => {
    if (filters.selectedCommunities.length === 0) return rawDoneTasks;
    return rawDoneTasks.filter(t => t.communityId && filters.selectedCommunities.includes(t.communityId));
  }, [rawDoneTasks, filters.selectedCommunities]);

  // --- Priorities (P1 + P2, non terminés) ---
  const rawPriorityTasks = useMemo(() =>
    allTasks.filter(t => t.priority && t.priority >= 3)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [allTasks]
  );

  // Sync priorityOrder when raw data changes (new items, removed items)
  useEffect(() => {
    const rawIds = rawPriorityTasks.map(t => t.id);
    setPriorityOrder(prev => {
      // Keep existing order for known items, append new ones at the end
      const existing = prev.filter(id => rawIds.includes(id));
      const added = rawIds.filter(id => !prev.includes(id));
      if (existing.length === rawIds.length && added.length === 0) return prev;
      return [...existing, ...added];
    });
  }, [rawPriorityTasks]);

  const priorityTasks = useMemo(() => {
    const taskMap = new Map(rawPriorityTasks.map(t => [t.id, t]));
    return priorityOrder
      .map(id => taskMap.get(id))
      .filter((t): t is GlobalTask => !!t);
  }, [rawPriorityTasks, priorityOrder]);

  const handlePriorityDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPriorityOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // --- Overdue ---
  const overdueTasks = useMemo(() =>
    allTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < today && !DONE_STATUSES.includes(t.status || '')
    ).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [allTasks, today]
  );

  // --- Today ---
  const todayTasks = useMemo(() =>
    allTasks.filter(t => {
      if (!t.dueDate && !t.startDate) return false;
      const d = new Date(t.dueDate || t.startDate!);
      return d >= today && d <= todayEnd;
    }),
    [allTasks, today, todayEnd]
  );

  // --- KPI computed ---
  const inProgressTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'in_progress'),
    [allTasks]
  );


  const toValidateTasks = useMemo(() =>
    allTasks.filter(t => t.status === 'to_validate'),
    [allTasks]
  );

  const doneThisWeekCount = useMemo(() => {
    const wStart = getMonday(today);
    const wEnd = addDays(wStart, 7);
    return doneTasks.filter(t => {
      const d = new Date(t.updatedAt);
      return d >= wStart && d < wEnd;
    }).length;
  }, [doneTasks, today]);

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
    const statsMap = new Map<string, { name: string; done: number; total: number }>();
    for (const t of allTasks) {
      if (!statsMap.has(t.spaceId)) statsMap.set(t.spaceId, { name: t.spaceName, done: 0, total: 0 });
      statsMap.get(t.spaceId)!.total++;
    }
    for (const t of doneTasks) {
      if (!statsMap.has(t.spaceId)) statsMap.set(t.spaceId, { name: t.spaceName, done: 0, total: 0 });
      statsMap.get(t.spaceId)!.total++;
      statsMap.get(t.spaceId)!.done++;
    }
    return Array.from(statsMap.values()).filter(s => s.total > 0).sort((a, b) => (a.done / a.total) - (b.done / b.total));
  }, [allTasks, doneTasks, spaces]);

  // --- Week view ---
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekTasksByDay = useMemo(() => {
    const map = new Map<string, GlobalTask[]>();
    for (const day of weekDays) {
      const key = day.toISOString().slice(0, 10);
      map.set(key, []);
    }
    for (const t of allTasks) {
      const dateStr = t.dueDate || t.startDate;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = d.toISOString().slice(0, 10);
      if (map.has(key)) {
        map.get(key)!.push(t);
      }
    }
    return map;
  }, [allTasks, weekDays]);

  // --- Month view ---
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthDays = getDaysOfMonth(monthDate.getFullYear(), monthDate.getMonth());

  const monthTasksByDay = useMemo(() => {
    const map = new Map<string, GlobalTask[]>();
    for (const t of allTasks) {
      const dateStr = t.dueDate || t.startDate;
      if (!dateStr) continue;
      const key = new Date(dateStr).toISOString().slice(0, 10);
      const existing = map.get(key) || [];
      existing.push(t);
      map.set(key, existing);
    }
    return map;
  }, [allTasks]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">

      {/* KPI Banner */}
      <div className="flex flex-wrap gap-3" data-tour="dashboard-kpis">
        <KpiBadge label="en retard" count={overdueTasks.length}
          color={overdueTasks.length > 0 ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' : 'border-border text-muted-foreground'}
          icon={AlertTriangle} />
        <KpiBadge label="aujourd'hui" count={todayTasks.length}
          color={todayTasks.length > 0 ? 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' : 'border-border text-muted-foreground'}
          icon={Clock} />
        <KpiBadge label="en cours" count={inProgressTasks.length}
          color={inProgressTasks.length > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' : 'border-border text-muted-foreground'}
          icon={Loader2} />
        <KpiBadge label="à valider" count={toValidateTasks.length}
          color={toValidateTasks.length > 0 ? 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' : 'border-border text-muted-foreground'}
          icon={Target} />
        <KpiBadge label="terminés cette sem." count={doneThisWeekCount}
          color={doneThisWeekCount > 0 ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 dark:border-green-800' : 'border-border text-muted-foreground'}
          icon={CheckCircle2} />
      </div>

      {/* Filtres */}
      <div className="bg-card border rounded-lg p-4" data-tour="org-filters">
        <GlobalTaskFilterBar filters={filters} />
      </div>

      {/* Priorités + En retard + Aujourd'hui */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-tour="org-priorities">

        {/* Priorités */}
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <Section
            title="Priorités"
            icon={<Flame className="w-4 h-4 text-orange-500" />}
            count={priorityTasks.length}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityDragEnd}>
              <SortableContext items={priorityTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {priorityTasks.map(t => <SortableTaskRow key={t.id} task={t} onEdit={setEditingItemId} />)}
                </div>
              </SortableContext>
            </DndContext>
          </Section>
          {priorityTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune priorité haute</p>
          )}
        </div>

        {/* En retard */}
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <Section
            title="En retard"
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
            count={overdueTasks.length}
            variant="danger"
          >
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {overdueTasks.map(t => <TaskRow key={t.id} task={t} onEdit={setEditingItemId} />)}
            </div>
          </Section>
          {overdueTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Rien en retard</p>
          )}
        </div>

        {/* Aujourd'hui */}
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <Section
            title="Aujourd'hui"
            icon={<Clock className="w-4 h-4 text-blue-500" />}
            count={todayTasks.length}
          >
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {todayTasks.map(t => <TaskRow key={t.id} task={t} onEdit={setEditingItemId} />)}
            </div>
          </Section>
          {todayTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Rien pour aujourd'hui</p>
          )}
        </div>
      </div>

      {/* Semaine */}
      <div className="bg-card border rounded-lg p-4" data-tour="org-week">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Semaine</h3>
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
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const key = day.toISOString().slice(0, 10);
            const tasks = weekTasksByDay.get(key) || [];
            const isToday = isSameDay(day, today);
            const isPast = day < today && !isToday;
            return (
              <div
                key={key}
                className={`border rounded-md p-2 min-h-[100px] ${isToday ? 'border-primary bg-primary/5' : isPast ? 'bg-muted/30' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {formatShortDate(day)}
                </div>
                <div className="space-y-0.5">
                  {tasks.slice(0, 4).map(t => {
                    const pConfig = getPriorityConfig(t.priority);
                    const Icon = TYPE_ICONS[t.type] || TYPE_ICONS.NOTE;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[11px] hover:bg-accent cursor-pointer truncate"
                        onClick={() => setEditingItemId(t.id)}
                        title={`${t.title} — ${t.spaceName}`}
                      >
                        <Icon className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                        {pConfig && <span className={`${pConfig.textColor} font-bold flex-shrink-0`}>{pConfig.shortLabel}</span>}
                        <span className="truncate">{t.title}</span>
                      </div>
                    );
                  })}
                  {tasks.length > 4 && (
                    <div className="text-[10px] text-muted-foreground text-center">+{tasks.length - 4}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mois */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setMonthOffset(m => m - 1)} className="p-1 hover:bg-accent rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMonthOffset(0)}
              className="text-xs px-2 py-1 hover:bg-accent rounded"
            >
              Aujourd'hui
            </button>
            <button onClick={() => setMonthOffset(m => m + 1)} className="p-1 hover:bg-accent rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="text-[10px] font-medium text-muted-foreground text-center py-1">{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map(day => {
            const key = day.toISOString().slice(0, 10);
            const tasks = monthTasksByDay.get(key) || [];
            const isToday = isSameDay(day, today);
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            return (
              <div
                key={key}
                className={`border rounded-sm p-1 min-h-[48px] ${isToday ? 'border-primary bg-primary/5' : !isCurrentMonth ? 'bg-muted/20 opacity-50' : ''}`}
              >
                <div className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {day.getDate()}
                </div>
                {tasks.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {tasks.slice(0, 3).map(t => {
                      const pConfig = getPriorityConfig(t.priority);
                      return (
                        <div
                          key={t.id}
                          className={`w-2 h-2 rounded-full cursor-pointer ${pConfig ? pConfig.textColor.replace('text-', 'bg-') : 'bg-blue-400'}`}
                          title={`${t.title} — ${t.spaceName}`}
                          onClick={() => setEditingItemId(t.id)}
                        />
                      );
                    })}
                    {tasks.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">+{tasks.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Target className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold">Répartition par statut</h3>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{statusDistribution.total}</span>
          </div>
          <DistributionBar counts={statusDistribution.counts} total={statusDistribution.total} colorMap={STATUS_BAR_COLORS} />
        </div>
        <div className="bg-card border rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Flame className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold">Répartition par type</h3>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{typeDistribution.total}</span>
          </div>
          <DistributionBar counts={typeDistribution.counts} total={typeDistribution.total} colorMap={TYPE_BAR_COLORS} />
        </div>
      </div>

      {/* Progression par espace */}
      {spaceProgress.length > 0 && (
        <div className="bg-card border rounded-lg border-green-200 dark:border-green-900">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold">Progression par espace</h3>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{spaceProgress.length}</span>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {spaceProgress.map(s => (
              <SpaceProgressBar key={s.name} name={s.name} done={s.done} total={s.total} />
            ))}
          </div>
        </div>
      )}

      {/* Échéances */}
      <div className="bg-card border rounded-lg p-4">
        <DeadlinesView embedded />
      </div>

      {/* Toutes les tâches */}
      <div className="bg-card border rounded-lg p-4">
        <GlobalTasksPage externalFilters={filters} />
      </div>

      {/* Edit modal */}
      <ItemEditModal
        isOpen={!!editingItemId}
        onClose={() => setEditingItemId(null)}
        spaceId={allTasks.find(t => t.id === editingItemId)?.spaceId || ''}
        itemId={editingItemId}
        allItems={allTasks as any}
        onNavigate={setEditingItemId}
      />
    </div>
  );
}
