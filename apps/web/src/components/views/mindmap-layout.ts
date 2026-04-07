import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ItemWithRelations, StatusConfig, SpaceWithRole } from '@spok/shared';
const RELATION_LABELS: Record<string, string> = {
  relates: '🔗 Lié',
  blocks: '🚫 Bloque',
  depends: '← Dépend',
  duplicates: '📋 Duplique',
  implements: '⚙ Implémente',
  tests: '🧪 Teste',
};

function relationEdgeLabel(type: string, label?: string | null): string {
  const base = RELATION_LABELS[type] || type;
  if (!label) return base;
  const short = label.length > 30 ? label.slice(0, 27) + '…' : label;
  return `${base} · ${short}`;
}
import {
  type TreeItem,
  type LayoutDatum,
  type PortalState,
  RADIAL_STEP,
  getStatusColor,
  tailwindBgToHex,
  getContrastTextColor,
  buildTree,
  countDescendants,
  maxDepth,
  countVisible as countVisibleUtil,
} from './mindmap-utils';

const SPACE_NODE_ID = '__space__';

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
  onTogglePin?: (id: string) => void;
}

export interface MindMapLayoutOptions {
  hasPortalSupport: boolean;
  doneStatusId: string;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
  pinnedIdsSet?: Set<string>;
  currentSpaceId?: string;
  portalSpaceNames?: Map<string, string>;
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
  const { onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onTogglePin } = callbacks;
  const { hasPortalSupport, doneStatusId, highlightType, highlightStatus, searchMatchIds, canEdit, pinnedIdsSet, currentSpaceId, portalSpaceNames } = options;

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

  // Recursive fan layout
  const nodePositionMap = new Map<string, { x: number; y: number }>();
  const centerPos = { x: 0, y: 0 };
  nodePositionMap.set(SPACE_NODE_ID, centerPos);

  function countVisible(datum: LayoutDatum): number {
    if (!datum.children) return 1;
    return datum.children.reduce((sum, c) => sum + countVisible(c), 0);
  }

  function layoutFan(
    datum: LayoutDatum,
    parentPos: { x: number; y: number },
    dirAngle: number,
    arcSpan: number,
  ) {
    const children = datum.children;
    if (!children || children.length === 0) return;

    const count = children.length;
    const childVisibleCounts = children.map(c => countVisible(c));
    const totalVisible = childVisibleCounts.reduce((s, v) => s + v, 0);

    const MIN_SIBLING_SPACING = 190;
    const spacingRadius = count > 1
      ? (MIN_SIBLING_SPACING * (count - 1)) / Math.max(arcSpan, 0.2)
      : 0;

    for (let i = 0; i < count; i++) {
      const child = children[i];
      const descendants = childVisibleCounts[i];

      const radius = Math.max(
        RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8),
        spacingRadius
      );

      const angle = count === 1
        ? dirAngle
        : dirAngle - arcSpan / 2 + (i * arcSpan) / (count - 1);

      const cx = parentPos.x + radius * Math.cos(angle);
      const cy = parentPos.y + radius * Math.sin(angle);
      nodePositionMap.set(child.id, { x: cx, y: cy });

      const directChildren = child.children?.length || 0;
      const allocatedArc = arcSpan * (childVisibleCounts[i] / Math.max(1, totalVisible));
      const childArc = descendants > 1
        ? Math.max(allocatedArc, Math.PI / 3, Math.min(directChildren * 0.5, Math.PI * 1.3))
        : 0;
      layoutFan(child, { x: cx, y: cy }, angle, childArc);
    }
  }

  // Layout root children with proportional angular allocation
  const rootChildren = rootDatum.children || [];
  const rootCount = rootChildren.length;
  // Shift arc start by half a slot to avoid placing items exactly at ±90° (straight up/down),
  // which causes vertical chains when children inherit the same downward direction.
  const arcStart = -Math.PI / 2 + (rootCount > 0 ? Math.PI / rootCount : 0);
  let rootArcEnd = arcStart; // default: no branches
  if (rootCount > 0) {
    const rootVisibleCounts = rootChildren.map(c => countVisible(c));
    const totalRootVisible = rootVisibleCounts.reduce((s, v) => s + v, 0);

    const MIN_NODE_SPACING = 200;
    const minRadiusForSpacing = (rootCount * MIN_NODE_SPACING) / (2 * Math.PI);

    const equalArc = (2 * Math.PI) / rootCount;
    const rootArcs = rootChildren.map((_, i) => {
      const proportionalArc = (2 * Math.PI * rootVisibleCounts[i]) / Math.max(1, totalRootVisible);
      return equalArc * 0.5 + proportionalArc * 0.5;
    });

    let cumulativeAngle = arcStart;
    for (let i = 0; i < rootCount; i++) {
      const child = rootChildren[i];
      const childArc = rootArcs[i];
      const angle = cumulativeAngle + childArc / 2;

      const descendants = rootVisibleCounts[i];
      const rootRadius = Math.max(
        minRadiusForSpacing,
        RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8)
      );

      const cx = centerPos.x + rootRadius * Math.cos(angle);
      const cy = centerPos.y + rootRadius * Math.sin(angle);
      nodePositionMap.set(child.id, { x: cx, y: cy });

      const directChildren = child.children?.length || 0;
      const fanArc = descendants > 1
        ? Math.max(childArc, Math.PI / 3, Math.min(directChildren * 0.5, Math.PI * 1.3))
        : 0;
      layoutFan(child, { x: cx, y: cy }, angle, fanArc);
      cumulativeAngle += childArc;
    }
    rootArcEnd = cumulativeAngle;
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

    const statusColor = getStatusColor(item.status, statuses);
    const hexColor = tailwindBgToHex(statusColor);
    const hasChildren = item.children.length > 0;
    const isCollapsed = collapsedIds.has(item.id);
    const childCount = countDescendants(item);
    const isRoot = !item.parentId || !nodePositionMap.has(item.parentId);
    const adjustedPos = { x: pos.x - 75, y: pos.y - 20 };

    nodes.push({
      id: item.id,
      type: 'mindmap',
      position: adjustedPos,
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
        doneStatusId,
        isRoot,
        hasChildren,
        isCollapsed,
        childCount,
        hasPortalSupport,
        isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
        isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false),
        isSearchMatch: !!(searchMatchIds && searchMatchIds.has(item.id)),
        isDropTarget: false,
        canEdit: canEdit !== false,
        isPinned: pinnedIdsSet?.has(item.id) || false,
        onTogglePin: onTogglePin || (() => {}),
        isPortal: !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId),
        portalSpaceName: (currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId) ? portalSpaceNames?.get(item.spaceId) : undefined,
      },
    });

    // Edge from parent — fall back to __space__ if parentId not in layout (orphaned item)
    const effectiveParentId = (item.parentId && nodePositionMap.has(item.parentId))
      ? item.parentId
      : SPACE_NODE_ID;
    const parentPos = nodePositionMap.get(effectiveParentId);
    if (parentPos) {
      const parentAdjusted = { x: parentPos.x - 75, y: parentPos.y - 20 };
      const { sourceHandle, targetHandle } = getBestHandles(parentAdjusted, adjustedPos);
      const depth = maxDepth(item);
      const edgeWidth = effectiveParentId === SPACE_NODE_ID
        ? 4
        : Math.max(1.5, Math.min(4, 1.5 + depth * 0.8));
      const edgeOpacity = effectiveParentId === SPACE_NODE_ID
        ? 0.9
        : Math.max(0.5, Math.min(0.9, 0.5 + depth * 0.15));

      edges.push({
        id: `${effectiveParentId}-${item.id}`,
        source: effectiveParentId,
        target: item.id,
        sourceHandle,
        targetHandle,
        type: 'default',
        style: {
          stroke: effectiveParentId === SPACE_NODE_ID ? 'hsl(var(--primary))' : '#94a3b8',
          strokeWidth: edgeWidth,
          opacity: edgeOpacity,
        },
      });
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
          : { sourceHandle: 'right-source', targetHandle: 'left' };

        relationEdges.push({
          id: `relation-${relation.id}`,
          source: relation.fromItemId,
          target: relation.toItemId,
          ...handles,
          type: 'default',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
          data: { relationId: relation.id, type: relation.type, label: relation.label || '', fromItemId: relation.fromItemId },
          label: relationEdgeLabel(relation.type, relation.label),
          labelStyle: { fontSize: 10, fill: '#8b5cf6' },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
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
  const { onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onTogglePin } = callbacks;
  const { doneStatusId, highlightType, highlightStatus, searchMatchIds, canEdit, pinnedIdsSet } = options;

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

  // 3. Position child-space portal nodes — fixed arc centered above the space node.
  // Items always fill the full circle so gap-based placement is unreliable.
  // Instead, portals are placed at a large fixed radius (no collision with items)
  // centered on angle -π/2 (top), spreading symmetrically at 40° per portal.
  const totalPortalSpaces = portalSpacesList.length;
  const PORTAL_ANGLE_STEP = Math.PI / 4.5; // 40° between portals
  const PORTAL_CENTER_ANGLE = -Math.PI / 2; // top of space node
  const portalTotalSpread = (totalPortalSpaces - 1) * PORTAL_ANGLE_STEP;
  const portalArcStart = PORTAL_CENTER_ANGLE - portalTotalSpread / 2;
  const PORTAL_BASE_RADIUS = BASE_PORTAL_DIST + 250; // larger than item radius to avoid overlap

  portalSpacesList.forEach((portalSpaceEntry, index) => {
    const childPortalId = `child-space-${portalSpaceEntry.id}`;
    const portalItemCount = portalItemsBySpace.get(portalSpaceEntry.id)?.length || 0;
    const childSpaceRadius = PORTAL_BASE_RADIUS + Math.sqrt(portalItemCount) * 80;
    const angle = totalPortalSpaces === 1
      ? PORTAL_CENTER_ANGLE
      : portalArcStart + index * PORTAL_ANGLE_STEP;

    const cx = spacePos.x + childSpaceRadius * Math.cos(angle);
    const cy = spacePos.y + childSpaceRadius * Math.sin(angle);

    const savedPos = savedPositions[childPortalId];
    const pos = savedPos || { x: cx, y: cy };

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
      source: SPACE_NODE_ID,
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

    function placePortalItem(
      item: TreeItem,
      cx: number, cy: number,
      parentNodeId: string,
      spaceName: string | undefined,
      depth: number,
      dirAngle: number,
      arcSpan: number,
    ) {
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
          doneStatusId,
          isRoot: depth === 0,
          hasChildren: item.children.length > 0,
          isCollapsed: collapsedIds.has(item.id),
          childCount: countDescendants(item),
          hasPortalSupport: false,
          isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
          isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false),
          isSearchMatch: !!(searchMatchIds && searchMatchIds.has(item.id)),
          isDropTarget: false,
          canEdit: canEdit !== false,
          isPinned: pinnedIdsSet?.has(item.id) || false,
          onTogglePin: onTogglePin || (() => {}),
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

      // Place children in radial fan if not collapsed
      if (!collapsedIds.has(item.id) && item.children.length > 0) {
        const children = item.children;
        const childVisibleCounts = children.map(c => countVisibleUtil(c, collapsedIds));
        const totalVisible = childVisibleCounts.reduce((s, v) => s + v, 0);
        const count = children.length;

        const MIN_SIBLING_SPACING = 190;
        const spacingRadius = count > 1
          ? (MIN_SIBLING_SPACING * (count - 1)) / Math.max(arcSpan, 0.2)
          : 0;

        for (let i = 0; i < count; i++) {
          const child = children[i];
          const descendants = childVisibleCounts[i];
          const radius = Math.max(
            RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8),
            spacingRadius
          );
          const angle = count === 1
            ? dirAngle
            : dirAngle - arcSpan / 2 + (i * arcSpan) / (count - 1);

          const childCx = cx + radius * Math.cos(angle);
          const childCy = cy + radius * Math.sin(angle);

          const allocatedArc = arcSpan * (childVisibleCounts[i] / Math.max(1, totalVisible));
          const directChildren = child.children?.length || 0;
          const childArc = descendants > 1
            ? Math.max(allocatedArc, Math.PI / 3, Math.min(directChildren * 0.5, Math.PI * 1.3))
            : 0;

          placePortalItem(child, childCx, childCy, item.id, undefined, depth + 1, angle, childArc);
        }
      }
    }

    // Place root portal items in radial fan around the portal node
    const rootCount = subTree.length;
    const rootVisibleCounts = subTree.map(r => countVisibleUtil(r, collapsedIds));
    const totalRootVisible = rootVisibleCounts.reduce((s, v) => s + v, 0);

    const totalArcSpan = Math.min(Math.PI * 1.5, rootCount * (Math.PI / 4));
    const equalArc = totalArcSpan / Math.max(1, rootCount);
    const rootArcs = subTree.map((_, i) => {
      const proportionalArc = totalArcSpan * (rootVisibleCounts[i] / Math.max(1, totalRootVisible));
      return equalArc * 0.5 + proportionalArc * 0.5;
    });

    const MIN_NODE_SPACING = 200;
    const minRadiusForSpacing = (rootCount * MIN_NODE_SPACING) / (2 * Math.PI);

    let cumulativeAngle = baseAngle - totalArcSpan / 2;
    subTree.forEach((rootItem, i) => {
      const childArc = rootArcs[i];
      const angle = cumulativeAngle + childArc / 2;
      const descendants = rootVisibleCounts[i];
      const rootRadius = Math.max(
        minRadiusForSpacing,
        RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8)
      );

      const cx = portalPos.x + rootRadius * Math.cos(angle);
      const cy = portalPos.y + rootRadius * Math.sin(angle);

      const directChildren = rootItem.children?.length || 0;
      const fanArc = descendants > 1
        ? Math.max(childArc, Math.PI / 3, Math.min(directChildren * 0.5, Math.PI * 1.3))
        : 0;

      placePortalItem(rootItem, cx, cy, childPortalId, pSpaceName, 0, angle, fanArc);
      cumulativeAngle += childArc;
    });
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
