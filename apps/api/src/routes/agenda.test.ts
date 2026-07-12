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
  IcsFeedSource: class {
    fetchEvents = fetchEventsMock
  },
}))

import { agendaRoutes } from './agenda.js'

const USER_ID = 'test-user-id'
const DATE = '2026-07-15'
const FROM = '2026-07-14T22:00:00.000Z' // minuit Paris (été)
const TO = '2026-07-15T22:00:00.000Z'
const URL_OK = `/user/agenda?date=${DATE}&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`

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
    prisma.calendarFeed.update.mockResolvedValue({})
    // 1er findMany item = MEETING, 2e = suggestions
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

  it("un feed en erreur n'empêche pas la réponse et renseigne lastError", async () => {
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

  it('trie les suggestions : retard (date OU statut late) → échéance du jour → in_progress → priorité', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([]) // meetings
      .mockResolvedValueOnce([
        mockItem({ id: 'prio', priority: 4 }),
        mockItem({ id: 'encours', status: 'in_progress' }),
        mockItem({ id: 'retard-statut', status: 'late', priority: 1 }),
        mockItem({ id: 'retard', dueDate: new Date('2026-07-10T12:00:00.000Z'), priority: 2 }),
        mockItem({ id: 'aujourdhui', dueDate: new Date('2026-07-15T08:00:00.000Z') }),
      ])
    const res = await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    const ids = res.json().suggestions.map((s: { id: string }) => s.id)
    expect(ids).toEqual(['retard', 'retard-statut', 'aujourdhui', 'encours', 'prio'])
  })

  it('honore le filtre de types (TASK par défaut, élargi via ?type=)', async () => {
    prisma.item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await app.inject({ method: 'GET', url: `${URL_OK}&type=TASK,BUG`, headers: { authorization: `Bearer ${token}` } })
    expect(prisma.item.findMany.mock.calls[1][0].where.type).toEqual({ in: ['TASK', 'BUG'] })

    prisma.item.findMany.mockClear()
    prisma.item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    expect(prisma.item.findMany.mock.calls[1][0].where.type).toBe('TASK')
  })

  it('inclut le statut late dans les critères de candidature (même sans échéance)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    await app.inject({ method: 'GET', url: URL_OK, headers: { authorization: `Bearer ${token}` } })
    const and = prisma.item.findMany.mock.calls[1][0].where.AND
    expect(JSON.stringify(and)).toContain('"late"')
  })

  it('filtre les suggestions par espace (intersection avec les espaces accessibles)', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }, { spaceId: 'space-2' }])
    prisma.item.findMany
      .mockResolvedValueOnce([]) // meetings
      .mockResolvedValueOnce([mockItem({ id: 't1', spaceId: 'space-2' })])
    const res = await app.inject({
      method: 'GET', url: `${URL_OK}&spaceId=space-2,space-inaccessible`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // 2e appel item.findMany = suggestions : le where doit être restreint à space-2 uniquement
    const suggestionsCall = prisma.item.findMany.mock.calls[1][0]
    expect(suggestionsCall.where.spaceId).toEqual({ in: ['space-2'] })
  })

  it('filtre les suggestions par statut et priorité (contraintes additionnelles)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    await app.inject({
      method: 'GET', url: `${URL_OK}&status=in_progress&priority=3,4`,
      headers: { authorization: `Bearer ${token}` },
    })
    const and = prisma.item.findMany.mock.calls[1][0].where.AND
    expect(and).toEqual(expect.arrayContaining([
      { status: { in: ['in_progress'] } },
      { priority: { in: [3, 4] } },
    ]))
  })

  it('filtre les suggestions par recherche texte', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    await app.inject({
      method: 'GET', url: `${URL_OK}&search=roadmap`,
      headers: { authorization: `Bearer ${token}` },
    })
    const and = prisma.item.findMany.mock.calls[1][0].where.AND
    expect(and).toEqual(expect.arrayContaining([
      { OR: [
        { title: { contains: 'roadmap', mode: 'insensitive' } },
        { description: { contains: 'roadmap', mode: 'insensitive' } },
      ] },
    ]))
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
