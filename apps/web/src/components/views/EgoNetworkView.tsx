import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Item, ItemType, ItemRelation, SpaceReferentiels } from '@spok/shared';
import { RelationCommentIconSvg } from '../RelationCommentIcon';

interface EgoNetworkViewProps {
  items: Item[];
  relations: ItemRelation[];
  onEdit: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

const TYPE_COLORS: Record<string, string> = {
  NOTE: '#3b82f6',
  TASK: '#22c55e',
  PROJECT: '#8b5cf6',
  MEETING: '#f59e0b',
  PERIOD: '#06b6d4',
  LINK: '#6366f1',
  CONFIG: '#6b7280',
  DOCUMENT: '#78716c',
  IMAGE: '#ec4899',
  BUG: '#ef4444',
};

interface NodePos {
  id: string;
  x: number;
  y: number;
  depth: number;
  item: Item;
}

interface Edge {
  from: string;
  to: string;
  type: 'relation' | 'hierarchy';
  label?: string;
}

export function EgoNetworkView({ items, relations, onEdit, highlightType, highlightStatus, searchMatchIds }: EgoNetworkViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [centerId, setCenterId] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: Item } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-select center: most connected item
  useEffect(() => {
    if (centerId && items.find(i => i.id === centerId)) return;
    if (items.length === 0) return;

    // Count connections per item
    const connections = new Map<string, number>();
    for (const item of items) {
      connections.set(item.id, 0);
      if (item.parentId) {
        connections.set(item.parentId, (connections.get(item.parentId) || 0) + 1);
      }
    }
    for (const rel of relations) {
      connections.set(rel.fromItemId, (connections.get(rel.fromItemId) || 0) + 1);
      connections.set(rel.toItemId, (connections.get(rel.toItemId) || 0) + 1);
    }

    let bestId = items[0].id;
    let bestCount = 0;
    for (const item of items) {
      const count = connections.get(item.id) || 0;
      if (count > bestCount) {
        bestCount = count;
        bestId = item.id;
      }
    }
    setCenterId(bestId);
  }, [items, relations, centerId]);

  // Build adjacency and BFS to get neighbors at depth N
  const { nodes, edges, itemMap } = useMemo(() => {
    const iMap = new Map<string, Item>();
    for (const item of items) iMap.set(item.id, item);

    if (!centerId || !iMap.has(centerId)) {
      return { nodes: [] as NodePos[], edges: [] as Edge[], itemMap: iMap };
    }

    // Build adjacency list
    const adj = new Map<string, Set<string>>();
    const edgeSet = new Map<string, Edge>();

    const addEdge = (a: string, b: string, type: 'relation' | 'hierarchy') => {
      if (!iMap.has(a) || !iMap.has(b)) return;
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
      const key = [a, b].sort().join('-');
      if (!edgeSet.has(key)) edgeSet.set(key, { from: a, to: b, type });
    };

    // Hierarchy edges
    for (const item of items) {
      if (item.parentId && iMap.has(item.parentId)) {
        addEdge(item.id, item.parentId, 'hierarchy');
      }
    }

    // Relation edges
    for (const rel of relations) {
      if (!iMap.has(rel.fromItemId) || !iMap.has(rel.toItemId)) continue;
      if (!adj.has(rel.fromItemId)) adj.set(rel.fromItemId, new Set());
      if (!adj.has(rel.toItemId)) adj.set(rel.toItemId, new Set());
      adj.get(rel.fromItemId)!.add(rel.toItemId);
      adj.get(rel.toItemId)!.add(rel.fromItemId);
      const key = [rel.fromItemId, rel.toItemId].sort().join('-');
      if (!edgeSet.has(key)) edgeSet.set(key, { from: rel.fromItemId, to: rel.toItemId, type: 'relation', label: rel.label ?? undefined });
    }

    // BFS from center
    const visited = new Map<string, number>(); // id -> depth
    const queue: { id: string; d: number }[] = [{ id: centerId, d: 0 }];
    visited.set(centerId, 0);

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d >= depth) continue;
      const neighbors = adj.get(id);
      if (!neighbors) continue;
      for (const nid of neighbors) {
        if (!visited.has(nid)) {
          visited.set(nid, d + 1);
          queue.push({ id: nid, d: d + 1 });
        }
      }
    }

    // Layout: concentric rings
    const cx = containerSize.width / 2;
    const cy = (containerSize.height - 48) / 2; // account for controls
    const maxRadius = Math.min(cx, cy) - 60;

    // Group by depth
    const depthGroups = new Map<number, string[]>();
    for (const [id, d] of visited) {
      if (!depthGroups.has(d)) depthGroups.set(d, []);
      depthGroups.get(d)!.push(id);
    }

    const nodePositions: NodePos[] = [];

    // Center node
    const centerItem = iMap.get(centerId)!;
    nodePositions.push({ id: centerId, x: cx, y: cy, depth: 0, item: centerItem });

    // Ring nodes
    for (let d = 1; d <= depth; d++) {
      const group = depthGroups.get(d) || [];
      if (group.length === 0) continue;
      const ringRadius = (d / depth) * maxRadius;
      const angleStep = (2 * Math.PI) / group.length;
      const startAngle = -Math.PI / 2; // start from top

      group.forEach((id, i) => {
        const angle = startAngle + i * angleStep;
        nodePositions.push({
          id,
          x: cx + ringRadius * Math.cos(angle),
          y: cy + ringRadius * Math.sin(angle),
          depth: d,
          item: iMap.get(id)!,
        });
      });
    }

    // Filter edges to only include visible nodes
    const visibleIds = new Set(visited.keys());
    const visibleEdges = [...edgeSet.values()].filter(
      e => visibleIds.has(e.from) && visibleIds.has(e.to)
    );

    return { nodes: nodePositions, edges: visibleEdges, itemMap: iMap };
  }, [centerId, depth, items, relations, containerSize]);

  const nodeRadius = useMemo(() => {
    if (nodes.length <= 10) return 24;
    if (nodes.length <= 30) return 18;
    return 14;
  }, [nodes.length]);

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) m.set(n.id, { x: n.x, y: n.y });
    return m;
  }, [nodes]);

  const handleNodeClick = useCallback((id: string) => {
    setCenterId(id);
    setTooltip(null);
  }, []);

  const handleNodeDblClick = useCallback((id: string) => {
    onEdit(id);
  }, [onEdit]);

  // Filtered items for dropdown
  const dropdownItems = useMemo(() => {
    if (!searchTerm) return items.slice(0, 50);
    const lower = searchTerm.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(lower)).slice(0, 50);
  }, [items, searchTerm]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const centerItem = centerId ? itemMap.get(centerId) : null;
  const svgH = containerSize.height - 48;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div data-tour="ego-controls" className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-sm flex-shrink-0">
        {/* Center item selector */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-3 py-1 border rounded bg-background text-sm max-w-[250px] truncate text-left"
          >
            {centerItem ? centerItem.title : 'Sélectionner un item...'}
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-[280px] border border-border bg-card rounded-md shadow-lg">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="w-full px-3 py-2 text-sm border-b bg-background outline-none"
                autoFocus
              />
              <div className="max-h-[200px] overflow-y-auto">
                {dropdownItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCenterId(item.id);
                      setDropdownOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                      item.id === centerId ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[item.type] || '#6b7280' }}
                    />
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
                {dropdownItems.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Depth slider */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Profondeur :</label>
          <input
            type="range"
            min={1}
            max={3}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs font-medium w-4">{depth}</span>
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span>{nodes.length} nœuds</span>
          <span>{edges.length} liens</span>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Aucun élément à afficher
          </div>
        ) : (
          <svg width={containerSize.width} height={svgH}>
            {/* Ring guides */}
            {Array.from({ length: depth }, (_, i) => {
              const d = i + 1;
              const cx = containerSize.width / 2;
              const cy = svgH / 2;
              const maxR = Math.min(cx, cy) - 60;
              const r = (d / depth) * maxR;
              return (
                <circle
                  key={d}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.06}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = posMap.get(edge.from);
              const to = posMap.get(edge.to);
              if (!from || !to) return null;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              const fromItem = itemMap.get(edge.from);
              const toItem = itemMap.get(edge.to);
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={edge.type === 'hierarchy' ? '#94a3b8' : '#a855f7'}
                    strokeWidth={edge.type === 'hierarchy' ? 1.5 : 1}
                    strokeOpacity={0.4}
                    strokeDasharray={edge.type === 'relation' ? '4 2' : undefined}
                  />
                  {edge.type === 'relation' && edge.label && (
                    <RelationCommentIconSvg
                      x={mx} y={my}
                      label={edge.label}
                      relationType="relates"
                      fromTitle={fromItem?.title || edge.from}
                      toTitle={toItem?.title || edge.to}
                    />
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const color = TYPE_COLORS[node.item.type] || '#6b7280';
              const isCenter = node.depth === 0;
              const r = isCenter ? nodeRadius + 6 : nodeRadius;
              const isHighlighted =
                (highlightType && node.item.type === highlightType) ||
                (highlightStatus && (highlightStatus === 'undefined' ? !node.item.status : node.item.status === highlightStatus));
              const isDimmed =
                (highlightType && node.item.type !== highlightType) ||
                (highlightStatus && (highlightStatus === 'undefined' ? !!node.item.status : node.item.status !== highlightStatus)) ||
                (searchMatchIds && !searchMatchIds.has(node.id));
              const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(node.id));

              // Truncate title
              const maxChars = r > 20 ? 12 : 8;
              const label = node.item.title.length > maxChars
                ? node.item.title.slice(0, maxChars - 1) + '…'
                : node.item.title;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node.id)}
                  onDoubleClick={() => handleNodeDblClick(node.id)}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 10,
                        item: node.item,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  opacity={isDimmed ? 0.2 : 1}
                >
                  {/* Ring highlight for center */}
                  {isCenter && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 4}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeOpacity={0.5}
                    />
                  )}
                  {/* Search highlight */}
                  {isSearchMatch && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 3}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth={2}
                    />
                  )}
                  {/* Filter highlight */}
                  {isHighlighted && !isSearchMatch && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 3}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  )}
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={color}
                    fillOpacity={isCenter ? 0.9 : 0.15}
                    stroke={color}
                    strokeWidth={isCenter ? 2.5 : 1.5}
                  />
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground pointer-events-none"
                    style={{ fontSize: isCenter ? 11 : 9, fontWeight: isCenter ? 600 : 400 }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(12, ${svgH - 50})`}>
              <line x1={0} y1={0} x2={20} y2={0} stroke="#94a3b8" strokeWidth={1.5} />
              <text x={24} y={4} className="fill-muted-foreground" style={{ fontSize: 10 }}>Hiérarchie</text>
              <line x1={0} y1={16} x2={20} y2={16} stroke="#a855f7" strokeWidth={1} strokeDasharray="4 2" />
              <text x={24} y={20} className="fill-muted-foreground" style={{ fontSize: 10 }}>Relation</text>
            </g>
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 px-3 py-2 rounded-lg shadow-lg border bg-popover text-popover-foreground text-xs pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="font-medium">{tooltip.item.title}</div>
            <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[tooltip.item.type] || '#6b7280' }}
              />
              <span>{tooltip.item.type}</span>
              {tooltip.item.status && <span>• {tooltip.item.status}</span>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Clic = recentrer • Double-clic = éditer</div>
          </div>
        )}
      </div>
    </div>
  );
}
