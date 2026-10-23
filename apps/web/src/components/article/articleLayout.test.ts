/* TNR articleLayout : classes de mise en page des blocs d'un article (largeur, habillage gauche/droite, repli mobile). */
import { describe, it, expect } from 'vitest'
import { blockClasses, moveBlock } from './articleLayout'

describe('blockClasses', () => {
  it('pleine largeur centrée : pas de flottant', () => {
    const c = blockClasses({ width: 'full', align: 'center' }, 'NOTE')
    expect(c).toContain('w-full')
    expect(c).not.toContain('float')
  })

  it('image moyenne à gauche : flottant à gauche à partir de sm', () => {
    const c = blockClasses({ width: 'medium', align: 'left' }, 'IMAGE')
    expect(c).toContain('sm:float-left')
    expect(c).toContain('sm:w-[45%]')
  })

  it('schéma à droite : flottant à droite', () => {
    expect(blockClasses({ width: 'full', align: 'right' }, 'DIAGRAM')).toContain('sm:float-right')
  })

  it('position gauche ignorée pour une note (centrée)', () => {
    const c = blockClasses({ width: 'medium', align: 'left' }, 'NOTE')
    expect(c).not.toContain('float')
    expect(c).toContain('sm:w-[60%]')
    expect(c).toContain('sm:mx-auto')
  })

  it('repli mobile : pleine largeur sans flottant sous sm', () => {
    for (const c of [blockClasses({ width: 'wide', align: 'center' }, 'NOTE'), blockClasses({ width: 'medium', align: 'left' }, 'IMAGE')]) {
      expect(c.split(' ')).toContain('w-full')
      expect(c.split(' ').filter((k) => k.includes('float')).every((k) => k.startsWith('sm:'))).toBe(true)
    }
  })
})

describe('moveBlock', () => {
  it('déplace un bloc du début à la fin', () => {
    expect(moveBlock(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })
  it('indices hors bornes : liste inchangée', () => {
    expect(moveBlock(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(moveBlock(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
