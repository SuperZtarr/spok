/*
 * TNR de l'ajout groupé dans un article (2026-10-24) : aperçu et insertion d'une grappe ou d'un processus, liste des
 * processus proposables. Mêmes simulacres que item-article.test.ts (droits pilotés par articleAccess).
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
  const getProcesses = () => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/art/article/processes`, headers: auth() })
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
    const res = await post('/batch/preview', { source: { kind: 'cluster', itemId: 'root', children: true, chain: false } })
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
    const res = await post('/batch', { source: { kind: 'cluster', itemId: 'root', children: false, chain: true } })
    expect(res.statusCode).toBe(201)
    expect(res.json().blocks.map((b: any) => b.item.id)).toEqual(['root', 'b', 'c'])
  })

  it('plus de 100 éléments : aperçu tooMany, insertion 400 TOO_MANY', async () => {
    known.root = { type: 'NOTE', spaceId: SPACE }
    children(Array.from({ length: 101 }, (_, i) => `k${i}`), 'root')
    const source = { kind: 'cluster', itemId: 'root', children: true, chain: false }
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
    const source = { kind: 'cluster', itemId: 'root', children: false, chain: false }
    expect((await post('/batch/preview', { source })).json().lessVisible).toBe(true)
    const refused = await post('/batch', { source })
    expect(refused.statusCode).toBe(409)
    expect(refused.json().code).toBe('LESS_VISIBLE')
    expect((await post('/batch', { source, confirmLessVisible: true })).statusCode).toBe(201)
  })

  it('lot vide : aperçu 0, insertion 400 EMPTY', async () => {
    known.root = { type: 'NOTE', spaceId: SPACE }
    present = ['root']
    const source = { kind: 'cluster', itemId: 'root', children: false, chain: false }
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

  it('processus proposables : espaces lisibles avec au moins un élément placé', async () => {
    prisma.space.findUnique.mockResolvedValue({ id: SPACE, communityId: 'c1' })
    prisma.space.findMany.mockImplementation(async ({ where }: any) => where?.communityId
      ? [{ id: SPACE }, { id: 's2' }, { id: 'priv' }]
      : [{ id: SPACE, name: 'Espace 1', community: { name: 'C1' } }])
    prisma.processNode.groupBy.mockResolvedValue([{ spaceId: SPACE, _count: { _all: 4 } }])
    prisma.processLane.findMany.mockResolvedValue([{ id: 'L1', spaceId: SPACE, item: { title: 'Couloir A' } }])
    const res = await getProcesses()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([{ spaceId: SPACE, spaceName: 'Espace 1', communityName: 'C1', nodeCount: 4, lanes: [{ id: 'L1', title: 'Couloir A' }] }])
    expect(prisma.processNode.groupBy.mock.calls[0][0].where.spaceId).toEqual({ in: [SPACE, 's2'] })
  })

  it('non-éditeur → 403 sur les trois routes', async () => {
    access.checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
    const source = { kind: 'cluster', itemId: 'root', children: false, chain: false }
    expect((await post('/batch/preview', { source })).statusCode).toBe(403)
    expect((await post('/batch', { source })).statusCode).toBe(403)
    expect((await getProcesses()).statusCode).toBe(403)
  })
})
