/* TNR de la traduction du journal en historique de fiche (utils/itemHistory.ts, règle item-history-members) :
 * champs modifiés, tags, assigné, dates, contenus, relations vues des deux côtés, éléments illisibles masqués,
 * entrées sans ligne utile (position seule). */
import { describe, it, expect } from 'vitest'
import { describeHistoryLog, collectHistoryRefs, type HistoryContext } from './itemHistory.js'

const ctx: HistoryContext = {
  itemId: 'i1',
  statusLabel: (s) => ({ todo: 'À faire', in_progress: 'En cours' } as Record<string, string>)[s] ?? s,
  userName: (u) => (u === 'u-ana' ? 'Ana' : undefined),
  itemTitle: (i) => (i === 'p1' ? 'Parent visible' : i === 'i2' ? 'Autre' : undefined),
  spaceName: (s) => (s === 's2' ? 'Espace B' : undefined),
}
const update = (before: object, after: object) => ({ action: 'UPDATE', entity: 'Item', entityId: 'i1', changes: { before, after } })

describe('describeHistoryLog', () => {
  it('création', () => {
    expect(describeHistoryLog({ action: 'CREATE', entity: 'Item', entityId: 'i1', changes: { after: {} } }, ctx)).toEqual([{ label: 'Créé' }])
  })

  it('statut, priorité, titre et description', () => {
    const lines = describeHistoryLog(update(
      { status: 'todo', priority: 1, title: 'A', description: '<p>x</p>', position: 1 },
      { status: 'in_progress', priority: 4, title: 'B', description: '<p>y</p>', position: 2 },
    ), ctx)
    expect(lines).toEqual([
      { label: 'Titre', before: 'A', after: 'B' },
      { label: 'Statut', before: 'À faire', after: 'En cours' },
      { label: 'Priorité', before: 'Basse', after: 'Urgente' },
      { label: 'Description modifiée' },
    ])
  })

  it('dates : jour changé seulement', () => {
    const lines = describeHistoryLog(update(
      { startDate: '2026-11-10T00:00:00.000Z', dueDate: null },
      { startDate: '2026-11-10T00:00:00.000Z', dueDate: '2026-11-20T10:00:00.000Z' },
    ), ctx)
    expect(lines).toEqual([{ label: 'Échéance', before: null, after: '20/11/2026' }])
  })

  it('tags ajoutés et retirés, assigné', () => {
    const lines = describeHistoryLog(update(
      { tags: ['idée'], assignedToId: null, assignedToName: null },
      { tags: ['bug'], assignedToId: 'u-ana', assignedToName: null },
    ), ctx)
    expect(lines).toEqual([
      { label: 'Assigné à', before: null, after: 'Ana' },
      { label: 'Tag ajouté', after: 'bug' },
      { label: 'Tag retiré', before: 'idée' },
    ])
  })

  it('références externes ajoutées et retirées', () => {
    expect(describeHistoryLog(update({ externalRefs: ['Jira : A'] }, { externalRefs: ['Sf : 1'] }), ctx)).toEqual([
      { label: 'Référence externe ajoutée', after: 'Sf : 1' },
      { label: 'Référence externe retirée', before: 'Jira : A' },
    ])
  })

  it('ancienne entrée sans tags : aucune ligne de tag', () => {
    expect(describeHistoryLog(update({ position: 1 }, { position: 2, tags: ['bug'] }), ctx)).toEqual([])
  })

  it('parent : titre si lisible, sinon neutre', () => {
    expect(describeHistoryLog({ action: 'MOVE', entity: 'Item', entityId: 'i1', changes: { before: { parentId: 'p1', position: 0 }, after: { parentId: 'secret', position: 0 } } }, ctx))
      .toEqual([{ label: 'Parent', before: '« Parent visible »', after: 'un élément non accessible' }])
  })

  it('contenus : ajout, retrait, renommage, ordre', () => {
    const c = (contentChange: object) => describeHistoryLog({ action: 'UPDATE', entity: 'Item', entityId: 'i1', changes: { after: { contentChange } } }, ctx)
    expect(c({ op: 'add', kind: 'LINK', name: 'Google' })).toEqual([{ label: 'Contenu ajouté', after: 'Lien « Google »' }])
    expect(c({ op: 'remove', kind: 'IMAGE', name: 'photo.webp' })).toEqual([{ label: 'Contenu retiré', before: 'Image « photo.webp »' }])
    expect(c({ op: 'update', kind: 'FILE', name: 'b.pdf', previousName: 'a.pdf' })).toEqual([{ label: 'Fichier renommé', before: 'a.pdf', after: 'b.pdf' }])
    expect(c({ op: 'reorder', kind: 'IMAGE' })).toEqual([{ label: 'Ordre des contenus modifié (images)' }])
  })

  it('relations vues depuis la source et depuis la cible', () => {
    const rel = (action: string, fromItemId: string, toItemId: string) =>
      describeHistoryLog({ action, entity: 'ItemRelation', entityId: 'r1', changes: action === 'DELETE_RELATION' ? { before: { fromItemId, toItemId, type: 'blocks' } } : { after: { fromItemId, toItemId, type: 'blocks' } } }, ctx)
    expect(rel('ADD_RELATION', 'i1', 'i2')).toEqual([{ label: 'Relation ajoutée', after: 'bloque « Autre »' }])
    expect(rel('ADD_RELATION', 'i2', 'i1')).toEqual([{ label: 'Relation ajoutée', after: 'bloqué par « Autre »' }])
    expect(rel('DELETE_RELATION', 'i1', 'x')).toEqual([{ label: 'Relation retirée', before: 'bloque un élément non accessible' }])
  })

  it('déplacement vers un autre espace', () => {
    expect(describeHistoryLog({ action: 'BULK_MOVE', entity: 'Item', entityId: 'i1', changes: { after: { spaceId: 's2' } } }, ctx))
      .toEqual([{ label: 'Déplacé vers un autre espace', after: 'Espace B' }])
  })
})

describe('collectHistoryRefs', () => {
  it('rassemble personnes, éléments et espaces à résoudre', () => {
    const refs = collectHistoryRefs([
      update({ assignedToId: 'u-ana', parentId: 'p1' }, { assignedToId: null }),
      { action: 'ADD_RELATION', entity: 'ItemRelation', entityId: 'r', changes: { after: { fromItemId: 'i2', toItemId: 'i1' } } },
      { action: 'BULK_MOVE', entity: 'Item', entityId: 'i1', changes: { after: { spaceId: 's2' } } },
    ], 'i1')
    expect(refs).toEqual({ userIds: ['u-ana'], itemIds: ['p1', 'i2'], spaceIds: ['s2'] })
  })
})
