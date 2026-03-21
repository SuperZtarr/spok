import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  ArrowDown,
  FolderKanban,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { userTasksApi, itemsApi } from '../lib/api';
import type { GlobalTask, GlobalTaskFilters } from '../lib/api';
import type { Item } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { ItemEditModal } from '../components/ItemEditModal';
import { TYPE_LABELS } from '../constants/ui';
import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';
import { useGlobalTaskFilters, type GlobalTaskFilterState } from '../hooks/useGlobalTaskFilters';
import { GlobalTaskFilterBar } from '../components/GlobalTaskFilterBar';

const STATUS_COLOR_MAP = buildStatusColorMap();
const STATUS_LABEL_MAP = buildStatusLabelMap();

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  4: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
  3: { label: 'Haute', color: 'bg-orange-100 text-orange-800' },
  2: { label: 'Normale', color: 'bg-blue-100 text-blue-800' },
  1: { label: 'Basse', color: 'bg-gray-100 text-gray-600' },
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

const typeOptions = [
  { id: 'TASK', label: TYPE_LABELS['TASK'] || 'Tâche', color: 'bg-green-100 text-green-800 border-green-300' },
  { id: 'PROJECT', label: TYPE_LABELS['PROJECT'] || 'Projet', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'NOTE', label: TYPE_LABELS['NOTE'] || 'Note', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'MEETING', label: TYPE_LABELS['MEETING'] || 'Réunion', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'BUG', label: TYPE_LABELS['BUG'] || 'Anomalie', color: 'bg-red-100 text-red-800 border-red-300' },
  { id: 'DOCUMENT', label: TYPE_LABELS['DOCUMENT'] || 'Document', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'PERIOD', label: TYPE_LABELS['PERIOD'] || 'Période', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { id: 'LINK', label: TYPE_LABELS['LINK'] || 'Lien', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'IMAGE', label: TYPE_LABELS['IMAGE'] || 'Image', color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { id: 'DIAGRAM', label: TYPE_LABELS['DIAGRAM'] || 'Diagramme', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
];

type SortField = GlobalTaskFilters['sortBy'];

export function GlobalTasksPage({ externalFilters }: { externalFilters?: GlobalTaskFilterState }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const internalFilters = useGlobalTaskFilters();
  const filters = externalFilters || internalFilters;
  const embedded = !!externalFilters;

  // Modal state
  const [editingTask, setEditingTask] = useState<{
    itemId: string;
    spaceId: string;
  } | null>(null);

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['global-tasks', filters.queryParams],
    queryFn: () => userTasksApi.list(filters.queryParams),
  });

  // Fetch allItems for space when editing a task
  const { data: spaceItemsData } = useQuery({
    queryKey: ['items', editingTask?.spaceId, { pageSize: 5000 }],
    queryFn: () => itemsApi.list(editingTask!.spaceId, { pageSize: 5000 }),
    enabled: !!editingTask,
  });

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
      onClick={() => filters.toggleSort(field)}
    >
      {label}
      {filters.sortBy === field &&
        (filters.sortDir === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        ))}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!embedded && (
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold">Mes taches</h1>
            {total > 0 && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                ({total})
              </span>
            )}
          </div>

          <GlobalTaskFilterBar filters={filters} />
        </div>
      )}

      {/* Table header — hidden on mobile */}
      <div className="hidden md:grid grid-cols-[1fr_10rem_7rem_6rem_7rem_7rem] items-center gap-2 px-6 py-2 border-b border-border bg-muted/50 flex-shrink-0">
        <SortHeader label="Titre" field="title" />
        <SortHeader label="Espace" field="spaceName" />
        <SortHeader label="Statut" field="status" />
        <SortHeader label="Priorite" field="priority" />
        <SortHeader label="Echeance" field="dueDate" />
        <SortHeader label="Cree le" field="createdAt" />
      </div>

      {/* Mobile sort bar */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50 flex-shrink-0 overflow-x-auto">
        <span className="text-[10px] font-medium text-muted-foreground uppercase flex-shrink-0">Tri:</span>
        {([
          { label: 'Echeance', field: 'dueDate' as SortField },
          { label: 'Statut', field: 'status' as SortField },
          { label: 'Priorite', field: 'priority' as SortField },
          { label: 'Titre', field: 'title' as SortField },
        ]).map((s) => (
          <button
            key={s.field}
            onClick={() => filters.toggleSort(s.field)}
            className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
              filters.sortBy === s.field
                ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                : 'text-muted-foreground border-border'
            }`}
          >
            {s.label}
            {filters.sortBy === s.field &&
              (filters.sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
          </button>
        ))}
      </div>

      {/* Content */}
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
          <>
            {/* Desktop table rows */}
            <div className="hidden md:block">
              {tasks.map((task: GlobalTask) => (
                <div
                  key={task.id}
                  className="grid grid-cols-[1fr_10rem_7rem_6rem_7rem_7rem] items-center gap-2 px-6 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() =>
                    setEditingTask({ itemId: task.id, spaceId: task.spaceId })
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {(filters.selectedTypes.length !== 1) && (
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        typeOptions.find((t) => t.id === task.type)?.color || 'bg-gray-100 text-gray-600'
                      }`}>
                        {TYPE_LABELS[task.type] || task.type}
                      </span>
                    )}
                    <span className="truncate font-medium text-sm">
                      {task.title}
                    </span>
                    {task.parent && (
                      <span className="text-xs text-muted-foreground truncate flex-shrink-0">
                        ← {task.parent.title}
                      </span>
                    )}
                  </div>
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
                  <div>
                    {task.status ? (
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                          STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABEL_MAP[task.status] || task.status}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">-</span>
                    )}
                  </div>
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
                  <div className="text-xs text-muted-foreground">
                    {formatDate(task.createdAt)}
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/50">
              {tasks.map((task: GlobalTask) => (
                <div
                  key={task.id}
                  className="px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors active:bg-muted/50"
                  onClick={() =>
                    setEditingTask({ itemId: task.id, spaceId: task.spaceId })
                  }
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.parent && (
                        <p className="text-xs text-muted-foreground truncate">← {task.parent.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap ml-6">
                    {(filters.selectedTypes.length !== 1) && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${
                        typeOptions.find((t) => t.id === task.type)?.color || 'bg-gray-100 text-gray-600'
                      }`}>
                        {TYPE_LABELS[task.type] || task.type}
                      </span>
                    )}
                    <button
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/spaces/${task.spaceId}`);
                      }}
                    >
                      <FolderKanban className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[100px]">{task.spaceName}</span>
                    </button>
                    {task.status && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL_MAP[task.status] || task.status}
                      </span>
                    )}
                    {task.priority && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${PRIORITY_LABELS[task.priority]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {PRIORITY_LABELS[task.priority]?.label || `P${task.priority}`}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={`inline-flex items-center gap-0.5 text-[11px] ${
                        isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled'
                          ? 'text-red-600 font-medium' : 'text-muted-foreground'
                      }`}>
                        {isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled' && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-border px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {filters.page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => filters.setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => filters.setPage((p) => Math.min(totalPages, p + 1))}
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
