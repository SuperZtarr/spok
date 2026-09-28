/* TNR des helpers item-edit-helpers : structure de modèle, fusion formulaire/serveur. */
import { describe, it, expect } from 'vitest'
import { buildItemTemplateStructure, countTemplateNodes, mergeFormWithServer, tagKey, buildForumSummary } from './item-edit-helpers'
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

describe('mergeFormWithServer', () => {
  const base = { title: 'A', description: '<p>ancien</p>', status: 'todo', tags: 't1' }
  const next = { title: 'A', description: '<p>ancien</p><h3>Enfant</h3>', status: 'done', tags: 't1,t2' }

  it('premier chargement (pas de base) : tout vient du serveur', () => {
    expect(mergeFormWithServer({ title: '', description: '', status: '', tags: '' }, null, next)).toEqual(next)
  })

  it('formulaire intact : prend la version serveur (bug absorption / statut changé dans une vue)', () => {
    expect(mergeFormWithServer({ ...base }, base, next)).toEqual(next)
  })

  it('champ modifié par l\'utilisateur : sa saisie est conservée, les autres sont resynchronisés', () => {
    const current = { ...base, title: 'A modifié' }
    expect(mergeFormWithServer(current, base, next)).toEqual({ ...next, title: 'A modifié' })
  })

  it('tagKey : ordre indifférent', () => {
    expect(tagKey(['b', 'a'])).toBe(tagKey(['a', 'b']))
  })
})

describe('buildForumSummary', () => {
  const labels = {
    typeLabel: (t: string) => ({ TASK: 'Tâche', MEETING: 'Réunion' } as Record<string, string>)[t],
    statusLabel: (s: string) => ({ in_progress: 'En cours', todo: 'À faire' } as Record<string, string>)[s],
    priorityLabel: (p: number) => ({ 4: 'Urgente', 3: 'Haute' } as Record<number, string>)[p],
    formatDate: (iso: string) => iso.slice(0, 10),
  }

  it('Note vierge : aucun résumé', () => {
    expect(buildForumSummary({ type: 'NOTE' }, labels)).toEqual([])
    expect(buildForumSummary({ type: 'UNDEFINED', status: 'undefined' }, labels)).toEqual([])
  })

  it('item complet : type · statut · priorité · période · échéance · assigné · liens', () => {
    expect(buildForumSummary({
      type: 'TASK', status: 'in_progress', priority: 3,
      startDate: '2026-10-01T10:00:00Z', endDate: '2026-10-05T10:00:00Z', dueDate: '2026-10-03T12:00:00Z',
      assignedTo: { name: 'Alice' }, relationsFrom: [{}], relationsTo: [{}],
    }, labels)).toEqual(['Tâche', 'En cours', 'Haute', '2026-10-01 → 2026-10-05', 'échéance 2026-10-03', 'Alice', '2 liens'])
  })

  it('début et fin le même jour : une seule date', () => {
    expect(buildForumSummary({ type: 'MEETING', startDate: '2026-04-22T08:00:00Z', endDate: '2026-04-22T09:00:00Z' }, labels))
      .toEqual(['Réunion', '2026-04-22'])
  })

  it('début seul, 1 lien', () => {
    expect(buildForumSummary({ type: 'NOTE', startDate: '2026-10-01T10:00:00Z', relationsFrom: [{}] }, labels))
      .toEqual(['dès 2026-10-01', '1 lien'])
  })
})
