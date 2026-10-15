/*
 * TNR droits de fusion et d'absorption (revue sécu 2026-10-15) : un MEMBER ne fusionne / n'absorbe que des
 * items qu'il a créés ou qui lui sont assignés (canMemberManageItem) — sinon la fusion réécrit l'item d'un autre
 * et, en gardant l'assignation de la source, lui transfère des droits sur la cible. Un OWNER n'est pas limité.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
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
const USER_ID = 'test-user-id'
const KEEP = {
  title: 'source', type: 'source', status: 'source', priority: 'source', assignedToId: 'source',
  startDate: 'source', endDate: 'source', dueDate: 'source', url: 'source', description: 'concat',
}
// mine = créé par moi, assigned = créé par un autre mais assigné à moi, foreign = ni l'un ni l'autre
const ITEMS: Record<string, { createdById: string; assignedToId: string | null }> = {
  mine: { createdById: USER_ID, assignedToId: null },
  assigned: { createdById: 'other', assignedToId: USER_ID },
  foreign: { createdById: 'other', assignedToId: 'someone-else' },
}
const item = (id: string, kind = id, extra: Record<string, unknown> = {}) => ({
  id, spaceId: SPACE_ID, parentId: null, lockedAt: null, description: null, tags: [], relationsFrom: [], relationsTo: [],
  ...ITEMS[kind], ...extra,
})

describe('Fusion et absorption — droits du MEMBER', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const asRole = (role: string) =>
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm1', userId: USER_ID, spaceId: SPACE_ID, role })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    asRole('MEMBER')
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => ITEMS[where.id] ? item(where.id) : null)
  })

  const merge = (source: string, target: string) => app.inject({
    method: 'POST', url: `/spaces/${SPACE_ID}/items/${source}/merge`, headers: auth(), payload: { targetItemId: target, keep: KEEP },
  })

  it('fusion d\'un item étranger dans le mien → 403, rien n\'est écrit', async () => {
    const res = await merge('foreign', 'mine')
    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
    expect(prisma.item.delete).not.toHaveBeenCalled()
  })

  it('fusion de mon item assigné dans un item étranger (transfert d\'assignation) → 403', async () => {
    const res = await merge('assigned', 'foreign')
    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('fusion entre un item créé et un item assigné → autorisée', async () => {
    const res = await merge('assigned', 'mine')
    expect(res.statusCode).not.toBe(403)
  })

  it('OWNER : fusion d\'items étrangers autorisée', async () => {
    asRole('OWNER')
    const res = await merge('foreign', 'mine')
    expect(res.statusCode).not.toBe(403)
  })

  it('absorption : refusée si le parent ou un enfant n\'est ni à moi ni assigné à moi', async () => {
    prisma.item.findMany.mockResolvedValue([item('c1', 'mine', { parentId: 'mine' }), item('c2', 'foreign', { parentId: 'mine' })])
    const childForeign = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/mine/absorb-children`, headers: auth() })
    expect(childForeign.statusCode).toBe(403)

    prisma.item.findMany.mockResolvedValue([item('c1', 'mine', { parentId: 'foreign' })])
    const parentForeign = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/foreign/absorb-children`, headers: auth() })
    expect(parentForeign.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
    expect(prisma.item.delete).not.toHaveBeenCalled()
    expect(prisma.item.deleteMany).not.toHaveBeenCalled()
  })

  it('absorption : autorisée si parent et enfants sont à moi ou assignés à moi', async () => {
    prisma.item.findMany.mockResolvedValue([item('c1', 'assigned', { parentId: 'mine' })])
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/mine/absorb-children`, headers: auth() })
    expect(res.statusCode).not.toBe(403)
  })
})
