/* Vue Flux cumulatif (CFD) : évolution des statuts dans le temps. */
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import type { Item } from '@spok/shared';

interface CfdViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

// Status rendering order (bottom to top in the stacked chart)
const STATUS_ORDER = ['done', 'cancelled', 'to_validate', 'in_progress', 'late', 'todo', 'undefined'];

const STATUS_LABELS: Record<string, string> = {
  done: 'Terminé',
  cancelled: 'Annulé',
  to_validate: 'À valider',
  in_progress: 'En cours',
  late: 'En retard',
  todo: 'À faire',
  undefined: 'Non défini',
};

const STATUS_COLORS: Record<string, string> = {
  done: '#22c55e',
  cancelled: '#9ca3af',
  to_validate: '#a855f7',
  in_progress: '#f97316',
  late: '#ef4444',
  todo: '#eab308',
  undefined: '#94a3b8',
};

const DONE_STATUSES = new Set(['done', 'cancelled']);

interface DaySnapshot {
  date: Date;
  label: string;
  counts: Record<string, number>;
  total: number;
}

function buildCfdData(items: Item[]): DaySnapshot[] {
  if (items.length === 0) return [];

  // Sort items by createdAt
  const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const startDate = new Date(sorted[0].createdAt);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Adaptive step
  let stepDays = 1;
  if (totalDays > 365) stepDays = 7;
  if (totalDays > 1000) stepDays = 30;

  const snapshots: DaySnapshot[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);

    const counts: Record<string, number> = {};
    for (const s of STATUS_ORDER) counts[s] = 0;

    let total = 0;

    for (const item of sorted) {
      const created = new Date(item.createdAt);
      if (created > dayEnd) break; // Items sorted, no more to check

      total++;

      // Approximate status at this date:
      // - If updatedAt <= dayEnd, item has its current status
      // - If updatedAt > dayEnd, item was probably in initial state (todo or undefined)
      const updated = new Date(item.updatedAt);
      let statusAtDate: string;

      if (updated <= dayEnd) {
        statusAtDate = item.status || 'undefined';
      } else {
        // Item was modified after this date — approximate as initial status
        statusAtDate = item.status && DONE_STATUSES.has(item.status) ? 'todo' : (item.status || 'undefined');
      }

      // Normalize unknown statuses
      if (!STATUS_COLORS[statusAtDate]) statusAtDate = 'undefined';
      counts[statusAtDate] = (counts[statusAtDate] || 0) + 1;
    }

    snapshots.push({
      date: new Date(cursor),
      label: formatDate(cursor, stepDays),
      counts,
      total,
    });

    cursor.setDate(cursor.getDate() + stepDays);
  }

  return snapshots;
}

function formatDate(d: Date, stepDays: number): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  if (stepDays >= 30) return `${month}/${d.getFullYear()}`;
  return `${day}/${month}`;
}

const MARGIN = { top: 30, right: 20, bottom: 50, left: 55 };

export function CfdView({ items }: CfdViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; snapshot: DaySnapshot } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const snapshots = useMemo(() => buildCfdData(items), [items]);

  const chartWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const chartHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  // Which statuses actually appear
  const activeStatuses = useMemo(() => {
    const seen = new Set<string>();
    for (const snap of snapshots) {
      for (const [status, count] of Object.entries(snap.counts)) {
        if (count > 0) seen.add(status);
      }
    }
    return STATUS_ORDER.filter((s) => seen.has(s));
  }, [snapshots]);

  // Scales
  const { xScale, yScale, yTicks, xTicks } = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        xScale: () => 0,
        yScale: () => 0,
        yMax: 0,
        yTicks: [] as number[],
        xTicks: [] as { x: number; label: string }[],
      };
    }

    const maxTotal = Math.max(...snapshots.map((s) => s.total));
    const yMaxVal = Math.ceil(maxTotal * 1.1) || 1;

    const xs = (i: number) => (i / Math.max(snapshots.length - 1, 1)) * chartWidth;
    const ys = (val: number) => chartHeight - (val / yMaxVal) * chartHeight;

    const tickStep = Math.max(1, Math.ceil(yMaxVal / 6));
    const yTicksArr: number[] = [];
    for (let v = 0; v <= yMaxVal; v += tickStep) yTicksArr.push(v);

    const xTickStep = Math.max(1, Math.floor(snapshots.length / 12));
    const xTicksArr: { x: number; label: string }[] = [];
    for (let i = 0; i < snapshots.length; i += xTickStep) {
      xTicksArr.push({ x: xs(i), label: snapshots[i].label });
    }

    return { xScale: xs, yScale: ys, yMax: yMaxVal, yTicks: yTicksArr, xTicks: xTicksArr };
  }, [snapshots, chartWidth, chartHeight]);

  // Build stacked area paths
  const stackedAreas = useMemo(() => {
    if (snapshots.length === 0) return [];

    // For each status (bottom to top), compute cumulative y0 and y1
    const areas: Array<{ status: string; path: string; color: string }> = [];

    for (const status of activeStatuses) {
      const points: Array<{ x: number; y0: number; y1: number }> = [];

      for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];
        // Cumulative count of statuses below this one
        let cumBelow = 0;
        for (const s of activeStatuses) {
          if (s === status) break;
          cumBelow += snap.counts[s] || 0;
        }
        const count = snap.counts[status] || 0;

        points.push({
          x: xScale(i),
          y0: yScale(cumBelow),
          y1: yScale(cumBelow + count),
        });
      }

      // Build area path: top line forward, bottom line backward
      const topLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y1.toFixed(1)}`).join(' ');
      const bottomLine = [...points].reverse().map((p, i) => `${i === 0 ? 'L' : 'L'}${p.x.toFixed(1)},${p.y0.toFixed(1)}`).join(' ');

      areas.push({
        status,
        path: `${topLine} ${bottomLine} Z`,
        color: STATUS_COLORS[status] || '#94a3b8',
      });
    }

    return areas;
  }, [snapshots, activeStatuses, xScale, yScale]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (snapshots.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const idx = Math.round((mouseX / chartWidth) * (snapshots.length - 1));
      const clampedIdx = Math.max(0, Math.min(snapshots.length - 1, idx));
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
        snapshot: snapshots[clampedIdx],
      });
    },
    [snapshots, chartWidth]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Current stats
  const currentStats = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1];
  }, [snapshots]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucun item à afficher
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Controls & Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Flux cumulatif</span>

        {currentStats && (
          <>
            <div className="w-px h-4 bg-border" />
            <span className="text-xs text-muted-foreground">
              Total : <strong className="text-foreground">{currentStats.total}</strong>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {[...activeStatuses].reverse().map((status) => (
            <div key={status} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              <span className="text-[10px] text-muted-foreground">
                {STATUS_LABELS[status] || status}
              </span>
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
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Grid lines */}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={0} y1={yScale(tick)} x2={chartWidth} y2={yScale(tick)}
                  stroke="currentColor" strokeOpacity={0.08}
                />
                <text
                  x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle"
                  fill="currentColor" fillOpacity={0.4} fontSize={10}
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* X axis labels */}
            {xTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x} y1={chartHeight} x2={tick.x} y2={chartHeight + 5}
                  stroke="currentColor" strokeOpacity={0.2}
                />
                <text
                  x={tick.x} y={chartHeight + 18} textAnchor="middle"
                  fill="currentColor" fillOpacity={0.4} fontSize={10}
                  transform={`rotate(-30, ${tick.x}, ${chartHeight + 18})`}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Axes */}
            <line x1={0} y1={0} x2={0} y2={chartHeight} stroke="currentColor" strokeOpacity={0.15} />
            <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="currentColor" strokeOpacity={0.15} />

            {/* Stacked areas */}
            {stackedAreas.map((area) => (
              <path
                key={area.status}
                d={area.path}
                fill={area.color}
                fillOpacity={0.6}
                stroke={area.color}
                strokeWidth={0.5}
                strokeOpacity={0.8}
              />
            ))}

            {/* Hover zone */}
            <rect
              x={0} y={0} width={chartWidth} height={chartHeight}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {/* Crosshair */}
            {tooltip && (() => {
              const idx = Math.round(((tooltip.x - MARGIN.left) / chartWidth) * (snapshots.length - 1));
              const cx = xScale(Math.max(0, Math.min(snapshots.length - 1, idx)));
              return (
                <line
                  x1={cx} y1={0} x2={cx} y2={chartHeight}
                  stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3"
                />
              );
            })()}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm z-50"
            style={{
              left: Math.min(tooltip.x + 12, dimensions.width - 200),
              top: Math.min(tooltip.y - 80, dimensions.height - 120),
            }}
          >
            <div className="font-medium text-xs mb-1">{tooltip.snapshot.label}</div>
            <div className="text-xs space-y-0.5">
              {[...activeStatuses].reverse().map((status) => {
                const count = tooltip.snapshot.counts[status] || 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    {STATUS_LABELS[status]} : {count}
                  </div>
                );
              })}
              <div className="border-t border-border pt-0.5 mt-1 font-medium">
                Total : {tooltip.snapshot.total}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
