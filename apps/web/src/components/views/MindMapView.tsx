import { useMemo, useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef, useContext } from 'react';
import { useCollapsedIds } from '../../lib/useCollapsedIds';
import { useEscapeKey } from '../../hooks/useEscapeKey';
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
import type { ItemWithRelations, SpaceReferentiels, SpaceWithRole, MenuItemConfig } from '@spok/shared';
import type { ViewMode } from '../../stores/viewMode';
import { ViewSelectorBar } from '../ui/ViewSelectorBar';
import { SidebarDropContext } from '../Layout';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { ChevronRight, FolderOpen, ExternalLink, Link2, Maximize2, RotateCcw, Plus, History, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ViewHelpButton } from '../ViewHelpButton';
import { FilterToolbar } from '../ui/FilterToolbar';
import type { ItemType } from '@spok/shared';
import { toPng } from 'html-to-image';
import { getViewportForBounds } from '@xyflow/react';
import { jsPDF } from 'jspdf';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import { buildExportFilename, exportCSV, exportExcel, exportDataPDF } from '../../lib/exportUtils';

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
  getStatusColor,
  tailwindBgToHex,
  getContrastTextColor,
} from './mindmap-utils';
import { nodeTypes } from './mindmap-nodes';
import { calculateLayout, buildPortalNodesAndEdges, type MindMapCallbacks, type MindMapLayoutOptions } from './mindmap-layout';
import { RelationEdge } from './RelationEdge';

const edgeTypes = { relation: RelationEdge };

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
  onMoveToSpaceDirect?: (itemId: string, sourceSpaceId: string, targetSpaceId: string) => void;
  onDuplicateToSpace?: (itemId: string) => void;
  onConvertToSpace?: (itemId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string, label?: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onReorder?: (spaceId: string, groups: { parentId: string | null; itemIds: string[] }[]) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  spaceViews?: MenuItemConfig[];
  allowedViews?: ViewMode[] | null;
  onSetMode?: (mode: ViewMode) => void;
  defaultView?: ViewMode;
  // Toolbar props
  spaceRole?: string;
  onNewItem?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  totalItemCount?: number;
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
  onMoveToSpaceDirect,
  onDuplicateToSpace,
  onConvertToSpace,
  onCreateRelation,
  onDeleteRelation,
  onUpdateRelation,
  onUpdateStatus,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen, onOpenInNewTab,
  onReorder,
  referentiels,
  canEdit,
  canEditItem,
  spaceRole, onNewItem, onStartTour, pulseHelp,
  filter = 'ALL', onFilterChange, statusFilter = 'ALL', onStatusFilterChange, totalItemCount,
  innerRef,
}: MindMapViewProps & { innerRef?: React.Ref<MindMapViewHandle> }) {
  // Track previous items to detect content-only vs structural changes
  const userHasInteracted = useRef(false);
  useEffect(() => { userHasInteracted.current = false; }, [spaceId]);
  const prevStructureRef = useRef<string>('');
  const prevDepsRef = useRef<string>('');
  const prevItemIdsRef = useRef<Set<string>>(new Set());
  const prevItemSigsRef = useRef<Map<string, string>>(new Map());

  const { collapsedIds, setCollapsedIds } = useCollapsedIds(spaceId ?? '');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [editingEdge, setEditingEdge] = useState<{ relationId: string; fromItemId: string; type: string; label: string; sourceName: string; targetName: string } | null>(null);
  const [editEdgeType, setEditEdgeType] = useState('');
  const [editEdgeLabel, setEditEdgeLabel] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  useEscapeKey(() => setPendingConnection(null), !!pendingConnection);
  useEscapeKey(() => { setEditingEdge(null); setEditEdgeType(''); setEditEdgeLabel(''); }, !!editingEdge);
  useEscapeKey(() => setShowPortalDialog(false), showPortalDialog);
  const [pendingPortalParentId, setPendingPortalParentId] = useState<string | null>(null);
  const { fitView, getIntersectingNodes, getNodes, getNodesBounds: getNodesBoundsHook } = useReactFlow();
  const { setDropTargetId: setSidebarDropTargetId } = useContext(SidebarDropContext);

  // Helper: trouve l'espace sidebar sous les coordonnées écran
  const getSidebarSpaceAtPoint = useCallback((x: number, y: number): string | null => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const spaceId = (el as HTMLElement).dataset?.sidebarSpaceId;
      if (spaceId) return spaceId;
    }
    return null;
  }, []);

  // localStorage keys
  const portalsStorageKey = spaceId ? `mindmap-portals-${spaceId}` : null;
  const positionsStorageKey = spaceId ? `mindmap-positions-v3-${spaceId}` : null;
  const pinnedStorageKey = spaceId ? `mindmap-pinned-${spaceId}` : null;

  // Saved node positions
  const savedPositions = useRef<Record<string, { x: number; y: number }>>({});

  // Pinned node IDs (protected from reorganization)
  const pinnedIds = useRef<Set<string>>(new Set());

  // Load saved positions from localStorage (clear if no data for this space)
  useEffect(() => {
    if (!positionsStorageKey) return;
    try {
      const stored = localStorage.getItem(positionsStorageKey);
      savedPositions.current = stored ? JSON.parse(stored) : {};
    } catch { savedPositions.current = {}; }
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

  // Portals state
  const [portals, setPortals] = useState<PortalState[]>([]);
  const [portalsLoaded, setPortalsLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

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

  const hasPortalSupport = availableSpaces.length > 0;


  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const statusOptions = useMemo(() => statuses.filter(s => s.visible).sort((a, b) => a.order - b.order), [statuses]);

  const portalSpaceNames = useMemo(() => {
    if (!communitySpaces?.length || !spaceId) return new Map<string, string>();
    return new Map(communitySpaces.filter(s => s.id !== spaceId).map(s => [s.id, s.name]));
  }, [communitySpaces, spaceId]);

  const currentSpaceItems = useMemo(() => {
    if (!spaceId) return items;
    return items.filter(i => i.spaceId === spaceId);
  }, [items, spaceId]);

  // Types actually present in this space


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
  const setEdgesRef = useRef<React.Dispatch<React.SetStateAction<Edge[]>>>(() => {});
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

  // Callback pour sauvegarder la position après un drag HTML5 depuis le grip
  // Utilise des refs stables pour éviter la dépendance à setNodes/setEdges (déclarés plus bas)
  const handleSavePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    savedPositions.current[id] = pos;
    savePositions();
    setNodesRef.current(currentNodes => {
      const absPositions = getAbsolutePositions(currentNodes);
      setEdgesRef.current(currentEdges => recalculateEdgeHandles(currentEdges, absPositions));
      return currentNodes;
    });
  }, [savePositions]);

  // Build callbacks and options objects for layout functions
  const layoutCallbacks: MindMapCallbacks = useMemo(() => ({
    onEdit, onDelete, onUpdateStatus, onAddChild,
    onAddPortal: handleAddPortal,
    onToggleCollapse: toggleCollapse,
    onReorganizeChildren: handleReorganizeChildren,
    onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab,
    onTogglePin: togglePin,
    onSavePosition: handleSavePosition,
  }), [onEdit, onDelete, onUpdateStatus, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, togglePin, handleSavePosition]);

  const layoutOptions: MindMapLayoutOptions = useMemo(() => ({
    hasPortalSupport, statusOptions,
    highlightType,
    highlightStatus,
    searchMatchIds, canEdit, canEditItem,
    pinnedIdsSet: pinnedIds.current,
    currentSpaceId: spaceId,
    portalSpaceNames,
  }), [hasPortalSupport, statusOptions, highlightType, highlightStatus, searchMatchIds, canEdit, canEditItem, spaceId, portalSpaceNames]);

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
  setEdgesRef.current = setEdges;

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

  // Compute structural signature: ids, parentIds, relations, children count
  const structureSignature = useMemo(() => {
    const parts = items.map(i => {
      const relIds = (i.relationsFrom?.map((r: { id: string }) => r.id) || [])
        .concat(i.relationsTo?.map((r: { id: string }) => r.id) || [])
        .sort()
        .join(',');
      return `${i.id}:${i.parentId || ''}:${i.children?.length || 0}:${relIds}`;
    }).sort();
    return parts.join('|');
  }, [items]);

  // Deps signature for non-item dependencies that require full layout
  const depsSignature = `${[...collapsedIds].sort().join(',')}|${displayName}|${portals.map(p => p.id).join(',')}|${items.length}`;

  // Update nodes when items, collapsed state, or portals change
  useEffect(() => {
    const prevSignature = prevStructureRef.current;
    const prevDeps = prevDepsRef.current;
    const isFirstRender = prevSignature === '';
    const isStructuralChange = prevSignature !== structureSignature;
    const isDepsChange = prevDeps !== depsSignature;
    prevStructureRef.current = structureSignature;
    prevDepsRef.current = depsSignature;

    // Detect pure deletion (no additions, no reparenting of remaining items)
    const newItemIds = new Set(items.map(i => i.id));
    const newItemSigs = new Map(items.map(i => [i.id, `${i.parentId || ''}:${i.children?.length || 0}`]));
    const prevItemIds = prevItemIdsRef.current;
    const prevItemSigs = prevItemSigsRef.current;
    const addedIds = [...newItemIds].filter(id => !prevItemIds.has(id));
    const deletedIds = [...prevItemIds].filter(id => !newItemIds.has(id));
    const changedIds = [...newItemIds].filter(id => prevItemIds.has(id) && newItemSigs.get(id) !== prevItemSigs.get(id));
    const isPureDeletion = !isFirstRender && isStructuralChange && addedIds.length === 0 && changedIds.length === 0 && deletedIds.length > 0;
    prevItemIdsRef.current = newItemIds;
    prevItemSigsRef.current = newItemSigs;

    if (!isFirstRender && !isStructuralChange && !isDepsChange) {
      // Content-only change: patch node data in place, keep positions
      const itemMap = new Map(items.map(i => [i.id, i]));
      setNodes(nds => nds.map(n => {
        if (n.type !== 'mindmap') return n;
        const item = itemMap.get(n.id);
        if (!item) return n;
        const statusColor = getStatusColor(item.status, statuses);
        const hexColor = tailwindBgToHex(statusColor);
        return {
          ...n,
          data: {
            ...n.data,
            label: item.title,
            item,
            statusColor,
            hexColor,
            textColor: getContrastTextColor(hexColor),
            isHighlighted: (layoutOptions.highlightType ? item.type === layoutOptions.highlightType : false) || (layoutOptions.highlightStatus ? (layoutOptions.highlightStatus === 'undefined' ? !item.status : item.status === layoutOptions.highlightStatus) : false),
            isDimmed: (layoutOptions.highlightType ? item.type !== layoutOptions.highlightType : false) || (layoutOptions.highlightStatus ? (layoutOptions.highlightStatus === 'undefined' ? !!item.status : item.status !== layoutOptions.highlightStatus) : false) || (layoutOptions.searchMatchIds ? !layoutOptions.searchMatchIds.has(item.id) : false),
            isSearchMatch: !!(layoutOptions.searchMatchIds && layoutOptions.searchMatchIds.has(item.id)),
          },
        };
      }));
      return;
    }

    if (isPureDeletion) {
      // Suppression seule : retirer les nœuds et arêtes sans recalculer le layout
      const deletedSet = new Set(deletedIds);
      setNodes(nds => nds.filter(n => !deletedSet.has(n.id)));
      setEdges(eds => eds.filter(e => !deletedSet.has(e.source) && !deletedSet.has(e.target)));
      return;
    }

    // Structural change: full layout recalculation
    const { nodes: newNodes, edges: newEdges, relationEdges, rootArcEnd, arcStart } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);
    const positionedNodes = applyPositions(newNodes);

    const { portalNodes, portalEdges, portalRelationEdges } = buildPortalNodesAndEdges({
      positionedNodes, portals, portalItemsBySpace, childSpaces, communitySpaces,
      portalSpaceNames, statuses, collapsedIds, items, callbacks: layoutCallbacks,
      options: layoutOptions, removePortal, savedPositions: savedPositions.current, rootArcEnd, arcStart,
    }, relationEdges);

    const allNodes = [...positionedNodes, ...portalNodes];
    const edgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
    const allEdges = recalculateEdgeHandles([...newEdges, ...relationEdges, ...portalRelationEdges, ...portalEdges], edgePosMap);
    setNodes(allNodes);
    setEdges(allEdges);
    if (!userHasInteracted.current) setTimeout(() => fitView({ padding: 0.1 }), 50);
  }, [tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions, setNodes, setEdges, portals, communitySpaces, childSpaces, removePortal, applyPositions, portalItemsBySpace, portalSpaceNames, spaceId, fitView, structureSignature, depsSignature]);

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
        onCreateRelation?.(pendingConnection.source, pendingConnection.target, type, pendingLabel || undefined);
        setPendingConnection(null);
        setPendingLabel('');
      }
    },
    [pendingConnection, pendingLabel, onCreateRelation]
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
    (event: React.MouseEvent, draggedNode: Node) => {
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

      // Highlight sidebar space under cursor
      const sidebarSpaceId = getSidebarSpaceAtPoint(event.clientX, event.clientY);
      setSidebarDropTargetId(sidebarSpaceId);

      if (!sidebarSpaceId) {
        const intersecting = getIntersectingNodes(draggedNode);
        const target = intersecting.find(n => n.type !== 'portal' && n.id !== draggedNode.id);
        setDropTargetId(target?.id || null);
      } else {
        setDropTargetId(null);
      }
    },
    [getIntersectingNodes, getNodes, setNodes, getSidebarSpaceAtPoint, setSidebarDropTargetId]
  );

  // Handle node drop
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node) => {
      setSidebarDropTargetId(null);

      // Drop sur la sidebar → déplacer l'item vers cet espace
      if (draggedNode.type === 'mindmap' && canEdit !== false) {
        const targetSidebarSpaceId = getSidebarSpaceAtPoint(event.clientX, event.clientY);
        if (targetSidebarSpaceId && spaceId && targetSidebarSpaceId !== spaceId) {
          const draggedItem = items.find(i => i.id === draggedNode.id);
          const sourceSpaceId = draggedItem?.spaceId || spaceId;
          if (sourceSpaceId !== targetSidebarSpaceId) {
            onMoveToSpaceDirect?.(draggedNode.id, sourceSpaceId, targetSidebarSpaceId);
          }
          dragDescendants.current = null;
          setDropTargetId(null);
          return;
        }
      }

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

      // Check if dropped on a portal node → move to that space
      const portalTarget = intersecting.find(n => n.type === 'portal' && n.id !== draggedNode.id);
      if (portalTarget && onMoveToSpaceDirect && spaceId && canEdit !== false) {
        // Resolve target space ID from portal data
        const targetSpaceId = (portalTarget.data?.space as { id?: string })?.id
          || (portalTarget.id.startsWith('child-space-') ? portalTarget.id.replace('child-space-', '') : null)
          || portals.find(p => p.id === portalTarget.id)?.spaceId;
        if (targetSpaceId) {
          onMoveToSpaceDirect(draggedNode.id, spaceId, targetSpaceId);
          dragDescendants.current = null;
          setDropTargetId(null);
          return;
        }
      }

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

          // Angular sibling reorder: persist new order in DB
          // Include portal items in angular calculation but only persist same-space items
          if (onReorder && canEdit !== false) {
            const draggedItem = items.find(i => i.id === draggedNode.id);
            if (draggedItem) {
              const parentId = draggedItem.parentId || null;
              const isPortalItem = draggedItem.spaceId !== spaceId;
              // All visual siblings (including portals) for angular sort
              const allSiblings = items.filter(i => (i.parentId || null) === parentId);
              const sameSpaceSiblings = allSiblings.filter(i => i.spaceId === draggedItem.spaceId);

              if (sameSpaceSiblings.length >= 2) {
                const parentNodeId = parentId
                  || (isPortalItem ? `child-space-${draggedItem.spaceId}` : '__space__');
                const parentPos = absPositions.get(parentNodeId);

                if (parentPos) {
                  // Calculate angles for ALL siblings (portals included)
                  const allAngles = allSiblings.map(sib => {
                    const sibPos = absPositions.get(sib.id);
                    if (!sibPos) return { id: sib.id, angle: 0, spaceId: sib.spaceId };
                    return {
                      id: sib.id,
                      angle: Math.atan2(sibPos.y - parentPos.y, sibPos.x - parentPos.x),
                      spaceId: sib.spaceId,
                    };
                  });

                  allAngles.sort((a, b) => a.angle - b.angle);
                  // Extract only same-space items in their new visual order
                  const newOrder = allAngles
                    .filter(s => s.spaceId === draggedItem.spaceId)
                    .map(s => s.id);

                  const currentOrder = [...sameSpaceSiblings]
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                    .map(s => s.id);

                  const orderChanged = newOrder.some((id, i) => id !== currentOrder[i]);
                  if (orderChanged) {
                    onReorder(draggedItem.spaceId, [{ parentId, itemIds: newOrder }]);
                  }
                }
              }
            }
          }

          return currentNodes;
        });
      }
      dragDescendants.current = null;
      setDropTargetId(null);
    },
    [getIntersectingNodes, onMove, onMoveToSpaceDirect, items, savePositions, setNodes, spaceId, portals, canEdit, onReorder, getSidebarSpaceAtPoint, setSidebarDropTargetId]
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

    const { nodes: newNodes, edges: newEdges, relationEdges, rootArcEnd, arcStart } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);

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
      options: layoutOptions, removePortal, savedPositions: {}, rootArcEnd, arcStart,  // Don't apply saved positions in reset
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

  const [exporting, setExporting] = useState(false);

  const captureGraph = useCallback(async (padding = 40) => {
    const nodes = getNodes();
    if (nodes.length === 0) return null;
    const bounds = getNodesBoundsHook(nodes);
    const imageWidth = Math.round(bounds.width + padding * 2);
    const imageHeight = Math.round(bounds.height + padding * 2);
    const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.01, 4, padding / Math.max(imageWidth, imageHeight));
    const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowEl) return null;
    return toPng(flowEl, {
      backgroundColor: '#ffffff',
      width: imageWidth,
      height: imageHeight,
      skipFonts: true,
      filter: (node) => {
        // Ignorer les images externes (favicons, etc.) qui bloquent sur CORS
        if (node instanceof HTMLImageElement && node.src && !node.src.startsWith(window.location.origin) && !node.src.startsWith('data:')) {
          return false;
        }
        return true;
      },
      style: {
        width: String(imageWidth),
        height: String(imageHeight),
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: 'top left',
      },
    }).then(dataUrl => ({ dataUrl, imageWidth, imageHeight }));
  }, [getNodes]);

  const sanitizedName = `${spaceName} - Carte mentale`.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);

  const exportPNG = useCallback(async () => {
    setExporting(true);
    try {
      const result = await captureGraph();
      if (!result) return;
      const a = document.createElement('a');
      a.href = result.dataUrl;
      a.download = `${sanitizedName}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [captureGraph, sanitizedName]);

  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const result = await captureGraph();
      if (!result) return;
      const { dataUrl, imageWidth, imageHeight } = result;
      const isLandscape = imageWidth > imageHeight;
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imageWidth, imageHeight],
      });
      doc.addImage(dataUrl, 'PNG', 0, 0, imageWidth, imageHeight);
      doc.save(`${sanitizedName}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [captureGraph, sanitizedName]);

  useImperativeHandle(innerRef, () => ({
    expandAll, collapseAll, resetLayout, hasCollapsedNodes, fitAll,
  }), [expandAll, collapseAll, resetLayout, hasCollapsedNodes, fitAll]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar MindMap */}
      <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        <ViewHelpButton viewMode="mindmap" onStartTour={onStartTour} pulse={pulseHelp} />
        {canEdit && onNewItem && (
          <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
        <div className="h-4 w-px bg-border mx-1" />
        <CollapseToggleButton
          isCollapsed={collapsedIds.size > 0}
          onToggle={() => collapsedIds.size > 0 ? expandAll() : collapseAll()}
        />
        <button
          onClick={resetLayout}
          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Réorganiser les éléments"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Réorganiser</span>
        </button>
        <button
          onClick={fitAll}
          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Tout voir"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tout voir</span>
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <div className="relative">
          <button
            className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => setLegendOpen(v => !v)}
            title={legendOpen ? 'Masquer la légende' : 'Afficher la légende'}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${legendOpen ? 'rotate-90' : ''}`} />
            <span className="hidden sm:inline">Légende</span>
          </button>
          {legendOpen && (
            <div className="absolute top-full left-0 mt-1 bg-card border rounded-lg shadow-lg p-3 text-xs min-w-[200px] z-50">
              <div className="space-y-1.5 mb-3 text-muted-foreground">
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
                    className="group relative p-1.5 rounded-md hover:bg-accent cursor-help transition-colors"
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
          )}
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        <FilterToolbar
          filter={filter}
          onFilterChange={onFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          referentiels={referentiels}
          isHighlightMode={true}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {totalItemCount !== undefined && (
          <span className="text-xs text-muted-foreground flex-shrink-0">{totalItemCount} élément{totalItemCount !== 1 ? 's' : ''}</span>
        )}
        <ExportDropdownButton
          disabled={exporting}
          groups={[
            { options: [
              { label: 'CSV (.csv)', onClick: () => exportCSV(items, buildExportFilename(spaceName, 'mindmap')) },
              { label: 'Excel (.xlsx)', onClick: () => exportExcel(items, buildExportFilename(spaceName, 'mindmap')) },
              { label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, buildExportFilename(spaceName, 'mindmap'), spaceName) },
            ]},
            { options: [
              { label: 'PNG — schéma complet (.png)', onClick: exportPNG },
              { label: 'PDF — schéma complet (.pdf)', onClick: exportPDF },
            ]},
          ]}
        />
        {canEdit && spaceId && (
          <Link to={`/spaces/${spaceId}/history`}>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Historique">
              <History className="w-4 h-4" />
            </button>
          </Link>
        )}
        {spaceRole === 'OWNER' && spaceId && (
          <Link to={`/spaces/${spaceId}/settings`}>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Paramètres">
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>
      <div className="flex-1 min-h-0">
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
        nodesDraggable={canEdit !== false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={() => {
          setTimeout(() => {
            setEdges(currentEdges => {
              const posMap = new Map(getNodes().map(n => [n.id, n.position]));
              return recalculateEdgeHandles(currentEdges, posMap);
            });
            fitView({ padding: 0.1 });
          }, 50);
        }}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.01}
        maxZoom={2}
        connectOnClick={false}
        onMoveEnd={() => { userHasInteracted.current = true; }}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
      >
        <Background color="#e2e8f0" gap={20} className="dark:hidden" />
        <Background color="#334155" gap={20} className="hidden dark:block" />
        <Controls className="hidden sm:flex" position="bottom-right" data-tour="mindmap-controls" />
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
      </ReactFlow>
      </div>

      {/* Relation type selection dialog */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Type de relation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              <span className="font-medium">{pendingSourceItem?.title}</span>
              {' → '}
              <span className="font-medium">{pendingTargetItem?.title}</span>
            </p>
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</label>
              <textarea
                value={pendingLabel}
                onChange={e => setPendingLabel(e.target.value)}
                placeholder="Décrivez cette relation…"
                rows={2}
                className="w-full text-sm border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
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
            {pendingLabel && (
              <button
                onClick={() => handleRelationTypeSelect('relates')}
                className="mt-2 w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Créer avec type par défaut
              </button>
            )}
            <button
              onClick={() => { setPendingConnection(null); setPendingLabel(''); }}
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
    </div>
  );
}

export const MindMapView = forwardRef<MindMapViewHandle, MindMapViewProps>(function MindMapView({
  items, spaceName = 'Espace', spaceId, communitySpaces, highlightType, highlightStatus, searchMatchIds,
  onEdit, onDelete, onUpdateStatus, onAddChild, onMove, onMoveToSpace, onMoveToSpaceDirect, onDuplicateToSpace, onConvertToSpace,
  onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, onReorder, onCreateRelation, onDeleteRelation, onUpdateRelation, referentiels, canEdit, canEditItem,
  spaceViews, allowedViews, onSetMode, defaultView,
  spaceRole, onNewItem, onStartTour, pulseHelp, filter, onFilterChange, statusFilter, onStatusFilterChange, totalItemCount,
}, ref) {
  return (
    <div className="h-full w-full flex flex-col">
      {spaceViews && onSetMode && (
        <ViewSelectorBar
          viewMode="mindmap"
          onSetMode={onSetMode}
          allowedViews={allowedViews ?? null}
          spaceViews={spaceViews}
          defaultView={defaultView}
        />
      )}
      <ReactFlowProvider>
        <MindMapViewInner
          items={items} spaceName={spaceName} spaceId={spaceId} communitySpaces={communitySpaces}
          highlightType={highlightType} highlightStatus={highlightStatus} searchMatchIds={searchMatchIds}
          onEdit={onEdit} onDelete={onDelete} onUpdateStatus={onUpdateStatus} onAddChild={onAddChild}
          onMove={onMove} onMoveToSpace={onMoveToSpace} onMoveToSpaceDirect={onMoveToSpaceDirect} onDuplicateToSpace={onDuplicateToSpace}
          onConvertToSpace={onConvertToSpace} onSelfAssign={onSelfAssign} onMerge={onMerge} onAbsorbChildren={onAbsorbChildren} onSplitDescription={onSplitDescription} onOpen={onOpen}
 onOpenInNewTab={onOpenInNewTab} onReorder={onReorder} onCreateRelation={onCreateRelation}
          onDeleteRelation={onDeleteRelation} onUpdateRelation={onUpdateRelation}
          referentiels={referentiels} canEdit={canEdit} canEditItem={canEditItem}
          spaceRole={spaceRole} onNewItem={onNewItem} onStartTour={onStartTour} pulseHelp={pulseHelp}
          filter={filter} onFilterChange={onFilterChange} statusFilter={statusFilter} onStatusFilterChange={onStatusFilterChange} totalItemCount={totalItemCount}
          innerRef={ref}
        />
      </ReactFlowProvider>
    </div>
  );
});
