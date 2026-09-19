/* TNR du parcours BFS des descendants (parentId) — sert à revalider côté serveur les enfants
 * confirmés dans la cascade de déplacement (item-cascade-shift.ts), en complément des relations
 * 'drives'. */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { getDescendantIds } from './itemDescendants.js'

describe('getDescendantIds', () => {
  it('retourne un ensemble vide si aucun enfant', async () => {
    const prisma = createMockPrisma()
    prisma.item.findMany.mockResolvedValueOnce([])

    const result = await getDescendantIds(prisma as any, 'A')
    expect(result).toEqual(new Set())
  })

  it('trouve un enfant direct', async () => {
    const prisma = createMockPrisma()
    prisma.item.findMany
      .mockResolvedValueOnce([{ id: 'B' }])
      .mockResolvedValueOnce([])

    const result = await getDescendantIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B']))
  })

  it('parcourt petits-enfants (A->B->C)', async () => {
    const prisma = createMockPrisma()
    prisma.item.findMany
      .mockResolvedValueOnce([{ id: 'B' }])
      .mockResolvedValueOnce([{ id: 'C' }])
      .mockResolvedValueOnce([])

    const result = await getDescendantIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B', 'C']))
  })

  it('filtre par parentId via le where de la requete', async () => {
    const prisma = createMockPrisma()
    prisma.item.findMany.mockResolvedValueOnce([])

    await getDescendantIds(prisma as any, 'A')
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { parentId: { in: ['A'] } },
      select: { id: true },
    })
  })
})
