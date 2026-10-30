/* TNR articleLayout : classes de mise en page des blocs d'un article (largeur, habillage gauche/droite, repli mobile). */
import { describe, it, expect } from 'vitest'
import { blockClasses, moveBlock, depthIndentClasses, depthTitleClasses, groupRows } from './articleLayout'

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

describe('hiérarchie (depth)', () => {
  it('niveau 0 : pas de décalage, titre le plus grand', () => {
    expect(depthIndentClasses(0)).toBe('')
    expect(depthTitleClasses(0)).toContain('text-xl')
  })
  it('niveaux 1 à 3 : décalage croissant (réduit sous sm) et titres de plus en plus petits', () => {
    expect(depthIndentClasses(1)).toContain('sm:pl-6')
    expect(depthIndentClasses(2)).toContain('sm:pl-12')
    expect(depthIndentClasses(3)).toContain('sm:pl-16')
    expect(depthTitleClasses(1)).toContain('text-lg')
    expect(depthTitleClasses(3)).toContain('text-sm')
  })
  it('profondeur hors bornes ramenée entre 0 et 3', () => {
    expect(depthIndentClasses(9)).toBe(depthIndentClasses(3))
    expect(depthTitleClasses(-1)).toBe(depthTitleClasses(0))
  })
})

describe('groupRows (colonnes)', () => {
  const b = (id: string, beside = false) => ({ id, beside })
  it('blocs sans « à côté » : une rangée par bloc', () => {
    expect(groupRows([b('a'), b('b')]).map((r) => r.map((x) => x.id))).toEqual([['a'], ['b']])
  })
  it('blocs « à côté » rejoignent la rangée du précédent', () => {
    expect(groupRows([b('a'), b('b', true), b('c'), b('d', true), b('e', true)]).map((r) => r.map((x) => x.id)))
      .toEqual([['a', 'b'], ['c', 'd', 'e']])
  })
  it('3 colonnes au plus : le 4e « à côté » ouvre une nouvelle rangée', () => {
    expect(groupRows([b('a'), b('b', true), b('c', true), b('d', true)]).map((r) => r.length)).toEqual([3, 1])
  })
  it('premier bloc « à côté » : rangée normale', () => {
    expect(groupRows([b('a', true), b('b')]).map((r) => r.map((x) => x.id))).toEqual([['a'], ['b']])
  })
})
