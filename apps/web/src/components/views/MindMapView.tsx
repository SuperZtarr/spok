import { useMemo, useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ItemWithRelations, SpaceReferentiels, SpaceWithRole } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { ChevronRight, FolderOpen, ExternalLink, Link2, Maximize2 } from 'lucide-react';

import {
  type TreeItem,
  type PortalState,
  RELATION_TYPES,
  buildTree,
  collectVisibleDescendantIds,
  getAbsolutePositions,
  recalculateEdgeHandles,
  countVisible,
  findTreeNode,
  RADIAL_STEP,
} from './mindmap-utils';
import { nodeTypes } from './mindmap-nodes';
import { calculateLayout, buildPortalNodesAndEdges, type MindMapCallbacks, type MindMapLayoutOptions } from './mindmap-layout';

export interface MindMapViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
  resetLayout: () => void;
  hasCollapsedNodes: boolean;
  fitAll: () => void;
}

interface MindMapViewProps {
  items: ItemWithRelations[];
  spaceName?: string;
  spaceId?: string;
  communitySpaces?: SpaceWithRole[];
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  onMoveToSpace?: (itemId: string) => void;
  onDuplicateToSpace?: (itemId: string) => void;
  onConvertToSpace?: (itemId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string, label?: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

// Inner component that uses useReactFlow
function MindMapViewInner({
  items,
  spaceName = 'Espace',
  spaceId,
  communitySpaces = [],
  highlightType,
  highlightStatus,
  searchMatchIds,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onCreateRelation,
  onDeleteRelation,
  onUpdateRelation,
  onUpdateStatus,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  referentiels,
  canEdit,
  innerRef,
}: MindMapViewProps & { innerRef?: React.Ref<MindMapViewHandle> }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [editingEdge, setEditingEdge] = useState<{ relationId: string; fromItemId: string; type: string; label: string; sourceName: string; targetName: string } | null>(null);
  const [editEdgeType, setEditEdgeType] = useState('');
  const [editEdgeLabel, setEditEdgeLabel] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [pendingPortalParentId, setPendingPortalParentId] = useState<string | null>(null);
  const { fitView, getIntersectingNodes, getNodes } = useReactFlow();

  // localStorage keys
  const portalsStorageKey = spaceId ? `mindmap-portals-${spaceId}` : null;
  const positionsStorageKey = spaceId ? `mindmap-positions-${spaceId}` : null;
  const pinnedStorageKey = spaceId ? `mindmap-pinned-${spaceId}` : null;

  // Saved node positions
  const savedPositions = useRef<Record<string, { x: number; y: number }>>({});

  // Pinned node IDs (protected from reorganization)
  const pinnedIds = useRef<Set<string>>(new Set());

  // Load saved positions from localStorage
  useEffect(() => {
    if (!positionsStorageKey) return;
    try {
      const stored = localStorage.getItem(positionsStorageKey);
      if (stored) {
        savedPositions.current = JSON.parse(stored);
      }
    } catch { /* ignore */ }
  }, [positionsStorageKey]);

  // Load pinned IDs from localStorage
  useEffect(() => {
    if (!pinnedStorageKey) return;
    try {
      const stored = localStorage.getItem(pinnedStorageKey);
      if (stored) {
        pinnedIds.current = new Set(JSON.parse(stored));
      }
    } catch { /* ignore */ }
  }, [pinnedStorageKey]);

  const savePositions = useCallback(() => {
    if (!positionsStorageKey) return;
    localStorage.setItem(positionsStorageKey, JSON.stringify(savedPositions.current));
  }, [positionsStorageKey]);

  const savePinned = useCallback(() => {
    if (!pinnedStorageKey) return;
    localStorage.setItem(pinnedStorageKey, JSON.stringify([...pinnedIds.current]));
  }, [pinnedStorageKey]);

  const togglePin = useCallback((id: string) => {
    if (pinnedIds.current.has(id)) {
      pinnedIds.current.delete(id);
    } else {
      pinnedIds.current.add(id);
    }
    savePinned();
    setNodesRef.current(nds => nds.map(n => {
      if (n.type !== 'mindmap') return n;
      const isPinned = pinnedIds.current.has(n.id);
      if (n.data?.isPinned === isPinned) return n;
      return { ...n, data: { ...n.data, isPinned } };
    }));
  }, [savePinned]);

  // Portals state
  const [portals, setPortals] = useState<PortalState[]>([]);
  const [portalsLoaded, setPortalsLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // Load portals from localStorage when spaceId is available
  useEffect(() => {
    if (!portalsStorageKey) return;
    try {
      const saved = localStorage.getItem(portalsStorageKey);
      if (saved) {
        setPortals(JSON.parse(saved));
      }
    } catch { /* ignore */ }
    setPortalsLoaded(true);
  }, [portalsStorageKey]);

  // Save portals to localStorage when they change
  useEffect(() => {
    if (!portalsStorageKey || !portalsLoaded) return;
    localStorage.setItem(portalsStorageKey, JSON.stringify(portals));
  }, [portals, portalsStorageKey, portalsLoaded]);

  // Filter available spaces (same community, not current space)
  const availableSpaces = useMemo(() => {
    return communitySpaces.filter(s => s.id !== spaceId);
  }, [communitySpaces, spaceId]);

  // Child spaces of the current space
  const childSpaces = useMemo(() => {
    return communitySpaces.filter(s => s.parentId === spaceId);
  }, [communitySpaces, spaceId]);

  const handleAddPortal = useCallback((parentItemId: string) => {
    setPendingPortalParentId(parentItemId);
    setShowPortalDialog(true);
  }, []);

  const addPortal = useCallback((targetSpaceId: string) => {
    if (!pendingPortalParentId) return;
    const newPortal: PortalState = {
      id: `portal-${Date.now()}`,
      spaceId: targetSpaceId,
      parentItemId: pendingPortalParentId,
    };
    setPortals(prev => [...prev, newPortal]);
    setShowPortalDialog(false);
    setPendingPortalParentId(null);
  }, [pendingPortalParentId]);

  const removePortal = useCallback((portalId: string) => {
    setPortals(prev => prev.filter(p => p.id !== portalId));
  }, []);

  const hasPortalSupport = availableSpaces.length > 0;

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const doneStatusId = useMemo(() => {
    const visibleStatuses = statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    return doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';
  }, [statuses]);

  const portalSpaceNames = useMemo(() => {
    if (!communitySpaces?.length || !spaceId) return new Map<string, string>();
    return new Map(communitySpaces.filter(s => s.id !== spaceId).map(s => [s.id, s.name]));
  }, [communitySpaces, spaceId]);

  const currentSpaceItems = useMemo(() => {
    if (!spaceId) return items;
    return items.filter(i => i.spaceId === spaceId);
  }, [items, spaceId]);

  const portalItemsBySpace = useMemo(() => {
    if (!spaceId) return new Map<string, ItemWithRelations[]>();
    const map = new Map<string, ItemWithRelations[]>();
    for (const item of items) {
      if (item.spaceId && item.spaceId !== spaceId) {
        const list = map.get(item.spaceId) || [];
        list.push(item);
        map.set(item.spaceId, list);
      }
    }
    return map;
  }, [items, spaceId]);

  const fullTree = useMemo(() => buildTree(currentSpaceItems), [currentSpaceItems]);

  const tree = useMemo(() => {
    if (!focusedProjectId) return fullTree;
    const focusedNode = findTreeNode(fullTree, focusedProjectId);
    if (!focusedNode) return fullTree;
    return focusedNode.children.length > 0 ? focusedNode.children : [focusedNode];
  }, [fullTree, focusedProjectId]);

  const displayName = useMemo(() => {
    if (!focusedProjectId) return spaceName;
    const item = items.find(i => i.id === focusedProjectId);
    return item?.title || spaceName;
  }, [focusedProjectId, items, spaceName]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const setNodesRef = useRef<React.Dispatch<React.SetStateAction<Node[]>>>(() => {});
  const reorganizeRef = useRef<(id: string) => void>(() => {});
  const dragDescendants = useRef<{ ids: string[]; offsets: Map<string, { dx: number; dy: number }>; startPos: { x: number; y: number } } | null>(null);
  const handleReorganizeChildren = useCallback((id: string) => reorganizeRef.current(id), []);

  const applyPositions = useCallback((nodes: Node[]): Node[] => {
    const sp = savedPositions.current;
    if (!sp || Object.keys(sp).length === 0) return nodes;
    return nodes.map(n => {
      const saved = sp[n.id];
      return saved ? { ...n, position: saved } : n;
    });
  }, []);

  // Build callbacks and options objects for layout functions
  const layoutCallbacks: MindMapCallbacks = useMemo(() => ({
    onEdit, onDelete, onUpdateStatus, onAddChild,
    onAddPortal: handleAddPortal,
    onToggleCollapse: toggleCollapse,
    onReorganizeChildren: handleReorganizeChildren,
    onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren,
    onTogglePin: togglePin,
  }), [onEdit, onDelete, onUpdateStatus, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, togglePin]);

  const layoutOptions: MindMapLayoutOptions = useMemo(() => ({
    hasPortalSupport, doneStatusId, highlightType, highlightStatus, searchMatchIds, canEdit,
    pinnedIdsSet: pinnedIds.current,
    currentSpaceId: spaceId,
    portalSpaceNames,
  }), [hasPortalSupport, doneStatusId, highlightType, highlightStatus, searchMatchIds, canEdit, spaceId, portalSpaceNames]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);
    const positionedNodes = applyPositions(nodes);
    const posMap = new Map(positionedNodes.map(n => [n.id, n.position]));
    const allEdges = recalculateEdgeHandles([...edges, ...relationEdges], posMap);
    return { initialNodes: positionedNodes, initialEdges: allEdges };
  }, [tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions, applyPositions]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  setNodesRef.current = setNodes;

  // Reorganize children implementation
  reorganizeRef.current = (parentId: string) => {
    const currentNodes = getNodes();
    const absPositions = getAbsolutePositions(currentNodes);

    let visibleChildren: TreeItem[] = [];
    let parentPos: { x: number; y: number };
    let baseAngle: number;

    // Case 1: Portal node
    if (parentId.startsWith('child-space-')) {
      const portalSpaceId = parentId.replace('child-space-', '');
      const portalItems = portalItemsBySpace.get(portalSpaceId);
      if (!portalItems || portalItems.length === 0) return;
      const portalTree = buildTree(portalItems);
      if (portalTree.length === 0) return;
      visibleChildren = portalTree;
      const parentPosRaw = absPositions.get(parentId);
      if (!parentPosRaw) return;
      parentPos = { x: parentPosRaw.x, y: parentPosRaw.y };
      const spacePos = absPositions.get('__space__') || { x: 0, y: 0 };
      baseAngle = Math.atan2(parentPos.y - spacePos.y, parentPos.x - spacePos.x);
    } else {
      // Case 2/3: Tree node (current space or portal)
      let treeNode = findTreeNode(fullTree, parentId);
      if (!treeNode) {
        for (const [, pItems] of portalItemsBySpace.entries()) {
          const portalTree = buildTree(pItems);
          treeNode = findTreeNode(portalTree, parentId);
          if (treeNode) break;
        }
      }
      if (!treeNode || treeNode.children.length === 0) return;
      visibleChildren = collapsedIds.has(parentId) ? [] : treeNode.children;
      if (visibleChildren.length === 0) return;
      const parentPosRaw = absPositions.get(parentId);
      if (!parentPosRaw) return;
      parentPos = { x: parentPosRaw.x, y: parentPosRaw.y };
      const parentItem = items.find(i => i.id === parentId);
      const grandParentId = parentItem?.parentId || '__space__';
      const portalNodeId = parentItem?.spaceId && parentItem.spaceId !== spaceId
        ? `child-space-${parentItem.spaceId}` : null;
      const anchorId = grandParentId !== '__space__' ? grandParentId
        : portalNodeId && absPositions.has(portalNodeId) ? portalNodeId : '__space__';
      const grandParentPos = absPositions.get(anchorId) || { x: 0, y: 0 };
      baseAngle = Math.atan2(parentPos.y - grandParentPos.y, parentPos.x - grandParentPos.x);
    }

    const unpinnedChildren = visibleChildren.filter(c => !pinnedIds.current.has(c.id));
    const unpinnedCount = unpinnedChildren.length;
    const angleSpread = Math.min(Math.PI * 1.5, unpinnedCount * (Math.PI / 4));
    const startAngle = -angleSpread / 2;
    const modifiedIds = new Set<string>();

    function repositionSubtree(item: TreeItem, cx: number, cy: number, anchorPos: { x: number; y: number }) {
      savedPositions.current[item.id] = { x: cx, y: cy };
      modifiedIds.add(item.id);
      if (!collapsedIds.has(item.id) && item.children.length > 0) {
        const kids = item.children;
        const unpinnedKids = kids.filter(k => !pinnedIds.current.has(k.id));
        const subSpread = Math.min(Math.PI, unpinnedKids.length * (Math.PI / 5));
        const subStart = -subSpread / 2;
        const dirAngle = Math.atan2(cy - anchorPos.y, cx - anchorPos.x);
        let unpinnedIdx = 0;
        for (let i = 0; i < kids.length; i++) {
          if (pinnedIds.current.has(kids[i].id)) {
            const pinnedPos = absPositions.get(kids[i].id);
            if (pinnedPos) repositionSubtree(kids[i], pinnedPos.x, pinnedPos.y, { x: cx, y: cy });
          } else {
            const descendants = countVisible(kids[i], collapsedIds);
            const MIN_SIBLING_SPACING = 130;
            const spacingRadius = unpinnedKids.length > 1
              ? (MIN_SIBLING_SPACING * (unpinnedKids.length - 1)) / Math.max(subSpread, 0.2) : 0;
            const subRadius = Math.max(
              RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8), spacingRadius);
            const a = unpinnedKids.length === 1 ? dirAngle : dirAngle + subStart + (unpinnedIdx * subSpread) / Math.max(1, unpinnedKids.length - 1);
            const nx = cx + subRadius * Math.cos(a);
            const ny = cy + subRadius * Math.sin(a);
            repositionSubtree(kids[i], nx, ny, { x: cx, y: cy });
            unpinnedIdx++;
          }
        }
      }
    }

    let unpinnedIdx = 0;
    for (let i = 0; i < visibleChildren.length; i++) {
      if (pinnedIds.current.has(visibleChildren[i].id)) {
        const pinnedPos = absPositions.get(visibleChildren[i].id);
        if (pinnedPos) repositionSubtree(visibleChildren[i], pinnedPos.x, pinnedPos.y, parentPos);
      } else {
        const descendants = countVisible(visibleChildren[i], collapsedIds);
        const MIN_SIBLING_SPACING = 130;
        const spacingRadius = unpinnedCount > 1
          ? (MIN_SIBLING_SPACING * (unpinnedCount - 1)) / Math.max(angleSpread, 0.2) : 0;
        const radius = Math.max(
          RADIAL_STEP * (0.8 + Math.sqrt(Math.max(descendants - 1, 0)) * 0.8), spacingRadius);
        const angle = unpinnedCount === 1
          ? baseAngle
          : baseAngle + startAngle + (unpinnedIdx * angleSpread) / Math.max(1, unpinnedCount - 1);
        const cx = parentPos.x + radius * Math.cos(angle);
        const cy = parentPos.y + radius * Math.sin(angle);
        repositionSubtree(visibleChildren[i], cx, cy, parentPos);
        unpinnedIdx++;
      }
    }
    savePositions();

    setNodes(currentNodes => {
      const updated = currentNodes.map(n => {
        if (!modifiedIds.has(n.id)) return n;
        const saved = savedPositions.current[n.id];
        if (!saved) return n;
        if (n.parentId) {
          const parentNode = currentNodes.find(p => p.id === n.parentId);
          if (parentNode) {
            const parentAbs = absPositions.get(n.parentId) || parentNode.position;
            return { ...n, position: { x: saved.x - parentAbs.x, y: saved.y - parentAbs.y } };
          }
        }
        return { ...n, position: saved };
      });
      const newAbsPositions = getAbsolutePositions(updated);
      setEdges(currentEdges => recalculateEdgeHandles(currentEdges, newAbsPositions));
      return updated;
    });
  };

  // Wrap onNodesChange to recalculate edge handles when nodes are dragged
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeBase(changes);
    const hasPositionChange = changes.some((c: any) => c.type === 'position' && c.position);
    if (hasPositionChange) {
      setNodes(currentNodes => {
        const absPositions = getAbsolutePositions(currentNodes);
        setEdges(currentEdges => recalculateEdgeHandles(currentEdges, absPositions));
        return currentNodes;
      });
    }
  }, [onNodesChangeBase, setNodes, setEdges]);

  // Update nodes when items, collapsed state, or portals change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges, relationEdges, rootArcEnd } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);
    const positionedNodes = applyPositions(newNodes);

    const { portalNodes, portalEdges, portalRelationEdges } = buildPortalNodesAndEdges({
      positionedNodes, portals, portalItemsBySpace, childSpaces, communitySpaces,
      portalSpaceNames, statuses, collapsedIds, items, callbacks: layoutCallbacks,
      options: layoutOptions, removePortal, savedPositions: savedPositions.current, rootArcEnd,
    }, relationEdges);

    const allNodes = [...positionedNodes, ...portalNodes];
    const edgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
    const allEdges = recalculateEdgeHandles([...newEdges, ...relationEdges, ...portalRelationEdges, ...portalEdges], edgePosMap);
    setNodes(allNodes);
    setEdges(allEdges);
  }, [tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions, setNodes, setEdges, portals, communitySpaces, childSpaces, removePortal, applyPositions, portalItemsBySpace, portalSpaceNames, spaceId]);

  // Update drop target highlight on nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.type !== 'mindmap' && n.type !== 'space') return n;
      const isTarget = n.id === dropTargetId;
      if (n.data?.isDropTarget === isTarget) return n;
      return { ...n, data: { ...n.data, isDropTarget: isTarget } };
    }));
  }, [dropTargetId, setNodes]);

  // Handle new connection (create relation)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target &&
          connection.source !== '__space__' && connection.target !== '__space__' &&
          !connection.source.startsWith('child-space-') && !connection.target.startsWith('child-space-')) {
        const allAvailableItems = [...items, ...Array.from(portalItemsBySpace.values()).flat()];
        const sourceItem = allAvailableItems.find(i => i.id === connection.source);
        const targetItem = allAvailableItems.find(i => i.id === connection.target);
        if (sourceItem && targetItem && sourceItem.parentId !== connection.target && targetItem.parentId !== connection.source) {
          setPendingConnection({ source: connection.source, target: connection.target });
        }
      }
    },
    [items, portalItemsBySpace]
  );

  const handleRelationTypeSelect = useCallback(
    (type: string) => {
      if (pendingConnection) {
        onCreateRelation?.(pendingConnection.source, pendingConnection.target, type);
        setPendingConnection(null);
      }
    },
    [pendingConnection, onCreateRelation]
  );

  const pendingSourceItem = pendingConnection ? items.find(i => i.id === pendingConnection.source) : null;
  const pendingTargetItem = pendingConnection ? items.find(i => i.id === pendingConnection.target) : null;

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.id.startsWith('relation-') && edge.data?.relationId) {
        const sourceItem = items.find(i => i.id === edge.source);
        const targetItem = items.find(i => i.id === edge.target);
        const relType = (edge.data.type as string) || 'relates';
        const relLabel = (edge.data.label as string) || '';
        setEditingEdge({
          relationId: edge.data.relationId as string,
          fromItemId: edge.source,
          type: relType,
          label: relLabel,
          sourceName: sourceItem?.title || 'Inconnu',
          targetName: targetItem?.title || 'Inconnu',
        });
        setEditEdgeType(relType);
        setEditEdgeLabel(relLabel);
      }
    },
    [items]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const target = event.target as HTMLElement;
      if (target.closest('.nodrag')) return;
      if (node.id !== '__space__' && node.type !== 'portal') {
        onEdit(node.id);
      }
    },
    [onEdit]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'mindmap') return;
      const item = items.find(i => i.id === node.id);
      if (item?.type === 'PROJECT') {
        const treeNode = findTreeNode(fullTree, node.id);
        if (treeNode && treeNode.children.length > 0) {
          setFocusedProjectId(node.id);
          setTimeout(() => fitView({ padding: 0.1 }), 100);
        }
      }
    },
    [items, fullTree, fitView]
  );

  const exitProjectFocus = useCallback(() => {
    setFocusedProjectId(null);
    setTimeout(() => fitView({ padding: 0.1 }), 100);
  }, [fitView]);

  // Handle node drag start
  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__') return;

      // Portal child-space node: drag all its portal items along
      if (draggedNode.type === 'portal' && draggedNode.id.startsWith('child-space-')) {
        const portalSpaceId = draggedNode.id.replace('child-space-', '');
        const portalItems = portalItemsBySpace.get(portalSpaceId);
        if (!portalItems || portalItems.length === 0) {
          dragDescendants.current = null;
          return;
        }
        const itemIds = portalItems.map(i => i.id);
        const currentNodes = getNodes();
        const absPositions = getAbsolutePositions(currentNodes);
        const draggedAbsPos = absPositions.get(draggedNode.id);
        if (!draggedAbsPos) { dragDescendants.current = null; return; }
        const offsets = new Map<string, { dx: number; dy: number }>();
        for (const id of itemIds) {
          const pos = absPositions.get(id);
          if (pos) offsets.set(id, { dx: pos.x - draggedAbsPos.x, dy: pos.y - draggedAbsPos.y });
        }
        dragDescendants.current = { ids: itemIds, offsets, startPos: { ...draggedAbsPos } };
        return;
      }

      if (draggedNode.type === 'portal') return;

      let treeNode = findTreeNode(fullTree, draggedNode.id);
      if (!treeNode) {
        for (const [, pItems] of portalItemsBySpace.entries()) {
          const portalTree = buildTree(pItems);
          treeNode = findTreeNode(portalTree, draggedNode.id);
          if (treeNode) break;
        }
      }
      if (!treeNode || treeNode.children.length === 0) {
        dragDescendants.current = null;
        return;
      }

      const descendantIds = collectVisibleDescendantIds(treeNode, collapsedIds);
      if (descendantIds.length === 0) { dragDescendants.current = null; return; }

      const currentNodes = getNodes();
      const absPositions = getAbsolutePositions(currentNodes);
      const draggedAbsPos = absPositions.get(draggedNode.id);
      if (!draggedAbsPos) { dragDescendants.current = null; return; }

      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const id of descendantIds) {
        const pos = absPositions.get(id);
        if (pos) offsets.set(id, { dx: pos.x - draggedAbsPos.x, dy: pos.y - draggedAbsPos.y });
      }
      dragDescendants.current = { ids: descendantIds, offsets, startPos: { ...draggedAbsPos } };
    },
    [fullTree, collapsedIds, getNodes, portalItemsBySpace]
  );

  // Handle node drag
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__') return;
      if (dragDescendants.current && dragDescendants.current.offsets.size > 0) {
        const currentNodes = getNodes();
        const absPositions = getAbsolutePositions(currentNodes);
        const draggedAbsPos = absPositions.get(draggedNode.id);
        if (draggedAbsPos) {
          const { offsets } = dragDescendants.current;
          setNodes(prevNodes => prevNodes.map(n => {
            const offset = offsets.get(n.id);
            if (!offset) return n;
            const newAbsX = draggedAbsPos.x + offset.dx;
            const newAbsY = draggedAbsPos.y + offset.dy;
            if (n.parentId) {
              const parentAbs = absPositions.get(n.parentId);
              if (parentAbs) return { ...n, position: { x: newAbsX - parentAbs.x, y: newAbsY - parentAbs.y } };
            }
            return { ...n, position: { x: newAbsX, y: newAbsY } };
          }));
        }
      }
      if (draggedNode.type === 'portal') return;
      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.type !== 'portal' && n.id !== draggedNode.id);
      setDropTargetId(target?.id || null);
    },
    [getIntersectingNodes, getNodes, setNodes]
  );

  // Handle node drop
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') {
        savedPositions.current[draggedNode.id] = draggedNode.position;
        const portalDescIds = dragDescendants.current?.ids;
        dragDescendants.current = null;
        if (portalDescIds && portalDescIds.length > 0) {
          setNodes(currentNodes => {
            const absPositions = getAbsolutePositions(currentNodes);
            for (const id of portalDescIds) {
              const descAbsPos = absPositions.get(id);
              if (descAbsPos) savedPositions.current[id] = descAbsPos;
            }
            savePositions();
            return currentNodes;
          });
        } else {
          savePositions();
        }
        setDropTargetId(null);
        return;
      }

      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.type !== 'portal' && n.id !== draggedNode.id);
      if (target && onMove && canEdit !== false) {
        if (target.id === '__space__') {
          const draggedItem = items.find(i => i.id === draggedNode.id);
          if (draggedItem?.parentId) onMove(draggedNode.id, null, 0);
        } else {
          const isDescendant = (parentId: string, childId: string): boolean => {
            const child = items.find(i => i.id === childId);
            if (!child || !child.parentId) return false;
            if (child.parentId === parentId) return true;
            return isDescendant(parentId, child.parentId);
          };
          if (!isDescendant(draggedNode.id, target.id)) onMove(draggedNode.id, target.id, 0);
        }
      } else {
        setNodes(currentNodes => {
          const absPositions = getAbsolutePositions(currentNodes);
          const absPos = absPositions.get(draggedNode.id);
          if (absPos) savedPositions.current[draggedNode.id] = absPos;
          if (dragDescendants.current) {
            for (const id of dragDescendants.current.ids) {
              const descAbsPos = absPositions.get(id);
              if (descAbsPos) savedPositions.current[id] = descAbsPos;
            }
          }
          savePositions();
          return currentNodes;
        });
      }
      dragDescendants.current = null;
      setDropTargetId(null);
    },
    [getIntersectingNodes, onMove, items, savePositions, setNodes]
  );

  // Reset layout function
  const resetLayout = useCallback(() => {
    // Save pinned positions before clearing
    const pinnedPositions: Record<string, { x: number; y: number }> = {};
    const currentNodes = getNodes();
    const currentAbsPositions = getAbsolutePositions(currentNodes);
    for (const id of pinnedIds.current) {
      const saved = savedPositions.current[id] || (currentAbsPositions.get(id) ? { x: currentAbsPositions.get(id)!.x, y: currentAbsPositions.get(id)!.y } : null);
      if (saved) pinnedPositions[id] = saved;
    }
    savedPositions.current = {};
    if (positionsStorageKey) localStorage.removeItem(positionsStorageKey);

    const { nodes: newNodes, edges: newEdges, relationEdges, rootArcEnd } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);

    // Restore pinned positions and shift descendants
    const d3PosMap = new Map(newNodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]));

    function getDescendantIds(nodeId: string, treeItems: TreeItem[]): string[] {
      const node = findTreeNode(treeItems, nodeId);
      if (!node) return [];
      function collectIds(item: TreeItem): string[] {
        const ids: string[] = [];
        for (const child of item.children) { ids.push(child.id); ids.push(...collectIds(child)); }
        return ids;
      }
      return collectIds(node);
    }

    const offsetMap = new Map<string, { dx: number; dy: number }>();
    for (const [id, pinnedPos] of Object.entries(pinnedPositions)) {
      const d3Pos = d3PosMap.get(id);
      if (!d3Pos) continue;
      const dx = pinnedPos.x - d3Pos.x;
      const dy = pinnedPos.y - d3Pos.y;
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) continue;
      const descIds = getDescendantIds(id, fullTree);
      for (const descId of descIds) {
        if (!pinnedPositions[descId] && !offsetMap.has(descId)) offsetMap.set(descId, { dx, dy });
      }
    }

    Object.assign(savedPositions.current, pinnedPositions);
    const repositionedNodes = newNodes.map(n => {
      const pinned = pinnedPositions[n.id];
      if (pinned) return { ...n, position: pinned };
      const offset = offsetMap.get(n.id);
      if (offset) {
        const shifted = { x: n.position.x + offset.dx, y: n.position.y + offset.dy };
        savedPositions.current[n.id] = shifted;
        return { ...n, position: shifted };
      }
      return n;
    });
    savePositions();

    // Build portal nodes using shared function
    const { portalNodes, portalEdges, portalRelationEdges } = buildPortalNodesAndEdges({
      positionedNodes: repositionedNodes, portals, portalItemsBySpace, childSpaces, communitySpaces,
      portalSpaceNames, statuses, collapsedIds, items, callbacks: layoutCallbacks,
      options: layoutOptions, removePortal, savedPositions: {}, rootArcEnd,  // Don't apply saved positions in reset
    }, relationEdges);

    const allNodes = [...repositionedNodes, ...portalNodes];
    const resetEdgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
    setNodes(allNodes);
    setEdges(recalculateEdgeHandles([...newEdges, ...relationEdges, ...portalRelationEdges, ...portalEdges], resetEdgePosMap));
    setTimeout(() => fitView({ padding: 0.1 }), 50);
  }, [tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions, setNodes, setEdges, fitView, portals, communitySpaces, removePortal, savePositions, childSpaces, portalItemsBySpace, portalSpaceNames, spaceId, fullTree]);

  // Get all node IDs that have children
  const getParentIds = useCallback((items: TreeItem[]): Set<string> => {
    const parentIds = new Set<string>();
    function traverse(items: TreeItem[]) {
      items.forEach(item => {
        if (item.children.length > 0) { parentIds.add(item.id); traverse(item.children); }
      });
    }
    traverse(items);
    return parentIds;
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
    setTimeout(() => fitView({ padding: 0.1 }), 100);
  }, [fitView]);

  const collapseAll = useCallback(() => {
    const parentIds = getParentIds(tree);
    setCollapsedIds(parentIds);
    setTimeout(() => fitView({ padding: 0.1 }), 100);
  }, [tree, getParentIds, fitView]);

  const hasCollapsedNodes = collapsedIds.size > 0;

  const fitAll = useCallback(() => {
    fitView({ padding: 0.1 });
  }, [fitView]);

  useImperativeHandle(innerRef, () => ({
    expandAll, collapseAll, resetLayout, hasCollapsedNodes, fitAll,
  }), [expandAll, collapseAll, resetLayout, hasCollapsedNodes, fitAll]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={canEdit !== false ? onEdgeClick : undefined}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={canEdit !== false ? onConnect : undefined}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.01}
        maxZoom={2}
        connectOnClick={false}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls className="hidden sm:flex" position="bottom-right" />
        <MiniMap
          className="hidden md:block"
          nodeColor={(node) => node.data?.hexColor as string || '#f3f4f6'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        {focusedProjectId && (
          <Panel position="top-right" className="flex gap-1 sm:gap-2">
            <button
              onClick={exitProjectFocus}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-primary text-primary-foreground border rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
              title="Revenir à la vue complète"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Vue complète</span>
            </button>
          </Panel>
        )}
        <Panel position="bottom-left" className="bg-white/95 border rounded-lg shadow-sm p-2 text-xs max-w-[220px]">
          <button
            onClick={() => setLegendOpen(v => !v)}
            className="flex items-center gap-1 font-semibold text-foreground w-full"
            title={legendOpen ? 'Masquer la légende' : 'Afficher la légende'}
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${legendOpen ? 'rotate-90' : ''}`} />
            Légende
          </button>

          <div className={`${legendOpen ? 'block' : 'hidden'} mt-2`}>
            <div className="space-y-1 mb-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Link2 className="w-3 h-3 text-purple-500 flex-shrink-0" />
                <span>Glissez pour créer une relation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 flex-shrink-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #8b5cf6 0, #8b5cf6 3px, transparent 3px, transparent 6px)' }} />
                <span>Cliquez pour supprimer</span>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                <span>Portail : autre espace</span>
              </div>
            </div>

            <div className="font-semibold text-foreground mb-1.5 pt-2 border-t">Relations</div>
            <div className="flex flex-wrap gap-1">
              {RELATION_TYPES.map((type) => (
                <div
                  key={type.id}
                  className="group relative p-1.5 rounded-md hover:bg-gray-100 cursor-help transition-colors"
                  title={`${type.label} — ${type.description}`}
                >
                  <type.Icon className={`w-4 h-4 ${type.color}`} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-gray-300 text-[10px]">{type.description}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Relation type selection dialog */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Type de relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{pendingSourceItem?.title}</span>
              {' → '}
              <span className="font-medium">{pendingTargetItem?.title}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RELATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleRelationTypeSelect(type.id)}
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left group"
                  title={type.description}
                >
                  <type.Icon className={`w-4 h-4 ${type.color}`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{type.label}</span>
                    <span className="text-[10px] text-muted-foreground">{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingConnection(null)}
              className="mt-4 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Edit relation dialog */}
      {editingEdge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Modifier la relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{editingEdge.sourceName}</span>
              {' → '}
              <span className="font-medium">{editingEdge.targetName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {RELATION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setEditEdgeType(type.id)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${
                        editEdgeType === type.id ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/30' : 'hover:bg-purple-50 hover:border-purple-300'
                      }`}
                    >
                      <type.Icon className={`w-4 h-4 ${type.color}`} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Commentaire</label>
                <input
                  type="text"
                  value={editEdgeLabel}
                  onChange={(e) => setEditEdgeLabel(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400 bg-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  onUpdateRelation?.(editingEdge.fromItemId, editingEdge.relationId, {
                    type: editEdgeType,
                    label: editEdgeLabel.trim() || null,
                  });
                  setEditingEdge(null);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  onDeleteRelation?.(editingEdge.fromItemId, editingEdge.relationId);
                  setEditingEdge(null);
                }}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                Supprimer
              </button>
              <button
                onClick={() => setEditingEdge(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal selection dialog */}
      {showPortalDialog && pendingPortalParentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-indigo-600" />
              Ajouter un portail
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Depuis <span className="font-medium">{items.find(i => i.id === pendingPortalParentId)?.title}</span>, ouvrir :
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableSpaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => addPortal(space.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-left"
                >
                  <FolderOpen className="w-4 h-4 text-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{space.name}</span>
                    <span className="text-xs text-muted-foreground">{space.role}</span>
                  </div>
                </button>
              ))}
              {availableSpaces.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun autre espace disponible dans cette communauté
                </p>
              )}
            </div>
            <button
              onClick={() => { setShowPortalDialog(false); setPendingPortalParentId(null); }}
              className="mt-4 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const MindMapView = forwardRef<MindMapViewHandle, MindMapViewProps>(function MindMapView({
  items, spaceName = 'Espace', spaceId, communitySpaces, highlightType, highlightStatus, searchMatchIds,
  onEdit, onDelete, onUpdateStatus, onAddChild, onMove, onMoveToSpace, onDuplicateToSpace, onConvertToSpace,
  onSelfAssign, onMerge, onAbsorbChildren, onCreateRelation, onDeleteRelation, onUpdateRelation, referentiels, canEdit,
}, ref) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <MindMapViewInner
          items={items} spaceName={spaceName} spaceId={spaceId} communitySpaces={communitySpaces}
          highlightType={highlightType} highlightStatus={highlightStatus} searchMatchIds={searchMatchIds}
          onEdit={onEdit} onDelete={onDelete} onUpdateStatus={onUpdateStatus} onAddChild={onAddChild}
          onMove={onMove} onMoveToSpace={onMoveToSpace} onDuplicateToSpace={onDuplicateToSpace}
          onConvertToSpace={onConvertToSpace} onSelfAssign={onSelfAssign} onMerge={onMerge} onAbsorbChildren={onAbsorbChildren} onCreateRelation={onCreateRelation}
          onDeleteRelation={onDeleteRelation} onUpdateRelation={onUpdateRelation}
          referentiels={referentiels} canEdit={canEdit}
          innerRef={ref}
        />
      </ReactFlowProvider>
    </div>
  );
});
