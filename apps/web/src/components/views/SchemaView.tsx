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
  type Connection,
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
import { Ban, ArrowLeft, Link2, Copy, Cog, FlaskConical, type LucideIcon } from 'lucide-react';

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
  isHighlighted: boolean;
  isDimmed: boolean;
  isSearchMatch: boolean;
  isPortal: boolean;
  canEdit: boolean;
  [key: string]: unknown;
}

function SchemaNode({ data }: { data: SchemaNodeData }) {
  const { item, isHighlighted, isDimmed, isSearchMatch, isPortal } = data;
  const Icon = TYPE_ICONS[item.type];
  const dotColor = TYPE_COLORS[item.type] || '#6b7280';

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
      </div>
      {item.status && (
        <div className="mt-1 text-[10px] text-muted-foreground truncate">{item.status}</div>
      )}
    </div>
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
const edgeTypes: EdgeTypes = { relation: RelationEdge };

// --- Relation type picker modal ---
function RelationTypePicker({
  onSelect,
  onCancel,
  position,
}: {
  onSelect: (type: string) => void;
  onCancel: () => void;
  position: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onCancel();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-card border rounded-lg shadow-lg p-2 w-48"
      style={{ top: position.y, left: position.x }}
    >
      <div className="text-xs font-medium text-muted-foreground mb-1 px-2">Type de relation</div>
      {Object.entries(RELATION_TYPE_MAP).map(([type, config]) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded transition-colors"
        >
          <config.Icon className="w-4 h-4" style={{ color: config.color }} />
          <span>{config.label}</span>
        </button>
      ))}
    </div>
  );
}

// --- Main component ---
interface SchemaViewProps {
  items: ItemWithRelations[];
  spaceId: string;
  onEdit: (id: string) => void;
  onCreateItem?: (position: { x: number; y: number }) => void;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalItems?: ItemWithRelations[];
  canEdit: boolean;
}

export function SchemaView({
  items,
  spaceId,
  onEdit,
  onCreateItem,
  highlightType,
  highlightStatus,
  searchMatchIds,
  portalItems = [],
  canEdit,
}: SchemaViewProps) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Create relation mutation
  const createRelationMutation = useMutation({
    mutationFn: ({ fromItemId, toItemId, type }: { fromItemId: string; toItemId: string; type: string }) => {
      const fromItem = [...items, ...portalItems].find(i => i.id === fromItemId);
      if (!fromItem) throw new Error('Item source not found');
      return itemsApi.createRelation(fromItem.spaceId, fromItemId, { toItemId, type });
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

    // Grid layout for items without saved positions
    let gridIndex = 0;
    const GRID_COLS = 5;
    const GRID_X_STEP = 260;
    const GRID_Y_STEP = 120;

    const newNodes: Node[] = allItems.map((item) => {
      // Priority: current drag positions > saved positions > grid
      const pos = currentPositions[item.id] || savedPositions[item.id] || {
        x: (gridIndex % GRID_COLS) * GRID_X_STEP,
        y: Math.floor(gridIndex / GRID_COLS) * GRID_Y_STEP,
      };
      if (!currentPositions[item.id] && !savedPositions[item.id]) gridIndex++;

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
          isHighlighted,
          isDimmed: isDimmed && !isSearchMatch,
          isSearchMatch,
          isPortal: portalIds.has(item.id),
          canEdit,
        } satisfies SchemaNodeData,
      };
    });

    // Build edges from relations
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
            data: { relationType: rel.type, label: rel.label },
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

  // Handle new connection → show type picker
  const handleConnect: OnConnect = useCallback((connection) => {
    if (!canEdit) return;
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setPendingConnection(connection);
    // Position picker near center of viewport
    setPickerPos({ x: window.innerWidth / 2 - 96, y: window.innerHeight / 2 - 100 });
  }, [canEdit]);

  const handleRelationTypeSelect = useCallback((type: string) => {
    if (!pendingConnection?.source || !pendingConnection?.target) return;
    createRelationMutation.mutate({
      fromItemId: pendingConnection.source,
      toItemId: pendingConnection.target,
      type,
    });
    setPendingConnection(null);
  }, [pendingConnection, createRelationMutation]);

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
        onDoubleClick={handlePaneDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
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

      {/* Relation type picker */}
      {pendingConnection && (
        <RelationTypePicker
          position={pickerPos}
          onSelect={handleRelationTypeSelect}
          onCancel={() => setPendingConnection(null)}
        />
      )}
    </div>
  );
}
