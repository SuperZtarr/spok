/* Tests des favoris de vues par mode et du rangement par catégorie (lib/viewFavorites.ts, réorganisation 2026-11-13).
   Remplace SpaceToolbar.curatedViews.test.ts (familles et ajustements supprimés). */
import { describe, it, expect } from 'vitest'
import { VIEW_REGISTRY, SPACE_VIEW_SECTIONS, MODE_REGISTRY, getInterfaceMode } from '@spok/shared'
import { favoriteViews, viewsByCategory, matchesViewQuery } from './viewFavorites'

// Les valeurs attendues sont lues dans MODE_REGISTRY, jamais recopiées (centralisation des référentiels, 2026-11-13) :
// Thomas règle les favoris dans le registre sans avoir à toucher ce test.
const all = VIEW_REGISTRY.map((v) => ({ viewMode: v.id }))
const ids = (list: { viewMode?: string | null }[]) => list.map((v) => v.viewMode)

describe('favoriteViews', () => {
  it.each(MODE_REGISTRY.map((m) => [m.id, m.favorites] as const))('%s : favoris du registre, dans son ordre', (mode, favorites) => {
    expect(ids(favoriteViews(all, mode))).toEqual([...favorites])
  })

  it('omet une vue inaccessible (réglage /admin/views), sans changer l\'ordre des autres', () => {
    const favorites = getInterfaceMode('forum').favorites
    const hidden = favorites[0]
    const visitor = all.filter((v) => v.viewMode !== hidden)
    expect(ids(favoriteViews(visitor, 'forum'))).toEqual(favorites.filter((v) => v !== hidden))
  })

  it('mode inconnu : favoris de « Tous »', () => {
    expect(ids(favoriteViews(all, 'inconnu'))).toEqual(getInterfaceMode('tous').favorites)
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
