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
/**
 * Couloir : bande nommée par un item (itemId), position = ordre d'empilement de haut en bas.
 * x/y : position libre (couloir déplacé à la main) ; null/absent = empilé automatiquement.
 */
export type ProcessLane = { id: string; itemId: string; position: number; x?: number | null; y?: number | null };
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

// ── Voies des flèches (2026-10-21) ──
// Le tracé à angles droits tourne par défaut à mi-chemin : une flèche qui saute des colonnes tombait dans la voie
// verticale d'une autre et s'y superposait. Ici, chaque flèche « vers l'avant » tourne juste avant la colonne de sa
// cible, et les flèches qui arrivent dans une même colonne reçoivent chacune leur voie (décalées de EDGE_CHANNEL_STEP).
export const EDGE_CHANNEL_MARGIN = 24;
export const EDGE_CHANNEL_STEP = 10;

export type NodeBox = { x: number; y: number; width: number; height: number };

/** Marge autour d'un item qu'une voie horizontale ne doit pas traverser ; écart entre deux voies horizontales. */
const EDGE_OBSTACLE_PAD = 6;
const EDGE_CORRIDOR_OFFSET = 14;

/**
 * Routage des flèches vers l'avant (sources à gauche des cibles) :
 * - voie verticale « tardive » cx propre à la flèche, juste avant la colonne cible (groupée par colonne cible) ;
 * - voie verticale « précoce » ex, juste après la colonne source (groupée par colonne source) ;
 * - tronçon horizontal choisi parmi : ligne de départ [sx → cx] (data.centerX = cx), ligne de la cible
 *   [ex → tx] (data.centerX = ex), sinon voie de contournement à une hauteur libre [ex → cx] (data.corridor =
 *   { ex, y, cx }) — le premier qui ne traverse aucun autre item (marge EDGE_OBSTACLE_PAD) ni un tronçon horizontal
 *   déjà pris. Les flèches vers l'arrière ou entre colonnes collées gardent le tracé par défaut.
 */
export function assignEdgeChannels<E extends { source: string; target: string; data?: Record<string, unknown> }>(
  edges: E[],
  boxes: Map<string, NodeBox>,
  /** Boîtes à contourner (par défaut toutes) ; la vue exclut les couloirs, qui englobent leurs items */
  isObstacle: (nodeId: string) => boolean = () => true,
): E[] {
  type Routed = { edge: E; sx: number; tx: number; sy: number; ty: number; cx: number; ex: number };
  const forward: Routed[] = [];
  for (const edge of edges) {
    const s = boxes.get(edge.source);
    const t = boxes.get(edge.target);
    if (!s || !t) continue;
    const sx = s.x + s.width;
    const tx = t.x;
    if (tx - sx < 2 * EDGE_CHANNEL_MARGIN) continue; // vers l'arrière ou colonnes collées : tracé par défaut
    forward.push({ edge, sx, tx, sy: s.y + s.height / 2, ty: t.y + t.height / 2, cx: 0, ex: 0 });
  }

  // Voies verticales : tardive par colonne cible, précoce par colonne source (ordre de haut en bas)
  const assignVertical = (keyOf: (r: Routed) => number, set: (r: Routed, k: number) => void) => {
    const groups = new Map<number, Routed[]>();
    for (const r of forward) {
      const key = keyOf(r);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.ty - b.ty || a.sy - b.sy);
      group.forEach((r, k) => set(r, k));
    }
  };
  assignVertical((r) => Math.round(r.tx / 20), (r, k) => {
    r.cx = Math.max(r.tx - EDGE_CHANNEL_MARGIN - k * EDGE_CHANNEL_STEP, r.sx + EDGE_CHANNEL_MARGIN);
  });
  assignVertical((r) => Math.round(r.sx / 20), (r, k) => {
    r.ex = Math.min(r.sx + EDGE_CHANNEL_MARGIN + k * EDGE_CHANNEL_STEP, r.tx - EDGE_CHANNEL_MARGIN);
  });

  const allBoxes = [...boxes.entries()].filter(([id]) => isObstacle(id));
  const taken: Array<{ y: number; x1: number; x2: number }> = [];
  const overlaps = (a1: number, a2: number, b1: number, b2: number) => Math.min(a2, b2) - Math.max(a1, b1) > 1;
  /** Tronçon horizontal [x1, x2] à la hauteur y libre : aucun autre item traversé, aucune voie déjà prise. */
  const isFree = (r: Routed, y: number, x1: number, x2: number) =>
    !allBoxes.some(([id, b]) => id !== r.edge.source && id !== r.edge.target
      && overlaps(x1, x2, b.x, b.x + b.width) && y > b.y - EDGE_OBSTACLE_PAD && y < b.y + b.height + EDGE_OBSTACLE_PAD)
    && !taken.some((t) => Math.abs(t.y - y) < EDGE_CHANNEL_STEP / 2 + 1 && overlaps(x1, x2, t.x1, t.x2));

  const routes = new Map<E, Record<string, unknown>>();
  // Les plus courtes d'abord : elles gardent les tracés directs, les longues contournent
  for (const r of [...forward].sort((a, b) => (a.tx - a.sx) - (b.tx - b.sx))) {
    if (isFree(r, r.sy, r.sx, r.cx)) {
      taken.push({ y: r.sy, x1: r.sx, x2: r.cx });
      routes.set(r.edge, { centerX: r.cx });
      continue;
    }
    if (isFree(r, r.ty, r.ex, r.tx)) {
      taken.push({ y: r.ty, x1: r.ex, x2: r.tx });
      routes.set(r.edge, { centerX: r.ex });
      continue;
    }
    // Contournement : hauteurs libres juste au-dessus / au-dessous des items gênants, la plus proche du milieu
    const middle = (r.sy + r.ty) / 2;
    const candidates = allBoxes
      .filter(([, b]) => overlaps(r.ex, r.cx, b.x, b.x + b.width))
      .flatMap(([, b]) => [b.y - EDGE_CORRIDOR_OFFSET, b.y + b.height + EDGE_CORRIDOR_OFFSET])
      .flatMap((y) => [y, y - EDGE_CHANNEL_STEP, y + EDGE_CHANNEL_STEP, y - 2 * EDGE_CHANNEL_STEP, y + 2 * EDGE_CHANNEL_STEP])
      .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
    const y = candidates.find((c) => isFree(r, c, r.ex, r.cx));
    if (y === undefined) { routes.set(r.edge, { centerX: r.cx }); continue; }
    taken.push({ y, x1: r.ex, x2: r.cx });
    routes.set(r.edge, { corridor: { ex: r.ex, y, cx: r.cx } });
  }

  return edges.map((e) => (routes.has(e) ? { ...e, data: { ...e.data, ...routes.get(e) } } : e));
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
/** Couloir replié : boîte réduite en hauteur et en longueur (titre seul, items masqués) — bloc « sous-processus ». */
export const LANE_COLLAPSED_HEIGHT = 44;
export const LANE_COLLAPSED_WIDTH = LANE_HEADER_WIDTH + 40;
export const LANE_MIN_WIDTH = 1200;
/** Abscisse de la première colonne, dans un couloir comme hors couloir (colonnes alignées). */
export const LANE_CONTENT_X = LANE_HEADER_WIDTH + LANE_PADDING;

export type LaneLayout = {
  /** width : largeur commune, ou LANE_COLLAPSED_WIDTH pour un couloir replié */
  lanes: Array<{ id: string; itemId: string; x: number; y: number; height: number; width: number; collapsed: boolean }>;
  width: number;
  /** Bas du dernier couloir (0 sans couloir). */
  bottom: number;
};

export function computeLaneLayout(
  lanes: ProcessLane[],
  nodes: Array<{ x: number; y: number; laneId?: string | null }>,
  collapsedIds: Set<string> = new Set(),
): LaneLayout {
  const sorted = [...lanes].sort((a, b) => a.position - b.position);
  const members = nodes.filter((n) => n.laneId);
  const width = Math.max(LANE_MIN_WIDTH, ...members.map((n) => n.x + PROCESS_NODE_WIDTH + LANE_PADDING));
  let y = 0;
  let bottom = 0;
  const out: LaneLayout['lanes'] = [];
  for (const lane of sorted) {
    const collapsed = collapsedIds.has(lane.id);
    const own = members.filter((n) => n.laneId === lane.id);
    const height = collapsed
      ? LANE_COLLAPSED_HEIGHT
      : Math.max(LANE_MIN_HEIGHT, ...own.map((n) => n.y + PROCESS_NODE_HEIGHT + LANE_PADDING));
    const laneWidth = collapsed ? LANE_COLLAPSED_WIDTH : width;
    const free = lane.x != null && lane.y != null;
    if (free) {
      // Couloir déplacé : à sa place, hors de la pile
      out.push({ id: lane.id, itemId: lane.itemId, x: lane.x!, y: lane.y!, height, width: laneWidth, collapsed });
      continue;
    }
    out.push({ id: lane.id, itemId: lane.itemId, x: 0, y, height, width: laneWidth, collapsed });
    bottom = y + height;
    y = bottom + LANE_GAP;
  }
  // bottom : bas de la pile des couloirs non déplacés (sert à ranger les items libres)
  return { lanes: out, width, bottom };
}

/** Couloir dont la bande contient le point (coordonnées absolues du canevas), sinon null. */
export function findLaneAt(layout: LaneLayout, point: { x: number; y: number }): string | null {
  // Un couloir replié ne reçoit pas d'item (ses membres sont masqués)
  return layout.lanes.find((l) => !l.collapsed && point.x >= l.x && point.x <= l.x + l.width
    && point.y >= l.y && point.y <= l.y + l.height)?.id ?? null;
}

/**
 * endpointOverrides : item → nœud qui le représente à la place de son propre nœud (2026-10-21) — titre d'un couloir
 * (le lien est gardé, relié au couloir comme à un sous-processus) ou membre d'un couloir replié. Un lien dont les
 * deux extrémités tombent sur le même nœud (lien interne d'un couloir replié) est masqué.
 */
export function buildProcessEdges(
  relations: ItemRelation[],
  placedIds: Set<string>,
  endpointOverrides: Map<string, string> = new Map(),
  titleOf: (itemId: string) => string = () => '',
): Edge[] {
  const endpoint = (itemId: string) => endpointOverrides.get(itemId) ?? (placedIds.has(itemId) ? itemId : null);
  return relations
    .filter((r) => isOfficialRelationType(r.type))
    .map((r) => ({ r, source: endpoint(r.fromItemId), target: endpoint(r.toItemId) }))
    .filter((e): e is { r: ItemRelation; source: string; target: string } => !!e.source && !!e.target && e.source !== e.target)
    .map(({ r, source, target }) => {
      const color = getRelationMeta(r.type).hex;
      return {
        id: `rel-${r.id}`,
        source,
        target,
        // Arête partagée RelationEdge (MindMap) : commentaire en icône au milieu, texte en infobulle au survol
        type: 'relation',
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2 },
        // fromItemId / toItemId : vrais items de la relation (source / target peuvent être un couloir) ;
        // fromTitle / toTitle : lus par l'infobulle du commentaire
        data: {
          relationId: r.id, type: r.type, label: r.label ?? '', fromItemId: r.fromItemId, toItemId: r.toItemId,
          fromTitle: titleOf(r.fromItemId), toTitle: titleOf(r.toItemId),
          // Angles droits : les flèches suivent les lignes des couloirs (les courbes les traversaient, 2026-10-21)
          pathStyle: 'smoothstep',
        },
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

  // Réorganiser remet tous les couloirs dans la pile (positions libres effacées par l'appelant)
  lanes = lanes.map((l) => ({ ...l, x: null, y: null }));
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
