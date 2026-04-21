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
  pageSize?: number;
}): GlobalTaskFilterState {
  const {
    defaultTypes = ['TASK'],
    defaultSortBy = 'dueDate',
    defaultSortDir = 'asc',
    defaultAssignedToMe = false,
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
    let minFrom: Date | null = null;
    let maxTo: Date | null = null;
    let hasNone = false;

    for (const preset of selectedDueDates) {
      if (preset === 'none') { hasNone = true; continue; }
      switch (preset) {
        case 'overdue': {
          const yesterday = new Date(today.getTime() - 1);
          if (!maxTo || yesterday > maxTo) maxTo = yesterday;
          minFrom = null;
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
    debouncedSearch.length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedTypes(defaultTypes);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedCommunities([]);
    setSelectedSpaces([]);
    setSelectedDueDates([]);
    setAssignedToMe(defaultAssignedToMe);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }, [defaultTypes, defaultAssignedToMe]);

  const activeFilterCount =
    (isTypeFiltered ? selectedTypes.length : 0) +
    selectedStatuses.length +
    selectedPriorities.length +
    selectedCommunities.length +
    selectedDueDates.length +
    selectedSpaces.length +
    (assignedToMe ? 1 : 0);

  const typeParam = selectedTypes.join(',') || undefined;
  const statusParam = selectedStatuses.join(',') || undefined;
  const priorityParam = selectedPriorities.join(',') || undefined;
  const spaceParam = selectedSpaces.join(',') || undefined;

  const queryParams: GlobalTaskFilters = {
    search: debouncedSearch || undefined,
    type: typeParam,
    status: statusParam,
    priority: priorityParam,
    spaceId: spaceParam,
    ...dueDateParams,
    assignedToMe: assignedToMe || undefined,
    sortBy,
    sortDir,
    page,
    pageSize,
  };

  return {
    search, debouncedSearch, selectedTypes, selectedStatuses, selectedPriorities,
    selectedCommunities, selectedSpaces, selectedDueDates, assignedToMe, sortBy, sortDir, page,
    setSearch, setSelectedTypes, setSelectedStatuses, setSelectedPriorities,
    setSelectedCommunities, setSelectedSpaces, setSelectedDueDates, setAssignedToMe, setSortBy, setSortDir,
    setPage, toggleSort, clearAllFilters,
    hasAnyFilter, activeFilterCount, queryParams,
  };
}
