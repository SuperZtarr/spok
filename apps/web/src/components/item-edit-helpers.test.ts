/* TNR des helpers item-edit-helpers : construction/comptage de structure de modèle. */
import { describe, it, expect } from 'vitest'
import { buildItemTemplateStructure, countTemplateNodes } from './item-edit-helpers'
import type { Item } from '@spok/shared'

function mockItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    title: 'Item', type: 'NOTE', parentId: null, spaceId: 's1',
    ...overrides,
  } as Item
}

describe('buildItemTemplateStructure', () => {
  it('builds a single node with no children', () => {
    const items = [mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null })]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure).toEqual({ title: 'Réunion', type: 'MEETING', children: [] })
  })

  it('builds nested children recursively, in position order', () => {
    const items = [
      mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null, position: 0 }),
      mockItem({ id: '2', title: 'Rédiger le CR', type: 'TASK', parentId: '1', position: 1 }),
      mockItem({ id: '3', title: 'Réserver la salle', type: 'TASK', parentId: '1', position: 0 }),
    ]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure.children.map((c) => c.title)).toEqual(['Réserver la salle', 'Rédiger le CR'])
  })

  it('ignores items outside the captured subtree', () => {
    const items = [
      mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null }),
      mockItem({ id: '2', title: 'Autre chose', type: 'NOTE', parentId: null }),
    ]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure.children).toHaveLength(0)
  })
})

describe('countTemplateNodes', () => {
  it('counts the root plus all descendants', () => {
    const node = {
      title: 'Réunion', type: 'MEETING' as const, children: [
        { title: 'A', type: 'TASK' as const, children: [] },
        { title: 'B', type: 'TASK' as const, children: [{ title: 'C', type: 'TASK' as const, children: [] }] },
      ],
    }
    expect(countTemplateNodes(node)).toBe(4)
  })
})
