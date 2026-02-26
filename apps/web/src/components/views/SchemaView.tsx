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
  getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemWithRelations } from '@spok/shared';
import { canvasLayoutApi, itemsApi } from '../../lib/api';
import { TYPE_ICONS } from '../../constants/ui';
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
  const Icon = TYPE_ICONS[item.type];
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

// --- Custom Hierarchy Edge (parent → child, light gray) ---
function HierarchyEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: any) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 16,
  });

  return (
    <BaseEdge id={id} path={edgePath} style={{ stroke: '#d1d5db', strokeWidth: 1.5 }} />
  );
}

// --- Custom Relation Edge ---
function RelationEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: any) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 16,
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

const nodeTypes: NodeTypes = { schema: SchemaNode };
const edgeTypes: EdgeTypes = { hierarchy: HierarchyEdge, relation: RelationEdge };

// --- Hierarchy layout algorithm ---
function computeHierarchyLayout(items: ItemWithRelations[]): Record<string, { x: number; y: number }> {
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

  const NODE_W = 240;
  const NODE_H = 70;
  const H_GAP = 40;
  const V_GAP = 80;
  const TREE_GAP = 120;

  // Compute subtree width
  const widths = new Map<string, number>();
  function getWidth(id: string): number {
    if (widths.has(id)) return widths.get(id)!;
    const children = childrenMap.get(id) || [];
    if (children.length === 0) { widths.set(id, NODE_W); return NODE_W; }
    const total = children.reduce((s, c) => s + getWidth(c), 0) + (children.length - 1) * H_GAP;
    const w = Math.max(NODE_W, total);
    widths.set(id, w);
    return w;
  }

  // Compute subtree depth
  const depths = new Map<string, number>();
  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    const children = childrenMap.get(id) || [];
    if (children.length === 0) { depths.set(id, 1); return 1; }
    const d = 1 + Math.max(...children.map(getDepth));
    depths.set(id, d);
    return d;
  }

  const positions: Record<string, { x: number; y: number }> = {};
  function layout(id: string, x: number, y: number) {
    positions[id] = { x, y };
    const children = childrenMap.get(id) || [];
    if (children.length === 0) return;
    const totalW = children.reduce((s, c) => s + getWidth(c), 0) + (children.length - 1) * H_GAP;
    let cx = x + NODE_W / 2 - totalW / 2;
    for (const cid of children) {
      const cw = getWidth(cid);
      layout(cid, cx + cw / 2 - NODE_W / 2, y + NODE_H + V_GAP);
      cx += cw + H_GAP;
    }
  }

  // Stack root trees vertically
  let offsetY = 0;
  for (const rootId of roots) {
    layout(rootId, 0, offsetY);
    const treeHeight = getDepth(rootId) * (NODE_H + V_GAP) - V_GAP;
    offsetY += treeHeight + TREE_GAP;
  }

  return positions;
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

export function SchemaView({
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

    // Use hierarchy layout as fallback for items without saved positions
    const hasSavedPositions = Object.keys(savedPositions).length > 0 || Object.keys(currentPositions).length > 0;
    const hierarchyPositions = hasSavedPositions ? {} : computeHierarchyLayout(allItems);

    const newNodes: Node[] = allItems.map((item) => {
      // Priority: current drag positions > saved positions > hierarchy layout
      const pos = currentPositions[item.id] || savedPositions[item.id] || hierarchyPositions[item.id] || { x: 0, y: 0 };

      const isHighlighted = !!(
        (highlightType && item.type === highlightType) ||
        (highlightStatus && item.status === highlightStatus)
      );
      const isDimmed = !!(
        (highlightType && item.type !== highlightType) ||
        (highlightStatus && item.status !== highlightStatus)
      );
      const isSearchMatch = searchMatchIds ? searchMatchIds.has(item.id) : false;

      return {
        id: item.id,
        type: 'schema',
        position: pos,
        data: {
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
        } satisfies SchemaNodeData,
      };
    });

    // Build edges from hierarchy (parent → child)
    const itemIdSet = new Set(allItems.map(i => i.id));
    const newEdges: Edge[] = [];

    for (const item of allItems) {
      if (item.parentId && itemIdSet.has(item.parentId)) {
        newEdges.push({
          id: `hier-${item.parentId}-${item.id}`,
          source: item.parentId,
          sourceHandle: 'bottom-source',
          target: item.id,
          targetHandle: 'top',
          type: 'hierarchy',
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#d1d5db' },
        });
      }
    }

    // Build edges from relations
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

  // Reorganize: apply hierarchy layout to all items
  const handleReorganize = useCallback(() => {
    const newPositions = computeHierarchyLayout(allItems);
    positionsRef.current = newPositions;
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        position: newPositions[node.id] || node.position,
      }))
    );
    savePositions(newPositions);
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
