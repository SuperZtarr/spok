import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import type { Item } from '@spok/shared';

type ChartMode = 'burndown' | 'burnup';

const DONE_STATUSES = new Set(['done', 'cancelled']);

interface BurndownViewProps {
  items: Item[];
  onItemClick?: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

interface DayPoint {
  date: Date;
  label: string;
  totalCreated: number;
  totalDone: number;
  remaining: number;
}

function buildTimeSeries(items: Item[]): DayPoint[] {
  if (items.length === 0) return [];

  // Collect creation and completion events
  const creations: Date[] = [];
  const completions: Date[] = [];

  for (const item of items) {
    creations.push(new Date(item.createdAt));
    if (item.status && DONE_STATUSES.has(item.status)) {
      completions.push(new Date(item.updatedAt));
    }
  }

  if (creations.length === 0) return [];

  // Sort
  creations.sort((a, b) => a.getTime() - b.getTime());
  completions.sort((a, b) => a.getTime() - b.getTime());

  // Date range: first creation to today
  const startDate = new Date(creations[0]);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // If range is too large, sample weekly or monthly
  let stepDays = 1;
  if (totalDays > 365) stepDays = 7;
  if (totalDays > 1000) stepDays = 30;

  const points: DayPoint[] = [];
  let createdIdx = 0;
  let doneIdx = 0;
  let totalCreated = 0;
  let totalDone = 0;

  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);

    // Count creations up to this day
    while (createdIdx < creations.length && creations[createdIdx] <= dayEnd) {
      totalCreated++;
      createdIdx++;
    }

    // Count completions up to this day
    while (doneIdx < completions.length && completions[doneIdx] <= dayEnd) {
      totalDone++;
      doneIdx++;
    }

    points.push({
      date: new Date(cursor),
      label: formatDate(cursor, stepDays),
      totalCreated,
      totalDone,
      remaining: totalCreated - totalDone,
    });

    cursor.setDate(cursor.getDate() + stepDays);
  }

  return points;
}

function formatDate(d: Date, stepDays: number): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  if (stepDays >= 30) return `${month}/${d.getFullYear()}`;
  return `${day}/${month}`;
}

const MARGIN = { top: 30, right: 20, bottom: 50, left: 55 };

export function BurndownView({
  items,
}: BurndownViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [mode, setMode] = useState<ChartMode>('burnup');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DayPoint } | null>(null);

  // Measure container
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

  const points = useMemo(() => buildTimeSeries(items), [items]);

  const chartWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const chartHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  // Scales
  const { xScale, yScale, yTicks, xTicks } = useMemo(() => {
    if (points.length === 0) {
      return {
        xScale: () => 0,
        yScale: () => 0,
        yMax: 0,
        yTicks: [] as number[],
        xTicks: [] as { x: number; label: string }[],
      };
    }

    const maxVal = Math.max(
      ...points.map((p) => Math.max(p.totalCreated, p.totalDone, p.remaining))
    );
    const yMaxVal = Math.ceil(maxVal * 1.1) || 1;

    const xs = (i: number) => (i / Math.max(points.length - 1, 1)) * chartWidth;
    const ys = (val: number) => chartHeight - (val / yMaxVal) * chartHeight;

    // Y ticks (5-8 ticks)
    const tickStep = Math.max(1, Math.ceil(yMaxVal / 6));
    const yTicksArr: number[] = [];
    for (let v = 0; v <= yMaxVal; v += tickStep) yTicksArr.push(v);

    // X ticks (max ~12 labels)
    const xTickStep = Math.max(1, Math.floor(points.length / 12));
    const xTicksArr: { x: number; label: string }[] = [];
    for (let i = 0; i < points.length; i += xTickStep) {
      xTicksArr.push({ x: xs(i), label: points[i].label });
    }

    return { xScale: xs, yScale: ys, yMax: yMaxVal, yTicks: yTicksArr, xTicks: xTicksArr };
  }, [points, chartWidth, chartHeight]);

  // Build SVG path
  const buildPath = useCallback(
    (accessor: (p: DayPoint) => number) => {
      if (points.length === 0) return '';
      return points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(accessor(p)).toFixed(1)}`)
        .join(' ');
    },
    [points, xScale, yScale]
  );

  // Build area path (fill under curve)
  const buildArea = useCallback(
    (accessor: (p: DayPoint) => number) => {
      if (points.length === 0) return '';
      const linePart = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(accessor(p)).toFixed(1)}`)
        .join(' ');
      return `${linePart} L${xScale(points.length - 1).toFixed(1)},${chartHeight} L${xScale(0).toFixed(1)},${chartHeight} Z`;
    },
    [points, xScale, yScale, chartHeight]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (points.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Find closest point
      const idx = Math.round((mouseX / chartWidth) * (points.length - 1));
      const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
        point: points[clampedIdx],
      });
    },
    [points, chartWidth]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Stats
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const last = points[points.length - 1];
    const pctDone = last.totalCreated > 0 ? Math.round((last.totalDone / last.totalCreated) * 100) : 0;
    return { total: last.totalCreated, done: last.totalDone, remaining: last.remaining, pctDone };
  }, [points]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucun item à afficher
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Controls */}
      <div data-tour="burndown-toggle" className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Mode :</span>
        {([
          { value: 'burnup' as ChartMode, label: 'Burnup' },
          { value: 'burndown' as ChartMode, label: 'Burndown' },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              mode === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* Stats */}
        {stats && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Total : <strong className="text-foreground">{stats.total}</strong></span>
              <span>Terminés : <strong className="text-green-600">{stats.done}</strong></span>
              <span>Restants : <strong className="text-blue-600">{stats.remaining}</strong></span>
              <span className="text-green-600 font-medium">{stats.pctDone}%</span>
            </div>
          </>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3">
          {mode === 'burnup' ? (
            <>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded bg-blue-500 inline-block" />
                <span className="text-[10px] text-muted-foreground">Total créés</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded bg-green-500 inline-block" />
                <span className="text-[10px] text-muted-foreground">Terminés</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded bg-orange-500 inline-block" />
              <span className="text-[10px] text-muted-foreground">Reste à faire</span>
            </div>
          )}
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
                  x1={0}
                  y1={yScale(tick)}
                  x2={chartWidth}
                  y2={yScale(tick)}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={-8}
                  y={yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontSize={10}
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* X axis labels */}
            {xTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  y1={chartHeight}
                  x2={tick.x}
                  y2={chartHeight + 5}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                />
                <text
                  x={tick.x}
                  y={chartHeight + 18}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontSize={10}
                  transform={`rotate(-30, ${tick.x}, ${chartHeight + 18})`}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Axes */}
            <line x1={0} y1={0} x2={0} y2={chartHeight} stroke="currentColor" strokeOpacity={0.15} />
            <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="currentColor" strokeOpacity={0.15} />

            {mode === 'burnup' ? (
              <>
                {/* Area under total */}
                <path
                  d={buildArea((p) => p.totalCreated)}
                  fill="#3b82f6"
                  fillOpacity={0.08}
                />
                {/* Area under done */}
                <path
                  d={buildArea((p) => p.totalDone)}
                  fill="#22c55e"
                  fillOpacity={0.15}
                />
                {/* Total created line */}
                <path
                  d={buildPath((p) => p.totalCreated)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {/* Done line */}
                <path
                  d={buildPath((p) => p.totalDone)}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              </>
            ) : (
              <>
                {/* Area under remaining */}
                <path
                  d={buildArea((p) => p.remaining)}
                  fill="#f97316"
                  fillOpacity={0.12}
                />
                {/* Remaining line */}
                <path
                  d={buildPath((p) => p.remaining)}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {/* Ideal burndown line (diagonal from max to 0) */}
                {points.length > 1 && (
                  <line
                    x1={xScale(0)}
                    y1={yScale(points[0].totalCreated)}
                    x2={xScale(points.length - 1)}
                    y2={yScale(0)}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    strokeOpacity={0.5}
                  />
                )}
              </>
            )}

            {/* Hover zone */}
            <rect
              x={0}
              y={0}
              width={chartWidth}
              height={chartHeight}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {/* Tooltip crosshair */}
            {tooltip && (() => {
              const idx = Math.round(((tooltip.x - MARGIN.left) / chartWidth) * (points.length - 1));
              const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
              const cx = xScale(clampedIdx);
              return (
                <>
                  <line
                    x1={cx}
                    y1={0}
                    x2={cx}
                    y2={chartHeight}
                    stroke="currentColor"
                    strokeOpacity={0.15}
                    strokeDasharray="3 3"
                  />
                  {mode === 'burnup' ? (
                    <>
                      <circle cx={cx} cy={yScale(tooltip.point.totalCreated)} r={4} fill="#3b82f6" />
                      <circle cx={cx} cy={yScale(tooltip.point.totalDone)} r={4} fill="#22c55e" />
                    </>
                  ) : (
                    <circle cx={cx} cy={yScale(tooltip.point.remaining)} r={4} fill="#f97316" />
                  )}
                </>
              );
            })()}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm z-50"
            style={{
              left: Math.min(tooltip.x + 12, dimensions.width - 180),
              top: Math.min(tooltip.y - 60, dimensions.height - 100),
            }}
          >
            <div className="font-medium text-xs mb-1">{tooltip.point.label}</div>
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Créés : {tooltip.point.totalCreated}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Terminés : {tooltip.point.totalDone}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                Restants : {tooltip.point.remaining}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
