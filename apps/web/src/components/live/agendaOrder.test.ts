/* Tests des règles de déplacement de la préparation côté client (miroir de l'API PUT /agenda/order). */
import { describe, it, expect } from 'vitest'
import { moveTarget, swapIds } from './agendaOrder'

const row = (id: string, presenter: string) => ({ id, presenter: { id: presenter, name: presenter } }) as any
const agenda = [row('a', 'other'), row('b', 'me'), row('c', 'other'), row('d', 'me')]

describe('agendaOrder', () => {
  it('animateur : échange avec la voisine directe', () => {
    expect(moveTarget(agenda, 1, -1, 'me', true)).toBe(0)
    expect(moveTarget(agenda, 0, -1, 'me', true)).toBeNull()
  })
  it('présentateur : échange avec sa propre ligne voisine, saute celles des autres', () => {
    expect(moveTarget(agenda, 1, 1, 'me', false)).toBe(3)
    expect(moveTarget(agenda, 3, -1, 'me', false)).toBe(1)
    expect(moveTarget(agenda, 1, -1, 'me', false)).toBeNull()
  })
  it("présentateur : ne déplace pas la ligne d'un autre", () => {
    expect(moveTarget(agenda, 0, 1, 'me', false)).toBeNull()
  })
  it('swapIds échange deux positions', () => {
    expect(swapIds(agenda, 1, 3)).toEqual(['a', 'd', 'c', 'b'])
  })
})
