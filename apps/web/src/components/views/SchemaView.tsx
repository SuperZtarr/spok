import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
  MarkerType,
  BaseEdge,
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemWithRelations } from '@spok/shared';
import { canvasLayoutApi, itemsApi } from '../../lib/api';
import { getTypeIcon } from '../../constants/ui';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { Plus, Trash2, CheckSquare, FolderInput, FolderPlus, Ban, ArrowLeft, Link2, Copy, Cog, FlaskConical, type LucideIcon } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  PROJECT: '#3b82f6',
  NOTE: '#22c55e',
  TASK: '#f97316',
  MEETING: '#a855f7',
  PERIOD: '#06b6d4',
  LINK: '#6366f1',
  CONFIG: '#64748b',
  DOCUMENT: '#78716c',
  IMAGE: '#ec4899',
  BUG: '#ef4444',
};

// --- Relation type config ---
const RELATION_TYPE_MAP: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  blocks: { label: 'Bloque', Icon: Ban, color: '#ef4444' },
  depends: { label: 'Dépend de', Icon: ArrowLeft, color: '#f97316' },
  relates: { label: 'Lié à', Icon: Link2, color: '#a855f7' },
  duplicates: { label: 'Duplique', Icon: Copy, color: '#6b7280' },
  implements: { label: 'Implémente', Icon: Cog, color: '#3b82f6' },
  tests: { label: 'Teste', Icon: FlaskConical, color: '#22c55e' },
};

// --- Custom Schema Node ---
interface SchemaNodeData {
  item: ItemWithRelations;
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  doneStatusId?: string;
  isHighlighted: boolean;
  isDimmed: boolean;
  isSearchMatch: boolean;
  isPortal: boolean;
  canEdit: boolean;
  [key: string]: unknown;
}

function SchemaNode({ data }: { data: SchemaNodeData }) {
  const { item, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, doneStatusId, isHighlighted, isDimmed, isSearchMatch, isPortal, canEdit } = data;
  const Icon = getTypeIcon(item.type);
  const dotColor = TYPE_COLORS[item.type] || '#6b7280';

  const menuGroups = useMemo(() => {
    const groups = [];
    if (canEdit) {
      const createActions = [];
      if (onAddChild) createActions.push({ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) });
      if (onDuplicateToSpace) createActions.push({ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => onDuplicateToSpace(item.id) });
      if (createActions.length > 0) groups.push({ label: 'Créer', actions: createActions });

      const organizeActions = [];
      if (onUpdateStatus && doneStatusId && item.status !== doneStatusId) {
        organizeActions.push({ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, doneStatusId) });
      }
      if (onMoveToSpace) organizeActions.push({ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(item.id) });
      if (onConvertToSpace) organizeActions.push({ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) });
      if (organizeActions.length > 0) groups.push({ label: 'Organiser', actions: organizeActions });

      if (onDelete) groups.push({ actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }] });
    }
    return groups;
  }, [canEdit, item, onAddChild, onDuplicateToSpace, onUpdateStatus, onMoveToSpace, onConvertToSpace, onDelete, doneStatusId]);

  return (
    <div
      className={`px-3 py-2 rounded-lg shadow-md border-2 min-w-[120px] max-w-[220px] cursor-pointer transition-all hover:shadow-lg group bg-card
        ${isPortal ? 'border-dashed border-primary/40' : 'border-border'}
        ${isHighlighted ? 'ring-4 ring-primary ring-offset-2 scale-105 z-10' : ''}
        ${isSearchMatch ? 'ring-4 ring-yellow-400 ring-offset-2 scale-105 z-10 shadow-lg' : ''}
        ${isDimmed ? 'opacity-30' : ''}
      `}
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onEdit(item.id);
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="right-source" />

      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium line-clamp-2 break-words text-foreground">{item.title}</span>

        {/* Action menu */}
        {menuGroups.length > 0 && (
          <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity nodrag nopan">
            <ItemActionMenu
              groups={menuGroups}
              triggerClassName="p-0.5 rounded hover:bg-black/10 transition-colors"
              side="right"
            />
          </div>
        )}
      </div>
      {item.status && (
        <div className="mt-1 text-[10px] text-muted-foreground truncate">{item.status}</div>
      )}
    </div>
  );
}

// --- Custom Group Node (parent with children inside) ---
interface SchemaGroupData extends SchemaNodeData {
  groupWidth: number;
  groupHeight: number;
}

function SchemaGroupNode({ data }: { data: SchemaGroupData }) {
  const { item, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, doneStatusId, isHighlighted, isDimmed, isSearchMatch, isPortal, canEdit, groupWidth, groupHeight } = data;
  const Icon = getTypeIcon(item.type);
  const dotColor = TYPE_COLORS[item.type] || '#6b7280';

  const menuGroups = useMemo(() => {
    const groups = [];
    if (canEdit) {
      const createActions = [];
      if (onAddChild) createActions.push({ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) });
      if (onDuplicateToSpace) createActions.push({ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => onDuplicateToSpace(item.id) });
      if (createActions.length > 0) groups.push({ label: 'Créer', actions: createActions });

      const organizeActions = [];
      if (onUpdateStatus && doneStatusId && item.status !== doneStatusId) {
        organizeActions.push({ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, doneStatusId) });
      }
      if (onMoveToSpace) organizeActions.push({ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(item.id) });
      if (onConvertToSpace) organizeActions.push({ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) });
      if (organizeActions.length > 0) groups.push({ label: 'Organiser', actions: organizeActions });

      if (onDelete) groups.push({ actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }] });
    }
    return groups;
  }, [canEdit, item, onAddChild, onDuplicateToSpace, onUpdateStatus, onMoveToSpace, onConvertToSpace, onDelete, doneStatusId]);

  return (
    <div
      style={{ width: groupWidth, height: groupHeight }}
      className={`rounded-lg border-2 bg-muted/30 transition-all
        ${isPortal ? 'border-dashed border-primary/40' : 'border-border'}
        ${isHighlighted ? 'ring-4 ring-primary ring-offset-2 z-10' : ''}
        ${isSearchMatch ? 'ring-4 ring-yellow-400 ring-offset-2 z-10' : ''}
        ${isDimmed ? 'opacity-30' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-blue-600" id="right" />
      <Handle type="source" position={Position.Top} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-green-600" id="right-source" />

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md bg-card/80 border-b border-border cursor-pointer group"
        onDoubleClick={(e) => { e.stopPropagation(); data.onEdit(item.id); }}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold line-clamp-1 break-words text-foreground">{item.title}</span>
        {item.status && <span className="text-[10px] text-muted-foreground ml-1">({item.status})</span>}
        {menuGroups.length > 0 && (
          <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity nodrag nopan">
            <ItemActionMenu groups={menuGroups} triggerClassName="p-0.5 rounded hover:bg-black/10 transition-colors" side="right" />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Custom Relation Edge ---
function RelationEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: any) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const relType = data?.relationType || 'relates';
  const config = RELATION_TYPE_MAP[relType] || RELATION_TYPE_MAP.relates;
  const RelIcon = config.Icon;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: config.color, strokeWidth: 2 }} />
      <foreignObject
        x={labelX - 10}
        y={labelY - 10}
        width={20}
        height={20}
        className="pointer-events-none"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-card border shadow-sm" title={config.label}>
          <RelIcon className="w-3 h-3" style={{ color: config.color }} />
        </div>
      </foreignObject>
    </>
  );
}

const nodeTypes: NodeTypes = { schema: SchemaNode, schemaGroup: SchemaGroupNode };
const edgeTypes: EdgeTypes = { relation: RelationEdge };

// --- Group layout constants ---
const LEAF_W = 220;
const LEAF_H = 60;
const GROUP_HEADER_H = 40;
const GROUP_PAD = 20;
const CHILD_GAP = 35;
const ROOT_GAP = 80;

// --- Compute nested group sizes ---
interface NodeSize { w: number; h: number }

function computeGroupSizes(
  items: ItemWithRelations[],
): { childrenMap: Map<string, string[]>; roots: string[]; sizes: Map<string, NodeSize> } {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  for (const item of items) {
    if (item.parentId && itemMap.has(item.parentId)) {
      const siblings = childrenMap.get(item.parentId) || [];
      siblings.push(item.id);
      childrenMap.set(item.parentId, siblings);
    } else {
      roots.push(item.id);
    }
  }

  const sizes = new Map<string, NodeSize>();
  const visiting = new Set<string>();

  function computeSize(id: string): NodeSize {
    if (sizes.has(id)) return sizes.get(id)!;
    // Cycle detection
    if (visiting.has(id)) {
      const s = { w: LEAF_W, h: LEAF_H };
      sizes.set(id, s);
      return s;
    }
    visiting.add(id);
    const children = childrenMap.get(id) || [];
    if (children.length === 0) {
      const s = { w: LEAF_W, h: LEAF_H };
      sizes.set(id, s);
      visiting.delete(id);
      return s;
    }
    // Compute children sizes first
    let maxChildW = 0;
    let totalChildH = 0;
    for (const cid of children) {
      const cs = computeSize(cid);
      maxChildW = Math.max(maxChildW, cs.w);
      totalChildH += cs.h;
    }
    totalChildH += (children.length - 1) * CHILD_GAP;
    const w = Math.max(LEAF_W, maxChildW + GROUP_PAD * 2);
    const h = GROUP_HEADER_H + totalChildH + GROUP_PAD * 2;
    const s = { w, h };
    sizes.set(id, s);
    visiting.delete(id);
    return s;
  }

  for (const id of [...itemMap.keys()]) computeSize(id);

  return { childrenMap, roots, sizes };
}

// --- Compute positions (relative for children, absolute for roots) ---
function computeHierarchyLayout(items: ItemWithRelations[]): {
  positions: Record<string, { x: number; y: number }>;
  parentMap: Record<string, string>;
  sizes: Map<string, NodeSize>;
  childrenMap: Map<string, string[]>;
} {
  const { childrenMap, roots, sizes } = computeGroupSizes(items);

  const positions: Record<string, { x: number; y: number }> = {};
  const parentMap: Record<string, string> = {};

  // Position children inside parent (relative coords)
  function layoutChildren(parentId: string) {
    const children = childrenMap.get(parentId) || [];
    let y = GROUP_HEADER_H + GROUP_PAD;
    for (const cid of children) {
      positions[cid] = { x: GROUP_PAD, y };
      parentMap[cid] = parentId;
      const cs = sizes.get(cid)!;
      y += cs.h + CHILD_GAP;
      layoutChildren(cid);
    }
  }

  // Stack roots vertically
  let offsetY = 0;
  for (const rootId of roots) {
    positions[rootId] = { x: 0, y: offsetY };
    const rs = sizes.get(rootId)!;
    offsetY += rs.h + ROOT_GAP;
    layoutChildren(rootId);
  }

  return { positions, parentMap, sizes, childrenMap };
}

// --- Main component ---
interface SchemaViewProps {
  items: ItemWithRelations[];
  spaceId: string;
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onCreateItem?: (position: { x: number; y: number }) => void;
  doneStatusId?: string;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalItems?: ItemWithRelations[];
  canEdit: boolean;
  onReorganizeRef?: React.MutableRefObject<(() => void) | null>;
}

function SchemaViewInner({
  items,
  spaceId,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onCreateItem,
  doneStatusId,
  highlightType,
  highlightStatus,
  searchMatchIds,
  portalItems = [],
  canEdit,
  onReorganizeRef,
}: SchemaViewProps) {
  const queryClient = useQueryClient();
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [pendingConnection, setPendingConnection] = useState<{
    source: string; target: string; sourceName: string; targetName: string;
  } | null>(null);
  const [newRelType, setNewRelType] = useState('relates');
  const [newRelLabel, setNewRelLabel] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const initializedRef = useRef(false);

  // Load saved positions
  const { data: layoutData } = useQuery({
    queryKey: ['canvas-layout', spaceId],
    queryFn: () => canvasLayoutApi.get(spaceId),
    staleTime: 60000,
  });

  // Save positions mutation
  const saveMutation = useMutation({
    mutationFn: (positions: Record<string, { x: number; y: number }>) =>
      canvasLayoutApi.update(spaceId, positions),
  });

  // Editing relation state
  const [editingEdge, setEditingEdge] = useState<{
    relationId: string; fromItemId: string; type: string; label: string;
    sourceName: string; targetName: string;
  } | null>(null);
  const [editEdgeType, setEditEdgeType] = useState('');
  const [editEdgeLabel, setEditEdgeLabel] = useState('');

  // Create relation mutation
  const createRelationMutation = useMutation({
    mutationFn: ({ fromItemId, toItemId, type, label }: { fromItemId: string; toItemId: string; type: string; label?: string }) => {
      const fromItem = [...items, ...portalItems].find(i => i.id === fromItemId);
      if (!fromItem) throw new Error('Item source not found');
      return itemsApi.createRelation(fromItem.spaceId, fromItemId, { toItemId, type, label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  // Update relation mutation
  const updateRelationMutation = useMutation({
    mutationFn: ({ fromItemId, relationId, data }: { fromItemId: string; relationId: string; data: { type?: string; label?: string | null } }) => {
      const fromItem = allItems.find(i => i.id === fromItemId);
      if (!fromItem) throw new Error('Item source not found');
      return itemsApi.updateRelation(fromItem.spaceId, fromItemId, relationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  // Delete relation mutation
  const deleteRelationMutation = useMutation({
    mutationFn: ({ fromItemId, relationId }: { fromItemId: string; relationId: string }) => {
      const fromItem = allItems.find(i => i.id === fromItemId);
      if (!fromItem) throw new Error('Item source not found');
      return itemsApi.deleteRelation(fromItem.spaceId, fromItemId, relationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  // Reparent mutation (drop node onto another)
  const reparentMutation = useMutation({
    mutationFn: ({ itemId, parentId }: { itemId: string; parentId: string | null }) => {
      const item = allItems.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');
      return itemsApi.update(item.spaceId, itemId, { parentId });
    },
    onSuccess: () => {
      positionsRef.current = {};
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout'] });
    },
  });

  // Debounced save
  const savePositions = useCallback((positions: Record<string, { x: number; y: number }>) => {
    if (!canEdit) return;
    positionsRef.current = positions;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveMutation.mutate(positions);
    }, 1000);
  }, [canEdit, saveMutation]);

  // Build nodes and edges from items + saved positions
  const allItems = useMemo(() => [...items, ...portalItems], [items, portalItems]);
  const portalIds = useMemo(() => new Set(portalItems.map(i => i.id)), [portalItems]);

  useEffect(() => {
    if (!layoutData && !initializedRef.current) return;

    const savedPositions = layoutData?.positions ?? {};
    const currentPositions = positionsRef.current;

    // Compute hierarchy layout (always needed for sizes/parentMap)
    const hierarchy = computeHierarchyLayout(allItems);
    const hasSavedPositions = Object.keys(savedPositions).length > 0 || Object.keys(currentPositions).length > 0;

    const itemMap = new Map(allItems.map(i => [i.id, i]));

    // Build nodes — parents first, then children (ReactFlow needs parent before child)
    const newNodes: Node[] = [];
    const visited = new Set<string>();

    function addNode(id: string) {
      if (visited.has(id)) return;
      // If this node has a ReactFlow parent, ensure parent is added first
      const rfParent = hierarchy.parentMap[id];
      if (rfParent && !visited.has(rfParent)) addNode(rfParent);

      visited.add(id);
      const item = itemMap.get(id);
      if (!item) return;

      const children = hierarchy.childrenMap.get(id) || [];
      const isGroup = children.length > 0;
      const size = hierarchy.sizes.get(id)!;

      // Position: saved > hierarchy default
      const pos = hasSavedPositions
        ? (currentPositions[id] || savedPositions[id] || hierarchy.positions[id] || { x: 0, y: 0 })
        : (hierarchy.positions[id] || { x: 0, y: 0 });

      const isHighlighted = !!(
        (highlightType && item.type === highlightType) ||
        (highlightStatus && item.status === highlightStatus)
      );
      const isDimmed = !!(
        (highlightType && item.type !== highlightType) ||
        (highlightStatus && item.status !== highlightStatus)
      );
      const isSearchMatch = searchMatchIds ? searchMatchIds.has(item.id) : false;

      const nodeData = {
        item,
        onEdit,
        onDelete,
        onUpdateStatus,
        onAddChild,
        onMoveToSpace,
        onDuplicateToSpace,
        onConvertToSpace,
        doneStatusId,
        isHighlighted,
        isDimmed: isDimmed && !isSearchMatch,
        isSearchMatch,
        isPortal: portalIds.has(item.id),
        canEdit,
        ...(isGroup ? { groupWidth: size.w, groupHeight: size.h } : {}),
      };

      const node: Node = {
        id,
        type: isGroup ? 'schemaGroup' : 'schema',
        position: pos,
        data: nodeData,
        ...(rfParent ? { parentId: rfParent } : {}),
        ...(isGroup ? { style: { width: size.w, height: size.h } } : {}),
      };

      newNodes.push(node);
    }

    for (const item of allItems) addNode(item.id);

    // Build edges from relations only (hierarchy is visual nesting now)
    const itemIdSet = new Set(allItems.map(i => i.id));
    const newEdges: Edge[] = [];
    const edgeSet = new Set<string>();

    for (const item of allItems) {
      for (const rel of (item.relationsFrom || [])) {
        if (itemIdSet.has(rel.toItemId) && !edgeSet.has(`${rel.fromItemId}-${rel.toItemId}-${rel.type}`)) {
          edgeSet.add(`${rel.fromItemId}-${rel.toItemId}-${rel.type}`);
          newEdges.push({
            id: `rel-${rel.id}`,
            source: rel.fromItemId,
            target: rel.toItemId,
            type: 'relation',
            data: { relationType: rel.type, label: rel.label, relationId: rel.id },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          });
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
    if (!initializedRef.current) initializedRef.current = true;
  }, [allItems, layoutData, highlightType, highlightStatus, searchMatchIds, onEdit, canEdit, portalIds]);

  // Handle node drag → save positions
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Check if any node was dragged (position change)
    const hasDrag = changes.some(c => c.type === 'position' && c.dragging === false && c.position);
    if (hasDrag) {
      // Collect all current positions
      setNodes((currentNodes) => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const node of currentNodes) {
          positions[node.id] = { x: node.position.x, y: node.position.y };
        }
        savePositions(positions);
        return currentNodes;
      });
    }
  }, [onNodesChange, savePositions, setNodes]);

  // Handle drop onto another node → reparent, or outside parent → detach
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    if (!canEdit) return;
    if (portalIds.has(draggedNode.id)) return;

    const draggedItem = allItems.find(i => i.id === draggedNode.id);
    if (!draggedItem) return;

    const intersecting = reactFlowInstance.getIntersectingNodes(draggedNode);
    const targets = intersecting
      .filter(n => n.id !== draggedNode.id)
      .sort((a, b) => {
        const areaA = (a.measured?.width ?? 0) * (a.measured?.height ?? 0);
        const areaB = (b.measured?.width ?? 0) * (b.measured?.height ?? 0);
        return areaA - areaB;
      });

    const target = targets[0];

    if (target) {
      // Dropped onto a node → reparent (if not already child of it)
      if (draggedItem.parentId !== target.id) {
        reparentMutation.mutate({ itemId: draggedNode.id, parentId: target.id });
      }
    } else if (draggedItem.parentId) {
      // Dropped on empty space and had a parent → detach
      reparentMutation.mutate({ itemId: draggedNode.id, parentId: null });
    }
  }, [canEdit, reactFlowInstance, allItems, portalIds, reparentMutation]);

  // Handle new connection → show creation modal
  const handleConnect: OnConnect = useCallback((connection) => {
    if (!canEdit) return;
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceItem = allItems.find(i => i.id === connection.source);
    const targetItem = allItems.find(i => i.id === connection.target);
    setPendingConnection({
      source: connection.source!,
      target: connection.target!,
      sourceName: sourceItem?.title || 'Inconnu',
      targetName: targetItem?.title || 'Inconnu',
    });
    setNewRelType('relates');
    setNewRelLabel('');
  }, [canEdit, allItems]);

  const handleCreateRelation = useCallback(() => {
    if (!pendingConnection) return;
    createRelationMutation.mutate({
      fromItemId: pendingConnection.source,
      toItemId: pendingConnection.target,
      type: newRelType,
      label: newRelLabel.trim() || undefined,
    });
    setPendingConnection(null);
  }, [pendingConnection, newRelType, newRelLabel, createRelationMutation]);

  // Click on edge → open edit relation modal
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (!canEdit || !edge.data?.relationId) return;
    const sourceItem = allItems.find(i => i.id === edge.source);
    const targetItem = allItems.find(i => i.id === edge.target);
    const relType = (edge.data.relationType as string) || 'relates';
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
  }, [canEdit, allItems]);

  // Reorganize: reset to hierarchy layout
  const handleReorganize = useCallback(() => {
    const hierarchy = computeHierarchyLayout(allItems);
    positionsRef.current = {};
    // Re-trigger the useEffect by clearing saved positions cache
    initializedRef.current = true;
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        position: hierarchy.positions[node.id] || node.position,
      }))
    );
    // Save only root positions (children are relative to parent)
    const rootPositions: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of Object.entries(hierarchy.positions)) {
      if (!hierarchy.parentMap[id]) rootPositions[id] = pos;
    }
    savePositions(rootPositions);
  }, [allItems, setNodes, savePositions]);

  // Expose reorganize to parent via ref
  useEffect(() => {
    if (onReorganizeRef) onReorganizeRef.current = handleReorganize;
    return () => { if (onReorganizeRef) onReorganizeRef.current = null; };
  }, [onReorganizeRef, handleReorganize]);

  // Double-click on canvas → create item
  const handlePaneDoubleClick = useCallback((event: React.MouseEvent) => {
    if (!canEdit || !onCreateItem) return;
    // Get canvas position from mouse event
    // ReactFlow wraps the pane, so we need to get position relative to the flow
    const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (!bounds) return;
    onCreateItem({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }, [canEdit, onCreateItem]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onDoubleClick={handlePaneDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
        connectionLineStyle={{ stroke: '#a855f7', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'relation' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-card !border-border"
        />
      </ReactFlow>


      {/* Create relation modal */}
      {pendingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Créer une relation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{pendingConnection.sourceName}</span>
              {' → '}
              <span className="font-medium">{pendingConnection.targetName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(RELATION_TYPE_MAP).map(([typeId, config]) => (
                    <button
                      key={typeId}
                      onClick={() => setNewRelType(typeId)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${
                        newRelType === typeId ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/30' : 'hover:bg-purple-50 hover:border-purple-300'
                      }`}
                    >
                      <config.Icon className="w-4 h-4" style={{ color: config.color }} />
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Commentaire</label>
                <input
                  type="text"
                  value={newRelLabel}
                  onChange={(e) => setNewRelLabel(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400 bg-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateRelation}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Créer
              </button>
              <button
                onClick={() => setPendingConnection(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit relation modal */}
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
                  {Object.entries(RELATION_TYPE_MAP).map(([typeId, config]) => (
                    <button
                      key={typeId}
                      onClick={() => setEditEdgeType(typeId)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${
                        editEdgeType === typeId ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/30' : 'hover:bg-purple-50 hover:border-purple-300'
                      }`}
                    >
                      <config.Icon className="w-4 h-4" style={{ color: config.color }} />
                      <span className="text-sm font-medium">{config.label}</span>
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
                  updateRelationMutation.mutate({
                    fromItemId: editingEdge.fromItemId,
                    relationId: editingEdge.relationId,
                    data: { type: editEdgeType, label: editEdgeLabel.trim() || null },
                  });
                  setEditingEdge(null);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  if (confirm('Supprimer cette relation ?')) {
                    deleteRelationMutation.mutate({
                      fromItemId: editingEdge.fromItemId,
                      relationId: editingEdge.relationId,
                    });
                    setEditingEdge(null);
                  }
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
    </div>
  );
}

export function SchemaView(props: SchemaViewProps) {
  return (
    <ReactFlowProvider>
      <SchemaViewInner {...props} />
    </ReactFlowProvider>
  );
}
