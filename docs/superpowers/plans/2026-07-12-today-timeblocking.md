# Time-blocking sur Ma journée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grille horaire 7h–20h sur /today : réunions fixes + blocs de tâches déplaçables (drag, resize, snap 15 min), placement auto au premier créneau libre.

**Architecture:** `DayPlanEntry.plannedStart/plannedDuration` (le placement est un brouillon personnel, jamais les dates de l'item). PATCH /user/day-plan étendu. Grille en pointer events maison, calcul « premier créneau libre » en fonction pure testée côté web.

**Tech Stack:** Prisma, Fastify, React, pointer events natifs (pas de lib), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-today-timeblocking-design.md`

**Rappels :** commentaire d'en-tête sur chaque fichier créé/modifié ; PAS de commit (Thomas décide) ; `pnpm build:packages` après modif packages/*.

---

### Task 1: Schéma — placement sur DayPlanEntry

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (model DayPlanEntry)

- [ ] **Step 1: Ajouter les champs**

Dans `model DayPlanEntry`, après `source` :
```prisma
  plannedStart    DateTime? // début du bloc sur la grille du jour (brouillon perso — jamais les dates de l'item)
  plannedDuration Int?      // durée en minutes (15–720), null si non placé
```

- [ ] **Step 2: Appliquer + rebuild**

Run : `cd C:/_dev/spok && pnpm db:push && pnpm db:generate && pnpm build:packages`
Expected : colonnes ajoutées (vérifier : `docker exec spok-postgres-dev psql -U spok -d spok -c "\d day_plan_entries"`), build OK.

---

### Task 2: API — PATCH day-plan étendu (TDD)

**Files:**
- Modify: `apps/api/src/routes/day-plan.ts` (handler PATCH)
- Modify: `apps/api/src/routes/day-plan.test.ts` (+4 tests)

- [ ] **Step 1: Ajouter les tests (échec attendu)**

Dans `day-plan.test.ts`, describe supplémentaire :
```ts
  describe('PATCH placement', () => {
    beforeEach(() => {
      prisma.dayPlanEntry.findUnique.mockResolvedValue({ id: 'p1', userId: USER_ID })
      prisma.dayPlanEntry.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'p1', ...data }))
    })

    it('place un bloc (plannedStart + plannedDuration)', async () => {
      const res = await app.inject({
        method: 'PATCH', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` },
        payload: { plannedStart: '2026-07-15T08:00:00.000Z', plannedDuration: 45 },
      })
      expect(res.statusCode).toBe(200)
      expect(prisma.dayPlanEntry.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { plannedStart: new Date('2026-07-15T08:00:00.000Z'), plannedDuration: 45 },
      }))
    })

    it('dé-place un bloc (plannedStart null efface aussi la durée)', async () => {
      const res = await app.inject({
        method: 'PATCH', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` },
        payload: { plannedStart: null },
      })
      expect(res.statusCode).toBe(200)
      expect(prisma.dayPlanEntry.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { plannedStart: null, plannedDuration: null },
      }))
    })

    it('rejette une durée hors bornes', async () => {
      const res = await app.inject({
        method: 'PATCH', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` },
        payload: { plannedStart: '2026-07-15T08:00:00.000Z', plannedDuration: 5 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('rejette un plannedStart invalide', async () => {
      const res = await app.inject({
        method: 'PATCH', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` },
        payload: { plannedStart: 'demain matin' },
      })
      expect(res.statusCode).toBe(400)
    })
  })
```

- [ ] **Step 2: Vérifier l'échec** — `pnpm exec vitest run apps/api/src/routes/day-plan.test.ts` → les 4 nouveaux FAIL (400/500 au lieu du comportement attendu).

- [ ] **Step 3: Étendre le handler PATCH**

Remplacer le handler PATCH de `day-plan.ts` par :
```ts
  fastify.patch<{ Params: { id: string }; Body: { position?: number; plannedStart?: string | null; plannedDuration?: number } }>(
    '/day-plan/:id',
    async (request, reply) => {
      const { position, plannedStart, plannedDuration } = request.body ?? {}
      const data: Record<string, unknown> = {}

      if (position !== undefined) {
        if (typeof position !== 'number' || position < 0) {
          return reply.status(400).send({ error: 'position >= 0 requise' })
        }
        data.position = position
      }
      if (plannedStart !== undefined) {
        if (plannedStart === null) {
          data.plannedStart = null
          data.plannedDuration = null
        } else {
          const start = new Date(plannedStart)
          if (isNaN(start.getTime())) return reply.status(400).send({ error: 'plannedStart ISO ou null requis' })
          data.plannedStart = start
        }
      }
      if (plannedDuration !== undefined && data.plannedDuration !== null) {
        if (typeof plannedDuration !== 'number' || plannedDuration < 15 || plannedDuration > 720) {
          return reply.status(400).send({ error: 'plannedDuration entre 15 et 720 minutes' })
        }
        data.plannedDuration = plannedDuration
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Aucun champ à modifier' })
      }

      const entry = await fastify.prisma.dayPlanEntry.findUnique({ where: { id: request.params.id } })
      if (!entry) return reply.status(404).send({ error: 'Entrée introuvable' })
      if (entry.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
      return fastify.prisma.dayPlanEntry.update({ where: { id: entry.id }, data })
    }
  )
```
Mettre à jour l'en-tête du fichier (mentionner le placement). Le test existant « PATCH réordonne » doit rester vert.

- [ ] **Step 4: Vérifier le vert** — `pnpm exec vitest run apps/api/src/routes/day-plan.test.ts` → 9/9.

---

### Task 3: Web — utilitaire créneau libre (TDD)

**Files:**
- Create: `apps/web/src/lib/timeblock.ts`
- Test: `apps/web/src/lib/timeblock.test.ts`

- [ ] **Step 1: Tests (échec attendu)**

```ts
/*
 * TNR du calcul de créneau libre (time-blocking /today) : journée vide, trous entre
 * blocs occupés, journée pleine, arrondi au quart d'heure suivant.
 */
import { describe, it, expect } from 'vitest'
import { findFreeSlot, snapTo15 } from './timeblock'

const DAY = { start: new Date('2026-07-15T07:00:00Z'), end: new Date('2026-07-15T20:00:00Z') }
const busy = (s: string, e: string) => ({ start: new Date(s), end: new Date(e) })

describe('snapTo15', () => {
  it('arrondit au quart d\'heure inférieur', () => {
    expect(snapTo15(new Date('2026-07-15T09:07:00Z')).toISOString()).toBe('2026-07-15T09:00:00.000Z')
    expect(snapTo15(new Date('2026-07-15T09:53:00Z')).toISOString()).toBe('2026-07-15T09:45:00.000Z')
  })
})

describe('findFreeSlot', () => {
  it('journée vide → à partir de "maintenant" arrondi', () => {
    const slot = findFreeSlot([], 30, new Date('2026-07-15T09:07:00Z'), DAY.start, DAY.end)
    expect(slot?.toISOString()).toBe('2026-07-15T09:15:00.000Z')
  })

  it('saute les blocs occupés', () => {
    const slot = findFreeSlot(
      [busy('2026-07-15T09:00:00Z', '2026-07-15T10:00:00Z'), busy('2026-07-15T10:15:00Z', '2026-07-15T11:00:00Z')],
      30, new Date('2026-07-15T09:00:00Z'), DAY.start, DAY.end,
    )
    expect(slot?.toISOString()).toBe('2026-07-15T11:00:00.000Z') // le trou 10:00-10:15 est trop court
  })

  it('"maintenant" avant l\'ouverture → premier créneau du jour', () => {
    const slot = findFreeSlot([], 30, new Date('2026-07-15T05:00:00Z'), DAY.start, DAY.end)
    expect(slot?.toISOString()).toBe('2026-07-15T07:00:00.000Z')
  })

  it('journée pleine → null', () => {
    const slot = findFreeSlot([busy('2026-07-15T07:00:00Z', '2026-07-15T20:00:00Z')], 30, new Date('2026-07-15T08:00:00Z'), DAY.start, DAY.end)
    expect(slot).toBeNull()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**, puis **Step 3: implémenter**

```ts
/*
 * Calculs purs du time-blocking de la page Ma journée : arrondi 15 min et recherche
 * du premier créneau libre parmi des intervalles occupés (réunions + blocs placés).
 * Aucune dépendance UI — testé unitairement. Ne pas déplacer côté serveur : les
 * bornes de journée sont une affaire de fuseau client.
 */
export interface BusyInterval { start: Date; end: Date }

const Q = 15 * 60 * 1000

export function snapTo15(d: Date): Date {
  return new Date(Math.floor(d.getTime() / Q) * Q)
}

/**
 * Premier créneau libre de `durationMin` minutes, à partir de max(now arrondi au quart
 * d'heure supérieur, dayStart), en sautant les intervalles occupés. null si rien ne rentre.
 */
export function findFreeSlot(
  busy: BusyInterval[],
  durationMin: number,
  now: Date,
  dayStart: Date,
  dayEnd: Date,
): Date | null {
  const durMs = durationMin * 60 * 1000
  let cursor = Math.max(Math.ceil(now.getTime() / Q) * Q, dayStart.getTime())
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime())
  for (const b of sorted) {
    if (b.end.getTime() <= cursor) continue
    if (b.start.getTime() - cursor >= durMs) return new Date(cursor)
    cursor = Math.max(cursor, Math.ceil(b.end.getTime() / Q) * Q)
  }
  if (dayEnd.getTime() - cursor >= durMs) return new Date(cursor)
  return null
}
```

- [ ] **Step 4: Vérifier le vert** — `pnpm exec vitest run apps/web/src/lib/timeblock.test.ts` → 5/5.

---

### Task 4: Web — client API + hook

**Files:**
- Modify: `apps/web/src/lib/api.ts` (`DayPlanEntryDto` + `agendaApi.updatePlanEntry`)
- Modify: `apps/web/src/hooks/useAgenda.ts` (mutation `placeEntry`)

- [ ] **Step 1: Types + client**

Dans `DayPlanEntryDto`, ajouter :
```ts
  plannedStart: string | null; plannedDuration: number | null;
```
Dans `agendaApi`, remplacer `reorderPlan` par une méthode générale (conserver l'export `reorderPlan` n'est pas nécessaire — un seul appelant, le hook) :
```ts
  updatePlanEntry: (id: string, data: { position?: number; plannedStart?: string | null; plannedDuration?: number }) =>
    fetchApi<DayPlanEntryDto>(`/user/day-plan/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

- [ ] **Step 2: Hook**

Dans `useAgendaMutations`, remplacer `reorderPlan` par :
```ts
  const updateEntry = useMutation({
    mutationFn: (p: { id: string; position?: number; plannedStart?: string | null; plannedDuration?: number }) => {
      const { id, ...data } = p;
      return agendaApi.updatePlanEntry(id, data);
    },
    onSuccess: invalidate,
  });
  return { addToPlan, removeFromPlan, updateEntry };
```

- [ ] **Step 3: Typecheck web** — `cd apps/web && npx tsc --noEmit` → corriger les appelants (TodayPage utilisait `reorderPlan` ? non — seul `removeFromPlan`/`addToPlan` sont branchés à ce stade).

---

### Task 5: Web — grille horaire DayTimeGrid + intégration TodayPage

**Files:**
- Create: `apps/web/src/components/today/DayTimeGrid.tsx`
- Modify: `apps/web/src/components/today/DayPlanList.tsx` (bouton « placer », n'afficher que les non-placés)
- Modify: `apps/web/src/pages/TodayPage.tsx` (layout grille + liste)

- [ ] **Step 1: `DayTimeGrid.tsx`** — grille 7h–20h, 1 px/min, événements fixes + blocs déplaçables :

```tsx
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

/** Minutes locales depuis le début de grille, bornées à la grille. */
function toGridMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() - DAY_START_H * 60;
}

/** Répartition côte à côte des blocs qui se chevauchent (algo colonne gloutonne). */
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

  const minFromPointer = (clientY: number): number => {
    const rect = gridRef.current!.getBoundingClientRect();
    return (clientY - rect.top) / PX_PER_MIN;
  };

  const startDrag = (e: React.PointerEvent, entryId: string, mode: 'move' | 'resize', startMin: number, durMin: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
```

- [ ] **Step 2: `DayPlanList.tsx`** — accepter une prop `onPlace: (entry: DayPlanEntryDto) => void` et n'afficher dans la liste que `plan.filter(p => !p.plannedStart)` + un compteur des placés ; bouton « Placer » (icône `CalendarClock`) à côté de la case à cocher. Mettre à jour l'en-tête du fichier.

- [ ] **Step 3: `TodayPage.tsx`** — layout : grille aux 2/3 gauche (`DayTimeGrid`), colonne droite = `AgendaTimeline` réduite aux journées entières + hors plage ? Non — simplifier : gauche = `DayTimeGrid` (réunions + blocs), les événements journée entière restent en bandeau au-dessus de la grille ; droite = `DayPlanList`. Câblage :
```tsx
  const { addToPlan, removeFromPlan, updateEntry } = useAgendaMutations(date);
  const { from, to } = dayBounds(date);

  const busy: BusyInterval[] = [
    ...(data?.events ?? []).filter((e) => !e.allDay && e.end).map((e) => ({ start: new Date(e.start), end: new Date(e.end!) })),
    ...(data?.plan ?? []).filter((p) => p.plannedStart).map((p) => ({
      start: new Date(p.plannedStart!),
      end: new Date(new Date(p.plannedStart!).getTime() + (p.plannedDuration ?? 30) * 60000),
    })),
  ];
  const placeEntry = (entry: DayPlanEntryDto) => {
    const dayStart = new Date(`${date}T07:00:00`);
    const dayEnd = new Date(`${date}T20:00:00`);
    const slot = findFreeSlot(busy, 30, new Date(), dayStart, dayEnd);
    if (!slot) return; // journée pleine — le bloc reste dans la liste
    updateEntry.mutate({ id: entry.id, plannedStart: slot.toISOString(), plannedDuration: 30 });
  };
```
et pour la grille :
```tsx
  <DayTimeGrid
    date={date}
    events={data?.events ?? []}
    entries={data?.plan ?? []}
    onMove={(id, startIso) => updateEntry.mutate({ id, plannedStart: startIso })}
    onResize={(id, durationMin) => updateEntry.mutate({ id, plannedDuration: durationMin })}
    onUnplace={(id) => updateEntry.mutate({ id, plannedStart: null })}
  />
```
(import `findFreeSlot`, `BusyInterval` depuis `@/lib/timeblock`, `dayBounds` déjà importé). Les événements `allDay` : bandeau au-dessus de la grille (reprendre le rendu allDay d'AgendaTimeline). `AgendaTimeline` n'est plus utilisée par TodayPage → la conserver (peut resservir), mais retirer l'import.

- [ ] **Step 4: Typecheck + TNR complet** — `pnpm typecheck` 5/5, `pnpm exec vitest run` tout vert.

---

### Task 6: Finitions

- [ ] **Step 1:** `node scripts/check-doc-headers.mjs` → OK
- [ ] **Step 2:** Doc SPOK : mettre à jour l'item « Ma journée [TodayPage] » (cmrgzj9lj0001335i00ab6rpf) — ajouter le time-blocking aux Comportements attendus, status `to_validate` (script Prisma direct si MCP toujours HS)
- [ ] **Step 3:** Journal + TODO (section EN COURS : time-blocking livré, vérif visuelle Thomas)
- [ ] **Step 4:** Smoke test API local (PATCH placement sur une entrée réelle)

---

## Self-review

- **Couverture spec :** modèle (T1), PATCH étendu (T2), créneau libre (T3), client/hook (T4), grille + placer + intégration (T5), doc/journal (T6). Chevauchements côte à côte : `layoutColumns` (T5). Hors plage : bandeau allDay + filtre blocs hors grille (T5).
- **Placeholders :** aucun.
- **Cohérence :** `updateEntry` (T4) consommé en T5 ; `plannedStart/plannedDuration` mêmes noms partout ; `findFreeSlot(busy, durationMin, now, dayStart, dayEnd)` — signature identique T3/T5.
