/* Tests du brouillon de fiche gardé dans le navigateur (lib/itemDraft.ts, règle item-draft-local) : clé par compte et
 * par élément, expiration, purge, contenu illisible, comparaison avec l'élément enregistré. */
import { describe, it, expect, beforeEach } from 'vitest'
import { saveItemDraft, loadItemDraft, clearItemDraft, purgeExpiredItemDrafts, draftHasChanges, DRAFT_TTL_MS, type ItemDraftFields } from './itemDraft'

const fields: ItemDraftFields = {
  title: 'T', description: '<p>d</p>', parentId: '', status: 'todo', priority: null, assignedToId: '', assignedToName: '',
  type: 'TASK', dueDate: '', startDate: '', endDate: '', tagIds: ['a', 'b'],
}
const NOW = 1_800_000_000_000

describe('itemDraft', () => {
  beforeEach(() => localStorage.clear())

  it('enregistre et relit par compte et par élément', () => {
    saveItemDraft('u1', 'i1', { savedAt: NOW, baseUpdatedAt: 'v1', fields })
    expect(loadItemDraft('u1', 'i1', NOW)?.fields?.title).toBe('T')
    expect(loadItemDraft('u2', 'i1', NOW)).toBeNull()
    expect(loadItemDraft('u1', 'i2', NOW)).toBeNull()
    clearItemDraft('u1', 'i1')
    expect(loadItemDraft('u1', 'i1', NOW)).toBeNull()
  })

  it('expire et s\'efface au bout de 7 jours', () => {
    saveItemDraft('u1', 'i1', { savedAt: NOW, baseUpdatedAt: null, fields })
    expect(loadItemDraft('u1', 'i1', NOW + DRAFT_TTL_MS + 1)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('contenu illisible : ignoré et effacé', () => {
    localStorage.setItem('spok-item-draft:u1:i1', '{pas du json')
    expect(loadItemDraft('u1', 'i1', NOW)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('purge les brouillons expirés, garde les autres clés', () => {
    saveItemDraft('u1', 'old', { savedAt: NOW - DRAFT_TTL_MS - 1, baseUpdatedAt: null, fields })
    saveItemDraft('u1', 'new', { savedAt: NOW, baseUpdatedAt: null, fields })
    localStorage.setItem('autre', 'x')
    purgeExpiredItemDrafts(NOW)
    expect(localStorage.getItem('spok-item-draft:u1:old')).toBeNull()
    expect(localStorage.getItem('spok-item-draft:u1:new')).not.toBeNull()
    expect(localStorage.getItem('autre')).toBe('x')
  })

  it('draftHasChanges : identique à l\'enregistré (tags dans un autre ordre) = rien à proposer', () => {
    expect(draftHasChanges({ savedAt: NOW, baseUpdatedAt: null, fields: { ...fields, tagIds: ['b', 'a'] } }, fields)).toBe(false)
    expect(draftHasChanges({ savedAt: NOW, baseUpdatedAt: null, fields: { ...fields, status: 'done' } }, fields)).toBe(true)
    expect(draftHasChanges({ savedAt: NOW, baseUpdatedAt: null, contribution: { text: '<p></p>', vote: null, replyTo: null } }, fields)).toBe(false)
    expect(draftHasChanges({ savedAt: NOW, baseUpdatedAt: null, contribution: { text: '<p>Bonjour</p>', vote: 'pertinent', replyTo: null } }, fields)).toBe(true)
  })
})
