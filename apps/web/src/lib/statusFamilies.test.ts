/* Tests des familles de statuts (@spok/shared : statusFamilies, typeInStatusFamily, statusesForFamily) qui pilotent le
 * Kanban par famille (KanbanView, 2026-11-19) : « general » pour les types aux statuts ordinaires, une famille par
 * type à statuts réservés présent (Question). */
import { describe, it, expect } from 'vitest'
import { DEFAULT_STATUSES, GENERAL_STATUS_FAMILY, statusFamilies, statusesForFamily, typeInStatusFamily } from '@spok/shared'

describe('familles de statuts', () => {
  it('une seule famille sans question ; deux quand une question est présente', () => {
    expect(statusFamilies(DEFAULT_STATUSES, [{ type: 'TASK' }]).map((f) => f.key)).toEqual([GENERAL_STATUS_FAMILY])
    expect(statusFamilies(DEFAULT_STATUSES, [{ type: 'TASK' }, { type: 'QUESTION' }]).map((f) => f.key)).toEqual([GENERAL_STATUS_FAMILY, 'QUESTION'])
    expect(statusFamilies(DEFAULT_STATUSES, [{ type: 'QUESTION' }]).map((f) => f.key)).toEqual(['QUESTION'])
  })

  it('réunions et articles forment chacun leur famille (2026-11-19)', () => {
    const fams = statusFamilies(DEFAULT_STATUSES, [{ type: 'TASK' }, { type: 'MEETING' }, { type: 'ARTICLE' }])
    expect(fams.map((f) => f.key)).toEqual([GENERAL_STATUS_FAMILY, 'MEETING', 'ARTICLE'])
    expect(statusesForFamily(DEFAULT_STATUSES, fams[1]).map((s) => s.label)).toEqual(['À organiser', 'Planifiée', 'ODJ envoyé', 'Réalisée', 'CR envoyé', 'Reportée', 'Annulée'])
    expect(typeInStatusFamily(DEFAULT_STATUSES, fams[0], 'MEETING')).toBe(false)
  })

  it('une période est dans la famille des statuts ordinaires (2026-11-25)', () => {
    // Période (2026-11-25) : statuts ordinaires, dans la famille « Éléments »
    expect(statusFamilies(DEFAULT_STATUSES, [{ type: 'PERIOD' }]).map((f) => f.key)).toEqual([GENERAL_STATUS_FAMILY])
    const [general] = statusFamilies(DEFAULT_STATUSES, [{ type: 'TASK' }, { type: 'PERIOD' }])
    expect(typeInStatusFamily(DEFAULT_STATUSES, general, 'PERIOD')).toBe(true)
  })

  it('appartenance et colonnes de chaque famille', () => {
    const [general, question] = statusFamilies(DEFAULT_STATUSES, [{ type: 'TASK' }, { type: 'QUESTION' }])
    expect(typeInStatusFamily(DEFAULT_STATUSES, general, 'TASK')).toBe(true)
    expect(typeInStatusFamily(DEFAULT_STATUSES, general, 'QUESTION')).toBe(false)
    expect(typeInStatusFamily(DEFAULT_STATUSES, question, 'QUESTION')).toBe(true)
    expect(statusesForFamily(DEFAULT_STATUSES, question).every((s) => s.id.startsWith('question_'))).toBe(true)
    expect(statusesForFamily(DEFAULT_STATUSES, general).some((s) => s.id.startsWith('question_'))).toBe(false)
  })
})
