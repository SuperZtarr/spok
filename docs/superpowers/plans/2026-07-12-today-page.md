# Ma journée (`/today`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page `/today` qui fusionne les réunions de calendriers externes (ICS) avec une liste du jour mi-calculée mi-choisie, persistée par date.

**Architecture:** Deux tables Prisma (`CalendarFeed`, `DayPlanEntry`), un module d'ingestion ICS isolé derrière l'interface `CalendarSource` (utils API), trois groupes de routes sous le préfixe `/user` (calendar-feeds, agenda, day-plan), une page React `/today` avec TanStack Query. Les bornes de journée (`from`/`to`) sont calculées côté client — le serveur ne convertit jamais de fuseau.

**Tech Stack:** Fastify, Prisma, `node-ical` (parsing + RRULE), React, TanStack Query, Tailwind. Tests Vitest avec `createMockPrisma`.

**Spec:** `docs/superpowers/specs/2026-07-11-today-page-design.md`

**Rappels non négociables** (CLAUDE.md) : commentaire d'en-tête sur chaque fichier créé/modifié ; jamais de commit sans demande de Thomas — les étapes « Commit » ci-dessous se font UNIQUEMENT si Thomas a validé le principe en début d'exécution ; `pnpm build:packages` après toute modification de `packages/*`.

---

### Task 1: Modèles Prisma `CalendarFeed` + `DayPlanEntry`

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (fin de fichier, après `model Reaction`)
- Modify: `packages/database/prisma/schema.prisma` (model `User` : ajouter 2 relations ; model `Item` : ajouter 1 relation)

- [ ] **Step 1: Ajouter les deux modèles en fin de schema.prisma**

```prisma
// Abonnement ICS d'un utilisateur — calendriers externes de la page Ma journée.
// L'url est un lien ICS privé : secret utilisateur, ne jamais la loguer.
model CalendarFeed {
  id            String    @id @default(cuid())
  userId        String
  name          String
  url           String
  color         String    @default("#3b82f6")
  enabled       Boolean   @default(true)
  lastFetchedAt DateTime?
  lastError     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("calendar_feeds")
}

// Engagement du jour : tâche sélectionnée pour une date donnée (page Ma journée).
// L'état "fait" reste porté par Item.status — pas de deuxième vérité ici.
model DayPlanEntry {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime @db.Date
  itemId    String
  position  Int      @default(0)
  source    String   @default("manual") // 'auto' (suggestion acceptée) | 'manual' (pioche)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([userId, date, itemId])
  @@index([userId, date])
  @@map("day_plan_entries")
}
```

- [ ] **Step 2: Ajouter les relations inverses**

Dans `model User`, avec les autres relations :
```prisma
  calendarFeeds CalendarFeed[]
  dayPlanEntries DayPlanEntry[]
```
Dans `model Item`, avec les autres relations :
```prisma
  dayPlanEntries DayPlanEntry[]
```

- [ ] **Step 3: Migration + client + rebuild**

Run : `cd C:/_dev/spok && pnpm db:migrate --name today_page` (répondre au prompt de nom si demandé), puis `pnpm db:generate && pnpm build:packages`
Expected : migration créée dans `packages/database/prisma/migrations/`, client généré, build OK.
⚠️ Redémarrer le dev après build:packages (le HMR ne recharge pas shared/database compilés).

- [ ] **Step 4: Commit**

```bash
git -C C:/_dev/spok add packages/database/prisma
git commit -m "feat: tables CalendarFeed et DayPlanEntry (page Ma journee)"
```

---

### Task 2: Module ICS — `CalendarSource` (TDD)

**Files:**
- Create: `apps/api/src/utils/calendar-source.ts`
- Test: `apps/api/src/utils/calendar-source.test.ts`

- [ ] **Step 1: Installer node-ical**

Run : `cd C:/_dev/spok && pnpm --filter @spok/api add node-ical`
Expected : ajout dans `apps/api/package.json` (node-ical embarque ses propres types TS).

- [ ] **Step 2: Écrire les tests (échec attendu)**

`apps/api/src/utils/calendar-source.test.ts` :
```ts
/*
 * TNR du parsing ICS (page Ma journée) : événements simples, récurrences RRULE,
 * journées entières, fenêtrage from/to. Fixtures inline — pas d'appel réseau.
 */
import { describe, it, expect } from 'vitest'
import { parseIcs } from './calendar-source.js'

const SIMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-1
DTSTART:20260715T090000Z
DTEND:20260715T100000Z
SUMMARY:Réunion projet
LOCATION:Teams
END:VEVENT
END:VCALENDAR`

const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-rec
DTSTART:20260701T080000Z
DTEND:20260701T083000Z
RRULE:FREQ=WEEKLY;BYDAY=WE
SUMMARY:Point hebdo
END:VEVENT
END:VCALENDAR`

const ALLDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-day
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260716
SUMMARY:Congé
END:VEVENT
END:VCALENDAR`

describe('parseIcs', () => {
  const from = new Date('2026-07-15T00:00:00Z')
  const to = new Date('2026-07-16T00:00:00Z')

  it('retourne un événement simple dans la fenêtre', () => {
    const events = parseIcs(SIMPLE_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: 'Réunion projet',
      allDay: false,
      location: 'Teams',
    })
    expect(events[0].start).toBe('2026-07-15T09:00:00.000Z')
    expect(events[0].end).toBe('2026-07-15T10:00:00.000Z')
  })

  it('exclut un événement hors fenêtre', () => {
    const events = parseIcs(SIMPLE_ICS, new Date('2026-07-16T00:00:00Z'), new Date('2026-07-17T00:00:00Z'))
    expect(events).toHaveLength(0)
  })

  it('déplie une récurrence hebdomadaire dans la fenêtre (mercredi 15/07/2026)', () => {
    const events = parseIcs(RECURRING_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Point hebdo')
    expect(events[0].start).toBe('2026-07-15T08:00:00.000Z')
    expect(events[0].end).toBe('2026-07-15T08:30:00.000Z')
  })

  it('marque les événements journée entière', () => {
    const events = parseIcs(ALLDAY_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0].allDay).toBe(true)
  })

  it('rejette un ICS invalide sans crasher', () => {
    expect(() => parseIcs('pas du ICS', from, to)).not.toThrow()
    expect(parseIcs('pas du ICS', from, to)).toEqual([])
  })
})
```

- [ ] **Step 3: Vérifier l'échec**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/utils/calendar-source.test.ts`
Expected : FAIL — `parseIcs` n'existe pas.

- [ ] **Step 4: Implémenter `calendar-source.ts`**

```ts
/*
 * Ingestion des calendriers externes de la page Ma journée.
 * parseIcs : texte ICS → CalendarEvent[] dans la fenêtre [from, to[ (récurrences RRULE dépliées).
 * IcsFeedSource : implémentation CalendarSource par URL ICS, avec cache mémoire 15 min sur le
 * texte brut (clé = feedId). C'est LA frontière à réutiliser si on branche Microsoft Graph un jour.
 * Règle : ne jamais loguer l'URL d'un feed (secret utilisateur).
 */
import ical from 'node-ical'

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end: string | null
  allDay: boolean
  location?: string
}

export interface CalendarSource {
  fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]>
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000

export function parseIcs(icsText: string, from: Date, to: Date): CalendarEvent[] {
  let parsed: ical.CalendarResponse
  try {
    parsed = ical.sync.parseICS(icsText)
  } catch {
    return []
  }
  const events: CalendarEvent[] = []
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key]
    if (ev.type !== 'VEVENT') continue
    const vevent = ev as ical.VEvent
    const durationMs = vevent.end && vevent.start
      ? vevent.end.getTime() - vevent.start.getTime()
      : DEFAULT_DURATION_MS
    const allDay = (vevent.datetype as string | undefined) === 'date'

    if (vevent.rrule) {
      // Récurrence : instances dont le DÉBUT tombe dans la fenêtre
      const exdates = new Set(
        Object.values(vevent.exdate ?? {}).map((d) => (d as Date).getTime())
      )
      for (const occ of vevent.rrule.between(from, to, true)) {
        if (occ >= to || exdates.has(occ.getTime())) continue
        events.push({
          id: `${vevent.uid}:${occ.toISOString()}`,
          title: vevent.summary ?? '(sans titre)',
          start: occ.toISOString(),
          end: new Date(occ.getTime() + durationMs).toISOString(),
          allDay,
          location: vevent.location || undefined,
        })
      }
      continue
    }

    if (!vevent.start) continue
    const start = vevent.start
    const end = vevent.end ?? new Date(start.getTime() + DEFAULT_DURATION_MS)
    // Chevauchement avec la fenêtre [from, to[
    if (end <= from || start >= to) continue
    events.push({
      id: vevent.uid ?? key,
      title: vevent.summary ?? '(sans titre)',
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      location: vevent.location || undefined,
    })
  }
  return events.sort((a, b) => a.start.localeCompare(b.start))
}

const FETCH_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_ICS_BYTES = 2 * 1024 * 1024

const icsCache = new Map<string, { at: number; text: string }>()

/** Vide le cache — réservé aux tests. */
export function _clearIcsCache() {
  icsCache.clear()
}

export class IcsFeedSource implements CalendarSource {
  constructor(private feedId: string, private url: string) {}

  async fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const cached = icsCache.get(this.feedId)
    let text: string
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      text = cached.text
    } else {
      const res = await fetch(this.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`Réponse ${res.status} du calendrier`)
      text = await res.text()
      if (text.length > MAX_ICS_BYTES) throw new Error('Calendrier trop volumineux')
      icsCache.set(this.feedId, { at: Date.now(), text })
    }
    return parseIcs(text, from, to)
  }
}
```

- [ ] **Step 5: Vérifier le vert**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/utils/calendar-source.test.ts`
Expected : PASS 5/5. Si l'assertion RRULE échoue sur l'heure exacte (comportement DTSTART/rrule de node-ical), inspecter la valeur réelle et corriger l'implémentation (pas le test) — l'instance du 15/07 doit être à 08:00Z comme le DTSTART.

- [ ] **Step 6: Commit**

```bash
git -C C:/_dev/spok add apps/api/src/utils/calendar-source.ts apps/api/src/utils/calendar-source.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: parsing ICS + interface CalendarSource (Ma journee)"
```

---

### Task 3: Routes `/user/calendar-feeds` (TDD)

**Files:**
- Create: `apps/api/src/routes/calendar-feeds.ts`
- Test: `apps/api/src/routes/calendar-feeds.test.ts`
- Modify: `apps/api/src/index.ts` (import + register)

⚠️ Vérifier que `createMockPrisma` (dans `apps/api/src/test/helpers.ts`) expose bien `calendarFeed` — la factory est uniforme (tous les modèles) depuis 2026-07-11 ; si `calendarFeed`/`dayPlanEntry` manquent, les ajouter à la liste des modèles de la factory.

- [ ] **Step 1: Écrire les tests (échec attendu)**

`apps/api/src/routes/calendar-feeds.test.ts` — même harnais que `user-tasks.test.ts` :
```ts
/*
 * TNR de /user/calendar-feeds : CRUD scopé à l'utilisateur courant, validation d'URL,
 * l'URL n'est jamais renvoyée tronquée mais appartient à son propriétaire uniquement.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { calendarFeedsRoutes } from './calendar-feeds.js'

const USER_ID = 'test-user-id'

function mockFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feed-1', userId: USER_ID, name: 'Client', url: 'https://outlook.office365.com/owa/calendar/x/calendar.ics',
    color: '#3b82f6', enabled: true, lastFetchedAt: null, lastError: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(calendarFeedsRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

describe('Calendar feeds routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app; prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('GET liste les feeds de l\'utilisateur courant', async () => {
    prisma.calendarFeed.findMany.mockResolvedValue([mockFeed()])
    const res = await app.inject({ method: 'GET', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(prisma.calendarFeed.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID } }))
  })

  it('POST crée un feed avec une URL http(s) valide', async () => {
    prisma.calendarFeed.create.mockResolvedValue(mockFeed())
    const res = await app.inject({
      method: 'POST', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Client', url: 'https://outlook.office365.com/owa/calendar/x/calendar.ics', color: '#3b82f6' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST rejette une URL non http(s)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', url: 'file:///etc/passwd' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH refuse le feed d\'un autre utilisateur', async () => {
    prisma.calendarFeed.findUnique.mockResolvedValue(mockFeed({ userId: 'autre' }))
    const res = await app.inject({
      method: 'PATCH', url: '/user/calendar-feeds/feed-1', headers: { authorization: `Bearer ${token}` },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE supprime son propre feed', async () => {
    prisma.calendarFeed.findUnique.mockResolvedValue(mockFeed())
    prisma.calendarFeed.delete.mockResolvedValue(mockFeed())
    const res = await app.inject({ method: 'DELETE', url: '/user/calendar-feeds/feed-1', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(204)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/calendar-feeds.test.ts`
Expected : FAIL — module `./calendar-feeds.js` introuvable.

- [ ] **Step 3: Implémenter la route**

`apps/api/src/routes/calendar-feeds.ts` :
```ts
/*
 * CRUD des abonnements ICS (page Ma journée) — /user/calendar-feeds.
 * Strictement scopé à l'utilisateur courant. L'URL d'un feed est un secret
 * utilisateur : validée http(s), jamais loguée, renvoyée uniquement à son propriétaire.
 */
import { FastifyPluginAsync } from 'fastify'

function isValidFeedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const calendarFeedsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/calendar-feeds', async (request) => {
    return fastify.prisma.calendarFeed.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'asc' },
    })
  })

  fastify.post<{ Body: { name: string; url: string; color?: string } }>(
    '/calendar-feeds',
    async (request, reply) => {
      const { name, url, color } = request.body ?? ({} as never)
      if (!name?.trim() || !url || !isValidFeedUrl(url)) {
        return reply.status(400).send({ error: 'Nom requis et URL http(s) valide requise' })
      }
      const feed = await fastify.prisma.calendarFeed.create({
        data: { userId: request.user.userId, name: name.trim(), url, color: color || '#3b82f6' },
      })
      return reply.status(201).send(feed)
    }
  )

  fastify.patch<{ Params: { id: string }; Body: { name?: string; url?: string; color?: string; enabled?: boolean } }>(
    '/calendar-feeds/:id',
    async (request, reply) => {
      const existing = await fastify.prisma.calendarFeed.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ error: 'Feed introuvable' })
      if (existing.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
      const { name, url, color, enabled } = request.body ?? {}
      if (url !== undefined && !isValidFeedUrl(url)) {
        return reply.status(400).send({ error: 'URL http(s) valide requise' })
      }
      return fastify.prisma.calendarFeed.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(url !== undefined ? { url, lastError: null } : {}),
          ...(color !== undefined ? { color } : {}),
          ...(enabled !== undefined ? { enabled } : {}),
        },
      })
    }
  )

  fastify.delete<{ Params: { id: string } }>('/calendar-feeds/:id', async (request, reply) => {
    const existing = await fastify.prisma.calendarFeed.findUnique({ where: { id: request.params.id } })
    if (!existing) return reply.status(404).send({ error: 'Feed introuvable' })
    if (existing.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
    await fastify.prisma.calendarFeed.delete({ where: { id: existing.id } })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 4: Enregistrer dans index.ts**

Dans `apps/api/src/index.ts`, à côté de l'import `userTasksRoutes` :
```ts
import { calendarFeedsRoutes } from './routes/calendar-feeds.js';
```
À côté de `app.register(userTasksRoutes, { prefix: '/user' })` :
```ts
await app.register(calendarFeedsRoutes, { prefix: '/user' });
```

- [ ] **Step 5: Vérifier le vert**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/calendar-feeds.test.ts`
Expected : PASS 5/5.

- [ ] **Step 6: Commit**

```bash
git -C C:/_dev/spok add apps/api/src/routes/calendar-feeds.ts apps/api/src/routes/calendar-feeds.test.ts apps/api/src/index.ts apps/api/src/test/helpers.ts
git commit -m "feat: CRUD /user/calendar-feeds"
```

---

### Task 4: Route `/user/agenda` — fusion événements + plan + suggestions (TDD)

**Files:**
- Create: `apps/api/src/routes/agenda.ts`
- Test: `apps/api/src/routes/agenda.test.ts`
- Modify: `apps/api/src/index.ts` (import + register)

- [ ] **Step 1: Écrire les tests (échec attendu)**

`apps/api/src/routes/agenda.test.ts` :
```ts
/*
 * TNR de /user/agenda : fusion feeds ICS + MEETING SPOK, plan du jour, algo de suggestions
 * (retard → échéance du jour → in_progress → priorité), feed en erreur non bloquant.
 * Le fetch ICS est mocké via vi.mock du module calendar-source.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'

const fetchEventsMock = vi.fn()
vi.mock('../utils/calendar-source.js', () => ({
  IcsFeedSource: class { constructor() {} fetchEvents = fetchEventsMock },
}))

import { agendaRoutes } from './agenda.js'

const USER_ID = 'test-user-id'
const DATE = '2026-07-15'
const FROM = '2026-07-14T22:00:00.000Z' // minuit Paris (été)
const TO = '2026-07-15T22:00:00.000Z'
const URL_OK = `/user/agenda?date=${DATE}&from=${FROM}&to=${TO}`

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1', title: 'Tâche', type: 'TASK', status: 'todo', priority: 2,
    dueDate: null, startDate: null, endDate: null, spaceId: 'space-1',
    createdById: USER_ID, assignedToId: null,
    space: { id: 'space-1', name: 'Space 1' },
    ...overrides,
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(agendaRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

function baseMocks(prisma: MockPrisma) {
  prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }])
  prisma.communityMembership.findMany.mockResolvedValue([])
  prisma.calendarFeed.findMany.mockResolvedValue([])
  prisma.dayPlanEntry.findMany.mockResolvedValue([])
  prisma.item.findMany.mockResolvedValue([])
  fetchEventsMock.mockReset()
}

describe('GET /user/agenda', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app; prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    baseMocks(prisma)
  })

  it('400 si date/from/to manquants ou invalides', async () => {
    const res = await app.inject({ method: 'GET', url: '/user/agenda?date=15-07', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(400)
  })

  it('fusionne les événements ICS et les MEETING SPOK, tagués par source', async () => {
    prisma.calendarFeed.findMany.mockResolvedValue([
      { id: 'feed-1', userId: USER_ID, name: 'Client', url: 'https://x/c.ics', color: '#f00', enabled: true },
    ])
    fetchEventsMock.mockResolvedValue([
      { id: 'ev-1', title: 'Réunion client', start: '2026-07-15T09:00:00.000Z', end: '2026-07-15T10:00:00.000Z', allDay: false },
    ])
    // 1er findMany = MEETING, 2e = suggestions
    prisma.item.findMany
      .mockResolvedValueOnce([mockItem({ id: 'm-1', type: 'MEETING', title: 'Point interne', startDate: new Date('2026-07-15T14:00:00.000Z'), endDate: new Date('2026-07-15T15:00:00.000Z') })])
      .mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.events).toHaveLength(2)
    expect(body.events[0].source).toEqual({ kind: 'feed', feedId: 'feed-1', name: 'Client', color: '#f00' })
    expect(body.events[1].source.kind).toBe('spok')
  })

  it('un feed en erreur n\'empêche pas la réponse et renseigne lastError', async () => {
    prisma.calendarFeed.findMany.mockResolvedValue([
      { id: 'feed-1', userId: USER_ID, name: 'Client', url: 'https://x/c.ics', color: '#f00', enabled: true },
    ])
    fetchEventsMock.mockRejectedValue(new Error('timeout'))
    prisma.calendarFeed.update.mockResolvedValue({})

    const res = await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().feedErrors).toEqual([{ feedId: 'feed-1', name: 'Client' }])
    expect(prisma.calendarFeed.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'feed-1' },
      data: expect.objectContaining({ lastError: expect.any(String) }),
    }))
  })

  it('trie les suggestions : retard → échéance du jour → in_progress → priorité', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([]) // meetings
      .mockResolvedValueOnce([
        mockItem({ id: 'prio', priority: 4 }),
        mockItem({ id: 'encours', status: 'in_progress' }),
        mockItem({ id: 'retard', dueDate: new Date('2026-07-10T12:00:00.000Z') }),
        mockItem({ id: 'aujourdhui', dueDate: new Date('2026-07-15T08:00:00.000Z') }),
      ])
    const res = await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    const ids = res.json().suggestions.map((s: { id: string }) => s.id)
    expect(ids).toEqual(['retard', 'aujourdhui', 'encours', 'prio'])
  })

  it('exclut des suggestions les items déjà au plan', async () => {
    prisma.dayPlanEntry.findMany.mockResolvedValue([
      { id: 'p1', userId: USER_ID, date: new Date(DATE), itemId: 'retard', position: 0, source: 'auto', item: mockItem({ id: 'retard' }) },
    ])
    prisma.item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockItem({ id: 'retard', dueDate: new Date('2026-07-10T12:00:00.000Z') })])
    const res = await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    expect(res.json().suggestions).toHaveLength(0)
    expect(res.json().plan).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/agenda.test.ts`
Expected : FAIL — module `./agenda.js` introuvable.

- [ ] **Step 3: Implémenter la route**

`apps/api/src/routes/agenda.ts` :
```ts
/*
 * GET /user/agenda — la page Ma journée en une passe : événements (feeds ICS + items MEETING
 * des espaces accessibles), plan du jour (DayPlanEntry), suggestions calculées
 * (retard → échéance du jour → in_progress → priorité, plafond 10, moins le plan).
 * from/to = bornes de la journée calculées PAR LE CLIENT dans son fuseau — le serveur
 * ne fait aucune conversion de fuseau. date (YYYY-MM-DD) = clé du plan.
 * Un feed en erreur est signalé (feedErrors + lastError) mais ne bloque jamais la réponse.
 */
import { FastifyPluginAsync } from 'fastify'
import { IcsFeedSource } from '../utils/calendar-source.js'

const SUGGESTION_CAP = 10
const CLOSED_STATUSES = ['done', 'cancelled']

async function accessibleSpaceIds(fastify: Parameters<FastifyPluginAsync>[0], userId: string): Promise<string[]> {
  const direct = await fastify.prisma.spaceMembership.findMany({ where: { userId }, select: { spaceId: true } })
  const communities = await fastify.prisma.communityMembership.findMany({ where: { userId }, select: { communityId: true } })
  let communitySpaceIds: string[] = []
  if (communities.length > 0) {
    const spaces = await fastify.prisma.space.findMany({
      where: { communityId: { in: communities.map((c) => c.communityId) } },
      select: { id: true },
    })
    communitySpaceIds = spaces.map((s) => s.id)
  }
  return [...new Set([...direct.map((m) => m.spaceId), ...communitySpaceIds])]
}

export const agendaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get<{ Querystring: { date?: string; from?: string; to?: string } }>(
    '/agenda',
    async (request, reply) => {
      const { date, from: fromStr, to: toStr } = request.query
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ error: 'date=YYYY-MM-DD requis' })
      }
      const from = fromStr ? new Date(fromStr) : new Date(NaN)
      const to = toStr ? new Date(toStr) : new Date(NaN)
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
        return reply.status(400).send({ error: 'from/to ISO requis, from < to' })
      }
      const userId = request.user.userId

      // 1. Événements des feeds ICS actifs — erreurs non bloquantes
      const feeds = await fastify.prisma.calendarFeed.findMany({ where: { userId, enabled: true } })
      const events: unknown[] = []
      const feedErrors: { feedId: string; name: string }[] = []
      await Promise.all(
        feeds.map(async (feed) => {
          try {
            const feedEvents = await new IcsFeedSource(feed.id, feed.url).fetchEvents(from, to)
            for (const ev of feedEvents) {
              events.push({ ...ev, source: { kind: 'feed', feedId: feed.id, name: feed.name, color: feed.color } })
            }
            await fastify.prisma.calendarFeed.update({
              where: { id: feed.id },
              data: { lastFetchedAt: new Date(), lastError: null },
            })
          } catch (err) {
            feedErrors.push({ feedId: feed.id, name: feed.name })
            await fastify.prisma.calendarFeed.update({
              where: { id: feed.id },
              data: { lastError: err instanceof Error ? err.message : 'Erreur inconnue' },
            }).catch(() => {}) // jamais bloquant
          }
        })
      )

      const spaceIds = await accessibleSpaceIds(fastify, userId)

      // 2. Items MEETING SPOK chevauchant la fenêtre
      if (spaceIds.length > 0) {
        const meetings = await fastify.prisma.item.findMany({
          where: {
            type: 'MEETING',
            spaceId: { in: spaceIds },
            OR: [
              { startDate: { lt: to }, endDate: { gt: from } },
              { startDate: { gte: from, lt: to }, endDate: null },
              { startDate: null, dueDate: { gte: from, lt: to } },
            ],
          },
          select: {
            id: true, title: true, startDate: true, endDate: true, dueDate: true, spaceId: true,
            space: { select: { id: true, name: true } },
          },
        })
        for (const m of meetings) {
          const start = m.startDate ?? m.dueDate
          if (!start) continue
          events.push({
            id: m.id,
            title: m.title,
            start: start.toISOString(),
            end: m.endDate ? m.endDate.toISOString() : null,
            allDay: false,
            source: { kind: 'spok', spaceId: m.spaceId, spaceName: m.space.name },
          })
        }
      }
      events.sort((a, b) => (a as { start: string }).start.localeCompare((b as { start: string }).start))

      // 3. Plan du jour
      const plan = await fastify.prisma.dayPlanEntry.findMany({
        where: { userId, date: new Date(date) },
        include: {
          item: {
            select: {
              id: true, title: true, type: true, status: true, priority: true, dueDate: true,
              spaceId: true, space: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { position: 'asc' },
      })
      const plannedItemIds = new Set(plan.map((p) => p.itemId))

      // 4. Suggestions — mes TASK ouvertes : en retard, du jour, en cours ou prioritaires
      let suggestions: unknown[] = []
      if (spaceIds.length > 0) {
        const candidates = await fastify.prisma.item.findMany({
          where: {
            type: 'TASK',
            spaceId: { in: spaceIds },
            AND: [
              { OR: [{ assignedToId: userId }, { assignedToId: null, createdById: userId }] },
              { OR: [{ status: null }, { status: { notIn: CLOSED_STATUSES } }] },
              { OR: [{ dueDate: { lt: to } }, { status: 'in_progress' }, { priority: { gte: 3 } }] },
            ],
          },
          select: {
            id: true, title: true, status: true, priority: true, dueDate: true,
            spaceId: true, space: { select: { id: true, name: true } },
          },
          take: 100,
        })
        const rank = (c: { dueDate: Date | null; status: string | null; priority: number | null }): number => {
          if (c.dueDate && c.dueDate < from) return 0        // en retard
          if (c.dueDate && c.dueDate < to) return 1          // échéance du jour
          if (c.status === 'in_progress') return 2           // en cours
          return 3                                           // priorité haute
        }
        suggestions = candidates
          .filter((c) => !plannedItemIds.has(c.id))
          .sort((a, b) => rank(a) - rank(b) || (b.priority ?? 0) - (a.priority ?? 0))
          .slice(0, SUGGESTION_CAP)
      }

      return { events, feedErrors, plan, suggestions }
    }
  )
}
```

- [ ] **Step 4: Enregistrer dans index.ts**

```ts
import { agendaRoutes } from './routes/agenda.js';
// ...
await app.register(agendaRoutes, { prefix: '/user' });
```

- [ ] **Step 5: Vérifier le vert**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/agenda.test.ts`
Expected : PASS 5/5.

- [ ] **Step 6: Commit**

```bash
git -C C:/_dev/spok add apps/api/src/routes/agenda.ts apps/api/src/routes/agenda.test.ts apps/api/src/index.ts
git commit -m "feat: route /user/agenda (evenements + plan + suggestions)"
```

---

### Task 5: Routes `/user/day-plan` (TDD)

**Files:**
- Create: `apps/api/src/routes/day-plan.ts`
- Test: `apps/api/src/routes/day-plan.test.ts`
- Modify: `apps/api/src/index.ts` (import + register)

- [ ] **Step 1: Écrire les tests (échec attendu)**

`apps/api/src/routes/day-plan.test.ts` :
```ts
/*
 * TNR de /user/day-plan : ajout (idempotent via upsert), retrait, réordonnancement —
 * scope utilisateur strict, l'item ajouté doit être dans un espace accessible.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { dayPlanRoutes } from './day-plan.js'

const USER_ID = 'test-user-id'
const DATE = '2026-07-15'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(dayPlanRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

describe('Day plan routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app; prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('POST ajoute un item accessible au plan du jour', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'task-1', spaceId: 'space-1' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ spaceId: 'space-1', userId: USER_ID })
    prisma.dayPlanEntry.aggregate.mockResolvedValue({ _max: { position: 2 } })
    prisma.dayPlanEntry.upsert.mockResolvedValue({ id: 'p1', itemId: 'task-1', date: new Date(DATE), position: 3, source: 'manual' })

    const res = await app.inject({
      method: 'POST', url: '/user/day-plan', headers: { authorization: `Bearer ${token}` },
      payload: { date: DATE, itemId: 'task-1', source: 'manual' },
    })
    expect(res.statusCode).toBe(201)
    expect(prisma.dayPlanEntry.upsert).toHaveBeenCalled()
  })

  it('POST refuse un item hors espaces accessibles', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'task-1', spaceId: 'space-x' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'space-x', communityId: null })

    const res = await app.inject({
      method: 'POST', url: '/user/day-plan', headers: { authorization: `Bearer ${token}` },
      payload: { date: DATE, itemId: 'task-1', source: 'manual' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST valide date et source', async () => {
    const res = await app.inject({
      method: 'POST', url: '/user/day-plan', headers: { authorization: `Bearer ${token}` },
      payload: { date: 'demain', itemId: 'task-1', source: 'magique' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE refuse l\'entrée d\'un autre utilisateur', async () => {
    prisma.dayPlanEntry.findUnique.mockResolvedValue({ id: 'p1', userId: 'autre' })
    const res = await app.inject({ method: 'DELETE', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH réordonne sa propre entrée', async () => {
    prisma.dayPlanEntry.findUnique.mockResolvedValue({ id: 'p1', userId: USER_ID })
    prisma.dayPlanEntry.update.mockResolvedValue({ id: 'p1', position: 0 })
    const res = await app.inject({
      method: 'PATCH', url: '/user/day-plan/p1', headers: { authorization: `Bearer ${token}` },
      payload: { position: 0 },
    })
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/day-plan.test.ts`
Expected : FAIL — module `./day-plan.js` introuvable.

- [ ] **Step 3: Implémenter la route**

`apps/api/src/routes/day-plan.ts` :
```ts
/*
 * /user/day-plan — l'engagement du jour de la page Ma journée.
 * POST (upsert idempotent : re-poster le même item le même jour ne duplique pas),
 * DELETE, PATCH position. Scope utilisateur strict ; l'item ajouté doit appartenir
 * à un espace accessible (membership direct ou via communauté).
 */
import { FastifyPluginAsync } from 'fastify'

export const dayPlanRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post<{ Body: { date?: string; itemId?: string; source?: string } }>(
    '/day-plan',
    async (request, reply) => {
      const { date, itemId, source } = request.body ?? {}
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !itemId || !['auto', 'manual'].includes(source ?? '')) {
        return reply.status(400).send({ error: 'date (YYYY-MM-DD), itemId et source (auto|manual) requis' })
      }
      const userId = request.user.userId

      const item = await fastify.prisma.item.findUnique({ where: { id: itemId }, select: { id: true, spaceId: true } })
      if (!item) return reply.status(404).send({ error: 'Item introuvable' })

      // Accès : membre direct de l'espace, ou membre de la communauté de l'espace
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { spaceId_userId: { spaceId: item.spaceId, userId } },
      })
      if (!membership) {
        const space = await fastify.prisma.space.findUnique({ where: { id: item.spaceId }, select: { communityId: true } })
        const communityMembership = space?.communityId
          ? await fastify.prisma.communityMembership.findUnique({
              where: { communityId_userId: { communityId: space.communityId, userId } },
            })
          : null
        if (!communityMembership) return reply.status(403).send({ error: 'Forbidden' })
      }

      const max = await fastify.prisma.dayPlanEntry.aggregate({
        where: { userId, date: new Date(date) },
        _max: { position: true },
      })
      const entry = await fastify.prisma.dayPlanEntry.upsert({
        where: { userId_date_itemId: { userId, date: new Date(date), itemId } },
        create: { userId, date: new Date(date), itemId, source: source as string, position: (max._max.position ?? -1) + 1 },
        update: {},
      })
      return reply.status(201).send(entry)
    }
  )

  fastify.delete<{ Params: { id: string } }>('/day-plan/:id', async (request, reply) => {
    const entry = await fastify.prisma.dayPlanEntry.findUnique({ where: { id: request.params.id } })
    if (!entry) return reply.status(404).send({ error: 'Entrée introuvable' })
    if (entry.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
    await fastify.prisma.dayPlanEntry.delete({ where: { id: entry.id } })
    return reply.status(204).send()
  })

  fastify.patch<{ Params: { id: string }; Body: { position?: number } }>(
    '/day-plan/:id',
    async (request, reply) => {
      const { position } = request.body ?? {}
      if (typeof position !== 'number' || position < 0) {
        return reply.status(400).send({ error: 'position >= 0 requise' })
      }
      const entry = await fastify.prisma.dayPlanEntry.findUnique({ where: { id: request.params.id } })
      if (!entry) return reply.status(404).send({ error: 'Entrée introuvable' })
      if (entry.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
      return fastify.prisma.dayPlanEntry.update({ where: { id: entry.id }, data: { position } })
    }
  )
}
```

⚠️ Si le schéma n'expose pas les clés composées `spaceId_userId` / `communityId_userId` sous ces noms, vérifier les `@@unique`/`@@id` des modèles `SpaceMembership`/`CommunityMembership` dans schema.prisma et utiliser le nom généré réel (même pattern que `graph.ts` ou `items.ts`).

- [ ] **Step 4: Enregistrer dans index.ts**

```ts
import { dayPlanRoutes } from './routes/day-plan.js';
// ...
await app.register(dayPlanRoutes, { prefix: '/user' });
```

- [ ] **Step 5: Vérifier le vert + TNR complet + typecheck**

Run : `cd C:/_dev/spok/apps/api && pnpm exec vitest run src/routes/day-plan.test.ts` → PASS 5/5
Run : `cd C:/_dev/spok && pnpm exec vitest run` → tous verts (426 + les nouveaux)
Run : `cd C:/_dev/spok && pnpm typecheck` → 5/5 OK

- [ ] **Step 6: Commit**

```bash
git -C C:/_dev/spok add apps/api/src/routes/day-plan.ts apps/api/src/routes/day-plan.test.ts apps/api/src/index.ts
git commit -m "feat: routes /user/day-plan (engagement du jour)"
```

---

### Task 6: Client API web + hooks TanStack Query

**Files:**
- Modify: `apps/web/src/lib/api.ts` (après `userTasksApi`, ~ligne 485)
- Create: `apps/web/src/hooks/useAgenda.ts`

- [ ] **Step 1: Types + `agendaApi` dans lib/api.ts**

Ajouter après `userTasksApi` (réutiliser le `fetchApi` du fichier) :
```ts
// --- Ma journée (/today) ---
export interface CalendarFeedDto {
  id: string; name: string; url: string; color: string; enabled: boolean;
  lastFetchedAt: string | null; lastError: string | null;
}
export interface AgendaEventSource {
  kind: 'feed' | 'spok';
  feedId?: string; name?: string; color?: string;
  spaceId?: string; spaceName?: string;
}
export interface AgendaEvent {
  id: string; title: string; start: string; end: string | null; allDay: boolean;
  location?: string; source: AgendaEventSource;
}
export interface DayPlanItemDto {
  id: string; title: string; type: string; status: string | null; priority: number | null;
  dueDate: string | null; spaceId: string; space: { id: string; name: string };
}
export interface DayPlanEntryDto {
  id: string; date: string; itemId: string; position: number; source: 'auto' | 'manual';
  item: DayPlanItemDto;
}
export interface AgendaResponse {
  events: AgendaEvent[];
  feedErrors: { feedId: string; name: string }[];
  plan: DayPlanEntryDto[];
  suggestions: DayPlanItemDto[];
}

export const agendaApi = {
  get: (date: string, from: string, to: string) =>
    fetchApi<AgendaResponse>(`/user/agenda?date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  listFeeds: () => fetchApi<CalendarFeedDto[]>('/user/calendar-feeds'),
  createFeed: (data: { name: string; url: string; color?: string }) =>
    fetchApi<CalendarFeedDto>('/user/calendar-feeds', { method: 'POST', body: JSON.stringify(data) }),
  updateFeed: (id: string, data: Partial<Pick<CalendarFeedDto, 'name' | 'url' | 'color' | 'enabled'>>) =>
    fetchApi<CalendarFeedDto>(`/user/calendar-feeds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFeed: (id: string) => fetchApi<void>(`/user/calendar-feeds/${id}`, { method: 'DELETE' }),
  addToPlan: (data: { date: string; itemId: string; source: 'auto' | 'manual' }) =>
    fetchApi<DayPlanEntryDto>('/user/day-plan', { method: 'POST', body: JSON.stringify(data) }),
  removeFromPlan: (id: string) => fetchApi<void>(`/user/day-plan/${id}`, { method: 'DELETE' }),
  reorderPlan: (id: string, position: number) =>
    fetchApi<DayPlanEntryDto>(`/user/day-plan/${id}`, { method: 'PATCH', body: JSON.stringify({ position }) }),
};
```
⚠️ Adapter à la signature réelle de `fetchApi` du fichier (regarder `userTasksApi`/`notificationsApi` juste au-dessus : si les helpers passent `body` en objet brut ou ont un wrapper `method`, suivre le même style).

- [ ] **Step 2: Hook `useAgenda`**

`apps/web/src/hooks/useAgenda.ts` :
```ts
/*
 * Hook de la page Ma journée : agenda du jour (queryKey ['agenda', date]) + mutations
 * plan du jour et feeds. Les bornes from/to sont calculées ICI, dans le fuseau du
 * navigateur — ne jamais déplacer ce calcul côté serveur.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendaApi } from '@/lib/api';

/** Bornes [minuit local, minuit local +1j[ pour une date YYYY-MM-DD, en ISO UTC. */
export function dayBounds(date: string): { from: string; to: string } {
  const [y, m, d] = date.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const to = new Date(y, m - 1, d + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Date locale du jour au format YYYY-MM-DD (clé du plan). */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useAgenda(date: string) {
  const { from, to } = dayBounds(date);
  return useQuery({
    queryKey: ['agenda', date],
    queryFn: () => agendaApi.get(date, from, to),
    enabled: !!date,
    staleTime: 60_000,
  });
}

export function useAgendaMutations(date: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['agenda', date] });
  const addToPlan = useMutation({
    mutationFn: (p: { itemId: string; source: 'auto' | 'manual' }) => agendaApi.addToPlan({ date, ...p }),
    onSuccess: invalidate,
  });
  const removeFromPlan = useMutation({ mutationFn: agendaApi.removeFromPlan, onSuccess: invalidate });
  const reorderPlan = useMutation({
    mutationFn: (p: { id: string; position: number }) => agendaApi.reorderPlan(p.id, p.position),
    onSuccess: invalidate,
  });
  return { addToPlan, removeFromPlan, reorderPlan };
}

export function useCalendarFeeds() {
  return useQuery({ queryKey: ['calendar-feeds'], queryFn: agendaApi.listFeeds });
}

export function useCalendarFeedMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-feeds'] });
    queryClient.invalidateQueries({ queryKey: ['agenda'] });
  };
  const createFeed = useMutation({ mutationFn: agendaApi.createFeed, onSuccess: invalidate });
  const updateFeed = useMutation({
    mutationFn: (p: { id: string } & Parameters<typeof agendaApi.updateFeed>[1]) =>
      agendaApi.updateFeed(p.id, p),
    onSuccess: invalidate,
  });
  const deleteFeed = useMutation({ mutationFn: agendaApi.deleteFeed, onSuccess: invalidate });
  return { createFeed, updateFeed, deleteFeed };
}
```

- [ ] **Step 3: Typecheck**

Run : `cd C:/_dev/spok/apps/web && npx tsc --noEmit`
Expected : OK.

- [ ] **Step 4: Commit**

```bash
git -C C:/_dev/spok add apps/web/src/lib/api.ts apps/web/src/hooks/useAgenda.ts
git commit -m "feat: client API et hooks agenda (Ma journee)"
```

---

### Task 7: Page `/today` + composants

**Files:**
- Create: `apps/web/src/pages/TodayPage.tsx`
- Create: `apps/web/src/components/today/AgendaTimeline.tsx`
- Create: `apps/web/src/components/today/DayPlanList.tsx`
- Create: `apps/web/src/components/today/CalendarFeedsModal.tsx`
- Create: `apps/web/src/components/today/PickTasksModal.tsx`

Chaque fichier reçoit son commentaire d'en-tête (raison d'être, props clés, règles d'usage). Style : Tailwind, classes des toolbars documentées dans la skill spok-menu (`text-muted-foreground`, `hover:bg-accent`, icônes Lucide `w-4 h-4`). Pas de nouveau store Zustand : l'état (date affichée, modales ouvertes) est local à la page.

- [ ] **Step 1: `AgendaTimeline.tsx`**

```tsx
/*
 * Colonne réunions de la page Ma journée : liste chronologique des événements du jour
 * (feeds ICS + MEETING SPOK), événements journée entière en tête, pastille couleur par source.
 * Props : events (déjà triés par le serveur), feedErrors (badge discret).
 * Lecture seule — aucune édition d'événement ici.
 */
import { AlertTriangle, CalendarDays } from 'lucide-react';
import type { AgendaEvent } from '@/lib/api';

function hm(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function AgendaTimeline({ events, feedErrors }: {
  events: AgendaEvent[];
  feedErrors: { feedId: string; name: string }[];
}) {
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays className="w-4 h-4" /> Réunions
        {feedErrors.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={`Calendrier(s) injoignable(s) : ${feedErrors.map((f) => f.name).join(', ')}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {feedErrors.length}
          </span>
        )}
      </div>
      {allDay.map((e) => (
        <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-accent/40 px-2 py-1 text-sm">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
          <span className="truncate">{e.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">journée</span>
        </div>
      ))}
      {timed.length === 0 && allDay.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réunion.</p>
      )}
      {timed.map((e) => (
        <div key={e.id} className="flex items-start gap-2 rounded border border-border px-2 py-1.5 text-sm">
          <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
          <div className="min-w-0">
            <div className="truncate font-medium">{e.title}</div>
            <div className="text-xs text-muted-foreground">
              {hm(e.start)}{e.end ? ` – ${hm(e.end)}` : ''}
              {e.location ? ` · ${e.location}` : ''}
              {e.source.kind === 'spok' ? ` · ${e.source.spaceName}` : ` · ${e.source.name}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `DayPlanList.tsx`**

```tsx
/*
 * Colonne liste du jour de la page Ma journée : le plan persisté (cases à cocher →
 * status 'done' sur l'item), puis les suggestions acceptables d'un clic.
 * Props : plan/suggestions (du hook useAgenda), callbacks accept/remove/toggleDone/pick.
 * Ne pas dupliquer ici la logique de tri des suggestions — elle vit côté serveur.
 */
import { Check, Plus, X, ListTodo } from 'lucide-react';
import type { DayPlanEntryDto, DayPlanItemDto } from '@/lib/api';

export function DayPlanList({ plan, suggestions, onAccept, onRemove, onToggleDone, onPick }: {
  plan: DayPlanEntryDto[];
  suggestions: DayPlanItemDto[];
  onAccept: (itemId: string) => void;
  onRemove: (entryId: string) => void;
  onToggleDone: (item: DayPlanItemDto) => void;
  onPick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ListTodo className="w-4 h-4" /> Ma liste du jour
        <button
          onClick={onPick}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus className="w-3.5 h-3.5" /> Piocher
        </button>
      </div>

      {plan.length === 0 && <p className="text-sm text-muted-foreground">Rien d'engagé pour ce jour.</p>}
      {plan.map((entry) => {
        const done = entry.item.status === 'done';
        return (
          <div key={entry.id} className="group flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm">
            <button
              onClick={() => onToggleDone(entry.item)}
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${done ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}
              aria-label={done ? 'Rouvrir' : 'Terminer'}
            >
              {done && <Check className="w-3 h-3" />}
            </button>
            <span className={`truncate ${done ? 'line-through text-muted-foreground' : ''}`}>{entry.item.title}</span>
            <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{entry.item.space.name}</span>
            <button onClick={() => onRemove(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" aria-label="Retirer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {suggestions.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Suggestions</div>
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm">
              <span className="truncate">{s.title}</span>
              {s.dueDate && <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(s.dueDate).toLocaleDateString('fr-FR')}</span>}
              <button
                onClick={() => onAccept(s.id)}
                className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `CalendarFeedsModal.tsx`**

```tsx
/*
 * Modale de gestion des abonnements ICS (page Ma journée) : liste, ajout, activation,
 * suppression. L'URL ICS est un secret utilisateur — champ type password au repos.
 * Props : open/onClose. Les mutations invalident ['calendar-feeds'] et ['agenda'].
 */
import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useCalendarFeeds, useCalendarFeedMutations } from '@/hooks/useAgenda';

export function CalendarFeedsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: feeds = [] } = useCalendarFeeds();
  const { createFeed, updateFeed, deleteFeed } = useCalendarFeedMutations();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Calendriers externes (ICS)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {feeds.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.enabled} onChange={(e) => updateFeed.mutate({ id: f.id, enabled: e.target.checked })} />
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
              <span className="truncate">{f.name}</span>
              {f.lastError && <span className="text-xs text-amber-600 truncate" title={f.lastError}>erreur</span>}
              <button onClick={() => deleteFeed.mutate(f.id)} className="ml-auto text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {feeds.length === 0 && <p className="text-sm text-muted-foreground">Aucun calendrier. Publie ton calendrier (Outlook : Paramètres → Calendrier → Calendriers partagés) et colle le lien ICS ici.</p>}
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !url.trim()) return;
            createFeed.mutate({ name: name.trim(), url: url.trim() }, { onSuccess: () => { setName(''); setUrl(''); } });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Client)" className="h-8 rounded border border-input bg-background px-2 text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL du calendrier .ics" className="h-8 rounded border border-input bg-background px-2 text-sm" />
          <button type="submit" disabled={createFeed.isPending} className="h-8 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium">
            Ajouter
          </button>
          {createFeed.isError && <p className="text-xs text-red-600">Ajout impossible — vérifie l'URL.</p>}
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `PickTasksModal.tsx`**

```tsx
/*
 * Modale « Piocher » de la page Ma journée : vivier de mes tâches ouvertes
 * (réutilise userTasksApi — même source que la page Tâches globales), recherche texte,
 * clic = ajout au plan du jour. Ne pas réimplémenter de filtres avancés ici : pour
 * du tri fin, la page /tasks reste l'outil.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { userTasksApi } from '@/lib/api';

export function PickTasksModal({ open, onClose, plannedItemIds, onPick }: {
  open: boolean;
  onClose: () => void;
  plannedItemIds: Set<string>;
  onPick: (itemId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['pick-tasks', search],
    queryFn: () => userTasksApi.list({ myTasks: true, search: search || undefined, sortBy: 'dueDate', sortDir: 'asc', pageSize: 50 }),
    enabled: open,
  });
  if (!open) return null;
  const tasks = (data?.data ?? []).filter((t) => !plannedItemIds.has(t.id) && t.status !== 'done' && t.status !== 'cancelled');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-lg border border-border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Piocher dans mes tâches</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…" className="h-8 rounded border border-input bg-background px-2 text-sm mb-2"
        />
        <div className="flex-1 overflow-auto flex flex-col gap-1">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && tasks.length === 0 && <p className="text-sm text-muted-foreground">Rien à piocher.</p>}
          {tasks.map((t) => (
            <button
              key={t.id} onClick={() => onPick(t.id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
              <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{t.spaceName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `TodayPage.tsx`**

```tsx
/*
 * Page /today « Ma journée » — écran d'atterrissage du matin : réunions (feeds ICS +
 * MEETING SPOK) à gauche, liste du jour (plan persisté + suggestions) à droite.
 * État local uniquement (date affichée, modales) — pas de store Zustand.
 * Le marquage « fait » passe par itemsApi.update (status done) : une seule vérité, l'item.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAgenda, useAgendaMutations, todayKey } from '@/hooks/useAgenda';
import { itemsApi, type DayPlanItemDto } from '@/lib/api';
import { AgendaTimeline } from '@/components/today/AgendaTimeline';
import { DayPlanList } from '@/components/today/DayPlanList';
import { CalendarFeedsModal } from '@/components/today/CalendarFeedsModal';
import { PickTasksModal } from '@/components/today/PickTasksModal';

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function TodayPage() {
  const [date, setDate] = useState(todayKey());
  const [feedsOpen, setFeedsOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const { data, isLoading } = useAgenda(date);
  const { addToPlan, removeFromPlan } = useAgendaMutations(date);
  const queryClient = useQueryClient();

  const toggleDone = async (item: DayPlanItemDto) => {
    await itemsApi.update(item.spaceId, item.id, { status: item.status === 'done' ? 'todo' : 'done' });
    queryClient.invalidateQueries({ queryKey: ['agenda', date] });
    queryClient.invalidateQueries({ queryKey: ['items', item.spaceId] });
  };

  const isToday = date === todayKey();
  const label = new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <button onClick={() => setDate(shiftDate(date, -1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Jour précédent">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setDate(shiftDate(date, 1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Jour suivant">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold capitalize ml-1">{label}</h1>
        {!isToday && (
          <button onClick={() => setDate(todayKey())} className="h-7 px-2 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            Aujourd'hui
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => setFeedsOpen(true)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Calendriers">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <AgendaTimeline events={data?.events ?? []} feedErrors={data?.feedErrors ?? []} />
            <DayPlanList
              plan={data?.plan ?? []}
              suggestions={data?.suggestions ?? []}
              onAccept={(itemId) => addToPlan.mutate({ itemId, source: 'auto' })}
              onRemove={(entryId) => removeFromPlan.mutate(entryId)}
              onToggleDone={toggleDone}
              onPick={() => setPickOpen(true)}
            />
          </div>
        )}
      </div>

      <CalendarFeedsModal open={feedsOpen} onClose={() => setFeedsOpen(false)} />
      <PickTasksModal
        open={pickOpen} onClose={() => setPickOpen(false)}
        plannedItemIds={new Set((data?.plan ?? []).map((p) => p.itemId))}
        onPick={(itemId) => addToPlan.mutate({ itemId, source: 'manual' })}
      />
    </div>
  );
}
```
⚠️ Vérifier la signature réelle de `itemsApi.update` dans lib/api.ts (ordre des arguments spaceId/itemId/payload) et adapter l'appel.

- [ ] **Step 6: Typecheck**

Run : `cd C:/_dev/spok/apps/web && npx tsc --noEmit`
Expected : OK.

- [ ] **Step 7: Commit**

```bash
git -C C:/_dev/spok add apps/web/src/pages/TodayPage.tsx apps/web/src/components/today
git commit -m "feat: page Ma journee (/today) — timeline reunions + liste du jour"
```

---

### Task 8: Route App + entrée de menu (skill spok-menu appliquée)

**Files:**
- Modify: `apps/web/src/App.tsx` (import, route, preload map)
- Modify: `packages/shared/src/constants/menuDefaults.ts` (section personal)

- [ ] **Step 1: Route dans App.tsx**

Avec les autres imports de pages :
```tsx
import { TodayPage } from './pages/TodayPage';
```
Dans la preload map (à côté de `[/^\/tasks$/, 'pages/GlobalTasksPage.tsx']`) :
```tsx
  [/^\/today$/, 'pages/TodayPage.tsx'],
```
Dans les routes (à côté de `<Route path="tasks" ...>`) :
```tsx
        <Route path="today" element={<TodayPage />} />
```

- [ ] **Step 2: Entrée MENU_REGISTRY — section Personnel, en premier**

Dans `packages/shared/src/constants/menuDefaults.ts`, remplacer le bloc `── personal ──` par :
```ts
  // ── personal ──
  { id: '', key: 'today',     label: 'Ma journée',      icon: 'Sun',             section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/today',     viewMode: null, order: 0, visible: true, access: 'user' },
  { id: '', key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/dashboard', viewMode: null, order: 1, visible: true, access: 'user' },
  { id: '', key: 'tasks',     label: 'Tâches',          icon: 'ClipboardList',   section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/tasks',     viewMode: null, order: 2, visible: true, access: 'user' },
  { id: '', key: 'activity',  label: 'Activité',        icon: 'Activity',        section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/activity',  viewMode: null, order: 3, visible: true, access: 'user' },
  { id: '', key: 'profile',   label: 'Profil',          icon: 'User',            section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: null,         viewMode: null, order: 4, visible: true, access: 'user' },
```

- [ ] **Step 3: Icône `Sun` dans MainMenu**

Vérifier la map `ICONS` de `apps/web/src/components/MainMenu.tsx` : si `Sun` n'y est pas, ajouter l'import lucide et l'entrée `Sun,` dans la map (sinon fallback icône List).

- [ ] **Step 4: Rebuild + typecheck + redémarrage dev**

Run : `cd C:/_dev/spok && pnpm build:packages && pnpm typecheck`
Expected : OK 5/5. Redémarrer le dev (HMR ne recharge pas shared compilé).

- [ ] **Step 5: Vérification manuelle (protocole testing-protocol)**

- Menu Personnel → « Ma journée » visible et navigue vers `/today`
- La page s'affiche sans feed configuré (état vide propre)
- Ajouter un feed ICS de test (URL Hotmail publiée), vérifier l'affichage des événements
- Accepter une suggestion → elle passe au plan ; recharger → le plan persiste
- Cocher une tâche → status done (vérifier dans son espace)

- [ ] **Step 6: Commit**

```bash
git -C C:/_dev/spok add apps/web/src/App.tsx packages/shared/src/constants/menuDefaults.ts apps/web/src/components/MainMenu.tsx
git commit -m "feat: entree menu et route /today"
```

---

### Task 9: Finitions — TNR complet, doc, journal

- [ ] **Step 1: TNR complet + typecheck + contrôle doc**

Run : `cd C:/_dev/spok && pnpm exec vitest run && pnpm typecheck && node scripts/check-doc-headers.mjs`
Expected : tous verts, aucun en-tête manquant.

- [ ] **Step 2: Doc SPOK**

Créer l'item « Ma journée [TodayPage] » dans l'espace **Pages utilisateur** (`cmnxohuia01mln856b8bu9luo`), status `to_validate`, avec sections Intention / Décisions de design / Comportements attendus / Contraintes / Fichiers (reprendre la spec). Via MCP si réparé, sinon script Prisma direct (pattern `tmp_create_system_doc.ts`).

- [ ] **Step 3: Journal + TODO**

- `docs/session-journal.md` : section EN COURS — page /today livrée, reste la vérification du prérequis tenant client (publication ICS)
- `docs/TODO.md` : cocher la ligne « Connexion calendrier messagerie » pour la partie lecture ICS (préciser que Graph/push reste ouvert)

- [ ] **Step 4: Commit docs**

```bash
git -C C:/_dev/spok add docs/session-journal.md docs/TODO.md docs/superpowers
git commit -m "docs: spec + plan + journal page Ma journee"
```

---

## Self-review (fait à l'écriture)

- **Couverture spec** : modèles (T1), ICS/CalendarSource (T2), CRUD feeds (T3), agenda+suggestions (T4), day-plan (T5), client+hooks (T6), page+composants (T7), menu+route (T8), doc/journal (T9). Vue semaine/Graph/push : hors périmètre, non planifiés — conforme.
- **Placeholders** : aucun TBD ; les deux ⚠️ (noms de clés composées Prisma, signature fetchApi/itemsApi.update) sont des points de vérification explicites contre le code réel, pas des trous.
- **Cohérence de types** : `AgendaEvent.source` (kind feed/spok) identique entre route (T4), types web (T6) et composants (T7) ; `DayPlanEntryDto.item` = sélection de la route T4 ; `dayBounds`/`todayKey` définis T6, consommés T7.
