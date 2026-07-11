import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildSpacesTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import type { FastifyInstance } from 'fastify'

// Mock audit utility
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
}))

// Mock R2 utility
vi.mock('../utils/r2.js', () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  processImage: vi.fn(),
  processAvatar: vi.fn(),
  processCover: vi.fn(),
  uploadImageToR2: vi.fn(),
  uploadEntityImage: vi.fn(),
  deleteImageFromR2: vi.fn(),
  uploadFileToR2: vi.fn(),
  deleteFileFromR2: vi.fn(),
}))

const USER_ID = 'test-user-id'
const SPACE_ID = 'space-1'

function mockSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: SPACE_ID,
    name: 'Test Space',
    type: 'GROUP',
    communityId: null,
    parentId: null,
    avatarUrl: null,
    coverUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { memberships: 1, items: 5 },
    community: null,
    parent: null,
    ...overrides,
  }
}

function mockMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: USER_ID,
    spaceId: SPACE_ID,
    role: 'OWNER',
    joinedAt: new Date(),
    ...overrides,
  }
}

describe('Spaces routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildSpacesTestApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app)
  })

  // ─── LIST SPACES ──────────────────────────────────────────────

  describe('GET /spaces', () => {
    it('should list user spaces', async () => {
      const space = mockSpace()
      prisma.spaceMembership.findMany.mockResolvedValue([
        { ...mockMembership(), space },
      ])
      prisma.communityMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('Test Space')
      expect(body[0].role).toBe('OWNER')
      expect(body[0].isMember).toBe(true)
    })

    it('should filter by communityId', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
      prisma.space.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/spaces?communityId=com-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should return empty for non-member community', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/spaces?communityId=com-unknown',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
    })

    // Route en optionalAuthenticate : un anonyme voit les espaces publics (liste vide ici)
    it('should return public spaces for anonymous', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/spaces',
      })
      expect(res.statusCode).toBe(200)
    })
  })

  // ─── CREATE SPACE ─────────────────────────────────────────────

  describe('POST /spaces', () => {
    it('should create a GROUP space', async () => {
      const created = mockSpace({ id: 'new-space' })
      prisma.space.create.mockResolvedValue(created)

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Space', type: 'GROUP' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.space.create).toHaveBeenCalledOnce()
      const createArg = prisma.space.create.mock.calls[0][0]
      expect(createArg.data.memberships.create.role).toBe('OWNER')
    })

    it('should create a GROUP space with communityId', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.space.create.mockResolvedValue(mockSpace({ communityId: 'com-1' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Community Space', type: 'GROUP', communityId: 'com-1' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should reject PERSONAL space with communityId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'My Space', type: 'PERSONAL', communityId: 'com-1' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject PERSONAL space with parentId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'My Space', type: 'PERSONAL', parentId: 'parent-1' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should inherit communityId from parent', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-1', type: 'GROUP', communityId: 'com-1' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.space.create.mockResolvedValue(mockSpace({ parentId: 'parent-1', communityId: 'com-1' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child Space', type: 'GROUP', parentId: 'parent-1' },
      })

      expect(res.statusCode).toBe(201)
      const createArg = prisma.space.create.mock.calls[0][0]
      expect(createArg.data.communityId).toBe('com-1')
    })

    it('should reject non-GROUP parent', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-1', type: 'PERSONAL' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child', type: 'GROUP', parentId: 'parent-1' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject missing name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'GROUP' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject non-member of community', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Space', type: 'GROUP', communityId: 'com-1' },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── GET SPACE BY ID ──────────────────────────────────────────

  describe('GET /spaces/:id', () => {
    it('should return space for direct member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership(),
        space: mockSpace(),
      })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('OWNER')
      expect(res.json().memberCount).toBe(1)
    })

    it('should return space for community member with implicit MEMBER role (OPEN)', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      // Visibilité effective OPEN → rôle implicite MEMBER (VIEWER réservé à READONLY)
      expect(res.json().role).toBe('MEMBER')
    })

    it('should return 404 when no access', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── UPDATE SPACE ─────────────────────────────────────────────

  describe('PATCH /spaces/:id', () => {
    it('should update space name as OWNER', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace(),
      })
      prisma.space.update.mockResolvedValue(mockSpace({ name: 'Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Renamed' },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.space.update).toHaveBeenCalledOnce()
    })

    it('should allow global admin to update without membership', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.space.update.mockResolvedValue(mockSpace({ name: 'Admin Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Admin Renamed' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject update by MEMBER', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'MEMBER' }),
        space: mockSpace(),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nope' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject self as parent', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace(),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { parentId: SPACE_ID },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject community on PERSONAL space', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace({ type: 'PERSONAL' }),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'com-1' },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ─── DELETE SPACE ─────────────────────────────────────────────

  describe('DELETE /spaces/:id', () => {
    it('should delete space as OWNER', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))
      prisma.space.findMany.mockResolvedValue([]) // no descendant spaces
      prisma.item.findMany.mockResolvedValue([]) // no items
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.space.delete.mockResolvedValue(mockSpace())

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should delete with cascade (children)', async () => {
      prisma.space.findUnique
        .mockResolvedValueOnce(mockSpace()) // initial space lookup
        .mockResolvedValueOnce(mockSpace({ id: 'child-space' })) // descendant lookup for audit
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'child-space' }]) // direct children
        .mockResolvedValueOnce([]) // grandchildren of child-space
      prisma.item.findMany.mockResolvedValue([]) // no items
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.space.delete.mockResolvedValue(mockSpace())

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}?deleteChildren=true`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    // Seul le OWNER de la communauté peut supprimer un espace communautaire (plus l'ADMIN)
    it('should allow community OWNER to delete', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.spaceMembership.findUnique.mockResolvedValue(null) // not space member
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'OWNER' })
      prisma.space.findMany.mockResolvedValue([]) // no descendants
      prisma.item.findMany.mockResolvedValue([])
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 0 })
      prisma.space.delete.mockResolvedValue(mockSpace())

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject delete by community ADMIN', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'ADMIN' })

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject delete by MEMBER', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent space', async () => {
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/spaces/non-existent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── JOIN SPACE ───────────────────────────────────────────────

  describe('POST /spaces/:id/join', () => {
    it('should join a community space', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null) // not already member
      prisma.spaceMembership.create.mockResolvedValue(mockMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject join of non-community space', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: null }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject if not community member', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject if already member', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership())

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  // ─── LEAVE SPACE ──────────────────────────────────────────────

  describe('POST /spaces/:id/leave', () => {
    it('should leave a space as MEMBER', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }))
      prisma.spaceMembership.delete.mockResolvedValue(mockMembership())

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should prevent OWNER from leaving', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 if not a member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── GET MEMBERS ──────────────────────────────────────────────

  describe('GET /spaces/:id/members', () => {
    it('should list members for space member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership())
      prisma.spaceMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          userId: USER_ID,
          role: 'OWNER',
          joinedAt: new Date(),
          user: { id: USER_ID, email: 'test@test.com', name: 'Test' },
        },
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].role).toBe('OWNER')
    })

    it('should allow community member to list members', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, communityId: 'com-1' })
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should return 404 when no access', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── INVITE MEMBER ────────────────────────────────────────────

  describe('POST /spaces/:id/invite', () => {
    it('should invite a user as OWNER', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce({ ...mockMembership({ role: 'OWNER' }), space: mockSpace() }) // caller check
        .mockResolvedValueOnce(null) // invited user not already member
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-2', email: 'new@test.com', name: 'New User' }) // invited lookup
        .mockResolvedValueOnce({ name: 'Test' }) // inviter name
      prisma.invitation.findFirst.mockResolvedValue(null)
      prisma.invitation.create.mockResolvedValue({
        id: 'inv-1', email: 'new@test.com', role: 'MEMBER', spaceId: SPACE_ID, token: 'tok-123', status: 'PENDING',
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().email).toBe('new@test.com')
      expect(prisma.invitation.create).toHaveBeenCalledOnce()
    })

    it('should reject invite by MEMBER', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'MEMBER' }),
        space: mockSpace(),
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject invite to PERSONAL space', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace({ type: 'PERSONAL' }),
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    // Un email inconnu n'est plus une erreur : invitation par token possible sans compte
    it('should invite an unknown email (no account yet)', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace(),
      })
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.invitation.findFirst.mockResolvedValue(null)
      prisma.invitation.create.mockResolvedValue({
        id: 'inv-2', email: 'ghost@test.com', role: 'MEMBER', spaceId: SPACE_ID, token: 'tok-456', status: 'PENDING',
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'ghost@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().email).toBe('ghost@test.com')
    })

    it('should reject invite for already-member', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce({ ...mockMembership({ role: 'OWNER' }), space: mockSpace() })
        .mockResolvedValueOnce(mockMembership({ userId: 'user-2' })) // already member
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'dup@test.com', name: 'Dup' })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'dup@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  // ─── REMOVE MEMBER ────────────────────────────────────────────

  describe('DELETE /spaces/:id/members/:memberId', () => {
    it('should remove a MEMBER as OWNER', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'OWNER' })) // caller
        .mockResolvedValueOnce({ id: 'mem-2', userId: 'user-2', spaceId: SPACE_ID, role: 'MEMBER' }) // target
      prisma.spaceMembership.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/members/mem-2`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should prevent removing the OWNER', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'OWNER' })) // caller = OWNER
        .mockResolvedValueOnce({ id: 'mem-owner', userId: 'owner-id', spaceId: SPACE_ID, role: 'OWNER' }) // target = OWNER

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/members/mem-owner`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should prevent ADMIN from removing another ADMIN', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'ADMIN' })) // caller = ADMIN
        .mockResolvedValueOnce({ id: 'mem-admin', userId: 'admin-2', spaceId: SPACE_ID, role: 'ADMIN' }) // target = ADMIN

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/members/mem-admin`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── UPDATE MEMBER ROLE ───────────────────────────────────────

  describe('PATCH /spaces/:id/members/:memberId', () => {
    it('should update role as OWNER', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'OWNER' })) // caller
        .mockResolvedValueOnce({ id: 'mem-2', userId: 'user-2', spaceId: SPACE_ID, role: 'MEMBER' }) // target
      prisma.spaceMembership.update.mockResolvedValue({
        id: 'mem-2',
        userId: 'user-2',
        role: 'ADMIN',
        joinedAt: new Date(),
        user: { id: 'user-2', email: 'user2@test.com', name: 'User 2' },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/members/mem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'ADMIN' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('ADMIN')
    })

    it('should reject role change by non-OWNER', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/members/mem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    // Multi-OWNER autorisé : rétrograder un OWNER n'est refusé que s'il est le dernier
    it('should reject demoting the last OWNER', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'OWNER' })) // caller
        .mockResolvedValueOnce({ id: 'mem-owner', userId: 'owner-id', spaceId: SPACE_ID, role: 'OWNER' }) // target
      prisma.spaceMembership.count.mockResolvedValue(1) // dernier owner

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/members/mem-owner`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should allow promoting a member to OWNER (multi-owner)', async () => {
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership({ role: 'OWNER' })) // caller
        .mockResolvedValueOnce({ id: 'mem-2', userId: 'user-2', spaceId: SPACE_ID, role: 'MEMBER' }) // target
      prisma.spaceMembership.update.mockResolvedValue({
        id: 'mem-2', userId: 'user-2', role: 'OWNER', joinedAt: new Date(),
        user: { id: 'user-2', email: 'u2@test.com', name: 'User 2' },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/members/mem-2`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'OWNER' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('OWNER')
    })
  })
})
