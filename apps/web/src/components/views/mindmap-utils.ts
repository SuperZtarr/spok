import type { ItemWithRelations, StatusConfig } from '@spok/shared';
import type { Node, Edge } from '@xyflow/react';
import { Link2, Ban, ArrowRight, type LucideIcon } from 'lucide-react';

// Tree types
export interface TreeItem extends ItemWithRelations {
  children: TreeItem[];
  depth: number;
}

// Layout constants
export const RADIAL_STEP = 420;

// Data structure for d3 hierarchy
export interface LayoutDatum {
  id: string;
  item?: TreeItem;
  children?: LayoutDatum[];
}

// Portal state type
export interface PortalState {
  id: string;
  spaceId: string;
  parentItemId: string;
}

// Relation type options with descriptions
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        description: 'Contrainte dure — B ne peut démarrer avant la fin de A', color: 'text-red-500'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, description: 'A permet/rend possible B',                                color: 'text-green-500' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      description: 'A et B doivent être traités ensemble',                   color: 'text-blue-500'  },
];

// Get status color from referentiels
export function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
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
export function tailwindBgToHex(bgClass: string): string {
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
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1f2937' : '#ffffff';
}

// Build tree structure from flat items
export function buildTree(items: ItemWithRelations[]): TreeItem[] {
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
export function countDescendants(item: TreeItem): number {
  let count = item.children.length;
  item.children.forEach(child => {
    count += countDescendants(child);
  });
  return count;
}

// Max depth of descendant generations
export function maxDepth(item: TreeItem): number {
  if (item.children.length === 0) return 0;
  return 1 + Math.max(...item.children.map(maxDepth));
}

// Collect all visible descendant IDs (not behind a collapsed node)
export function collectVisibleDescendantIds(item: TreeItem, collapsedIds: Set<string>): string[] {
  if (collapsedIds.has(item.id)) return [];
  const ids: string[] = [];
  for (const child of item.children) {
    ids.push(child.id);
    ids.push(...collectVisibleDescendantIds(child, collapsedIds));
  }
  return ids;
}

// Compute absolute positions for nodes that may have a parentId chain
export function getAbsolutePositions(nodes: Node[]): Map<string, { x: number; y: number }> {
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
export function recalculateEdgeHandles(edges: Edge[], nodePositions: Map<string, { x: number; y: number }>): Edge[] {
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

// Count visible descendants for layout spacing
export function countVisible(item: TreeItem, collapsedIds: Set<string>): number {
  if (collapsedIds.has(item.id) || item.children.length === 0) return 1;
  return item.children.reduce((sum, c) => sum + countVisible(c, collapsedIds), 0);
}

// Find a tree node by ID recursively
export function findTreeNode(nodes: TreeItem[], id: string): TreeItem | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = findTreeNode(n.children, id);
    if (f) return f;
  }
  return null;
}
