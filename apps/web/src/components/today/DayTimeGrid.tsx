/*
 * Grille horaire de la page Ma journée (time-blocking) : réunions fixes + blocs de
 * tâches placés (drag vertical snap 15 min, poignée basse pour la durée, ✕ pour dé-placer).
 * Props : events (réunions, non déplaçables), entries (plan placé), date, callbacks.
 * Le drag est en pointer events natifs — pas de lib. Chevauchements rendus côte à côte.
 */
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { AgendaEvent, DayPlanEntryDto } from '@/lib/api';

const DAY_START_H = 7;
const DAY_END_H = 20;
const PX_PER_MIN = 1;
const SNAP_MIN = 15;
const GRID_MIN = (DAY_END_H - DAY_START_H) * 60;

interface Block {
  key: string;
  title: string;
  startMin: number; // minutes depuis DAY_START_H (heure locale)
  durMin: number;
  kind: 'event' | 'task';
  color?: string;
  done?: boolean;
  entryId?: string;
}

/** Minutes locales depuis le début de grille. */
function toGridMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() - DAY_START_H * 60;
}

/** Répartition côte à côte des blocs qui se chevauchent (colonnes gloutonnes par cluster). */
function layoutColumns(blocks: Block[]): Map<string, { col: number; cols: number }> {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.durMin - a.durMin);
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const colEnds: number[] = [];
    const cols = new Map<string, number>();
    for (const b of cluster) {
      let c = colEnds.findIndex((end) => end <= b.startMin);
      if (c === -1) { c = colEnds.length; colEnds.push(0); }
      colEnds[c] = b.startMin + b.durMin;
      cols.set(b.key, c);
    }
    for (const b of cluster) result.set(b.key, { col: cols.get(b.key)!, cols: colEnds.length });
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length > 0 && b.startMin >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.startMin + b.durMin);
  }
  if (cluster.length > 0) flush();
  return result;
}

export function DayTimeGrid({ date, events, entries, onMove, onResize, onUnplace }: {
  date: string;
  events: AgendaEvent[];
  entries: DayPlanEntryDto[];
  onMove: (entryId: string, startIso: string) => void;
  onResize: (entryId: string, durationMin: number) => void;
  onUnplace: (entryId: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ entryId: string; mode: 'move' | 'resize'; startMin: number; durMin: number } | null>(null);

  const blocks: Block[] = [
    ...events.filter((e) => !e.allDay).map((e) => ({
      key: `ev-${e.id}`, title: e.title, kind: 'event' as const, color: e.source.color,
      startMin: toGridMin(e.start),
      durMin: e.end ? Math.max(15, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000) : 60,
    })),
    ...entries.filter((p) => p.plannedStart).map((p) => ({
      key: `pl-${p.id}`, title: p.item.title, kind: 'task' as const, entryId: p.id,
      done: p.item.status === 'done',
      startMin: drag?.entryId === p.id ? drag.startMin : toGridMin(p.plannedStart!),
      durMin: drag?.entryId === p.id ? drag.durMin : (p.plannedDuration ?? 30),
    })),
  ].filter((b) => b.startMin + b.durMin > 0 && b.startMin < GRID_MIN);

  const columns = layoutColumns(blocks);

  const startDrag = (e: React.PointerEvent, entryId: string, mode: 'move' | 'resize', startMin: number, durMin: number) => {
    e.preventDefault();
    const originY = e.clientY;
    setDrag({ entryId, mode, startMin, durMin });
    const onPointerMove = (ev: PointerEvent) => {
      const deltaMin = Math.round((ev.clientY - originY) / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
      setDrag((d) => d && (mode === 'move'
        ? { ...d, startMin: Math.min(Math.max(0, startMin + deltaMin), GRID_MIN - d.durMin) }
        : { ...d, durMin: Math.min(Math.max(SNAP_MIN, durMin + deltaMin), GRID_MIN - d.startMin) }));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setDrag((d) => {
        if (d) {
          if (mode === 'move') {
            const local = new Date(`${date}T00:00:00`);
            local.setMinutes(DAY_START_H * 60 + d.startMin);
            onMove(entryId, local.toISOString());
          } else {
            onResize(entryId, d.durMin);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="flex text-sm select-none">
      {/* étiquettes heures */}
      <div className="w-12 flex-shrink-0">
        {Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => (
          <div key={i} className="text-xs text-muted-foreground text-right pr-2" style={{ height: 60 * PX_PER_MIN }}>
            {String(DAY_START_H + i).padStart(2, '0')}h
          </div>
        ))}
      </div>
      {/* grille */}
      <div ref={gridRef} className="relative flex-1 border-l border-border" style={{ height: GRID_MIN * PX_PER_MIN }}>
        {Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * 60 * PX_PER_MIN }} />
        ))}
        {blocks.map((b) => {
          const lay = columns.get(b.key)!;
          const width = 100 / lay.cols;
          const common = {
            top: b.startMin * PX_PER_MIN,
            height: Math.max(18, b.durMin * PX_PER_MIN),
            left: `${lay.col * width}%`,
            width: `calc(${width}% - 4px)`,
          } as const;
          if (b.kind === 'event') {
            return (
              <div key={b.key} className="absolute rounded border border-border bg-accent/60 px-1.5 py-0.5 overflow-hidden" style={common}>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: b.color ?? 'var(--muted-foreground)' }} />
                <span className="text-xs font-medium">{b.title}</span>
              </div>
            );
          }
          return (
            <div
              key={b.key}
              className={`absolute rounded border px-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing group ${b.done ? 'border-border bg-muted text-muted-foreground line-through' : 'border-primary/50 bg-primary/10'}`}
              style={common}
              onPointerDown={(e) => startDrag(e, b.entryId!, 'move', b.startMin, b.durMin)}
            >
              <span className="text-xs font-medium">{b.title}</span>
              <button
                className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onUnplace(b.entryId!)}
                aria-label="Retirer de la grille"
              >
                <X className="w-3 h-3" />
              </button>
              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, b.entryId!, 'resize', b.startMin, b.durMin); }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
