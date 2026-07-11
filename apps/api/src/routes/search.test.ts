/*
 * TNR de /search : résultats, pagination, périmètre par memberships, anonyme → vide.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { searchRoutes } from './search.js'

const USER_ID = 'test-user-id'

async function buildSearchApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(searchRoutes, { prefix: '/search' })

  await app.ready()
  return { app, prisma }
}

describe('Search routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildSearchApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  describe('GET /search', () => {
    it('should return items and contributions for admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([
        { id: 'item-1', title: 'Test item', type: 'NOTE', status: null, spaceId: 's1', createdAt: new Date(), description: 'Some desc', space: { name: 'Space 1' } },
      ])
      prisma.item.count.mockResolvedValue(1)
      prisma.contribution.findMany.mockResolvedValue([
        { id: 'c1', content: '<p>Test content</p>', createdAt: new Date(), author: { name: 'Author' }, item: { id: 'item-1', title: 'Item', spaceId: 's1', space: { name: 'Space 1' } } },
      ])
      prisma.contribution.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/search?q=test',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.items).toHaveLength(1)
      expect(body.contributions).toHaveLength(1)
      expect(body.totalItems).toBe(1)
      expect(body.totalContributions).toBe(1)
    })

    it('should filter by space membership for regular user', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 's1' }])
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)
      prisma.contribution.findMany.mockResolvedValue([])
      prisma.contribution.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/search?q=test',
        headers: { authorization: `Bearer ${token}` },
      })

      // Check that item query includes space filter
      const itemWhere = prisma.item.findMany.mock.calls[0][0].where
      expect(itemWhere.spaceId).toEqual({ in: ['s1'] })
    })

    it('should return empty for user with no spaces', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/search?q=test',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.items).toHaveLength(0)
      expect(body.contributions).toHaveLength(0)
    })

    it('should return 400 for query shorter than 2 chars', async () => {
      const res = await app.inject({
        method: 'GET', url: '/search?q=a',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should return 400 for empty query', async () => {
      const res = await app.inject({
        method: 'GET', url: '/search',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should strip HTML from contribution content', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)
      prisma.contribution.findMany.mockResolvedValue([
        { id: 'c1', content: '<p>Hello <b>world</b></p>', createdAt: new Date(), author: { name: 'A' }, item: { id: 'i1', title: 'I', spaceId: 's1', space: { name: 'S1' } } },
      ])
      prisma.contribution.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/search?q=hello',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body.contributions[0].content).toBe('Hello world')
    })

    it('should support pagination', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)
      prisma.contribution.findMany.mockResolvedValue([])
      prisma.contribution.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/search?q=test&page=2&pageSize=5',
        headers: { authorization: `Bearer ${token}` },
      })

      const itemArgs = prisma.item.findMany.mock.calls[0][0]
      expect(itemArgs.skip).toBe(5)  // (2-1) * 5
      expect(itemArgs.take).toBe(5)
    })

    // Route en optionalAuthenticate : un anonyme reçoit des résultats vides
    it('should return empty results for anonymous', async () => {
      const res = await app.inject({ method: 'GET', url: '/search?q=test' })
      expect(res.statusCode).toBe(200)
      expect(res.json().items).toHaveLength(0)
      expect(res.json().totalItems).toBe(0)
    })
  })
})
