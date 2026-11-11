/*
 * TNR contenus dans la fusion et l'absorption (lot 5 contenus multiples, 2026-11-11) : contenus de la source / des
 * enfants rattachés à l'élément gardé, doublons retirés, refus 400 au-delà du plafond sans aucune écriture,
 * aperçu /merge-preview identique au calcul appliqué.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ITEM_CONTENTS_MAX } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
  serializeCommunityForAudit: vi.fn((c: any) => ({ id: c?.id })),
}))

const SPACE_ID = 'space-1'
const KEEP = {
  title: 'target', type: 'target', status: 'target', priority: 'target', assignedToId: 'target',
  startDate: 'target', endDate: 'target', dueDate: 'target', description: 'concat',
}
const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id, spaceId: SPACE_ID, parentId: null, lockedAt: null, description: null, createdById: 'test-user-id', assignedToId: null,
  tags: [], relationsFrom: [], relationsTo: [], ...extra,
})
const content = (id: string, itemId: string, kind: string, url: string, position = 0) =>
  ({ id, itemId, kind, url, name: null, size: null, xml: null, position })

describe('Fusion et absorption — contenus', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let contents: any[]
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'test-user-id', spaceId: SPACE_ID, role: 'OWNER' })
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => ['src', 'tgt', 'parent'].includes(where.id) ? item(where.id) : null)
    contents = [
      content('t1', 'tgt', 'IMAGE', 'img-a'),
      content('s1', 'src', 'IMAGE', 'img-b'),
      content('s2', 'src', 'LINK', 'https://Doc.fr/'),
      content('t2', 'tgt', 'LINK', 'https://doc.fr'),
    ]
    prisma.itemContent.findMany.mockImplementation(async ({ where }: any) => contents.filter((x) => where.itemId.in.includes(x.itemId)))
  })

  it('fusion : contenus de la source rattachés à la cible après les siens, doublon retiré', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/src/merge`, headers: auth(), payload: { targetItemId: 'tgt', keep: KEEP },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemContent.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s2'] } } })
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { itemId: 'tgt', position: 1 } })
    expect(prisma.itemContent.updateMany).not.toHaveBeenCalled()
  })

  it('fusion au-delà du plafond : 400, rien n\'est écrit', async () => {
    contents = Array.from({ length: ITEM_CONTENTS_MAX }, (_, i) => content(`t${i}`, 'tgt', 'LINK', `https://t${i}.fr`, i))
      .concat([content('s1', 'src', 'LINK', 'https://new.fr')])
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/src/merge`, headers: auth(), payload: { targetItemId: 'tgt', keep: KEEP },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain(String(ITEM_CONTENTS_MAX))
    expect(prisma.item.update).not.toHaveBeenCalled()
    expect(prisma.item.delete).not.toHaveBeenCalled()
    expect(prisma.itemContent.update).not.toHaveBeenCalled()
  })

  it('aperçu : mêmes chiffres que la fusion', async () => {
    const res = await app.inject({ method: 'GET', url: `/spaces/${SPACE_ID}/items/src/merge-preview?targetItemId=tgt`, headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(res.json().contents).toEqual({ target: 2, source: 2, duplicates: 1, total: 3, max: ITEM_CONTENTS_MAX, tooMany: false })
    expect(prisma.itemContent.update).not.toHaveBeenCalled()
  })

  it('absorption : contenus des enfants rattachés au parent avant leur suppression', async () => {
    prisma.item.findMany.mockResolvedValue([item('c1', { parentId: 'parent' }), item('c2', { parentId: 'parent' })])
    contents = [content('p1', 'parent', 'FILE', 'f1'), content('k1', 'c1', 'FILE', 'f2'), content('k2', 'c2', 'FILE', 'f1')]
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/parent/absorb-children`, headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { itemId: 'parent', position: 1 } })
    expect(prisma.itemContent.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['k2'] } } })
    const updateOrder = prisma.itemContent.update.mock.invocationCallOrder[0]
    const deleteOrder = prisma.item.delete.mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(deleteOrder)
  })
})
