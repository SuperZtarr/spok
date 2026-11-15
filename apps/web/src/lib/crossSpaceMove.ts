/**
 * Déplacement d'une branche vers un autre espace (dépôt MindMap sous un élément d'un autre espace, 2026-11-15).
 * branchIds : l'élément et tous ses descendants (ils partent ensemble, bulk-move includeChildren).
 * countCutRelations : relations que l'API supprimera (un bout dans la branche, l'autre dehors) — sert à décider s'il
 * faut confirmer (aucune relation coupée = déplacement direct). Les items sans relationsFrom/To comptent pour 0.
 */
import type { Item, ItemWithRelations } from '@spok/shared';

export function branchIds(items: Item[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const i of items) {
      if (i.parentId && ids.has(i.parentId) && !ids.has(i.id)) { ids.add(i.id); added = true; }
    }
  }
  return ids;
}

export function countCutRelations(items: Item[], branch: Set<string>): number {
  const cut = new Set<string>();
  for (const i of items as ItemWithRelations[]) {
    if (!branch.has(i.id)) continue;
    for (const r of [...(i.relationsFrom ?? []), ...(i.relationsTo ?? [])]) {
      if (!branch.has(r.fromItemId) || !branch.has(r.toItemId)) cut.add(r.id);
    }
  }
  return cut.size;
}
