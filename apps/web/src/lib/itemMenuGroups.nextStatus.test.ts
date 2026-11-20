/* TNR statut suivant (2026-11-20) : nextStatusForType (@spok/shared, parcours ordre + avancement par famille de statuts)
 * et bouton « Passer à … » du menu contextuel (même onUpdateStatus que le sous-menu, absent sur un statut final). */
import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_STATUSES, nextStatusForType } from '@spok/shared'
import { buildItemMenuGroups } from './itemMenuGroups'

vi.mock('../stores/theme', () => ({
  useThemeStore: { getState: () => ({ initTheme: vi.fn() }) },
}))

const next = (type: string | null, current: string | null) => nextStatusForType(DEFAULT_STATUSES, type, current)?.id ?? null

describe('nextStatusForType', () => {
  it('statuts ordinaires : À faire → Planifié → En cours → À valider → Terminé → rien', () => {
    expect(next('TASK', 'todo')).toBe('scheduled')
    expect(next('TASK', 'scheduled')).toBe('in_progress')
    expect(next('TASK', 'in_progress')).toBe('to_validate')
    expect(next('TASK', 'to_validate')).toBe('done')
    expect(next('TASK', 'done')).toBeNull()
  })
  it('hors parcours : Non défini → À faire, En retard → À valider, Annulé → rien', () => {
    expect(next('TASK', null)).toBe('todo')
    expect(next('TASK', 'undefined')).toBe('todo')
    expect(next('TASK', 'late')).toBe('to_validate')
    expect(next('TASK', 'cancelled')).toBeNull()
  })
  it('réunion : parcours jusqu\'à CR envoyé, Reportée → Réalisée', () => {
    expect(next('MEETING', 'meeting_to_organize')).toBe('meeting_planned')
    expect(next('MEETING', 'meeting_agenda_sent')).toBe('meeting_held')
    expect(next('MEETING', 'meeting_held')).toBe('meeting_minutes_sent')
    expect(next('MEETING', 'meeting_minutes_sent')).toBeNull()
    expect(next('MEETING', 'meeting_postponed')).toBe('meeting_held')
  })
  it('article et question', () => {
    expect(next('ARTICLE', 'article_draft')).toBe('article_to_validate')
    expect(next('ARTICLE', 'article_published')).toBeNull()
    expect(next('QUESTION', 'question_open')).toBe('question_decided')
    expect(next('QUESTION', 'question_postponed')).toBe('question_decided')
    expect(next('QUESTION', 'question_decided')).toBeNull()
  })
  it('suit l\'ordre personnalisé d\'une communauté et ignore les statuts masqués', () => {
    const custom = DEFAULT_STATUSES.map((s) => (s.id === 'scheduled' ? { ...s, visible: false } : s))
    expect(nextStatusForType(custom, 'TASK', 'todo')?.id).toBe('in_progress')
  })
})

describe('menu contextuel — bouton statut suivant', () => {
  const statusAction = (current: string) => {
    const calls: Array<[string, string]> = []
    const groups = buildItemMenuGroups('item-1', { onUpdateStatus: (id, s) => { calls.push([id, s]) } }, {
      statusOptions: DEFAULT_STATUSES, currentStatusId: current, item: { type: 'TASK' }, canEdit: true,
    })
    return { action: groups.flatMap((g) => g.actions).find((a) => a.id === 'status')!, calls }
  }

  it('« Passer à En cours » change le statut par onUpdateStatus et garde le sous-menu', () => {
    const { action, calls } = statusAction('scheduled')
    expect(action.label).toBe('Passer à En cours')
    expect(action.splitSubmenu).toBe(true)
    expect(action.submenu?.length).toBeGreaterThan(0)
    action.onClick()
    expect(calls).toEqual([['item-1', 'in_progress']])
  })

  it('statut final : « Modifier le statut », sous-menu seul', () => {
    const { action } = statusAction('done')
    expect(action.label).toBe('Modifier le statut')
    expect(action.splitSubmenu).toBeUndefined()
    expect(action.submenu?.length).toBeGreaterThan(0)
  })
})
