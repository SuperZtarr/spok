/*
 * Calculs de la vue Loupe, sans React : liens d'un item, disposition de la carte, tailles et positions à l'écran, chemin.
 * Trois tailles de vignette : l'item zoomé (big), ses liés (mid), les autres (small, au repos).
 * Au repos, chaque item a une forme (RestShape) donnée par allocateRest — décisions Thomas 2026-11-20 :
 *   - poids : score brut (weightScore : contenus + enfants + relations + priorité − 1 + éléments d'un article), rapporté à
 *     l'espace (relativeWeights : le plus haut ×3, le plus bas ×1, proportionnel entre les deux, sans plafond fixe) ;
 *   - la fenêtre ne bouge pas (2 à 1000 éléments, tout écran) : un seul facteur d'écran, tiré de la place réelle, multiplie
 *     toutes les vignettes — les rapports entre elles restent (un important reste jusqu'à 3 fois plus grand qu'un normal) ;
 *   - un item que ce facteur rendrait illisible (moins d'une ligne de texte) devient une pastille-icône : le bas du
 *     classement de l'espace d'abord, les plus importants en dernier.
 * rest (id → RestShape) est passé à settlePositions, fitMap et computeScene ; toute dimension au repos passe par
 * restDims() : ne jamais relire VIGNETTE_SIZES.small sans la forme.
 * Au repos, settlePositions écarte les vignettes minimales qui se recouvrent : la carte reste lisible une fois cadrée.
 * fitMap cadre sur les boîtes réelles (écartement et agrandissement compris), pas sur les seuls centres.
 * L'item zoomé ne bouge jamais à cause d'un voisin ; ses liés s'écartent pour ne pas se recouvrir et restent dans le cadre.
 * Règle : aucune lecture du DOM ni appel réseau ici — tout passe par des paramètres, pour rester testable (loupe-scene.test.ts).
 * radialLayout vient de mindmap-layout.ts (seul calcul radial de l'application) : à importer, jamais à recopier ni modifier d'ici.
 */
import type { Tag } from '@spok/shared';
import type { ItemLink, LinkedItem } from '../../lib/api';
import type { FaceContent } from '../../lib/itemFace';
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

/** Agrandissement de l'item le plus lourd de l'espace (le plus léger vaut ×1). */
export const SCALE_MAX = 3;

/**
 * Score brut d'un item, sans plafond : contenus + enfants + relations (dans les deux sens), chacun compte 1,
 * + priorité − 1 (Basse 0 … Critique 3, rien si non renseignée) + éléments assemblés par un article (articleBlockCount,
 * renvoyé par la liste de l'API) — décisions Thomas 2026-11-20.
 * childCount est fourni par l'appelant (index.children) ; un item d'un autre espace n'a que ses contenus de connus.
 */
export function weightScore(
  item: Pick<LoupeSourceItem, 'contents' | 'relationsFrom' | 'relationsTo' | 'priority' | 'articleBlockCount'>,
  childCount = 0,
): number {
  return (item.contents?.length ?? 0) + childCount + (item.relationsFrom?.length ?? 0) + (item.relationsTo?.length ?? 0)
    + Math.max(0, (item.priority ?? 1) - 1) + (item.articleBlockCount ?? 0);
}

/**
 * Poids relatif à l'espace (décision Thomas 2026-11-20 : un plafond fixe à 5 points écrasait les écarts — 1 image et
 * 20 relations finissaient presque à la même taille) : le score le plus haut de l'espace vaut ×SCALE_MAX, le plus bas ×1,
 * les autres proportionnellement entre les deux. Tous les scores égaux : ×1 pour tous.
 */
export function relativeWeights(scores: Map<string, number>): Map<string, number> {
  const values = [...scores.values()];
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const span = max - min;
  return new Map([...scores].map(([id, score]) => [id, span > 0 ? 1 + (SCALE_MAX - 1) * (score - min) / span : 1]));
}

/** Dimensions d'une vignette, facteur d'agrandissement compris. */
export const dims = (size: VignetteSize, scale = 1): { w: number; h: number } =>
  ({ w: VIGNETTE_SIZES[size].w * scale, h: VIGNETTE_SIZES[size].h * scale });

/**
 * Forme d'un item au repos. full : vignette de taille de base × scale (scale = facteur d'écran × poids) ;
 * mark : pastille-icône de côté MARK_SIZE × scale (scale = facteur d'écran), bornée à [MIN_MARK, MARK_SIZE].
 */
export interface RestShape { scale: number; shape: 'full' | 'mark' }
export const MARK_SIZE = 22;
const MIN_MARK = 10;
/** Hauteur minimale d'une vignette lisible (une ligne de texte) : en dessous, l'item devient pastille. */
export const MIN_READABLE_H = 20;
/** Bornes du facteur d'écran : au-delà de G_MAX, un petit espace sur un grand écran n'a pas besoin de plus. */
const G_MAX = 1.5;
const G_MIN = 0.1;

/** Dimensions d'un item au repos selon sa forme (sans forme : taille de base). */
export function restDims(rest?: RestShape): { w: number; h: number } {
  if (!rest || rest.shape === 'full') return dims('small', rest?.scale ?? 1);
  const side = Math.max(MIN_MARK, Math.min(MARK_SIZE, MARK_SIZE * rest.scale));
  return { w: side, h: side };
}

/** Part du cadre que les items au repos peuvent couvrir (écarts compris) : au-delà, la carte ne tiendrait plus. */
const REST_AREA_BUDGET = 0.35;

/** Forme d'un item de poids `weight` pour le facteur d'écran g : vignette si elle reste lisible, sinon pastille. */
const shapeAt = (weight: number, g: number): RestShape =>
  (VIGNETTE_SIZES.small.h * g * weight >= MIN_READABLE_H ? { scale: g * weight, shape: 'full' } : { scale: g, shape: 'mark' });

/**
 * Répartition proportionnelle à la place réelle (décision Thomas 2026-11-20, « ajustement proportionnel à l'espace de
 * l'écran », hiérarchie conservée). weights : poids de chaque item (relativeWeights, ×1…×3).
 * Un seul facteur d'écran g (le plus grand de [G_MIN, G_MAX] pour lequel la surface tient dans REST_AREA_BUDGET du cadre)
 * multiplie toutes les vignettes : taille = base × g × poids, donc les rapports entre items ne changent jamais.
 * Un item dont la vignette serait illisible (hauteur < MIN_READABLE_H) devient pastille : comme le seuil dépend du poids,
 * c'est toujours le bas du classement qui y passe d'abord, les plus importants en dernier.
 * Écart connu : avec des centaines d'items, même en pastilles la carte peut déborder (centrée par fitMap).
 */
export function allocateRest(weights: Map<string, number>, width: number, height: number): Map<string, RestShape> {
  const shapesAt = (g: number) => new Map<string, RestShape>([...weights].map(([id, s]) => [id, shapeAt(s, g)]));
  if (width <= 0 || height <= 0) return shapesAt(1);
  const budget = REST_AREA_BUDGET * width * height;
  const areaAt = (g: number) => {
    let total = 0;
    for (const s of weights.values()) {
      const { w, h } = restDims(shapeAt(s, g));
      total += (w + GAP) * (h + GAP);
    }
    return total;
  };
  // Plus grand facteur qui tient : descente géométrique (la surface n'est pas strictement monotone aux bascules en pastille)
  for (let g = G_MAX; g >= G_MIN; g *= 0.97) {
    if (areaAt(g) <= budget) return shapesAt(g);
  }
  return shapesAt(G_MIN);
}

/** Lignes de titre d'une vignette au format ligne selon sa hauteur (lignes de 20 px, 4 px de marge) : 1 à 3. */
export const titleLinesFor = (height: number): 1 | 2 | 3 =>
  (Math.max(1, Math.min(3, Math.floor((height - 4) / 20))) as 1 | 2 | 3);

/**
 * Format d'une vignette au repos : assez haute pour une carte (hauteur de la carte intermédiaire), elle montre statut,
 * dates, extrait et pastilles au lieu d'une ligne dans une grande boîte vide (retour Thomas 2026-11-20, lot B).
 */
export const restFormatFor = (height: number): 'ligne' | 'carte' => (height >= VIGNETTE_SIZES.mid.h ? 'carte' : 'ligne');

/** Nombre de traits de chaque élément (degré), sur les traits affichés. */
export function degrees(edges: LoupeEdge[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  return degree;
}

/**
 * Trait au repos (sans zoom) : plus épais et plus foncé quand il touche un élément très relié — de 1 à 3 px,
 * opacité 0,3 à 0,85 selon le plus grand degré de ses deux bouts rapporté au degré maximal de la carte.
 */
export function edgeStrength(degreeFrom: number, degreeTo: number, maxDegree: number): { width: number; opacity: number } {
  const t = maxDegree > 1 ? Math.max(0, Math.min(1, (Math.max(degreeFrom, degreeTo) - 1) / (maxDegree - 1))) : 0;
  return { width: 1 + 2 * t, opacity: 0.3 + 0.55 * t };
}

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
/** Cadrage (fitMap) : marge autour des vignettes, passes de réduction de l'échelle, échelle minimale (comme fitView). */
const FIT_PADDING = 24;
const FIT_ROUNDS = 10;
const MIN_K = 0.05;
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
  /** Article : nombre d'éléments qu'il assemble (poids de sa vignette, weightScore) */
  articleBlockCount?: number;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  assignedTo?: { name?: string | null } | null;
  assignedToName?: string | null;
  /** Vignette commune (lib/itemFace.ts) : miniature et pastilles ; tags affichés en carte et en grande */
  contents?: FaceContent[] | null;
  tags?: Tag[];
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
/** bias : biais d'écartement retenu par fitMap, à repasser à settlePositions (1 si la vue n'a pas été cadrée) */
export interface MapView { x: number; y: number; k: number; bias?: number }
/** rest : forme au repos (allocateRest), seulement pour size 'small' ; dimensions : sceneDims(node). */
export interface SceneNode { cx: number; cy: number; size: VignetteSize; state: VignetteState; rest: RestShape }

/** Dimensions réelles d'un nœud de scène (forme au repos en petite taille, taille fixe sinon). */
export const sceneDims = (node: Pick<SceneNode, 'size' | 'rest'>) => (node.size === 'small' ? restDims(node.rest) : dims(node.size));
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
  const k = Math.max(MIN_K, Math.min(availableW / Math.max(maxX - minX, 1), availableH / Math.max(maxY - minY, 1), 1.2));
  return { x: width / 2 - k * (minX + maxX) / 2, y: height / 2 - k * (minY + maxY) / 2, k };
}

/** w, h : dimensions réelles (restDims au repos, dims sinon), calculées une fois à la création. */
interface Placed { id: string; cx: number; cy: number; size: VignetteSize; w: number; h: number; fixed: boolean }

const placedBox = (size: VignetteSize, rest?: RestShape) => (size === 'small' ? restDims(rest) : dims(size));

function keepInFrame(p: Placed, width: number, height: number) {
  const { w, h } = p;
  p.cx = Math.max(w / 2 + FRAME_MARGIN, Math.min(Math.max(w / 2 + FRAME_MARGIN, width - w / 2 - FRAME_MARGIN), p.cx));
  p.cy = Math.max(h / 2 + FRAME_MARGIN, Math.min(Math.max(h / 2 + FRAME_MARGIN, height - h / 2 - FRAME_MARGIN), p.cy));
}

/**
 * Écarte deux vignettes qui se recouvrent, le long de l'axe où il faut bouger le moins, rapporté à leur taille : sans ce
 * rapport, des vignettes plus larges que hautes s'empileraient toujours en colonne. moveQ : part du déplacement portée par q.
 */
function separate(p: Placed, q: Placed, moveQ: number, yBias = 1): boolean {
  const [dp, dq] = [p, q];
  const overlapX = (dp.w + dq.w) / 2 + GAP - Math.abs(p.cx - q.cx);
  const overlapY = (dp.h + dq.h) / 2 + GAP - Math.abs(p.cy - q.cy);
  if (overlapX <= 0 || overlapY <= 0) return false;
  const widthRef = dp.w + dq.w;
  const heightRef = dp.h + dq.h;
  if ((overlapX / widthRef) * yBias < overlapY / heightRef) {
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
export function settlePositions(positions: Map<string, Point>, k: number, rest?: Map<string, RestShape>, yBias = 1): Map<string, Point> {
  const placed: Placed[] = [...positions].map(([id, p]) => ({ id, cx: p.x * k, cy: p.y * k, size: 'small', ...placedBox('small', rest?.get(id)), fixed: false }));
  // Portée du balayage : la plus large vignette possible, pour ne manquer aucun recouvrement
  const reach = VIGNETTE_SIZES.small.w * SCALE_MAX + GAP;
  const rounds = Math.min(SETTLE_ROUNDS, Math.ceil(SETTLE_BUDGET / Math.max(placed.length, 1)));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    placed.sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length && placed[j].cx - placed[i].cx < reach; j++) {
        if (separate(placed[i], placed[j], 0.5, yBias)) moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(placed.map((p) => [p.id, { x: p.cx, y: p.cy }]));
}

/**
 * Biais d'écartement essayés par fitMap : 1 = choix de l'axe rapporté à la taille des vignettes ; plus grand = les
 * vignettes (larges) s'écartent de préférence en hauteur. Mesuré 2026-11-20 : à 1 la carte s'étale en largeur et laisse
 * la hauteur vide, à 2 elle peut déborder en hauteur — fitMap garde le meilleur, renvoyé dans MapView.bias.
 */
const FIT_BIASES = [1, 1.4, 2];

/** Bords des items au repos (forme comprise), en pixels de carte. */
function restBounds(settled: Map<string, Point>, rest?: Map<string, RestShape>) {
  let [l, r, t, b] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [id, p] of settled) {
    const { w, h } = restDims(rest?.get(id));
    l = Math.min(l, p.x - w / 2); r = Math.max(r, p.x + w / 2);
    t = Math.min(t, p.y - h / 2); b = Math.max(b, p.y + h / 2);
  }
  return { l, r, t, b };
}

/**
 * Cadrage de la carte : les vignettes entières (taille réelle, écartement compris) tiennent dans le cadre, centrées.
 * Diagnostic 2026-11-20 : calculer l'échelle sur les seuls centres laissait l'écartement étaler la carte bien au-delà du
 * cadre (1,6 fois sa largeur sur 65 éléments). L'échelle est donc réduite tant que les boîtes débordent (FIT_ROUNDS
 * passes au plus) ; sur un espace trop dense pour tenir même à l'échelle minimale, la carte reste centrée et déborde.
 */
export function fitMap(positions: Map<string, Point>, width: number, height: number, rest?: Map<string, RestShape>): MapView {
  const k0 = fitView(positions.values(), width, height).k;
  if (positions.size === 0) return { x: width / 2, y: height / 2, k: k0 };
  const availableW = Math.max(width - FIT_PADDING * 2, 1);
  const availableH = Math.max(height - FIT_PADDING * 2, 1);
  const ratioOf = (box: ReturnType<typeof restBounds>) =>
    Math.min(availableW / Math.max(box.r - box.l, 1), availableH / Math.max(box.b - box.t, 1));
  // L'écartement ne répond pas de façon régulière à l'échelle : on garde le meilleur essai (échelle, biais)
  let best: { k: number; bias: number; box: ReturnType<typeof restBounds>; ratio: number } | null = null;
  for (const bias of FIT_BIASES) {
    let k = k0;
    for (let round = 0; round <= FIT_ROUNDS; round++) {
      const box = restBounds(settlePositions(positions, k, rest, bias), rest);
      const ratio = ratioOf(box);
      // À ajustement égal, la plus grande échelle (carte la plus étalée) gagne
      if (!best || Math.min(ratio, 1) > Math.min(best.ratio, 1) + 1e-6 || (ratio >= 1 && best.ratio >= 1 && k > best.k)) best = { k, bias, box, ratio };
      if (ratio >= 1 || k <= MIN_K) break;
      k = Math.max(MIN_K, k * ratio * 0.97);
    }
  }
  const { k, bias, box } = best!;
  return { k, bias, x: width / 2 - (box.l + box.r) / 2, y: height / 2 - (box.t + box.b) / 2 };
}

/**
 * Positions et tailles à l'écran, à partir des positions écartées (settlePositions) et du déplacement de la carte.
 * Sans item zoomé : la carte telle quelle.
 * Avec : l'item grossit à sa place (ramené dans le cadre s'il le faut), ses liés passent en taille intermédiaire et
 * restent visibles dans le cadre, les autres s'estompent sur place.
 * previewId (zoom figé) : cet item passe en taille intermédiaire par-dessus la carte, sans déplacer aucune autre vignette.
 * tallIds : items à miniature (Image, Diagramme), dont la vignette agrandie est plus haute.
 * rest : forme de chaque item au repos (allocateRest) ; elle ne vaut qu'en petite taille (repos, estompé, lié au-delà
 * du plafond) : zoomé, lié à mi-taille et aperçu gardent leur taille fixe (Thomas 2026-11-20).
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
  rest?: Map<string, RestShape>;
}): Map<string, SceneNode> {
  const { positions, offset, width, height, focusId, linkedIds, previewId, tallIds, rest: restShapes } = params;
  const midSize = (id: string): VignetteSize => (tallIds?.has(id) ? 'midTall' : 'mid');
  const FULL: RestShape = { scale: 1, shape: 'full' };
  const restOf = (id: string): RestShape => restShapes?.get(id) ?? FULL;
  const placed = (id: string, cx: number, cy: number, size: VignetteSize, fixed: boolean): Placed =>
    ({ id, cx, cy, size, ...placedBox(size), fixed });
  const rest: VignetteSize = 'small';
  const toScreen = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y });
  const scene = new Map<string, SceneNode>();

  const focusPoint = focusId ? positions.get(focusId) : undefined;
  if (!focusId || !focusPoint) {
    for (const [id, p] of positions) {
      const s = toScreen(p);
      scene.set(id, { cx: s.x, cy: s.y, size: rest, state: 'rest', rest: restOf(id) });
    }
    return scene;
  }

  const focusScreen = toScreen(focusPoint);
  const focus = placed(focusId, focusScreen.x, focusScreen.y, tallIds?.has(focusId) ? 'bigTall' : 'big', true);
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
    return placed(id, s.x, s.y, midSize(id), false);
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

  scene.set(focusId, { cx: focus.cx, cy: focus.cy, size: focus.size, state: 'focus', rest: FULL });
  zoomed.forEach((p) => scene.set(p.id, { cx: p.cx, cy: p.cy, size: p.size, state: 'linked', rest: FULL }));

  // Les autres ne bougent jamais (décision Thomas 2026-11-07) : déplacer toute la carte à chaque survol la rendait illisible
  for (const [id, p] of positions) {
    if (scene.has(id)) continue;
    const s = toScreen(p);
    scene.set(id, { cx: s.x, cy: s.y, size: rest, state: allLinks.has(id) ? 'linked' : 'dim', rest: restOf(id) });
  }

  const preview = previewId ? scene.get(previewId) : undefined;
  if (previewId && preview?.size === 'small') {
    const p = placed(previewId, preview.cx, preview.cy, midSize(previewId), false);
    keepInFrame(p, width, height);
    scene.set(previewId, { cx: p.cx, cy: p.cy, size: p.size, state: 'preview', rest: FULL });
  }
  return scene;
}

/** Ajoute une étape au chemin ; revenir sur un item déjà parcouru coupe ce qui suit. */
export function advanceTrail(trail: TrailEntry[], entry: TrailEntry): TrailEntry[] {
  const at = trail.findIndex((t) => t.id === entry.id);
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, entry];
}
