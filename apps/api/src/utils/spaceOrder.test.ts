/*
 * Tests de utils/spaceOrder.ts : tri position puis nom, fusion d'ordre (frères non cités gardés à la fin),
 * position suivante, réécriture des positions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'
import { compareSpaceOrder, mergeOrder, nextSiblingPosition, reorderSiblings, siblingsWhere } from './spaceOrder.js'

let db: MockPrisma
beforeEach(() => { db = createMockPrisma() })

describe('compareSpaceOrder', () => {
  it('trie par position puis par nom', () => {
    const list = [{ name: 'B', position: 0 }, { name: 'Z', position: -1 }, { name: 'A', position: 0 }, { name: 'C', position: 2 }]
    expect(list.sort(compareSpaceOrder).map((s) => s.name)).toEqual(['Z', 'A', 'B', 'C'])
  })
})

describe('mergeOrder', () => {
  it('ids demandés d\'abord, frères non cités ensuite, ids inconnus et doublons ignorés', () => {
    expect(mergeOrder(['a', 'b', 'c', 'd'], ['c', 'x', 'a', 'c'])).toEqual(['c', 'a', 'b', 'd'])
  })
})

describe('siblingsWhere', () => {
  it('sous un parent : ses enfants ; à la racine : espaces de groupe de la communauté sans parent', () => {
    expect(siblingsWhere('p', 'c1')).toEqual({ parentId: 'p' })
    expect(siblingsWhere(null, 'c1')).toEqual({ parentId: null, communityId: 'c1', type: 'GROUP' })
  })
})

describe('nextSiblingPosition', () => {
  it('max + 1, ou 0 sans frère', async () => {
    db.space.aggregate.mockResolvedValueOnce({ _max: { position: 4 } }).mockResolvedValueOnce({ _max: { position: null } })
    expect(await nextSiblingPosition(db as any, 'p', 'c1')).toBe(5)
    expect(await nextSiblingPosition(db as any, null, 'c1', 'moi')).toBe(0)
    expect(db.space.aggregate.mock.calls[1][0].where).toEqual({ parentId: null, communityId: 'c1', type: 'GROUP', id: { not: 'moi' } })
  })
})

describe('reorderSiblings', () => {
  it('réécrit 0..n-1 sur tous les frères', async () => {
    db.space.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(await reorderSiblings(db as any, 'p', 'c1', ['c', 'a'])).toEqual(['c', 'a', 'b'])
    expect(db.space.update.mock.calls.map((c: any[]) => [c[0].where.id, c[0].data.position])).toEqual([['c', 0], ['a', 1], ['b', 2]])
  })
})
