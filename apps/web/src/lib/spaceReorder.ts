/*
 * Calculs purs de l'ordre manuel des espaces côté web (lot 4, 2026-10-16) — l'API (PUT /spaces/reorder) réécrit
 * ensuite les positions. Un espace est ordonné parmi ses frères : même parent, ou, à la racine, même communauté.
 * - siblingOrder : ids des frères dans l'ordre de la liste reçue (GET /spaces trie déjà position puis nom).
 * - placeRelative : déposer `id` avant/après `targetId` (glisser-déposer des paramètres de la communauté).
 * - shiftInOrder : monter/descendre d'un cran (menu ⋯ de la barre latérale) ; null si déjà en bout de liste.
 * Testé par spaceReorder.test.ts.
 */

export interface OrderableSpace {
  id: string;
  type?: string;
  parentId?: string | null;
  communityId?: string | null;
}

/** Ids des frères d'un emplacement, dans l'ordre de `spaces` */
export function siblingOrder(spaces: OrderableSpace[], parentId: string | null, communityId: string | null): string[] {
  return spaces
    .filter((s) => (parentId
      ? s.parentId === parentId
      : !s.parentId && (s.communityId ?? null) === communityId && s.type !== 'PERSONAL'))
    .map((s) => s.id);
}

/** Nouvel ordre après avoir placé `id` avant ou après `targetId` (id ajouté s'il venait d'ailleurs) */
export function placeRelative(order: string[], id: string, targetId: string, where: 'before' | 'after'): string[] {
  const rest = order.filter((x) => x !== id);
  const index = rest.indexOf(targetId);
  if (index < 0) return [...rest, id];
  rest.splice(where === 'before' ? index : index + 1, 0, id);
  return rest;
}

/** Nouvel ordre après avoir monté (-1) ou descendu (+1) `id` ; null si impossible */
export function shiftInOrder(order: string[], id: string, delta: -1 | 1): string[] | null {
  const index = order.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return null;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
