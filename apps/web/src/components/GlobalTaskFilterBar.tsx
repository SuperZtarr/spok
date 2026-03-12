import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { spacesApi } from '../lib/api';
import { Input } from './ui/Input';
import { TYPE_LABELS } from '../constants/ui';
import { DEFAULT_STATUSES } from '@spok/shared';
import type { GlobalTaskFilterState } from '../hooks/useGlobalTaskFilters';

const DUE_DATE_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: 'overdue', label: 'En retard', color: 'bg-red-100 text-red-800 border-red-300' },
  { id: 'today', label: "Aujourd'hui", color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'week', label: 'Cette semaine', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: 'month', label: 'Ce mois', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'none', label: 'Sans echeance', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

function toggleValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

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

function renderFilterRow(
  label: string,
  options: { id: string; label: string; color?: string }[],
  selected: string[],
  toggle: (id: string) => void,
  setPage: (p: number) => void,
  scrollable = false,
) {
  return (
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

interface GlobalTaskFilterBarProps {
  filters: GlobalTaskFilterState;
  showSearch?: boolean;
}

export function GlobalTaskFilterBar({ filters, showSearch = true }: GlobalTaskFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        {filters.hasAnyFilter && (
          <button
            onClick={filters.clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            <span className="hidden sm:inline">Effacer les filtres</span>
          </button>
        )}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border hover:bg-accent transition-colors ml-auto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtres
          {filters.activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
              {filters.activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showSearch && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-10 h-8 text-sm w-full sm:max-w-[400px]"
          />
        </div>
      )}

      <div className={`space-y-2 ${filtersOpen ? 'block' : 'hidden'} sm:block`}>
        {renderFilterRow('Type', typeOptions, filters.selectedTypes, (id) => filters.setSelectedTypes((prev) => toggleValue(prev, id)), (p) => filters.setPage(p), true)}
        {renderFilterRow('Statut', statusOptions, filters.selectedStatuses, (id) => filters.setSelectedStatuses((prev) => toggleValue(prev, id)), (p) => filters.setPage(p))}
        {renderFilterRow('Priorite', priorityOptions, filters.selectedPriorities, (id) => filters.setSelectedPriorities((prev) => toggleValue(prev, id)), (p) => filters.setPage(p))}
        {renderFilterRow('Echeance', DUE_DATE_OPTIONS, filters.selectedDueDates, (id) => filters.setSelectedDueDates((prev) => toggleValue(prev, id)), (p) => filters.setPage(p))}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-16 flex-shrink-0 pt-1 hidden sm:block">Assigné</span>
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0 pt-1 sm:hidden">Assigné</span>
          <FilterChip
            label="Assigné à moi"
            active={filters.assignedToMe}
            color="bg-violet-100 text-violet-800 border-violet-300"
            onClick={() => { filters.setAssignedToMe((v) => !v); filters.setPage(1); }}
          />
        </div>
        {spaces && spaces.length > 0 &&
          renderFilterRow('Espaces', spaces.map((s) => ({ id: s.id, label: s.name })), filters.selectedSpaces, (id) => filters.setSelectedSpaces((prev) => toggleValue(prev, id)), (p) => filters.setPage(p), true)}
      </div>
    </div>
  );
}
