/* TNR de l'administration des tags (/admin/tags, 2026-11-11) : accès admin, tag global (unicité), rendre global,
   doublons regroupés sans casse, fusion (cible visible depuis tous les éléments, sinon refus ; liens sans double). */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminTagsRoutes, duplicateKey } from './tags.js'
import { createAuditLog } from '../../utils/audit.js'

vi.mock('../../utils/audit.js', () => ({ createAuditLog: vi.fn().mockResolvedValue({}) }))

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ statusCode: 400, message: error.message })
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })
  await app.register(sensible)
  await app.register(fp(async (f) => { f.decorate('prisma', prisma as any) }, { name: 'prisma' }))
  await app.register(jwtPlugin)
  await app.register(adminAuthPlugin)
  await app.register(adminTagsRoutes, { prefix: '/admin/tags' })
  await app.ready()
  return { app, prisma }
}

const tag = (id: string, name: string, scope: { communityId?: string | null; spaceId?: string | null } = {}, items = 0) =>
  ({ id, name, color: null, communityId: scope.communityId ?? null, spaceId: scope.spaceId ?? null, community: null, space: null, _count: { items } })

describe('Admin tags routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    vi.mocked(createAuditLog).mockClear()
    const r = await buildApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app, { userId: 'admin-id', email: 'admin@test.com' })
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
  })

  const inject = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload && { payload }) })

  it('refuse un non-admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
    expect((await inject('GET', '/admin/tags')).statusCode).toBe(403)
  })

  it('liste : portée de chaque tag', async () => {
    prisma.tag.findMany.mockResolvedValue([tag('g', 'bug'), tag('c', 'bug', { communityId: 'com-1' }, 2), tag('s', 'x', { spaceId: 'sp' })])
    const body = (await inject('GET', '/admin/tags')).json()
    expect(body.map((t: any) => t.scope)).toEqual(['global', 'community', 'space'])
    expect(body[1].itemCount).toBe(2)
  })

  it('crée un tag global ; refuse un nom déjà pris en global', async () => {
    prisma.tag.findMany.mockResolvedValueOnce([])
    prisma.tag.create.mockResolvedValue(tag('g', 'urgent'))
    const ok = await inject('POST', '/admin/tags', { name: ' urgent ', color: '#ff0000' })
    expect(ok.statusCode).toBe(201)
    expect(prisma.tag.create.mock.calls[0][0].data).toEqual({ name: 'urgent', color: '#ff0000' })
    expect(createAuditLog).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'CREATE', entity: 'Tag' }))

    prisma.tag.findMany.mockResolvedValueOnce([{ id: 'g', name: 'Urgent', communityId: null, spaceId: null }])
    expect((await inject('POST', '/admin/tags', { name: 'urgent' })).statusCode).toBe(409)
  })

  it('rendre global : communauté et espace retirés ; refus si un global du même nom existe', async () => {
    prisma.tag.findUnique.mockResolvedValue(tag('c', 'bug', { communityId: 'com-1' }))
    prisma.tag.findFirst.mockResolvedValueOnce(null)
    prisma.tag.update.mockResolvedValue(tag('c', 'bug'))
    expect((await inject('POST', '/admin/tags/c/promote')).statusCode).toBe(200)
    expect(prisma.tag.update.mock.calls[0][0].data).toEqual({ communityId: null, spaceId: null })

    prisma.tag.findFirst.mockResolvedValueOnce({ id: 'g' })
    expect((await inject('POST', '/admin/tags/c/promote')).statusCode).toBe(409)
  })

  it('doublons : regroupés sans casse, communautés des éléments par tag', async () => {
    expect(duplicateKey('  Bug ')).toBe('bug')
    prisma.tag.findMany.mockResolvedValue([tag('a', 'Bug', { communityId: 'com-1' }), tag('b', 'bug', { communityId: 'com-2' }), tag('c', 'seul')])
    prisma.itemTag.findMany.mockResolvedValue([
      { tagId: 'a', item: { space: { communityId: 'com-1' } } },
      { tagId: 'b', item: { space: { communityId: 'com-2' } } },
    ])
    const body = (await inject('GET', '/admin/tags/duplicates')).json()
    expect(body).toHaveLength(1)
    expect(body[0].key).toBe('bug')
    expect(body[0].tags.map((t: any) => t.communityIds)).toEqual([['com-1'], ['com-2']])
  })

  it('fusion vers un tag global : liens reportés sans double, sources supprimées, journalisé', async () => {
    prisma.tag.findMany.mockResolvedValue([tag('g', 'bug'), tag('a', 'bug', { communityId: 'com-1' }), tag('b', 'Bug', { communityId: 'com-2' })])
    prisma.itemTag.findMany.mockResolvedValue([{ itemId: 'i1' }, { itemId: 'i2' }, { itemId: 'i1' }])
    prisma.tag.findUnique.mockResolvedValue(tag('g', 'bug', {}, 2))

    const res = await inject('POST', '/admin/tags/merge', { targetId: 'g', sourceIds: ['a', 'b', 'g'] })

    expect(res.statusCode).toBe(200)
    expect(prisma.itemTag.count).not.toHaveBeenCalled()
    expect(prisma.itemTag.createMany).toHaveBeenCalledWith({
      data: [{ itemId: 'i1', tagId: 'g' }, { itemId: 'i2', tagId: 'g' }], skipDuplicates: true,
    })
    expect(prisma.tag.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } } })
    expect(createAuditLog).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'MERGE', entity: 'Tag', entityId: 'g' }))
    expect(res.json()).toMatchObject({ itemCount: 2, removed: 2 })
  })

  it('fusion vers un tag de communauté : refusée si des éléments sont hors de cette communauté', async () => {
    prisma.tag.findMany.mockResolvedValue([tag('a', 'bug', { communityId: 'com-1' }), tag('b', 'bug', { communityId: 'com-2' })])
    prisma.itemTag.count.mockResolvedValue(3)

    const res = await inject('POST', '/admin/tags/merge', { targetId: 'a', sourceIds: ['b'] })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemTag.count.mock.calls[0][0].where.item).toEqual({
      space: { OR: [{ communityId: null }, { communityId: { not: 'com-1' } }] },
    })
    expect(prisma.tag.deleteMany).not.toHaveBeenCalled()
  })

  it('fusion : tag inconnu → 404 ; aucune source → 400', async () => {
    prisma.tag.findMany.mockResolvedValue([tag('g', 'bug')])
    expect((await inject('POST', '/admin/tags/merge', { targetId: 'g', sourceIds: ['zz'] })).statusCode).toBe(404)
    expect((await inject('POST', '/admin/tags/merge', { targetId: 'g', sourceIds: ['g'] })).statusCode).toBe(400)
  })
})
