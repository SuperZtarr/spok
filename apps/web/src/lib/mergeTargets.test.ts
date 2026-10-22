/* TNR mergeTargets : la modale de fusion ne propose que des cibles que l'API acceptera (même espace, gérables). */
import { describe, it, expect } from 'vitest'
import type { Item } from '@spok/shared'
import { mergeTargets } from './mergeTargets'

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, title: id, type: 'NOTE', spaceId: 'sp', parentId: null, createdById: 'other', assignedToId: null, ...over }) as Item

const source = item('src', { createdById: 'me' })
const all = [
  source,
  item('child', { parentId: 'src', createdById: 'me' }),
  item('grandchild', { parentId: 'child', createdById: 'me' }),
  item('mine', { createdById: 'me' }),
  item('assigned', { assignedToId: 'me' }),
  item('foreign'),
  item('locked', { createdById: 'me', lockedAt: '2026-10-10' } as Partial<Item>),
  item('subspace', { spaceId: 'sub', createdById: 'me' }),
]
// Règle de SpacePage.canEditItem pour un MEMBER
const memberCan = (i: Item) => !(i as { lockedAt?: string | null }).lockedAt && (i.createdById === 'me' || i.assignedToId === 'me')

describe('mergeTargets', () => {
  it('membre : seulement ses éléments (auteur ou assigné) du même espace, hors source et descendants', () => {
    expect(mergeTargets(source, all, memberCan).map((i) => i.id)).toEqual(['mine', 'assigned'])
  })

  it('propriétaire : tous les éléments du même espace hors source et descendants', () => {
    expect(mergeTargets(source, all).map((i) => i.id)).toEqual(['mine', 'assigned', 'foreign', 'locked'])
  })

  it("jamais d'élément d'un autre espace (sous-espace inclus dans la vue)", () => {
    expect(mergeTargets(source, all).some((i) => i.id === 'subspace')).toBe(false)
  })
})
