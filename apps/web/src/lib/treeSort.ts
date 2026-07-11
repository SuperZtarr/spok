/* Tri d'arborescences partagé entre vues : manual (position), alpha-flat, alpha-tree. */
import type { Item } from '@spok/shared';

export type TreeSort = 'manual' | 'alpha-flat' | 'alpha-tree';

export const TREE_SORT_LABELS: Record<TreeSort, string> = {
  'manual': 'Position (défaut)',
  'alpha-flat': 'Alphabétique à plat',
  'alpha-tree': 'Alphabétique par groupe',
};

export function sortTreeAlpha<T extends Item>(items: T[]): T[] {
  const childrenMap = new Map<string | null, T[]>();
  for (const item of items) {
    const pid = item.parentId || null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(item);
  }
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  }
  const result: T[] = [];
  function collect(parentId: string | null) {
    for (const item of childrenMap.get(parentId) || []) {
      result.push(item);
      collect(item.id);
    }
  }
  collect(null);
  return result;
}

export function applyTreeSort<T extends Item>(items: T[], mode: TreeSort): T[] {
  if (mode === 'alpha-flat') return [...items].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  if (mode === 'alpha-tree') return sortTreeAlpha(items);
  return items;
}
