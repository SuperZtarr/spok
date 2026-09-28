/* TNR des relations : création + détection de cycle
 * pour drives ("Entraîne", spec 2026-09-13), refus des types hors RELATION_TYPES (2026-09-28). */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemRelationsRoutes } from './item-relations.js'

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
    await opt.register(itemRelationsRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockItem(id: string, spaceId = 'space-1') {
  return { id, spaceId, title: `Item ${id}` }
}

describe('POST /spaces/:spaceId/items/:id/relations', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemRelation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rel-1', ...data }))
  })

  it('crée une relation blocks (régression de base)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'blocks' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('crée une relation drives sans relation existante (pas de cycle)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis B : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('rejette une relation drives vers soi-même', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('rejette une relation drives qui créerait un cycle (A drives B drives C, tentative C drives A)', async () => {
    // Création : C (fromItemId=C, params.id='C') drives A (toItemId='A')
    // BFS depuis toItemId='A' : A->B->C — C est atteignable depuis A -> cycle
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'C' }]) // frontier [B]
      .mockResolvedValueOnce([])                   // frontier [C]

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/C/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('autorise une relation drives qui ne crée pas de cycle (D n\'a pas de sortant)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('B'))
      .mockResolvedValueOnce(mockItem('D'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis D : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/B/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'D', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })
})

describe('Types de relation acceptés (RELATION_TYPES uniquement, 2026-09-28)', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
  })

  it.each(['depends', 'tests', 'duplicates', 'n-importe-quoi'])('POST refuse le type hors liste %s (400)', async (type) => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type },
    })
    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('PATCH refuse un type hors liste (400)', async () => {
    prisma.itemRelation.findFirst.mockResolvedValue({ id: 'rel-1', fromItemId: 'A', toItemId: 'B', type: 'blocks', label: null })
    const res = await app.inject({
      method: 'PATCH', url: '/spaces/space-1/items/A/relations/rel-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'depends' },
    })
    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.update).not.toHaveBeenCalled()
  })
})
