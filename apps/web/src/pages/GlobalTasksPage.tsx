import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUp,
  ArrowDown,
  FolderKanban,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { userTasksApi, spacesApi, itemsApi } from '../lib/api';
import type { GlobalTaskFilters, GlobalTask } from '../lib/api';
import type { Item } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ItemEditModal } from '../components/ItemEditModal';
import { STATUS_LABELS, STATUS_COLORS } from '../constants/ui';

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critique', color: 'bg-red-100 text-red-800' },
  2: { label: 'Haute', color: 'bg-orange-100 text-orange-800' },
  3: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
  4: { label: 'Basse', color: 'bg-blue-100 text-blue-800' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

type SortField = GlobalTaskFilters['sortBy'];

export function GlobalTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [spaceFilter, setSpaceFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Modal state
  const [editingTask, setEditingTask] = useState<{
    itemId: string;
    spaceId: string;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch spaces for filter dropdown
  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: [
      'global-tasks',
      debouncedSearch,
      statusFilter,
      priorityFilter,
      spaceFilter,
      sortBy,
      sortDir,
      page,
    ],
    queryFn: () =>
      userTasksApi.list({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter ? parseInt(priorityFilter, 10) : undefined,
        spaceId: spaceFilter || undefined,
        sortBy,
        sortDir,
        page,
        pageSize: 30,
      }),
  });

  // Fetch allItems for space when editing a task (needed by ItemEditModal)
  const { data: spaceItemsData } = useQuery({
    queryKey: ['items', editingTask?.spaceId, { pageSize: 5000 }],
    queryFn: () => itemsApi.list(editingTask!.spaceId, { pageSize: 5000 }),
    enabled: !!editingTask,
  });

  // Sort toggle
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortBy]
  );

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Tous les statuts' },
      { value: 'none', label: 'Non defini' },
      { value: 'todo', label: 'A faire' },
      { value: 'in_progress', label: 'En cours' },
      { value: 'done', label: 'Termine' },
      { value: 'cancelled', label: 'Annule' },
    ],
    []
  );

  // Priority options
  const priorityOptions = useMemo(
    () => [
      { value: '', label: 'Toutes' },
      { value: '1', label: 'Critique' },
      { value: '2', label: 'Haute' },
      { value: '3', label: 'Moyenne' },
      { value: '4', label: 'Basse' },
    ],
    []
  );

  // Space options
  const spaceOptions = useMemo(
    () => [
      { value: '', label: 'Tous les espaces' },
      ...(spaces || []).map((s) => ({ value: s.id, label: s.name })),
    ],
    [spaces]
  );

  const tasks = tasksData?.data || [];
  const total = tasksData?.total || 0;
  const totalPages = tasksData?.totalPages || 0;

  const SortHeader = ({
    label,
    field,
    className = '',
  }: {
    label: string;
    field: SortField;
    className?: string;
  }) => (
    <button
      className={`flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortBy === field &&
        (sortDir === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        ))}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <CheckSquare className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Mes taches</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              ({total} tache{total > 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 h-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={statusOptions}
            className="h-8 text-sm w-[160px]"
          />
          <Select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            options={priorityOptions}
            className="h-8 text-sm w-[130px]"
          />
          <Select
            value={spaceFilter}
            onChange={(e) => {
              setSpaceFilter(e.target.value);
              setPage(1);
            }}
            options={spaceOptions}
            className="h-8 text-sm w-[200px]"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_10rem_7rem_6rem_7rem_7rem] items-center gap-2 px-6 py-2 border-b border-border bg-muted/50 flex-shrink-0">
        <SortHeader label="Titre" field="title" />
        <SortHeader label="Espace" field="spaceName" />
        <SortHeader label="Statut" field="status" />
        <SortHeader label="Priorite" field="priority" />
        <SortHeader label="Echeance" field="dueDate" />
        <SortHeader label="Cree le" field="createdAt" />
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Chargement...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <CheckSquare className="w-10 h-10 opacity-30" />
            <p>Aucune tache trouvee</p>
          </div>
        ) : (
          tasks.map((task: GlobalTask) => (
            <div
              key={task.id}
              className="grid grid-cols-[1fr_10rem_7rem_6rem_7rem_7rem] items-center gap-2 px-6 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() =>
                setEditingTask({ itemId: task.id, spaceId: task.spaceId })
              }
            >
              {/* Title */}
              <div className="flex items-center gap-2 min-w-0">
                <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate font-medium text-sm">
                  {task.title}
                </span>
                {task.parent && (
                  <span className="text-xs text-muted-foreground truncate flex-shrink-0">
                    ← {task.parent.title}
                  </span>
                )}
              </div>

              {/* Space */}
              <div>
                <button
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/spaces/${task.spaceId}`);
                  }}
                  title={task.spaceName}
                >
                  <FolderKanban className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{task.spaceName}</span>
                </button>
              </div>

              {/* Status */}
              <div>
                {task.status ? (
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">-</span>
                )}
              </div>

              {/* Priority */}
              <div>
                {task.priority ? (
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                      PRIORITY_LABELS[task.priority]?.color ||
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {PRIORITY_LABELS[task.priority]?.label || `P${task.priority}`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">-</span>
                )}
              </div>

              {/* Due date */}
              <div>
                {task.dueDate ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled'
                        ? 'text-red-600 font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled' && (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {formatDate(task.dueDate)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">-</span>
                )}
              </div>

              {/* Created at */}
              <div className="text-xs text-muted-foreground">
                {formatDate(task.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingTask && (
        <ItemEditModal
          isOpen={!!editingTask}
          onClose={() => {
            setEditingTask(null);
            queryClient.invalidateQueries({ queryKey: ['global-tasks'] });
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
