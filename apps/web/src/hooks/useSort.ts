/* Hook générique de tri de tableaux : clé + ordre asc/desc, accesseurs typés, toggle par colonne. */
import { useState, useCallback } from 'react';

type SortOrder = 'asc' | 'desc';

type Accessor<T> = (item: T) => string | number | Date | null | undefined;

interface UseSortReturn<T> {
  sortKey: string;
  sortOrder: SortOrder;
  toggle: (key: string) => void;
  sortData: (data: T[], accessors: Record<string, Accessor<T>>) => T[];
}

export function useSort<T>(defaultKey: string, defaultOrder: SortOrder = 'asc'): UseSortReturn<T> {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultOrder);

  const toggle = useCallback((key: string) => {
    if (key === sortKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  }, [sortKey]);

  const sortData = useCallback(
    (data: T[], accessors: Record<string, Accessor<T>>): T[] => {
      const accessor = accessors[sortKey];
      if (!accessor) return data;

      return [...data].sort((a, b) => {
        const valA = accessor(a);
        const valB = accessor(b);

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        let comparison: number;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
        } else {
          comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },
    [sortKey, sortOrder]
  );

  return { sortKey, sortOrder, toggle, sortData };
}
