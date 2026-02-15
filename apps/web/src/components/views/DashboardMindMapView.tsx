import { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
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
}

interface TreeDatum {
  [key: string]: unknown;
  id: string;
  name: string;
  type: 'central' | 'community' | 'personal-group' | 'independent-group' | 'space';
  entityId?: string; // communityId or spaceId for navigation
  avatarUrl?: string;
  itemCount?: number;
  memberCount?: number;
  spaceCount?: number;
  children: TreeDatum[];
}

// --- Layout ---

const RADIAL_STEP = 280;

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

    // Build space nodes
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

    // Build hierarchy
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
        position: { x: 0, y: 0 },
        data: treeData,
      }],
      edges: [],
    };
  }

  const root = hierarchy(treeData);
  const maxDepth = root.height;
  const maxRadius = maxDepth * RADIAL_STEP;

  const layout = d3Tree<TreeDatum>()
    .size([2 * Math.PI, maxRadius])
    .separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5) / Math.max(1, a.depth * 0.8));

  layout(root);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

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

    // Node dimensions vary by type
    const nodeWidth = datum.type === 'central' ? 120 : datum.type === 'community' || datum.type === 'personal-group' || datum.type === 'independent-group' ? 180 : 160;
    const nodeHeight = datum.type === 'central' ? 60 : 50;

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
      const parentPos = d3Node.parent.depth === 0
        ? { x: 0, y: 0 }
        : {
          x: ((d3Node.parent.y ?? 0) * Math.cos((d3Node.parent.x ?? 0) - Math.PI / 2)),
          y: ((d3Node.parent.y ?? 0) * Math.sin((d3Node.parent.x ?? 0) - Math.PI / 2)),
        };
      const childPos = { x, y };

      const { sourceHandle, targetHandle } = getBestHandles(parentPos, childPos);

      const isGroupEdge = parentDatum.type === 'central' || parentDatum.type === 'community' || parentDatum.type === 'personal-group' || parentDatum.type === 'independent-group';

      edges.push({
        id: `edge-${parentDatum.id}-${datum.id}`,
        source: parentDatum.id,
        target: datum.id,
        sourceHandle,
        targetHandle,
        style: {
          stroke: isGroupEdge ? '#ef4444' : '#3b82f6',
          strokeWidth: isGroupEdge ? 2 : 1.5,
        },
        type: 'smoothstep',
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

// --- Custom Nodes ---

function CentralNode({ data }: { data: TreeDatum }) {
  return (
    <div className="px-5 py-3 bg-slate-800 text-white rounded-xl shadow-lg border-2 border-slate-600 flex items-center gap-2 font-bold text-base">
      <Globe className="w-5 h-5" />
      {data.name}
      <Handle type="source" position={Position.Top} id="top-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-1 !h-1 !bg-transparent !border-0" />
    </div>
  );
}

function CommunityNode({ data }: { data: TreeDatum }) {
  const isCommunity = data.type === 'community';
  const isPersonal = data.type === 'personal-group';
  const Icon = isCommunity ? Building2 : isPersonal ? User : Users;
  const bgClass = isCommunity ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800'
    : isPersonal ? 'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-800'
    : 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800';

  return (
    <div className={`px-4 py-2.5 rounded-lg shadow-md border-2 ${bgClass} cursor-pointer transition-shadow hover:shadow-lg`}>
      <div className="flex items-center gap-2">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
        ) : (
          <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm truncate max-w-[140px]">{data.name}</span>
      </div>
      {data.spaceCount !== undefined && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {data.spaceCount} espace{(data.spaceCount || 0) > 1 ? 's' : ''}
        </div>
      )}
      <Handle type="target" position={Position.Top} id="top" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} id="left" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Right} id="right" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-1 !h-1 !bg-transparent !border-0" />
    </div>
  );
}

function SpaceNode({ data }: { data: TreeDatum }) {
  return (
    <div className="px-3 py-2 rounded-lg shadow border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 cursor-pointer transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
        ) : (
          <FolderKanban className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
        )}
        <span className="font-medium text-xs truncate max-w-[120px]">{data.name}</span>
      </div>
      {data.itemCount !== undefined && data.itemCount > 0 && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {data.itemCount} élément{data.itemCount > 1 ? 's' : ''}
        </div>
      )}
      <Handle type="target" position={Position.Top} id="top" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} id="left" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="target" position={Position.Right} id="right" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-1 !h-1 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-1 !h-1 !bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = {
  central: CentralNode,
  community: CommunityNode,
  space: SpaceNode,
};

// --- Main Component ---

function DashboardMindMapInner({
  communityGroups,
  personalSpaces,
  independentSpaces,
}: DashboardMindMapViewProps) {
  const navigate = useNavigate();

  const { initialNodes, initialEdges } = useMemo(() => {
    const treeData = buildTreeData(communityGroups, personalSpaces, independentSpaces);
    const { nodes, edges } = computeLayout(treeData);
    return { initialNodes: nodes, initialEdges: edges };
  }, [communityGroups, personalSpaces, independentSpaces]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as TreeDatum;
    if (data.type === 'space' && data.entityId) {
      navigate(`/spaces/${data.entityId}`);
    } else if (data.type === 'community' && data.entityId) {
      navigate(`/communities/${data.entityId}/settings`);
    }
  }, [navigate]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
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
