/* Vue Bulles (D3 pack) : items en cercles groupés par espace/statut. */
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { hierarchy, pack, type HierarchyCircularNode } from 'd3-hierarchy';
import type { Item } from '@spok/shared';

const ITEM_TYPE_COLORS: Record<string, string> = {
  PROJECT: '#3b82f6',
  NOTE: '#22c55e',
  TASK: '#f97316',
  MEETING: '#a855f7',
  PERIOD: '#06b6d4',
  LINK: '#6366f1',
  CONFIG: '#64748b',
  DOCUMENT: '#78716c',
  IMAGE: '#ec4899',
  BUG: '#dc2626',
};

const TYPE_LABELS: Record<string, string> = {
  PROJECT: 'Projet',
  NOTE: 'Note',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
  BUG: 'Bug',
};

type SizeMode = 'equal' | 'contributions' | 'relations';

interface TreeNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  children: TreeNode[];
  value: number;
}

interface BubbleViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

function buildTree(items: Item[], sizeMode: SizeMode): TreeNode {
  const childrenMap = new Map<string | null, Item[]>();
  for (const item of items) {
    const parentId = item.parentId || null;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(item);
  }

  function getLeafValue(item: Item): number {
    if (sizeMode === 'contributions') {
      return Math.max(1, (item as any).contributionCount || (item as any)._count?.contributions || 1);
    }
    if (sizeMode === 'relations') {
      return Math.max(1, ((item as any).relationsFrom?.length || 0) + ((item as any).relationsTo?.length || 0) || 1);
    }
    return 1;
  }

  function buildNode(item: Item): TreeNode {
    const children = (childrenMap.get(item.id) || []).map(buildNode);
    return {
      id: item.id,
      name: item.title || 'Sans titre',
      type: item.type,
      status: item.status || undefined,
      children,
      value: children.length > 0 ? 0 : getLeafValue(item),
    };
  }

  const roots = (childrenMap.get(null) || []).map(buildNode);

  return {
    id: '__root__',
    name: 'root',
    type: 'ROOT',
    children: roots,
    value: 0,
  };
}

export function BubbleView({
  items,
  onItemClick,
  highlightType,
  highlightStatus,
  searchMatchIds,
}: BubbleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [zoomedNode, setZoomedNode] = useState<string | null>(null);
  const [sizeMode, setSizeMode] = useState<SizeMode>('equal');

  // Free zoom/pan state
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const rootData = useMemo(() => buildTree(items, sizeMode), [items, sizeMode]);

  const packedRoot = useMemo(() => {
    const size = Math.min(dimensions.width, dimensions.height);
    const root = hierarchy(rootData)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(d.value, 1)))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    pack<TreeNode>()
      .size([size, size])
      .padding(6)(root);

    return root as HierarchyCircularNode<TreeNode>;
  }, [rootData, dimensions]);

  // Base transform (centering or zoom-to-node)
  const baseTransform = useMemo(() => {
    const size = Math.min(dimensions.width, dimensions.height);
    if (!zoomedNode) {
      const offsetX = (dimensions.width - size) / 2;
      const offsetY = (dimensions.height - size) / 2;
      return { x: offsetX, y: offsetY, scale: 1 };
    }

    let target: HierarchyCircularNode<TreeNode> | null = null;
    packedRoot.each((node) => {
      if (node.data.id === zoomedNode) target = node;
    });

    if (!target) {
      const offsetX = (dimensions.width - size) / 2;
      const offsetY = (dimensions.height - size) / 2;
      return { x: offsetX, y: offsetY, scale: 1 };
    }

    const t = target as HierarchyCircularNode<TreeNode>;
    const scale = Math.min(dimensions.width, dimensions.height) / (t.r * 2 + 20);
    const x = dimensions.width / 2 - t.x * scale;
    const y = dimensions.height / 2 - t.y * scale;
    return { x, y, scale };
  }, [zoomedNode, packedRoot, dimensions]);

  // Active transform: camera overrides base
  const viewTransform = camera || baseTransform;

  // Reset camera when zoomed node changes
  useEffect(() => {
    setCamera(null);
  }, [zoomedNode]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const current = camera || baseTransform;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(20, current.scale * factor));

    // Zoom toward mouse position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newX = mx - (mx - current.x) * (newScale / current.scale);
    const newY = my - (my - current.y) * (newScale / current.scale);

    setCamera({ x: newX, y: newY, scale: newScale });
  }, [camera, baseTransform]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const current = camera || baseTransform;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, camX: current.x, camY: current.y };
  }, [camera, baseTransform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const current = camera || baseTransform;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setCamera({ x: panStart.current.camX + dx, y: panStart.current.camY + dy, scale: current.scale });
  }, [camera, baseTransform]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<TreeNode>) => {
    e.stopPropagation();
    if (node.data.id === '__root__') return;

    if (node.children && node.children.length > 0) {
      setZoomedNode((prev) => (prev === node.data.id ? null : node.data.id));
    } else if (onItemClick) {
      onItemClick(node.data.id);
    }
  }, [onItemClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<TreeNode>) => {
    e.stopPropagation();
    if (node.data.id === '__root__') return;
    if (onItemClick) {
      onItemClick(node.data.id);
    }
  }, [onItemClick]);

  const handleBackgroundClick = useCallback(() => {
    setZoomedNode(null);
  }, []);

  // Tooltip on hover
  const handleNodeEnter = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<TreeNode>) => {
    setHoveredId(node.data.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: node.data });
    }
  }, []);

  const handleNodeMove = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<TreeNode>) => {
    if (isPanning.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: node.data });
    }
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredId(null);
    setTooltip(null);
  }, []);

  // Collect all visible nodes (skip root)
  const nodes = useMemo(() => {
    const result: HierarchyCircularNode<TreeNode>[] = [];
    packedRoot.each((node) => {
      if (node.data.id !== '__root__') {
        result.push(node);
      }
    });
    return result;
  }, [packedRoot]);

  const isHighlighted = useCallback((node: TreeNode) => {
    if (highlightType && node.type !== highlightType) return false;
    if (highlightStatus && node.status !== highlightStatus) return false;
    return true;
  }, [highlightType, highlightStatus]);

  const isSearchMatch = useCallback((node: TreeNode) => {
    return searchMatchIds?.has(node.id) ?? false;
  }, [searchMatchIds]);

  // Types used in current data (for legend)
  const usedTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) {
      types.add(item.type);
    }
    return [...types].sort();
  }, [items]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width={dimensions.width} height={dimensions.height} onClick={handleBackgroundClick}>
        <g
          transform={`translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`}
          style={{ transition: camera ? 'none' : 'transform 0.5s ease-in-out' }}
        >
          {nodes.map((node) => {
            const d = node.data;
            const color = ITEM_TYPE_COLORS[d.type] || '#94a3b8';
            const hasChildren = !!(node.children && node.children.length > 0);
            const dimmed = (highlightType || highlightStatus) && !isHighlighted(d);
            const searchMatch = isSearchMatch(d);
            const isHovered = hoveredId === d.id;

            return (
              <g
                key={d.id}
                onClick={(e) => handleNodeClick(e, node)}
                onDoubleClick={(e) => handleDoubleClick(e, node)}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseMove={(e) => handleNodeMove(e, node)}
                onMouseLeave={handleNodeLeave}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={hasChildren ? color + '18' : color + '40'}
                  stroke={searchMatch ? '#facc15' : isHovered ? color : color + '80'}
                  strokeWidth={searchMatch ? 3 / viewTransform.scale : isHovered ? 2 / viewTransform.scale : 1 / viewTransform.scale}
                  opacity={dimmed ? 0.2 : 1}
                />
                {node.r * viewTransform.scale > 20 && (
                  <text
                    x={node.x}
                    y={hasChildren ? node.y - node.r + 14 / viewTransform.scale : node.y}
                    textAnchor="middle"
                    dominantBaseline={hasChildren ? 'hanging' : 'central'}
                    fontSize={Math.min(12 / viewTransform.scale, node.r * 0.4)}
                    fill={dimmed ? '#94a3b880' : (hasChildren ? color : '#374151')}
                    fontWeight={hasChildren ? 600 : 400}
                    pointerEvents="none"
                  >
                    {d.name.length > 30 ? d.name.slice(0, 28) + '...' : d.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && !isPanning.current && (
        <div
          className="absolute pointer-events-none bg-card border border-border rounded-md shadow-lg px-3 py-2 text-xs z-50 max-w-[250px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, transform: 'translateY(-100%)' }}
        >
          <p className="font-medium text-foreground truncate">{tooltip.node.name}</p>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ITEM_TYPE_COLORS[tooltip.node.type] || '#94a3b8' }}
              />
              {TYPE_LABELS[tooltip.node.type] || tooltip.node.type}
            </span>
            {tooltip.node.status && (
              <span>{tooltip.node.status}</span>
            )}
          </div>
        </div>
      )}

      {/* Zoom breadcrumb */}
      {zoomedNode && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 text-xs">
          <button
            onClick={(e) => { e.stopPropagation(); setZoomedNode(null); }}
            className="text-primary hover:underline"
          >
            Tout
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {nodes.find((n) => n.data.id === zoomedNode)?.data.name || ''}
          </span>
        </div>
      )}

      {/* Size mode selector */}
      <div data-tour="bubble-size" className="absolute top-2 right-2 flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-md px-1 py-1 text-xs">
        <span className="text-muted-foreground px-1">Taille :</span>
        {([['equal', 'Égale'], ['contributions', 'Contributions'], ['relations', 'Relations']] as [SizeMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={(e) => { e.stopPropagation(); setSizeMode(mode); }}
            className={`px-2 py-0.5 rounded transition-colors ${sizeMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 text-xs">
        {usedTypes.map((type) => (
          <span key={type} className="inline-flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ITEM_TYPE_COLORS[type] || '#94a3b8' }}
            />
            <span className="text-muted-foreground">{TYPE_LABELS[type] || type}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
