/*
 * Logique pure de la vue Process (sans React) :
 * - splitPlaced : répartit les items de l'espace entre placés (position connue) et non placés (panneau) ;
 *   une position dont l'item n'est plus dans la liste (supprimé, déplacé d'espace) est ignorée.
 * - buildProcessEdges : arêtes xyflow des relations dont les DEUX extrémités sont placées, types officiels
 *   seulement (source unique constants/relationTypes.ts) ; data.relationId sert à la modale d'édition.
 * - filterUnplaced : recherche du panneau, insensible à la casse et aux accents.
 * - layoutAsProcess : rangement en colonnes par rang de dépendance (bouton « Réorganiser en processus »),
 *   seule disposition automatique de la vue, et uniquement sur action explicite.
 */
import { MarkerType, type Edge } from '@xyflow/react';
import type { Item, ItemRelation } from '@spok/shared';
import { getRelationMeta, isOfficialRelationType } from '../../constants/relationTypes';
import { buildPertGraph, computePertRanks } from './pert-utils';

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

/** Écart entre colonnes (rangs) et entre lignes du rangement automatique — nœud de 192 px de large. */
export const PROCESS_COLUMN_GAP = 260;
export const PROCESS_ROW_GAP = 90;

/**
 * Rangement « en processus » (bouton Réorganiser) : une colonne par rang de dépendance, de gauche à droite,
 * rangs calculés comme le PERT (computePertRanks : seuls « Bloque » et « Permet » ordonnent ; item sans lien
 * d'ordre ou pris dans un cycle → première colonne, empilée dans l'ordre vertical actuel).
 * Branches multiples (2026-10-21) : dans les colonnes suivantes, un item se place à la hauteur moyenne de ses
 * prédécesseurs (il reste sur la ligne de sa branche) ; deux items qui voudraient la même hauteur sont décalés
 * vers le bas d'un PROCESS_ROW_GAP, sans chevauchement.
 */
export function layoutAsProcess(
  placed: Array<{ item: Item; x: number; y: number }>,
  relations: ItemRelation[],
): ProcessPosition[] {
  const items = placed.map((p) => p.item);
  const { predecessors, successors } = buildPertGraph(items, relations);
  const ranks = computePertRanks(items, predecessors, successors);

  const columns = new Map<number, Array<{ item: Item; x: number; y: number }>>();
  for (const p of placed) {
    const rank = ranks.get(p.item.id) ?? 0;
    if (!columns.has(rank)) columns.set(rank, []);
    columns.get(rank)!.push(p);
  }

  const newY = new Map<string, number>();
  const result: ProcessPosition[] = [];
  for (const rank of [...columns.keys()].sort((a, b) => a - b)) {
    // Hauteur souhaitée : moyenne des prédécesseurs déjà rangés (colonnes précédentes) ; première colonne : pile
    const wanted = new Map<string, number>();
    for (const p of columns.get(rank)!) {
      const predYs = (predecessors.get(p.item.id) ?? []).map((id) => newY.get(id)).filter((y): y is number => y !== undefined);
      wanted.set(p.item.id, predYs.length ? predYs.reduce((s, y) => s + y, 0) / predYs.length : -Infinity);
    }
    const column = columns.get(rank)!.sort((a, b) =>
      wanted.get(a.item.id)! - wanted.get(b.item.id)! || a.y - b.y || a.x - b.x);

    let prevY = -Infinity;
    for (const p of column) {
      const y = Math.max(wanted.get(p.item.id)!, prevY + PROCESS_ROW_GAP, 0);
      newY.set(p.item.id, y);
      prevY = y;
      result.push({ itemId: p.item.id, x: rank * PROCESS_COLUMN_GAP, y });
    }
  }
  return result;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterUnplaced(unplaced: Item[], query: string): Item[] {
  const q = normalize(query.trim());
  if (!q) return unplaced;
  return unplaced.filter((i) => normalize(i.title || '').includes(q));
}
