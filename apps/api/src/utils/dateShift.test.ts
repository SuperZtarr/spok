/* TNR de l'utilitaire de décalage calendaire de dates — extrait de item-bulk.ts pour être réutilisé par la cascade "Entraîne". */
import { describe, it, expect } from 'vitest'
import { shiftDate, shiftItemDates } from './dateShift.js'

describe('shiftDate', () => {
  it('day : ajoute des jours simples', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'day', 5).toISOString()).toBe('2026-01-20T00:00:00.000Z')
  })

  it('week : ajoute des semaines', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'week', 2).toISOString()).toBe('2026-01-29T00:00:00.000Z')
  })

  it('month : calendaire, clampe en fin de mois (31 jan +1 mois -> 28 fev, 2026 non bissextile)', () => {
    expect(shiftDate(new Date('2026-01-31T00:00:00.000Z'), 'month', 1).toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it('year : ajoute des années', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'year', 1).toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })
})

describe('shiftItemDates', () => {
  const item = {
    dueDate: new Date('2026-01-15T00:00:00.000Z'),
    startDate: new Date('2026-01-15T09:00:00.000Z'),
    endDate: new Date('2026-01-15T10:00:00.000Z'),
  }

  it('decale les 3 champs quand unit et amount sont fournis', () => {
    const result = shiftItemDates(item, 'day', 5)
    expect(result.dueDate?.toISOString()).toBe('2026-01-20T00:00:00.000Z')
    expect(result.startDate?.toISOString()).toBe('2026-01-20T09:00:00.000Z')
    expect(result.endDate?.toISOString()).toBe('2026-01-20T10:00:00.000Z')
  })

  it('ne touche a rien si amount vaut 0', () => {
    const result = shiftItemDates(item, 'day', 0)
    expect(result).toEqual(item)
  })

  it('ne touche a rien si unit est undefined', () => {
    const result = shiftItemDates(item, undefined, 5)
    expect(result).toEqual(item)
  })

  it('laisse les champs null inchanges', () => {
    const result = shiftItemDates({ dueDate: null, startDate: null, endDate: null }, 'day', 5)
    expect(result).toEqual({ dueDate: null, startDate: null, endDate: null })
  })
})
