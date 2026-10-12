/* Tests de curatedPrimaryViews (SpaceToolbar) : mode JDR = liste de vues choisie, dans l'ordre imposé. */
import { describe, it, expect } from 'vitest'
import { curatedPrimaryViews, MODE_PRIMARY_VIEWS } from './SpaceToolbar'

const all = ['recent', 'kanban', 'links', 'list', 'mindmap', 'documents', 'graph', 'thread', 'images', 'text']
  .map((viewMode) => ({ viewMode }))

describe('curatedPrimaryViews', () => {
  it('JDR : Liste, Discussions, Carte mentale, Images, Documents, Liens, Récents, dans cet ordre', () => {
    expect(curatedPrimaryViews(all, 'jdr')!.map((v) => v.viewMode))
      .toEqual(['list', 'thread', 'mindmap', 'images', 'documents', 'links', 'recent'])
  })

  it('ignore les vues inaccessibles (ex. anonyme sans « Récents »)', () => {
    const visitor = all.filter((v) => v.viewMode !== 'recent')
    expect(curatedPrimaryViews(visitor, 'jdr')!.map((v) => v.viewMode)).not.toContain('recent')
  })

  it('modes sans liste choisie : null (famille ou tout)', () => {
    expect(curatedPrimaryViews(all, 'forum')).toBeNull()
    expect(curatedPrimaryViews(all, 'tous')).toBeNull()
    expect(Object.keys(MODE_PRIMARY_VIEWS)).toEqual(['jdr'])
  })
})
