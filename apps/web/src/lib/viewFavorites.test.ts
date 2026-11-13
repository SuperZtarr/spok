/* Tests des favoris de vues par mode et du rangement par catégorie (lib/viewFavorites.ts, réorganisation 2026-11-13).
   Remplace SpaceToolbar.curatedViews.test.ts (familles et ajustements supprimés). */
import { describe, it, expect } from 'vitest'
import { VIEW_REGISTRY, SPACE_VIEW_SECTIONS } from '@spok/shared'
import { MODE_FAVORITE_VIEWS, favoriteViews, viewsByCategory, matchesViewQuery } from './viewFavorites'

const all = VIEW_REGISTRY.map((v) => ({ viewMode: v.id }))
const ids = (list: { viewMode?: string | null }[]) => list.map((v) => v.viewMode)

describe('favoriteViews', () => {
  it('donne les favoris du mode dans l\'ordre décidé', () => {
    expect(ids(favoriteViews(all, 'forum'))).toEqual(['thread', 'text', 'recent', 'images', 'calendar', 'loupe'])
    expect(ids(favoriteViews(all, 'projet'))).toEqual(['tree', 'todo', 'kanban', 'timeline', 'pert', 'calendar', 'planning', 'priority', 'process', 'mindmap', 'loupe'])
    expect(ids(favoriteViews(all, 'loisirs'))).toEqual(['thread', 'mindmap', 'images', 'documents', 'recent', 'loupe'])
    expect(ids(favoriteViews(all, 'documentation'))).toEqual(['tree', 'text', 'articles', 'documents', 'links', 'tags', 'mindmap', 'loupe'])
    expect(ids(favoriteViews(all, 'exploration'))).toEqual(['links', 'recent', 'tags', 'graph', 'loupe', 'mindmap', 'images'])
    expect(ids(favoriteViews(all, 'tous'))).toEqual(['list', 'tree', 'thread', 'kanban', 'timeline', 'calendar', 'mindmap'])
  })

  it('omet une vue inaccessible (réglage /admin/views)', () => {
    const visitor = all.filter((v) => v.viewMode !== 'loupe')
    expect(ids(favoriteViews(visitor, 'forum'))).not.toContain('loupe')
  })

  it('mode inconnu : favoris de « Tous »', () => {
    expect(ids(favoriteViews(all, 'inconnu'))).toEqual(MODE_FAVORITE_VIEWS.tous)
  })

  it('chaque favori existe dans le registre des vues', () => {
    const known = new Set(VIEW_REGISTRY.map((v) => v.id))
    for (const list of Object.values(MODE_FAVORITE_VIEWS)) for (const id of list) expect(known.has(id)).toBe(true)
  })
})

describe('viewsByCategory', () => {
  it('range toutes les vues, favoris compris, dans les 5 catégories et leur ordre', () => {
    const groups = viewsByCategory(all)
    expect(groups.map((g) => g.id)).toEqual(SPACE_VIEW_SECTIONS.map((s) => s.id))
    expect(groups.flatMap((g) => g.views).length).toBe(all.length)
    expect(ids(groups[0].views)).toEqual(['thread', 'text', 'articles', 'recent', 'images', 'links', 'documents'])
  })

  it('omet une catégorie sans vue accessible', () => {
    const groups = viewsByCategory([{ viewMode: 'list' }, { viewMode: 'mindmap' }])
    expect(groups.map((g) => g.id)).toEqual(['organize', 'exploration'])
  })
})

describe('matchesViewQuery', () => {
  it('cherche dans le nom et la description, sans accents ni casse', () => {
    expect(matchesViewQuery('Récents', undefined, 'recen')).toBe(true)
    expect(matchesViewQuery('Gantt', 'Barres de dates sur une frise', 'FRISE')).toBe(true)
    expect(matchesViewQuery('Gantt', 'Barres', 'kanban')).toBe(false)
    expect(matchesViewQuery('Gantt', undefined, '  ')).toBe(true)
  })
})
