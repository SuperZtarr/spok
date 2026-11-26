/* TNR articleLayout : lignes et largeurs des blocs d'un article (composition à la souris, 2026-11-26) — zones de dépôt,
   disposition après un dépôt, crans de largeur, partage d'une ligne, hiérarchie ; règles partagées de @spok/shared. */
import { describe, it, expect } from 'vitest'
import { layoutAfterRemoval, parseArticleBlockWidth } from '@spok/shared'
import { applyDrop, depthIndentClasses, depthTitleClasses, dropZone, groupRows, resizePair, snapSingleWidth } from './articleLayout'

const e = (id: string, beside = false, width = 100) => ({ id, beside, width })
const rows = (layout: { id: string; beside: boolean }[]) => groupRows(layout).map((r) => r.map((x) => x.id))

describe('largeur enregistrée', () => {
  it('anciennes valeurs lues en pourcentage', () => {
    expect([parseArticleBlockWidth('full'), parseArticleBlockWidth('wide'), parseArticleBlockWidth('medium')]).toEqual([100, 75, 67])
  })
  it('nombre ramené entre 20 et 100, inconnu = pleine largeur', () => {
    expect(parseArticleBlockWidth('40')).toBe(40)
    expect(parseArticleBlockWidth('5')).toBe(20)
    expect(parseArticleBlockWidth('abc')).toBe(100)
    expect(parseArticleBlockWidth(null)).toBe(100)
  })
})

describe('dropZone', () => {
  it('bords gauche et droit : à côté', () => {
    expect(dropZone(0.1, 0.5, true)).toBe('left')
    expect(dropZone(0.9, 0.5, true)).toBe('right')
  })
  it('milieu : au-dessus ou au-dessous', () => {
    expect(dropZone(0.5, 0.2, true)).toBe('before')
    expect(dropZone(0.5, 0.8, true)).toBe('after')
  })
  it('ligne pleine : les bords insèrent au-dessus / au-dessous', () => {
    expect(dropZone(0.05, 0.8, false)).toBe('after')
  })
})

describe('applyDrop', () => {
  it('à côté : la ligne se forme à parts égales', () => {
    const next = applyDrop([e('a'), e('b')], 'b', { kind: 'side', refId: 'a', side: 'right' })!
    expect(rows(next)).toEqual([['a', 'b']])
    expect(next.map((b) => b.width)).toEqual([50, 50])
  })
  it('à gauche : le bloc passe en tête de ligne', () => {
    expect(rows(applyDrop([e('a'), e('b')], 'b', { kind: 'side', refId: 'a', side: 'left' })!)).toEqual([['b', 'a']])
  })
  it('sortir d\'une ligne : le bloc prend sa propre ligne en pleine largeur, le resté seul aussi', () => {
    const next = applyDrop([e('a', false, 40), e('b', true, 60), e('c')], 'b', { kind: 'row', refId: 'c', pos: 'after' })!
    expect(rows(next)).toEqual([['a'], ['c'], ['b']])
    expect(next.map((b) => b.width)).toEqual([100, 100, 100])
  })
  it('ligne pleine : dépôt à côté refusé', () => {
    expect(applyDrop([e('a'), e('b', true), e('c', true), e('d')], 'd', { kind: 'side', refId: 'b', side: 'right' })).toBeNull()
  })
  it('réordonner dans sa propre ligne reste permis', () => {
    expect(rows(applyDrop([e('a', false, 33), e('b', true, 33), e('c', true, 33)], 'a', { kind: 'side', refId: 'c', side: 'right' })!))
      .toEqual([['b', 'c', 'a']])
  })
  it('déposé sur lui-même ou sans changement : null', () => {
    expect(applyDrop([e('a'), e('b')], 'a', { kind: 'row', refId: 'a', pos: 'after' })).toBeNull()
    expect(applyDrop([e('a'), e('b')], 'b', { kind: 'row', refId: 'a', pos: 'after' })).toBeNull()
  })
  it('à la fin', () => {
    expect(rows(applyDrop([e('a'), e('b')], 'a', { kind: 'end' })!)).toEqual([['b'], ['a']])
  })
})

describe('layoutAfterRemoval', () => {
  it('le suivant prend la tête de la ligne et la pleine largeur', () => {
    const next = layoutAfterRemoval([e('a', false, 40), e('b', true, 60), e('c')], 'a')
    expect(next).toEqual([e('b', false, 100), e('c', false, 100)])
  })
})

describe('largeurs', () => {
  it('bloc seul : cran le plus proche', () => {
    expect(snapSingleWidth(48)).toBe(50)
    expect(snapSingleWidth(70)).toBe(67)
    expect(snapSingleWidth(95)).toBe(100)
    expect(snapSingleWidth(10)).toBe(33)
  })
  it('trait entre deux blocs : partage par pas de 5, 20 au moins de chaque côté', () => {
    expect(resizePair([e('a', false, 50), e('b', true, 50)], 0, 0.4).map((b) => b.width)).toEqual([40, 60])
    expect(resizePair([e('a', false, 50), e('b', true, 50)], 0, 0.02).map((b) => b.width)).toEqual([20, 80])
  })
  it('anciennes parts égales (100 / 100) ramenées à un total de 100', () => {
    expect(resizePair([e('a'), e('b', true)], 0, 0.7).map((b) => b.width)).toEqual([70, 30])
  })
})

describe('hiérarchie (depth)', () => {
  it('niveau 0 : pas de décalage, titre le plus grand', () => {
    expect(depthIndentClasses(0)).toBe('')
    expect(depthTitleClasses(0)).toContain('text-xl')
  })
  it('niveaux 1 à 3 : décalage croissant et titres de plus en plus petits', () => {
    expect(depthIndentClasses(1)).toContain('sm:pl-6')
    expect(depthIndentClasses(3)).toContain('sm:pl-16')
    expect(depthTitleClasses(3)).toContain('text-sm')
  })
  it('profondeur hors bornes ramenée entre 0 et 3', () => {
    expect(depthIndentClasses(9)).toBe(depthIndentClasses(3))
    expect(depthTitleClasses(-1)).toBe(depthTitleClasses(0))
  })
})

describe('groupRows (lignes)', () => {
  it('3 blocs au plus par ligne ; premier bloc « à côté » = ligne normale', () => {
    expect(rows([e('a'), e('b', true), e('c', true), e('d', true)])).toEqual([['a', 'b', 'c'], ['d']])
    expect(rows([e('a', true), e('b')])).toEqual([['a'], ['b']])
  })
})
