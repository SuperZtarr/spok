/* TNR isLessVisible : quand l'ajout d'un élément dans un article doit déclencher l'avertissement « moins visible ». */
import { describe, it, expect } from 'vitest'
import { isLessVisible, type VisibilityInfo } from './articleVisibility'

const v = (spaceId: string, visibility: string, communityId: string | null, communityVisibility: string | null): VisibilityInfo =>
  ({ spaceId, visibility, communityId, communityVisibility })

describe('isLessVisible', () => {
  it('élément d\'un espace privé dans un article ouvert : vrai', () => {
    expect(isLessVisible(v('a', 'OPEN', 'c1', 'OPEN'), v('p', 'PRIVATE', 'c1', 'OPEN'))).toBe(true)
  })
  it('même espace privé que l\'article : faux', () => {
    expect(isLessVisible(v('p', 'PRIVATE', 'c1', 'OPEN'), v('p', 'PRIVATE', 'c1', 'OPEN'))).toBe(false)
  })
  it('READONLY de communauté publique dans un article OPEN de communauté publique : faux', () => {
    expect(isLessVisible(v('a', 'OPEN', 'c1', 'OPEN'), v('r', 'READONLY', 'c2', 'READONLY'))).toBe(false)
  })
  it('communauté privée A dans un article de communauté privée B : vrai', () => {
    expect(isLessVisible(v('a', 'OPEN', 'cB', 'PRIVATE'), v('r', 'OPEN', 'cA', 'PRIVATE'))).toBe(true)
  })
  it('élément public dans un article privé : faux', () => {
    expect(isLessVisible(v('a', 'PRIVATE', 'c1', 'OPEN'), v('r', 'OPEN', 'c2', 'OPEN'))).toBe(false)
  })
})
