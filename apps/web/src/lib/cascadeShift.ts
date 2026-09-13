/* Calcule côté client la liste des items entraînés en cascade par le déplacement d'une ancre via
 * la relation 'drives' ("Entraîne") — parcours transitif du graphe, chaque item une seule fois
 * même en cas de diamant. Utilisé par ItemEditModal (sauvegarde) et TimelineView (drag du corps
 * de barre) pour construire l'aperçu de la modale de confirmation avant itemsApi.cascadeShift. */
import type { ItemWithRelations } from '@spok/shared';
import { addDays, formatDateShort } from './dateUtils';

export interface CascadeDependent {
  id: string;
  title: string;
  beforeLabel: string;
  afterLabel: string;
}

export function computeCascadeDependents(anchorId: string, deltaDays: number, allItems: ItemWithRelations[]): CascadeDependent[] {
  if (deltaDays === 0) return [];

  const byId = new Map(allItems.map((i) => [i.id, i]));
  const visited = new Set<string>([anchorId]);
  const result: CascadeDependent[] = [];
  const queue: string[] = [anchorId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = byId.get(currentId);
    if (!current) continue;

    for (const rel of current.relationsFrom || []) {
      if (rel.type !== 'drives' || visited.has(rel.toItemId)) continue;
      visited.add(rel.toItemId);

      const target = byId.get(rel.toItemId);
      if (!target) continue;

      const referenceDate = target.dueDate || target.startDate || target.endDate;
      if (referenceDate) {
        const before = new Date(referenceDate);
        const after = addDays(before, deltaDays);
        result.push({
          id: target.id,
          title: target.title,
          beforeLabel: formatDateShort(before),
          afterLabel: formatDateShort(after),
        });
      }

      queue.push(rel.toItemId);
    }
  }

  return result;
}
