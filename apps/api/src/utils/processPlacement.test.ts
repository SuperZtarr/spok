/*
 * Tests de utils/processPlacement.ts : la place des éléments dans la vue Process (positions, couloirs) suit leur
 * changement d'espace — couloir et éléments ensemble, élément seul (devient libre), élément resté sur place dont le
 * couloir part (devient libre), place déjà présente à l'arrivée remplacée.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'
import { moveProcessPlacement } from './processPlacement.js'

let db: MockPrisma

beforeEach(() => {
  db = createMockPrisma()
  db.processNode.updateMany.mockResolvedValue({ count: 0 })
  db.processNode.deleteMany.mockResolvedValue({ count: 0 })
  db.processLane.updateMany.mockResolvedValue({ count: 0 })
  db.processLane.deleteMany.mockResolvedValue({ count: 0 })
})

describe('moveProcessPlacement', () => {
  it('couloir et éléments déplacés ensemble : les deux passent dans l\'espace d\'arrivée', async () => {
    db.processLane.findMany.mockResolvedValue([{ id: 'lane-1' }])
    await moveProcessPlacement(db as any, ['lane-item', 'a', 'b'], 'old', 'new')

    expect(db.processLane.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['lane-1'] } }, data: { spaceId: 'new' } })
    expect(db.processNode.updateMany).toHaveBeenCalledWith({
      where: { spaceId: 'old', itemId: { in: ['lane-item', 'a', 'b'] } },
      data: { spaceId: 'new' },
    })
    // Les éléments qui partent avec leur couloir le gardent
    expect(db.processNode.updateMany).toHaveBeenCalledWith({
      where: { spaceId: 'old', itemId: { in: ['lane-item', 'a', 'b'] }, laneId: { not: null, notIn: ['lane-1'] } },
      data: { laneId: null },
    })
  })

  it('élément déplacé sans son couloir : libre à l\'arrivée', async () => {
    await moveProcessPlacement(db as any, ['a'], 'old', 'new')
    expect(db.processNode.updateMany).toHaveBeenCalledWith({
      where: { spaceId: 'old', itemId: { in: ['a'] }, laneId: { not: null, notIn: [] } },
      data: { laneId: null },
    })
    expect(db.processLane.updateMany).not.toHaveBeenCalled()
  })

  it('élément resté sur place dont le couloir part : libre', async () => {
    db.processLane.findMany.mockResolvedValue([{ id: 'lane-1' }])
    await moveProcessPlacement(db as any, ['lane-item'], 'old', 'new')
    expect(db.processNode.updateMany).toHaveBeenCalledWith({
      where: { spaceId: 'old', laneId: { in: ['lane-1'] }, itemId: { notIn: ['lane-item'] } },
      data: { laneId: null },
    })
  })

  it('place déjà présente à l\'arrivée : supprimée AVANT le transfert (unicité espace + élément)', async () => {
    db.processLane.findMany.mockResolvedValue([{ id: 'lane-1' }])
    await moveProcessPlacement(db as any, ['lane-item', 'a'], 'old', 'new')
    const where = { spaceId: 'new', itemId: { in: ['lane-item', 'a'] } }
    expect(db.processNode.deleteMany).toHaveBeenCalledWith({ where })
    expect(db.processLane.deleteMany).toHaveBeenCalledWith({ where })
    const lastDelete = Math.max(...db.processNode.deleteMany.mock.invocationCallOrder, ...db.processLane.deleteMany.mock.invocationCallOrder)
    expect(lastDelete).toBeLessThan(db.processLane.updateMany.mock.invocationCallOrder[0])
  })

  it('rien à faire sans élément ou vers le même espace', async () => {
    await moveProcessPlacement(db as any, [], 'old', 'new')
    await moveProcessPlacement(db as any, ['a'], 'old', 'old')
    expect(db.processLane.findMany).not.toHaveBeenCalled()
  })
})
