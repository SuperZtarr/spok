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
  Handle,
  Position,
  Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ItemWithRelations, SpaceReferentiels, StatusConfig, SpaceWithRole } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS } from '../../constants/ui';
import { Plus, ChevronRight, ChevronDown, FolderOpen, RotateCcw, Link2, ExternalLink, X, Ban, ArrowLeft, Copy, Cog, FlaskConical, Maximize2, Trash2, type LucideIcon } from 'lucide-react';
import { hierarchy, tree as d3Tree } from 'd3-hierarchy';

export interface MindMapViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
  hasCollapsedNodes: boolean;
}

interface MindMapViewProps {
  items: ItemWithRelations[];
  spaceName?: string;
  spaceId?: string;
  communitySpaces?: SpaceWithRole[];
  highlightType?: string;
  highlightStatus?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  onCreateRelation?: (fromItemId: string, toItemId: string, type: string) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

// Get status color from referentiels
function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
  if (!status) {
    const undefinedStatus = statuses.find(s => s.id === 'undefined');
    return undefinedStatus?.color || 'bg-slate-100';
  }
  const statusConfig = statuses.find(s => s.id === status);
  if (!statusConfig) return 'bg-gray-100';
  const colorMatch = statusConfig.color.match(/bg-[a-z]+(?:-\d+)?/);
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
    'bg-black': '#000000',
    'bg-gray-400': '#9ca3af',
    'bg-gray-900': '#111827',
    'bg-slate-300': '#cbd5e1',
    'bg-orange-400': '#fb923c',
    'bg-yellow-400': '#facc15',
    'bg-green-400': '#4ade80',
    'bg-red-400': '#f87171',
  };
  return colorMap[bgClass] || '#f3f4f6';
}

// Determine if text should be light or dark based on background hex color
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Perceived luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1f2937' : '#ffffff';
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

  const typeOrder: Record<string, number> = { PROJECT: 0, NOTE: 1, TASK: 2 };
  function setDepths(items: TreeItem[], depth: number) {
    items.sort((a, b) => {
      const ta = typeOrder[a.type] ?? 9;
      const tb = typeOrder[b.type] ?? 9;
      if (ta !== tb) return ta - tb;
      return (a.position ?? 0) - (b.position ?? 0);
    });
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
    textColor: string;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onAddChild: (id: string) => void;
    onAddPortal: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    onReorganizeChildren: (id: string) => void;
    isRoot: boolean;
    hasChildren: boolean;
    isCollapsed: boolean;
    childCount: number;
    hasPortalSupport: boolean;
    isHighlighted: boolean;
    isDimmed: boolean;
    isDropTarget: boolean;
    canEdit: boolean;
  };
}

function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, textColor, onDelete, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, isRoot, hasChildren, isCollapsed, childCount, hasPortalSupport, isHighlighted, isDimmed, isDropTarget, canEdit } = data;
  const Icon = TYPE_ICONS[item.type];

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border-2 min-w-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isRoot ? 'border-primary border-3' : 'border-gray-300'
      } ${isHighlighted ? 'ring-4 ring-primary ring-offset-2 scale-110 z-10' : ''} ${isDimmed ? 'opacity-30' : ''} ${isDropTarget ? 'ring-4 ring-blue-500 ring-offset-2 scale-110 shadow-xl border-blue-500' : ''}`}
      style={{ backgroundColor: hexColor, color: textColor }}
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
              <ChevronRight className="w-4 h-4" style={{ color: textColor }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: textColor }} />
            )}
          </button>
        ) : null}

        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: textColor }} />

        <span className="text-sm font-medium whitespace-nowrap">{item.title}</span>

        {/* Badge showing child count when collapsed */}
        {isCollapsed && childCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded-full">
            {childCount}
          </span>
        )}
      </div>

      {/* Action buttons on hover */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
        {canEdit && (
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
        )}
        {canEdit && hasPortalSupport && (
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
        {hasChildren && !isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReorganizeChildren(item.id);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-blue-50"
            title="Réorganiser les enfants"
          >
            <RotateCcw className="w-3 h-3 text-blue-600" />
          </button>
        )}
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-red-50"
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
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
    isChildSpace?: boolean;
  };
}

function PortalNode({ data }: PortalNodeProps) {
  const { space, onRemove, portalId, isChildSpace } = data;

  const handleClick = () => {
    // Navigate to the space (same tab for child spaces, new tab for portals)
    if (isChildSpace) {
      window.location.href = `/spaces/${space.id}`;
    } else {
      window.open(`/spaces/${space.id}`, '_blank');
    }
  };

  return (
    <div
      className={`px-4 py-3 rounded-xl shadow-lg border-2 min-w-[120px] cursor-pointer transition-all group ${
        isChildSpace
          ? 'border-solid border-indigo-500 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-600 hover:shadow-xl'
          : 'border-dashed border-indigo-400 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-500'
      }`}
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
        {isChildSpace ? (
          <FolderOpen className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        ) : (
          <ExternalLink className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-indigo-700">{space.name}</span>
          <span className="text-xs text-indigo-500">
            {isChildSpace ? 'Sous-espace' : 'Portail'}
          </span>
        </div>
      </div>

      {/* Remove button (hidden for auto child space portals) */}
      {!isChildSpace && (
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
      )}
    </div>
  );
}

// Project group node component (invisible container for native ReactFlow grouping)
const nodeTypes = {
  mindmap: MindMapNode,
  space: SpaceNode,
  portal: PortalNode,
};

// Layout constant for d3 radial tree
const RADIAL_STEP = 350; // pixels between depth levels

// Data structure for d3 hierarchy
interface LayoutDatum {
  id: string;
  item?: TreeItem;
  children?: LayoutDatum[];
}

// Collect all visible descendant IDs (not behind a collapsed node)
function collectVisibleDescendantIds(item: TreeItem, collapsedIds: Set<string>): string[] {
  if (collapsedIds.has(item.id)) return [];
  const ids: string[] = [];
  for (const child of item.children) {
    ids.push(child.id);
    ids.push(...collectVisibleDescendantIds(child, collapsedIds));
  }
  return ids;
}


// Compute absolute positions for nodes that may have a parentId chain
function getAbsolutePositions(nodes: Node[]): Map<string, { x: number; y: number }> {
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const cache = new Map<string, { x: number; y: number }>();

  function resolve(nodeId: string): { x: number; y: number } {
    if (cache.has(nodeId)) return cache.get(nodeId)!;
    const node = nodeMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    const pos = { x: node.position.x, y: node.position.y };
    if (node.parentId) {
      const parentAbs = resolve(node.parentId);
      pos.x += parentAbs.x;
      pos.y += parentAbs.y;
    }
    cache.set(nodeId, pos);
    return pos;
  }

  for (const n of nodes) resolve(n.id);
  return cache;
}

// Recalculate edge handles based on actual node positions
function recalculateEdgeHandles(edges: Edge[], nodePositions: Map<string, { x: number; y: number }>): Edge[] {
  return edges.map(edge => {
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);
    if (!sourcePos || !targetPos) return edge;

    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;

    let sourceHandle: string;
    let targetHandle: string;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        sourceHandle = 'right-source';
        targetHandle = 'left';
      } else {
        sourceHandle = 'left-source';
        targetHandle = 'right';
      }
    } else {
      if (dy > 0) {
        sourceHandle = 'bottom-source';
        targetHandle = 'top';
      } else {
        sourceHandle = 'top-source';
        targetHandle = 'bottom';
      }
    }

    return { ...edge, sourceHandle, targetHandle };
  });
}

// Calculate node positions using d3-hierarchy radial tree layout
function calculateLayout(
  tree: TreeItem[],
  items: ItemWithRelations[],
  statuses: StatusConfig[],
  collapsedIds: Set<string>,
  spaceName: string,
  totalItemCount: number,
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onAddChild: (id: string) => void,
  onAddPortal: (id: string) => void,
  onToggleCollapse: (id: string) => void,
  onReorganizeChildren: (id: string) => void,
  hasPortalSupport: boolean,
  highlightType?: string,
  highlightStatus?: string,
  canEdit?: boolean
): { nodes: Node[]; edges: Edge[]; relationEdges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const SPACE_NODE_ID = '__space__';

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

  const root = hierarchy(rootDatum);

  // Compute d3 radial tree layout
  const maxDepth = root.height || 1;
  const maxRadius = Math.max(300, maxDepth * RADIAL_STEP);

  const layout = d3Tree<LayoutDatum>()
    .size([2 * Math.PI, maxRadius])
    .separation((a, b) => (a.parent === b.parent ? 1.5 : 3) / Math.max(1, a.depth * 0.7));

  layout(root);

  // Space node at center
  nodes.push({
    id: SPACE_NODE_ID,
    type: 'space',
    position: { x: -70, y: -25 },
    data: { label: spaceName, spaceName, itemCount: totalItemCount },
  });

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

  // Convert d3 nodes to ReactFlow nodes
  const nodePositionMap = new Map<string, { x: number; y: number }>();
  nodePositionMap.set(SPACE_NODE_ID, { x: -70, y: -25 });

  root.descendants().forEach(d3Node => {
    if (d3Node.data.id === SPACE_NODE_ID) return;

    const item = d3Node.data.item!;
    const statusColor = getStatusColor(item.status, statuses);
    const hexColor = tailwindBgToHex(statusColor);
    const hasChildren = item.children.length > 0;
    const isCollapsed = collapsedIds.has(item.id);
    const childCount = countDescendants(item);

    // Convert polar to cartesian (offset -π/2 to start from top)
    const angle = (d3Node.x ?? 0) - Math.PI / 2;
    const radius = d3Node.y ?? 0;
    const pos = { x: radius * Math.cos(angle) - 75, y: radius * Math.sin(angle) - 20 };
    nodePositionMap.set(item.id, pos);

    nodes.push({
      id: item.id,
      type: 'mindmap',
      position: pos,
      data: {
        label: item.title,
        item,
        statusColor,
        hexColor,
        textColor: getContrastTextColor(hexColor),
        onEdit,
        onDelete,
        onAddChild,
        onAddPortal,
        onToggleCollapse,
        onReorganizeChildren,
        isRoot: d3Node.depth === 1,
        hasChildren,
        isCollapsed,
        childCount,
        hasPortalSupport,
        isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
        isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false),
        isDropTarget: false,
        canEdit: canEdit !== false,
      },
    });

    // Edge from parent
    if (d3Node.parent) {
      const parentId = d3Node.parent.data.id;
      const parentPos = nodePositionMap.get(parentId);
      if (parentPos) {
        const { sourceHandle, targetHandle } = getBestHandles(parentPos, pos);
        edges.push({
          id: `${parentId}-${item.id}`,
          source: parentId,
          target: item.id,
          sourceHandle,
          targetHandle,
          type: 'default',
          style: {
            stroke: parentId === SPACE_NODE_ID ? 'hsl(var(--primary))' : '#94a3b8',
            strokeWidth: 2,
          },
        });
      }
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
          data: { relationId: relation.id, type: relation.type },
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
  highlightStatus,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
  canEdit,
  innerRef,
}: Omit<MindMapViewProps, 'onUpdateStatus'> & { innerRef?: React.Ref<MindMapViewHandle> }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [pendingPortalParentId, setPendingPortalParentId] = useState<string | null>(null);
  const { fitView, getIntersectingNodes, getNodes } = useReactFlow();

  // localStorage keys
  const portalsStorageKey = spaceId ? `mindmap-portals-${spaceId}` : null;
  const positionsStorageKey = spaceId ? `mindmap-positions-${spaceId}` : null;

  // Saved node positions
  const savedPositions = useRef<Record<string, { x: number; y: number }>>({});

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

  const savePositions = useCallback(() => {
    if (!positionsStorageKey) return;
    localStorage.setItem(positionsStorageKey, JSON.stringify(savedPositions.current));
  }, [positionsStorageKey]);

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

  // Child spaces of the current space (for automatic portal nodes)
  const childSpaces = useMemo(() => {
    return communitySpaces.filter(s => s.parentId === spaceId);
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

  const fullTree = useMemo(() => buildTree(items), [items]);

  // When a project is focused, extract its subtree
  const tree = useMemo(() => {
    if (!focusedProjectId) return fullTree;
    // Find the focused project in the full tree
    function findNode(nodes: TreeItem[], id: string): TreeItem | null {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    }
    const focusedNode = findNode(fullTree, focusedProjectId);
    if (!focusedNode) return fullTree;
    // Return children of the focused project as root items
    return focusedNode.children.length > 0 ? focusedNode.children : [focusedNode];
  }, [fullTree, focusedProjectId]);

  // Display name: project name when focused, space name otherwise
  const displayName = useMemo(() => {
    if (!focusedProjectId) return spaceName;
    const item = items.find(i => i.id === focusedProjectId);
    return item?.title || spaceName;
  }, [focusedProjectId, items, spaceName]);

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

  // Ref-based wrapper to avoid circular dependency with useMemo → useNodesState → setNodes
  const reorganizeRef = useRef<(id: string) => void>(() => {});
  // Track descendant offsets during drag-with-children
  const dragDescendants = useRef<{ ids: string[]; offsets: Map<string, { dx: number; dy: number }>; startPos: { x: number; y: number } } | null>(null);
  const handleReorganizeChildren = useCallback((id: string) => reorganizeRef.current(id), []);

  // Apply saved positions to nodes (override calculated positions with user-dragged ones)
  const applyPositions = useCallback((nodes: Node[]): Node[] => {
    const sp = savedPositions.current;
    if (!sp || Object.keys(sp).length === 0) return nodes;
    return nodes.map(n => {
      const saved = sp[n.id];
      return saved ? { ...n, position: saved } : n;
    });
  }, []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, hasPortalSupport, highlightType, highlightStatus, canEdit);
    const positionedNodes = applyPositions(nodes);
    const posMap = new Map(positionedNodes.map(n => [n.id, n.position]));
    const allEdges = recalculateEdgeHandles([...edges, ...relationEdges], posMap);
    return { initialNodes: positionedNodes, initialEdges: allEdges };
  }, [tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, toggleCollapse, applyPositions]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Assign the actual reorganize implementation to the ref (after setNodes/setEdges are available)
  reorganizeRef.current = (parentId: string) => {
    // Find the tree node and its visible children
    function findTreeNode(ns: TreeItem[], id: string): TreeItem | null {
      for (const n of ns) {
        if (n.id === id) return n;
        const f = findTreeNode(n.children, id);
        if (f) return f;
      }
      return null;
    }

    const treeNode = findTreeNode(fullTree, parentId);
    if (!treeNode || treeNode.children.length === 0) return;

    const visibleChildren = collapsedIds.has(parentId) ? [] : treeNode.children;
    if (visibleChildren.length === 0) return;

    // Get the parent's current absolute position
    const currentNodes = getNodes();
    const absPositions = getAbsolutePositions(currentNodes);
    const parentPosRaw = absPositions.get(parentId);
    if (!parentPosRaw) return;
    const parentPos = { x: parentPosRaw.x, y: parentPosRaw.y };

    // Distribute children in a fan around the parent
    const childCount = visibleChildren.length;
    const radius = RADIAL_STEP;
    const angleSpread = Math.min(Math.PI * 1.5, childCount * (Math.PI / 4));
    const startAngle = -angleSpread / 2;

    // Recursively reposition a subtree
    function repositionSubtree(item: TreeItem, cx: number, cy: number, depth: number) {
      // Save new absolute position
      savedPositions.current[item.id] = { x: cx, y: cy };

      // Recurse into visible children
      if (!collapsedIds.has(item.id) && item.children.length > 0) {
        const kids = item.children;
        const subRadius = RADIAL_STEP * 0.8;
        const subSpread = Math.min(Math.PI, kids.length * (Math.PI / 5));
        const subStart = -subSpread / 2;
        // Direction from grandparent to this node
        const dirAngle = Math.atan2(cy - parentPos.y, cx - parentPos.x);
        for (let i = 0; i < kids.length; i++) {
          const a = kids.length === 1 ? dirAngle : dirAngle + subStart + (i * subSpread) / Math.max(1, kids.length - 1);
          const nx = cx + subRadius * Math.cos(a);
          const ny = cy + subRadius * Math.sin(a);
          repositionSubtree(kids[i], nx, ny, depth + 1);
        }
      }
    }

    // Compute direction from center to parent for outward fan
    const spacePos = absPositions.get('__space__') || { x: 0, y: 0 };
    const baseAngle = Math.atan2(parentPos.y - spacePos.y, parentPos.x - spacePos.x);

    for (let i = 0; i < childCount; i++) {
      const angle = childCount === 1
        ? baseAngle
        : baseAngle + startAngle + (i * angleSpread) / Math.max(1, childCount - 1);
      const cx = parentPos.x + radius * Math.cos(angle);
      const cy = parentPos.y + radius * Math.sin(angle);
      repositionSubtree(visibleChildren[i], cx, cy, 1);
    }
    savePositions();

    // Re-apply positions to nodes without full d3 recalc
    setNodes(currentNodes => {
      const updated = currentNodes.map(n => {
        const saved = savedPositions.current[n.id];
        if (!saved) return n;
        // If node has parentId (in a group), convert absolute to relative
        if (n.parentId) {
          const parentNode = currentNodes.find(p => p.id === n.parentId);
          if (parentNode) {
            const parentAbs = absPositions.get(n.parentId) || parentNode.position;
            return { ...n, position: { x: saved.x - parentAbs.x, y: saved.y - parentAbs.y } };
          }
        }
        return { ...n, position: saved };
      });
      // Recalculate edges
      const newAbsPositions = getAbsolutePositions(updated);
      setEdges(currentEdges => recalculateEdgeHandles(currentEdges, newAbsPositions));
      return updated;
    });
  };

  // Wrap onNodesChange to recalculate edge handles when nodes are dragged
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeBase(changes);
    // If any position change, recalculate edges using absolute positions
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
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, hasPortalSupport, highlightType, highlightStatus, canEdit);
    const positionedNodes = applyPositions(newNodes);

    // Build a map of node positions for portal placement
    const portalPosMap = new Map(positionedNodes.map(n => [n.id, n.position]));

    // Add portal nodes positioned relative to their parent item
    const portalNodes: Node[] = [];
    const portalEdges: Edge[] = [];

    portals.forEach((portal, index) => {
      const targetSpace = communitySpaces.find(s => s.id === portal.spaceId);
      const parentPos = portalPosMap.get(portal.parentItemId);
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

    // Add automatic portal nodes for child spaces, attached to the central space node
    const SPACE_NODE_ID = '__space__';
    const spacePos = portalPosMap.get(SPACE_NODE_ID) || { x: -70, y: -25 };
    const childSpaceRadius = 180;
    childSpaces.forEach((childSpace, index) => {
      const childPortalId = `child-space-${childSpace.id}`;
      // Distribute child space portals in a fan below the center node
      const totalChildren = childSpaces.length;
      const angleSpread = Math.min(Math.PI * 0.8, totalChildren * (Math.PI / 4));
      const startAngle = Math.PI / 2 - angleSpread / 2; // centered below
      const angle = totalChildren === 1
        ? Math.PI / 2
        : startAngle + (index * angleSpread) / Math.max(1, totalChildren - 1);

      const cx = spacePos.x + childSpaceRadius * Math.cos(angle);
      const cy = spacePos.y + childSpaceRadius * Math.sin(angle);

      // Use saved position if available
      const savedPos = savedPositions.current[childPortalId];
      const pos = savedPos || { x: cx, y: cy };

      portalNodes.push({
        id: childPortalId,
        type: 'portal',
        position: pos,
        data: {
          space: childSpace,
          onRemove: () => {}, // Cannot remove auto child space portals
          portalId: childPortalId,
          isChildSpace: true, // Flag to hide remove button
        },
      });

      portalEdges.push({
        id: `edge-space-${childPortalId}`,
        source: SPACE_NODE_ID,
        target: childPortalId,
        sourceHandle: 'bottom-source',
        targetHandle: 'top',
        type: 'default',
        style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    });

    const allNodes = [...positionedNodes, ...portalNodes];
    const edgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
    const allEdges = recalculateEdgeHandles([...newEdges, ...relationEdges, ...portalEdges], edgePosMap);
    setNodes(allNodes);
    setEdges(allEdges);
  }, [tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, hasPortalSupport, setNodes, setEdges, portals, communitySpaces, childSpaces, removePortal, applyPositions]);

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
      // Don't try to edit the space node, portal nodes, or project group nodes
      if (node.id !== '__space__' && node.type !== 'portal') {
        onEdit(node.id);
      }
    },
    [onEdit]
  );

  // Double-click on a PROJECT node → zoom into its subtree
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'mindmap') return;
      const item = items.find(i => i.id === node.id);
      if (item?.type === 'PROJECT') {
        // Check if this project has children in the tree
        function findNode(nodes: TreeItem[], id: string): TreeItem | null {
          for (const n of nodes) {
            if (n.id === id) return n;
            const found = findNode(n.children, id);
            if (found) return found;
          }
          return null;
        }
        const treeNode = findNode(fullTree, node.id);
        if (treeNode && treeNode.children.length > 0) {
          setFocusedProjectId(node.id);
          setTimeout(() => fitView({ padding: 0.3 }), 100);
        }
      }
    },
    [items, fullTree, fitView]
  );

  // Exit project focus
  const exitProjectFocus = useCallback(() => {
    setFocusedProjectId(null);
    setTimeout(() => fitView({ padding: 0.3 }), 100);
  }, [fitView]);

  // Handle node drag start - capture descendant offsets for drag-with-children
  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') return;

      // Find tree node and collect visible descendant IDs
      function findTreeNode(ns: TreeItem[], id: string): TreeItem | null {
        for (const n of ns) {
          if (n.id === id) return n;
          const f = findTreeNode(n.children, id);
          if (f) return f;
        }
        return null;
      }
      const treeNode = findTreeNode(fullTree, draggedNode.id);
      if (!treeNode || treeNode.children.length === 0) {
        dragDescendants.current = null;
        return;
      }

      const descendantIds = collectVisibleDescendantIds(treeNode, collapsedIds);
      if (descendantIds.length === 0) {
        dragDescendants.current = null;
        return;
      }

      // Compute absolute positions and offsets from dragged node
      const currentNodes = getNodes();
      const absPositions = getAbsolutePositions(currentNodes);
      const draggedAbsPos = absPositions.get(draggedNode.id);
      if (!draggedAbsPos) {
        dragDescendants.current = null;
        return;
      }

      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const id of descendantIds) {
        const pos = absPositions.get(id);
        if (pos) {
          offsets.set(id, { dx: pos.x - draggedAbsPos.x, dy: pos.y - draggedAbsPos.y });
        }
      }

      dragDescendants.current = { ids: descendantIds, offsets, startPos: { ...draggedAbsPos } };
    },
    [fullTree, collapsedIds, getNodes]
  );

  // Handle node drag - move descendants and highlight potential drop target
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') return;

      // Move descendants with the dragged node
      if (dragDescendants.current && dragDescendants.current.offsets.size > 0) {
        const currentNodes = getNodes();
        const absPositions = getAbsolutePositions(currentNodes);
        const draggedAbsPos = absPositions.get(draggedNode.id);
        if (draggedAbsPos) {
          const { offsets } = dragDescendants.current;
          setNodes(prevNodes => prevNodes.map(n => {
            const offset = offsets.get(n.id);
            if (!offset) return n;
            // Compute new absolute position based on dragged node's current position + offset
            const newAbsX = draggedAbsPos.x + offset.dx;
            const newAbsY = draggedAbsPos.y + offset.dy;
            // If this node has a parentId, convert absolute to relative
            if (n.parentId) {
              const parentAbs = absPositions.get(n.parentId);
              if (parentAbs) {
                return { ...n, position: { x: newAbsX - parentAbs.x, y: newAbsY - parentAbs.y } };
              }
            }
            return { ...n, position: { x: newAbsX, y: newAbsY } };
          }));
        }
      }

      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.id !== '__space__' && n.type !== 'portal' && n.id !== draggedNode.id);
      setDropTargetId(target?.id || null);
    },
    [getIntersectingNodes, getNodes, setNodes]
  );

  // Handle node drop - reparent if dropped on another node, or save position
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.id === '__space__' || draggedNode.type === 'portal') {
        // Save position for space node
        if (draggedNode.id === '__space__') {
          savedPositions.current[draggedNode.id] = draggedNode.position;
          savePositions();
        }
        dragDescendants.current = null;
        setDropTargetId(null);
        return;
      }

      const intersecting = getIntersectingNodes(draggedNode);
      const target = intersecting.find(n => n.id !== '__space__' && n.type !== 'portal' && n.id !== draggedNode.id);
      if (target && onMove && canEdit !== false) {
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
      } else {
        // No reparenting - save absolute positions for dragged node AND descendants
        setNodes(currentNodes => {
          const absPositions = getAbsolutePositions(currentNodes);
          // Save dragged node position
          const absPos = absPositions.get(draggedNode.id);
          if (absPos) {
            savedPositions.current[draggedNode.id] = absPos;
          }
          // Save descendant positions
          if (dragDescendants.current) {
            for (const id of dragDescendants.current.ids) {
              const descAbsPos = absPositions.get(id);
              if (descAbsPos) {
                savedPositions.current[id] = descAbsPos;
              }
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

  // Reset layout function - clears saved positions
  const resetLayout = useCallback(() => {
    savedPositions.current = {};
    if (positionsStorageKey) {
      localStorage.removeItem(positionsStorageKey);
    }
    const { nodes: newNodes, edges: newEdges, relationEdges } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, handleAddPortal, toggleCollapse, handleReorganizeChildren, hasPortalSupport, highlightType, highlightStatus, canEdit);

    // Build a map of node positions for portal placement
    const resetPosMap = new Map(newNodes.map(n => [n.id, n.position]));

    // Add portal nodes positioned relative to their parent item
    const portalNodes: Node[] = [];
    const portalEdges: Edge[] = [];

    portals.forEach((portal, index) => {
      const targetSpace = communitySpaces.find(s => s.id === portal.spaceId);
      const parentPos = resetPosMap.get(portal.parentItemId);
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

    const allNodes = [...newNodes, ...portalNodes];
    const resetEdgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
    setNodes(allNodes);
    setEdges(recalculateEdgeHandles([...newEdges, ...relationEdges, ...portalEdges], resetEdgePosMap));
    // Fit view after a small delay to ensure nodes are positioned
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [tree, items, statuses, collapsedIds, displayName, items.length, onEdit, onDelete, onAddChild, handleAddPortal, toggleCollapse, hasPortalSupport, highlightType, highlightStatus, setNodes, setEdges, fitView, portals, communitySpaces, removePortal]);

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

  useImperativeHandle(innerRef, () => ({
    expandAll,
    collapseAll,
    hasCollapsedNodes,
  }), [expandAll, collapseAll, hasCollapsedNodes]);

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
        <Controls className="hidden sm:flex" position="bottom-right" />
        <MiniMap
          className="hidden md:block"
          nodeColor={(node) => {
            return node.data?.hexColor as string || '#f3f4f6';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Panel position="top-right" className="flex gap-1 sm:gap-2">
          {focusedProjectId && (
            <button
              onClick={exitProjectFocus}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-primary text-primary-foreground border rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
              title="Revenir à la vue complète"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Vue complète</span>
            </button>
          )}
          <button
            onClick={resetLayout}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Réorganiser les éléments"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Réorganiser</span>
          </button>
        </Panel>
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
            {/* Instructions */}
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

            {/* Relation types */}
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

export const MindMapView = forwardRef<MindMapViewHandle, MindMapViewProps>(function MindMapView({
  items,
  spaceName = 'Espace',
  spaceId,
  communitySpaces,
  highlightType,
  highlightStatus,
  onEdit,
  onDelete,
  onUpdateStatus: _onUpdateStatus,
  onAddChild,
  onMove,
  onCreateRelation,
  onDeleteRelation,
  referentiels,
  canEdit,
}, ref) {
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
          highlightStatus={highlightStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onMove={onMove}
          onCreateRelation={onCreateRelation}
          onDeleteRelation={onDeleteRelation}
          referentiels={referentiels}
          canEdit={canEdit}
          innerRef={ref}
        />
      </ReactFlowProvider>
    </div>
  );
});
