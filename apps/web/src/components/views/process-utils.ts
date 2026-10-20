/*
 * Logique pure de la vue Process (sans React) :
 * - splitPlaced : répartit les items de l'espace entre placés (position connue) et non placés (panneau) ;
 *   une position dont l'item n'est plus dans la liste (supprimé, déplacé d'espace) est ignorée.
 * - buildProcessEdges : arêtes xyflow des relations dont les DEUX extrémités sont placées, types officiels
 *   seulement (source unique constants/relationTypes.ts) ; data.relationId sert à la modale d'édition.
 * - filterUnplaced : recherche du panneau, insensible à la casse et aux accents.
 * - layoutAsProcess : rangement en colonnes par rang de dépendance (bouton « Réorganiser en processus »),
 *   seule disposition automatique de la vue, et uniquement sur action explicite.
 * - Couloirs (2026-10-21) : computeLaneLayout (empilement, hauteur selon les membres, largeur commune),
 *   findLaneAt (couloir sous un point). Un membre a des x/y relatifs à son couloir, un item libre des x/y absolus.
 */
import { MarkerType, type Edge } from '@xyflow/react';
import type { Item, ItemRelation } from '@spok/shared';
import { getRelationMeta, isOfficialRelationType } from '../../constants/relationTypes';
import { buildPertGraph, computePertRanks } from './pert-utils';

/** Position d'un nœud : laneId null/absent = libre (x/y absolus) ; sinon x/y relatifs au couloir. */
export type ProcessPosition = { itemId: string; x: number; y: number; laneId?: string | null };
/** Couloir : bande nommée par un item (itemId), position = ordre d'empilement de haut en bas. */
export type ProcessLane = { id: string; itemId: string; position: number };
export type PlacedItem = { item: Item; x: number; y: number; laneId?: string | null };

export function splitPlaced(
  items: Item[],
  positions: ProcessPosition[],
  laneItemIds: Set<string> = new Set(),
): { placed: PlacedItem[]; unplaced: Item[] } {
  const byId = new Map(positions.map((p) => [p.itemId, p]));
  const placed: PlacedItem[] = [];
  const unplaced: Item[] = [];
  for (const item of items) {
    if (laneItemIds.has(item.id)) continue; // titre d'un couloir : ni nœud ni « non placé »
    const pos = byId.get(item.id);
    if (pos) placed.push({ item, x: pos.x, y: pos.y, laneId: pos.laneId ?? null });
    else unplaced.push(item);
  }
  return { placed, unplaced };
}

// ── Géométrie des couloirs ──
// Couloirs empilés à partir de (0, 0), tous de la même largeur ; un membre est positionné relativement à son
// couloir, ses colonnes commencent après la bande de titre (LANE_CONTENT_X).
export const PROCESS_NODE_WIDTH = 192;
export const PROCESS_NODE_HEIGHT = 56;
export const LANE_HEADER_WIDTH = 150;
export const LANE_PADDING = 24;
export const LANE_GAP = 16;
export const LANE_MIN_HEIGHT = 110;
export const LANE_MIN_WIDTH = 1200;
/** Abscisse de la première colonne, dans un couloir comme hors couloir (colonnes alignées). */
export const LANE_CONTENT_X = LANE_HEADER_WIDTH + LANE_PADDING;

export type LaneLayout = {
  lanes: Array<{ id: string; itemId: string; y: number; height: number }>;
  width: number;
  /** Bas du dernier couloir (0 sans couloir). */
  bottom: number;
};

export function computeLaneLayout(
  lanes: ProcessLane[],
  nodes: Array<{ x: number; y: number; laneId?: string | null }>,
): LaneLayout {
  const sorted = [...lanes].sort((a, b) => a.position - b.position);
  const members = nodes.filter((n) => n.laneId);
  const width = Math.max(LANE_MIN_WIDTH, ...members.map((n) => n.x + PROCESS_NODE_WIDTH + LANE_PADDING));
  let y = 0;
  let bottom = 0;
  const out: LaneLayout['lanes'] = [];
  for (const lane of sorted) {
    const own = members.filter((n) => n.laneId === lane.id);
    const height = Math.max(LANE_MIN_HEIGHT, ...own.map((n) => n.y + PROCESS_NODE_HEIGHT + LANE_PADDING));
    out.push({ id: lane.id, itemId: lane.itemId, y, height });
    bottom = y + height;
    y = bottom + LANE_GAP;
  }
  return { lanes: out, width, bottom };
}

/** Couloir dont la bande contient le point (coordonnées absolues du canevas), sinon null. */
export function findLaneAt(layout: LaneLayout, point: { x: number; y: number }): string | null {
  if (point.x < 0 || point.x > layout.width) return null;
  return layout.lanes.find((l) => point.y >= l.y && point.y <= l.y + l.height)?.id ?? null;
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
 * Couloirs (2026-10-21) : rangs globaux (colonnes communes à tous les couloirs et aux items libres, à partir de
 * LANE_CONTENT_X) ; chaque item reste dans son couloir et ses branches y sont rangées (seuls les prédécesseurs du
 * même couloir comptent pour la hauteur) ; les items libres sont rangés sous le dernier couloir.
 * Sans couloir : comportement d'origine (colonnes à partir de x = 0, lignes à partir de y = 0).
 */
export function layoutAsProcess(
  placed: PlacedItem[],
  relations: ItemRelation[],
  lanes: ProcessLane[] = [],
): ProcessPosition[] {
  const items = placed.map((p) => p.item);
  const { predecessors, successors } = buildPertGraph(items, relations);
  const ranks = computePertRanks(items, predecessors, successors);

  if (lanes.length === 0) {
    return rowsByBranch(placed, ranks, predecessors).map(({ p, rank, y }) => ({ itemId: p.item.id, x: rank * PROCESS_COLUMN_GAP, y }));
  }

  const laneIds = new Set(lanes.map((l) => l.id));
  const groupOf = (p: PlacedItem) => (p.laneId && laneIds.has(p.laneId) ? p.laneId : null);
  const result: ProcessPosition[] = [];
  for (const lane of lanes) {
    const own = placed.filter((p) => groupOf(p) === lane.id);
    for (const { p, rank, y } of rowsByBranch(own, ranks, predecessors)) {
      result.push({ itemId: p.item.id, x: LANE_CONTENT_X + rank * PROCESS_COLUMN_GAP, y: LANE_PADDING + y, laneId: lane.id });
    }
  }
  // Items libres : sous les couloirs tels qu'ils seront une fois rangés
  const freeTop = computeLaneLayout(lanes, result).bottom + 2 * LANE_GAP;
  for (const { p, rank, y } of rowsByBranch(placed.filter((p) => groupOf(p) === null), ranks, predecessors)) {
    result.push({ itemId: p.item.id, x: LANE_CONTENT_X + rank * PROCESS_COLUMN_GAP, y: freeTop + y, laneId: null });
  }
  return result;
}

/**
 * Lignes d'un groupe (un couloir, ou les items libres) : colonne par colonne, chaque item à la hauteur moyenne de
 * ses prédécesseurs déjà rangés dans le groupe (première colonne : pile dans l'ordre vertical actuel), décalé vers
 * le bas d'un PROCESS_ROW_GAP en cas de conflit. Hauteurs relatives au groupe, à partir de 0.
 */
function rowsByBranch(
  group: PlacedItem[],
  ranks: Map<string, number>,
  predecessors: Map<string, string[]>,
): Array<{ p: PlacedItem; rank: number; y: number }> {
  const columns = new Map<number, PlacedItem[]>();
  for (const p of group) {
    const rank = ranks.get(p.item.id) ?? 0;
    if (!columns.has(rank)) columns.set(rank, []);
    columns.get(rank)!.push(p);
  }

  const newY = new Map<string, number>();
  const out: Array<{ p: PlacedItem; rank: number; y: number }> = [];
  for (const rank of [...columns.keys()].sort((a, b) => a - b)) {
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
      out.push({ p, rank, y });
    }
  }
  return out;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterUnplaced(unplaced: Item[], query: string): Item[] {
  const q = normalize(query.trim());
  if (!q) return unplaced;
  return unplaced.filter((i) => normalize(i.title || '').includes(q));
}
