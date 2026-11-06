/* Colonnes de la vue Assignations pour un visiteur, qui n'a pas la liste des membres (règle members-email-scope) :
   une colonne par personne assignée aux éléments affichés, sans doublon, triées par nom. */
import { describe, expect, it } from 'vitest'
import { assigneesFromItems } from './MembersKanbanView'

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
