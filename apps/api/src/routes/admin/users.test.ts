/* TNR de l'administration des utilisateurs : CRUD, rôles, garde authenticateAdmin. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminUsersRoutes } from './users.js'

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

const ADMIN_ID = 'admin-user-id'

async function buildAdminUsersApp() {
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
  await app.register(adminUsersRoutes, { prefix: '/admin/users' })

  await app.ready()
  return { app, prisma }
}

describe('Admin Users routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAdminUsersApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: ADMIN_ID, email: 'admin@test.com' })
  })

  function allowAdmin() {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  }

  // ─── AUTH ──────────────────────────────────────────────

  it('should return 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/users' })
    expect(res.statusCode).toBe(401)
  })

  it('should return 403 for non-admin user', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
    const res = await app.inject({
      method: 'GET', url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  // ─── LIST USERS ────────────────────────────────────────

  describe('GET /admin/users', () => {
    it('should list users with pagination', async () => {
      allowAdmin()
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@b.com', name: 'A', globalRole: 'USER', createdAt: new Date(), updatedAt: new Date(), _count: { memberships: 2 } },
      ])
      prisma.user.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })
  })

  // ─── GET SINGLE USER ──────────────────────────────────

  describe('GET /admin/users/:id', () => {
    it('should return a single user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1', email: 'a@b.com', name: 'A', globalRole: 'USER',
        createdAt: new Date(), updatedAt: new Date(),
        _count: { memberships: 1, communityMemberships: 0 },
        memberships: [], communityMemberships: [],
      })

      const res = await app.inject({
        method: 'GET', url: '/admin/users/u1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe('u1')
    })

    it('should return 404 for non-existent user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'GET', url: '/admin/users/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── CREATE USER ───────────────────────────────────────

  describe('POST /admin/users', () => {
    it('should create a user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null) // no duplicate
      prisma.user.create.mockResolvedValue({
        id: 'new-user', email: 'new@test.com', name: 'New', globalRole: 'USER',
        createdAt: new Date(), updatedAt: new Date(), _count: { memberships: 1 },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', password: 'password123', name: 'New' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().email).toBe('new@test.com')
    })

    it('should reject duplicate email', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' })

      const res = await app.inject({
        method: 'POST', url: '/admin/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'existing@test.com', password: 'password123', name: 'Dupe' },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  // ─── UPDATE USER ───────────────────────────────────────

  describe('PATCH /admin/users/:id', () => {
    it('should update a user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'old@test.com', globalRole: 'USER' })
      prisma.user.update.mockResolvedValue({
        id: 'u1', email: 'old@test.com', name: 'Updated', globalRole: 'USER',
        createdAt: new Date(), updatedAt: new Date(), _count: { memberships: 1 },
      })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/users/u1',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should prevent removing last admin role', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'admin@test.com', globalRole: 'ADMIN' })
      prisma.user.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'PATCH', url: '/admin/users/u1',
        headers: { authorization: `Bearer ${token}` },
        payload: { globalRole: 'USER' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject duplicate email on update', async () => {
      allowAdmin()
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', email: 'old@test.com', globalRole: 'USER' })
        .mockResolvedValueOnce({ id: 'u2', email: 'taken@test.com' })

      const res = await app.inject({
        method: 'PATCH', url: '/admin/users/u1',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'taken@test.com' },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should return 404 for non-existent user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'PATCH', url: '/admin/users/nope',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Ghost' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── DELETE USER ───────────────────────────────────────

  describe('DELETE /admin/users/:id', () => {
    it('should delete a user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', globalRole: 'USER' })
      prisma.user.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/users/u1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should prevent self-deletion', async () => {
      allowAdmin()

      const res = await app.inject({
        method: 'DELETE', url: `/admin/users/${ADMIN_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should prevent deleting last admin', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'other-admin', globalRole: 'ADMIN' })
      prisma.user.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'DELETE', url: '/admin/users/other-admin',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should return 404 for non-existent user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'DELETE', url: '/admin/users/nope',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── ADD TO COMMUNITY ─────────────────────────────────

  describe('POST /admin/users/:id/communities', () => {
    it('should add user to community', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.communityMembership.create.mockResolvedValue({
        id: 'cm1', userId: 'u1', communityId: 'c1', role: 'MEMBER', joinedAt: new Date(),
        community: { id: 'c1', name: 'Test' },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/users/u1/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'c1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should return 409 if already member', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.communityMembership.findUnique.mockResolvedValue({ id: 'existing' })

      const res = await app.inject({
        method: 'POST', url: '/admin/users/u1/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'c1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should demote current owner when adding as OWNER', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.community.findUnique.mockResolvedValue({ id: 'c1' })
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.communityMembership.updateMany.mockResolvedValue({ count: 1 })
      prisma.communityMembership.create.mockResolvedValue({
        id: 'cm1', userId: 'u1', communityId: 'c1', role: 'OWNER', joinedAt: new Date(),
        community: { id: 'c1', name: 'Test' },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/users/u1/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'c1', role: 'OWNER' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.communityMembership.updateMany).toHaveBeenCalledOnce()
    })
  })

  // ─── REMOVE FROM COMMUNITY ────────────────────────────

  describe('DELETE /admin/users/:id/communities/:communityId', () => {
    it('should remove user from community', async () => {
      allowAdmin()
      prisma.communityMembership.findUnique.mockResolvedValue({ id: 'cm1' })
      prisma.communityMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/users/u1/communities/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should return 404 if not member', async () => {
      allowAdmin()
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE', url: '/admin/users/u1/communities/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── ADD TO SPACE ──────────────────────────────────────
  // NOTE: Route defined as ':id/spaces' (no leading /) in users.ts
  // This creates URL pattern /admin/users:id/spaces (no separator)

  describe('POST /admin/users:id/spaces', () => {
    it('should add user to space', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.space.findUnique.mockResolvedValue({ id: 's1', type: 'GROUP' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.spaceMembership.create.mockResolvedValue({
        id: 'sm1', userId: 'u1', spaceId: 's1', role: 'MEMBER', joinedAt: new Date(),
        space: { id: 's1', name: 'Test', type: 'GROUP' },
      })

      const res = await app.inject({
        method: 'POST', url: '/admin/usersu1/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { spaceId: 's1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should reject adding to personal space', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
      prisma.space.findUnique.mockResolvedValue({ id: 's1', type: 'PERSONAL' })

      const res = await app.inject({
        method: 'POST', url: '/admin/usersu1/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { spaceId: 's1', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ─── REMOVE FROM SPACE ────────────────────────────────

  describe('DELETE /admin/users:id/spaces/:spaceId', () => {
    it('should remove user from space', async () => {
      allowAdmin()
      prisma.spaceMembership.findUnique.mockResolvedValue({
        id: 'sm1', space: { type: 'GROUP' },
      })
      prisma.spaceMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE', url: '/admin/usersu1/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject removing from personal space', async () => {
      allowAdmin()
      prisma.spaceMembership.findUnique.mockResolvedValue({
        id: 'sm1', space: { type: 'PERSONAL' },
      })

      const res = await app.inject({
        method: 'DELETE', url: '/admin/usersu1/spaces/s1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /admin/users/:id/access-tree', () => {
    it('should mark direct memberships (community and space)', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
      prisma.community.findMany.mockResolvedValueOnce([
        { id: 'c1', name: 'Communauté A', visibility: 'PRIVATE', isPublic: false },
      ])
      prisma.space.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Espace A', communityId: 'c1', parentId: null, visibility: null },
      ])
      prisma.communityMembership.findMany.mockResolvedValueOnce([{ communityId: 'c1', role: 'MEMBER' }])
      prisma.spaceMembership.findMany.mockResolvedValueOnce([{ spaceId: 's1', role: 'OWNER' }])

      const res = await app.inject({
        method: 'GET', url: '/admin/users/u1/access-tree',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().tree).toEqual([
        {
          id: 'c1', name: 'Communauté A', kind: 'community', role: 'MEMBER', source: 'direct',
          children: [
            { id: 's1', name: 'Espace A', kind: 'space', role: 'OWNER', source: 'direct', children: [] },
          ],
        },
      ])
    })

    it('should mark implicit access via visibility OPEN inherited from the community', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
      prisma.community.findMany.mockResolvedValueOnce([
        { id: 'c1', name: 'Communauté A', visibility: 'OPEN', isPublic: false },
      ])
      prisma.space.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Espace A', communityId: 'c1', parentId: null, visibility: null },
      ])
      prisma.communityMembership.findMany.mockResolvedValueOnce([{ communityId: 'c1', role: 'MEMBER' }])
      prisma.spaceMembership.findMany.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'GET', url: '/admin/users/u1/access-tree',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.json().tree[0].children[0]).toEqual({
        id: 's1', name: 'Espace A', kind: 'space', role: 'MEMBER', source: 'community', children: [],
      })
    })

    it('should return no access for a PRIVATE space/community without membership', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
      prisma.community.findMany.mockResolvedValueOnce([
        { id: 'c1', name: 'Communauté A', visibility: 'PRIVATE', isPublic: false },
      ])
      prisma.space.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Espace A', communityId: 'c1', parentId: null, visibility: null },
      ])
      prisma.communityMembership.findMany.mockResolvedValueOnce([])
      prisma.spaceMembership.findMany.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'GET', url: '/admin/users/u1/access-tree',
        headers: { authorization: `Bearer ${token}` },
      })

      const { tree } = res.json()
      expect(tree[0].role).toBe(null)
      expect(tree[0].children[0]).toEqual({
        id: 's1', name: 'Espace A', kind: 'space', role: null, source: null, children: [],
      })
    })

    it('should grant ADMIN role everywhere when the target user is a global admin', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
      prisma.community.findMany.mockResolvedValueOnce([
        { id: 'c1', name: 'Communauté A', visibility: 'PRIVATE', isPublic: false },
      ])
      prisma.space.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Espace A', communityId: 'c1', parentId: null, visibility: null },
      ])
      prisma.communityMembership.findMany.mockResolvedValueOnce([])
      prisma.spaceMembership.findMany.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'GET', url: '/admin/users/u1/access-tree',
        headers: { authorization: `Bearer ${token}` },
      })

      const { tree } = res.json()
      expect(tree[0].role).toBe('ADMIN')
      expect(tree[0].children[0].role).toBe('ADMIN')
    })

    it('should return 404 for an unknown user', async () => {
      allowAdmin()
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await app.inject({
        method: 'GET', url: '/admin/users/unknown/access-tree',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
