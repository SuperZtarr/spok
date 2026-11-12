/*
 * TNR de POST /spaces/:spaceId/items/bulk-tags (vue Tags, sélection multiple, 2026-11-11) : ajout et retrait en une
 * transaction, sans double, éléments déjà conformes ignorés, tag hors de portée refusé (autre communauté, tag d'un
 * espace non parent ; tag d'un espace parent accepté), lecteur refusé, audit,
 * membre limité à ses éléments (auteur ou assigné) sauf copie de séance verrouillée.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemBulkRoutes } from './item-bulk.js'
import { createAuditLogs } from '../utils/audit.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
  createAuditLogs: vi.fn().mockResolvedValue({}),
  serializeItemForAudit: vi.fn((i: unknown) => i),
}))

const SPACE = 'space-1'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ statusCode: 400, message: error.message })
    if ('statusCode' in error && typeof error.statusCode === 'number') return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message })
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(async (opt) => {
    opt.addHook('preHandler', opt.authenticate)
    await opt.register(itemBulkRoutes, { prefix: '/spaces/:spaceId/items' })
  })
  await app.ready()
  return { app, prisma }
}

const item = (id: string, tagIds: string[], communityId: string | null = 'com-1', createdById = 'test-user-id', lockedAt: Date | null = null) =>
  ({ id, spaceId: SPACE, createdById, assignedToId: null, lockedAt, space: { communityId }, tags: tagIds.map((t) => ({ tag: { id: t, name: t } })) })

describe('POST /bulk-tags', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    vi.mocked(createAuditLogs).mockClear()
    const r = await buildApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app)
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER', spaceId: SPACE })
    prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1', parentId: null })
  })

  const post = (payload: object) => app.inject({
    method: 'POST', url: `/spaces/${SPACE}/items/bulk-tags`, headers: { authorization: `Bearer ${token}` }, payload,
  })

  it('ajoute un tag à plusieurs éléments, sans double ; un élément déjà tagué est ignoré', async () => {
    prisma.item.findMany.mockResolvedValue([item('a', []), item('b', ['bug'])])
    prisma.tag.findMany.mockResolvedValue([{ id: 'bug', name: 'bug', communityId: 'com-1', spaceId: null }])

    const res = await post({ itemIds: ['a', 'b'], addTagIds: ['bug'] })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ updated: 1 })
    expect(prisma.itemTag.createMany).toHaveBeenCalledWith({ data: [{ itemId: 'a', tagId: 'bug' }], skipDuplicates: true })
    expect(vi.mocked(createAuditLogs).mock.calls[0][1]).toEqual([
      expect.objectContaining({ entityId: 'a', changes: { before: { tags: [] }, after: { tags: ['bug'] } } }),
    ])
  })

  it('retire un tag des éléments qui le portent', async () => {
    prisma.item.findMany.mockResolvedValue([item('a', ['bug', 'ux']), item('b', ['ux'])])

    const res = await post({ itemIds: ['a', 'b'], removeTagIds: ['bug'] })

    expect(res.json()).toEqual({ updated: 1 })
    expect(prisma.itemTag.deleteMany).toHaveBeenCalledWith({ where: { itemId: { in: ['a'] }, tagId: { in: ['bug'] } } })
  })

  it('tag global : accepté même hors communauté', async () => {
    prisma.item.findMany.mockResolvedValue([item('a', [], null)])
    prisma.tag.findMany.mockResolvedValue([{ id: 'g', name: 'urgent', communityId: null, spaceId: null }])
    expect((await post({ itemIds: ['a'], addTagIds: ['g'] })).statusCode).toBe(200)
  })

  it('tag d\'une autre communauté : refusé (400), rien écrit', async () => {
    prisma.space.findUnique.mockResolvedValue({ communityId: 'com-2', parentId: null })
    prisma.item.findMany.mockResolvedValue([item('a', [], 'com-2')])
    prisma.tag.findMany.mockResolvedValue([{ id: 'bug', name: 'bug', communityId: 'com-1', spaceId: null }])

    expect((await post({ itemIds: ['a'], addTagIds: ['bug'] })).statusCode).toBe(400)
    expect(prisma.itemTag.createMany).not.toHaveBeenCalled()
  })

  it('tag d\'espace : accepté dans l\'espace et ses sous-espaces, refusé ailleurs', async () => {
    prisma.item.findMany.mockResolvedValue([item('a', [])])
    // SPACE a pour parent « parent » : un tag de « parent » y est hérité
    prisma.space.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === SPACE ? { communityId: 'com-1', parentId: 'parent' } : where.id === 'parent' ? { communityId: 'com-1', parentId: null } : null)
    prisma.tag.findMany.mockResolvedValue([{ id: 'p', name: 'perso', communityId: null, spaceId: 'parent' }])
    expect((await post({ itemIds: ['a'], addTagIds: ['p'] })).statusCode).toBe(200)

    prisma.tag.findMany.mockResolvedValue([{ id: 's', name: 'autre', communityId: null, spaceId: 'sibling' }])
    expect((await post({ itemIds: ['a'], addTagIds: ['s'] })).statusCode).toBe(400)
  })

  it('membre : élément d\'un autre (ni auteur ni assigné) refusé (403), rien écrit ; copie de séance verrouillée permise', async () => {
    prisma.tag.findMany.mockResolvedValue([{ id: 'bug', name: 'bug', communityId: 'com-1', spaceId: null }])
    prisma.item.findMany.mockResolvedValue([item('a', []), item('b', [], 'com-1', 'other-user')])
    expect((await post({ itemIds: ['a', 'b'], addTagIds: ['bug'] })).statusCode).toBe(403)
    expect(prisma.itemTag.createMany).not.toHaveBeenCalled()

    prisma.item.findMany.mockResolvedValue([item('c', [], 'com-1', 'other-user', new Date())])
    expect((await post({ itemIds: ['c'], addTagIds: ['bug'] })).statusCode).toBe(200)

    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'OWNER', spaceId: SPACE })
    prisma.item.findMany.mockResolvedValue([item('d', [], 'com-1', 'other-user')])
    expect((await post({ itemIds: ['d'], addTagIds: ['bug'] })).statusCode).toBe(200)
  })

  it('lecteur refusé ; requête sans tag refusée', async () => {
    expect((await post({ itemIds: ['a'] })).statusCode).toBe(400)
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'VIEWER', spaceId: SPACE })
    expect((await post({ itemIds: ['a'], addTagIds: ['bug'] })).statusCode).toBe(403)
  })
})
