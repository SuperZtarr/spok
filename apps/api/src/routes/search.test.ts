/*
 * TNR de /search : résultats, pagination, périmètre par memberships, anonyme → vide.
 * /search/advanced : portée espace (sous-espaces inclus) / communauté sur items et utilisateurs.
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

  // Portée : espace (+ sous-espaces) ou communauté, appliquée aux items ET aux utilisateurs
  describe('GET /search/advanced — portée', () => {
    beforeEach(() => {
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)
      prisma.user.findMany.mockResolvedValue([])
      prisma.user.count.mockResolvedValue(0)
    })

    it('spaceId inclut les sous-espaces, bornés aux espaces accessibles', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 's1' }, { spaceId: 's1a' }])
      // s1 → s1a, s1b (s1b non accessible) ; s1a → s1a1 (non accessible) ; fin
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 's1a' }, { id: 's1b' }])
        .mockResolvedValueOnce([{ id: 's1a1' }])
        .mockResolvedValueOnce([])

      await app.inject({
        method: 'GET', url: '/search/advanced?q=test&types=items,users&spaceId=s1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(prisma.item.findMany.mock.calls[0][0].where.spaceId).toEqual({ in: ['s1', 's1a'] })
      expect(prisma.user.findMany.mock.calls[0][0].where.memberships).toEqual({ some: { spaceId: { in: ['s1', 's1a'] } } })
    })

    it('communityId restreint les utilisateurs aux membres de la communauté', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })

      await app.inject({
        method: 'GET', url: '/search/advanced?q=test&types=items,users&communityId=c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(prisma.item.findMany.mock.calls[0][0].where.space).toEqual({ communityId: 'c1' })
      expect(prisma.user.findMany.mock.calls[0][0].where.communityMemberships).toEqual({ some: { communityId: 'c1' } })
    })

    it("communauté privée dont on n'est pas membre : aucun membre révélé", async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findFirst.mockResolvedValue(null)
      prisma.community.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET', url: '/search/advanced?q=test&types=users&communityId=c-private',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.json().users).toEqual([])
      expect(res.json().totals.users).toBe(0)
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })

    it('sans portée : utilisateurs non filtrés', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })

      await app.inject({
        method: 'GET', url: '/search/advanced?q=test&types=users',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.user.findMany.mock.calls[0][0].where
      expect(where.memberships).toBeUndefined()
      expect(where.communityMemberships).toBeUndefined()
    })
  })
})
