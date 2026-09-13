/* TNR de computeCascadeDependents : parcours transitif du graphe de relations 'drives'
 * ("Entraîne") pour construire l'aperçu de la modale de confirmation de cascade. */
import { describe, it, expect } from 'vitest'
import { computeCascadeDependents } from './cascadeShift'
import type { ItemWithRelations } from '@spok/shared'

function mockItem(overrides: Partial<ItemWithRelations> & { id: string }): ItemWithRelations {
  return {
    title: `Item ${overrides.id}`, type: 'TASK', parentId: null, spaceId: 's1',
    dueDate: null, startDate: null, endDate: null, relationsFrom: [],
    ...overrides,
  } as Item
}

describe('computeCascadeDependents', () => {
  it('retourne vide si deltaDays est 0', () => {
    const items = [mockItem({ id: 'A' })]
    expect(computeCascadeDependents('A', 0, items)).toEqual([])
  })

  it('retourne vide si aucune relation drives sortante', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'blocks' }] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any }),
    ]
    expect(computeCascadeDependents('A', 5, items)).toEqual([])
  })

  it('trouve un dépendant direct et calcule avant/après', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' }] }),
      mockItem({ id: 'B', title: 'Préparer ODJ', dueDate: '2026-01-13T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('B')
    expect(result[0].title).toBe('Préparer ODJ')
  })

  it('parcourt une chaîne transitive A drives B drives C', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' }] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any, relationsFrom: [{ id: 'r2', fromItemId: 'B', toItemId: 'C', type: 'drives' }] }),
      mockItem({ id: 'C', dueDate: '2026-01-17T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.map(d => d.id).sort()).toEqual(['B', 'C'])
  })

  it('un diamant (A->B->D, A->C->D) ne liste D qu\'une seule fois', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [
        { id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' },
        { id: 'r2', fromItemId: 'A', toItemId: 'C', type: 'drives' },
      ] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any, relationsFrom: [{ id: 'r3', fromItemId: 'B', toItemId: 'D', type: 'drives' }] }),
      mockItem({ id: 'C', dueDate: '2026-01-14T00:00:00.000Z' as any, relationsFrom: [{ id: 'r4', fromItemId: 'C', toItemId: 'D', type: 'drives' }] }),
      mockItem({ id: 'D', dueDate: '2026-01-15T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.filter(d => d.id === 'D')).toHaveLength(1)
  })

  it('un dépendant sans date est absent du résultat mais la chaîne continue au-delà', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'X', type: 'drives' }] }),
      mockItem({ id: 'X', relationsFrom: [{ id: 'r2', fromItemId: 'X', toItemId: 'Y', type: 'drives' }] }), // pas de date
      mockItem({ id: 'Y', dueDate: '2026-01-20T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.map(d => d.id)).toEqual(['Y'])
  })
})
