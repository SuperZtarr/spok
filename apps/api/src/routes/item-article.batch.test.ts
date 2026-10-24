/*
 * TNR de l'ajout groupé dans un article (2026-10-24) : aperçu et insertion d'une grappe ou d'un processus, liste des
 * espaces et éléments à parcourir (sélecteur). Mêmes simulacres que item-article.test.ts (droits pilotés par articleAccess).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

const access = vi.hoisted(() => ({
  checkSpaceAccess: vi.fn(),
  allReadableSpaceIds: vi.fn(),
  filterReadableSpaceIds: vi.fn(),
  getEffectiveVisibilities: vi.fn(),
}))
vi.mock('../utils/articleAccess.js', () => access)
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const ARTICLE = { id: 'art', type: 'ARTICLE', spaceId: SPACE, createdById: USER, assignedToId: null, lockedAt: null }
const refItem = (id: string, spaceId: string) => ({
  id, type: 'NOTE', title: id, description: null, url: null, spaceId, createdById: 'other', assignedToId: null, lockedAt: null,
})
const vis = (entries: Record<string, [string, string, string]>) =>
  new Map(Object.entries(entries).map(([id, [visibility, communityId, communityVisibility]]) => [id, { visibility, communityId, communityVisibility }]))

type Known = { type: string; spaceId: string; parentId?: string; position?: number }

describe('Article — ajout groupé', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let readable: string[] = []
  let known: Record<string, Known> = {}
  let present: string[] = []
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const post = (path: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: `/spaces/${SPACE}/items/art/article${path}`, headers: auth(), payload })
  const getSpaces = () => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/art/article/browse/spaces`, headers: auth() })
  const getItems = (spaceId: string) => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/art/article/browse/items?spaceId=${spaceId}`, headers: auth() })
  const children = (ids: string[], parentId: string, spaceId = SPACE) =>
    ids.forEach((id, i) => { known[id] = { type: 'NOTE', spaceId, parentId, position: i } })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    readable = [SPACE, 's2']
    known = {}
    present = []
    access.checkSpaceAccess.mockReset().mockResolvedValue({ role: 'OWNER' })
    access.filterReadableSpaceIds.mockReset().mockImplementation(async (_p: unknown, _u: string | undefined, ids: string[]) =>
      ids.filter((id) => readable.includes(id)))
    access.getEffectiveVisibilities.mockReset().mockResolvedValue(vis({ [SPACE]: ['OPEN', 'c1', 'OPEN'], s2: ['OPEN', 'c1', 'OPEN'], priv: ['PRIVATE', 'c1', 'OPEN'] }))
    access.allReadableSpaceIds.mockReset().mockImplementation(async () => readable)
    prisma.item.findFirst.mockResolvedValue(ARTICLE)
    prisma.item.findUnique.mockImplementation(async ({ where }: any) => (known[where.id] ? { id: where.id, ...known[where.id] } : null))
    prisma.item.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in) {
        return Object.entries(known).filter(([, v]) => v.parentId && where.parentId.in.includes(v.parentId))
          .map(([id, v]) => ({ id, parentId: v.parentId, position: v.position ?? 0, createdAt: new Date('2026-01-01') }))
      }
      if (where?.id?.in) return where.id.in.filter((id: string) => known[id]).map((id: string) => ({ id, ...known[id] }))
      return []
    })
    prisma.articleBlock.findMany.mockImplementation(async ({ where, select }: any) => {
      if (select?.itemId) return present.map((itemId) => ({ itemId }))
      return (where?.itemId?.in ?? []).map((itemId: string, i: number) => ({
        id: `b-${itemId}`, position: i, width: 'full', align: 'center', addedById: USER, item: refItem(itemId, known[itemId]?.spaceId ?? SPACE),
      }))
    })
    prisma.articleBlock.count.mockResolvedValue(3)
  })

  it('aperçu d’une grappe avec enfants : compte et motifs de saut', async () => {
    known.root = { type: 'TASK', spaceId: SPACE }
    children(['c1', 'c2', 'c3'], 'root')
    known.art2 = { type: 'ARTICLE', spaceId: SPACE, parentId: 'root', position: 9 }
    known.p1 = { type: 'NOTE', spaceId: 'priv', parentId: 'root', position: 10 }
    present = ['c2']
    const res = await post('/batch/preview', { source: { kind: 'items', itemIds: ['root'], children: true, chain: false } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ count: 3, skipped: { present: 1, unreadable: 1, articles: 1 }, tooMany: false, lessVisible: false })
  })

  it('chaîne de relations sortantes', async () => {
    known.root = { type: 'TASK', spaceId: SPACE }
    known.b = { type: 'TASK', spaceId: SPACE }
    known.c = { type: 'TASK', spaceId: 's2' }
    prisma.itemRelation.findMany.mockImplementation(async ({ where }: any) =>
      [{ fromItemId: 'root', toItemId: 'b', type: 'drives' }, { fromItemId: 'b', toItemId: 'c', type: 'blocks' }]
        .filter((r) => where.fromItemId.in.includes(r.fromItemId)))
    const res = await post('/batch', { source: { kind: 'items', itemIds: ['root'], children: false, chain: true } })
    expect(res.statusCode).toBe(201)
    expect(res.json().blocks.map((b: any) => b.item.id)).toEqual(['root', 'b', 'c'])
  })

  it('plus de 100 éléments : aperçu tooMany, insertion 400 TOO_MANY', async () => {
    known.root = { type: 'NOTE', spaceId: SPACE }
    children(Array.from({ length: 101 }, (_, i) => `k${i}`), 'root')
    const source = { kind: 'items', itemIds: ['root'], children: true, chain: false }
    expect((await post('/batch/preview', { source })).json().tooMany).toBe(true)
    const res = await post('/batch', { source })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('TOO_MANY')
  })

  it('insertion d’un processus dans l’ordre, positions décalées', async () => {
    known.l1 = { type: 'NOTE', spaceId: SPACE }
    known.n1 = { type: 'NOTE', spaceId: SPACE }
    known.n2 = { type: 'NOTE', spaceId: SPACE }
    prisma.processLane.findMany.mockResolvedValue([{ id: 'L1', itemId: 'l1', position: 0 }])
    prisma.processNode.findMany.mockResolvedValue([{ itemId: 'n1', laneId: 'L1', x: 50, y: 0 }, { itemId: 'n2', laneId: 'L1', x: 10, y: 0 }])
    const res = await post('/batch', { source: { kind: 'process', spaceId: SPACE }, position: 1 })
    expect(res.statusCode).toBe(201)
    expect(prisma.articleBlock.updateMany).toHaveBeenCalledWith({ where: { articleId: 'art', position: { gte: 1 } }, data: { position: { increment: 3 } } })
    expect(prisma.articleBlock.createMany).toHaveBeenCalledWith({ data: [
      { articleId: 'art', itemId: 'l1', position: 1, addedById: USER },
      { articleId: 'art', itemId: 'n2', position: 2, addedById: USER },
      { articleId: 'art', itemId: 'n1', position: 3, addedById: USER },
    ] })
    expect(res.json().blocks.map((b: any) => b.item.id)).toEqual(['l1', 'n2', 'n1'])
  })

  it('moins visible : aperçu signalé, insertion à confirmer', async () => {
    readable = [SPACE, 's2', 'priv']
    known.root = { type: 'NOTE', spaceId: 'priv' }
    const source = { kind: 'items', itemIds: ['root'], children: false, chain: false }
    expect((await post('/batch/preview', { source })).json().lessVisible).toBe(true)
    const refused = await post('/batch', { source })
    expect(refused.statusCode).toBe(409)
    expect(refused.json().code).toBe('LESS_VISIBLE')
    expect((await post('/batch', { source, confirmLessVisible: true })).statusCode).toBe(201)
  })

  it('lot vide : aperçu 0, insertion 400 EMPTY', async () => {
    known.root = { type: 'NOTE', spaceId: SPACE }
    present = ['root']
    const source = { kind: 'items', itemIds: ['root'], children: false, chain: false }
    expect((await post('/batch/preview', { source })).json()).toMatchObject({ count: 0, skipped: { present: 1 } })
    const res = await post('/batch', { source })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('EMPTY')
  })

  it('processus illisible → 403 ; couloir d’un autre espace → 404', async () => {
    expect((await post('/batch/preview', { source: { kind: 'process', spaceId: 'priv' } })).statusCode).toBe(403)
    prisma.processLane.findMany.mockResolvedValue([{ id: 'L1', itemId: 'l1', position: 0 }])
    expect((await post('/batch/preview', { source: { kind: 'process', spaceId: SPACE, laneId: 'ailleurs' } })).statusCode).toBe(404)
  })

  it('plusieurs éléments cochés avec enfants : ordre reçu, sans doublon', async () => {
    known.p = { type: 'NOTE', spaceId: SPACE }
    known.c = { type: 'NOTE', spaceId: SPACE, parentId: 'p', position: 0 }
    known.q = { type: 'NOTE', spaceId: SPACE }
    const res = await post('/batch', { source: { kind: 'items', itemIds: ['p', 'c', 'q'], children: true, chain: false } })
    expect(res.statusCode).toBe(201)
    expect(res.json().blocks.map((b: any) => b.item.id)).toEqual(['p', 'c', 'q'])
  })

  it('plus de 100 éléments cochés → 400 (validation)', async () => {
    const itemIds = Array.from({ length: 101 }, (_, i) => `x${i}`)
    expect((await post('/batch/preview', { source: { kind: 'items', itemIds, children: false, chain: false } })).statusCode).toBe(400)
  })

  it('espaces à parcourir : portée, nombre d’éléments, processus éventuel', async () => {
    prisma.space.findUnique.mockResolvedValue({ id: SPACE, communityId: 'c1' })
    prisma.space.findMany.mockImplementation(async ({ where }: any) => where?.communityId
      ? [{ id: SPACE }, { id: 's2' }, { id: 'priv' }]
      : [{ id: SPACE, name: 'Espace 1', parentId: null, community: { name: 'C1' } }, { id: 's2', name: 'Espace 2', parentId: SPACE, community: { name: 'C1' } }])
    prisma.item.groupBy.mockResolvedValue([{ spaceId: SPACE, _count: { _all: 12 } }, { spaceId: 's2', _count: { _all: 3 } }])
    prisma.processNode.groupBy.mockResolvedValue([{ spaceId: SPACE, _count: { _all: 4 } }])
    prisma.processLane.findMany.mockResolvedValue([{ id: 'L1', spaceId: SPACE, item: { title: 'Couloir A' } }])
    const res = await getSpaces()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      { spaceId: SPACE, name: 'Espace 1', parentId: null, communityName: 'C1', itemCount: 12, process: { nodeCount: 4, lanes: [{ id: 'L1', title: 'Couloir A' }] } },
      { spaceId: 's2', name: 'Espace 2', parentId: SPACE, communityName: 'C1', itemCount: 3, process: null },
    ])
    expect(prisma.item.groupBy.mock.calls[0][0].where).toMatchObject({ spaceId: { in: [SPACE, 's2'] }, type: { not: 'ARTICLE' } })
  })

  it('article dans un espace sans communauté : son espace seul', async () => {
    prisma.space.findUnique.mockResolvedValue({ id: SPACE, communityId: null })
    prisma.space.findMany.mockResolvedValue([])
    await getSpaces()
    expect(prisma.item.groupBy.mock.calls[0][0].where.spaceId).toEqual({ in: [SPACE] })
  })

  it('éléments d’un espace : champs, articles exclus, 500 au plus', async () => {
    prisma.space.findMany.mockResolvedValue([{ id: SPACE, community: { referentiels: { statuses: [{ id: 'todo', label: 'À lancer' }] } } }])
    prisma.item.findMany.mockResolvedValue(Array.from({ length: 501 }, (_, i) => ({ id: `i${i}`, type: 'TASK', title: `T${i}`, status: 'todo', parentId: null, position: i })))
    const res = await getItems(SPACE)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.items).toHaveLength(500)
    expect(body.truncated).toBe(true)
    expect(body.items[0]).toEqual({ id: 'i0', type: 'TASK', title: 'T0', status: 'todo', statusLabel: 'À lancer', parentId: null, position: 0 })
    expect(prisma.item.findMany.mock.calls[0][0]).toMatchObject({ where: { spaceId: SPACE, type: { not: 'ARTICLE' } }, take: 501 })
  })

  it('éléments d’un espace illisible → 403', async () => {
    expect((await getItems('priv')).statusCode).toBe(403)
  })

  it('non-éditeur → 403 sur les routes', async () => {
    access.checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
    const source = { kind: 'items', itemIds: ['root'], children: false, chain: false }
    expect((await post('/batch/preview', { source })).statusCode).toBe(403)
    expect((await post('/batch', { source })).statusCode).toBe(403)
    expect((await getSpaces()).statusCode).toBe(403)
    expect((await getItems(SPACE)).statusCode).toBe(403)
  })
})
