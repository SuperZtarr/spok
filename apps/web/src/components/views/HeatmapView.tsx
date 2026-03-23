import { useState, useMemo, useRef, useEffect } from 'react';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';

interface HeatmapViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

type Period = '6m' | '1y';
type ActivityMode = 'created' | 'updated';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const COLORS = [
  'var(--muted)',          // 0
  'hsl(142, 50%, 80%)',    // 1
  'hsl(142, 55%, 62%)',    // 2-3
  'hsl(142, 60%, 45%)',    // 4-6
  'hsl(142, 65%, 32%)',    // 7+
];

function getColor(count: number): string {
  if (count === 0) return COLORS[0];
  if (count === 1) return COLORS[1];
  if (count <= 3) return COLORS[2];
  if (count <= 6) return COLORS[3];
  return COLORS[4];
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMondayBefore(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  r.setDate(r.getDate() - diff);
  return startOfDay(r);
}

export function HeatmapView({ items, onEdit, highlightType, highlightStatus, searchMatchIds }: HeatmapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [period, setPeriod] = useState<Period>('1y');
  const [mode, setMode] = useState<ActivityMode>('created');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number; items: Item[] } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build activity map: date -> items[]
  const { activityMap, startDate, weeks } = useMemo(() => {
    const now = new Date();
    const months = period === '6m' ? 6 : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const mondayStart = getMondayBefore(start);

    const map = new Map<string, Item[]>();
    for (const item of items) {
      const dateStr = mode === 'created' ? item.createdAt : (item.updatedAt || item.createdAt);
      if (!dateStr) continue;
      const d = startOfDay(new Date(dateStr));
      if (d < mondayStart || d > now) continue;
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    // Count weeks
    const diffMs = now.getTime() - mondayStart.getTime();
    const weekCount = Math.ceil(diffMs / (7 * 86400000)) + 1;

    return { activityMap: map, startDate: mondayStart, weeks: weekCount };
  }, [items, period, mode]);

  // Layout
  const LABEL_W = 32;
  const GAP = 2;
  const cellSize = Math.max(8, Math.min(16, (containerWidth - LABEL_W - 40) / weeks - GAP));
  const svgW = LABEL_W + weeks * (cellSize + GAP);
  const svgH = 20 + 7 * (cellSize + GAP) + 40; // month labels + grid + legend

  // Build cells
  const cells = useMemo(() => {
    const result: { x: number; y: number; date: Date; count: number; items: Item[] }[] = [];
    const now = startOfDay(new Date());

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);
        if (cellDate > now) continue;

        const key = dateKey(cellDate);
        const dayItems = activityMap.get(key) || [];
        result.push({
          x: LABEL_W + w * (cellSize + GAP),
          y: 20 + d * (cellSize + GAP),
          date: cellDate,
          count: dayItems.length,
          items: dayItems,
        });
      }
    }
    return result;
  }, [weeks, startDate, activityMap, cellSize]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + w * 7);
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        labels.push({
          x: LABEL_W + w * (cellSize + GAP),
          label: MONTH_LABELS[d.getMonth()],
        });
      }
    }
    return labels;
  }, [weeks, startDate, cellSize]);

  // Stats
  const totalActivity = useMemo(() => {
    let total = 0;
    for (const [, arr] of activityMap) total += arr.length;
    return total;
  }, [activityMap]);

  const activeDays = useMemo(() => {
    let count = 0;
    for (const [, arr] of activityMap) if (arr.length > 0) count++;
    return count;
  }, [activityMap]);

  const maxDay = useMemo(() => {
    let max = 0;
    for (const [, arr] of activityMap) if (arr.length > max) max = arr.length;
    return max;
  }, [activityMap]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div data-tour="heatmap-controls" className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-sm flex-shrink-0">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="px-2 py-1 border rounded bg-background text-sm"
        >
          <option value="6m">6 mois</option>
          <option value="1y">1 an</option>
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ActivityMode)}
          className="px-2 py-1 border rounded bg-background text-sm"
        >
          <option value="created">Créations</option>
          <option value="updated">Modifications</option>
        </select>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span>{totalActivity} activités</span>
          <span>{activeDays} jours actifs</span>
          {maxDay > 0 && <span>Max: {maxDay}/jour</span>}
        </div>
      </div>

      {/* Heatmap */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <svg width={svgW} height={svgH}>
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={14}
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAYS.map((label, i) => (
            i % 2 === 0 ? (
              <text
                key={i}
                x={0}
                y={20 + i * (cellSize + GAP) + cellSize * 0.75}
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {label}
              </text>
            ) : null
          ))}

          {/* Cells */}
          {cells.map((cell, i) => {
            const hasHighlighted = cell.items.some(item =>
              (highlightType && item.type === highlightType) ||
              (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus))
            );
            const hasSearchMatch = cell.items.some(item => searchMatchIds?.has(item.id));

            return (
              <rect
                key={i}
                x={cell.x}
                y={cell.y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(cell.count)}
                stroke={hasSearchMatch ? '#facc15' : hasHighlighted ? 'hsl(var(--primary))' : 'none'}
                strokeWidth={hasSearchMatch || hasHighlighted ? 1.5 : 0}
                opacity={searchMatchIds && cell.items.length > 0 && !hasSearchMatch ? 0.3 : 1}
                className="cursor-pointer transition-opacity"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    setTooltip({
                      x: rect.left - containerRect.left + cellSize / 2,
                      y: rect.top - containerRect.top - 8,
                      date: cell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                      count: cell.count,
                      items: cell.items,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (cell.items.length === 1) {
                    onEdit(cell.items[0].id);
                  }
                }}
              />
            );
          })}

          {/* Legend */}
          <text x={LABEL_W} y={svgH - 8} className="fill-muted-foreground" style={{ fontSize: 10 }}>
            Moins
          </text>
          {COLORS.map((color, i) => (
            <rect
              key={i}
              x={LABEL_W + 36 + i * (cellSize + GAP)}
              y={svgH - 20}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={color}
            />
          ))}
          <text
            x={LABEL_W + 36 + COLORS.length * (cellSize + GAP) + 4}
            y={svgH - 8}
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            Plus
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 px-3 py-2 rounded-lg shadow-lg border bg-popover text-popover-foreground text-xs pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="font-medium">{tooltip.date}</div>
            <div className="text-muted-foreground">
              {tooltip.count === 0 ? 'Aucune activité' : `${tooltip.count} élément${tooltip.count > 1 ? 's' : ''}`}
            </div>
            {tooltip.items.length > 0 && tooltip.items.length <= 5 && (
              <div className="mt-1 space-y-0.5">
                {tooltip.items.map(item => (
                  <div key={item.id} className="truncate max-w-[200px]">{item.title}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
