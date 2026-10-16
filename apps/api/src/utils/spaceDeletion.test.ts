/*
 * Tests de utils/spaceDeletion.ts : ordre audit → suppression (FK audit_logs.spaceId), audits d'items
 * groupés, détachement sans deleteChildren, sous-espace de communauté non supprimé deux fois.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'
import { collectDescendantSpaceIds, deleteSpaceTree, deleteCommunityTree, runDeletion, DELETION_TX_OPTIONS } from './spaceDeletion.js'

const ctx = { userId: 'u1', batchId: 'b1' }
const space = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, type: 'GROUP', ...extra })

let db: MockPrisma

beforeEach(() => {
  db = createMockPrisma()
  db.auditLog.create.mockResolvedValue({})
  db.auditLog.createMany.mockResolvedValue({ count: 0 })
})

/** Rang d'appel du premier appel de `fn` satisfaisant `match`. */
function callOrder(fn: any, match: (arg: any) => boolean): number {
  const idx = fn.mock.calls.findIndex((c: any[]) => match(c[0]))
  expect(idx).toBeGreaterThanOrEqual(0)
  return fn.mock.invocationCallOrder[idx]
}

describe('collectDescendantSpaceIds', () => {
  it('parcourt tous les niveaux, parents avant enfants', async () => {
    db.space.findMany
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([{ id: 'a1' }])
      .mockResolvedValueOnce([])
    expect(await collectDescendantSpaceIds(db as any, 'root')).toEqual(['a', 'b', 'a1'])
  })
})

describe('deleteSpaceTree', () => {
  it('deleteChildren : chaque espace est audité AVANT sa suppression, feuilles d\'abord', async () => {
    db.space.findMany.mockResolvedValueOnce([{ id: 'child' }]).mockResolvedValueOnce([{ id: 'grand' }]).mockResolvedValueOnce([])
    db.space.findUnique.mockImplementation(({ where }: any) => Promise.resolve(space(where.id)))

    const ids = await deleteSpaceTree(db as any, space('root'), true, ctx)

    expect(ids).toEqual(['child', 'grand', 'root'])
    expect(db.space.delete.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['grand', 'child', 'root'])
    for (const id of ['grand', 'child', 'root']) {
      expect(callOrder(db.auditLog.create, (a) => a.data.entity === 'Space' && a.data.entityId === id))
        .toBeLessThan(callOrder(db.space.delete, (a) => a.where.id === id))
    }
  })

  it('audite les items en un seul createMany, avant leur suppression', async () => {
    db.item.findMany.mockResolvedValue([{ id: 'i1', spaceId: 'root' }, { id: 'i2', spaceId: 'root' }])

    await deleteSpaceTree(db as any, space('root'), false, ctx)

    expect(db.auditLog.createMany).toHaveBeenCalledTimes(1)
    const rows = db.auditLog.createMany.mock.calls[0][0].data
    expect(rows.map((r: any) => r.entityId)).toEqual(['i1', 'i2'])
    expect(rows[0]).toMatchObject({ action: 'DELETE', entity: 'Item', spaceId: 'root', userId: 'u1', batchId: 'b1' })
    expect(callOrder(db.auditLog.createMany, () => true)).toBeLessThan(callOrder(db.item.deleteMany, () => true))
  })

  it('sans deleteChildren : espace racine → enfants directs à la racine, seuls les items de l\'espace supprimés', async () => {
    await deleteSpaceTree(db as any, space('root', { parentId: null }), false, ctx)

    expect(db.space.updateMany).toHaveBeenCalledWith({ where: { parentId: 'root' }, data: { parentId: null } })
    expect(db.item.findMany).toHaveBeenCalledWith({ where: { spaceId: { in: ['root'] } } })
    expect(db.space.delete.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['root'])
  })

  it('sans deleteChildren : sous-espace → ses enfants directs rattachés à son parent', async () => {
    await deleteSpaceTree(db as any, space('mid', { parentId: 'top' }), false, ctx)

    expect(db.space.updateMany).toHaveBeenCalledWith({ where: { parentId: 'mid' }, data: { parentId: 'top' } })
  })

  it('une erreur en cours est propagée (la transaction appelante annule tout)', async () => {
    db.space.delete.mockRejectedValue(new Error('boom'))
    await expect(deleteSpaceTree(db as any, space('root'), false, ctx)).rejects.toThrow('boom')
  })
})

describe('deleteCommunityTree', () => {
  it('deleteChildren : un sous-espace supprimé avec son parent n\'est pas resupprimé', async () => {
    db.space.findMany.mockImplementation(({ where }: any) => {
      if (where.communityId) return Promise.resolve([space('parent'), space('sub', { parentId: 'parent' })])
      if (where.parentId?.in?.includes('parent')) return Promise.resolve([{ id: 'sub' }])
      return Promise.resolve([])
    })
    db.space.findUnique.mockImplementation(({ where }: any) => Promise.resolve(space(where.id)))

    await deleteCommunityTree(db as any, { id: 'c1', name: 'C' }, true, ctx)

    expect(db.space.delete.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['sub', 'parent'])
    expect(callOrder(db.auditLog.create, (a) => a.data.entity === 'Community'))
      .toBeLessThan(callOrder(db.community.delete, () => true))
  })

  it('sans deleteChildren : espaces détachés de la communauté', async () => {
    await deleteCommunityTree(db as any, { id: 'c1' }, false, ctx)

    expect(db.space.updateMany).toHaveBeenCalledWith({ where: { communityId: 'c1' }, data: { communityId: null } })
    expect(db.space.delete).not.toHaveBeenCalled()
    expect(db.community.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
})

describe('runDeletion', () => {
  it('exécute dans une transaction interactive avec un délai élargi', async () => {
    db.$transaction.mockImplementation((fn: any) => fn(db))
    await runDeletion(db as any, async () => 'ok')
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), DELETION_TX_OPTIONS)
  })
})
