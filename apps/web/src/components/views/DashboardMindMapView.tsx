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
import { Building2, FolderKanban, User, Globe, Users } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';

// --- Types ---

interface CommunityGroup {
  communityId: string;
  communityName: string;
  spaces: SpaceWithRole[];
}

interface DashboardMindMapViewProps {
  communityGroups: CommunityGroup[];
  personalSpaces: SpaceWithRole[];
  independentSpaces: SpaceWithRole[];
  onMoveSpace?: (spaceId: string, newParentId: string) => void;
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

const RADIAL_STEP = 300;

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

function computeLayout(treeData: TreeDatum): { nodes: Node[]; edges: Edge[] } {
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
  const maxRadius = Math.max(300, maxDepth * RADIAL_STEP);

  const layout = d3Tree<TreeDatum>()
    .size([2 * Math.PI, maxRadius])
    .separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5) / Math.max(1, a.depth * 0.8));

  layout(root);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodePositionMap = new Map<string, { x: number; y: number }>();

  root.each((d3Node) => {
    const datum = d3Node.data;
    let x: number, y: number;

    if (d3Node.depth === 0) {
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

function CommunityNode({ data }: { data: TreeDatum }) {
  const nodeType = data.type as string;
  const isCommunity = nodeType === 'community';
  const isPersonal = nodeType === 'personal-group';
  const Icon = isCommunity ? Building2 : isPersonal ? User : Users;
  const colors = NODE_COLORS[nodeType] || NODE_COLORS['community'];

  return (
    <div
      className="px-4 py-2.5 rounded-lg shadow-md border-2 min-w-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
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

function SpaceNode({ data }: { data: TreeDatum & { isDropTarget?: boolean } }) {
  const colors = NODE_COLORS['space'];
  const hasChildren = (data.children as TreeDatum[])?.length > 0;
  const isDropTarget = data.isDropTarget as boolean;

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border-2 min-w-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isDropTarget ? 'ring-4 ring-green-400 !border-green-500 scale-110' : ''
      }`}
      style={{ backgroundColor: isDropTarget ? '#dcfce7' : colors.bg, borderColor: isDropTarget ? '#22c55e' : colors.border }}
    >
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

// Check if targetId is a descendant of sourceId in the tree
function isDescendantOf(treeData: TreeDatum, sourceId: string, targetId: string): boolean {
  const sourceNode = findTreeDatum(treeData, sourceId);
  if (!sourceNode) return false;
  const descendants = collectDescendantIds(sourceNode);
  return descendants.includes(targetId);
}

// --- Main Component ---

function DashboardMindMapInner({
  communityGroups,
  personalSpaces,
  independentSpaces,
  onMoveSpace,
}: DashboardMindMapViewProps) {
  const navigate = useNavigate();
  const { getIntersectingNodes, getNodes } = useReactFlow();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragDescendants = useRef<{ ids: string[]; offsets: Map<string, { dx: number; dy: number }> } | null>(null);

  const { initialNodes, initialEdges, treeData } = useMemo(() => {
    const tree = buildTreeData(communityGroups, personalSpaces, independentSpaces);
    const { nodes, edges } = computeLayout(tree);
    return { initialNodes: nodes, initialEdges: edges, treeData: tree };
  }, [communityGroups, personalSpaces, independentSpaces]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Mark drop target node in data so SpaceNode can render highlight
  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const data = n.data as unknown as TreeDatum;
      const shouldHighlight = n.id === dropTargetId;
      if ((data.isDropTarget as boolean) !== shouldHighlight) {
        return { ...n, data: { ...n.data, isDropTarget: shouldHighlight } };
      }
      return n;
    }));
  }, [dropTargetId, setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as TreeDatum;
    if (data.type === 'space' && data.entityId) {
      navigate(`/spaces/${data.entityId}`);
    } else if (data.type === 'community' && data.entityId) {
      navigate(`/communities/${data.entityId}/settings`);
    }
  }, [navigate]);

  // Drag start: capture descendant offsets for drag-with-children
  const onNodeDragStart = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;
    if (data.type !== 'space') {
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
  const onNodeDrag = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;
    if (data.type !== 'space') return;

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

    // Highlight potential drop target (only space nodes)
    const intersecting = getIntersectingNodes(draggedNode);
    const descendantIds = dragDescendants.current?.ids || [];
    const target = intersecting.find(n => {
      if (n.id === draggedNode.id) return false;
      if (descendantIds.includes(n.id)) return false;
      const d = n.data as unknown as TreeDatum;
      return d.type === 'space';
    });
    setDropTargetId(target?.id || null);
  }, [getIntersectingNodes, setNodes]);

  // Drag stop: reparent space if dropped on another space
  const onNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    const data = draggedNode.data as unknown as TreeDatum;
    if (data.type !== 'space' || !onMoveSpace) {
      dragDescendants.current = null;
      setDropTargetId(null);
      return;
    }

    const intersecting = getIntersectingNodes(draggedNode);
    const descendantIds = dragDescendants.current?.ids || [];
    const target = intersecting.find(n => {
      if (n.id === draggedNode.id) return false;
      if (descendantIds.includes(n.id)) return false;
      const d = n.data as unknown as TreeDatum;
      return d.type === 'space';
    });

    if (target) {
      const targetData = target.data as unknown as TreeDatum;
      const draggedEntityId = data.entityId;
      const targetEntityId = targetData.entityId;

      // Prevent dropping on own descendant
      if (draggedEntityId && targetEntityId && !isDescendantOf(treeData, draggedNode.id, target.id)) {
        onMoveSpace(draggedEntityId, targetEntityId);
      }
    }

    dragDescendants.current = null;
    setDropTargetId(null);
  }, [getIntersectingNodes, onMoveSpace, treeData]);

  return (
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
      minZoom={0.1}
      maxZoom={2}
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
    </ReactFlow>
  );
}

export function DashboardMindMapView(props: DashboardMindMapViewProps) {
  return (
    <ReactFlowProvider>
      <DashboardMindMapInner {...props} />
    </ReactFlowProvider>
  );
}
