/*
 * Grille horaire de la page Ma journée (time-blocking) : une colonne PAR SOURCE d'agenda
 * (spec 2026-07-18-today-columns-per-agenda) — un feed ICS = une colonne, plus une colonne
 * « SPOK » (réunions MEETING créées dans l'app), toutes en lecture seule — et la colonne
 * « Tâches » unique tout à droite (blocs SPOK : drag vertical snap 15 min, poignée basse
 * pour la durée, ✕ pour dé-placer). Le choix des colonnes visibles appartient à TodayPage
 * (prop `sources` : seules les sources listées sont rendues, à parts égales).
 * La colonne Tâches est aussi cible de drop HTML5 (dataTransfer JSON
 * {kind:'entry'|'suggestion', id}) depuis la liste du jour. Les blocs d'agenda sont
 * eux-mêmes draggables vers la liste du jour (dataTransfer JSON {kind:'event', title,
 * start}) — DayPlanList/TodayPage gèrent le drop. Ligne rouge « maintenant » sur le jour
 * courant, rafraîchie chaque minute, traversant toutes les colonnes. Chevauchements
 * rendus côte à côte au sein de chaque colonne.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ItemActionMenu } from '@/components/ui/ItemActionMenu';
import type { ItemActionGroup } from '@/components/ui/ItemActionMenu';
import type { AgendaEvent, DayPlanEntryDto, DayPlanItemDto } from '@/lib/api';
import { todayKey } from '@/hooks/useAgenda';

const DAY_START_H = 7;
const DAY_END_H = 24;
const PX_PER_MIN = 1;
const SNAP_MIN = 15;
const GRID_MIN = (DAY_END_H - DAY_START_H) * 60;
const DROP_DEFAULT_DUR = 30;

export type DropPayload = { kind: 'entry' | 'suggestion'; id: string };
export type EventDropPayload = { kind: 'event'; title: string; start: string };

/** Colonne d'agenda affichée : `feed:<feedId>` ou `spok`. L'ordre du tableau = ordre des colonnes. */
export interface AgendaSourceCol { key: string; name: string; color?: string }

/** Clé de colonne d'un événement — doit rester alignée avec la construction des sources dans TodayPage. */
export function agendaSourceKey(e: AgendaEvent): string {
  return e.source.kind === 'feed' ? `feed:${e.source.feedId}` : 'spok';
}

interface Block {
  key: string;
  title: string;
  startMin: number; // minutes depuis DAY_START_H (heure locale)
  durMin: number;
  color?: string;
  done?: boolean;
  entryId?: string;
  meta?: string;
  startIso?: string; // événements uniquement — pour le drag vers la liste
}

/** Minutes locales depuis le début de grille. */
function toGridMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() - DAY_START_H * 60;
}

/** Position "maintenant" en minutes de grille (peut sortir de [0, GRID_MIN[). */
function nowGridMin(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes() - DAY_START_H * 60;
}

/** Instant ISO correspondant à une position de grille pour la date affichée. */
function gridMinToIso(date: string, min: number): string {
  const local = new Date(`${date}T00:00:00`);
  local.setMinutes(DAY_START_H * 60 + min);
  return local.toISOString();
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

function blockStyle(b: Block, lay: { col: number; cols: number }) {
  const width = 100 / lay.cols;
  return {
    top: b.startMin * PX_PER_MIN,
    height: Math.max(18, b.durMin * PX_PER_MIN),
    left: `${lay.col * width}%`,
    width: `calc(${width}% - 4px)`,
  } as const;
}

export function DayTimeGrid({ date, sources, events, entries, onMove, onResize, onUnplace, onDropAt, menuGroupsFor }: {
  date: string;
  sources: AgendaSourceCol[];
  events: AgendaEvent[];
  entries: DayPlanEntryDto[];
  onMove: (entryId: string, startIso: string) => void;
  onResize: (entryId: string, durationMin: number) => void;
  onUnplace: (entryId: string) => void;
  onDropAt: (payload: DropPayload, startIso: string, durationMin: number) => void;
  menuGroupsFor: (item: DayPlanItemDto) => ItemActionGroup[];
}) {
  const entryById = new Map(entries.map((p) => [p.id, p]));
  const taskLaneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ entryId: string; mode: 'move' | 'resize'; startMin: number; durMin: number } | null>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  // Ligne « maintenant » — uniquement sur le jour courant, rafraîchie chaque minute
  const [nowMin, setNowMin] = useState(nowGridMin);
  useEffect(() => {
    const timer = setInterval(() => setNowMin(nowGridMin()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const showNowLine = date === todayKey() && nowMin >= 0 && nowMin < GRID_MIN;

  // Blocs d'événements groupés par colonne source — un événement dont la source
  // n'est pas dans `sources` (colonne masquée) n'est simplement pas rendu.
  const blocksBySource = new Map<string, Block[]>(sources.map((s) => [s.key, []]));
  for (const e of events) {
    if (e.allDay) continue;
    const lane = blocksBySource.get(agendaSourceKey(e));
    if (!lane) continue;
    const b: Block = {
      key: `ev-${e.id}`, title: e.title, color: e.source.color,
      // Le nom du feed est déjà dans l'en-tête de sa colonne ; seule la colonne SPOK
      // (multi-espaces) garde un meta : le nom de l'espace d'origine.
      meta: e.source.kind === 'spok' ? e.source.spaceName : undefined,
      startMin: toGridMin(e.start),
      durMin: e.end ? Math.max(15, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000) : 60,
      startIso: e.start,
    };
    if (b.startMin + b.durMin > 0 && b.startMin < GRID_MIN) lane.push(b);
  }

  const taskBlocks: Block[] = entries
    .filter((p) => p.plannedStart)
    .map((p) => ({
      key: `pl-${p.id}`, title: p.item.title, entryId: p.id,
      done: p.item.status === 'done',
      startMin: drag?.entryId === p.id ? drag.startMin : toGridMin(p.plannedStart!),
      durMin: drag?.entryId === p.id ? drag.durMin : (p.plannedDuration ?? 30),
    }))
    .filter((b) => b.startMin + b.durMin > 0 && b.startMin < GRID_MIN);

  const taskCols = layoutColumns(taskBlocks);

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
          if (mode === 'move') onMove(entryId, gridMinToIso(date, d.startMin));
          else onResize(entryId, d.durMin);
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const dropMinFromEvent = (e: React.DragEvent): number => {
    const rect = taskLaneRef.current!.getBoundingClientRect();
    const raw = (e.clientY - rect.top) / PX_PER_MIN;
    return Math.min(Math.max(0, Math.round(raw / SNAP_MIN) * SNAP_MIN), GRID_MIN - DROP_DEFAULT_DUR);
  };

  const hourLines = Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => (
    <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * 60 * PX_PER_MIN }} />
  ));

  return (
    // overflow-x-auto englobe en-têtes ET corps : ils défilent ensemble. Chaque colonne a une
    // largeur minimale lisible (LANE_MIN) — au-delà de la place disponible, la grille défile
    // horizontalement au lieu d'écraser les colonnes (retour Thomas 2026-07-18 sur 8 colonnes).
    <div className="flex flex-col text-sm select-none overflow-x-auto">
      {/* en-têtes de colonnes : une par source visible + Tâches */}
      <div className="flex mb-1">
        <div className="w-12 flex-shrink-0" />
        {sources.map((s) => (
          <div key={s.key} className="flex-1 min-w-[110px] flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1" title={s.name}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color ?? 'var(--muted-foreground)' }} />
            <span className="truncate">{s.name}</span>
          </div>
        ))}
        <div className="flex-1 min-w-[110px] text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Tâches</div>
      </div>
      <div className="flex">
        {/* étiquettes heures */}
        <div className="w-12 flex-shrink-0">
          {Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => (
            <div key={i} className="text-xs text-muted-foreground text-right pr-2" style={{ height: 60 * PX_PER_MIN }}>
              {String(DAY_START_H + i).padStart(2, '0')}h
            </div>
          ))}
        </div>
        {/* les deux colonnes partagent l'axe : la ligne "maintenant" les traverse */}
        <div className="relative flex flex-1">
          {showNowLine && (
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowMin * PX_PER_MIN }}>
              <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
              <div className="border-t-2 border-red-500" />
            </div>
          )}

          {/* colonnes d'agenda, une par source visible (lecture seule) */}
          {sources.map((s) => {
            const laneBlocks = blocksBySource.get(s.key) ?? [];
            const laneCols = layoutColumns(laneBlocks);
            return (
              <div key={s.key} className="relative flex-1 min-w-[110px] border-l border-border" style={{ height: GRID_MIN * PX_PER_MIN }}>
                {hourLines}
                {laneBlocks.map((b) => (
                  <div
                    key={b.key}
                    className="absolute rounded border border-border bg-accent/60 px-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing"
                    style={blockStyle(b, laneCols.get(b.key)!)}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'event', title: b.title, start: b.startIso! } satisfies EventDropPayload))}
                    title="Glisser vers la liste du jour pour créer une tâche"
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: b.color ?? 'var(--muted-foreground)' }} />
                    <span className="text-xs font-medium">{b.title}</span>
                    {b.meta && <span className="text-xs text-muted-foreground"> · {b.meta}</span>}
                  </div>
                ))}
              </div>
            );
          })}

          {/* colonne Tâches (drag interne + cible de drop) */}
          <div
            ref={taskLaneRef}
            className="relative flex-1 min-w-[110px] border-l border-border"
            style={{ height: GRID_MIN * PX_PER_MIN }}
            onDragOver={(e) => { e.preventDefault(); setHoverMin(dropMinFromEvent(e)); }}
            onDragLeave={() => setHoverMin(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHoverMin(null);
              try {
                const payload = JSON.parse(e.dataTransfer.getData('application/json')) as DropPayload;
                if (payload.kind !== 'entry' && payload.kind !== 'suggestion') return;
                onDropAt(payload, gridMinToIso(date, dropMinFromEvent(e)), DROP_DEFAULT_DUR);
              } catch { /* drop étranger — ignoré */ }
            }}
          >
            {hourLines}
            {hoverMin !== null && (
              <div
                className="absolute left-0 right-1 rounded border-2 border-dashed border-primary/60 bg-primary/5 pointer-events-none"
                style={{ top: hoverMin * PX_PER_MIN, height: DROP_DEFAULT_DUR * PX_PER_MIN }}
              />
            )}
            {taskBlocks.map((b) => (
              <div
                key={b.key}
                className={`absolute rounded border px-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing group ${b.done ? 'border-border bg-muted text-muted-foreground line-through' : 'border-primary/50 bg-primary/10'}`}
                style={blockStyle(b, taskCols.get(b.key)!)}
                onPointerDown={(e) => startDrag(e, b.entryId!, 'move', b.startMin, b.durMin)}
              >
                <span className="text-xs font-medium">{b.title}</span>
                <div
                  className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <ItemActionMenu groups={menuGroupsFor(entryById.get(b.entryId!)!.item)} />
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onUnplace(b.entryId!)}
                    aria-label="Retirer de la grille"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                  onPointerDown={(e) => { e.stopPropagation(); startDrag(e, b.entryId!, 'resize', b.startMin, b.durMin); }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
