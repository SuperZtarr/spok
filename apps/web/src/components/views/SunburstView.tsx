import { useState, useEffect, useRef, useMemo, useCallback, type RefCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hierarchy, partition, HierarchyRectangularNode } from 'd3-hierarchy';
import { arc as d3arc } from 'd3-shape';
import { useSunburstData } from '../../hooks/useSunburstData';
import { communitiesApi } from '../../lib/api';
import type { SunburstNode } from '@spok/shared';

const COMMUNITY_FILTER_KEY = 'graph-community-filter';

const NODE_TYPE_COLORS: Record<string, string> = {
  global: '#64748b',
  community: '#ef4444',
  space: '#f59e0b',
};

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

function getNodeColor(d: HierarchyRectangularNode<SunburstNode>): string {
  const data = d.data;
  if (data.nodeType === 'item' && data.itemType) {
    return ITEM_TYPE_COLORS[data.itemType] || '#94a3b8';
  }
  return NODE_TYPE_COLORS[data.nodeType] || '#94a3b8';
}

function isAncestorOf(
  ancestor: HierarchyRectangularNode<SunburstNode>,
  node: HierarchyRectangularNode<SunburstNode>
): boolean {
  let current: HierarchyRectangularNode<SunburstNode> | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function getAncestorChain(node: HierarchyRectangularNode<SunburstNode>): HierarchyRectangularNode<SunburstNode>[] {
  const chain: HierarchyRectangularNode<SunburstNode>[] = [];
  let current: HierarchyRectangularNode<SunburstNode> | null = node;
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain;
}

interface SunburstViewProps {
  spaceId?: string;
  spaceName?: string;
  onNodeClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  additionalSpaceIds?: string[];
}

export function SunburstView({ spaceId, spaceName, onNodeClick, highlightType, highlightStatus, searchMatchIds, additionalSpaceIds }: SunburstViewProps = {}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<HierarchyRectangularNode<SunburstNode> | null>(null);

  // Callback ref to attach ResizeObserver when the container mounts
  const containerCallbackRef: RefCallback<HTMLDivElement> = useCallback((node) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    containerRef.current = node;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w > 0 && h > 0) setDimensions({ width: w, height: h });
    };

    updateSize();
    setTimeout(updateSize, 100);

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    observerRef.current = observer;

    const handleResize = () => updateSize();
    window.addEventListener('resize', handleResize);
    // Store cleanup ref
    (node as any).__cleanupResize = () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup window resize listener on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (containerRef.current && (containerRef.current as any).__cleanupResize) {
        (containerRef.current as any).__cleanupResize();
      }
    };
  }, []);

  // Community filter (global mode only)
  const { data: userCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
    enabled: !spaceId,
  });

  const [selectedCommunityIds, setSelectedCommunityIds] = useState<Set<string> | null>(() => {
    try {
      const saved = localStorage.getItem(COMMUNITY_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    if (userCommunities && selectedCommunityIds === null) {
      setSelectedCommunityIds(new Set(userCommunities.map(c => c.id)));
    }
  }, [userCommunities, selectedCommunityIds]);

  useEffect(() => {
    if (selectedCommunityIds) {
      localStorage.setItem(COMMUNITY_FILTER_KEY, JSON.stringify([...selectedCommunityIds]));
    }
  }, [selectedCommunityIds]);

  const toggleCommunity = (id: string) => {
    setSelectedCommunityIds(prev => {
      const current = prev || new Set(userCommunities?.map(c => c.id) || []);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Set of portal space IDs for visual distinction
  const portalSpaceIdSet = useMemo(() => new Set(additionalSpaceIds || []), [additionalSpaceIds]);

  // Check if a sunburst node is inside a portal space subtree
  const isPortalNode = useCallback((d: HierarchyRectangularNode<SunburstNode>): boolean => {
    if (portalSpaceIdSet.size === 0) return false;
    let current: HierarchyRectangularNode<SunburstNode> | null = d;
    while (current) {
      if (current.data.nodeType === 'space' && portalSpaceIdSet.has(current.data.id)) return true;
      current = current.parent;
    }
    return false;
  }, [portalSpaceIdSet]);

  const communityIdsFilter = useMemo(() => {
    if (!selectedCommunityIds || !userCommunities) return undefined;
    if (selectedCommunityIds.size === userCommunities.length) return undefined;
    return [...selectedCommunityIds];
  }, [selectedCommunityIds, userCommunities]);

  const { data: sunburstData, isLoading } = useSunburstData(
    spaceId ? undefined : communityIdsFilter,
    spaceId,
    spaceId ? additionalSpaceIds : undefined
  );

  // Build partition layout
  const { root, slices } = useMemo(() => {
    if (!sunburstData) return { root: null, slices: [] };

    const root = hierarchy<SunburstNode>(sunburstData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const radius = Math.min(dimensions.width, dimensions.height) / 2;

    partition<SunburstNode>()
      .size([2 * Math.PI, radius])
      (root);

    const slices = root.descendants().filter(d => d.depth > 0) as HierarchyRectangularNode<SunburstNode>[];

    return { root: root as HierarchyRectangularNode<SunburstNode>, slices };
  }, [sunburstData, dimensions]);

  const arcGenerator = useMemo(() => {
    return d3arc<HierarchyRectangularNode<SunburstNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(Math.min(dimensions.width, dimensions.height) / 4)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1 - 1);
  }, [dimensions]);

  const handleClick = useCallback((d: HierarchyRectangularNode<SunburstNode>) => {
    const data = d.data;
    if (spaceId && onNodeClick && data.nodeType === 'item') {
      onNodeClick(data.id);
      return;
    }
    if (data.nodeType === 'space') {
      navigate(`/spaces/${data.id}/content`);
    } else if (data.nodeType === 'community' && data.id !== 'personal') {
      navigate(`/communities/${data.id}`);
    }
  }, [navigate, spaceId, onNodeClick]);

  // Breadcrumb info
  const breadcrumb = useMemo(() => {
    if (!hoveredNode || !root) return null;
    const chain = getAncestorChain(hoveredNode);
    const percentage = root.value ? ((hoveredNode.value || 0) / root.value * 100) : 0;
    return { chain, percentage };
  }, [hoveredNode, root]);

  if (isLoading) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Chargement du sunburst...
        </div>
      </div>
    );
  }

  if (!sunburstData || slices.length === 0) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Aucune donnee a afficher.
        </div>
      </div>
    );
  }

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const centerLabel = spaceId ? (spaceName || 'Espace') : 'SPOK';

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div ref={containerCallbackRef} className="absolute inset-0">
        {/* Breadcrumb overlay */}
        {breadcrumb && (
          <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur border rounded-lg px-3 py-2 shadow-lg max-w-md">
            <div className="flex items-center gap-1.5 text-sm flex-wrap">
              {breadcrumb.chain.map((node, i) => (
                <span key={node.data.id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground">/</span>}
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getNodeColor(node) }}
                  />
                  <span className={i === breadcrumb.chain.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
                    {node.data.name}
                  </span>
                </span>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {breadcrumb.percentage.toFixed(1)}% du total
              {hoveredNode?.value ? ` — ${hoveredNode.value} contribution${hoveredNode.value > 1 ? 's' : ''}` : ''}
            </div>
          </div>
        )}

        {/* Community filter panel (global mode only) */}
        {!spaceId && userCommunities && userCommunities.length > 1 && (
          <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur border rounded-lg p-3 shadow-lg">
            <div className="text-xs font-medium text-muted-foreground mb-2">Communautes</div>
            {userCommunities.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={selectedCommunityIds?.has(c.id) ?? true}
                  onChange={() => toggleCommunity(c.id)}
                  className="rounded"
                />
                <span
                  className="w-2 h-2 inline-block rounded-full flex-shrink-0"
                  style={{ backgroundColor: NODE_TYPE_COLORS.community }}
                />
                <span className="truncate max-w-[120px]">{c.name}</span>
              </label>
            ))}
            <div className="border-t mt-2 pt-2 text-[10px] text-muted-foreground">
              {slices.length} segments
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur border rounded-lg p-2 shadow-lg">
          <div className="text-[10px] font-medium text-muted-foreground mb-1">Legende</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {!spaceId && Object.entries(NODE_TYPE_COLORS).filter(([k]) => k !== 'global').map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="capitalize">{key === 'community' ? 'Communaute' : 'Espace'}</span>
              </div>
            ))}
            {Object.entries(ITEM_TYPE_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span>{key}</span>
              </div>
            ))}
          </div>
        </div>

        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="cursor-pointer"
        >
          <g transform={`translate(${cx},${cy})`}>
            {slices.map((d) => {
              const path = arcGenerator(d);
              if (!path) return null;

              const isHoverHighlighted = !hoveredNode || isAncestorOf(d, hoveredNode) || isAncestorOf(hoveredNode, d) || d === hoveredNode;
              const color = getNodeColor(d);
              const isPortal = isPortalNode(d);

              // Filter highlight: dim items that don't match the active filter
              const hasFilterHighlight = !!(highlightType || highlightStatus || searchMatchIds);
              const isItem = d.data.nodeType === 'item';
              const matchesTypeStatus = !highlightType && !highlightStatus || !isItem ||
                (highlightType && d.data.itemType === highlightType) ||
                (highlightStatus && (d.data.status === highlightStatus || (highlightStatus === 'undefined' && !d.data.status)));
              const matchesSearch = !searchMatchIds || !isItem || searchMatchIds.has(d.data.id);
              const isSearchMatch = !!(searchMatchIds && isItem && searchMatchIds.has(d.data.id));
              const filterDimmed = hasFilterHighlight && isItem && !(matchesTypeStatus && matchesSearch);

              // Combine both highlight logics
              let opacity: number;
              if (filterDimmed) {
                opacity = 0.1;
              } else if (hoveredNode) {
                opacity = isHoverHighlighted ? 0.9 : 0.15;
              } else {
                opacity = isPortal ? 0.65 : 0.85;
              }

              return (
                <path
                  key={d.data.id + '-' + d.depth}
                  d={path}
                  fill={color}
                  fillOpacity={opacity}
                  stroke={isSearchMatch ? '#facc15' : isPortal ? '#94a3b8' : 'var(--background)'}
                  strokeWidth={isSearchMatch ? 2.5 : isPortal ? 1.5 : 0.5}
                  strokeDasharray={isPortal && !isSearchMatch ? '4 2' : undefined}
                  onMouseEnter={() => setHoveredNode(d)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleClick(d)}
                  style={{ transition: 'fill-opacity 0.2s' }}
                />
              );
            })}
            {/* Center text */}
            <text
              textAnchor="middle"
              dy="0.35em"
              className="fill-foreground font-semibold text-sm pointer-events-none"
            >
              {centerLabel}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
