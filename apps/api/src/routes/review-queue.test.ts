/*
 * Tests de GET /user/review-queue : bac à trier + items en horizon dépassé,
 * périmètre restreint aux espaces accessibles de l'utilisateur.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { reviewQueueRoutes } from './review-queue.js'

const USER_ID = 'test-user-id'
const SPACE_ID = 'space-1'

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'Item',
    type: 'TASK',
    status: null,
    priority: null,
    dueDate: null,
    manualHorizon: null,
    horizonSetAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    spaceId: SPACE_ID,
    space: { id: SPACE_ID, name: 'Espace test' },
    ...overrides,
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(reviewQueueRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

describe('GET /user/review-queue', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('retourne les items sans échéance ni horizon dans toTriage', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([mockItem()])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.toTriage).toHaveLength(1)
    expect(body.overdue).toHaveLength(0)
  })

  it('sépare le bac à trier des items en horizon dépassé', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([
      mockItem({ id: 'a', manualHorizon: null, horizonSetAt: null }),
      mockItem({ id: 'b', manualHorizon: 'WEEK', horizonSetAt: new Date('2026-01-01T00:00:00.000Z') }),
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    const body = res.json()
    expect(body.toTriage.map((i: { id: string }) => i.id)).toEqual(['a'])
    expect(body.overdue.map((i: { id: string }) => i.id)).toEqual(['b'])
  })

  it('exclut les items done/cancelled', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    const where = prisma.item.findMany.mock.calls[0][0].where
    expect(where.status).toEqual({ notIn: ['done', 'cancelled'] })
  })

  it('retourne vide si aucun espace accessible', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([])
    prisma.communityMembership.findMany.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.toTriage).toEqual([])
    expect(body.overdue).toEqual([])
    expect(prisma.item.findMany).not.toHaveBeenCalled()
  })

  it('retourne 401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/user/review-queue' })
    expect(res.statusCode).toBe(401)
  })
})
