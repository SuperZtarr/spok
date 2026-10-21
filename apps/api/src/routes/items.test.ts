/*
 * TNR des routes /spaces/:spaceId/items : accès (membership direct/communauté), CRUD
 * (titre optionnel, défaut ''), détail avec relations/tags/reactionSummary.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import type { FastifyInstance } from 'fastify'

// Mock audit utility
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id, title: item?.title })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
  serializeCommunityForAudit: vi.fn((c: any) => ({ id: c?.id })),
}))

// Mock R2 utility
vi.mock('../utils/r2.js', () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  processImage: vi.fn(),
  uploadImageToR2: vi.fn(),
  deleteImageFromR2: vi.fn(),
  uploadFileToR2: vi.fn(),
  deleteFileFromR2: vi.fn(),
}))

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'

// Reusable mock item
function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'Test Item',
    type: 'NOTE',
    description: null,
    content: null,
    url: null,
    status: null,
    priority: null,
    dueDate: null,
    startDate: new Date(),
    endDate: null,
    position: 0,
    parentId: null,
    spaceId: SPACE_ID,
    createdById: USER_ID,
    imageUrl: null,
    documentUrl: null,
    documentName: null,
    createdAt: new Date(),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    tags: [],
    children: [],
    _count: { children: 0, contributions: 0 },
    relationsFrom: [],
    relationsTo: [],
    ...overrides,
  }
}

// Reusable membership mock
function mockMembership(role = 'MEMBER') {
  return { id: 'mem-1', userId: USER_ID, spaceId: SPACE_ID, role, joinedAt: new Date() }
}

describe('Items routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildItemsTestApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app)
  })

  // Helper: mock space access (direct membership)
  function allowSpaceAccess(role = 'MEMBER') {
    prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership(role))
  }

  // Helper: mock space access via community — la visibilité effective (space → parent →
  // community) doit être résolue : community OPEN → rôle implicite MEMBER
  function allowCommunityAccess() {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
    prisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, communityId: 'community-1', visibility: null, parentId: null, community: { visibility: 'OPEN', isPublic: false } })
    prisma.community.findUnique.mockResolvedValue({ visibility: 'OPEN' })
    prisma.communityMembership.findUnique.mockResolvedValue({ userId: USER_ID, communityId: 'community-1' })
  }

  // Helper: deny all access
  function denyAccess() {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue(null)
  }

  // ─── LIST ITEMS ───────────────────────────────────────────────

  describe('GET /spaces/:spaceId/items', () => {
    it('should list items with pagination', async () => {
      allowSpaceAccess()
      const items = [mockItem({ id: 'item-1' }), mockItem({ id: 'item-2', title: 'Second' })]
      prisma.item.findMany.mockResolvedValue(items)
      prisma.item.count.mockResolvedValue(2)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(20)
    })

    it('should filter by type', async () => {
      allowSpaceAccess()
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items?type=TASK`,
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.type).toBe('TASK')
    })

    it('should allow community members to list items (VIEWER)', async () => {
      allowCommunityAccess()
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should return 404 when no space access', async () => {
      denyAccess()

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items`,
      })

      expect(res.statusCode).toBe(401)
    })
  })

  // ─── CREATE ITEM ──────────────────────────────────────────────

  describe('POST /spaces/:spaceId/items', () => {
    it('should create a NOTE item', async () => {
      allowSpaceAccess()
      const created = mockItem({ id: 'new-item', tags: [] })
      prisma.item.create.mockResolvedValue(created)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'NOTE', title: 'My Note' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.item.create).toHaveBeenCalledOnce()
      const createArg = prisma.item.create.mock.calls[0][0]
      expect(createArg.data.spaceId).toBe(SPACE_ID)
      expect(createArg.data.createdById).toBe(USER_ID)
    })

    it('should create item with tags', async () => {
      allowSpaceAccess()
      const created = mockItem({ tags: [{ tag: { id: 'tag-1', name: 'urgent' } }] })
      prisma.item.create.mockResolvedValue(created)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'TASK', title: 'Task', tagIds: ['tag-1'] },
      })

      expect(res.statusCode).toBe(201)
      const createArg = prisma.item.create.mock.calls[0][0]
      expect(createArg.data.tags.create).toEqual([{ tagId: 'tag-1' }])
    })

    it('should reject creation by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'NOTE', title: 'Should fail' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject invalid type', async () => {
      allowSpaceAccess()

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'INVALID', title: 'Bad type' },
      })

      expect(res.statusCode).toBe(400)
    })

    // Le titre est désormais optionnel (défaut '') — création rapide sans titre autorisée
    it('should create with empty title by default', async () => {
      allowSpaceAccess()
      prisma.item.create.mockResolvedValue(mockItem({ title: '', tags: [] }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'NOTE' },
      })

      expect(res.statusCode).toBe(201)
      const arg = prisma.item.create.mock.calls[0][0]
      expect(arg.data.title).toBe('')
    })

    // « Pas de statut » = null : le web envoie status '' à la création rapide
    it('normalise un statut vide en null', async () => {
      allowSpaceAccess()
      prisma.item.create.mockResolvedValue(mockItem({ status: null, tags: [] }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: 'UNDEFINED', title: '', status: '' },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.item.create.mock.calls[0][0].data.status).toBeNull()
    })
  })

  // ─── GET ITEM BY ID ───────────────────────────────────────────

  describe('GET /spaces/:spaceId/items/:id', () => {
    it('should return item with relations and tags', async () => {
      allowSpaceAccess()
      const item = mockItem({
        tags: [{ tag: { id: 'tag-1', name: 'important' } }],
        children: [{ id: 'child-1', title: 'Child', tags: [] }],
        parent: null,
        createdBy: { id: USER_ID, name: 'Test', email: 'test@test.com' },
        contributions: [],
        reactions: [], // le handler construit un reactionSummary depuis item.reactions
      })
      prisma.item.findFirst.mockResolvedValue(item)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.tags).toEqual([{ id: 'tag-1', name: 'important' }])
    })

    it('should return 404 for non-existent item', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items/non-existent`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── UPDATE ITEM ──────────────────────────────────────────────

  describe('PATCH /spaces/:spaceId/items/:id', () => {
    it('should update item fields', async () => {
      allowSpaceAccess()
      const existing = mockItem()
      prisma.item.findFirst.mockResolvedValue(existing)
      const updated = mockItem({ title: 'Updated', tags: [] })
      prisma.item.update.mockResolvedValue(updated)

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated' },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.item.update).toHaveBeenCalledOnce()
    })

    it('should set horizonSetAt when manualHorizon changes', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ manualHorizon: null, horizonSetAt: null }))
      prisma.item.update.mockResolvedValue(mockItem({ manualHorizon: 'WEEK' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { manualHorizon: 'WEEK' },
      })

      expect(res.statusCode).toBe(200)
      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.manualHorizon).toBe('WEEK')
      expect(updateArg.data.horizonSetAt).toBeInstanceOf(Date)
    })

    it('should set horizonSetAt when manualHorizon is explicitly cleared to null', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ manualHorizon: 'WEEK', horizonSetAt: new Date('2026-01-01') }))
      prisma.item.update.mockResolvedValue(mockItem({ manualHorizon: null }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { manualHorizon: null },
      })

      expect(res.statusCode).toBe(200)
      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.manualHorizon).toBeNull()
      expect(updateArg.data.horizonSetAt).toBeInstanceOf(Date)
    })

    it('should not touch horizonSetAt when manualHorizon is not in the payload', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.item.update.mockResolvedValue(mockItem({ title: 'Updated' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated' },
      })

      expect(res.statusCode).toBe(200)
      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.horizonSetAt).toBeUndefined()
    })

    it('should update tags (delete old + create new)', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.item.update.mockResolvedValue(mockItem({ tags: [{ tag: { id: 'tag-2', name: 'new' } }] }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { tagIds: ['tag-2'] },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.itemTag.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'item-1' } })
    })

    it('should detect optimistic locking conflict', async () => {
      allowSpaceAccess()
      const existing = mockItem({ updatedAt: new Date('2025-01-01T00:00:00.000Z') })
      prisma.item.findFirst.mockResolvedValue(existing)

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Changed',
          updatedAt: '2024-12-31T00:00:00.000Z', // stale timestamp
        },
      })

      expect(res.statusCode).toBe(409)
      const body = res.json()
      expect(body.code).toBe('CONFLICT_DETECTED')
      expect(body.conflicts).toBeDefined()
    })

    it('should allow update when updatedAt matches', async () => {
      allowSpaceAccess()
      const now = new Date('2025-01-01T00:00:00.000Z')
      const existing = mockItem({ updatedAt: now })
      prisma.item.findFirst.mockResolvedValue(existing)
      prisma.item.update.mockResolvedValue(mockItem({ title: 'OK', tags: [] }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'OK',
          updatedAt: now.toISOString(),
        },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject update by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Nope' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent item', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/non-existent`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Ghost' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should auto-set endDate when status changes to done', async () => {
      allowSpaceAccess()
      const existing = mockItem({ status: 'in_progress', endDate: null })
      prisma.item.findFirst.mockResolvedValue(existing)
      prisma.item.update.mockResolvedValue(mockItem({ status: 'done', tags: [] }))

      await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })

      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.endDate).toBeInstanceOf(Date)
    })

    // Règle status-autofill-start (businessRules.ts) : appliquée par l'API quel que soit le chemin
    it('should auto-set startDate when a status is set on an item without start date', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ status: null, startDate: null, endDate: null }))
      prisma.item.update.mockResolvedValue(mockItem({ status: 'todo', tags: [] }))

      await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'todo' },
      })

      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.startDate).toBeInstanceOf(Date)
      expect(updateArg.data.endDate).toBeUndefined()
    })

    it('should use a past endDate as startDate when status is set', async () => {
      allowSpaceAccess()
      const pastEnd = new Date('2026-01-10T00:00:00.000Z')
      prisma.item.findFirst.mockResolvedValue(mockItem({ status: null, startDate: null, endDate: pastEnd }))
      prisma.item.update.mockResolvedValue(mockItem({ status: 'done', tags: [] }))

      await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done' },
      })

      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.startDate).toEqual(pastEnd)
      expect(updateArg.data.endDate).toBeUndefined()
    })

    it('should not override dates sent explicitly with the status', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ status: null, startDate: null, endDate: null }))
      prisma.item.update.mockResolvedValue(mockItem({ status: 'done', tags: [] }))

      await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done', startDate: null, endDate: '2026-02-01T00:00:00.000Z' },
      })

      const updateArg = prisma.item.update.mock.calls[0][0]
      expect(updateArg.data.startDate).toBeNull()
      expect(updateArg.data.endDate).toEqual(new Date('2026-02-01T00:00:00.000Z'))
    })

    it('should apply status date rules to propagated descendants', async () => {
      allowSpaceAccess('OWNER')
      prisma.item.findFirst.mockResolvedValue(mockItem({ status: 'in_progress', endDate: null }))
      prisma.item.update.mockResolvedValue(mockItem({ status: 'done', tags: [] }))
      const existingEnd = new Date('2026-03-01T00:00:00.000Z')
      prisma.item.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.parentId === 'item-1') return [
          { id: 'child-1', startDate: null, endDate: null },
          { id: 'child-2', startDate: new Date('2026-02-01T00:00:00.000Z'), endDate: existingEnd },
        ]
        return []
      })

      await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'done', propagateToChildren: true },
      })

      expect(prisma.item.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['child-1', 'child-2'] } },
        data: { status: 'done' },
      })
      const childUpdates = prisma.item.update.mock.calls.map((c: any[]) => c[0]).filter((a: any) => a.where.id !== 'item-1')
      expect(childUpdates).toHaveLength(1)
      expect(childUpdates[0].where.id).toBe('child-1')
      expect(childUpdates[0].data.endDate).toBeInstanceOf(Date)
      expect(childUpdates[0].data.startDate).toBeInstanceOf(Date)
    })
  })

  // ─── DELETE ITEM ──────────────────────────────────────────────

  describe('DELETE /spaces/:spaceId/items/:id', () => {
    it('should delete an item', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ tags: [] }))
      prisma.item.delete.mockResolvedValue(mockItem())

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
    })

    it('should delete with cascade (children)', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ tags: [] }))
      // First call: find children of item-1
      prisma.item.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }]) // children
        .mockResolvedValueOnce([]) // grandchildren
        .mockResolvedValueOnce([{ id: 'child-1', title: 'Child', type: 'NOTE' }]) // descendants for audit
      prisma.item.deleteMany.mockResolvedValue({ count: 1 })
      prisma.item.delete.mockResolvedValue(mockItem())

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/item-1?deleteChildren=true`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.item.deleteMany).toHaveBeenCalled()
    })

    it('should reject delete by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent item', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/non-existent`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── RELATIONS ────────────────────────────────────────────────

  describe('POST /spaces/:spaceId/items/:id/relations', () => {
    it('should create a relation between items', async () => {
      allowSpaceAccess()
      // fromItem in space, toItem also in space
      prisma.item.findFirst
        .mockResolvedValueOnce(mockItem({ id: 'item-1' }))
        .mockResolvedValueOnce(mockItem({ id: 'item-2' }))
      const relation = { id: 'rel-1', fromItemId: 'item-1', toItemId: 'item-2', type: 'relates' }
      prisma.itemRelation.create.mockResolvedValue(relation)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-2', type: 'relates' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().id).toBe('rel-1')
    })

    it('should allow cross-space relation when user has access to both', async () => {
      allowSpaceAccess()
      prisma.item.findFirst
        .mockResolvedValueOnce(mockItem({ id: 'item-1', spaceId: SPACE_ID }))
        .mockResolvedValueOnce(mockItem({ id: 'item-3', spaceId: 'space-2' }))
      // Cross-space access check: user has membership in target space
      prisma.spaceMembership.findUnique
        .mockResolvedValueOnce(mockMembership()) // first check (space-1)
        .mockResolvedValueOnce(mockMembership()) // second check (space-2 cross-space)
      prisma.itemRelation.create.mockResolvedValue({ id: 'rel-2', fromItemId: 'item-1', toItemId: 'item-3', type: 'blocks' })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-3', type: 'blocks' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should return 404 when toItem does not exist', async () => {
      allowSpaceAccess()
      prisma.item.findFirst
        .mockResolvedValueOnce(mockItem({ id: 'item-1' }))
        .mockResolvedValueOnce(null) // toItem not found

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'non-existent', type: 'relates' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should reject creation by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-2', type: 'relates' },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  describe('DELETE /spaces/:spaceId/items/:id/relations/:relationId', () => {
    it('should delete a relation', async () => {
      allowSpaceAccess()
      const relation = { id: 'rel-1', fromItemId: 'item-1', toItemId: 'item-2', type: 'relates' }
      prisma.itemRelation.findFirst.mockResolvedValue(relation)
      prisma.itemRelation.delete.mockResolvedValue(relation)

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/item-1/relations/rel-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should return 404 for non-existent relation', async () => {
      allowSpaceAccess()
      prisma.itemRelation.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/items/item-1/relations/non-existent`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── MOVE ITEM ────────────────────────────────────────────────

  describe('PATCH /spaces/:spaceId/items/:id/move', () => {
    it('should move item to new position', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.item.findUnique.mockResolvedValue(null) // no parent cycle check needed
      prisma.item.findMany.mockResolvedValue([]) // no siblings
      prisma.item.update.mockResolvedValue(mockItem({ position: 0 }))
      prisma.$transaction.mockResolvedValue([])

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1/move`,
        headers: { authorization: `Bearer ${token}` },
        payload: { position: 0 },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject move by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1/move`,
        headers: { authorization: `Bearer ${token}` },
        payload: { position: 0 },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should prevent moving item to be its own descendant', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ id: 'item-1' }))
      // Cycle: parent chain leads back to item-1
      prisma.item.findUnique
        .mockResolvedValueOnce({ id: 'item-2', parentId: 'item-1' }) // parentId lookup
        .mockResolvedValueOnce(mockItem({ id: 'item-1', parentId: null })) // found cycle

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1/move`,
        headers: { authorization: `Bearer ${token}` },
        payload: { parentId: 'item-2', position: 0 },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ─── CONTRIBUTIONS ────────────────────────────────────────────

  describe('GET /spaces/:spaceId/items/:id/contributions', () => {
    it('should list contributions for an item', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.contribution.findMany.mockResolvedValue([
        { id: 'c-1', content: 'Hello', author: { id: USER_ID, name: 'Test', email: 'test@test.com' } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/items/item-1/contributions`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].content).toBe('Hello')
    })
  })

  describe('POST /spaces/:spaceId/items/:id/contributions', () => {
    it('should create a contribution', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.contribution.create.mockResolvedValue({
        id: 'c-new',
        content: 'My comment',
        itemId: 'item-1',
        authorId: USER_ID,
        author: { id: USER_ID, name: 'Test', email: 'test@test.com' },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/contributions`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'My comment' },
      })

      expect(res.statusCode).toBe(201)
    })

    it('should reject empty content', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/contributions`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '' },
      })

      expect(res.statusCode).toBe(400)
    })
  })
})

describe('verrou de séance', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const token = () => getTestToken(app)
  const lockedItem = {
    id: 'copy-1', spaceId: 'sess-space', type: 'NOTE', title: 'Copie', status: 'todo',
    createdById: 'presenter-id', lockedAt: new Date('2026-10-10T10:00:00Z'), parentId: null,
    updatedAt: new Date('2026-10-10T10:00:00Z'), position: 0,
  }

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: 'test-user-id', spaceId: 'sess-space', role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue(lockedItem)
  })

  it('PATCH status sur item verrouillé → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { status: 'done' } })
    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('PATCH parentId sur item verrouillé créé par un autre → autorisé pour un MEMBER', async () => {
    prisma.item.update.mockResolvedValue({ ...lockedItem, parentId: 'theme-1', tags: [] })
    const res = await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { parentId: 'theme-1' } })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE item verrouillé par un MEMBER (même auteur) → 403', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, createdById: 'test-user-id', tags: [] })
    const res = await app.inject({ method: 'DELETE', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` } })
    expect(res.statusCode).toBe(403)
  })

  it('split sur item verrouillé → 403', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, description: '<h2>A</h2>' })
    const res = await app.inject({ method: 'POST', url: '/spaces/sess-space/items/copy-1/split',
      headers: { authorization: `Bearer ${token()}` } })
    expect(res.statusCode).toBe(403)
  })

  it('propagation de statut ignore les enfants verrouillés', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: 'test-user-id', spaceId: 'sess-space', role: 'OWNER' })
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, id: 'theme-1', lockedAt: null })
    prisma.item.update.mockResolvedValue({ ...lockedItem, id: 'theme-1', lockedAt: null, tags: [] })
    await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/theme-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { status: 'done', propagateToChildren: true } })
    const childQueries = prisma.item.findMany.mock.calls.map((c: any[]) => c[0]?.where).filter((w: any) => w?.parentId)
    expect(childQueries.length).toBeGreaterThan(0)
    for (const where of childQueries) expect(where.lockedAt).toBeNull()
  })

describe('verrou de séance — suppression en cascade', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: 'test-user-id', spaceId: 'sess-space', role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue({ id: 'theme-1', spaceId: 'sess-space', createdById: 'test-user-id', lockedAt: null, tags: [] })
    prisma.item.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId === 'theme-1') return [{ id: 'copy-1' }]
      if (where?.id?.in) return [{ id: 'copy-1', lockedAt: new Date(), spaceId: 'sess-space' }]
      return []
    })
  })

  it('DELETE deleteChildren par un MEMBER : refusé si un descendant est une copie verrouillée', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/spaces/sess-space/items/theme-1?deleteChildren=true',
      headers: { authorization: `Bearer ${getTestToken(app)}` } })
    expect(res.statusCode).toBe(403)
    expect(prisma.item.deleteMany).not.toHaveBeenCalled()
  })
})
})

// Règle : le mode admin voit et fait tout — checkSpaceAccess(…, isAdminMode) donne OWNER à l'admin
describe('checkSpaceAccess — mode admin', () => {
  const fakePrisma = (membership: any, globalRole: string) => ({
    spaceMembership: { findUnique: vi.fn().mockResolvedValue(membership) },
    user: { findUnique: vi.fn().mockResolvedValue({ globalRole }) },
    space: { findUnique: vi.fn().mockResolvedValue(null) },
  })

  it('donne OWNER à un admin membre simple en mode admin', async () => {
    const { checkSpaceAccess } = await import('./items.js')
    const access = await checkSpaceAccess(fakePrisma({ id: 'm1', userId: 'u1', spaceId: 's1', role: 'MEMBER' }, 'ADMIN'), 'u1', 's1', true)
    expect(access?.role).toBe('OWNER')
  })

  it('donne OWNER à un admin non membre en mode admin', async () => {
    const { checkSpaceAccess } = await import('./items.js')
    const access = await checkSpaceAccess(fakePrisma(null, 'ADMIN'), 'u1', 's1', true)
    expect(access?.role).toBe('OWNER')
  })

  // Règle Thomas 2026-10-12 : hors mode admin, un admin global est un utilisateur normal (plus de lecture d'office)
  it('garde le rôle réel hors mode admin, et aucun accès pour un admin non membre', async () => {
    const { checkSpaceAccess } = await import('./items.js')
    expect((await checkSpaceAccess(fakePrisma({ role: 'MEMBER' }, 'ADMIN'), 'u1', 's1'))?.role).toBe('MEMBER')
    expect(await checkSpaceAccess(fakePrisma(null, 'ADMIN'), 'u1', 's1')).toBeNull()
  })

  it("ignore le header mode admin pour un non-admin", async () => {
    const { checkSpaceAccess } = await import('./items.js')
    const access = await checkSpaceAccess(fakePrisma({ role: 'MEMBER' }, 'USER'), 'u1', 's1', true)
    expect(access?.role).toBe('MEMBER')
  })
})

// filterReadableSpaceIds : version en masse de checkSpaceAccess (graphes/sunburst) — visibilité effective
describe('filterReadableSpaceIds', () => {
  const SPACES: Record<string, { id: string; parentId: string | null; visibility: string | null; communityId: string | null }> = {
    open: { id: 'open', parentId: null, visibility: 'OPEN', communityId: 'c1' },
    priv: { id: 'priv', parentId: null, visibility: 'PRIVATE', communityId: 'c1' },
    childOfPriv: { id: 'childOfPriv', parentId: 'priv', visibility: null, communityId: 'c1' },
    inherited: { id: 'inherited', parentId: null, visibility: null, communityId: 'c1' },
  }

  async function run(opts: { userId?: string; globalRole?: string; communityRole?: string; communityVisibility?: string; direct?: string[]; adminMode?: boolean }, ids: string[]) {
    const { createMockPrisma } = await import('../test/helpers.js')
    const prisma = createMockPrisma()
    prisma.user.findUnique.mockResolvedValue({ globalRole: opts.globalRole ?? 'USER' })
    prisma.space.findMany.mockImplementation(async ({ where }: any) => where.id.in.map((id: string) => SPACES[id]).filter(Boolean))
    prisma.community.findMany.mockResolvedValue([{ id: 'c1', visibility: opts.communityVisibility ?? 'PRIVATE' }])
    prisma.communityMembership.findMany.mockResolvedValue(opts.communityRole ? [{ communityId: 'c1', role: opts.communityRole }] : [])
    prisma.spaceMembership.findMany.mockResolvedValue((opts.direct ?? []).map(spaceId => ({ spaceId })))
    const { filterReadableSpaceIds } = await import('./items.js')
    return filterReadableSpaceIds(prisma, opts.userId, ids, opts.adminMode ?? false)
  }

  const ALL = ['open', 'priv', 'childOfPriv', 'inherited']

  it('community member: open and inherited-open spaces, never private ones nor their inherited children', async () => {
    expect(await run({ userId: 'u1', communityRole: 'MEMBER', communityVisibility: 'OPEN' }, ALL)).toEqual(['open', 'inherited'])
  })

  it('direct member of a private space can read it', async () => {
    expect(await run({ userId: 'u1', communityRole: 'MEMBER', direct: ['priv'] }, ['priv'])).toEqual(['priv'])
  })

  it('community owner reads every space of the community', async () => {
    expect(await run({ userId: 'u1', communityRole: 'OWNER' }, ALL)).toEqual(ALL)
  })

  it('anonymous: nothing in a private community, non-private spaces in a public one', async () => {
    expect(await run({}, ALL)).toEqual([])
    expect(await run({ communityVisibility: 'READONLY' }, ALL)).toEqual(['open', 'inherited'])
  })

  it('global admin reads everything in admin mode only', async () => {
    expect(await run({ userId: 'u1', globalRole: 'ADMIN', adminMode: true }, ALL)).toEqual(ALL)
    // Hors mode admin : utilisateur normal (ici non membre d'une communauté privée → rien)
    expect(await run({ userId: 'u1', globalRole: 'ADMIN' }, ALL)).toEqual([])
  })
})

// Règle assignee-can-manage-item (décision Thomas 2026-10-15) : un MEMBER modifie, supprime et déplace
// vers un autre espace les items qu'il a créés OU qui lui sont assignés ; les autres restent refusés.
describe('MEMBER assigné non auteur', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const assigned = { id: 'item-1', spaceId: 'space-1', title: 'T', type: 'TASK', status: null, parentId: null,
    position: 0, createdById: 'other-user', assignedToId: 'test-user-id', lockedAt: null, tags: [],
    updatedAt: new Date('2025-01-01T00:00:00.000Z') }
  const foreign = { ...assigned, assignedToId: 'someone-else' }

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: 'test-user-id', spaceId: 'space-1', role: 'MEMBER', joinedAt: new Date() })
  })

  it('PATCH : l\'assigné modifie (200), un tiers est refusé (403)', async () => {
    prisma.item.findFirst.mockResolvedValue(assigned)
    prisma.item.update.mockResolvedValue({ ...assigned, title: 'Nouveau' })
    const ok = await app.inject({ method: 'PATCH', url: '/spaces/space-1/items/item-1', headers: auth(), payload: { title: 'Nouveau' } })
    expect(ok.statusCode).toBe(200)

    prisma.item.findFirst.mockResolvedValue(foreign)
    prisma.item.update.mockClear()
    const ko = await app.inject({ method: 'PATCH', url: '/spaces/space-1/items/item-1', headers: auth(), payload: { title: 'Nouveau' } })
    expect(ko.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('DELETE : l\'assigné supprime (200), un tiers est refusé (403)', async () => {
    prisma.item.findFirst.mockResolvedValue(assigned)
    prisma.item.delete.mockResolvedValue(assigned)
    const ok = await app.inject({ method: 'DELETE', url: '/spaces/space-1/items/item-1', headers: auth() })
    expect(ok.statusCode).toBe(200)

    prisma.item.findFirst.mockResolvedValue(foreign)
    prisma.item.delete.mockClear()
    const ko = await app.inject({ method: 'DELETE', url: '/spaces/space-1/items/item-1', headers: auth() })
    expect(ko.statusCode).toBe(403)
    expect(prisma.item.delete).not.toHaveBeenCalled()
  })

  it('bulk-move : autorisé si chaque item est à lui ou lui est assigné, refusé sinon', async () => {
    const own = { ...foreign, id: 'item-2', createdById: 'test-user-id' }
    prisma.tag.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([assigned, own])
    const ok = await app.inject({ method: 'POST', url: '/spaces/space-1/items/bulk-move', headers: auth(),
      payload: { itemIds: ['item-1', 'item-2'], targetSpaceId: 'space-2', includeChildren: false } })
    expect(ok.statusCode).toBe(200)

    prisma.item.findMany.mockResolvedValue([assigned, foreign])
    const ko = await app.inject({ method: 'POST', url: '/spaces/space-1/items/bulk-move', headers: auth(),
      payload: { itemIds: ['item-1', 'item-3'], targetSpaceId: 'space-2', includeChildren: false } })
    expect(ko.statusCode).toBe(403)
  })
})
