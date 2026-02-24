import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminSpacesRoutes } from './spaces.js'

vi.mock('../../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
  serializeItemForAudit: vi.fn((item: unknown) => item),
  serializeSpaceForAudit: vi.fn((space: unknown) => space),
}))

const ADMIN_ID = 'admin-user-id'

async function buildAdminSpacesApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400, error: 'Validation Error',
        message: `Données invalides: ${details[0]}`, details, code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  await app.register(fp(async (f) => { f.decorate('prisma', prisma as any) }, { name: 'prisma' }))
  await app.register(jwtPlugin)
  await app.register(adminAuthPlugin)
  await app.register(adminSpacesRoutes, { prefix: '/admin/spaces' })

  await app.ready()
  return { app, prisma }
}

describe('Admin Spaces routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAdminSpacesApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: ADMIN_ID, email: 'admin@test.com' })
  })

  function allowAdmin() {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  }

  // ─── LIST SPACES ───────────────────────────────────────

  describe('GET /admin/spaces', () => {
    it('should list spaces with pagination', async () => {
      allowAdmin()
      prisma.space.findMany.mockResolvedValue([{
        id: 's1', name: 'Space 1', type: 'GROUP', communityId: null, parentId: null,
        createdAt: new Date(), updatedAt: new Date(),
        _count: { memberships: 2, items: 5, children: 0 },
        memberships: [{ user: { id: 'u1', name: 'Owner', email: 'o@t.com' } }],
        community: null, parent: null,
      }])
      prisma.space.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/admin/spaces',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].memberCount).toBe(2)
      expect(body.pagination.total).toBe(1)
    })
  })

  // ─── GET SINGLE SPACE ─────────────────────────────────

  describe('GET /admin/spaces/:id', () => {
    it('should return a single space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({
        id: 's1', name: 'Space 1', type: 'GROUP', communityId: null, parentId: null,
        createdAt: new Date(), updatedAt: new Date(),
        _count: { memberships: 1, items: 3, children: 0 },
        memberships: [{ id: 'sm1', userId: 'u1', user: { id: 'u1', name: 'A', email: 'a@t.com' }, role: 'OWNER', joinedAt: new Date() }],
        community: null, parent: null,
      })

      const res = await app.inject({
        method: 'GET', url: '/admin/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe('s1')
      expect(res.json().members).toHaveLength(1)
    })

    it('should return 404 for non-existent space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET', url: '/admin/spaces/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── UPDATE SPACE ──────────────────────────────────────

  describe('PATCH /admin/spaces/:id', () => {
    it('should update a space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1', name: 'Old', type: 'GROUP' })
      prisma.space.update.mockResolvedValue({
        id: 's1', name: 'New', type: 'GROUP', communityId: null, parentId: null,
        createdAt: new Date(), updatedAt: new Date(),
        _count: { memberships: 1, items: 0, children: 0 },
        community: null, parent: null,
      })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().name).toBe('New')
    })

    it('should reject community on personal space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1', name: 'Personal', type: 'PERSONAL' })
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'c1' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should return 404 for non-existent space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH', url: '/admin/spaces/nope',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Ghost' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── DELETE PREVIEW ────────────────────────────────────

  describe('GET /admin/spaces/:id/delete-preview', () => {
    it('should return delete preview', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1' })
      prisma.space.findMany.mockResolvedValue([]) // no children
      prisma.item.count
        .mockResolvedValueOnce(3)  // directItemCount
        .mockResolvedValueOnce(3)  // totalItemCount
      prisma.contribution.count.mockResolvedValue(10)

      const res = await app.inject({
        method: 'GET', url: '/admin/spaces/s1/delete-preview',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().directItemCount).toBe(3)
    })
  })

  // ─── DELETE SPACE ──────────────────────────────────────

  describe('DELETE /admin/spaces/:id', () => {
    it('should delete space without children (orphan items)', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1', name: 'Doomed' })
      prisma.space.findMany.mockResolvedValue([]) // no descendants
      prisma.space.updateMany.mockResolvedValue({ count: 0 })
      prisma.item.findMany.mockResolvedValue([])
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.space.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should return 404 for non-existent space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE', url: '/admin/spaces/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── MEMBERS ───────────────────────────────────────────

  describe('GET /admin/spaces/:id/members', () => {
    it('should list space members', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1' })
      prisma.spaceMembership.findMany.mockResolvedValue([
        { id: 'sm1', userId: 'u1', user: { id: 'u1', name: 'A', email: 'a@t.com' }, role: 'OWNER', joinedAt: new Date() },
      ])

      const res = await app.inject({
        method: 'GET', url: '/admin/spaces/s1/members',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(1)
    })
  })

  describe('POST /admin/spaces/:id/members', () => {
    it('should add member to space', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1' })
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.spaceMembership.create.mockResolvedValue({
        id: 'sm1', userId: 'u1', user: { id: 'u1', name: 'A', email: 'a@t.com' },
        role: 'MEMBER', joinedAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/spaces/s1/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { userId: 'u1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should return 409 if already member', async () => {
      allowAdmin()
      prisma.space.findUnique.mockResolvedValue({ id: 's1' })
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'existing' })

      const res = await app.inject({
        method: 'POST', url: '/admin/spaces/s1/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { userId: 'u1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  describe('PATCH /admin/spaces/:id/members/:memberId', () => {
    it('should update member role', async () => {
      allowAdmin()
      prisma.spaceMembership.findFirst.mockResolvedValue({ id: 'sm1', spaceId: 's1' })
      prisma.spaceMembership.update.mockResolvedValue({
        id: 'sm1', userId: 'u1', user: { id: 'u1', name: 'A', email: 'a@t.com' },
        role: 'ADMIN', joinedAt: new Date(),
      })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/spaces/s1/members/sm1',
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'ADMIN' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('ADMIN')
    })

    it('should return 404 for non-existent membership', async () => {
      allowAdmin()
      prisma.spaceMembership.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH', url: '/admin/spaces/s1/members/nope',
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'ADMIN' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /admin/spaces/:id/members/:memberId', () => {
    it('should remove member', async () => {
      allowAdmin()
      prisma.spaceMembership.findFirst.mockResolvedValue({ id: 'sm1', spaceId: 's1' })
      prisma.spaceMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/spaces/s1/members/sm1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })
  })
})
