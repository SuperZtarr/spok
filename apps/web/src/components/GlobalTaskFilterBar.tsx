/* Barre de filtres de la page Tâches globales : types, statuts, priorités, dates, mes tâches. */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search, X, SlidersHorizontal } from 'lucide-react';
import { spacesApi, communitiesApi } from '../lib/api';
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
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all whitespace-nowrap ${
        active
          ? `font-semibold ring-1 ring-current ${color || 'bg-primary/15 text-primary border-primary/40'}`
          : 'font-medium bg-transparent text-muted-foreground border-border hover:border-muted-foreground/40 hover:text-foreground'
      }`}
    >
      {active && <Check className="w-3 h-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

function FilterRow({
  label,
  options,
  selected,
  toggle,
  setPage,
}: {
  label: string;
  options: { id: string; label: string; color?: string }[];
  selected: string[];
  toggle: (id: string) => void;
  setPage: (p: number) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-medium text-muted-foreground w-14 flex-shrink-0 pt-1">{label}</span>
      <div className="flex gap-1 flex-wrap min-w-0">
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
  { id: 'DIAGRAM', label: TYPE_LABELS['DIAGRAM'] || 'Diagramme', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
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
  { id: '4', label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-300' },
  { id: '3', label: 'Haute', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: '2', label: 'Normale', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: '1', label: 'Basse', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

interface GlobalTaskFilterBarProps {
  filters: GlobalTaskFilterState;
  showSearch?: boolean;
}

export function GlobalTaskFilterBar({ filters, showSearch = true }: GlobalTaskFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  // Filter spaces by selected communities
  const filteredSpaces = useMemo(() => {
    if (!spaces) return [];
    if (filters.selectedCommunities.length === 0) return spaces;
    return spaces.filter(s => s.communityId && filters.selectedCommunities.includes(s.communityId));
  }, [spaces, filters.selectedCommunities]);

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-accent transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtres
          {filters.activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
              {filters.activeFilterCount}
            </span>
          )}
        </button>
        {filters.hasAnyFilter && (
          <button
            onClick={filters.clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            Effacer
          </button>
        )}
        {showSearch && (
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => filters.setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 h-8 text-sm w-48 sm:w-64"
            />
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="space-y-2 mb-2">
          <FilterRow label="Type" options={typeOptions} selected={filters.selectedTypes} toggle={(id) => filters.setSelectedTypes((prev) => toggleValue(prev, id))} setPage={(p) => filters.setPage(p)} />
          <FilterRow label="Statut" options={statusOptions} selected={filters.selectedStatuses} toggle={(id) => filters.setSelectedStatuses((prev) => toggleValue(prev, id))} setPage={(p) => filters.setPage(p)} />
          <FilterRow label="Priorité" options={priorityOptions} selected={filters.selectedPriorities} toggle={(id) => filters.setSelectedPriorities((prev) => toggleValue(prev, id))} setPage={(p) => filters.setPage(p)} />
          <FilterRow label="Échéance" options={DUE_DATE_OPTIONS} selected={filters.selectedDueDates} toggle={(id) => filters.setSelectedDueDates((prev) => toggleValue(prev, id))} setPage={(p) => filters.setPage(p)} />
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-medium text-muted-foreground w-14 flex-shrink-0 pt-1">Assigné</span>
            <FilterChip
              label="Assigné à moi"
              active={filters.assignedToMe}
              color="bg-violet-100 text-violet-800 border-violet-300"
              onClick={() => { filters.setAssignedToMe((v) => !v); filters.setPage(1); }}
            />
          </div>
          {communities && communities.length > 0 &&
            <FilterRow label="Communauté" options={communities.map((c) => ({ id: c.id, label: c.name }))} selected={filters.selectedCommunities} toggle={(id) => {
              filters.setSelectedCommunities((prev) => toggleValue(prev, id));
              // Reset space selection when community changes
              filters.setSelectedSpaces([]);
            }} setPage={(p) => filters.setPage(p)} />
          }
          {filteredSpaces.length > 0 &&
            <FilterRow label="Espaces" options={filteredSpaces.map((s) => ({ id: s.id, label: s.name }))} selected={filters.selectedSpaces} toggle={(id) => filters.setSelectedSpaces((prev) => toggleValue(prev, id))} setPage={(p) => filters.setPage(p)} />
          }
        </div>
      )}
    </div>
  );
}
