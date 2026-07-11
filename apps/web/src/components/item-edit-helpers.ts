/* Helpers d'ItemEditModal : préparation des payloads, diff des champs modifiés. */
import type { Item } from '@spok/shared';

/** Extract a clean name from a filename (remove extension) */
export function fileNameToTitle(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '');
  return name.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract a readable title from a URL (domain or last path segment) */
export function urlToTitle(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname.replace(/\/$/, '');
    if (path && path !== '/') {
      const last = path.split('/').pop() || '';
      const decoded = decodeURIComponent(last).replace(/\.[^.]+$/, '');
      if (decoded) return decoded.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Get all descendants of an item to prevent circular references */
export function getDescendantIds(id: string, allItems: Item[]): Set<string> {
  const descendants = new Set<string>();
  const findDescendants = (currentId: string) => {
    allItems.forEach((item) => {
      if (item.parentId === currentId && !descendants.has(item.id)) {
        descendants.add(item.id);
        findDescendants(item.id);
      }
    });
  };
  findDescendants(id);
  return descendants;
}
