/*
 * Hook : état des filtres de la page Tâches globales (types, statuts, priorités, dates, recherche
 * débouncée, mes tâches) + sérialisation vers les params de /user/tasks.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import type { GlobalTaskFilters } from '../lib/api';

export interface GlobalTaskFilterState {
  search: string;
  debouncedSearch: string;
  selectedTypes: string[];
  selectedStatuses: string[];
  selectedPriorities: string[];
  selectedCommunities: string[];
  selectedSpaces: string[];
  selectedDueDates: string[];
  assignedToMe: boolean;
  myTasks: boolean;
  sortBy: GlobalTaskFilters['sortBy'];
  sortDir: 'asc' | 'desc';
  page: number;

  setSearch: (v: string) => void;
  setSelectedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedPriorities: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCommunities: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSpaces: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedDueDates: React.Dispatch<React.SetStateAction<string[]>>;
  setAssignedToMe: React.Dispatch<React.SetStateAction<boolean>>;
  setMyTasks: React.Dispatch<React.SetStateAction<boolean>>;
  setSortBy: React.Dispatch<React.SetStateAction<GlobalTaskFilters['sortBy']>>;
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  toggleSort: (field: GlobalTaskFilters['sortBy']) => void;
  clearAllFilters: () => void;

  hasAnyFilter: boolean;
  activeFilterCount: number;
  queryParams: GlobalTaskFilters;
}

export function useGlobalTaskFilters(options?: {
  defaultTypes?: string[];
  defaultSortBy?: GlobalTaskFilters['sortBy'];
  defaultSortDir?: 'asc' | 'desc';
  defaultAssignedToMe?: boolean;
  defaultMyTasks?: boolean;
  pageSize?: number;
}): GlobalTaskFilterState {
  const {
    defaultTypes = ['TASK'],
    defaultSortBy = 'dueDate',
    defaultSortDir = 'asc',
    defaultAssignedToMe = false,
    defaultMyTasks = false,
    pageSize = 30,
  } = options || {};

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(defaultTypes);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [selectedDueDates, setSelectedDueDates] = useState<string[]>([]);
  const [assignedToMe, setAssignedToMe] = useState(defaultAssignedToMe);
  const [myTasks, setMyTasks] = useState(defaultMyTasks);
  const [sortBy, setSortBy] = useState<GlobalTaskFilters['sortBy']>(defaultSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Due date params
  const dueDateParams = useMemo(() => {
    if (selectedDueDates.length === 0) return {};
    if (selectedDueDates.length === 1 && selectedDueDates[0] === 'none') {
      return { noDueDate: true as const };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcul indépendant de l'ordre de sélection (bug corrigé 2026-07-12 : l'ancien code
    // testait `minFrom === undefined` alors que minFrom vaut `null`, condition toujours
    // vraie — "En retard" combiné à Aujourd'hui/Semaine/Mois pouvait selon l'ordre de clic
    // se voir réimposer un plancher "aujourd'hui", excluant à tort les tâches en retard).
    const hasOverdue = selectedDueDates.includes('overdue');
    const hasNone = selectedDueDates.includes('none');
    const boundedPresets = selectedDueDates.filter((p) => p !== 'none' && p !== 'overdue');

    let maxTo: Date | null = null;
    if (hasOverdue) {
      maxTo = new Date(today.getTime() - 1); // fin d'hier
    }
    for (const preset of boundedPresets) {
      let endOfRange: Date;
      if (preset === 'today') {
        endOfRange = new Date(today);
        endOfRange.setHours(23, 59, 59, 999);
      } else if (preset === 'week') {
        endOfRange = new Date(today);
        endOfRange.setDate(today.getDate() + (7 - today.getDay()));
        endOfRange.setHours(23, 59, 59, 999);
      } else if (preset === 'month') {
        endOfRange = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        continue;
      }
      if (!maxTo || endOfRange > maxTo) maxTo = endOfRange;
    }

    // Plancher "aujourd'hui" uniquement si un preset borné est choisi SANS "En retard" —
    // "En retard" doit toujours inclure tout ce qui précède, quelle que soit la combinaison.
    const minFrom: Date | null = (boundedPresets.length > 0 && !hasOverdue) ? new Date(today) : null;

    const result: { dueDateFrom?: string; dueDateTo?: string; noDueDate?: boolean } = {};
    if (minFrom) result.dueDateFrom = minFrom.toISOString();
    if (maxTo) result.dueDateTo = maxTo.toISOString();
    if (hasNone && !minFrom && !maxTo) result.noDueDate = true;
    return result;
  }, [selectedDueDates]);

  const toggleSort = useCallback((field: GlobalTaskFilters['sortBy']) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortBy]);

  const isTypeFiltered = !(selectedTypes.length === defaultTypes.length && defaultTypes.every(t => selectedTypes.includes(t)));

  const hasAnyFilter =
    isTypeFiltered ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedCommunities.length > 0 ||
    selectedSpaces.length > 0 ||
    selectedDueDates.length > 0 ||
    assignedToMe ||
    myTasks ||
    debouncedSearch.length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedTypes(defaultTypes);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedCommunities([]);
    setSelectedSpaces([]);
    setSelectedDueDates([]);
    setAssignedToMe(defaultAssignedToMe);
    setMyTasks(defaultMyTasks);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }, [defaultTypes, defaultAssignedToMe, defaultMyTasks]);

  const activeFilterCount =
    (isTypeFiltered ? selectedTypes.length : 0) +
    selectedStatuses.length +
    selectedPriorities.length +
    selectedCommunities.length +
    selectedDueDates.length +
    selectedSpaces.length +
    (assignedToMe ? 1 : 0) +
    (myTasks ? 1 : 0);

  const typeParam = selectedTypes.join(',') || undefined;
  const statusParam = selectedStatuses.join(',') || undefined;
  const priorityParam = selectedPriorities.join(',') || undefined;
  const spaceParam = selectedSpaces.join(',') || undefined;
  const communityParam = selectedCommunities.join(',') || undefined;

  const queryParams: GlobalTaskFilters = {
    search: debouncedSearch || undefined,
    type: typeParam,
    status: statusParam,
    priority: priorityParam,
    spaceId: spaceParam,
    communityId: communityParam,
    ...dueDateParams,
    assignedToMe: assignedToMe || undefined,
    myTasks: myTasks || undefined,
    sortBy,
    sortDir,
    page,
    pageSize,
  };

  return {
    search, debouncedSearch, selectedTypes, selectedStatuses, selectedPriorities,
    selectedCommunities, selectedSpaces, selectedDueDates, assignedToMe, sortBy, sortDir, page,
    setSearch, setSelectedTypes, setSelectedStatuses, setSelectedPriorities,
    setSelectedCommunities, setSelectedSpaces, setSelectedDueDates, setAssignedToMe, setMyTasks, setSortBy, setSortDir,
    myTasks, setPage, toggleSort, clearAllFilters,
    hasAnyFilter, activeFilterCount, queryParams,
  };
}
