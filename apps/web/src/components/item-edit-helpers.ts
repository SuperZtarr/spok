/* Helpers d'ItemEditModal : préparation des payloads, diff des champs modifiés. */
import type { Item, ItemTemplateNode } from '@spok/shared';

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

/** Capture récursivement un item et ses descendants en structure de modèle (titre+type). */
export function buildItemTemplateStructure(id: string, allItems: Item[]): ItemTemplateNode {
  const item = allItems.find((i) => i.id === id);
  const children = allItems
    .filter((i) => i.parentId === id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((child) => buildItemTemplateStructure(child.id, allItems));
  return { title: item?.title ?? '', type: (item?.type ?? 'NOTE') as ItemTemplateNode['type'], children };
}

/** Compte le nombre total de nœuds (racine incluse) d'une structure de modèle. */
export function countTemplateNodes(node: ItemTemplateNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTemplateNodes(child), 0);
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
