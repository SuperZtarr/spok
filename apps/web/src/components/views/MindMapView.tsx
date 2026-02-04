import { useMemo, useCallback, useEffect, useState } from 'react';
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
  Handle,
  Position,
  Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ItemWithRelations, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS } from '../../constants/ui';
import { Plus, Edit2, ChevronRight, ChevronDown, FolderOpen, RotateCcw, ChevronsUpDown, ChevronsDownUp, Link2, X } from 'lucide-react';

interface MindMapViewProps {
  items: ItemWithRelations[];
  spaceName?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
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
interface TreeItem extends ItemWithRelations {
  children: TreeItem[];
  depth: number;
}

function buildTree(items: ItemWithRelations[]): TreeItem[] {
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

// Count all descendants
function countDescendants(item: TreeItem): number {
  let count = item.children.length;
  item.children.forEach(child => {
    count += countDescendants(child);
  });
  return count;
}

// Custom node component for radial layout
interface MindMapNodeProps {
  data: {
    label: string;
    item: Item;
    statusColor: string;
    hexColor: string;
    onEdit: (id: string) => void;
    onAddChild: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    isRoot: boolean;
    hasChildren: boolean;
    isCollapsed: boolean;
    childCount: number;
  };
}

function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, onEdit, onAddChild, onToggleCollapse, isRoot, hasChildren, isCollapsed, childCount } = data;
  const Icon = TYPE_ICONS[item.type];

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border-2 min-w-[100px] max-w-[200px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isRoot ? 'border-primary border-3' : 'border-gray-300'
      }`}
      style={{ backgroundColor: hexColor }}
    >
      {/* Handles on all sides for radial connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" id="right-source" />

      <div className="flex items-center gap-2">
        {/* Collapse/Expand button for nodes with children */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(item.id);
            }}
            className="p-0.5 hover:bg-black/10 rounded flex-shrink-0"
            title={isCollapsed ? 'Déplier' : 'Replier'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>
        ) : null}

        <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />

        <span className="text-sm font-medium truncate">{item.title}</span>

        {/* Badge showing child count when collapsed */}
        {isCollapsed && childCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded-full">
            {childCount}
          </span>
        )}
      </div>

      {/* Action buttons on hover */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
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
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(item.id);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-orange-50"
            title={isCollapsed ? `Déplier (${childCount})` : `Replier (${childCount})`}
          >
            {isCollapsed ? (
              <ChevronsUpDown className="w-3 h-3 text-orange-600" />
            ) : (
              <ChevronsDownUp className="w-3 h-3 text-orange-600" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Space node component (central node)
interface SpaceNodeProps {
  data: {
    label: string;
    spaceName: string;
    itemCount: number;
  };
}

function SpaceNode({ data }: SpaceNodeProps) {
  const { spaceName, itemCount } = data;

  return (
    <div
      className="px-6 py-3 rounded-xl shadow-lg border-3 border-primary bg-primary/10 min-w-[140px] cursor-default"
    >
      {/* Handles on all sides for radial connections */}
      <Handle type="source" position={Position.Top} className="!bg-primary !w-3 !h-3" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-primary !w-3 !h-3" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" id="right-source" />

      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-base font-bold text-primary">{spaceName}</span>
          <span className="text-xs text-muted-foreground">{itemCount} élément{itemCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  mindmap: MindMapNode,
  space: SpaceNode,
};

// Layout constants for radial layout
const BASE_RADIUS = 350; // Base radius for first level (root items around space node)
const RADIUS_INCREMENT = 300; // Additional radius per level (children around parent)
const MIN_ANGLE_SPREAD = Math.PI / 6; // Minimum angle between siblings (30 degrees)

// Calculate the angular size needed for a subtree
function calculateSubtreeSize(item: TreeItem, collapsedIds: Set<string>): number {
  if (item.children.length === 0 || collapsedIds.has(item.id)) {
    return MIN_ANGLE_SPREAD;
  }

  let totalSize = 0;
  item.children.forEach(child => {
    totalSize += calculateSubtreeSize(child, collapsedIds);
  });

  return Math.max(totalSize, MIN_ANGLE_SPREAD);
}

// Get the best handle position based on angle
function getHandleFromAngle(angle: number): string {
  // Normalize angle to 0-2PI
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  if (normalizedAngle >= Math.PI * 7/4 || normalizedAngle < Math.PI * 1/4) {
    return 'right';
  } else if (normalizedAngle >= Math.PI * 1/4 && normalizedAngle < Math.PI * 3/4) {
    return 'bottom';
  } else if (normalizedAngle >= Math.PI * 3/4 && normalizedAngle < Math.PI * 5/4) {
    return 'left';
  } else {
    return 'top';
  }
}

// Calculate node positions using radial/star layout
function calculateLayout(
  tree: TreeItem[],
  items: ItemWithRelations[],
  statuses: StatusConfig[],
  collapsedIds: Set<string>,
  spaceName: string,
  totalItemCount: number,
  onEdit: (id: string) => void,
  onAddChild: (id: string) => void,
  onToggleCollapse: (id: string) => void
): { nodes: Node[]; edges: Edge[]; relationEdges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const SPACE_NODE_ID = '__space__';

  function processNode(
    item: TreeItem,
    depth: number,
    parentId: string | null,
    centerX: number,
    centerY: number,
    startAngle: number,
    endAngle: number,
    parentAngle?: number
  ) {
    const statusColor = getStatusColor(item.status, statuses);
    const hexColor = tailwindBgToHex(statusColor);
    const hasChildren = item.children.length > 0;
    const isCollapsed = collapsedIds.has(item.id);
    const childCount = countDescendants(item);

    // Calculate position based on angle and radius
    // depth 1 = root items (around space node), depth 2+ = children
    let x: number, y: number;

    if (depth === 1) {
      // Root items are placed at centerX, centerY (already calculated by caller)
      x = centerX;
      y = centerY;
    } else {
      // Children are placed around their parent
      const radius = RADIUS_INCREMENT;
      const angle = (startAngle + endAngle) / 2;
      x = centerX + Math.cos(angle) * radius;
      y = centerY + Math.sin(angle) * radius;
    }

    nodes.push({
      id: item.id,
      type: 'mindmap',
      position: { x: x - 75, y: y - 20 }, // Center the node (approximate node size)
      data: {
        label: item.title,
        item,
        statusColor,
        hexColor,
        onEdit,
        onAddChild,
        onToggleCollapse,
        isRoot: depth === 0,
        hasChildren,
        isCollapsed,
        childCount,
      },
    });

    // Add edge from parent
    if (parentId && parentAngle !== undefined) {
      const childAngle = (startAngle + endAngle) / 2;
      const sourceHandle = getHandleFromAngle(childAngle) + '-source';
      const targetHandle = getHandleFromAngle(childAngle + Math.PI); // Opposite side

      edges.push({
        id: `${parentId}-${item.id}`,
        source: parentId,
        target: item.id,
        sourceHandle,
        targetHandle,
        type: 'default',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }

    // Process children if not collapsed
    if (hasChildren && !isCollapsed) {
      const visibleChildren = item.children;
      const totalSubtreeSize = visibleChildren.reduce(
        (sum, child) => sum + calculateSubtreeSize(child, collapsedIds),
        0
      );

      let currentAngle = startAngle;
      const angleRange = endAngle - startAngle;

      visibleChildren.forEach(child => {
        const childSize = calculateSubtreeSize(child, collapsedIds);
        const childAngleSpan = (childSize / totalSubtreeSize) * angleRange;
        const childStartAngle = currentAngle;
        const childEndAngle = currentAngle + childAngleSpan;

        processNode(
          child,
          depth + 1,
          item.id,
          x,
          y,
          childStartAngle,
          childEndAngle,
          (startAngle + endAngle) / 2
        );

        currentAngle = childEndAngle;
      });
    }
  }

  // Add central space node
  nodes.push({
    id: SPACE_NODE_ID,
    type: 'space',
    position: { x: -70, y: -25 }, // Center the space node
    data: {
      label: spaceName,
      spaceName,
      itemCount: totalItemCount,
    },
  });

  // Process all root nodes around the space node
  if (tree.length > 0) {
    const totalSubtreeSize = tree.reduce(
      (sum, item) => sum + calculateSubtreeSize(item, collapsedIds),
      0
    );

    let currentAngle = -Math.PI / 2; // Start from top
    const angleRange = 2 * Math.PI;

    tree.forEach(rootItem => {
      const itemSize = calculateSubtreeSize(rootItem, collapsedIds);
      const itemAngleSpan = (itemSize / totalSubtreeSize) * angleRange;
      const startAngle = currentAngle;
      const endAngle = currentAngle + itemAngleSpan;
      const midAngle = (startAngle + endAngle) / 2;

      // Position root items around the space node
      const x = Math.cos(midAngle) * BASE_RADIUS;
      const y = Math.sin(midAngle) * BASE_RADIUS;

      // Add edge from space to root item
      const sourceHandle = getHandleFromAngle(midAngle) + '-source';
      const targetHandle = getHandleFromAngle(midAngle + Math.PI);

      edges.push({
        id: `${SPACE_NODE_ID}-${rootItem.id}`,
        source: SPACE_NODE_ID,
        target: rootItem.id,
        sourceHandle,
        targetHandle,
        type: 'default',
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      });

      processNode(rootItem, 1, SPACE_NODE_ID, x, y, startAngle, endAngle, midAngle);

      currentAngle = endAngle;
    });
  }

  // Create edges for relations (not parent-child)
  const relationEdges: Edge[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  items.forEach(item => {
    // Relations from this item
    item.relationsFrom?.forEach(relation => {
      // Only create edge if both nodes exist in the current view
      if (nodeIds.has(relation.fromItemId) && nodeIds.has(relation.toItemId)) {
        relationEdges.push({
          id: `relation-${relation.id}`,
          source: relation.fromItemId,
          target: relation.toItemId,
          type: 'default',
          animated: true,
          style: {
            stroke: '#8b5cf6',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#8b5cf6',
          },
          data: {
            relationId: relation.id,
            type: relation.type,
          },
          label: relation.type === 'relates' ? '' : relation.type,
          labelStyle: { fontSize: 10, fill: '#8b5cf6' },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
      }
    });
  });

  return { nodes, edges, relationEdges };
}

// Inner component that uses useReactFlow
function MindMapViewInner({
  items,
  spaceName = 'Espace',
  onEdit,
  onAddChild,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
}: Omit<MindMapViewProps, 'onDelete' | 'onUpdateStatus'>) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  const statuses = useMemo(() => {
    return referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  }, [referentiels]);

  const tree = useMemo(() => buildTree(items), [items]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse);
    return { initialNodes: nodes, initialEdges: [...edges, ...relationEdges] };
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when items or collapsed state change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse);
    setNodes(newNodes);
    setEdges([...newEdges, ...relationEdges]);
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse, setNodes, setEdges]);

  // Handle new connection (create relation)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== '__space__' && connection.target !== '__space__') {
        // Don't create relation if it's a parent-child relationship
        const sourceItem = items.find(i => i.id === connection.source);
        const targetItem = items.find(i => i.id === connection.target);
        if (sourceItem && targetItem && sourceItem.parentId !== connection.target && targetItem.parentId !== connection.source) {
          onCreateRelation?.(connection.source, connection.target, 'relates');
        }
      }
    },
    [items, onCreateRelation]
  );

  // Handle edge click (to delete relation)
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.id.startsWith('relation-') && edge.data?.relationId) {
        if (confirm('Supprimer cette relation ?')) {
          onDeleteRelation?.(edge.source, edge.data.relationId as string);
        }
      }
    },
    [onDeleteRelation]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Don't try to edit the space node
      if (node.id !== '__space__') {
        onEdit(node.id);
      }
    },
    [onEdit]
  );

  // Reset layout function
  const resetLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse);
    setNodes(newNodes);
    setEdges([...newEdges, ...relationEdges]);
    // Fit view after a small delay to ensure nodes are positioned
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse, setNodes, setEdges, fitView]);

  // Get all node IDs that have children
  const getParentIds = useCallback((items: TreeItem[]): Set<string> => {
    const parentIds = new Set<string>();
    function traverse(items: TreeItem[]) {
      items.forEach(item => {
        if (item.children.length > 0) {
          parentIds.add(item.id);
          traverse(item.children);
        }
      });
    }
    traverse(items);
    return parentIds;
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
    setTimeout(() => fitView({ padding: 0.3 }), 100);
  }, [fitView]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    const parentIds = getParentIds(tree);
    setCollapsedIds(parentIds);
    setTimeout(() => fitView({ padding: 0.3 }), 100);
  }, [tree, getParentIds, fitView]);

  const hasCollapsedNodes = collapsedIds.size > 0;

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
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
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            return node.data?.hexColor as string || '#f3f4f6';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={hasCollapsedNodes ? expandAll : collapseAll}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title={hasCollapsedNodes ? 'Tout étendre' : 'Tout replier'}
          >
            {hasCollapsedNodes ? (
              <>
                <ChevronsUpDown className="w-4 h-4" />
                <span className="text-sm">Étendre</span>
              </>
            ) : (
              <>
                <ChevronsDownUp className="w-4 h-4" />
                <span className="text-sm">Replier</span>
              </>
            )}
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Réorganiser les éléments"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Réorganiser</span>
          </button>
        </Panel>
        <Panel position="bottom-left" className="bg-white/90 border rounded-lg shadow-sm p-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-3 h-3 text-purple-500" />
            <span>Glissez depuis un point pour créer une relation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-purple-500" style={{ strokeDasharray: '5,5' }} />
            <span>Cliquez sur une relation pour la supprimer</span>
          </div>
        </Panel>
      </ReactFlow>
    </>
  );
}

export function MindMapView({
  items,
  spaceName = 'Espace',
  onEdit,
  onDelete: _onDelete,
  onUpdateStatus: _onUpdateStatus,
  onAddChild,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
}: MindMapViewProps) {
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
      <ReactFlowProvider>
        <MindMapViewInner
          items={items}
          spaceName={spaceName}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onCreateRelation={onCreateRelation}
          onDeleteRelation={onDeleteRelation}
          referentiels={referentiels}
        />
      </ReactFlowProvider>
    </div>
  );
}
