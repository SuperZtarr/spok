/*
 * Carte mentale globale (/mindmap) : tous les espaces accessibles, regroupés par communauté — distincte de MindMapView.
 * Clic : espace → sa page, communauté → sa page. Glisser un espace sur un autre espace / une communauté / le groupe
 * des indépendants = le déplacer (règles : dashboard-mindmap-drop.ts). Pendant le survol : nœud glissé translucide,
 * cible qui pulse en vert (ou rouge si refusé) et étiquette près du curseur disant ce que fera le dépôt.
 * Props : onMoveSpace(move) renvoie une promesse — rejet = déplacement annulé à l'écran (l'appelant affiche l'erreur).
 * Glisser une communauté ou un groupe ne fait que le repositionner (positions en localStorage, « Réinitialiser »).
 * Zoom au pincement du pad hors macOS : useTrackpadPinchZoom (React Flow ne compense que sur Mac).
 */
import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { hierarchy, tree as d3Tree } from 'd3-hierarchy';
import { Building2, FolderKanban, User, Globe, Users, RotateCcw } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';
import { resolveSpaceDrop, type SpaceDropResult } from './dashboard-mindmap-drop';
import { useTrackpadPinchZoom } from '../../hooks/useTrackpadPinchZoom';

const DASHBOARD_MIN_ZOOM = 0.1;
const DASHBOARD_MAX_ZOOM = 2;

// --- Types ---

export interface SpaceMove {
  spaceId: string;
  parentId: string | null;
  /** Absent = communauté inchangée ; null = sans communauté (indépendant). */
  communityId?: string | null;
}

interface CommunityGroup {
  communityId: string;
  communityName: string;
  spaces: SpaceWithRole[];
}

interface DashboardMindMapViewProps {
  communityGroups: CommunityGroup[];
  personalSpaces: SpaceWithRole[];
  independentSpaces: SpaceWithRole[];
  onMoveSpace?: (move: SpaceMove) => Promise<void>;
  resetRef?: React.MutableRefObject<(() => void) | null>;
}

interface TreeDatum {
  [key: string]: unknown;
  id: string;
  name: string;
  type: 'central' | 'community' | 'personal-group' | 'independent-group' | 'space';
  entityId?: string;
  avatarUrl?: string;
  itemCount?: number;
  memberCount?: number;
  spaceCount?: number;
  children: TreeDatum[];
}

// --- Color helpers (matching MindMapView style) ---

// Color palette for community/group nodes
const NODE_COLORS: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
  'community': { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', iconColor: '#ef4444' },
  'personal-group': { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', iconColor: '#a855f7' },
  'independent-group': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', iconColor: '#f59e0b' },
  'space': { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', iconColor: '#3b82f6' },
};

// Handle style class (matching MindMapView purple handles)
const HANDLE_CLASS = '!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform';

// --- Layout ---

const RADIAL_STEP = 350;

function buildTreeData(
  communityGroups: CommunityGroup[],
  personalSpaces: SpaceWithRole[],
  independentSpaces: SpaceWithRole[],
): TreeDatum {
  const root: TreeDatum = {
    id: 'root',
    name: 'SPOK',
    type: 'central',
    children: [],
  };

  // Personal spaces group
  if (personalSpaces.length > 0) {
    const personalGroup: TreeDatum = {
      id: 'personal',
      name: 'Espaces personnels',
      type: 'personal-group',
      spaceCount: personalSpaces.length,
      children: personalSpaces.map(s => ({
        id: `space-${s.id}`,
        name: s.name,
        type: 'space' as const,
        entityId: s.id,
        avatarUrl: s.avatarUrl ?? undefined,
        itemCount: s.itemCount || 0,
        children: [],
      })),
    };
    root.children.push(personalGroup);
  }

  // Community groups
  for (const group of communityGroups) {
    const spaceMap = new Map<string, TreeDatum>();
    const rootSpaces: TreeDatum[] = [];

    for (const s of group.spaces) {
      spaceMap.set(s.id, {
        id: `space-${s.id}`,
        name: s.name,
        type: 'space',
        entityId: s.id,
        avatarUrl: s.avatarUrl ?? undefined,
        itemCount: s.itemCount || 0,
        memberCount: s.memberCount || 0,
        children: [],
      });
    }

    for (const s of group.spaces) {
      const node = spaceMap.get(s.id)!;
      if (s.parentId && spaceMap.has(s.parentId)) {
        spaceMap.get(s.parentId)!.children.push(node);
      } else {
        rootSpaces.push(node);
      }
    }

    const communityNode: TreeDatum = {
      id: `community-${group.communityId}`,
      name: group.communityName,
      type: 'community',
      entityId: group.communityId,
      avatarUrl: group.spaces[0]?.community?.avatarUrl ?? undefined,
      spaceCount: group.spaces.length,
      children: rootSpaces,
    };
    root.children.push(communityNode);
  }

  // Independent spaces group
  if (independentSpaces.length > 0) {
    const spaceMap = new Map<string, TreeDatum>();
    const rootSpaces: TreeDatum[] = [];

    for (const s of independentSpaces) {
      spaceMap.set(s.id, {
        id: `space-${s.id}`,
        name: s.name,
        type: 'space',
        entityId: s.id,
        avatarUrl: s.avatarUrl ?? undefined,
        itemCount: s.itemCount || 0,
        memberCount: s.memberCount || 0,
        children: [],
      });
    }

    for (const s of independentSpaces) {
      const node = spaceMap.get(s.id)!;
      if (s.parentId && spaceMap.has(s.parentId)) {
        spaceMap.get(s.parentId)!.children.push(node);
      } else {
        rootSpaces.push(node);
      }
    }

    const independentGroup: TreeDatum = {
      id: 'independent',
      name: 'Espaces indépendants',
      type: 'independent-group',
      spaceCount: independentSpaces.length,
      children: rootSpaces,
    };
    root.children.push(independentGroup);
  }

  return root;
}

function computeLayout(
  treeData: TreeDatum,
  savedPositions?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  if (treeData.children.length === 0) {
    return {
      nodes: [{
        id: treeData.id,
        type: 'central',
        position: { x: -70, y: -25 },
        data: treeData,
      }],
      edges: [],
    };
  }

  const root = hierarchy(treeData);
  const maxDepth = root.height;
  const leafCount = root.leaves().length;
  const maxRadius = Math.max(400, maxDepth * RADIAL_STEP, leafCount * 40);

  const layout = d3Tree<TreeDatum>()
    .size([2 * Math.PI, maxRadius])
    .separation((a, b) => {
      const base = a.parent === b.parent ? 2 : 3;
      // Increase separation for nodes with children to avoid overlap
      const aSize = (a.data.children?.length || 0) > 0 ? 1.5 : 1;
      const bSize = (b.data.children?.length || 0) > 0 ? 1.5 : 1;
      return (base * Math.max(aSize, bSize)) / Math.max(1, a.depth * 0.7);
    });

  layout(root);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodePositionMap = new Map<string, { x: number; y: number }>();

  root.each((d3Node) => {
    const datum = d3Node.data;
    let x: number, y: number;

    // Use saved position if available
    const saved = savedPositions?.[datum.id];
    if (saved) {
      x = saved.x;
      y = saved.y;
    } else if (d3Node.depth === 0) {
      x = 0;
      y = 0;
    } else {
      const angle = (d3Node.x ?? 0) - Math.PI / 2;
      const radius = d3Node.y ?? 0;
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
    }

    nodePositionMap.set(datum.id, { x, y });

    // Node dimensions
    const nodeWidth = datum.type === 'central' ? 140 : 150;
    const nodeHeight = datum.type === 'central' ? 50 : 40;

    nodes.push({
      id: datum.id,
      type: datum.type === 'central' ? 'central'
        : datum.type === 'community' || datum.type === 'personal-group' || datum.type === 'independent-group' ? 'community'
        : 'space',
      position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 },
      data: datum,
    });

    // Edge to parent
    if (d3Node.parent) {
      const parentDatum = d3Node.parent.data;
      const parentPos = nodePositionMap.get(parentDatum.id) || { x: 0, y: 0 };
      const childPos = { x, y };
      const { sourceHandle, targetHandle } = getBestHandles(parentPos, childPos);

      const isFromCenter = parentDatum.type === 'central';

      edges.push({
        id: `edge-${parentDatum.id}-${datum.id}`,
        source: parentDatum.id,
        target: datum.id,
        sourceHandle,
        targetHandle,
        style: {
          stroke: isFromCenter ? 'hsl(var(--primary))' : '#94a3b8',
          strokeWidth: 2,
        },
        type: 'default',
      });
    }
  });

  return { nodes, edges };
}

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

// --- Custom Nodes (MindMapView style) ---

function CentralNode({ data }: { data: TreeDatum }) {
  return (
    <div className="px-6 py-3 rounded-xl shadow-lg border-3 border-primary bg-primary/10 min-w-[140px] cursor-default transition-all">
      {/* Handles */}
      <Handle type="source" position={Position.Top} id="top-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Left} id="left-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="right-source" className={HANDLE_CLASS} />

      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-primary flex-shrink-0" />
        <span className="text-base font-bold text-primary">{data.name}</span>
      </div>
    </div>
  );
}

type DropState = 'valid' | 'invalid' | undefined;

/** Retour visuel d'une cible de dépôt : vert qui pulse (dépôt possible) ou rouge (refusé). */
const DROP_STYLES = {
  valid: { className: 'ring-4 ring-green-400 !border-green-500 scale-110', bg: '#dcfce7', border: '#22c55e', ping: 'ring-green-400' },
  invalid: { className: 'ring-4 ring-red-400 !border-red-500', bg: '#fee2e2', border: '#ef4444', ping: '' },
} as const;

function DropPing({ state }: { state: DropState }) {
  if (state !== 'valid') return null;
  return <span aria-hidden className={`absolute inset-0 rounded-lg ring-4 ${DROP_STYLES.valid.ping} animate-ping pointer-events-none`} />;
}

function CommunityNode({ data, dragging }: { data: TreeDatum & { dropState?: DropState }; dragging?: boolean }) {
  const nodeType = data.type as string;
  const isCommunity = nodeType === 'community';
  const isPersonal = nodeType === 'personal-group';
  const Icon = isCommunity ? Building2 : isPersonal ? User : Users;
  const colors = NODE_COLORS[nodeType] || NODE_COLORS['community'];
  const drop = data.dropState ? DROP_STYLES[data.dropState] : null;

  return (
    <div data-tour="global-mindmap-community"
      className={`relative px-4 py-2.5 rounded-lg shadow-md border-2 min-w-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        drop?.className ?? ''} ${dragging ? 'opacity-50' : ''}`}
      style={{ backgroundColor: drop?.bg ?? colors.bg, borderColor: drop?.border ?? colors.border }}
    >
      <DropPing state={data.dropState} />
      {/* Handles on all sides */}
      <Handle type="target" position={Position.Top} id="top" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Left} id="left" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Right} id="right" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Top} id="top-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Left} id="left-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="right-source" className={HANDLE_CLASS} />

      <div className="flex items-center gap-2">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
        ) : (
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: colors.iconColor }} />
        )}
        <span className="font-semibold text-sm whitespace-nowrap" style={{ color: colors.text }}>
          {data.name}
        </span>
      </div>
      {data.spaceCount !== undefined && (
        <div className="text-xs mt-0.5 opacity-70" style={{ color: colors.text }}>
          {data.spaceCount} espace{(data.spaceCount || 0) > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function SpaceNode({ data, dragging }: { data: TreeDatum & { dropState?: DropState }; dragging?: boolean }) {
  const colors = NODE_COLORS['space'];
  const hasChildren = (data.children as TreeDatum[])?.length > 0;
  const drop = data.dropState ? DROP_STYLES[data.dropState] : null;

  return (
    <div data-tour="global-mindmap-space"
      className={`relative px-4 py-2 rounded-lg shadow-md border-2 min-w-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        drop?.className ?? ''} ${dragging ? 'opacity-50' : ''}`}
      style={{ backgroundColor: drop?.bg ?? colors.bg, borderColor: drop?.border ?? colors.border }}
    >
      <DropPing state={data.dropState} />
      {/* Handles on all sides */}
      <Handle type="target" position={Position.Top} id="top" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Left} id="left" className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Right} id="right" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Top} id="top-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Left} id="left-source" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="right-source" className={HANDLE_CLASS} />

      <div className="flex items-center gap-2">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
        ) : (
          <FolderKanban className="w-4 h-4 flex-shrink-0" style={{ color: colors.iconColor }} />
        )}
        <span className="font-medium text-sm whitespace-nowrap" style={{ color: colors.text }}>
          {data.name}
        </span>

        {/* Badge showing child count */}
        {hasChildren && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
            {(data.children as TreeDatum[]).length}
          </span>
        )}
      </div>
      {data.itemCount !== undefined && (data.itemCount as number) > 0 && (
        <div className="text-xs mt-0.5 opacity-70" style={{ color: colors.text }}>
          {data.itemCount} élément{(data.itemCount as number) > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  central: CentralNode,
  community: CommunityNode,
  space: SpaceNode,
};

// --- MiniMap color helper ---

function getMiniMapNodeColor(node: Node): string {
  const data = node.data as unknown as TreeDatum;
  if (!data?.type) return '#f3f4f6';
  const colors = NODE_COLORS[data.type];
  return colors?.bg || '#f3f4f6';
}

// --- Helpers for drag with children ---

function collectDescendantIds(datum: TreeDatum): string[] {
  const ids: string[] = [];
  for (const child of datum.children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

function findTreeDatum(datum: TreeDatum, id: string): TreeDatum | null {
  if (datum.id === id) return datum;
  for (const child of datum.children) {
    const found = findTreeDatum(child, id);
    if (found) return found;
  }
  return null;
}

// --- Position persistence ---

const POSITIONS_STORAGE_KEY = 'dashboard-mindmap-positions';

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const stored = localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

// --- Main Component ---

function DashboardMindMapInner({
  communityGroups,
  personalSpaces,
  independentSpaces,
  onMoveSpace,
  resetRef,
}: DashboardMindMapViewProps) {
  const navigate = useNavigate();
  const { getIntersectingNodes, getNodes, fitView, screenToFlowPosition } = useReactFlow();
  // Cible survolée pendant le glisser d'un espace : résultat du dépôt + position du curseur (étiquette)
  const [drop, setDrop] = useState<{ targetId: string; result: SpaceDropResult; x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useTrackpadPinchZoom(wrapperRef, DASHBOARD_MIN_ZOOM, DASHBOARD_MAX_ZOOM);
  const dragDescendants = useRef<{ ids: string[]; offsets: Map<string, { dx: number; dy: number }> } | null>(null);
  const savedPositions = useRef<Record<string, { x: number; y: number }>>(loadSavedPositions());

  const savePositions = useCallback(() => {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(savedPositions.current));
  }, []);

  const treeData = useMemo(() => {
    return buildTreeData(communityGroups, personalSpaces, independentSpaces);
  }, [communityGroups, personalSpaces, independentSpaces]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = computeLayout(treeData, savedPositions.current);
    return { initialNodes: nodes, initialEdges: edges };
  }, [treeData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when data changes (tree structure changed, e.g. after reparent)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Marque la cible de dépôt dans data pour que le nœud affiche son retour (vert / rouge)
  const dropTargetId = drop?.targetId ?? null;
  const dropKind: DropState = drop ? (drop.result.kind === 'move' ? 'valid' : 'invalid') : undefined;
  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const data = n.data as unknown as TreeDatum;
      const state = n.id === dropTargetId ? dropKind : undefined;
      if (data.dropState !== state) {
        return { ...n, data: { ...n.data, dropState: state } };
      }
      return n;
    }));
  }, [dropTargetId, dropKind, setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as TreeDatum;
    if (data.type === 'space' && data.entityId) {
      navigate(`/spaces/${data.entityId}`);
    } else if (data.type === 'community' && data.entityId) {
      navigate(`/communities/${data.entityId}`);
    }
  }, [navigate]);

  // Cible de dépôt sous le nœud glissé (hors ses propres descendants, qui le suivent) et ce que ferait le dépôt.
  // Plusieurs nœuds peuvent chevaucher le nœud glissé : on retient celui sous le curseur, sinon le plus recouvert.
  const findDrop = useCallback((draggedNode: Node, event: React.MouseEvent): { targetId: string; result: SpaceDropResult } | null => {
    const descendantIds = dragDescendants.current?.ids || [];
    const pointer = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const dw = draggedNode.measured?.width ?? 150;
    const dh = draggedNode.measured?.height ?? 40;
    const rank = (n: Node) => {
      const w = n.measured?.width ?? 150;
      const h = n.measured?.height ?? 40;
      const { x, y } = n.position;
      const underPointer = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
      const ox = Math.max(0, Math.min(x + w, draggedNode.position.x + dw) - Math.max(x, draggedNode.position.x));
      const oy = Math.max(0, Math.min(y + h, draggedNode.position.y + dh) - Math.max(y, draggedNode.position.y));
      return (underPointer ? 1e9 : 0) + ox * oy;
    };
    const candidates = getIntersectingNodes(draggedNode)
      .filter(n => {
        if (n.id === draggedNode.id || descendantIds.includes(n.id)) return false;
        const d = n.data as unknown as TreeDatum;
        return d.type === 'space' || d.type === 'community' || d.type === 'personal-group' || d.type === 'independent-group';
      })
      .sort((a, b) => rank(b) - rank(a));
    const target = candidates[0];
    if (!target) return null;
    const result = resolveSpaceDrop(treeData, draggedNode.id, target.id);
    return result ? { targetId: target.id, result } : null;
  }, [getIntersectingNodes, screenToFlowPosition, treeData]);

  // Drag start: capture descendant offsets for drag-with-children
  const onNodeDragStart = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;
    // Allow dragging spaces, communities, and group nodes with their children
    if (data.type === 'central') {
      dragDescendants.current = null;
      return;
    }

    const treeDatum = findTreeDatum(treeData, draggedNode.id);
    if (!treeDatum || treeDatum.children.length === 0) {
      dragDescendants.current = null;
      return;
    }

    const descendantIds = collectDescendantIds(treeDatum);
    if (descendantIds.length === 0) {
      dragDescendants.current = null;
      return;
    }

    const currentNodes = getNodes();
    const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
    const draggedPos = nodeMap.get(draggedNode.id)?.position;
    if (!draggedPos) {
      dragDescendants.current = null;
      return;
    }

    const offsets = new Map<string, { dx: number; dy: number }>();
    for (const id of descendantIds) {
      const n = nodeMap.get(id);
      if (n) {
        offsets.set(id, { dx: n.position.x - draggedPos.x, dy: n.position.y - draggedPos.y });
      }
    }

    dragDescendants.current = { ids: descendantIds, offsets };
  }, [treeData, getNodes]);

  // Drag: move descendants + highlight drop target
  const onNodeDrag = useCallback((event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;
    if (data.type === 'central') return;

    // Move descendants along with dragged node
    if (dragDescendants.current && dragDescendants.current.offsets.size > 0) {
      const { offsets } = dragDescendants.current;
      setNodes(prevNodes => prevNodes.map(n => {
        const offset = offsets.get(n.id);
        if (!offset) return n;
        return {
          ...n,
          position: {
            x: draggedNode.position.x + offset.dx,
            y: draggedNode.position.y + offset.dy,
          },
        };
      }));
    }

    // Retour de survol : seuls les espaces se déposent (communautés et groupes se repositionnent)
    if (data.type === 'space') {
      const found = findDrop(draggedNode, event);
      if (!found) { setDrop(null); return; }
      const box = wrapperRef.current?.getBoundingClientRect();
      setDrop({ ...found, x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) });
    }
  }, [findDrop, setNodes]);

  // Drag stop: reparent if dropped on target, otherwise save position
  const onNodeDragStop = useCallback((event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;

    // For non-space nodes (community, group), just save positions
    if (data.type !== 'space') {
      // Save dragged node position (center of node)
      savedPositions.current[draggedNode.id] = {
        x: draggedNode.position.x + 75,
        y: draggedNode.position.y + 20,
      };
      // Save descendant positions
      if (dragDescendants.current) {
        const currentNodes = getNodes();
        const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
        for (const id of dragDescendants.current.ids) {
          const n = nodeMap.get(id);
          if (n) {
            const w = (n.data as unknown as TreeDatum).type === 'central' ? 140 : 150;
            const h = (n.data as unknown as TreeDatum).type === 'central' ? 50 : 40;
            savedPositions.current[id] = { x: n.position.x + w / 2, y: n.position.y + h / 2 };
          }
        }
      }
      savePositions();
      dragDescendants.current = null;
      setDrop(null);
      return;
    }

    // Espace : dépôt sur une cible ?
    const found = findDrop(draggedNode, event);
    const movedIds = [draggedNode.id, ...(dragDescendants.current?.ids || [])];

    if (found?.result.kind === 'invalid') {
      // Dépôt refusé : retour à la place d'avant le glisser
      setNodes(initialNodes);
    } else if (found?.result.kind === 'move' && onMoveSpace) {
      const { spaceId, parentId, communityId } = found.result;
      // Le nouvel emplacement sera recalculé par le layout : oublier les positions enregistrées de la branche
      for (const id of movedIds) delete savedPositions.current[id];
      savePositions();
      onMoveSpace({ spaceId, parentId, ...(communityId !== undefined ? { communityId } : {}) })
        .catch(() => setNodes(initialNodes)); // échec : la carte revient à l'état de la base
    } else {
      // No reparenting — save positions for dragged node + descendants
      savedPositions.current[draggedNode.id] = {
        x: draggedNode.position.x + 75,
        y: draggedNode.position.y + 20,
      };
      if (dragDescendants.current) {
        const currentNodes = getNodes();
        const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
        for (const id of dragDescendants.current.ids) {
          const n = nodeMap.get(id);
          if (n) {
            savedPositions.current[id] = { x: n.position.x + 75, y: n.position.y + 20 };
          }
        }
      }
      savePositions();
    }

    dragDescendants.current = null;
    setDrop(null);
  }, [findDrop, getNodes, onMoveSpace, savePositions, setNodes, initialNodes]);

  // Reset layout: clear saved positions and recalculate
  const resetLayout = useCallback(() => {
    savedPositions.current = {};
    localStorage.removeItem(POSITIONS_STORAGE_KEY);
    const { nodes: newNodes, edges: newEdges } = computeLayout(treeData);
    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [treeData, setNodes, setEdges, fitView]);

  useEffect(() => {
    if (resetRef) resetRef.current = resetLayout;
    return () => { if (resetRef) resetRef.current = null; };
  }, [resetRef, resetLayout]);

  return (
    <div ref={wrapperRef} className="relative flex-1 min-h-0 w-full h-full">
    {drop && (
      <div
        role="status"
        className={`absolute z-20 pointer-events-none px-2 py-1 rounded-md text-xs font-medium shadow-md whitespace-nowrap ${
          drop.result.kind === 'move' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
        style={{ left: drop.x + 14, top: drop.y + 14 }}
      >
        {drop.result.label}
      </div>
    )}
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={DASHBOARD_MIN_ZOOM}
      maxZoom={DASHBOARD_MAX_ZOOM}
      connectOnClick={false}
      defaultEdgeOptions={{
        type: 'default',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }}
    >
      <Background color="#e2e8f0" gap={20} />
      <Controls className="hidden sm:flex" position="bottom-right" showInteractive={false} />
      <MiniMap
        className="hidden md:block"
        nodeColor={getMiniMapNodeColor}
        maskColor="rgba(0, 0, 0, 0.1)"
      />
      {/* Reset layout button */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 hover:bg-white border border-border rounded-md shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Réinitialiser la disposition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      </div>
    </ReactFlow>
    </div>
  );
}

export function DashboardMindMapView(props: DashboardMindMapViewProps) {
  return (
    <ReactFlowProvider>
      <DashboardMindMapInner {...props} />
    </ReactFlowProvider>
  );
}
