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
import type { ItemWithRelations, SpaceReferentiels, StatusConfig, SpaceWithRole } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS } from '../../constants/ui';
import { Plus, Edit2, ChevronRight, ChevronDown, FolderOpen, RotateCcw, ChevronsUpDown, ChevronsDownUp, Link2, ExternalLink, X, Ban, ArrowLeft, Copy, Cog, FlaskConical, type LucideIcon } from 'lucide-react';

interface MindMapViewProps {
  items: ItemWithRelations[];
  spaceName?: string;
  spaceId?: string;
  communitySpaces?: SpaceWithRole[];
  highlightType?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
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
    item: TreeItem;
    statusColor: string;
    hexColor: string;
    onEdit: (id: string) => void;
    onAddChild: (id: string) => void;
    onAddPortal: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    isRoot: boolean;
    hasChildren: boolean;
    isCollapsed: boolean;
    childCount: number;
    hasPortalSupport: boolean;
    isHighlighted: boolean;
    isDimmed: boolean;
    isDropTarget: boolean;
  };
}

function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, onEdit, onAddChild, onAddPortal, onToggleCollapse, isRoot, hasChildren, isCollapsed, childCount, hasPortalSupport, isHighlighted, isDimmed, isDropTarget } = data;
  const Icon = TYPE_ICONS[item.type];

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border-2 min-w-[100px] max-w-[200px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isRoot ? 'border-primary border-3' : 'border-gray-300'
      } ${isHighlighted ? 'ring-4 ring-primary ring-offset-2 scale-110 z-10' : ''} ${isDimmed ? 'opacity-30' : ''} ${isDropTarget ? 'ring-4 ring-blue-500 ring-offset-2 scale-110 shadow-xl border-blue-500' : ''}`}
      style={{ backgroundColor: hexColor }}
    >
      {/* Handles on all sides for radial connections */}
      <Handle type="target" position={Position.Top} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="right-source" />

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
        {hasPortalSupport && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPortal(item.id);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-indigo-50"
            title="Ajouter un portail vers un autre espace"
          >
            <ExternalLink className="w-3 h-3 text-indigo-600" />
          </button>
        )}
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

// Portal node component (link to another space)
interface PortalNodeProps {
  data: {
    space: SpaceWithRole;
    onRemove: (portalId: string) => void;
    portalId: string;
  };
}

function PortalNode({ data }: PortalNodeProps) {
  const { space, onRemove, portalId } = data;

  const handleClick = () => {
    // Open in new tab
    window.open(`/spaces/${space.id}`, '_blank');
  };

  return (
    <div
      className="px-4 py-3 rounded-xl shadow-lg border-2 border-dashed border-indigo-400 bg-indigo-50 min-w-[120px] cursor-pointer hover:bg-indigo-100 hover:border-indigo-500 transition-all group"
      onClick={handleClick}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-indigo-400 !w-3 !h-3" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-400 !w-3 !h-3" id="right-source" />

      <div className="flex items-center gap-2">
        <ExternalLink className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-indigo-700">{space.name}</span>
          <span className="text-xs text-indigo-500">Portail</span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(portalId);
        }}
        className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Supprimer le portail"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}

const nodeTypes = {
  mindmap: MindMapNode,
  space: SpaceNode,
  portal: PortalNode,
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
  onAddPortal: (id: string) => void,
  onToggleCollapse: (id: string) => void,
  hasPortalSupport: boolean,
  highlightType?: string
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
        onAddPortal,
        onToggleCollapse,
        isRoot: depth === 0,
        hasChildren,
        isCollapsed,
        childCount,
        hasPortalSupport,
        isHighlighted: highlightType ? item.type === highlightType : false,
        isDimmed: highlightType ? item.type !== highlightType : false,
        isDropTarget: false,
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

      // Pass null as parentId since we already added the edge above
      processNode(rootItem, 1, null, x, y, startAngle, endAngle, midAngle);

      currentAngle = endAngle;
    });
  }

  // Create edges for relations (not parent-child)
  const relationEdges: Edge[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const nodePositions = new Map(nodes.map(n => [n.id, n.position]));

  // Helper to get best handles based on relative positions
  const getBestHandles = (sourceId: string, targetId: string): { sourceHandle: string; targetHandle: string } => {
    const sourcePos = nodePositions.get(sourceId);
    const targetPos = nodePositions.get(targetId);

    if (!sourcePos || !targetPos) {
      return { sourceHandle: 'right-source', targetHandle: 'left' };
    }

    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;

    // Determine primary direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal - use left/right handles
      if (dx > 0) {
        return { sourceHandle: 'right-source', targetHandle: 'left' };
      } else {
        return { sourceHandle: 'left-source', targetHandle: 'right' };
      }
    } else {
      // Vertical - use top/bottom handles
      if (dy > 0) {
        return { sourceHandle: 'bottom-source', targetHandle: 'top' };
      } else {
        return { sourceHandle: 'top-source', targetHandle: 'bottom' };
      }
    }
  };

  items.forEach(item => {
    // Relations from this item
    item.relationsFrom?.forEach(relation => {
      // Only create edge if both nodes exist in the current view
      if (nodeIds.has(relation.fromItemId) && nodeIds.has(relation.toItemId)) {
        const { sourceHandle, targetHandle } = getBestHandles(relation.fromItemId, relation.toItemId);

        relationEdges.push({
          id: `relation-${relation.id}`,
          source: relation.fromItemId,
          target: relation.toItemId,
          sourceHandle,
          targetHandle,
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

// Relation type options with descriptions
const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'relates', label: 'Est lié à', Icon: Link2, description: 'Lien simple entre deux éléments', color: 'text-purple-500' },
  { id: 'blocks', label: 'Bloque', Icon: Ban, description: 'A doit être terminé avant B', color: 'text-red-500' },
  { id: 'depends', label: 'Dépend de', Icon: ArrowLeft, description: 'A nécessite B pour avancer', color: 'text-orange-500' },
  { id: 'duplicates', label: 'Duplique', Icon: Copy, description: 'A est un doublon de B', color: 'text-gray-500' },
  { id: 'implements', label: 'Implémente', Icon: Cog, description: 'A réalise/concrétise B', color: 'text-blue-500' },
  { id: 'tests', label: 'Teste', Icon: FlaskConical, description: 'A valide le bon fonctionnement de B', color: 'text-green-500' },
];

// Portal state type
interface PortalState {
  id: string;
  spaceId: string;
  parentItemId: string; // The item this portal is attached to
}

// Inner component that uses useReactFlow
function MindMapViewInner({
  items,
  spaceName = 'Espace',
  spaceId,
  communitySpaces = [],
  highlightType,
  onEdit,
  onAddChild,
  onMove,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
}: Omit<MindMapViewProps, 'onDelete' | 'onUpdateStatus'>) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [pendingPortalParentId, setPendingPortalParentId] = useState<string | null>(null);
  const { fitView, getIntersectingNodes } = useReactFlow();

  // localStorage key for portals
  const portalsStorageKey = spaceId ? `mindmap-portals-${spaceId}` : null;

  // Portals state
  const [portals, setPortals] = useState<PortalState[]>([]);
  const [portalsLoaded, setPortalsLoaded] = useState(false);

  // Load portals from localStorage when spaceId is available
  useEffect(() => {
    if (!portalsStorageKey) return;
    try {
      const saved = localStorage.getItem(portalsStorageKey);
      if (saved) {
        setPortals(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
    setPortalsLoaded(true);
  }, [portalsStorageKey]);

  // Save portals to localStorage when they change (only after initial load)
  useEffect(() => {
    if (!portalsStorageKey || !portalsLoaded) return;
    localStorage.setItem(portalsStorageKey, JSON.stringify(portals));
  }, [portals, portalsStorageKey, portalsLoaded]);

  // Filter available spaces (same community, not current space)
  const availableSpaces = useMemo(() => {
    return communitySpaces.filter(s => s.id !== spaceId);
  }, [communitySpaces, spaceId]);

  // Open portal dialog for a specific item
  const handleAddPortal = useCallback((parentItemId: string) => {
    setPendingPortalParentId(parentItemId);
    setShowPortalDialog(true);
  }, []);

  // Add a portal attached to an item
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

  // Remove a portal
  const removePortal = useCallback((portalId: string) => {
    setPortals(prev => prev.filter(p => p.id !== portalId));
  }, []);

  // Check if portal support is available
  const hasPortalSupport = availableSpaces.length > 0;

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
    const { nodes, edges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, highlightType);
    return { initialNodes: nodes, initialEdges: [...edges, ...relationEdges] };
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, toggleCollapse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when items, collapsed state, or portals change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, highlightType);

    // Build a map of node positions for portal placement
    const nodePositions = new Map(newNodes.map(n => [n.id, n.position]));

    // Add portal nodes positioned relative to their parent item
    const portalNodes: Node[] = [];
    const portalEdges: Edge[] = [];

    portals.forEach((portal, index) => {
      const targetSpace = communitySpaces.find(s => s.id === portal.spaceId);
      const parentPos = nodePositions.get(portal.parentItemId);
      if (!targetSpace || !parentPos) return;

      // Position portal to the right and slightly below the parent
      const offsetX = 200;
      const offsetY = 50 + index * 80; // Stack multiple portals vertically

      portalNodes.push({
        id: portal.id,
        type: 'portal',
        position: { x: parentPos.x + offsetX, y: parentPos.y + offsetY },
        data: {
          space: targetSpace,
          onRemove: removePortal,
          portalId: portal.id,
        },
      });

      // Create edge from parent item to portal
      portalEdges.push({
        id: `edge-${portal.parentItemId}-${portal.id}`,
        source: portal.parentItemId,
        target: portal.id,
        sourceHandle: 'right-source',
        targetHandle: 'left',
        type: 'default',
        style: { stroke: '#818cf8', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    });

    setNodes([...newNodes, ...portalNodes]);
    setEdges([...newEdges, ...relationEdges, ...portalEdges]);
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, setNodes, setEdges, portals, communitySpaces, removePortal]);

  // Update drop target highlight on nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.type !== 'mindmap') return n;
      const isTarget = n.id === dropTargetId;
      if (n.data?.isDropTarget === isTarget) return n;
      return { ...n, data: { ...n.data, isDropTarget: isTarget } };
    }));
  }, [dropTargetId, setNodes]);

  // Handle new connection (create relation)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== '__space__' && connection.target !== '__space__') {
        // Don't create relation if it's a parent-child relationship
        const sourceItem = items.find(i => i.id === connection.source);
        const targetItem = items.find(i => i.id === connection.target);
        if (sourceItem && targetItem && sourceItem.parentId !== connection.target && targetItem.parentId !== connection.source) {
          // Open dialog to choose relation type
          setPendingConnection({ source: connection.source, target: connection.target });
        }
      }
    },
    [items]
  );

  // Handle relation type selection
  const handleRelationTypeSelect = useCallback(
    (type: string) => {
      if (pendingConnection) {
        onCreateRelation?.(pendingConnection.source, pendingConnection.target, type);
        setPendingConnection(null);
      }
    },
    [pendingConnection, onCreateRelation]
  );

  // Get item titles for dialog
  const pendingSourceItem = pendingConnection ? items.find(i => i.id === pendingConnection.source) : null;
  const pendingTargetItem = pendingConnection ? items.find(i => i.id === pendingConnection.target) : null;

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
      // Don't try to edit the space node or portal nodes
      if (node.id !== '__space__' && node.type !== 'portal') {
        onEdit(node.id);
      }
    },
    [onEdit]
  );

  // Handle node drag - highlight potential drop target
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') return;
      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.id !== '__space__' && n.type !== 'portal' && n.id !== draggedNode.id);
      setDropTargetId(target?.id || null);
    },
    [getIntersectingNodes]
  );

  // Handle node drop - reparent if dropped on another node
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') {
        setDropTargetId(null);
        return;
      }
      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.id !== '__space__' && n.type !== 'portal' && n.id !== draggedNode.id);
      if (target && onMove) {
        // Prevent dropping a parent onto its own descendant
        const isDescendant = (parentId: string, childId: string): boolean => {
          const child = items.find(i => i.id === childId);
          if (!child || !child.parentId) return false;
          if (child.parentId === parentId) return true;
          return isDescendant(parentId, child.parentId);
        };
        if (!isDescendant(draggedNode.id, target.id)) {
          onMove(draggedNode.id, target.id, 0);
        }
      }
      setDropTargetId(null);
    },
    [getIntersectingNodes, onMove, items]
  );

  // Reset layout function
  const resetLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, highlightType);

    // Build a map of node positions for portal placement
    const nodePositions = new Map(newNodes.map(n => [n.id, n.position]));

    // Add portal nodes positioned relative to their parent item
    const portalNodes: Node[] = [];
    const portalEdges: Edge[] = [];

    portals.forEach((portal, index) => {
      const targetSpace = communitySpaces.find(s => s.id === portal.spaceId);
      const parentPos = nodePositions.get(portal.parentItemId);
      if (!targetSpace || !parentPos) return;

      const offsetX = 200;
      const offsetY = 50 + index * 80;

      portalNodes.push({
        id: portal.id,
        type: 'portal',
        position: { x: parentPos.x + offsetX, y: parentPos.y + offsetY },
        data: {
          space: targetSpace,
          onRemove: removePortal,
          portalId: portal.id,
        },
      });

      portalEdges.push({
        id: `edge-${portal.parentItemId}-${portal.id}`,
        source: portal.parentItemId,
        target: portal.id,
        sourceHandle: 'right-source',
        targetHandle: 'left',
        type: 'default',
        style: { stroke: '#818cf8', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    });

    setNodes([...newNodes, ...portalNodes]);
    setEdges([...newEdges, ...relationEdges, ...portalEdges]);
    // Fit view after a small delay to ensure nodes are positioned
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [tree, items, statuses, collapsedIds, spaceName, items.length, onEdit, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, highlightType, setNodes, setEdges, fitView, portals, communitySpaces, removePortal]);

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
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
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
        <Panel position="bottom-left" className="bg-white/95 border rounded-lg shadow-sm p-3 text-xs">
          <div className="font-semibold text-foreground mb-2">Légende</div>

          {/* Instructions */}
          <div className="space-y-1 mb-3 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Link2 className="w-3 h-3 text-purple-500 flex-shrink-0" />
              <span>Glissez depuis un point pour créer une relation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 flex-shrink-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #8b5cf6 0, #8b5cf6 3px, transparent 3px, transparent 6px)' }} />
              <span>Cliquez sur une relation pour la supprimer</span>
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3 h-3 text-indigo-500 flex-shrink-0" />
              <span>Portail : ouvre un autre espace (nouvel onglet)</span>
            </div>
          </div>

          {/* Relation types - compact with hover */}
          <div className="font-semibold text-foreground mb-1.5 pt-2 border-t">Types de relations</div>
          <div className="flex flex-wrap gap-1">
            {RELATION_TYPES.map((type) => (
              <div
                key={type.id}
                className="group relative p-1.5 rounded-md hover:bg-gray-100 cursor-help transition-colors"
                title={`${type.label} — ${type.description}`}
              >
                <type.Icon className={`w-4 h-4 ${type.color}`} />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  <div className="font-medium">{type.label}</div>
                  <div className="text-gray-300 text-[10px]">{type.description}</div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            ))}
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
              onClick={() => {
                setShowPortalDialog(false);
                setPendingPortalParentId(null);
              }}
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

export function MindMapView({
  items,
  spaceName = 'Espace',
  spaceId,
  communitySpaces,
  highlightType,
  onEdit,
  onDelete: _onDelete,
  onUpdateStatus: _onUpdateStatus,
  onAddChild,
  onMove,
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
          spaceId={spaceId}
          communitySpaces={communitySpaces}
          highlightType={highlightType}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onMove={onMove}
          onCreateRelation={onCreateRelation}
          onDeleteRelation={onDeleteRelation}
          referentiels={referentiels}
        />
      </ReactFlowProvider>
    </div>
  );
}
