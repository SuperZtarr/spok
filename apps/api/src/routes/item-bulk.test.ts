/*
 * TNR de POST /spaces/:spaceId/items/bulk-duplicate : duplication simple (regression),
 * iterations + decalage de dates cumulatif, copie startDate/endDate (fix), enfants inclus.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemBulkRoutes } from './item-bulk.js'

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
    await opt.register(itemBulkRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockSourceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    type: 'MEETING',
    title: 'Réunion hebdo',
    description: null,
    content: null,
    url: null,
    status: 'todo',
    priority: 2,
    position: 0,
    dueDate: new Date('2026-01-15T00:00:00.000Z'),
    startDate: new Date('2026-01-15T09:00:00.000Z'),
    endDate: new Date('2026-01-15T10:00:00.000Z'),
    parentId: null,
    tags: [],
    ...overrides,
  }
}

describe('POST /spaces/:spaceId/items/bulk-duplicate', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })

    // Membership OK sur l'espace source et cible (meme espace par defaut dans ces tests)
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.tag.findMany.mockResolvedValue([])
    prisma.itemRelation.findMany.mockResolvedValue([])
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `new-item-${counter}`, ...data })
    })
    prisma.item.update.mockResolvedValue({})
  })

  it('duplicates once by default (iterations omis) — comportement inchangé', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()]) // items demandés
      .mockResolvedValueOnce([mockSourceItem()]) // allItems (meme set, pas d'enfants)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().duplicatedCount).toBe(1)
    expect(prisma.item.create).toHaveBeenCalledTimes(1)
  })

  it('copie startDate et endDate (fix — auparavant seul dueDate etait copie)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()])
      .mockResolvedValueOnce([mockSourceItem()])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false },
    })

    const createCall = prisma.item.create.mock.calls[0][0]
    expect(createCall.data.startDate).toEqual(new Date('2026-01-15T09:00:00.000Z'))
    expect(createCall.data.endDate).toEqual(new Date('2026-01-15T10:00:00.000Z'))
  })

  it('avec iterations=3 et offsetUnit=week, cree 3 items avec des dates decalees cumulativement (copie 1 = +0, copie 2 = +1 semaine, copie 3 = +2 semaines)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()])
      .mockResolvedValueOnce([mockSourceItem()])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 3, offsetUnit: 'week' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().duplicatedCount).toBe(3)
    expect(prisma.item.create).toHaveBeenCalledTimes(3)

    const dueDates = prisma.item.create.mock.calls.map((c: any) => c[0].data.dueDate.toISOString())
    expect(dueDates).toEqual([
      '2026-01-15T00:00:00.000Z', // copie 1 : +0
      '2026-01-22T00:00:00.000Z', // copie 2 : +1 semaine
      '2026-01-29T00:00:00.000Z', // copie 3 : +2 semaines
    ])
  })

  it('decalage "month" est calendaire (pas une approximation 30 jours)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem({ dueDate: new Date('2026-01-31T00:00:00.000Z'), startDate: null, endDate: null })])
      .mockResolvedValueOnce([mockSourceItem({ dueDate: new Date('2026-01-31T00:00:00.000Z'), startDate: null, endDate: null })])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 2, offsetUnit: 'month' },
    })

    const dueDates = prisma.item.create.mock.calls.map((c: any) => c[0].data.dueDate.toISOString())
    // 31 jan +1 mois calendaire -> 28 fev (2026 n'est pas bissextile), pas "31 jan + 30 jours" (2 mars)
    expect(dueDates[1]).toBe('2026-02-28T00:00:00.000Z')
  })

  it('un item sans date reste sans date apres decalage (pas de date inventee)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem({ dueDate: null, startDate: null, endDate: null })])
      .mockResolvedValueOnce([mockSourceItem({ dueDate: null, startDate: null, endDate: null })])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 2, offsetUnit: 'week' },
    })

    const secondCall = prisma.item.create.mock.calls[1][0]
    expect(secondCall.data.dueDate).toBeNull()
    expect(secondCall.data.startDate).toBeNull()
    expect(secondCall.data.endDate).toBeNull()
  })

  it('rejette iterations > 365', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', iterations: 400 },
    })
    expect(res.statusCode).toBe(400)
  })
})
