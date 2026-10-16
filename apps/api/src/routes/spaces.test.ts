/*
 * TNR des routes /spaces : CRUD, visibilité effective (OPEN→MEMBER implicite), suppression
 * (community OWNER seul), invitations par token, multi-OWNER. Réalignés le 2026-07-11.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildSpacesTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import type { FastifyInstance } from 'fastify'

// Mock audit utility
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
  serializeCommunityForAudit: vi.fn((c: any) => ({ id: c?.id })),
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
    // Mode admin : la sidebar (liste sans communityId) doit inclure les espaces de toutes les communautés,
    // privés compris — bug 2026-10-12 : espace d'une communauté non rejointe absent de la sidebar
    it('should include spaces of all communities, private ones too, in admin mode', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([])
      prisma.space.findMany.mockResolvedValue([mockSpace({ id: 'sp-other', communityId: 'com-x', visibility: 'PRIVATE' })])

      const res = await app.inject({
        method: 'GET',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
      })

      expect(res.statusCode).toBe(200)
      const where = prisma.space.findMany.mock.calls[0][0].where
      expect(where.communityId).toEqual({ not: null })
      expect(where.OR).toBeUndefined()
      expect(res.json()[0]).toMatchObject({ id: 'sp-other', role: 'OWNER', isMember: false })
    })

    // Règle 2026-10-12 : le propriétaire de la communauté voit ses espaces privés, rôle OWNER
    it('should include private spaces of owned communities with role OWNER', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1', role: 'OWNER' }])
      prisma.space.findMany.mockResolvedValue([mockSpace({ id: 'sp-priv', communityId: 'com-1', visibility: 'PRIVATE' })])

      const res = await app.inject({
        method: 'GET',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const where = prisma.space.findMany.mock.calls[0][0].where
      expect(where.OR).toContainEqual({ communityId: { in: ['com-1'] } })
      expect(res.json()[0]).toMatchObject({ id: 'sp-priv', role: 'OWNER', isMember: false })
    })

    // Sidebar 2026-10-12 : filtrage sur la visibilité EFFECTIVE (héritée), pas sur la visibilité propre
    describe('inherited visibility for non-member spaces', () => {
      const TREE: Record<string, { id: string; parentId: string | null; visibility: string | null; communityId: string }> = {
        'sp-priv': { id: 'sp-priv', parentId: null, visibility: 'PRIVATE', communityId: 'com-1' },
        'sp-child-of-priv': { id: 'sp-child-of-priv', parentId: 'sp-priv', visibility: null, communityId: 'com-1' },
        'sp-ro': { id: 'sp-ro', parentId: null, visibility: 'READONLY', communityId: 'com-1' },
        'sp-child-of-ro': { id: 'sp-child-of-ro', parentId: 'sp-ro', visibility: null, communityId: 'com-1' },
      }

      function mockTree(communityRole: 'MEMBER' | 'OWNER') {
        prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
        prisma.spaceMembership.findMany.mockResolvedValue([])
        prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1', role: communityRole }])
        prisma.community.findMany.mockResolvedValue([{ id: 'com-1', visibility: 'OPEN' }])
        prisma.space.findMany.mockImplementation(async ({ where }: any) =>
          where.id?.in
            ? where.id.in.map((id: string) => TREE[id]).filter(Boolean) // getEffectiveVisibilities
            : [mockSpace({ ...TREE['sp-child-of-priv'] }), mockSpace({ ...TREE['sp-child-of-ro'] })]) // liste
      }

      it('hides a sub-space inheriting from a private parent and gives VIEWER under a read-only one', async () => {
        mockTree('MEMBER')

        const res = await app.inject({ method: 'GET', url: '/spaces', headers: { authorization: `Bearer ${token}` } })

        expect(res.statusCode).toBe(200)
        expect(res.json().map((s: any) => [s.id, s.role])).toEqual([['sp-child-of-ro', 'VIEWER']])
      })

      it('keeps every space for the community owner, with role OWNER', async () => {
        mockTree('OWNER')

        const res = await app.inject({ method: 'GET', url: '/spaces', headers: { authorization: `Bearer ${token}` } })

        expect(res.json().map((s: any) => [s.id, s.role])).toEqual([['sp-child-of-priv', 'OWNER'], ['sp-child-of-ro', 'OWNER']])
      })
    })

    it('should not add other communities spaces for an admin without admin mode', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(0)
      expect(prisma.space.findMany).not.toHaveBeenCalled()
    })

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
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-1', type: 'GROUP', communityId: 'com-1', visibility: 'OPEN' }))
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

    // 2026-10-12 : visibilité appliquée dès la création (avant : ignorée, l'espace naissait « hérité »)
    it('should store the requested visibility on a GROUP space at creation', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.space.create.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Bureau', type: 'GROUP', communityId: 'com-1', visibility: 'PRIVATE' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.space.create.mock.calls[0][0].data.visibility).toBe('PRIVATE')
    })

    // Fuite 2026-10-12 : un membre de la communauté créait des sous-espaces sous un espace privé
    it('should refuse a sub-space under a private parent for a mere community member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-1', type: 'GROUP', communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child Space', type: 'GROUP', parentId: 'parent-1' },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.space.create).not.toHaveBeenCalled()
    })

    it('should let the community owner create a sub-space under a private parent', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-1', type: 'GROUP', communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'OWNER' })
      prisma.space.create.mockResolvedValue(mockSpace({ parentId: 'parent-1', communityId: 'com-1' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child Space', type: 'GROUP', parentId: 'parent-1' },
      })

      expect(res.statusCode).toBe(201)
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
    // Mode admin : rôle OWNER renvoyé, membre simple ou non membre → les écrans débloquent tout
    it('should return role OWNER to a plain-member admin in admin mode', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ ...mockMembership({ role: 'MEMBER' }), space: mockSpace() })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('OWNER')
    })

    // Règle Thomas 2026-10-12 : hors mode admin, un admin global est un utilisateur normal
    it('should treat a non-member admin without admin mode as a normal user (private space → 404)', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

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
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'OPEN' }))
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

    it('should return role VIEWER for a community member on a READONLY space', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'READONLY' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('VIEWER')
    })

    // Fuite 2026-10-12 : la fiche d'un espace privé était renvoyée à tout membre de la communauté
    it('should return 404 for a community member on a private space', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    // Règle 2026-10-12 : propriétaire de la communauté = OWNER dans tous ses espaces, privés compris
    it('should return role OWNER to the community owner on a private space he is not a member of', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'OWNER' })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe('OWNER')
    })

    it('should return 404 for an anonymous visitor on a private space of a public community', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE', community: { visibility: 'OPEN' } }))

      const res = await app.inject({ method: 'GET', url: `/spaces/${SPACE_ID}` })

      expect(res.statusCode).toBe(404)
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
    // Bug 2026-10-12 : visibility validée mais jamais enregistrée ; null = retour à l'héritage
    it('should save visibility, and null to inherit again', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ ...mockMembership({ role: 'OWNER' }), space: mockSpace() })
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.space.update.mockResolvedValue(mockSpace())

      const set = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { visibility: 'READONLY' },
      })
      expect(set.statusCode).toBe(200)
      expect(prisma.space.update.mock.calls[0][0].data.visibility).toBe('READONLY')

      const reset = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { visibility: null },
      })
      expect(reset.statusCode).toBe(200)
      expect(prisma.space.update.mock.calls[1][0].data.visibility).toBeNull()
    })

    // Revue sécu 2026-10-12 : rattacher son espace sous un parent privé sans y avoir accès
    it('should refuse moving a space under a private parent without write access to it', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
        where.userId_spaceId.spaceId === SPACE_ID
          ? { ...mockMembership({ role: 'OWNER' }), space: mockSpace({ communityId: 'com-1' }) }
          : null)
      prisma.space.findUnique.mockResolvedValue(mockSpace({ id: 'parent-priv', type: 'GROUP', communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'MEMBER' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { parentId: 'parent-priv' },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.space.update).not.toHaveBeenCalled()
    })

    it('should update space name as OWNER', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace(),
      })
      prisma.space.findUnique.mockResolvedValue(mockSpace())
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

    it('should allow global admin in admin mode to update without membership', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.space.update.mockResolvedValue(mockSpace({ name: 'Admin Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
        payload: { name: 'Admin Renamed' },
      })

      expect(res.statusCode).toBe(200)
    })

    // Alignement 2026-10-12 : hors mode admin, un admin global n'a que ses droits de membre
    it('should refuse a global admin without admin mode on a space he does not own', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue(mockSpace())

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Admin Renamed' },
      })

      expect(res.statusCode).toBe(404)
      expect(prisma.space.update).not.toHaveBeenCalled()
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
      prisma.space.findUnique.mockResolvedValue(mockSpace())

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { parentId: SPACE_ID },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should cascade communityId to descendant spaces when moving to another community', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace({ communityId: 'com-old', parentId: null }),
      })
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-old', parentId: null }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-new' })
      // Arbre : SPACE_ID -> child-1 -> grandchild-1
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }])
        .mockResolvedValueOnce([{ id: 'grandchild-1' }])
        .mockResolvedValueOnce([])
      prisma.space.update.mockResolvedValue(mockSpace({ communityId: 'com-new' }))
      prisma.space.updateMany.mockResolvedValue({ count: 2 })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { communityId: 'com-new' },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.space.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['child-1', 'grandchild-1'] } },
        data: { communityId: 'com-new' },
      })
    })

    it('ne touche pas les descendants si communityId ne change pas', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace({ communityId: 'com-1', parentId: null }),
      })
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', parentId: null }))
      prisma.space.update.mockResolvedValue(mockSpace({ name: 'Renamed' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Renamed' },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.space.updateMany).not.toHaveBeenCalled()
    })

    it('should reject community on PERSONAL space', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue({
        ...mockMembership({ role: 'OWNER' }),
        space: mockSpace({ type: 'PERSONAL' }),
      })
      prisma.space.findUnique.mockResolvedValue(mockSpace({ type: 'PERSONAL' }))

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

    // Régression prod 2026-10-13 : audit écrit après space.delete → FK audit_logs_spaceId_fkey (400)
    it('deleteChildren : audite chaque sous-espace AVANT de le supprimer', async () => {
      prisma.space.findUnique
        .mockResolvedValueOnce(mockSpace())
        .mockResolvedValueOnce(mockSpace({ id: 'child-space' }))
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))
      prisma.space.findMany
        .mockResolvedValueOnce([{ id: 'child-space' }])
        .mockResolvedValueOnce([])
      prisma.item.findMany.mockResolvedValue([])
      prisma.spaceMembership.deleteMany.mockResolvedValue({ count: 1 })
      prisma.space.delete.mockResolvedValue(mockSpace())
      const { createAuditLog } = await import('../utils/audit.js')
      const audit = vi.mocked(createAuditLog)
      audit.mockClear()

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}?deleteChildren=true`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      for (const id of ['child-space', SPACE_ID]) {
        const auditIdx = audit.mock.calls.findIndex((c) => c[1].entity === 'Space' && c[1].entityId === id)
        const deleteIdx = prisma.space.delete.mock.calls.findIndex((c: any[]) => c[0].where.id === id)
        expect(auditIdx).toBeGreaterThanOrEqual(0)
        expect(deleteIdx).toBeGreaterThanOrEqual(0)
        expect(audit.mock.invocationCallOrder[auditIdx])
          .toBeLessThan(prisma.space.delete.mock.invocationCallOrder[deleteIdx])
      }
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
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'OPEN' }))
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
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'OPEN' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership())

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
    })

    // Fuite 2026-10-12 : tout membre de la communauté pouvait rejoindre un espace privé
    it('should refuse joining a private space', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.spaceMembership.create).not.toHaveBeenCalled()
    })

    // Revue sécu 2026-10-12 : rejoindre un espace READONLY donnait une adhésion MEMBER (écriture)
    it('should refuse joining a read-only space for a mere community member', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'READONLY' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'MEMBER' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.spaceMembership.create).not.toHaveBeenCalled()
    })

    it('should let the community owner join a private space', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace({ communityId: 'com-1', visibility: 'PRIVATE' }))
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'OWNER' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.spaceMembership.create.mockResolvedValue(mockMembership({ role: 'MEMBER' }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/join`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
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

    it('should prevent the only OWNER from leaving', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))
      prisma.spaceMembership.count.mockResolvedValue(0) // aucun autre propriétaire

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      expect(prisma.spaceMembership.delete).not.toHaveBeenCalled()
    })

    // 2026-10-12 : un propriétaire ne pouvait jamais partir, même avec un co-propriétaire
    it('should let an OWNER leave when another owner remains', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership({ role: 'OWNER' }))
      prisma.spaceMembership.count.mockResolvedValue(1)
      prisma.spaceMembership.delete.mockResolvedValue(mockMembership())

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/leave`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.spaceMembership.delete).toHaveBeenCalled()
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
      prisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, communityId: 'com-1', visibility: 'OPEN' })
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })
      prisma.spaceMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should show members of a private space to the community owner', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, communityId: 'com-1', visibility: 'PRIVATE' })
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1', role: 'OWNER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should hide members of a private space from a mere community member', async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, communityId: 'com-1', visibility: 'PRIVATE' })
      prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'com-1' })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/members`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
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
    beforeEach(() => {
      prisma.space.findUnique.mockResolvedValue(mockSpace()) // espace cible, lu avant la garde de rôle
    })

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
      prisma.space.findUnique.mockResolvedValue(mockSpace({ type: 'PERSONAL' }))
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

  // Règle : le mode admin voit et fait tout — admin global non membre + header X-Admin-Mode
  describe('Mode admin (admin global non membre)', () => {
    const adminHeaders = () => ({ authorization: `Bearer ${token}`, 'x-admin-mode': 'true' })

    it('should remove a space member as admin in admin mode', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'mem-2', userId: 'user-2', spaceId: SPACE_ID, role: 'MEMBER' })
      prisma.spaceMembership.delete.mockResolvedValue({})

      const res = await app.inject({ method: 'DELETE', url: `/spaces/${SPACE_ID}/members/mem-2`, headers: adminHeaders() })

      expect(res.statusCode).toBe(200)
    })

    it('should invite to a space as admin in admin mode', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace())
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN', id: 'admin-1', name: 'Admin' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.invitation.findFirst.mockResolvedValue(null)
      prisma.invitation.create.mockResolvedValue({
        id: 'inv-9', email: 'x@test.com', role: 'MEMBER', spaceId: SPACE_ID, token: 'tok-9', status: 'PENDING',
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/invite`,
        headers: adminHeaders(),
        payload: { email: 'x@test.com', role: 'MEMBER' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should reject a space member removal by an admin without admin mode', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.spaceMembership.findUnique.mockResolvedValue(null)

      const res = await app.inject({ method: 'DELETE', url: `/spaces/${SPACE_ID}/members/mem-2`, headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(403)
    })
  })

  // Ordre manuel (2026-10-16) : PUT /spaces/reorder, droits par niveau
  describe('PUT /spaces/reorder', () => {
    const put = (payload: Record<string, unknown>) =>
      app.inject({ method: 'PUT', url: '/spaces/reorder', headers: { authorization: `Bearer ${token}` }, payload })

    it('racine d\'une communauté : le propriétaire de la communauté réordonne', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])

      const res = await put({ parentId: null, communityId: 'com-1', orderedIds: ['b', 'a'] })

      expect(res.statusCode).toBe(200)
      expect(res.json().order).toEqual(['b', 'a'])
      expect(prisma.space.findMany.mock.calls[0][0].where).toEqual({ parentId: null, communityId: 'com-1', type: 'GROUP' })
    })

    it('racine d\'une communauté : un simple membre est refusé', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })

      const res = await put({ parentId: null, communityId: 'com-1', orderedIds: ['a'] })

      expect(res.statusCode).toBe(403)
      expect(prisma.space.update).not.toHaveBeenCalled()
    })

    it('sous un parent : il faut gérer le parent', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.communityMembership.findUnique.mockResolvedValue(null)

      const res = await put({ parentId: 'parent-1', orderedIds: ['a'] })

      expect(res.statusCode).toBe(403)
    })

    it('sous un parent : le propriétaire du parent réordonne ses sous-espaces', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])

      const res = await put({ parentId: 'parent-1', orderedIds: ['b'] })

      expect(res.statusCode).toBe(200)
      expect(prisma.space.findMany.mock.calls[0][0].where).toEqual({ parentId: 'parent-1' })
    })
  })

  describe('POST /spaces — ordre manuel', () => {
    it('un nouvel espace arrive en dernier parmi ses frères', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.space.aggregate.mockResolvedValue({ _max: { position: 3 } })
      prisma.space.create.mockResolvedValue(mockSpace({ communityId: 'com-1' }))

      const res = await app.inject({
        method: 'POST',
        url: '/spaces',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Nouveau', type: 'GROUP', communityId: 'com-1' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.space.create.mock.calls[0][0].data.position).toBe(4)
    })
  })
})
