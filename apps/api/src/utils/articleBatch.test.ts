/* Tests de l'ordre d'insertion groupée dans un article (articleBatch.ts) : grappe (descendance, chaîne) et processus. */
import { describe, it, expect } from 'vitest'
import { orderDescendants, orderChain, orderCluster, orderProcess } from './articleBatch.js'

const d = (s: string) => new Date(s)

describe('orderDescendants', () => {
  it('profondeur d’abord, frères par position puis createdAt', () => {
    const items = [
      { id: 'A', parentId: null, position: 0, createdAt: d('2026-01-01') },
      { id: 'C', parentId: 'A', position: 1, createdAt: d('2026-01-01') },
      { id: 'B', parentId: 'A', position: 0, createdAt: d('2026-01-02') },
      { id: 'D', parentId: 'B', position: 0, createdAt: d('2026-01-01') },
      { id: 'E', parentId: 'A', position: 1, createdAt: d('2025-12-31') },
    ]
    expect(orderDescendants('A', items)).toEqual(['A', 'B', 'D', 'E', 'C'])
  })
})

describe('orderChain', () => {
  it('relations sortantes blocks / implements / drives, largeur d’abord, sans boucle, sans relates', () => {
    const rels = [
      { fromItemId: 'A', toItemId: 'B', type: 'drives' },
      { fromItemId: 'B', toItemId: 'C', type: 'blocks' },
      { fromItemId: 'A', toItemId: 'D', type: 'relates' },
      { fromItemId: 'C', toItemId: 'A', type: 'implements' },
      { fromItemId: 'X', toItemId: 'A', type: 'drives' },
    ]
    expect(orderChain('A', rels)).toEqual(['B', 'C'])
  })
})

describe('orderCluster', () => {
  it('racine, descendants, puis chaîne sans doublon', () => {
    expect(orderCluster('A', ['A', 'B'], ['B', 'X'])).toEqual(['A', 'B', 'X'])
    expect(orderCluster('A', null, null)).toEqual(['A'])
  })
})

describe('orderProcess', () => {
  const lanes = [{ id: 'L2', itemId: 'l2', position: 1 }, { id: 'L1', itemId: 'l1', position: 0 }]
  const nodes = [
    { itemId: 'n1', laneId: 'L1', x: 50, y: 0 },
    { itemId: 'n2', laneId: 'L1', x: 10, y: 0 },
    { itemId: 'n3', laneId: 'L2', x: 0, y: 0 },
    { itemId: 'f1', laneId: null, x: 5, y: 0 },
    { itemId: 'l1', laneId: null, x: 0, y: 0 },
  ]
  it('couloirs par position, éléments par x puis y, libres à la fin', () => {
    expect(orderProcess(lanes, nodes)).toEqual(['l1', 'n2', 'n1', 'l2', 'n3', 'f1'])
  })
  it('un seul couloir', () => {
    expect(orderProcess(lanes, nodes, 'L2')).toEqual(['l2', 'n3'])
  })
})
