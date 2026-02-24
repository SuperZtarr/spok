import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildCommunitiesTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
  serializeCommunityForAudit: vi.fn((c: any) => ({ id: c?.id })),
  serializeRelationForAudit: vi.fn((r: any) => ({ id: r?.id })),
}))

vi.mock('../utils/r2.js', () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  processAvatar: vi.fn(),
  processCover: vi.fn(),
  uploadEntityImage: vi.fn(),
  deleteFileFromR2: vi.fn(),
  processImage: vi.fn(),
  uploadImageToR2: vi.fn(),
  deleteImageFromR2: vi.fn(),
  uploadFileToR2: vi.fn(),
}))

const USER_ID = 'test-user-id'
const COM_ID = 'com-1'

function mockCommunity(overrides: Record<string, unknown> = {}) {
  return {
    id: COM_ID,
    name: 'Test Community',
    description: null,
    isPublic: false,
    avatarUrl: null,
    coverUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { memberships: 1, spaces: 0 },
    ...overrides,
  }
}

function mockComMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmem-1',
    userId: USER_ID,
    communityId: COM_ID,
    role: 'OWNER',
    joinedAt: new Date(),
    ...overrides,
  }
}

describe('Communities routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildCommunitiesTestApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app)
  })

  // ─── CREATE COMMUNITY ─────────────────────────────────────────

  describe('POST /communities', () => {
    it('should create a community', async () => {
      prisma.community.create.mockResolvedValue(mockCommunity())

      const res = await app.inject({
        method: 'POST',
        url: '/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test Community' },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.role).toBe('OWNER')
      expect(prisma.community.create).toHaveBeenCalledOnce()
      const arg = prisma.community.create.mock.calls[0][0]
      expect(arg.data.memberships.create.role).toBe('OWNER')
    })

    it('should create a public community', async () => {
      prisma.community.create.mockResolvedValue(mockCommunity({ isPublic: true }))

      const res = await app.inject({
        method: 'POST',
        url: '/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Public Com', isPublic: true },
      })

      expect(res.statusCode).toBe(201)
      const arg = prisma.community.create.mock.calls[0][0]
      expect(arg.data.isPublic).toBe(true)
    })

    it('should reject missing name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/communities',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })

      expect(res.statusCode).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/communities',
        payload: { name: 'No Auth' },
      })

      expect(res.statusCode).toBe(401)
    })
  })

  // ─── LIST COMMUNITIES ─────────────────────────────────────────

  describe('GET /communities', () => {
    it('should list user communities', async () => {
      prisma.communityMembership.findMany.mockResolvedValue([
        { ...mockComMembership(), community: mockCommunity() },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/communities',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].role).toBe('OWNER')
      expect(body[0].memberCount).toBe(1)
    })
  })

  // ─── LIST PUBLIC COMMUNITIES ──────────────────────────────────

  describe('GET /communities/public', () => {
    it('should list public communities user has not joined', async () => {
      prisma.communityMembership.findMany.mockResolvedValue([]) // not a member of any
      prisma.community.findMany.mockResolvedValue([
        mockCommunity({ id: 'pub-1', name: 'Public One', isPublic: true }),
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/communities/public',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('Public One')
    })
  })

  // ─── GET COMMUNITY ────────────────────────────────────────────

  describe('GET /communities/:id', () => {
    it('should return community for member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({
        ...mockComMembership(),
        community: mockCommunity(),
      })

      const res = await app.inject({
        method: 'GET',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('OWNER')
    })

    it('should return public community for non-member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.community.findUnique.mockResolvedValue(mockCommunity({ isPublic: true }))

      const res = await app.inject({
        method: 'GET',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBeNull()
    })

    it('should return 404 for private community non-member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.community.findUnique.mockResolvedValue(mockCommunity({ isPublic: false }))

      const res = await app.inject({
        method: 'GET',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── UPDATE COMMUNITY ─────────────────────────────────────────

  describe('PATCH /communities/:id', () => {
    it('should update name as OWNER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'OWNER' }))
      prisma.community.update.mockResolvedValue(mockCommunity({ name: 'Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Renamed' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should update name as ADMIN', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'ADMIN' }))
      prisma.community.update.mockResolvedValue(mockCommunity({ name: 'Admin Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Admin Renamed' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject visibility change by ADMIN', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'ADMIN' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isPublic: true },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject update by MEMBER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nope' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Ghost' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── DELETE COMMUNITY ─────────────────────────────────────────

  describe('DELETE /communities/:id', () => {
    it('should delete community as OWNER (orphan spaces)', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity())
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'OWNER' }))
      prisma.space.findMany.mockResolvedValue([]) // no spaces
      prisma.communityMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.community.delete.mockResolvedValue(mockCommunity())

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should delete with cascade (delete children)', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity())
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'OWNER' }))
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'sp-1', communityId: COM_ID, parentId: null, name: 'Space 1', type: 'GROUP' }]) // community spaces
        .mockResolvedValueOnce([]) // descendants of sp-1
      prisma.item.findMany.mockResolvedValue([]) // no items
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 0 })
      prisma.space.delete.mockResolvedValue({})
      prisma.communityMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.community.delete.mockResolvedValue(mockCommunity())

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}?deleteChildren=true`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject delete by non-OWNER', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity())
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'ADMIN' }))

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/communities/non-existent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── JOIN COMMUNITY ───────────────────────────────────────────

  describe('POST /communities/:id/join', () => {
    it('should join a public community', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity({ isPublic: true }))
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      prisma.communityMembership.create.mockResolvedValue(mockComMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject join of private community', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity({ isPublic: false }))

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject if already a member', async () => {
      prisma.community.findUnique.mockResolvedValue(mockCommunity({ isPublic: true }))
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership())

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should return 404 for non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/communities/non-existent/join',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── LEAVE COMMUNITY ─────────────────────────────────────────

  describe('POST /communities/:id/leave', () => {
    it('should leave as MEMBER (cascade space memberships)', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'MEMBER' }))
      prisma.space.findMany.mockResolvedValue([{ id: 'sp-1' }, { id: 'sp-2' }])
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 2 })
      prisma.communityMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.spaceMembership.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, spaceId: { in: ['sp-1', 'sp-2'] } },
      })
    })

    it('should prevent OWNER from leaving', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'OWNER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 if not a member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── GET MEMBERS ──────────────────────────────────────────────

  describe('GET /communities/:id/members', () => {
    it('should list members', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership())
      prisma.communityMembership.findMany.mockResolvedValue([
        {
          id: 'cmem-1',
          userId: USER_ID,
          role: 'OWNER',
          joinedAt: new Date(),
          user: { id: USER_ID, email: 'test@test.com', name: 'Test' },
        },
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/communities/${COM_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].role).toBe('OWNER')
    })

    it('should return 404 for non-member', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/communities/${COM_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── INVITE MEMBER ────────────────────────────────────────────

  describe('POST /communities/:id/invite', () => {
    it('should invite a user as OWNER', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' })) // caller
        .mockResolvedValueOnce(null) // invited not already member
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'new@test.com', name: 'New' })
      prisma.communityMembership.create.mockResolvedValue({
        id: 'cmem-2',
        userId: 'user-2',
        communityId: COM_ID,
        role: 'MEMBER',
        joinedAt: new Date(),
        user: { id: 'user-2', email: 'new@test.com', name: 'New' },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().email).toBe('new@test.com')
    })

    it('should reject invite by MEMBER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject invite for unknown user', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'OWNER' }))
      prisma.user.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'ghost@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should reject invite for already-member', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce(mockComMembership({ userId: 'user-2' }))
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'dup@test.com', name: 'Dup' })

      const res = await app.inject({
        method: 'POST',
        url: `/communities/${COM_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'dup@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  // ─── REMOVE MEMBER ────────────────────────────────────────────

  describe('DELETE /communities/:id/members/:memberId', () => {
    it('should remove a MEMBER as OWNER', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce({ id: 'cmem-2', userId: 'user-2', communityId: COM_ID, role: 'MEMBER' })
      prisma.communityMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}/members/cmem-2`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should prevent removing the OWNER', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce({ id: 'cmem-owner', userId: 'owner', communityId: COM_ID, role: 'OWNER' })

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}/members/cmem-owner`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should prevent ADMIN from removing another ADMIN', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'ADMIN' }))
        .mockResolvedValueOnce({ id: 'cmem-a2', userId: 'admin-2', communityId: COM_ID, role: 'ADMIN' })

      const res = await app.inject({
        method: 'DELETE',
        url: `/communities/${COM_ID}/members/cmem-a2`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── UPDATE MEMBER ROLE ───────────────────────────────────────

  describe('PATCH /communities/:id/members/:memberId', () => {
    it('should update role as OWNER', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce({ id: 'cmem-2', userId: 'user-2', communityId: COM_ID, role: 'MEMBER' })
      prisma.communityMembership.update.mockResolvedValue({
        id: 'cmem-2',
        userId: 'user-2',
        role: 'ADMIN',
        joinedAt: new Date(),
        user: { id: 'user-2', email: 'u2@test.com', name: 'User 2' },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}/members/cmem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'ADMIN' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('ADMIN')
    })

    it('should reject role change by non-OWNER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockComMembership({ role: 'ADMIN' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}/members/cmem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject changing OWNER role', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce({ id: 'cmem-owner', userId: 'owner', communityId: COM_ID, role: 'OWNER' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}/members/cmem-owner`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject promotion to OWNER', async () => {
      prisma.communityMembership.findUnique
        .mockResolvedValueOnce(mockComMembership({ role: 'OWNER' }))
        .mockResolvedValueOnce({ id: 'cmem-2', userId: 'user-2', communityId: COM_ID, role: 'MEMBER' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/communities/${COM_ID}/members/cmem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'OWNER' },
      })

      expect(res.statusCode).toBe(403)
    })
  })
})
