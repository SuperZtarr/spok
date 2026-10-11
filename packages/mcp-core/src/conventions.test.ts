/* TNR des conventions SPOK : résolution de statut (id/libellé) et de tags (id/nom), types masqués, dates, ordre des dates. */
import { describe, it, expect, vi } from 'vitest'
import { fetchConventions, resolveStatus, resolveTags, assertTypeAllowed, assertDateOrder } from './conventions.js'
import { normalizeDate } from './dates.js'
import { ConventionError } from './errors.js'
import type { SpokClient } from './client.js'

const conv = {
  statuses: [{ id: 'todo', label: 'À faire' }, { id: 'in_progress', label: 'En cours' }],
  types: [{ id: 'TASK', label: 'Tâche' }, { id: 'NOTE', label: 'Note' }],
  tags: [],
}

describe('resolveStatus', () => {
  it('accepte un id exact', () => expect(resolveStatus('todo', conv)).toBe('todo'))
  it('mappe un libellé (casse et espaces ignorés)', () => expect(resolveStatus('  en COURS ', conv)).toBe('in_progress'))
  it('refuse un statut inconnu en listant les valeurs', () => {
    expect(() => resolveStatus('wip', conv)).toThrow(ConventionError)
    expect(() => resolveStatus('wip', conv)).toThrow(/todo \(À faire\).*in_progress \(En cours\)/)
  })
})

describe('assertTypeAllowed', () => {
  it('accepte un type visible', () => expect(() => assertTypeAllowed('TASK', conv)).not.toThrow())
  it('refuse un type masqué dans cette communauté', () => expect(() => assertTypeAllowed('BUG', conv)).toThrow(/TASK \(Tâche\)/))
})

describe('normalizeDate', () => {
  it('complète une date sans heure', () => expect(normalizeDate('2026-10-15', 'dueDate')).toBe('2026-10-15T00:00:00.000Z'))
  it('garde un ISO complet', () => expect(normalizeDate('2026-10-15T09:30:00+02:00', 'dueDate')).toBe('2026-10-15T07:30:00.000Z'))
  it('refuse une date illisible', () => expect(() => normalizeDate('15/10/2026', 'dueDate')).toThrow(/dueDate.*AAAA-MM-JJ/))
})

describe('assertDateOrder', () => {
  it('refuse une fin avant le début', () => expect(() => assertDateOrder('2026-10-15T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toThrow(ConventionError))
  it('tolère une seule borne', () => expect(() => assertDateOrder(undefined, '2026-10-01T00:00:00.000Z')).not.toThrow())
})

describe('resolveTags', () => {
  const withTags = { ...conv, tags: [{ id: 't1', name: 'Urgent' }, { id: 't2', name: 'UX' }] }
  it('résout ids et noms (casse ignorée), sans doublon', () => {
    expect(resolveTags(['t1', ' ux ', 'urgent'], withTags)).toEqual(['t1', 't2'])
  })
  it('refuse un tag inconnu en listant les tags existants', () => {
    expect(() => resolveTags(['perf'], withTags)).toThrow(/Urgent \[t1\].*UX \[t2\]/)
  })
  it('liste vide → aucun tag', () => {
    expect(resolveTags([], withTags)).toEqual([])
  })
})

describe('fetchConventions', () => {
  it('ne garde que les statuts et types visibles, triés par ordre', async () => {
    const client: SpokClient = {
      get: vi.fn(async (path: string) => {
        if (path.endsWith('/referentiels')) return { referentiels: {
          statuses: [
            { id: 'done', label: 'Terminé', order: 2, visible: true },
            { id: 'todo', label: 'À faire', order: 1, visible: true },
            { id: 'late', label: 'En retard', order: 3, visible: false },
          ],
          typeLabels: {
            TASK: { label: 'Tâche', order: 1, visible: true },
            BUG: { label: 'Bug', order: 2, visible: false },
          },
        } }
        if (path === '/spaces/s1/tags') return [{ id: 't1', name: 'urgent' }]
        throw new Error(path)
      }),
      post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    }
    const res = await fetchConventions(client, 's1')
    expect(res.statuses.map((s) => s.id)).toEqual(['todo', 'done'])
    expect(res.types).toEqual([{ id: 'TASK', label: 'Tâche' }])
    expect(res.tags).toEqual([{ id: 't1', name: 'urgent' }])
  })
})
