import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { chord, ribbon } from 'd3-chord';
import { arc as d3Arc } from 'd3-shape';
import type { Item, ItemRelation } from '@spok/shared';

interface ChordViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

type GroupMode = 'type' | 'space';

const TYPE_COLORS: Record<string, string> = {
  NOTE: '#3b82f6',
  PROJECT: '#a855f7',
  TASK: '#22c55e',
  MEETING: '#f97316',
  PERIOD: '#14b8a6',
  LINK: '#6366f1',
  DOCUMENT: '#06b6d4',
  IMAGE: '#ec4899',
  BUG: '#ef4444',
  CONFIG: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
  BUG: 'Anomalie',
  CONFIG: 'Config',
};

// Generate distinct colors for spaces
const SPACE_PALETTE = [
  '#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ef4444',
  '#14b8a6', '#ec4899', '#6366f1', '#eab308', '#06b6d4',
  '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#64748b',
];

interface ChordData {
  labels: string[];
  colors: string[];
  matrix: number[][];
  ids: string[];
}

function buildChordData(
  items: Item[],
  mode: GroupMode,
): ChordData {
  // Build item lookup
  const itemMap = new Map<string, Item>();
  for (const item of items) itemMap.set(item.id, item);

  // Collect all relations
  const relations: ItemRelation[] = [];
  for (const item of items) {
    const itemWithRels = item as any;
    if (itemWithRels.relationsFrom) {
      for (const rel of itemWithRels.relationsFrom) {
        relations.push(rel);
      }
    }
  }

  if (mode === 'type') {
    // Group by item type
    const types = [...new Set(items.map((i) => i.type))].sort();
    const typeIndex = new Map<string, number>();
    types.forEach((t, i) => typeIndex.set(t, i));

    const matrix = types.map(() => types.map(() => 0));

    for (const rel of relations) {
      const from = itemMap.get(rel.fromItemId);
      const to = itemMap.get(rel.toItemId);
      if (!from || !to) continue;

      const fi = typeIndex.get(from.type);
      const ti = typeIndex.get(to.type);
      if (fi === undefined || ti === undefined) continue;

      matrix[fi][ti]++;
      if (fi !== ti) matrix[ti][fi]++;
    }

    return {
      labels: types.map((t) => TYPE_LABELS[t] || t),
      colors: types.map((t) => TYPE_COLORS[t] || '#94a3b8'),
      matrix,
      ids: types,
    };
  } else {
    // Group by space
    const spaceMap = new Map<string, string>();
    for (const item of items) {
      const spaceId = (item as any).spaceId;
      const spaceName = (item as any).spaceName || spaceId;
      if (spaceId && !spaceMap.has(spaceId)) {
        spaceMap.set(spaceId, spaceName);
      }
    }

    const spaceIds = [...spaceMap.keys()];
    const spaceIndex = new Map<string, number>();
    spaceIds.forEach((s, i) => spaceIndex.set(s, i));

    const matrix = spaceIds.map(() => spaceIds.map(() => 0));

    for (const rel of relations) {
      const from = itemMap.get(rel.fromItemId);
      const to = itemMap.get(rel.toItemId);
      if (!from || !to) continue;

      const fi = spaceIndex.get((from as any).spaceId);
      const ti = spaceIndex.get((to as any).spaceId);
      if (fi === undefined || ti === undefined) continue;

      matrix[fi][ti]++;
      if (fi !== ti) matrix[ti][fi]++;
    }

    return {
      labels: spaceIds.map((id) => spaceMap.get(id) || id),
      colors: spaceIds.map((_, i) => SPACE_PALETTE[i % SPACE_PALETTE.length]),
      matrix,
      ids: spaceIds,
    };
  }
}

// Also count hierarchy links (parent→child) for chord
function buildChordDataWithHierarchy(
  items: Item[],
  mode: GroupMode,
): ChordData {
  const data = buildChordData(items, mode);

  // Add parent→child as connections
  const itemMap = new Map<string, Item>();
  for (const item of items) itemMap.set(item.id, item);

  if (mode === 'type') {
    const typeIndex = new Map<string, number>();
    data.ids.forEach((t, i) => typeIndex.set(t, i));

    for (const item of items) {
      if (!item.parentId) continue;
      const parent = itemMap.get(item.parentId);
      if (!parent) continue;

      const fi = typeIndex.get(parent.type);
      const ti = typeIndex.get(item.type);
      if (fi === undefined || ti === undefined) continue;
      if (fi === ti) continue; // Skip same-type hierarchy

      data.matrix[fi][ti]++;
      data.matrix[ti][fi]++;
    }
  } else {
    const spaceIndex = new Map<string, number>();
    data.ids.forEach((s, i) => spaceIndex.set(s, i));

    for (const item of items) {
      if (!item.parentId) continue;
      const parent = itemMap.get(item.parentId);
      if (!parent) continue;

      const fi = spaceIndex.get((parent as any).spaceId);
      const ti = spaceIndex.get((item as any).spaceId);
      if (fi === undefined || ti === undefined) continue;
      if (fi === ti) continue; // Skip same-space hierarchy

      data.matrix[fi][ti]++;
      data.matrix[ti][fi]++;
    }
  }

  return data;
}

const MARGIN = 40;

export function ChordView({ items }: ChordViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [mode, setMode] = useState<GroupMode>('type');
  const [includeHierarchy, setIncludeHierarchy] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width || container.clientWidth;
      const height = window.innerHeight - rect.top - 8;
      if (width > 0 && height > 0) setDimensions({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const chordData = useMemo(
    () =>
      includeHierarchy
        ? buildChordDataWithHierarchy(items, mode)
        : buildChordData(items, mode),
    [items, mode, includeHierarchy],
  );

  const size = Math.min(dimensions.width, dimensions.height);
  const outerRadius = size / 2 - MARGIN;
  const innerRadius = outerRadius - 20;

  const chordLayout = useMemo(() => {
    if (chordData.labels.length === 0) return null;
    // Check if matrix has any non-zero value
    const hasData = chordData.matrix.some((row) => row.some((v) => v > 0));
    if (!hasData) return null;
    return chord().padAngle(0.05).sortSubgroups((a, b) => b - a)(chordData.matrix);
  }, [chordData]);

  const arcGenerator = useMemo(
    () => d3Arc<any>().innerRadius(innerRadius).outerRadius(outerRadius),
    [innerRadius, outerRadius],
  );

  const ribbonGenerator = useMemo(
    () => ribbon().radius(innerRadius) as unknown as (d: any) => string,
    [innerRadius],
  );

  const handleRibbonMouseEnter = useCallback(
    (e: React.MouseEvent, sourceIdx: number, targetIdx: number, value: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const source = chordData.labels[sourceIdx];
      const target = chordData.labels[targetIdx];
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        content: `${source} ↔ ${target} : ${value} relation${value > 1 ? 's' : ''}`,
      });
    },
    [chordData.labels],
  );

  const handleGroupMouseEnter = useCallback(
    (e: React.MouseEvent, idx: number) => {
      setHoveredGroup(idx);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const total = chordData.matrix[idx].reduce((a, b) => a + b, 0);
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        content: `${chordData.labels[idx]} : ${total} connexion${total > 1 ? 's' : ''}`,
      });
    },
    [chordData],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredGroup(null);
    setTooltip(null);
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucun item à afficher
      </div>
    );
  }

  if (!chordLayout) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucune relation à afficher
      </div>
    );
  }

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Controls */}
      <div data-tour="chord-mode" className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0 flex-wrap">
        <span className="text-xs text-muted-foreground">Grouper par</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('type')}
            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
              mode === 'type'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            Type
          </button>
          <button
            onClick={() => setMode('space')}
            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
              mode === 'space'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            Espace
          </button>
        </div>

        <div className="w-px h-4 bg-border" />

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={includeHierarchy}
            onChange={(e) => setIncludeHierarchy(e.target.checked)}
            className="rounded"
          />
          Inclure hiérarchie
        </label>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {chordData.labels.map((label, i) => (
            <div key={chordData.ids[i]} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: chordData.colors[i] }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ userSelect: 'none' }}
      >
        <svg width={dimensions.width} height={dimensions.height}>
          <g transform={`translate(${cx},${cy})`}>
            {/* Ribbons */}
            {chordLayout.map((d, i) => {
              const isHighlighted =
                hoveredGroup === null ||
                hoveredGroup === d.source.index ||
                hoveredGroup === d.target.index;
              return (
                <path
                  key={`ribbon-${i}`}
                  d={ribbonGenerator(d) || ''}
                  fill={chordData.colors[d.source.index]}
                  fillOpacity={isHighlighted ? 0.5 : 0.08}
                  stroke={chordData.colors[d.source.index]}
                  strokeOpacity={isHighlighted ? 0.6 : 0.05}
                  strokeWidth={0.5}
                  style={{ transition: 'fill-opacity 0.2s, stroke-opacity 0.2s' }}
                  onMouseEnter={(e) =>
                    handleRibbonMouseEnter(
                      e,
                      d.source.index,
                      d.target.index,
                      d.source.value,
                    )
                  }
                  onMouseLeave={handleMouseLeave}
                />
              );
            })}

            {/* Arcs (groups) */}
            {chordLayout.groups.map((group, i) => {
              const isHighlighted = hoveredGroup === null || hoveredGroup === i;
              // Label position
              const midAngle = (group.startAngle + group.endAngle) / 2;
              const labelRadius = outerRadius + 14;
              const lx = Math.sin(midAngle) * labelRadius;
              const ly = -Math.cos(midAngle) * labelRadius;
              const angleDeg = (midAngle * 180) / Math.PI;
              const flip = angleDeg > 180;

              return (
                <g key={`group-${i}`}>
                  <path
                    d={arcGenerator(group) || ''}
                    fill={chordData.colors[i]}
                    fillOpacity={isHighlighted ? 0.85 : 0.25}
                    stroke="white"
                    strokeWidth={1}
                    style={{ transition: 'fill-opacity 0.2s', cursor: 'pointer' }}
                    onMouseEnter={(e) => handleGroupMouseEnter(e, i)}
                    onMouseLeave={handleMouseLeave}
                  />
                  {/* Label */}
                  {group.endAngle - group.startAngle > 0.15 && (
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={flip ? 'end' : 'start'}
                      dominantBaseline="middle"
                      transform={`rotate(${angleDeg - 90}, ${lx}, ${ly})`}
                      fill="currentColor"
                      fillOpacity={isHighlighted ? 0.7 : 0.3}
                      fontSize={11}
                      fontWeight={500}
                      style={{ transition: 'fill-opacity 0.2s' }}
                    >
                      {chordData.labels[i]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-1.5 text-xs z-50"
            style={{
              left: Math.min(tooltip.x + 12, dimensions.width - 200),
              top: Math.min(tooltip.y - 30, dimensions.height - 50),
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}
