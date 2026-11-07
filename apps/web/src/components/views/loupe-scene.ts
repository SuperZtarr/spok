/*
 * Calculs de la vue Loupe, sans React : liens d'un item, disposition de la carte, tailles et positions à l'écran, chemin.
 * Trois tailles de vignette : l'item zoomé (big), ses liés (mid), les autres (small, la vignette minimale, jamais moins).
 * Au repos, settlePositions écarte les vignettes minimales qui se recouvrent : la carte reste lisible une fois cadrée.
 * L'item zoomé ne bouge jamais à cause d'un voisin ; ses liés s'écartent pour ne pas se recouvrir et restent dans le cadre.
 * Règle : aucune lecture du DOM ni appel réseau ici — tout passe par des paramètres, pour rester testable (loupe-scene.test.ts).
 * radialLayout vient de mindmap-layout.ts (seul calcul radial de l'application) : à importer, jamais à recopier ni modifier d'ici.
 */
import type { ItemLink, LinkedItem } from '../../lib/api';
import { radialLayout } from './mindmap-layout';

export type VignetteSize = 'small' | 'mid' | 'midTall' | 'big' | 'bigTall';
export type VignetteState = 'rest' | 'focus' | 'linked' | 'dim' | 'preview';

export const VIGNETTE_SIZES: Record<VignetteSize, { w: number; h: number }> = {
  small: { w: 108, h: 22 },
  mid: { w: 190, h: 54 },
  midTall: { w: 190, h: 130 },
  big: { w: 310, h: 190 },
  bigTall: { w: 340, h: 270 },
};

/** Niveau de détail du contenu d'une vignette (grille : loupe-vignette.ts) ; les tailles *Tall sont celles des images. */
export const levelOf = (size: VignetteSize): 'small' | 'mid' | 'big' =>
  (size === 'small' ? 'small' : size === 'mid' || size === 'midTall' ? 'mid' : 'big');

/** Au-delà, les liés restants gardent leur petite taille (mis en valeur) : la place manquerait pour les agrandir tous. */
export const MAX_ZOOMED_LINKS = 24;
const WORLD_RING_STEP = 170;
const EXTERNAL_DISTANCE = 320;
const FISHEYE_RADIUS = 240;
const FISHEYE_STRENGTH = 0.75;
const GAP = 8;
const FRAME_MARGIN = 4;
const SETTLE_ROUNDS = 200;
/** Budget du calcul : le nombre de passes baisse quand l'espace grandit, pour que la molette reste fluide. */
const SETTLE_BUDGET = 12_000;

export interface LoupeSourceItem {
  id: string;
  title: string;
  type: string;
  status?: string | null;
  spaceId?: string;
  parentId?: string | null;
  description?: string | null;
  url?: string | null;
  priority?: number | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  assignedTo?: { name?: string | null } | null;
  assignedToName?: string | null;
  relationsFrom?: Array<{ type: string; label?: string | null; toItemId: string }>;
  relationsTo?: Array<{ type: string; label?: string | null; fromItemId: string }>;
}

export interface LoupeIndex<T extends LoupeSourceItem = LoupeSourceItem> {
  byId: Map<string, T>;
  children: Map<string, T[]>;
  roots: T[];
}

export interface LoupeEdge {
  id: string;
  from: string;
  to: string;
  kind: 'hierarchy' | 'relation';
  relationType?: string;
}

export interface Point { x: number; y: number }
export interface MapView { x: number; y: number; k: number }
export interface SceneNode { cx: number; cy: number; size: VignetteSize; state: VignetteState }
export interface TrailEntry { id: string; title: string; spaceName?: string }

export function buildIndex<T extends LoupeSourceItem>(items: T[]): LoupeIndex<T> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    if (item.parentId && byId.has(item.parentId)) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
    else roots.push(item);
  }
  return { byId, children, roots };
}

const toLinked = (item: LoupeSourceItem, spaceId: string, spaceName: string): LinkedItem => ({
  id: item.id, title: item.title, type: item.type, status: item.status ?? null, spaceId, spaceName,
});

/** Liens d'un item connus sans appel réseau : tout ce qui se trouve dans l'espace courant. */
export function collectLocalLinks(index: LoupeIndex, itemId: string, spaceId: string, spaceName = ''): ItemLink[] {
  const item = index.byId.get(itemId);
  if (!item) return [];
  const linked = (other: LoupeSourceItem) => toLinked(other, spaceId, spaceName);
  const parent = item.parentId ? index.byId.get(item.parentId) : undefined;
  const links: ItemLink[] = [];
  if (parent) links.push({ kind: 'parent', item: linked(parent) });
  for (const child of index.children.get(itemId) ?? []) links.push({ kind: 'child', item: linked(child) });
  for (const r of item.relationsFrom ?? []) {
    const other = index.byId.get(r.toItemId);
    if (other) links.push({ kind: 'relation', direction: 'from', relationType: r.type, relationLabel: r.label, item: linked(other) });
  }
  for (const r of item.relationsTo ?? []) {
    const other = index.byId.get(r.fromItemId);
    if (other) links.push({ kind: 'relation', direction: 'to', relationType: r.type, relationLabel: r.label, item: linked(other) });
  }
  return links;
}

/** Fusionne les liens locaux et ceux de l'API (qui fait foi : elle connaît l'espace réel de chaque item). */
export function mergeLinks(local: ItemLink[], remote: ItemLink[] | undefined): ItemLink[] {
  const key = (l: ItemLink) => `${l.kind}:${l.direction ?? ''}:${l.relationType ?? ''}:${l.item.id}`;
  const merged = new Map(local.map((l) => [key(l), l]));
  for (const l of remote ?? []) merged.set(key(l), l);
  return [...merged.values()];
}

/** Identifiants des liés, sans doublon : relations d'abord (les plus utiles pour avancer), puis parent, puis enfants. */
export function orderedLinkedIds(links: ItemLink[]): string[] {
  const rank = { relation: 0, parent: 1, child: 2 };
  return [...new Set([...links].sort((a, b) => rank[a.kind] - rank[b.kind]).map((l) => l.item.id))];
}

const hierarchyEdge = (parent: string, child: string): LoupeEdge => ({ id: `h:${parent}:${child}`, from: parent, to: child, kind: 'hierarchy' });
const relationEdge = (from: string, to: string, type?: string): LoupeEdge => ({ id: `r:${from}:${to}:${type ?? ''}`, from, to, kind: 'relation', relationType: type });

/** Traits de l'espace courant : hiérarchie et relations dont les deux bouts sont dans l'espace. */
export function buildLocalEdges(index: LoupeIndex): LoupeEdge[] {
  const edges: LoupeEdge[] = [];
  for (const item of index.byId.values()) {
    if (item.parentId && index.byId.has(item.parentId)) edges.push(hierarchyEdge(item.parentId, item.id));
    for (const r of item.relationsFrom ?? []) {
      if (index.byId.has(r.toItemId)) edges.push(relationEdge(item.id, r.toItemId, r.type));
    }
  }
  return edges;
}

/** Traits d'un item vers ses liés, tels que renvoyés par l'API (mêmes identifiants que buildLocalEdges). */
export function edgesFromLinks(itemId: string, links: ItemLink[]): LoupeEdge[] {
  return links.map((l) => {
    if (l.kind === 'parent') return hierarchyEdge(l.item.id, itemId);
    if (l.kind === 'child') return hierarchyEdge(itemId, l.item.id);
    return l.direction === 'from' ? relationEdge(itemId, l.item.id, l.relationType) : relationEdge(l.item.id, itemId, l.relationType);
  });
}

/** Disposition de l'espace courant, en coordonnées de carte : arbre radial autour de l'origine. */
export function worldPositions(index: LoupeIndex): Map<string, Point> {
  return radialLayout(index.roots, (node) => index.children.get(node.id) ?? [], { x: 0, y: 0 }, -Math.PI / 2, Math.PI * 2, WORLD_RING_STEP);
}

/** Position d'un item d'un autre espace : au-delà de l'item qui y mène, en s'éloignant du centre de la carte. */
export function externalPosition(source: Point, index: number, count: number): Point {
  const direction = source.x === 0 && source.y === 0 ? -Math.PI / 2 : Math.atan2(source.y, source.x);
  const spread = Math.min(Math.PI * 0.9, 0.35 * (count - 1));
  const angle = count > 1 ? direction + spread * (index / (count - 1) - 0.5) : direction;
  return { x: source.x + EXTERNAL_DISTANCE * Math.cos(angle), y: source.y + EXTERNAL_DISTANCE * Math.sin(angle) };
}

/** Échelle et décalage pour que toute la carte tienne dans le cadre. */
export function fitView(points: Iterable<Point>, width: number, height: number, padding = 90): MapView {
  const list = [...points];
  if (list.length === 0) return { x: width / 2, y: height / 2, k: 1 };
  const xs = list.map((p) => p.x);
  const ys = list.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const availableW = Math.max(width - padding * 2, 1);
  const availableH = Math.max(height - padding * 2, 1);
  const k = Math.max(0.05, Math.min(availableW / Math.max(maxX - minX, 1), availableH / Math.max(maxY - minY, 1), 1.2));
  return { x: width / 2 - k * (minX + maxX) / 2, y: height / 2 - k * (minY + maxY) / 2, k };
}

interface Placed { id: string; cx: number; cy: number; size: VignetteSize; fixed: boolean }

function keepInFrame(p: Placed, width: number, height: number) {
  const { w, h } = VIGNETTE_SIZES[p.size];
  p.cx = Math.max(w / 2 + FRAME_MARGIN, Math.min(Math.max(w / 2 + FRAME_MARGIN, width - w / 2 - FRAME_MARGIN), p.cx));
  p.cy = Math.max(h / 2 + FRAME_MARGIN, Math.min(Math.max(h / 2 + FRAME_MARGIN, height - h / 2 - FRAME_MARGIN), p.cy));
}

/**
 * Écarte deux vignettes qui se recouvrent, le long de l'axe où il faut bouger le moins, rapporté à leur taille : sans ce
 * rapport, des vignettes plus larges que hautes s'empileraient toujours en colonne. moveQ : part du déplacement portée par q.
 */
function separate(p: Placed, q: Placed, moveQ: number): boolean {
  const overlapX = (VIGNETTE_SIZES[p.size].w + VIGNETTE_SIZES[q.size].w) / 2 + GAP - Math.abs(p.cx - q.cx);
  const overlapY = (VIGNETTE_SIZES[p.size].h + VIGNETTE_SIZES[q.size].h) / 2 + GAP - Math.abs(p.cy - q.cy);
  if (overlapX <= 0 || overlapY <= 0) return false;
  const widthRef = VIGNETTE_SIZES[p.size].w + VIGNETTE_SIZES[q.size].w;
  const heightRef = VIGNETTE_SIZES[p.size].h + VIGNETTE_SIZES[q.size].h;
  if (overlapX / widthRef < overlapY / heightRef) {
    const sign = p.cx <= q.cx ? 1 : -1;
    p.cx -= sign * overlapX * (1 - moveQ);
    q.cx += sign * overlapX * moveQ;
  } else {
    const sign = p.cy <= q.cy ? 1 : -1;
    p.cy -= sign * overlapY * (1 - moveQ);
    q.cy += sign * overlapY * moveQ;
  }
  return true;
}

/**
 * Positions de la carte à l'échelle k (en pixels, sans le déplacement de la carte), vignettes minimales écartées pour ne
 * pas se recouvrir. Balayage trié par abscisse : seules les voisines sont comparées, un grand espace reste rapide.
 * Passes bornées par SETTLE_ROUNDS et SETTLE_BUDGET : sur un très grand espace, des recouvrements peuvent subsister.
 */
export function settlePositions(positions: Map<string, Point>, k: number): Map<string, Point> {
  const placed: Placed[] = [...positions].map(([id, p]) => ({ id, cx: p.x * k, cy: p.y * k, size: 'small', fixed: false }));
  const reach = VIGNETTE_SIZES.small.w + GAP;
  const rounds = Math.min(SETTLE_ROUNDS, Math.ceil(SETTLE_BUDGET / Math.max(placed.length, 1)));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    placed.sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length && placed[j].cx - placed[i].cx < reach; j++) {
        if (separate(placed[i], placed[j], 0.5)) moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(placed.map((p) => [p.id, { x: p.cx, y: p.cy }]));
}

/** Cadrage de la carte : l'échelle vient de la disposition, le centrage tient compte de l'écartement des vignettes. */
export function fitMap(positions: Map<string, Point>, width: number, height: number): MapView {
  const { k } = fitView(positions.values(), width, height);
  const settled = [...settlePositions(positions, k).values()];
  if (settled.length === 0) return { x: width / 2, y: height / 2, k };
  const xs = settled.map((p) => p.x);
  const ys = settled.map((p) => p.y);
  return { k, x: width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, y: height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * Positions et tailles à l'écran, à partir des positions écartées (settlePositions) et du déplacement de la carte.
 * Sans item zoomé : la carte telle quelle.
 * Avec : l'item grossit à sa place (ramené dans le cadre s'il le faut), ses liés passent en taille intermédiaire et
 * restent visibles dans le cadre, les autres s'estompent sur place.
 * previewId (zoom figé) : cet item passe en taille intermédiaire par-dessus la carte, sans déplacer aucune autre vignette.
 * tallIds : items à miniature (Image, Diagramme), dont la vignette agrandie est plus haute.
 */
export function computeScene(params: {
  positions: Map<string, Point>;
  offset: Point;
  width: number;
  height: number;
  focusId: string | null;
  linkedIds: string[];
  previewId?: string | null;
  tallIds?: Set<string>;
}): Map<string, SceneNode> {
  const { positions, offset, width, height, focusId, linkedIds, previewId, tallIds } = params;
  const midSize = (id: string): VignetteSize => (tallIds?.has(id) ? 'midTall' : 'mid');
  const rest: VignetteSize = 'small';
  const toScreen = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y });
  const scene = new Map<string, SceneNode>();

  const focusPoint = focusId ? positions.get(focusId) : undefined;
  if (!focusId || !focusPoint) {
    for (const [id, p] of positions) {
      const s = toScreen(p);
      scene.set(id, { cx: s.x, cy: s.y, size: rest, state: 'rest' });
    }
    return scene;
  }

  const focusScreen = toScreen(focusPoint);
  const focus: Placed = { id: focusId, cx: focusScreen.x, cy: focusScreen.y, size: tallIds?.has(focusId) ? 'bigTall' : 'big', fixed: true };
  keepInFrame(focus, width, height);

  const pushed = (p: Point): Point => {
    const s = toScreen(p);
    const dx = s.x - focus.cx;
    const dy = s.y - focus.cy;
    const distance = Math.hypot(dx, dy) || 1;
    const push = Math.max(0, FISHEYE_RADIUS - distance) * FISHEYE_STRENGTH;
    return { x: s.x + (dx / distance) * push, y: s.y + (dy / distance) * push };
  };

  const shownLinks = linkedIds.filter((id) => id !== focusId && positions.has(id));
  const zoomedIds = new Set(shownLinks.slice(0, MAX_ZOOMED_LINKS));
  const allLinks = new Set(shownLinks);
  const zoomed: Placed[] = [...zoomedIds].map((id) => {
    const s = pushed(positions.get(id)!);
    return { id, cx: s.x, cy: s.y, size: midSize(id), fixed: false };
  });

  for (let round = 0; round < 24; round++) {
    zoomed.forEach((p, i) => {
      separate(focus, p, 1);
      zoomed.slice(i + 1).forEach((q) => separate(p, q, 0.5));
    });
    zoomed.forEach((p) => keepInFrame(p, width, height));
  }
  // Le cadre a pu ramener un lié sous l'item zoomé : dernier écart, qui prime sur le cadre
  zoomed.forEach((p) => separate(focus, p, 1));

  scene.set(focusId, { cx: focus.cx, cy: focus.cy, size: focus.size, state: 'focus' });
  zoomed.forEach((p) => scene.set(p.id, { cx: p.cx, cy: p.cy, size: p.size, state: 'linked' }));

  // Les autres ne bougent jamais (décision Thomas 2026-11-07) : déplacer toute la carte à chaque survol la rendait illisible
  for (const [id, p] of positions) {
    if (scene.has(id)) continue;
    const s = toScreen(p);
    scene.set(id, { cx: s.x, cy: s.y, size: rest, state: allLinks.has(id) ? 'linked' : 'dim' });
  }

  const preview = previewId ? scene.get(previewId) : undefined;
  if (previewId && preview?.size === 'small') {
    const placed: Placed = { id: previewId, cx: preview.cx, cy: preview.cy, size: midSize(previewId), fixed: false };
    keepInFrame(placed, width, height);
    scene.set(previewId, { cx: placed.cx, cy: placed.cy, size: placed.size, state: 'preview' });
  }
  return scene;
}

/** Ajoute une étape au chemin ; revenir sur un item déjà parcouru coupe ce qui suit. */
export function advanceTrail(trail: TrailEntry[], entry: TrailEntry): TrailEntry[] {
  const at = trail.findIndex((t) => t.id === entry.id);
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, entry];
}
