/*
 * TNR références externes dans la fusion et l'absorption (règle item-external-refs, 2026-11-13) : références de la
 * source / des enfants ajoutées après celles de l'élément gardé, doublons sans casse retirés, refus 400 au-delà de
 * 20 entrées sans aucune écriture, liste inchangée → aucune réécriture. Calcul pur : planExternalRefsMerge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { EXTERNAL_REFS_MAX } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import { planExternalRefsMerge } from '../utils/externalRefsMerge.js'

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
const ref = (itemId: string, value: string, position = 0) => ({ itemId, value, position })

describe('planExternalRefsMerge', () => {
  it('garde l\'ordre de l\'élément gardé puis ajoute les autres, sans doublon (casse ignorée)', () => {
    const plan = planExternalRefsMerge('t', ['s'], [
      ref('s', 'Sf : 1', 1), ref('t', 'Jira : A', 1), ref('s', 'jira : a', 0), ref('t', 'Gh : 9', 0),
    ])
    expect(plan.values).toEqual(['Gh : 9', 'Jira : A', 'Sf : 1'])
    expect(plan.changed).toBe(true)
    expect(plan.error).toBeNull()
  })

  it('rien de neuf → changed false', () => {
    const plan = planExternalRefsMerge('t', ['s'], [ref('t', 'Jira : A'), ref('s', 'JIRA : a')])
    expect(plan.changed).toBe(false)
  })
})

describe('Fusion et absorption — références externes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let refs: ReturnType<typeof ref>[]
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'test-user-id', spaceId: SPACE_ID, role: 'OWNER' })
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => ['src', 'tgt', 'parent'].includes(where.id) ? item(where.id) : null)
    refs = [ref('tgt', 'Jira : PROJ-12'), ref('src', 'jira : proj-12'), ref('src', 'Sf : 0000575747', 1)]
    prisma.itemExternalRef.findMany.mockImplementation(async ({ where }: any) => refs.filter((r) => where.itemId.in.includes(r.itemId)))
  })

  it('fusion : références de la source ajoutées à la cible, doublon retiré', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/src/merge`, headers: auth(), payload: { targetItemId: 'tgt', keep: KEEP },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemExternalRef.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'tgt' } })
    expect(prisma.itemExternalRef.createMany).toHaveBeenCalledWith({ data: [
      { itemId: 'tgt', value: 'Jira : PROJ-12', position: 0 },
      { itemId: 'tgt', value: 'Sf : 0000575747', position: 1 },
    ] })
  })

  it('fusion sans référence nouvelle : liste de la cible non réécrite', async () => {
    refs = [ref('tgt', 'Jira : PROJ-12'), ref('src', 'JIRA : PROJ-12')]
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/src/merge`, headers: auth(), payload: { targetItemId: 'tgt', keep: KEEP },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemExternalRef.deleteMany).not.toHaveBeenCalled()
    expect(prisma.itemExternalRef.createMany).not.toHaveBeenCalled()
  })

  it(`fusion au-delà de ${EXTERNAL_REFS_MAX} références : 400, rien n'est écrit`, async () => {
    refs = Array.from({ length: EXTERNAL_REFS_MAX }, (_, i) => ref('tgt', `App : ${i}`, i)).concat([ref('src', 'Autre : x')])
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/src/merge`, headers: auth(), payload: { targetItemId: 'tgt', keep: KEEP },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain(String(EXTERNAL_REFS_MAX))
    expect(prisma.item.update).not.toHaveBeenCalled()
    expect(prisma.item.delete).not.toHaveBeenCalled()
    expect(prisma.itemExternalRef.createMany).not.toHaveBeenCalled()
  })

  it('absorption : références des enfants ajoutées au parent avant leur suppression', async () => {
    prisma.item.findMany.mockResolvedValue([item('c1', { parentId: 'parent' }), item('c2', { parentId: 'parent' })])
    refs = [ref('parent', 'Jira : P'), ref('c1', 'Sf : 1'), ref('c2', 'jira : p'), ref('c2', 'Gh : 2', 1)]
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/parent/absorb-children`, headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemExternalRef.createMany).toHaveBeenCalledWith({ data: [
      { itemId: 'parent', value: 'Jira : P', position: 0 },
      { itemId: 'parent', value: 'Sf : 1', position: 1 },
      { itemId: 'parent', value: 'Gh : 2', position: 2 },
    ] })
    const writeOrder = prisma.itemExternalRef.createMany.mock.invocationCallOrder[0]
    const deleteOrder = prisma.item.delete.mock.invocationCallOrder[0]
    expect(writeOrder).toBeLessThan(deleteOrder)
  })
})
