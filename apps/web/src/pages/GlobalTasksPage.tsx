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
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { userTasksApi, spacesApi, itemsApi } from '../lib/api';
import type { GlobalTaskFilters, GlobalTask } from '../lib/api';
import type { Item } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ItemEditModal } from '../components/ItemEditModal';
import { TYPE_LABELS } from '../constants/ui';
import { DEFAULT_STATUSES, buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';

const STATUS_COLOR_MAP = buildStatusColorMap();
const STATUS_LABEL_MAP = buildStatusLabelMap();

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critique', color: 'bg-red-100 text-red-800' },
  2: { label: 'Haute', color: 'bg-orange-100 text-orange-800' },
  3: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
  4: { label: 'Basse', color: 'bg-blue-100 text-blue-800' },
};

const DUE_DATE_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: 'overdue', label: 'En retard', color: 'bg-red-100 text-red-800 border-red-300' },
  { id: 'today', label: "Aujourd'hui", color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'week', label: 'Cette semaine', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: 'month', label: 'Ce mois', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'none', label: 'Sans echeance', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

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

// Toggle a value in a Set-like array
function toggleValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

type SortField = GlobalTaskFilters['sortBy'];

// Multi-select toggle button component
function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
        active
          ? color || 'bg-primary/15 text-primary border-primary/40'
          : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground/40 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

export function GlobalTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filter state — arrays for multi-select
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['TASK']);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedDueDates, setSelectedDueDates] = useState<string[]>([]);
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

  // Compute due date range from selected presets
  const dueDateParams = useMemo(() => {
    if (selectedDueDates.length === 0) return {};
    // If 'none' is selected alone
    if (selectedDueDates.length === 1 && selectedDueDates[0] === 'none') {
      return { noDueDate: true as const };
    }
    // Compute the widest range covering all selected presets
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let minFrom: Date | null = null;
    let maxTo: Date | null = null;
    let hasNone = false;

    for (const preset of selectedDueDates) {
      if (preset === 'none') {
        hasNone = true;
        continue;
      }
      switch (preset) {
        case 'overdue': {
          const yesterday = new Date(today.getTime() - 1);
          if (!maxTo || yesterday > maxTo) maxTo = yesterday;
          // overdue has no minFrom (all past)
          minFrom = null; // earliest possible
          break;
        }
        case 'today': {
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);
          if (minFrom === undefined) minFrom = new Date(today);
          if (!maxTo || endOfDay > maxTo) maxTo = endOfDay;
          break;
        }
        case 'week': {
          const endOfWeek = new Date(today);
          endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
          endOfWeek.setHours(23, 59, 59, 999);
          if (minFrom === undefined) minFrom = new Date(today);
          if (!maxTo || endOfWeek > maxTo) maxTo = endOfWeek;
          break;
        }
        case 'month': {
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          if (minFrom === undefined) minFrom = new Date(today);
          if (!maxTo || endOfMonth > maxTo) maxTo = endOfMonth;
          break;
        }
      }
    }

    // If both date range and 'none' are selected, we can't do both in one query
    // So we ignore noDueDate when combined with date ranges
    const result: { dueDateFrom?: string; dueDateTo?: string; noDueDate?: boolean } = {};
    if (minFrom) result.dueDateFrom = minFrom.toISOString();
    if (maxTo) result.dueDateTo = maxTo.toISOString();
    if (hasNone && !minFrom && !maxTo) result.noDueDate = true;
    return result;
  }, [selectedDueDates]);

  // Fetch spaces for filter
  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  // Build comma-separated filter strings
  const typeParam = selectedTypes.join(',') || undefined;
  const statusParam = selectedStatuses.join(',') || undefined;
  const priorityParam = selectedPriorities.join(',') || undefined;
  const spaceParam = selectedSpaces.join(',') || undefined;

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: [
      'global-tasks',
      debouncedSearch,
      typeParam,
      statusParam,
      priorityParam,
      spaceParam,
      selectedDueDates,
      sortBy,
      sortDir,
      page,
    ],
    queryFn: () =>
      userTasksApi.list({
        search: debouncedSearch || undefined,
        type: typeParam,
        status: statusParam,
        priority: priorityParam,
        spaceId: spaceParam,
        ...dueDateParams,
        sortBy,
        sortDir,
        page,
        pageSize: 30,
      }),
  });

  // Fetch allItems for space when editing a task
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

  // Filter options
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
  ];

  const statusOptions = DEFAULT_STATUSES
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      id: s.id === 'undefined' ? 'none' : s.id,
      label: s.label,
      color: `${s.color} ${s.borderColor.split(' ')[0]}`,
    }));

  const priorityOptions = [
    { id: '1', label: 'Critique', color: 'bg-red-100 text-red-800 border-red-300' },
    { id: '2', label: 'Haute', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: '3', label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { id: '4', label: 'Basse', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ];

  // Type filter differs from default (TASK only) → counts as active filter
  const isTypeFiltered = !(selectedTypes.length === 1 && selectedTypes[0] === 'TASK');

  const hasAnyFilter =
    isTypeFiltered ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedSpaces.length > 0 ||
    selectedDueDates.length > 0 ||
    debouncedSearch.length > 0;

  const clearAllFilters = () => {
    setSelectedTypes(['TASK']);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedSpaces([]);
    setSelectedDueDates([]);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const tasks = tasksData?.data || [];
  const total = tasksData?.total || 0;
  const totalPages = tasksData?.totalPages || 0;

  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    (isTypeFiltered ? selectedTypes.length : 0) + selectedStatuses.length + selectedPriorities.length + selectedDueDates.length + selectedSpaces.length;

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

  // Render a filter row (shared between mobile/desktop)
  // scrollable: if true, chips scroll horizontally instead of wrapping (for long lists like spaces)
  const renderFilterRow = (label: string, options: { id: string; label: string; color?: string }[], selected: string[], toggle: (id: string) => void, scrollable = false) => (
    <div className={`flex items-start gap-2 ${scrollable ? '' : 'flex-wrap'}`}>
      <span className="text-xs font-medium text-muted-foreground w-16 flex-shrink-0 pt-1 hidden sm:block">{label}</span>
      <span className="text-xs font-medium text-muted-foreground flex-shrink-0 pt-1 sm:hidden">{label}</span>
      <div className={`flex gap-1.5 ${scrollable ? 'overflow-x-auto pb-1 min-w-0 flex-1 scrollbar-thin' : 'flex-wrap'}`}>
        {options.map((opt) => (
          <FilterChip
            key={opt.id}
            label={opt.label}
            active={selected.includes(opt.id)}
            color={selected.includes(opt.id) ? opt.color : undefined}
            onClick={() => {
              toggle(opt.id);
              setPage(1);
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-3">
          <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold">Mes taches</h1>
          {total > 0 && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              ({total})
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                <span className="hidden sm:inline">Effacer les filtres</span>
              </button>
            )}
            {/* Mobile filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border hover:bg-accent transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-10 h-8 text-sm w-full sm:max-w-[400px]"
          />
        </div>

        {/* Filter rows — always visible on sm+, toggle on mobile */}
        <div className={`space-y-2 ${filtersOpen ? 'block' : 'hidden'} sm:block`}>
          {renderFilterRow('Type', typeOptions, selectedTypes, (id) => setSelectedTypes((prev) => toggleValue(prev, id)), true)}
          {renderFilterRow('Statut', statusOptions, selectedStatuses, (id) => setSelectedStatuses((prev) => toggleValue(prev, id)))}
          {renderFilterRow('Priorite', priorityOptions, selectedPriorities, (id) => setSelectedPriorities((prev) => toggleValue(prev, id)))}
          {renderFilterRow('Echeance', DUE_DATE_OPTIONS, selectedDueDates, (id) => setSelectedDueDates((prev) => toggleValue(prev, id)))}
          {spaces && spaces.length > 0 &&
            renderFilterRow('Espaces', spaces.map((s) => ({ id: s.id, label: s.name })), selectedSpaces, (id) => setSelectedSpaces((prev) => toggleValue(prev, id)), true)}
        </div>
      </div>

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
            onClick={() => toggleSort(s.field)}
            className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
              sortBy === s.field
                ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                : 'text-muted-foreground border-border'
            }`}
          >
            {s.label}
            {sortBy === s.field &&
              (sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
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
                  {/* Title */}
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {(selectedTypes.length !== 1) && (
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
                          STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABEL_MAP[task.status] || task.status}
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
                  {/* Title row */}
                  <div className="flex items-start gap-2 mb-1.5">
                    <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.parent && (
                        <p className="text-xs text-muted-foreground truncate">← {task.parent.title}</p>
                      )}
                    </div>
                  </div>
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap ml-6">
                    {/* Type badge (shown when multiple types selected) */}
                    {(selectedTypes.length !== 1) && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${
                        typeOptions.find((t) => t.id === task.type)?.color || 'bg-gray-100 text-gray-600'
                      }`}>
                        {TYPE_LABELS[task.type] || task.type}
                      </span>
                    )}
                    {/* Space badge */}
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
                    {/* Status */}
                    {task.status && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL_MAP[task.status] || task.status}
                      </span>
                    )}
                    {/* Priority */}
                    {task.priority && (
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${PRIORITY_LABELS[task.priority]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {PRIORITY_LABELS[task.priority]?.label || `P${task.priority}`}
                      </span>
                    )}
                    {/* Due date */}
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
            {page} / {totalPages}
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
