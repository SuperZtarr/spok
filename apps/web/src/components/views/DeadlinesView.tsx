import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { userTasksApi, itemsApi } from '../../lib/api';
import type { GlobalTask } from '../../lib/api';
import type { Item } from '@spok/shared';
import { ItemEditModal } from '../ItemEditModal';
import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';
import { useGlobalTaskFilters } from '../../hooks/useGlobalTaskFilters';
import { GlobalTaskFilterBar } from '../GlobalTaskFilterBar';

const STATUS_COLOR_MAP = buildStatusColorMap();
const STATUS_LABEL_MAP = buildStatusLabelMap();

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critique', color: 'bg-red-100 text-red-800' },
  2: { label: 'Haute', color: 'bg-orange-100 text-orange-800' },
  3: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
  4: { label: 'Basse', color: 'bg-blue-100 text-blue-800' },
};

interface DeadlineGroup {
  key: string;
  label: string;
  color: string;
  icon?: 'alert';
  tasks: GlobalTask[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d >= today && d < tomorrow) return "Aujourd'hui";

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  if (d >= tomorrow && d < dayAfterTomorrow) return 'Demain';

  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function groupByDeadline(tasks: GlobalTask[]): DeadlineGroup[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (7 - now.getDay()));
  weekEnd.setHours(23, 59, 59, 999);

  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const overdue: GlobalTask[] = [];
  const today: GlobalTask[] = [];
  const thisWeek: GlobalTask[] = [];
  const thisMonth: GlobalTask[] = [];
  const later: GlobalTask[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const due = new Date(task.dueDate);

    if (due < now && task.status !== 'done' && task.status !== 'cancelled') {
      overdue.push(task);
    } else if (due <= todayEnd) {
      today.push(task);
    } else if (due <= weekEnd) {
      thisWeek.push(task);
    } else if (due <= monthEnd) {
      thisMonth.push(task);
    } else {
      later.push(task);
    }
  }

  const groups: DeadlineGroup[] = [];
  if (overdue.length > 0) groups.push({ key: 'overdue', label: 'En retard', color: 'text-red-600', icon: 'alert', tasks: overdue });
  if (today.length > 0) groups.push({ key: 'today', label: "Aujourd'hui", color: 'text-orange-600', tasks: today });
  if (thisWeek.length > 0) groups.push({ key: 'week', label: 'Cette semaine', color: 'text-yellow-600', tasks: thisWeek });
  if (thisMonth.length > 0) groups.push({ key: 'month', label: 'Ce mois', color: 'text-blue-600', tasks: thisMonth });
  if (later.length > 0) groups.push({ key: 'later', label: 'Plus tard', color: 'text-muted-foreground', tasks: later });

  return groups;
}

export function DeadlinesView({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editingTask, setEditingTask] = useState<{ itemId: string; spaceId: string } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const filters = useGlobalTaskFilters({
    defaultTypes: ['NOTE', 'TASK', 'PROJECT', 'MEETING', 'PERIOD', 'LINK', 'DOCUMENT', 'IMAGE', 'BUG'],
    defaultSortBy: 'dueDate',
    defaultSortDir: 'asc',
    pageSize: 500,
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['deadlines-view', filters.queryParams],
    queryFn: () => userTasksApi.list(filters.queryParams),
  });

  const { data: spaceItemsData } = useQuery({
    queryKey: ['items', editingTask?.spaceId, { pageSize: 5000 }],
    queryFn: () => itemsApi.list(editingTask!.spaceId, { pageSize: 5000 }),
    enabled: !!editingTask,
  });

  const tasksWithDeadline = useMemo(() => {
    if (!tasksData?.data) return [];
    return tasksData.data.filter(
      (t) => t.dueDate && (showDone || (t.status !== 'done' && t.status !== 'cancelled'))
    );
  }, [tasksData, showDone]);

  const groups = useMemo(() => groupByDeadline(tasksWithDeadline), [tasksWithDeadline]);

  const overdueCount = groups.find((g) => g.key === 'overdue')?.tasks.length || 0;
  const todayCount = groups.find((g) => g.key === 'today')?.tasks.length || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header + Filter bar */}
      <div className="px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Échéances</span>
            <span className="text-xs text-muted-foreground">({tasksWithDeadline.length})</span>
          </div>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              {overdueCount} en retard
            </span>
          )}
          {todayCount > 0 && (
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              {todayCount} aujourd'hui
            </span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="rounded"
            />
            Terminés
          </label>
        </div>
        {!embedded && <GlobalTaskFilterBar filters={filters} />}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Chargement...
        </div>
      ) : tasksWithDeadline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CalendarCheck className="w-10 h-10 opacity-30" />
          <p>Aucune échéance à venir</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 px-6 py-2 bg-muted/50 border-b border-border">
                {group.icon === 'alert' && <AlertCircle className="w-4 h-4 text-red-500" />}
                <span className={`text-sm font-semibold ${group.color}`}>{group.label}</span>
                <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
              </div>

              {group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-6 py-2.5 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setEditingTask({ itemId: task.id, spaceId: task.spaceId })}
                >
                  <div className="w-24 flex-shrink-0">
                    <span
                      className={`text-xs font-medium ${
                        group.key === 'overdue' ? 'text-red-600' : 'text-muted-foreground'
                      }`}
                    >
                      {formatDate(task.dueDate!)}
                    </span>
                  </div>
                  <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{task.title}</span>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-[140px] flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/spaces/${task.spaceId}/content`);
                    }}
                    title={task.spaceName}
                  >
                    <FolderKanban className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{task.spaceName}</span>
                  </button>
                  {task.status && (
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABEL_MAP[task.status] || task.status}
                    </span>
                  )}
                  {task.priority && (
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        PRIORITY_LABELS[task.priority]?.color || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {PRIORITY_LABELS[task.priority]?.label || `P${task.priority}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {editingTask && (
        <ItemEditModal
          isOpen={!!editingTask}
          onClose={() => {
            setEditingTask(null);
            queryClient.invalidateQueries({ queryKey: ['deadlines-view'] });
          }}
          spaceId={editingTask.spaceId}
          itemId={editingTask.itemId}
          allItems={(spaceItemsData?.data as Item[]) || []}
          canEdit={true}
          onNavigate={(newItemId) =>
            setEditingTask({ ...editingTask, itemId: newItemId })
          }
        />
      )}
    </div>
  );
}
