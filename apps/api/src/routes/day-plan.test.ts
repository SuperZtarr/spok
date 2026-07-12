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

  it("DELETE refuse l'entrée d'un autre utilisateur", async () => {
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

  it('POST avec placement direct (drop d\'une suggestion sur la grille)', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'task-1', spaceId: 'space-1' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ spaceId: 'space-1', userId: USER_ID })
    prisma.dayPlanEntry.aggregate.mockResolvedValue({ _max: { position: null } })
    prisma.dayPlanEntry.upsert.mockImplementation((args: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: 'p1', ...args.create }))

    const res = await app.inject({
      method: 'POST', url: '/user/day-plan', headers: { authorization: `Bearer ${token}` },
      payload: { date: DATE, itemId: 'task-1', source: 'auto', plannedStart: '2026-07-15T09:00:00.000Z', plannedDuration: 45 },
    })
    expect(res.statusCode).toBe(201)
    expect(prisma.dayPlanEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ plannedStart: new Date('2026-07-15T09:00:00.000Z'), plannedDuration: 45 }),
      update: expect.objectContaining({ plannedStart: new Date('2026-07-15T09:00:00.000Z') }),
    }))
  })

  it('POST rejette un placement invalide', async () => {
    const res = await app.inject({
      method: 'POST', url: '/user/day-plan', headers: { authorization: `Bearer ${token}` },
      payload: { date: DATE, itemId: 'task-1', source: 'auto', plannedStart: 'tantôt' },
    })
    expect(res.statusCode).toBe(400)
  })

  describe('PATCH placement (time-blocking)', () => {
    beforeEach(() => {
      prisma.dayPlanEntry.findUnique.mockResolvedValue({ id: 'p1', userId: USER_ID })
      prisma.dayPlanEntry.update.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'p1', ...args.data }))
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
})
