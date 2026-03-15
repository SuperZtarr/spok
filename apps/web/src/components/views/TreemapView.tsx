import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
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

type SizeMode = 'children' | 'contributions' | 'equal';

interface TreeNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  children: TreeNode[];
  value: number;
}

interface TreemapViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
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
    if (sizeMode === 'children') {
      // Count all descendants recursively
      function countDescendants(id: string): number {
        const kids = childrenMap.get(id) || [];
        return kids.length + kids.reduce((sum, k) => sum + countDescendants(k.id), 0);
      }
      return Math.max(1, countDescendants(item.id) + 1);
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
    name: 'Espace',
    type: 'ROOT',
    children: roots,
    value: 0,
  };
}

export function TreemapView({
  items,
  onItemClick,
  highlightType,
  highlightStatus,
  searchMatchIds,
}: TreemapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode; depth: number } | null>(null);
  const [zoomedNodeId, setZoomedNodeId] = useState<string | null>(null);
  const [sizeMode, setSizeMode] = useState<SizeMode>('children');

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

  const treemapRoot = useMemo(() => {
    const root = hierarchy(rootData)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(d.value, 1)))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    treemap<TreeNode>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .paddingTop(22)
      .round(true)
      .tile(treemapSquarify)(root);

    return root as HierarchyRectangularNode<TreeNode>;
  }, [rootData, dimensions]);

  // Find zoomed subtree
  const displayRoot = useMemo(() => {
    if (!zoomedNodeId) return treemapRoot;
    let found: HierarchyRectangularNode<TreeNode> | null = null;
    treemapRoot.each((node) => {
      if (node.data.id === zoomedNodeId) found = node;
    });
    if (!found) return treemapRoot;

    // Recompute treemap for the subtree
    const subtreeData = (found as HierarchyRectangularNode<TreeNode>).data;
    const subRoot = hierarchy(subtreeData)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : Math.max(d.value, 1)))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    treemap<TreeNode>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .paddingTop(22)
      .round(true)
      .tile(treemapSquarify)(subRoot);

    return subRoot as HierarchyRectangularNode<TreeNode>;
  }, [zoomedNodeId, treemapRoot, dimensions]);

  // Collect all visible nodes (skip root)
  const visibleNodes = useMemo(() => {
    const nodes: HierarchyRectangularNode<TreeNode>[] = [];
    displayRoot.each((node) => {
      if (node.data.id !== '__root__' || zoomedNodeId) {
        nodes.push(node);
      }
    });
    return nodes;
  }, [displayRoot, zoomedNodeId]);

  const handleNodeClick = useCallback((e: React.MouseEvent, node: HierarchyRectangularNode<TreeNode>) => {
    e.stopPropagation();
    if (node.data.id === '__root__') return;

    if (node.children && node.children.length > 0) {
      // Zoom into this node
      setZoomedNodeId((prev) => (prev === node.data.id ? null : node.data.id));
    } else if (onItemClick) {
      onItemClick(node.data.id);
    }
  }, [onItemClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, node: HierarchyRectangularNode<TreeNode>) => {
    e.stopPropagation();
    if (node.data.id === '__root__') return;
    if (onItemClick) onItemClick(node.data.id);
  }, [onItemClick]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, node: HierarchyRectangularNode<TreeNode>, depth: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      node: node.data,
      depth,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Controls */}
      <div data-tour="treemap-mode" className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Taille :</span>
        {([
          { value: 'children' as SizeMode, label: 'Enfants' },
          { value: 'contributions' as SizeMode, label: 'Contributions' },
          { value: 'equal' as SizeMode, label: 'Égal' },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSizeMode(opt.value)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              sizeMode === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {zoomedNodeId && (
          <>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setZoomedNodeId(null)}
              className="px-2 py-0.5 rounded text-xs bg-muted hover:bg-accent transition-colors"
            >
              Zoom arrière
            </button>
          </>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const hasItems = items.some((i) => i.type === type);
            if (!hasItems) return null;
            return (
              <div key={type} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: ITEM_TYPE_COLORS[type] }}
                />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Treemap */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden cursor-default"
        style={{ userSelect: 'none' }}
      >
        <svg width={dimensions.width} height={dimensions.height}>
          {visibleNodes.map((node) => {
            const w = node.x1 - node.x0;
            const h = node.y1 - node.y0;
            if (w < 1 || h < 1) return null;

            const hasChildren = !!(node.children && node.children.length > 0);
            const color = ITEM_TYPE_COLORS[node.data.type] || '#94a3b8';
            const isLeaf = !hasChildren;
            const depth = node.depth;

            // Highlight/dim logic
            const isDimmed =
              (highlightType && node.data.type !== highlightType) ||
              (highlightStatus && node.data.status !== highlightStatus);
            const isSearchMatch = searchMatchIds?.has(node.data.id);

            const opacity = isDimmed ? 0.15 : 1;
            const fillColor = isLeaf ? color : 'transparent';
            const fillOpacity = isLeaf ? (isDimmed ? 0.1 : 0.7) : 0;

            const showLabel = w > 30 && h > 16;
            const showHeaderLabel = hasChildren && w > 40 && h > 20;

            return (
              <g
                key={node.data.id}
                opacity={opacity}
                onClick={(e) => handleNodeClick(e, node)}
                onDoubleClick={(e) => handleDoubleClick(e, node)}
                onMouseEnter={(e) => handleMouseEnter(e, node, depth)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: hasChildren ? 'pointer' : onItemClick ? 'pointer' : 'default' }}
              >
                {/* Rectangle */}
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={w}
                  height={h}
                  fill={fillColor}
                  fillOpacity={fillOpacity}
                  stroke={isSearchMatch ? '#facc15' : hasChildren ? color : 'rgba(0,0,0,0.1)'}
                  strokeWidth={isSearchMatch ? 2.5 : hasChildren ? 1.5 : 0.5}
                  rx={isLeaf ? 2 : 3}
                />

                {/* Group header label */}
                {showHeaderLabel && (
                  <text
                    x={node.x0 + 4}
                    y={node.y0 + 14}
                    fill={color}
                    fontSize={11}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    <tspan>{node.data.name.length > Math.floor(w / 6) ? node.data.name.slice(0, Math.floor(w / 6)) + '…' : node.data.name}</tspan>
                  </text>
                )}

                {/* Leaf label */}
                {isLeaf && showLabel && (
                  <text
                    x={node.x0 + w / 2}
                    y={node.y0 + h / 2 + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize={Math.min(11, h / 2.5)}
                    fontWeight={500}
                    style={{ pointerEvents: 'none' }}
                  >
                    <tspan>{node.data.name.length > Math.floor(w / 7) ? node.data.name.slice(0, Math.floor(w / 7)) + '…' : node.data.name}</tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm z-50"
            style={{
              left: Math.min(tooltip.x + 12, dimensions.width - 200),
              top: Math.min(tooltip.y + 12, dimensions.height - 80),
            }}
          >
            <div className="font-medium">{tooltip.node.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: ITEM_TYPE_COLORS[tooltip.node.type] || '#94a3b8' }}
              />
              {TYPE_LABELS[tooltip.node.type] || tooltip.node.type}
              {tooltip.node.status && <span>· {tooltip.node.status}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
