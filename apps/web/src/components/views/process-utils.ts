/*
 * Logique pure de la vue Process (sans React) :
 * - splitPlaced : répartit les items de l'espace entre placés (position connue) et non placés (panneau) ;
 *   une position dont l'item n'est plus dans la liste (supprimé, déplacé d'espace) est ignorée.
 * - buildProcessEdges : arêtes xyflow des relations dont les DEUX extrémités sont placées, types officiels
 *   seulement (source unique constants/relationTypes.ts) ; data.relationId sert à la modale d'édition.
 * - filterUnplaced : recherche du panneau, insensible à la casse et aux accents.
 */
import { MarkerType, type Edge } from '@xyflow/react';
import type { Item, ItemRelation } from '@spok/shared';
import { getRelationMeta, isOfficialRelationType } from '../../constants/relationTypes';

export type ProcessPosition = { itemId: string; x: number; y: number };

export function splitPlaced(
  items: Item[],
  positions: ProcessPosition[],
): { placed: Array<{ item: Item; x: number; y: number }>; unplaced: Item[] } {
  const byId = new Map(positions.map((p) => [p.itemId, p]));
  const placed: Array<{ item: Item; x: number; y: number }> = [];
  const unplaced: Item[] = [];
  for (const item of items) {
    const pos = byId.get(item.id);
    if (pos) placed.push({ item, x: pos.x, y: pos.y });
    else unplaced.push(item);
  }
  return { placed, unplaced };
}

export function buildProcessEdges(relations: ItemRelation[], placedIds: Set<string>): Edge[] {
  return relations
    .filter((r) => placedIds.has(r.fromItemId) && placedIds.has(r.toItemId) && isOfficialRelationType(r.type))
    .map((r) => {
      const color = getRelationMeta(r.type).hex;
      return {
        id: `rel-${r.id}`,
        source: r.fromItemId,
        target: r.toItemId,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2 },
        label: r.label || undefined,
        data: { relationId: r.id, type: r.type, label: r.label ?? '' },
      };
    });
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterUnplaced(unplaced: Item[], query: string): Item[] {
  const q = normalize(query.trim());
  if (!q) return unplaced;
  return unplaced.filter((i) => normalize(i.title || '').includes(q));
}
