/* TNR blockDepths : profondeur d'un bloc d'article = nombre de ses ancêtres présents dans l'article (plafond 3). */
import { describe, it, expect } from 'vitest'
import { blockDepths } from './articleHierarchy'

const parents = (entries: Record<string, string | null>) => new Map(Object.entries(entries))

describe('blockDepths', () => {
  it('parent puis enfant puis petit-enfant : 0, 1, 2', () => {
    const d = blockDepths(['p', 'c', 'g'], parents({ p: null, c: 'p', g: 'c' }))
    expect([d.get('p'), d.get('c'), d.get('g')]).toEqual([0, 1, 2])
  })

  it('ancêtre absent de l\'article sauté : petit-enfant sous le grand-parent présent = 1', () => {
    const d = blockDepths(['p', 'g'], parents({ p: null, c: 'p', g: 'c' }))
    expect(d.get('g')).toBe(1)
  })

  it('éléments sans lien de parenté dans l\'article : 0', () => {
    const d = blockDepths(['a', 'b'], parents({ a: 'x', b: null, x: null }))
    expect([d.get('a'), d.get('b')]).toEqual([0, 0])
  })

  it('plafond à 3 niveaux', () => {
    const d = blockDepths(['a', 'b', 'c', 'd', 'e'], parents({ a: null, b: 'a', c: 'b', d: 'c', e: 'd' }))
    expect(d.get('e')).toBe(3)
  })

  it('cycle de parenté corrompu : pas de boucle infinie', () => {
    const d = blockDepths(['a', 'b'], parents({ a: 'b', b: 'a' }))
    expect(d.get('a')).toBeLessThanOrEqual(3)
  })
})
