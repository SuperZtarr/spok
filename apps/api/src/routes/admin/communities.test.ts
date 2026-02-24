import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminCommunitiesRoutes } from './communities.js'

vi.mock('../../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
  serializeItemForAudit: vi.fn((item: unknown) => item),
  serializeSpaceForAudit: vi.fn((space: unknown) => space),
  serializeCommunityForAudit: vi.fn((community: unknown) => community),
}))

const ADMIN_ID = 'admin-user-id'

async function buildAdminCommunitiesApp() {
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
  await app.register(adminCommunitiesRoutes, { prefix: '/admin/communities' })

  await app.ready()
  return { app, prisma }
}

describe('Admin Communities routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAdminCommunitiesApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: ADMIN_ID, email: 'admin@test.com' })
  })

  function allowAdmin() {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  }

  // ─── LIST COMMUNITIES ──────────────────────────────────

  describe('GET /admin/communities', () => {
    it('should list communities with pagination', async () => {
      allowAdmin()
      prisma.community.findMany.mockResolvedValue([{
        id: 'c1', name: 'Community 1', _count: { memberships: 5, spaces: 3 },
      }])
      prisma.community.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/admin/communities',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].memberCount).toBe(5)
      expect(body.data[0].spaceCount).toBe(3)
    })
  })

  // ─── GET SINGLE COMMUNITY ─────────────────────────────

  describe('GET /admin/communities/:id', () => {
    it('should return a community with members and spaces', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({
        id: 'c1', name: 'Com', _count: { memberships: 1, spaces: 1 },
        memberships: [{ id: 'cm1', userId: 'u1', user: { id: 'u1', email: 'a@t.com', name: 'A' }, role: 'OWNER', joinedAt: new Date() }],
        spaces: [{ id: 's1', name: 'S1', type: 'GROUP', _count: { memberships: 2 } }],
      })

      const res = await app.inject({
        method: 'GET', url: '/admin/communities/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().members).toHaveLength(1)
      expect(res.json().spaces).toHaveLength(1)
    })

    it('should return 404 for non-existent community', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET', url: '/admin/communities/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── CREATE COMMUNITY ─────────────────────────────────

  describe('POST /admin/communities', () => {
    it('should create a community', async () => {
      allowAdmin()
      prisma.community.create.mockResolvedValue({
        id: 'c1', name: 'New Com', _count: { memberships: 1, spaces: 0 },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Com' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().memberCount).toBe(1)
    })

    it('should create with specified owner email', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'owner-user' })
      prisma.community.create.mockResolvedValue({
        id: 'c1', name: 'Owned', _count: { memberships: 1, spaces: 0 },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Owned', ownerEmail: 'owner@test.com' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should return 404 for non-existent owner email', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'POST', url: '/admin/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Bad Owner', ownerEmail: 'nobody@test.com' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── UPDATE COMMUNITY ─────────────────────────────────

  describe('PATCH /admin/communities/:id', () => {
    it('should update a community', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.community.update.mockResolvedValue({
        id: 'c1', name: 'Updated', _count: { memberships: 2, spaces: 1 },
      })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/communities/c1',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should return 404 for non-existent community', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH', url: '/admin/communities/nope',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Ghost' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── DELETE PREVIEW ────────────────────────────────────

  describe('GET /admin/communities/:id/delete-preview', () => {
    it('should return delete preview', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.space.findMany.mockResolvedValue([
        { id: 's1', name: 'S1', _count: { items: 5 } },
      ])
      prisma.item.count.mockResolvedValue(5)
      prisma.communityMembership.count.mockResolvedValue(3)

      const res = await app.inject({
        method: 'GET', url: '/admin/communities/c1/delete-preview',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.spaces).toHaveLength(1)
      expect(body.totalMemberCount).toBe(3)
    })
  })

  // ─── DELETE COMMUNITY ──────────────────────────────────

  describe('DELETE /admin/communities/:id', () => {
    it('should delete community and orphan spaces (no deleteChildren)', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', name: 'Doomed' })
      prisma.space.findMany.mockResolvedValue([{ id: 's1' }]) // has spaces
      prisma.space.updateMany.mockResolvedValue({ count: 1 })
      prisma.communityMembership.deleteMany.mockResolvedValue({ count: 2 })
      prisma.community.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/communities/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      // Spaces should be orphaned, not deleted
      expect(prisma.space.updateMany).toHaveBeenCalled()
    })

    it('should return 404 for non-existent community', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE', url: '/admin/communities/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── ADD MEMBER ────────────────────────────────────────

  describe('POST /admin/communities/:id/members', () => {
    it('should add member to community', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.communityMembership.create.mockResolvedValue({
        id: 'cm1', userId: 'u1', role: 'MEMBER', joinedAt: new Date(),
        user: { id: 'u1', email: 'a@t.com', name: 'A' },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/communities/c1/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'a@t.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should return 409 if already member', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.communityMembership.findUnique.mockResolvedValue({ id: 'existing' })

      const res = await app.inject({
        method: 'POST', url: '/admin/communities/c1/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'a@t.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should return 404 for non-existent user', async () => {
      allowAdmin()
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'POST', url: '/admin/communities/c1/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'nobody@t.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
