/* Layout de la MindMap : placement radial des nœuds, espacement, recalcul, rafraîchissement des callbacks des nœuds (withCurrentCallbacks) — zone fragile (cf. CLAUDE.md).
   Portails de sous-espaces : arc au-dessus du nœud espace, pas de 40° ramené à 360°/N au-delà de 9 (pas de superposition).
   Hiérarchie (2026-10-14) : un sous-espace dont le parent est aussi affiché est relié au nœud de ce parent
   (child-space-<parent>) et placé dans son prolongement ; seuls les sous-espaces de premier niveau sont sur l'arc.
   Étalement (2026-11-04) : radialLayout est le seul calcul (calculateLayout, éléments de portail, ré-éventail de MindMapView) —
   anneaux réguliers par profondeur, angle selon la taille de la branche, intervalle borné.
   anchorToSaved : place autour de leur parent, déjà positionné, les nœuds sans position enregistrée. */
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ItemWithRelations, StatusConfig, SpaceWithRole } from '@spok/shared';
import { getRelationMeta } from '../../constants/relationTypes';

// Libellé d'arête : source unique constants/relationTypes.ts (type hors liste → nom brut)
function relationEdgeLabel(type: string, label?: string | null): string {
  const base = getRelationMeta(type).label;
  if (!label) return base;
  const short = label.length > 30 ? label.slice(0, 27) + '…' : label;
  return `${base} · ${short}`;
}
import {
  type TreeItem,
  type LayoutDatum,
  type PortalState,
  getStatusColor,
  tailwindBgToHex,
  getContrastTextColor,
  buildTree,
  countDescendants,
  maxDepth,
} from './mindmap-utils';

export const SPACE_NODE_ID = '__space__';

const RING_STEP = 300; // distance minimale entre deux anneaux
const RING_MAX_STEP = 1200; // borne : un parent très chargé ne projette pas ses enfants à l'autre bout de la carte
const RING_MIN_SPACING = 160; // écart minimal entre deux voisins d'un même anneau (largeur d'un nœud : 150)

/** Ouverture d'une branche réorganisée ou d'un sous-espace : un demi-cercle, plus si les enfants sont nombreux, jamais de retour vers le parent. */
export const branchArc = (count: number) => Math.min(Math.PI * 1.5, Math.max(Math.PI, count * (Math.PI / 4)));

/**
 * Disposition radiale d'un sous-arbre autour d'un centre : les nœuds d'une même profondeur sont sur le même anneau, à
 * intervalles réguliers. Chaque branche reste dans son secteur, dont l'angle dépend de son nombre de feuilles (mêlé à une part
 * égale, pour qu'une grosse branche n'écrase pas ses sœurs) : deux branches voisines ne se croisent pas.
 * L'intervalle entre anneaux s'élargit jusqu'à ce que les voisins les plus serrés ne se recouvrent plus (borné par RING_MAX_STEP).
 * - dirAngle / arc : direction et ouverture du secteur ; arc = 2π pour un cercle complet
 * - childrenOf : enfants VISIBLES d'un nœud (sans les branches repliées)
 */
export function radialLayout<T extends { id: string }>(
  roots: T[],
  childrenOf: (node: T) => T[],
  center: { x: number; y: number },
  dirAngle: number,
  arc: number,
  minStep = RING_STEP,
): Map<string, { x: number; y: number }> {
  const leavesOf = (node: T): number => {
    const kids = childrenOf(node);
    return kids.length === 0 ? 1 : kids.reduce((sum, k) => sum + leavesOf(k), 0);
  };
  const placed: Array<{ id: string; angle: number; depth: number }> = [];
  const anglesByDepth = new Map<number, number[]>();

  const assign = (nodes: T[], start: number, span: number, depth: number) => {
    const leaves = nodes.map(leavesOf);
    const total = leaves.reduce((s, v) => s + v, 0);
    let cursor = start;
    nodes.forEach((node, i) => {
      const slot = span * (0.5 / nodes.length + 0.5 * (leaves[i] / total));
      const angle = cursor + slot / 2;
      placed.push({ id: node.id, angle, depth });
      anglesByDepth.set(depth, [...(anglesByDepth.get(depth) ?? []), angle]);
      assign(childrenOf(node), cursor, slot, depth + 1);
      cursor += slot;
    });
  };
  assign(roots, dirAngle - arc / 2, arc, 1);

  let step = minStep;
  for (const [depth, angles] of anglesByDepth) {
    const sorted = [...angles].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      step = Math.max(step, RING_MIN_SPACING / (Math.max(sorted[i] - sorted[i - 1], 0.001) * depth));
    }
  }
  step = Math.min(step, RING_MAX_STEP);

  return new Map(placed.map(({ id, angle, depth }) => [id, {
    x: center.x + step * depth * Math.cos(angle),
    y: center.y + step * depth * Math.sin(angle),
  }]));
}

/**
 * Positions finales d'un calcul de disposition : une position enregistrée fait foi ; un nœud sans position (branche jamais
 * dépliée, nouveau) suit le déplacement de son parent — même translation et même rotation que celles subies par le parent
 * entre le calcul et sa position réelle. Sans ça, il apparaîtrait à sa place calculée, loin de son parent figé.
 * treeEdges : arêtes parent → enfant uniquement (jamais les relations).
 */
export function anchorToSaved(nodes: Node[], treeEdges: Edge[], saved: Record<string, { x: number; y: number }>): Node[] {
  const computed = new Map(nodes.map(n => [n.id, n.position]));
  const parentOf = new Map(treeEdges.map(e => [e.target, e.source]));
  const final = new Map<string, { x: number; y: number }>();

  const place = (id: string | undefined): { x: number; y: number } | undefined => {
    if (!id) return undefined;
    const known = final.get(id);
    if (known) return known;
    const own = computed.get(id);
    if (!own) return undefined;
    final.set(id, own); // garde-fou contre une boucle de parenté
    let pos = saved[id] ?? own;
    const parentId = parentOf.get(id);
    const parentFinal = place(parentId);
    const parentComputed = parentId ? computed.get(parentId) : undefined;
    if (!saved[id] && parentFinal && parentComputed) {
      const grandId = parentId ? parentOf.get(parentId) : undefined;
      const grandFinal = place(grandId);
      const grandComputed = grandId ? computed.get(grandId) : undefined;
      const rotation = grandFinal && grandComputed
        ? Math.atan2(parentFinal.y - grandFinal.y, parentFinal.x - grandFinal.x) - Math.atan2(parentComputed.y - grandComputed.y, parentComputed.x - grandComputed.x)
        : 0;
      const dx = own.x - parentComputed.x;
      const dy = own.y - parentComputed.y;
      pos = {
        x: parentFinal.x + dx * Math.cos(rotation) - dy * Math.sin(rotation),
        y: parentFinal.y + dx * Math.sin(rotation) + dy * Math.cos(rotation),
      };
    }
    final.set(id, pos);
    return pos;
  };

  return nodes.map(n => ({ ...n, position: place(n.id) ?? n.position }));
}

// Helper: get best edge handles from dx/dy between two positions
function getBestHandles(parentPos: { x: number; y: number }, childPos: { x: number; y: number }) {
  const dx = childPos.x - parentPos.x;
  const dy = childPos.y - parentPos.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sourceHandle: 'right-source', targetHandle: 'left' }
      : { sourceHandle: 'left-source', targetHandle: 'right' };
  }
  return dy > 0
    ? { sourceHandle: 'bottom-source', targetHandle: 'top' }
    : { sourceHandle: 'top-source', targetHandle: 'bottom' };
}

// Node data callbacks interface (to avoid passing 15+ individual params)
export interface MindMapCallbacks {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (id: string) => void;
  onAddPortal: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onReorganizeChildren: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onSavePosition?: (id: string, pos: { x: number; y: number }) => void;
}

const NODE_CALLBACK_KEYS = [
  'onEdit', 'onDelete', 'onUpdateStatus', 'onAddChild', 'onAddPortal', 'onToggleCollapse',
  'onReorganizeChildren', 'onMoveToSpace', 'onDuplicateToSpace', 'onConvertToSpace', 'onSelfAssign',
  'onMerge', 'onAbsorbChildren', 'onSplitDescription', 'onOpenInNewTab', 'onTogglePin', 'onSavePosition',
] as const satisfies readonly (keyof MindMapCallbacks)[];

/**
 * Remplace, dans les data d'un nœud déjà construit, les actions par leur version COURANTE.
 * Les nœuds stockent leurs callbacks à la construction ; depuis le layout incrémental ils ne sont
 * plus reconstruits → sans ça, un onDelete/onMerge/onConvertToSpace… gardait un handler de SpacePage
 * capturant une liste d'items ancienne (ex. « N descendants » à la suppression d'un parent vidé).
 * Ne touche qu'aux clés déjà présentes ; renvoie `data` inchangé si rien ne change.
 */
export function withCurrentCallbacks<T extends Record<string, unknown>>(data: T, callbacks: MindMapCallbacks): T {
  let next: T | null = null;
  for (const key of NODE_CALLBACK_KEYS) {
    if (!(key in data)) continue;
    const current = callbacks[key] ?? (key === 'onTogglePin' ? data[key] : undefined);
    if (data[key] !== current) {
      next = next ?? { ...data };
      (next as Record<string, unknown>)[key] = current;
    }
  }
  return next ?? data;
}

export interface MindMapLayoutOptions {
  hasPortalSupport: boolean;
  statusOptions: Array<{ id: string; label: string }>;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  pinnedIdsSet?: Set<string>;
  currentSpaceId?: string;
  portalSpaceNames?: Map<string, string>;
}

/** Fabrique un nœud mindmap ReactFlow pour un item — utilisée par calculateLayout ET le chemin incrémental de MindMapView (les deux doivent produire des data identiques). `position` est la position déjà ajustée (coin haut-gauche). */
export function buildMindmapNode(
  item: TreeItem,
  position: { x: number; y: number },
  statuses: StatusConfig[],
  collapsedIds: Set<string>,
  callbacks: MindMapCallbacks,
  options: MindMapLayoutOptions,
  isRoot: boolean,
): Node {
  const { onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, onTogglePin, onSavePosition } = callbacks;
  const { hasPortalSupport, statusOptions, highlightType, highlightStatus, searchMatchIds, canEdit, canEditItem, pinnedIdsSet, currentSpaceId, portalSpaceNames } = options;
  const statusColor = getStatusColor(item.status, statuses);
  const hexColor = tailwindBgToHex(statusColor);
  return {
    id: item.id,
    type: 'mindmap',
    position,
    data: {
      label: item.title,
      item,
      statusColor,
      hexColor,
      textColor: getContrastTextColor(hexColor),
      onEdit,
      onDelete,
      onUpdateStatus,
      onAddChild,
      onAddPortal,
      onToggleCollapse,
      onReorganizeChildren,
      onMoveToSpace,
      onDuplicateToSpace,
      onConvertToSpace,
      onSelfAssign,
      onMerge,
      onAbsorbChildren,
      onSplitDescription,
      onOpenInNewTab,
      statusOptions,
      isRoot,
      hasChildren: item.children.length > 0,
      isCollapsed: collapsedIds.has(item.id),
      childCount: countDescendants(item),
      hasPortalSupport,
      isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
      isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false),
      isSearchMatch: !!(searchMatchIds && searchMatchIds.has(item.id)),
      isDropTarget: false,
      canEdit: canEdit !== false && (canEditItem ? canEditItem(item) : true),
      isPinned: pinnedIdsSet?.has(item.id) || false,
      onTogglePin: onTogglePin || (() => {}),
      onSavePosition,
      isPortal: !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId),
      portalSpaceName: (currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId) ? portalSpaceNames?.get(item.spaceId) : undefined,
    },
  };
}

/** Arête hiérarchique parent→enfant, style dégressif selon la profondeur du sous-arbre. Utilisée par calculateLayout ET le chemin incrémental. Les positions sont les positions ajustées des nœuds. */
export function buildTreeEdge(
  effectiveParentId: string,
  item: TreeItem,
  parentPos: { x: number; y: number },
  childPos: { x: number; y: number },
): Edge {
  const { sourceHandle, targetHandle } = getBestHandles(parentPos, childPos);
  const depth = maxDepth(item);
  const isRootEdge = effectiveParentId === SPACE_NODE_ID;
  return {
    id: `${effectiveParentId}-${item.id}`,
    source: effectiveParentId,
    target: item.id,
    sourceHandle,
    targetHandle,
    type: 'default',
    style: {
      stroke: isRootEdge ? 'hsl(var(--primary))' : '#94a3b8',
      strokeWidth: isRootEdge ? 4 : Math.max(1.5, Math.min(4, 1.5 + depth * 0.8)),
      opacity: isRootEdge ? 0.9 : Math.max(0.5, Math.min(0.9, 0.5 + depth * 0.15)),
    },
  };
}

/** Arête de relation (pointillé violet). `handles` optionnels — recalculés ensuite par recalculateEdgeHandles. */
export function buildRelationEdge(
  relation: { id: string; type: string; label?: string | null; fromItemId: string; toItemId: string; fromItem?: { title?: string }; toItem?: { title?: string } },
  handles: { sourceHandle: string; targetHandle: string } = { sourceHandle: 'right-source', targetHandle: 'left' },
): Edge {
  return {
    id: `relation-${relation.id}`,
    source: relation.fromItemId,
    target: relation.toItemId,
    ...handles,
    type: 'relation',
    animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
    data: {
      relationId: relation.id,
      type: relation.type,
      label: relation.label || '',
      fromItemId: relation.fromItemId,
      fromTitle: relation.fromItem?.title || relation.fromItemId,
      toTitle: relation.toItem?.title || relation.toItemId,
    },
    label: relation.label ? undefined : relationEdgeLabel(relation.type, relation.label),
    labelStyle: { fontSize: 10, fill: '#8b5cf6' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  };
}

// Calculate node positions using radial tree layout
export function calculateLayout(
  tree: TreeItem[],
  items: ItemWithRelations[],
  statuses: StatusConfig[],
  collapsedIds: Set<string>,
  spaceName: string,
  totalItemCount: number,
  callbacks: MindMapCallbacks,
  options: MindMapLayoutOptions,
): { nodes: Node[]; edges: Edge[]; relationEdges: Edge[]; rootArcEnd: number; arcStart: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Build d3 hierarchy data
  function buildDatum(item: TreeItem): LayoutDatum {
    const isCollapsed = collapsedIds.has(item.id);
    return {
      id: item.id,
      item,
      children: isCollapsed || item.children.length === 0
        ? undefined
        : item.children.map(buildDatum),
    };
  }

  const rootDatum: LayoutDatum = {
    id: SPACE_NODE_ID,
    children: tree.length > 0 ? tree.map(buildDatum) : undefined,
  };

  const nodePositionMap = new Map<string, { x: number; y: number }>();
  const centerPos = { x: 0, y: 0 };
  nodePositionMap.set(SPACE_NODE_ID, centerPos);

  const rootChildren = rootDatum.children || [];
  const rootCount = rootChildren.length;
  // Shift arc start by half a slot to avoid placing items exactly at ±90° (straight up/down),
  // which causes vertical chains when children inherit the same downward direction.
  const arcStart = -Math.PI / 2 + (rootCount > 0 ? Math.PI / rootCount : 0);
  let rootArcEnd = arcStart; // default: no branches
  if (rootCount > 0) {
    // Cercle complet autour du nœud espace, à partir de arcStart
    radialLayout(rootChildren, d => d.children ?? [], centerPos, arcStart + Math.PI, 2 * Math.PI)
      .forEach((pos, id) => nodePositionMap.set(id, pos));
    rootArcEnd = arcStart + 2 * Math.PI;
  }

  // Space node at center
  nodes.push({
    id: SPACE_NODE_ID,
    type: 'space',
    position: { x: -70, y: -25 },
    data: { label: spaceName, spaceName, itemCount: totalItemCount },
  });

  // Convert positions to ReactFlow nodes
  function getAllItems(datum: LayoutDatum): LayoutDatum[] {
    const result: LayoutDatum[] = [];
    if (datum.item) result.push(datum);
    if (datum.children) datum.children.forEach(c => result.push(...getAllItems(c)));
    return result;
  }

  getAllItems(rootDatum).forEach(datum => {
    const item = datum.item!;
    const pos = nodePositionMap.get(datum.id);
    if (!pos) return;

    const isRoot = !item.parentId || !nodePositionMap.has(item.parentId);
    const adjustedPos = { x: pos.x - 75, y: pos.y - 20 };
    nodes.push(buildMindmapNode(item, adjustedPos, statuses, collapsedIds, callbacks, options, isRoot));

    // Edge from parent — fall back to __space__ if parentId not in layout (orphaned item)
    const effectiveParentId = (item.parentId && nodePositionMap.has(item.parentId))
      ? item.parentId
      : SPACE_NODE_ID;
    const parentPos = nodePositionMap.get(effectiveParentId);
    if (parentPos) {
      edges.push(buildTreeEdge(
        effectiveParentId, item,
        { x: parentPos.x - 75, y: parentPos.y - 20 },
        adjustedPos,
      ));
    }
  });

  // Create relation edges
  const relationEdges: Edge[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  items.forEach(item => {
    item.relationsFrom?.forEach(relation => {
      if (nodeIds.has(relation.fromItemId) && nodeIds.has(relation.toItemId)) {
        const sourcePos = nodePositionMap.get(relation.fromItemId);
        const targetPos = nodePositionMap.get(relation.toItemId);
        const handles = sourcePos && targetPos
          ? getBestHandles(sourcePos, targetPos)
          : undefined;
        relationEdges.push(buildRelationEdge(relation as any, handles));
      }
    });
  });

  return { nodes, edges, relationEdges, rootArcEnd, arcStart };
}

// ===================================================================
// Build portal nodes and edges (shared between useEffect + resetLayout)
// ===================================================================

export interface PortalBuildContext {
  positionedNodes: Node[];
  portals: PortalState[];
  portalItemsBySpace: Map<string, ItemWithRelations[]>;
  childSpaces: SpaceWithRole[];
  communitySpaces: SpaceWithRole[];
  portalSpaceNames: Map<string, string>;
  statuses: StatusConfig[];
  collapsedIds: Set<string>;
  items: ItemWithRelations[];
  callbacks: MindMapCallbacks;
  options: MindMapLayoutOptions;
  removePortal: (id: string) => void;
  savedPositions: Record<string, { x: number; y: number }>;
  rootArcEnd?: number;
  arcStart?: number;
}

export function buildPortalNodesAndEdges(
  ctx: PortalBuildContext,
  relationEdges: Edge[],
): { portalNodes: Node[]; portalEdges: Edge[]; portalRelationEdges: Edge[] } {
  const { positionedNodes, portals, portalItemsBySpace, childSpaces, communitySpaces, portalSpaceNames, statuses, collapsedIds, items, callbacks, options, removePortal, savedPositions } = ctx;
  const { onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab: _onOpenInNewTab, onTogglePin, onSavePosition } = callbacks;
  const { statusOptions, highlightType, highlightStatus, searchMatchIds, canEdit, canEditItem, pinnedIdsSet } = options;

  const portalPosMap = new Map(positionedNodes.map(n => [n.id, n.position]));
  const portalNodes: Node[] = [];
  const portalEdges: Edge[] = [];

  // 1. User-created portals
  portals.forEach((portal, index) => {
    const targetSpace = communitySpaces.find(s => s.id === portal.spaceId);
    const parentPos = portalPosMap.get(portal.parentItemId);
    if (!targetSpace || !parentPos) return;

    const offsetX = 200;
    const offsetY = 50 + index * 80;

    portalNodes.push({
      id: portal.id,
      type: 'portal',
      position: { x: parentPos.x + offsetX, y: parentPos.y + offsetY },
      data: { space: targetSpace, onRemove: removePortal, portalId: portal.id },
    });

    portalEdges.push({
      id: `edge-${portal.parentItemId}-${portal.id}`,
      source: portal.parentItemId,
      target: portal.id,
      sourceHandle: 'right-source',
      targetHandle: 'left',
      type: 'default',
      style: { stroke: '#818cf8', strokeWidth: 1.5 },
    });
  });

  // 2. Build list of all spaces needing portal nodes
  const spacePos = portalPosMap.get(SPACE_NODE_ID) || { x: -70, y: -25 };
  const BASE_PORTAL_DIST = 300;

  const portalSpacesList: { id: string; space: SpaceWithRole | undefined }[] = [];
  const addedSpaceIds = new Set<string>();
  childSpaces.forEach(cs => {
    portalSpacesList.push({ id: cs.id, space: cs });
    addedSpaceIds.add(cs.id);
  });
  portalItemsBySpace.forEach((_items, psId) => {
    if (!addedSpaceIds.has(psId)) {
      const foundSpace = communitySpaces.find(s => s.id === psId);
      portalSpacesList.push({ id: psId, space: foundSpace });
      addedSpaceIds.add(psId);
    }
  });

  // Hiérarchie des sous-espaces (2026-10-14) : un espace dont le parent est aussi affiché est rattaché au
  // nœud de ce parent, pas à la racine. Parent affiché le plus proche (pas de boucle : profondeur bornée).
  const displayedParentOf = (id: string): string | null => {
    const parentId = portalSpacesList.find(e => e.id === id)?.space?.parentId ?? null;
    return parentId && addedSpaceIds.has(parentId) ? parentId : null;
  };
  const depthOf = (id: string): number => {
    let depth = 0;
    for (let p = displayedParentOf(id); p && depth < 20; p = displayedParentOf(p)) depth++;
    return depth;
  };
  // Parents avant enfants (tri stable : l'ordre d'origine est conservé à profondeur égale)
  portalSpacesList.sort((a, b) => depthOf(a.id) - depthOf(b.id));
  const topLevelSpaces = portalSpacesList.filter(e => !displayedParentOf(e.id));

  // 3. Position child-space portal nodes — fixed arc centered above the space node.
  // Items always fill the full circle so gap-based placement is unreliable.
  // Instead, portals are placed at a large fixed radius (no collision with items)
  // centered on angle -π/2 (top), spreading symmetrically at 40° per portal.
  // Au-delà de 9 portails, 40° × N dépasserait 360° (le 10e retombait sur le 1er) : le pas
  // devient 360°/N (cercle complet) et le rayon grandit pour garder MIN_PORTAL_SPACING
  // entre deux portails voisins. ≤ 9 portails : placement inchangé.
  // L'arc autour de la racine ne porte que les sous-espaces de premier niveau affichés
  const totalPortalSpaces = topLevelSpaces.length;
  const MAX_PORTAL_ANGLE_STEP = Math.PI / 4.5; // 40° between portals
  const PORTAL_ANGLE_STEP = Math.min(MAX_PORTAL_ANGLE_STEP, (2 * Math.PI) / Math.max(1, totalPortalSpaces));
  const PORTAL_CENTER_ANGLE = -Math.PI / 2; // top of space node
  const portalTotalSpread = (totalPortalSpaces - 1) * PORTAL_ANGLE_STEP;
  const portalArcStart = PORTAL_CENTER_ANGLE - portalTotalSpread / 2;
  const MIN_PORTAL_SPACING = 240; // px d'arc entre deux portails voisins (nœud portail ≥ 120px de large)
  const PORTAL_BASE_RADIUS = Math.max(
    BASE_PORTAL_DIST + 250, // larger than item radius to avoid overlap
    MIN_PORTAL_SPACING / PORTAL_ANGLE_STEP,
  );

  // Sous-sous-espaces : dans le prolongement de leur parent (direction racine → parent), en éventail
  const NESTED_PORTAL_DIST = 320;
  const NESTED_SIBLING_STEP = Math.PI / 6; // 30° entre frères
  const portalPosById = new Map<string, { x: number; y: number }>();

  portalSpacesList.forEach((portalSpaceEntry) => {
    const childPortalId = `child-space-${portalSpaceEntry.id}`;
    const portalItemCount = portalItemsBySpace.get(portalSpaceEntry.id)?.length || 0;
    const parentSpaceId = displayedParentOf(portalSpaceEntry.id);

    let cx: number;
    let cy: number;
    const parentPos = parentSpaceId ? portalPosById.get(parentSpaceId) : undefined;
    if (parentSpaceId && parentPos) {
      const siblings = portalSpacesList.filter(e => displayedParentOf(e.id) === parentSpaceId);
      const sibIndex = siblings.findIndex(e => e.id === portalSpaceEntry.id);
      const dirAngle = Math.atan2(parentPos.y - spacePos.y, parentPos.x - spacePos.x)
        + (sibIndex - (siblings.length - 1) / 2) * NESTED_SIBLING_STEP;
      const dist = NESTED_PORTAL_DIST + Math.sqrt(portalItemCount) * 80;
      cx = parentPos.x + dist * Math.cos(dirAngle);
      cy = parentPos.y + dist * Math.sin(dirAngle);
    } else {
      const index = topLevelSpaces.findIndex(e => e.id === portalSpaceEntry.id);
      const childSpaceRadius = PORTAL_BASE_RADIUS + Math.sqrt(portalItemCount) * 80;
      const angle = totalPortalSpaces === 1
        ? PORTAL_CENTER_ANGLE
        : portalArcStart + index * PORTAL_ANGLE_STEP;
      cx = spacePos.x + childSpaceRadius * Math.cos(angle);
      cy = spacePos.y + childSpaceRadius * Math.sin(angle);
    }

    const savedPos = savedPositions[childPortalId];
    const pos = savedPos || { x: cx, y: cy };
    portalPosById.set(portalSpaceEntry.id, pos);

    const spaceData = portalSpaceEntry.space || { id: portalSpaceEntry.id, name: portalSpaceNames.get(portalSpaceEntry.id) || portalSpaceEntry.id, type: 'FOLDER' as any, createdAt: '', updatedAt: '', role: 'MEMBER' as any };

    portalNodes.push({
      id: childPortalId,
      type: 'portal',
      position: pos,
      data: {
        space: spaceData,
        onRemove: () => {},
        portalId: childPortalId,
        isChildSpace: true,
        onReorganizeChildren: onReorganizeChildren,
        hasItems: portalItemCount > 0,
      },
    });

    portalEdges.push({
      id: `edge-space-${childPortalId}`,
      // Rattaché au nœud de son espace parent s'il est affiché, sinon à la racine
      source: parentSpaceId ? `child-space-${parentSpaceId}` : SPACE_NODE_ID,
      target: childPortalId,
      sourceHandle: 'bottom-source',
      targetHandle: 'top',
      type: 'default',
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
    });
  });

  // 4. Add mindmap nodes for portal items using radial fan layout
  portalItemsBySpace.forEach((portalItems, portalSpaceId) => {
    const childPortalId = `child-space-${portalSpaceId}`;
    const portalNode = portalNodes.find(n => n.id === childPortalId);
    if (!portalNode) return;
    const portalPos = portalNode.position;

    const subTree = buildTree(portalItems);
    if (subTree.length === 0) return;

    const spaceNodePos = portalPosMap.get(SPACE_NODE_ID) || { x: 0, y: 0 };
    const baseAngle = Math.atan2(portalPos.y - spaceNodePos.y, portalPos.x - spaceNodePos.x);

    const pSpaceName = portalSpaceNames.get(portalSpaceId);

    // Secteur tourné vers l'extérieur de la carte
    const visibleKids = (item: TreeItem) => (collapsedIds.has(item.id) ? [] : item.children);
    const portalItemPositions = radialLayout(subTree, visibleKids, portalPos, baseAngle, branchArc(subTree.length));

    function placePortalItem(
      item: TreeItem,
      parentNodeId: string,
      spaceName: string | undefined,
      depth: number,
    ) {
      const { x: cx, y: cy } = portalItemPositions.get(item.id)!;
      const statusColor = getStatusColor(item.status, statuses);
      const hexColor = tailwindBgToHex(statusColor);

      portalNodes.push({
        id: item.id,
        type: 'mindmap',
        position: { x: cx - 75, y: cy - 20 },
        data: {
          label: item.title,
          item,
          statusColor,
          hexColor,
          textColor: getContrastTextColor(hexColor),
          onEdit,
          onDelete,
          onUpdateStatus,
          onAddChild,
          onAddPortal,
          onToggleCollapse,
          onReorganizeChildren,
          onMoveToSpace,
          onDuplicateToSpace,
          onConvertToSpace,
          onSelfAssign,
          onMerge,
          onAbsorbChildren,
          onSplitDescription,
          statusOptions,
          isRoot: depth === 0,
          hasChildren: item.children.length > 0,
          isCollapsed: collapsedIds.has(item.id),
          childCount: countDescendants(item),
          hasPortalSupport: false,
          isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
          isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false),
          isSearchMatch: !!(searchMatchIds && searchMatchIds.has(item.id)),
          isDropTarget: false,
          canEdit: canEdit !== false && (canEditItem ? canEditItem(item) : true),
          isPinned: pinnedIdsSet?.has(item.id) || false,
          onTogglePin: onTogglePin || (() => {}),
          onSavePosition,
          isPortal: true,
          portalSpaceName: spaceName,
        },
      });

      portalEdges.push({
        id: `portal-edge-${parentNodeId}-${item.id}`,
        source: parentNodeId,
        target: item.id,
        type: 'default',
        style: { stroke: '#818cf8', strokeWidth: 1.5 },
      });

      visibleKids(item).forEach(child => placePortalItem(child, item.id, undefined, depth + 1));
    }

    subTree.forEach(rootItem => placePortalItem(rootItem, childPortalId, pSpaceName, 0));
  });

  // 5. Cross-space relation edges
  const allNodes = [...positionedNodes, ...portalNodes];
  const allNodeIds = new Set(allNodes.map(n => n.id));
  const portalRelationEdges: Edge[] = [];
  const existingRelationIds = new Set(relationEdges.map(e => e.data?.relationId));
  const allPortalItems = Array.from(portalItemsBySpace.values()).flat();
  [...items, ...allPortalItems].forEach(item => {
    item.relationsFrom?.forEach(relation => {
      if (existingRelationIds.has(relation.id)) return;
      if (allNodeIds.has(relation.fromItemId) && allNodeIds.has(relation.toItemId)) {
        portalRelationEdges.push({
          id: `relation-${relation.id}`,
          source: relation.fromItemId,
          target: relation.toItemId,
          type: 'default',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
          data: { relationId: relation.id, type: relation.type, label: relation.label || '', fromItemId: relation.fromItemId },
          label: relationEdgeLabel(relation.type, relation.label),
          labelStyle: { fontSize: 10, fill: '#8b5cf6' },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
        existingRelationIds.add(relation.id);
      }
    });
  });

  return { portalNodes, portalEdges, portalRelationEdges };
}
