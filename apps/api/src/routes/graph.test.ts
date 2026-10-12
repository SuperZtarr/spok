/*
 * TNR des routes graphe/sunburst, y compris l'accès public (visitorPreview) : anonyme et
 * non-membre sur communautés publiques/privées — garantit l'absence de 500 anonymes.
 * filterReadableSpaceIds (règle d'accès par espace) est simulé ici : les routes doivent l'appliquer à
 * l'espace demandé, aux portails et aux espaces agrégés ; la règle elle-même est testée dans items.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const readable = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('./items.js', () => ({ filterReadableSpaceIds: readable.fn }))
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { graphRoutes } from './graph.js'

const USER_ID = 'test-user-id'

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'Item 1',
    type: 'NOTE',
    status: null,
    spaceId: 'space-1',
    parentId: null,
    space: { name: 'Space 1', communityId: null },
    tags: [],
    _count: { contributions: 2 },
    ...overrides,
  }
}

async function buildGraphApp() {
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
  // graphRoutes registered WITHOUT prefix (routes define full paths)
  await app.register(graphRoutes)

  await app.ready()
  return { app, prisma }
}

describe('Graph routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildGraphApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    // Par défaut tout est lisible ; chaque test de refus le restreint
    readable.fn.mockReset()
    readable.fn.mockImplementation(async (_prisma: unknown, _userId: unknown, ids: string[]) => ids)
  })

  // ─── SPACE GRAPH ──────────────────────────────────────

  describe('GET /spaces/:spaceId/graph', () => {
    it('should return graph for space member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1' })
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', parentId: null }),
        mockItem({ id: 'item-2', parentId: 'item-1', title: 'Child' }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.nodes.length).toBeGreaterThanOrEqual(2)
      expect(body.links).toBeDefined()
      // Should have space node + item nodes
      expect(body.nodes.some((n: any) => n.type === 'SPACE')).toBe(true)
    })

    it('should check access with the caller and the requested space', async () => {
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([mockItem()])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(readable.fn).toHaveBeenCalledWith(expect.anything(), USER_ID, ['space-1'])
    })

    it('should return 403 when the space is not readable', async () => {
      readable.fn.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.item.findMany).not.toHaveBeenCalled()
    })

    // Faille 2026-10-12 : additionalSpaceIds n'était jamais contrôlé → items de n'importe quel espace
    it('should drop portal spaces that are not readable', async () => {
      readable.fn.mockResolvedValue(['space-1'])
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([mockItem()])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph?additionalSpaceIds=secret-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.item.findMany.mock.calls[0][0].where.spaceId.in).toEqual(['space-1'])
    })

    it('should include relation links', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1' }),
        mockItem({ id: 'item-2', title: 'Item 2' }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([
        { fromItemId: 'item-1', toItemId: 'item-2', type: 'RELATED' },
      ])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body.links.some((l: any) => l.linkType === 'relation')).toBe(true)
    })

    it('should include tag links between items sharing tags', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', tags: [{ tagId: 'tag-1' }] }),
        mockItem({ id: 'item-2', title: 'Item 2', tags: [{ tagId: 'tag-1' }] }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body.links.some((l: any) => l.linkType === 'tag')).toBe(true)
    })

    it('should filter by linkTypes param', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', tags: [{ tagId: 'tag-1' }] }),
        mockItem({ id: 'item-2', parentId: 'item-1', tags: [{ tagId: 'tag-1' }] }),
      ])
      // relation links should NOT be queried when linkTypes=hierarchy,tag
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph?linkTypes=hierarchy,tag',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      // Should have hierarchy and tag but no relation links
      const linkTypes = new Set(body.links.map((l: any) => l.linkType))
      expect(linkTypes.has('relation')).toBe(false)
    })

    it('should include portal space nodes with additionalSpaceIds', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', spaceId: 'space-1' }),
        mockItem({ id: 'item-p', spaceId: 'portal-1', space: { name: 'Portal' } }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])
      prisma.space.findMany.mockResolvedValue([{ id: 'portal-1', name: 'Portal' }])

      const res = await app.inject({
        method: 'GET', url: '/spaces/space-1/graph?additionalSpaceIds=portal-1',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      const spaceNodes = body.nodes.filter((n: any) => n.type === 'SPACE')
      expect(spaceNodes.length).toBe(2) // main + portal
    })

    // Accès public (visitorPreview) : un anonyme voit le graphe d'un espace non privé
    // d'une communauté publique ; refus propre (403) sinon — jamais de 500.
    it('should return graph for anonymous on a readable space', async () => {
      prisma.space.findUnique.mockResolvedValue({ name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([mockItem()])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({ method: 'GET', url: '/spaces/space-1/graph' })

      expect(res.statusCode).toBe(200)
      expect(res.json().nodes.length).toBeGreaterThanOrEqual(1)
      expect(readable.fn).toHaveBeenCalledWith(expect.anything(), undefined, ['space-1'])
    })

    it('should return 403 for anonymous on private space', async () => {
      readable.fn.mockResolvedValue([])

      const res = await app.inject({ method: 'GET', url: '/spaces/space-1/graph' })
      expect(res.statusCode).toBe(403)
    })
  })

  // ─── COMMUNITY GRAPH ─────────────────────────────────

  describe('GET /communities/:communityId/graph', () => {
    // Faille 2026-10-12 : un membre recevait les items des espaces privés de la communauté
    it('should only query items of readable community spaces', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.community.findUnique.mockResolvedValue({ name: 'Community 1' })
      prisma.space.findMany.mockResolvedValue([{ id: 'sp-open' }, { id: 'sp-private' }])
      readable.fn.mockResolvedValue(['sp-open'])
      prisma.item.findMany.mockResolvedValue([])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/communities/com-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(readable.fn).toHaveBeenCalledWith(expect.anything(), USER_ID, ['sp-open', 'sp-private'])
      expect(prisma.item.findMany.mock.calls[0][0].where.spaceId.in).toEqual(['sp-open'])
    })

    it('should return graph with space nodes for community member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.community.findUnique.mockResolvedValue({ name: 'Community 1' })
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1' }])
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', space: { name: 'Space 1', communityId: 'com-1' } }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/communities/com-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      // Should include structural nodes (space + community)
      expect(body.nodes.some((n: any) => n.type === 'SPACE')).toBe(true)
      expect(body.nodes.some((n: any) => n.type === 'COMMUNITY')).toBe(true)
    })

    // Accès public : un non-membre (connecté ou anonyme) voit le graphe d'une communauté publique
    it('should return graph for non-member on public community', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.community.findUnique
        .mockResolvedValueOnce({ isPublic: true, visibility: 'OPEN' }) // access check
        .mockResolvedValueOnce({ name: 'Community 1' }) // name
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1' }])
      prisma.item.findMany.mockResolvedValue([mockItem({ space: { name: 'Space 1', communityId: 'com-1' } })])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/communities/com-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should return graph for anonymous on public community', async () => {
      prisma.community.findUnique
        .mockResolvedValueOnce({ isPublic: true, visibility: 'OPEN' })
        .mockResolvedValueOnce({ name: 'Community 1' })
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1' }])
      prisma.item.findMany.mockResolvedValue([mockItem({ space: { name: 'Space 1', communityId: 'com-1' } })])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({ method: 'GET', url: '/communities/com-1/graph' })

      expect(res.statusCode).toBe(200)
    })

    it('should return 403 for non-member on private community', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.community.findUnique.mockResolvedValue({ isPublic: false, visibility: 'PRIVATE' })

      const res = await app.inject({
        method: 'GET', url: '/communities/com-1/graph',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── GLOBAL GRAPH ────────────────────────────────────

  describe('GET /graph/global', () => {
    it('should return graph from all accessible spaces', async () => {
      prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }])
      prisma.communityMembership.findMany.mockResolvedValue([])
      prisma.item.findMany.mockResolvedValue([mockItem()])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/graph/global',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.nodes).toBeDefined()
      expect(body.links).toBeDefined()
    })

    it('should include community spaces via membership', async () => {
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
      prisma.space.findMany.mockResolvedValue([{ id: 'space-c1' }]) // community spaces
      prisma.community.findMany.mockResolvedValue([{ id: 'com-1', name: 'Community 1' }])
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', spaceId: 'space-c1', space: { name: 'Com Space', communityId: 'com-1' } }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/graph/global',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.nodes.some((n: any) => n.type === 'COMMUNITY')).toBe(true)
    })

    // Anonyme : le graphe global couvre les communautés publiques (espaces non privés)
    it('should return public-communities graph for anonymous', async () => {
      prisma.community.findMany.mockResolvedValue([{ id: 'com-1', name: 'Com 1' }]) // publiques puis noms
      prisma.space.findMany.mockResolvedValue([{ id: 'space-c1' }])
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', spaceId: 'space-c1', space: { name: 'Com Space', communityId: 'com-1' } }),
      ])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({ method: 'GET', url: '/graph/global' })

      expect(res.statusCode).toBe(200)
      expect(res.json().nodes.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter by communityIds param', async () => {
      prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }])
      prisma.communityMembership.findMany.mockResolvedValue([
        { communityId: 'com-1' },
        { communityId: 'com-2' },
      ])
      // Only com-1 spaces should be fetched
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'space-c1' }]) // community spaces for com-1
        .mockResolvedValueOnce([{ id: 'space-1', communityId: 'com-1' }]) // direct spaces filter
      prisma.community.findMany.mockResolvedValue([{ id: 'com-1', name: 'Com 1' }])
      prisma.item.findMany.mockResolvedValue([])
      prisma.itemRelation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/graph/global?communityIds=com-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })
  })

  // ─── SUNBURST ─────────────────────────────────────────

  describe('GET /graph/sunburst', () => {
    it('should return space-scoped sunburst for member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1', name: 'Space 1' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', parentId: null, _count: { contributions: 3 } }),
        mockItem({ id: 'item-2', parentId: 'item-1', title: 'Child', _count: { contributions: 1 } }),
      ])

      const res = await app.inject({
        method: 'GET', url: '/graph/sunburst?spaceId=space-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.name).toBe('Space 1')
      expect(body.nodeType).toBe('space')
      expect(body.children).toBeDefined()
      expect(body.children.length).toBeGreaterThanOrEqual(1)
    })

    it('should return 403 for space mode without access', async () => {
      readable.fn.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/graph/sunburst?spaceId=space-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should include portal spaces in space-scoped mode', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID })
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1', name: 'Main' })
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', spaceId: 'space-1', _count: { contributions: 1 } }),
        mockItem({ id: 'item-p', spaceId: 'portal-1', _count: { contributions: 1 } }),
      ])
      prisma.space.findMany.mockResolvedValue([{ id: 'portal-1', name: 'Portal' }])

      const res = await app.inject({
        method: 'GET', url: '/graph/sunburst?spaceId=space-1&additionalSpaceIds=portal-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      // Should have main item + portal space node in children
      const portalNode = body.children?.find((c: any) => c.nodeType === 'space')
      expect(portalNode).toBeDefined()
      expect(portalNode.name).toBe('Portal')
    })

    it('should drop unreadable portal spaces in space-scoped mode', async () => {
      readable.fn.mockResolvedValue(['space-1'])
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1', name: 'Main' })
      prisma.item.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/graph/sunburst?spaceId=space-1&additionalSpaceIds=secret-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.item.findMany.mock.calls[0][0].where.spaceId.in).toEqual(['space-1'])
    })

    it('should return global sunburst with communities hierarchy', async () => {
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'space-1', name: 'Space 1', communityId: 'com-1' }]) // community spaces
        .mockResolvedValueOnce([]) // direct spaces info (empty)
      prisma.community.findMany.mockResolvedValue([{ id: 'com-1', name: 'Community 1' }])
      prisma.item.findMany.mockResolvedValue([
        mockItem({ id: 'item-1', spaceId: 'space-1', _count: { contributions: 2 } }),
      ])

      const res = await app.inject({
        method: 'GET', url: '/graph/sunburst',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.name).toBe('SPOK')
      expect(body.nodeType).toBe('global')
      expect(body.children).toBeDefined()
      // Should have a community node
      const comNode = body.children.find((c: any) => c.nodeType === 'community')
      expect(comNode).toBeDefined()
      expect(comNode.name).toBe('Community 1')
    })
  })
})
