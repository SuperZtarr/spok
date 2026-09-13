/* TNR du parcours BFS des relations 'drives' — sert à la fois la détection de cycle
 * (item-relations.ts) et la revalidation des dépendants confirmés (item-cascade-shift.ts). */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { getDrivesReachableIds } from './drivesGraph.js'

describe('getDrivesReachableIds', () => {
  it('retourne un ensemble vide si aucune relation drives sortante', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany.mockResolvedValueOnce([])

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set())
  })

  it('trouve un dependant direct', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }])
      .mockResolvedValueOnce([])

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B']))
  })

  it('parcourt une chaine transitive A->B->C', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'C' }]) // frontier [B]
      .mockResolvedValueOnce([])                   // frontier [C]

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B', 'C']))
  })

  it('ne boucle pas indefiniment si le graphe contient deja un cycle', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'A' }]) // frontier [B] — pointe deja vers A (deja visite/start, ignore)

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B']))
  })

  it('filtre par type drives via le where de la requete', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany.mockResolvedValueOnce([])

    await getDrivesReachableIds(prisma as any, 'A')
    expect(prisma.itemRelation.findMany).toHaveBeenCalledWith({
      where: { type: 'drives', fromItemId: { in: ['A'] } },
      select: { toItemId: true },
    })
  })
})
