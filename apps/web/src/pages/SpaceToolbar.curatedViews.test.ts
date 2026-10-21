/* Tests de la répartition des vues par mode (SpaceToolbar) : mode JDR = liste de vues choisie, dans l'ordre imposé ;
   modes à famille (forum/projet) = famille ajustée en boutons directs, le reste dans « Autres vues », un menu par
   catégorie, sans doublon. */
import { describe, it, expect } from 'vitest'
import { curatedPrimaryViews, splitViewsForMode, MODE_PRIMARY_VIEWS } from './SpaceToolbar'

const all = ['recent', 'kanban', 'links', 'list', 'mindmap', 'documents', 'graph', 'thread', 'images', 'text']
  .map((viewMode) => ({ viewMode }))

describe('curatedPrimaryViews', () => {
  it('JDR : Discussions, Carte mentale, Images, Documents, Récents, dans cet ordre (sans Liste ni Liens)', () => {
    expect(curatedPrimaryViews(all, 'jdr')!.map((v) => v.viewMode))
      .toEqual(['thread', 'mindmap', 'images', 'documents', 'recent'])
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

describe('splitViewsForMode', () => {
  const views = ['list', 'tree', 'thread', 'recent', 'text', 'types', 'links', 'images', 'documents', 'bugs', 'todo',
    'kanban', 'timeline', 'process', 'mindmap', 'graph'].map((viewMode) => ({ viewMode }))
  const ids = (vs: { viewMode: string }[]) => vs.map((v) => v.viewMode)

  it('Projet : Pilotage sans Liste/Types/Images/Liens/Documents, plus la Carte mentale', () => {
    const { primary } = splitViewsForMode(views, 'projet')
    expect(ids(primary)).toEqual(['tree', 'bugs', 'todo', 'kanban', 'timeline', 'process', 'mindmap'])
  })

  it('Projet : les vues retirées restent dans « Autres vues » (Pilotage), la Carte mentale sort d\'Exploration', () => {
    const { secondary } = splitViewsForMode(views, 'projet')
    expect(secondary.map((g) => [g.key, ids(g.views)])).toEqual([
      ['basic', ['list', 'thread', 'recent', 'text']],
      ['itemTypes', ['types', 'links', 'images', 'documents']],
      ['exploration', ['graph']],
    ])
  })

  it('aucune vue perdue ni doublée, quel que soit le mode', () => {
    for (const mode of ['forum', 'projet', 'jdr', 'tous']) {
      const { primary, secondary } = splitViewsForMode(views, mode)
      const shown = [...ids(primary), ...secondary.flatMap((g) => ids(g.views))]
      expect(shown.sort(), mode).toEqual(ids(views).sort())
    }
  })

  it('Forum : famille Discussion, plus Images et Calendrier', () => {
    expect(ids(splitViewsForMode([...views, { viewMode: 'calendar' }], 'forum').primary)).toEqual(['thread', 'recent', 'text', 'images', 'calendar'])
  })
})

describe('menus « Autres vues » par catégorie', () => {
  const views = ['list', 'tree', 'thread', 'recent', 'text', 'types', 'bugs', 'kanban', 'timeline', 'mindmap', 'graph']
    .map((viewMode) => ({ viewMode }))
  it('Forum : Basique (sans les vues de discussion), Types, Planification, Exploration (sans Images ni Calendrier)', () => {
    const { secondary } = splitViewsForMode(views, 'forum')
    expect(secondary.map((g) => [g.key, g.views.map((v) => v.viewMode)])).toEqual([
      ['basic', ['list', 'tree']],
      ['itemTypes', ['types', 'bugs']],
      ['planning', ['kanban', 'timeline']],
      ['exploration', ['mindmap', 'graph']],
    ])
  })
  it('Tous : aucun menu complémentaire', () => {
    expect(splitViewsForMode(views, 'tous').secondary).toEqual([])
  })
})
