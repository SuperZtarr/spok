import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import type { FastifyInstance } from 'fastify'

// Mock audit utility
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id, title: item?.title })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
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
      const relation = { id: 'rel-1', fromItemId: 'item-1', toItemId: 'item-2', type: 'RELATED' }
      prisma.itemRelation.create.mockResolvedValue(relation)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-2', type: 'RELATED' },
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
      prisma.itemRelation.create.mockResolvedValue({ id: 'rel-2', fromItemId: 'item-1', toItemId: 'item-3', type: 'DEPENDS_ON' })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-3', type: 'DEPENDS_ON' },
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
        payload: { toItemId: 'non-existent', type: 'RELATED' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should reject creation by VIEWER', async () => {
      allowSpaceAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/items/item-1/relations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { toItemId: 'item-2', type: 'RELATED' },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  describe('DELETE /spaces/:spaceId/items/:id/relations/:relationId', () => {
    it('should delete a relation', async () => {
      allowSpaceAccess()
      const relation = { id: 'rel-1', fromItemId: 'item-1', toItemId: 'item-2', type: 'RELATED' }
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
