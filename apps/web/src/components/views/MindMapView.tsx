import { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Item, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS } from '../../constants/ui';
import { Plus, Edit2 } from 'lucide-react';

interface MindMapViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
}

// Get status color from referentiels
function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
  if (!status) {
    const undefinedStatus = statuses.find(s => s.id === 'undefined');
    return undefinedStatus?.color || 'bg-slate-100';
  }
  const statusConfig = statuses.find(s => s.id === status);
  if (!statusConfig) return 'bg-gray-100';
  // Extract just the bg color class
  const colorMatch = statusConfig.color.match(/bg-[a-z]+-\d+/);
  return colorMatch ? colorMatch[0] : 'bg-gray-100';
}

// Convert Tailwind bg class to hex color for ReactFlow
function tailwindBgToHex(bgClass: string): string {
  const colorMap: Record<string, string> = {
    'bg-slate-100': '#f1f5f9',
    'bg-slate-200': '#e2e8f0',
    'bg-gray-100': '#f3f4f6',
    'bg-gray-200': '#e5e7eb',
    'bg-blue-100': '#dbeafe',
    'bg-blue-200': '#bfdbfe',
    'bg-blue-500': '#3b82f6',
    'bg-green-100': '#dcfce7',
    'bg-green-200': '#bbf7d0',
    'bg-green-500': '#22c55e',
    'bg-yellow-100': '#fef9c3',
    'bg-yellow-200': '#fef08a',
    'bg-yellow-500': '#eab308',
    'bg-orange-100': '#ffedd5',
    'bg-orange-200': '#fed7aa',
    'bg-orange-500': '#f97316',
    'bg-red-100': '#fee2e2',
    'bg-red-200': '#fecaca',
    'bg-red-500': '#ef4444',
    'bg-purple-100': '#f3e8ff',
    'bg-purple-200': '#e9d5ff',
    'bg-purple-500': '#a855f7',
    'bg-pink-100': '#fce7f3',
    'bg-pink-200': '#fbcfe8',
    'bg-indigo-100': '#e0e7ff',
    'bg-indigo-200': '#c7d2fe',
    'bg-teal-100': '#ccfbf1',
    'bg-teal-200': '#99f6e4',
    'bg-cyan-100': '#cffafe',
    'bg-cyan-200': '#a5f3fc',
    'bg-emerald-100': '#d1fae5',
    'bg-emerald-200': '#a7f3d0',
    'bg-amber-100': '#fef3c7',
    'bg-amber-200': '#fde68a',
  };
  return colorMap[bgClass] || '#f3f4f6';
}

// Build tree structure
interface TreeItem extends Item {
  children: TreeItem[];
  depth: number;
}

function buildTree(items: Item[]): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const rootItems: TreeItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [], depth: 0 });
  });

  items.forEach(item => {
    const treeItem = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      parent.children.push(treeItem);
    } else {
      rootItems.push(treeItem);
    }
  });

  function setDepths(items: TreeItem[], depth: number) {
    items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    items.forEach(item => {
      item.depth = depth;
      setDepths(item.children, depth + 1);
    });
  }
  setDepths(rootItems, 0);

  return rootItems;
}

// Custom node component
interface MindMapNodeProps {
  data: {
    label: string;
    item: Item;
    statusColor: string;
    hexColor: string;
    onEdit: (id: string) => void;
    onAddChild: (id: string) => void;
    isRoot: boolean;
    hasChildren: boolean;
  };
}

function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, onEdit, onAddChild, isRoot, hasChildren } = data;
  const Icon = TYPE_ICONS[item.type];

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border-2 min-w-[120px] max-w-[250px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isRoot ? 'border-primary' : 'border-gray-300'
      }`}
      style={{ backgroundColor: hexColor }}
    >
      {/* Input handle - not for root nodes */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-gray-400 !w-2 !h-2"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{item.title}</span>
      </div>

      {/* Action buttons on hover */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item.id);
          }}
          className="p-1 bg-white rounded-full shadow-md hover:bg-blue-50"
          title="Modifier"
        >
          <Edit2 className="w-3 h-3 text-blue-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(item.id);
          }}
          className="p-1 bg-white rounded-full shadow-md hover:bg-green-50"
          title="Ajouter un enfant"
        >
          <Plus className="w-3 h-3 text-green-600" />
        </button>
      </div>

      {/* Output handle */}
      {hasChildren && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-gray-400 !w-2 !h-2"
        />
      )}
      {/* Always show source handle if not a leaf, or allow adding children */}
      {!hasChildren && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-gray-300 !w-2 !h-2 !opacity-0 group-hover:!opacity-100"
        />
      )}
    </div>
  );
}

const nodeTypes = {
  mindmap: MindMapNode,
};

// Layout constants
const HORIZONTAL_SPACING = 280;
const VERTICAL_SPACING = 80;

// Calculate node positions using a tree layout algorithm
function calculateLayout(
  tree: TreeItem[],
  statuses: StatusConfig[],
  onEdit: (id: string) => void,
  onAddChild: (id: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Track vertical position for each depth level
  const depthYPositions: Map<number, number> = new Map();

  function hasDescendants(item: TreeItem): boolean {
    return item.children.length > 0;
  }

  function processNode(
    item: TreeItem,
    depth: number,
    parentId: string | null
  ): { minY: number; maxY: number; centerY: number } {
    const statusColor = getStatusColor(item.status, statuses);
    const hexColor = tailwindBgToHex(statusColor);
    const x = depth * HORIZONTAL_SPACING;

    // If leaf node, place at next available Y position
    if (item.children.length === 0) {
      const currentY = depthYPositions.get(depth) || 0;
      const y = currentY;
      depthYPositions.set(depth, currentY + VERTICAL_SPACING);

      nodes.push({
        id: item.id,
        type: 'mindmap',
        position: { x, y },
        data: {
          label: item.title,
          item,
          statusColor,
          hexColor,
          onEdit,
          onAddChild,
          isRoot: depth === 0 && parentId === null,
          hasChildren: false,
        },
      });

      if (parentId) {
        edges.push({
          id: `${parentId}-${item.id}`,
          source: parentId,
          target: item.id,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        });
      }

      return { minY: y, maxY: y, centerY: y };
    }

    // Process children first
    const childResults = item.children.map(child =>
      processNode(child, depth + 1, item.id)
    );

    const minY = Math.min(...childResults.map(r => r.minY));
    const maxY = Math.max(...childResults.map(r => r.maxY));
    const centerY = (minY + maxY) / 2;

    // Update depth position if needed
    const currentDepthY = depthYPositions.get(depth) || 0;
    if (maxY + VERTICAL_SPACING > currentDepthY) {
      depthYPositions.set(depth, maxY + VERTICAL_SPACING);
    }

    nodes.push({
      id: item.id,
      type: 'mindmap',
      position: { x, y: centerY },
      data: {
        label: item.title,
        item,
        statusColor,
        hexColor,
        onEdit,
        onAddChild,
        isRoot: depth === 0 && parentId === null,
        hasChildren: hasDescendants(item),
      },
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${item.id}`,
        source: parentId,
        target: item.id,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }

    return { minY, maxY, centerY };
  }

  // Process all root nodes
  tree.forEach(rootItem => {
    processNode(rootItem, 0, null);
  });

  return { nodes, edges };
}

export function MindMapView({
  items,
  onEdit,
  onDelete: _onDelete,
  onUpdateStatus: _onUpdateStatus,
  onAddChild,
  referentiels,
}: MindMapViewProps) {
  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const tree = useMemo(() => buildTree(items), [items]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = calculateLayout(tree, statuses, onEdit, onAddChild);
    return { initialNodes: nodes, initialEdges: edges };
  }, [tree, statuses, onEdit, onAddChild]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when items change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout(tree, statuses, onEdit, onAddChild);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, statuses, onEdit, onAddChild, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onEdit(node.id);
    },
    [onEdit]
  );

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p>Aucun élément</p>
          <p className="text-sm">Créez des éléments pour les voir dans la carte mentale</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            return node.data?.hexColor as string || '#f3f4f6';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
