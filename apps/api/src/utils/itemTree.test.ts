/* TNR de createItemTree : création récursive d'items depuis une structure { title, type, children }. */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { createItemTree } from './itemTree.js'

describe('createItemTree', () => {
  it('creates a flat list of root items with incrementing position', async () => {
    const prisma = createMockPrisma()
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    const created = await createItemTree(
      prisma as any,
      [
        { title: 'A', type: 'TASK', children: [] },
        { title: 'B', type: 'TASK', children: [] },
      ],
      { spaceId: 'space-1', createdById: 'user-1', parentId: null }
    )

    expect(created).toHaveLength(2)
    expect(prisma.item.create).toHaveBeenCalledTimes(2)
    expect(prisma.item.create).toHaveBeenNthCalledWith(1, {
      data: { title: 'A', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: null, position: 0 },
    })
    expect(prisma.item.create).toHaveBeenNthCalledWith(2, {
      data: { title: 'B', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: null, position: 1 },
    })
  })

  it('creates nested children under their parent id', async () => {
    const prisma = createMockPrisma()
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    await createItemTree(
      prisma as any,
      [
        { title: 'Réunion', type: 'MEETING', children: [
          { title: 'Rédiger l\'ODJ', type: 'TASK', children: [] },
        ] },
      ],
      { spaceId: 'space-1', createdById: 'user-1', parentId: null }
    )

    expect(prisma.item.create).toHaveBeenCalledTimes(2)
    // Le 2e appel (l'enfant) doit avoir parentId = l'id retourné par le 1er appel ("item-1")
    expect(prisma.item.create).toHaveBeenNthCalledWith(2, {
      data: { title: 'Rédiger l\'ODJ', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: 'item-1', position: 0 },
    })
  })
})
