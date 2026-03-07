import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
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

interface TreeNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  children: TreeNode[];
}

interface RadialTreeViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
}

function buildTree(items: Item[]): TreeNode {
  const childrenMap = new Map<string | null, Item[]>();
  for (const item of items) {
    const parentId = item.parentId || null;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(item);
  }

  function buildNode(item: Item): TreeNode {
    const children = (childrenMap.get(item.id) || []).map(buildNode);
    return {
      id: item.id,
      name: item.title || 'Sans titre',
      type: item.type,
      status: item.status || undefined,
      children,
    };
  }

  const roots = (childrenMap.get(null) || []).map(buildNode);

  return {
    id: '__root__',
    name: 'Espace',
    type: 'ROOT',
    children: roots,
  };
}

// Convert radial coordinates (angle, radius) to cartesian (x, y)
function radialPoint(angle: number, radius: number): [number, number] {
  // d3 tree gives x as angle in [0, 2π) and y as radius
  return [radius * Math.cos(angle - Math.PI / 2), radius * Math.sin(angle - Math.PI / 2)];
}

// Generate a curved path between two radial points
function linkRadial(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const [sx, sy] = radialPoint(source.x, source.y);
  const [tx, ty] = radialPoint(target.x, target.y);

  // Curved link
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  // Pull the midpoint slightly toward the center for a nice curve
  const pullFactor = 0.85;
  const cx = mx * pullFactor;
  const cy = my * pullFactor;

  return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
}

export function RadialTreeView({
  items,
  onItemClick,
  highlightType,
  highlightStatus,
  searchMatchIds,
}: RadialTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  // Camera state for zoom/pan
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

  const rootData = useMemo(() => buildTree(items), [items]);

  // d3 tree layout in radial mode
  const { nodes, links } = useMemo(() => {
    const root = hierarchy(rootData);
    const radius = Math.min(dimensions.width, dimensions.height) / 2 - 40;

    // d3.tree with radial: x is angle [0, 2π], y is radius [0, radius]
    const treeLayout = tree<TreeNode>()
      .size([2 * Math.PI, Math.max(radius, 100)])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth || 1);

    const layoutRoot = treeLayout(root);

    const allNodes: HierarchyPointNode<TreeNode>[] = [];
    layoutRoot.each((node) => allNodes.push(node));

    const allLinks = layoutRoot.links();

    return { nodes: allNodes, links: allLinks };
  }, [rootData, dimensions]);

  // Center transform
  const baseTransform = useMemo(() => ({
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    scale: 1,
  }), [dimensions]);

  const viewTransform = camera || baseTransform;

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const current = camera || baseTransform;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(20, current.scale * factor));

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

  const handleNodeClick = useCallback((e: React.MouseEvent, node: HierarchyPointNode<TreeNode>) => {
    e.stopPropagation();
    if (node.data.id === '__root__') return;
    if (onItemClick) {
      onItemClick(node.data.id);
    }
  }, [onItemClick]);

  // Tooltip
  const handleNodeEnter = useCallback((e: React.MouseEvent, node: HierarchyPointNode<TreeNode>) => {
    if (node.data.id === '__root__') return;
    setHoveredId(node.data.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: node.data });
    }
  }, []);

  const handleNodeMove = useCallback((e: React.MouseEvent, node: HierarchyPointNode<TreeNode>) => {
    if (isPanning.current || node.data.id === '__root__') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: node.data });
    }
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredId(null);
    setTooltip(null);
  }, []);

  const isHighlighted = useCallback((node: TreeNode) => {
    if (highlightType && node.type !== highlightType) return false;
    if (highlightStatus && node.status !== highlightStatus) return false;
    return true;
  }, [highlightType, highlightStatus]);

  const isSearchMatch = useCallback((node: TreeNode) => {
    return searchMatchIds?.has(node.id) ?? false;
  }, [searchMatchIds]);

  // Types used for legend
  const usedTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) {
      types.add(item.type);
    }
    return [...types].sort();
  }, [items]);

  const nodeRadius = 6;

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
      <svg width={dimensions.width} height={dimensions.height}>
        <g
          transform={`translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`}
          style={{ transition: camera ? 'none' : 'transform 0.3s ease-in-out' }}
        >
          {/* Links */}
          {links.map((link) => {
            if (link.source.data.id === '__root__' && link.target.data.id === '__root__') return null;
            const dimmed = (highlightType || highlightStatus) && !isHighlighted(link.target.data);
            return (
              <path
                key={`${link.source.data.id}-${link.target.data.id}`}
                d={linkRadial(link.source, link.target)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5 / viewTransform.scale}
                opacity={dimmed ? 0.1 : 0.4}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const d = node.data;
            if (d.id === '__root__') {
              // Root node (center)
              const [x, y] = [0, 0]; // root is at center
              return (
                <g key={d.id}>
                  <circle
                    cx={x} cy={y}
                    r={10 / viewTransform.scale}
                    fill="hsl(var(--primary))"
                    opacity={0.8}
                  />
                  <text
                    x={x} y={y - 16 / viewTransform.scale}
                    textAnchor="middle"
                    fontSize={12 / viewTransform.scale}
                    fill="hsl(var(--primary))"
                    fontWeight={600}
                  >
                    {d.name}
                  </text>
                </g>
              );
            }

            const [x, y] = radialPoint(node.x, node.y);
            const color = ITEM_TYPE_COLORS[d.type] || '#94a3b8';
            const dimmed = (highlightType || highlightStatus) && !isHighlighted(d);
            const searchMatch = isSearchMatch(d);
            const isHovered = hoveredId === d.id;
            const hasChildren = !!(node.children && node.children.length > 0);

            // Label rotation: keep text readable
            const angleDeg = (node.x * 180 / Math.PI) - 90;
            const flip = node.x >= Math.PI; // flip text on the left side
            const labelAngle = flip ? angleDeg + 180 : angleDeg;
            const labelAnchor = flip ? 'end' : 'start';
            const labelOffset = (nodeRadius + 4) / viewTransform.scale;
            const labelDx = flip ? -labelOffset : labelOffset;

            return (
              <g
                key={d.id}
                transform={`translate(${x},${y})`}
                onClick={(e) => handleNodeClick(e, node)}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseMove={(e) => handleNodeMove(e, node)}
                onMouseLeave={handleNodeLeave}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={(isHovered ? nodeRadius + 2 : nodeRadius) / viewTransform.scale}
                  fill={hasChildren ? color + '60' : color}
                  stroke={searchMatch ? '#facc15' : isHovered ? color : 'none'}
                  strokeWidth={(searchMatch ? 3 : 2) / viewTransform.scale}
                  opacity={dimmed ? 0.15 : 1}
                />
                {nodeRadius * viewTransform.scale > 3 && (
                  <text
                    transform={`rotate(${labelAngle})`}
                    dx={labelDx}
                    dy={3 / viewTransform.scale}
                    textAnchor={labelAnchor}
                    fontSize={Math.min(11, 11 / viewTransform.scale)}
                    fill={dimmed ? '#94a3b880' : '#374151'}
                    fontWeight={hasChildren ? 600 : 400}
                    pointerEvents="none"
                  >
                    {d.name.length > 25 ? d.name.slice(0, 23) + '…' : d.name}
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
