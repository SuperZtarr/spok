/* Colonnes de la vue Assignations pour un visiteur, qui n'a pas la liste des membres (règle members-email-scope) :
   une colonne par personne assignée aux éléments affichés, sans doublon, triées par nom. Colonnes des noms saisis
   librement (règle members-free-assignee-columns). */
import { describe, expect, it } from 'vitest'
import { assigneesFromItems, freeNameKey, freeNamesFromItems } from './MembersKanbanView'

describe('assigneesFromItems', () => {
  it('garde chaque personne assignée une seule fois, triée par nom', () => {
    const result = assigneesFromItems([
      { assignedTo: { id: 'u2', name: 'Zoé' } },
      { assignedTo: { id: 'u1', name: 'Élodie' } },
      { assignedTo: { id: 'u2', name: 'Zoé' } },
    ])

    expect(result).toEqual([
      { userId: 'u1', name: 'Élodie' },
      { userId: 'u2', name: 'Zoé' },
    ])
  })

  it('ignore les éléments sans personne assignée', () => {
    expect(assigneesFromItems([{ assignedTo: null }, {}])).toEqual([])
  })
})

/* Noms saisis librement (personne sans compte) : une colonne par nom, casse et espaces ignorés, accents comptés. */
describe('freeNamesFromItems', () => {
  it('regroupe les saisies qui ne diffèrent que par la casse ou les espaces, garde la première orthographe', () => {
    expect(freeNamesFromItems([
      { assignedToId: null, assignedToName: 'Paul  Martin ' },
      { assignedToId: null, assignedToName: 'paul martin' },
      { assignedToId: null, assignedToName: 'Élodie' },
    ])).toEqual([
      { key: 'élodie', name: 'Élodie' },
      { key: 'paul martin', name: 'Paul Martin' },
    ])
  })

  it('distingue les accents et ignore les éléments assignés à un membre ou sans nom', () => {
    const result = freeNamesFromItems([
      { assignedToId: null, assignedToName: 'Elodie' },
      { assignedToId: null, assignedToName: 'Élodie' },
      { assignedToId: 'u1', assignedToName: 'Paul' },
      { assignedToId: null, assignedToName: '   ' },
      { assignedToId: null, assignedToName: null },
    ])
    expect(result.map((r) => r.name)).toEqual(['Elodie', 'Élodie'])
  })

  it('freeNameKey : minuscules, espaces réduits', () => {
    expect(freeNameKey('  Jean   DUPONT ')).toBe('jean dupont')
  })
})
