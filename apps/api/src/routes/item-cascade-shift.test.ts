/* TNR de POST /spaces/:spaceId/items/:id/cascade-shift : décalage en cascade des dépendants
 * confirmés d'une ancre via la relation 'drives' — revalidation serveur de la reachability. */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemCascadeShiftRoutes } from './item-cascade-shift.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(async function (opt) {
    opt.addHook('preHandler', opt.authenticate)
    await opt.register(itemCascadeShiftRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockDependent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    spaceId: 'space-1',
    dueDate: new Date('2026-01-13T00:00:00.000Z'),
    startDate: null,
    endDate: null,
    ...overrides,
  }
}

describe('POST /spaces/:spaceId/items/:id/cascade-shift', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue({ id: 'anchor-1', spaceId: 'space-1' })
    prisma.item.update.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, spaceId: 'space-1', ...data }))
  })

  it('décale les dépendants confirmés et atteignables via drives', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }]) // BFS frontier [anchor-1]
      .mockResolvedValueOnce([])                       // frontier [dep-1]
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1')])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().shiftedCount).toBe(1)
    const updateCall = prisma.item.update.mock.calls[0][0]
    expect(updateCall.where.id).toBe('dep-1')
    expect(updateCall.data.dueDate.toISOString()).toBe('2026-01-18T00:00:00.000Z')
  })

  it('rejette un dependentId non atteignable via drives depuis l\'ancre', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1', 'not-reachable'] },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('404 si l\'item ancre n\'existe pas dans cet espace', async () => {
    prisma.item.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/missing/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(404)
  })

  it('403 pour un viewer', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'VIEWER' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(403)
  })

  it('403 si un dépendant est dans un espace où l\'utilisateur n\'a pas accès en écriture (relation cross-space)', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1', { spaceId: 'space-2' })])
    prisma.spaceMembership.findUnique.mockImplementation(({ where }: any) => {
      if (where.userId_spaceId.spaceId === 'space-2') return Promise.resolve(null)
      return Promise.resolve({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('crée un audit log par item décalé', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1')])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
  })
})
