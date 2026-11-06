/*
 * Tests des mots d'une recherche : découpage et présence (searchWords, @spok/shared), traduction Prisma (searchWhere).
 * Placés dans l'API : @spok/shared n'a pas de projet Vitest. Nécessite le paquet partagé compilé.
 */
import { describe, it, expect } from 'vitest'
import { MAX_SEARCH_WORDS, nextSearchWordMode, parseSearchWords, resolveSearchWords } from '@spok/shared'
import { buildWordsWhere } from './searchWhere.js'

describe('parseSearchWords', () => {
  it('découpe sur les espaces et ignore les espaces multiples', () => {
    expect(parseSearchWords('  plan   projet ')).toEqual(['plan', 'projet'])
  })

  it('garde une expression entre guillemets comme un seul mot', () => {
    expect(parseSearchWords('"plan projet" budget')).toEqual(['plan projet', 'budget'])
  })

  it('un guillemet non refermé vaut jusqu\'à la fin (saisie en cours)', () => {
    expect(parseSearchWords('budget "plan pro')).toEqual(['budget', 'plan pro'])
  })

  it('retire les doublons sans tenir compte de la casse', () => {
    expect(parseSearchWords('Plan plan PLAN')).toEqual(['Plan'])
  })

  it('texte vide : aucun mot ; guillemets vides : le texte tel quel', () => {
    expect(parseSearchWords('   ')).toEqual([])
    expect(parseSearchWords('""')).toEqual(['""'])
  })

  it('borne le nombre de mots', () => {
    const q = Array.from({ length: MAX_SEARCH_WORDS + 5 }, (_, i) => `m${i}`).join(' ')
    expect(parseSearchWords(q)).toHaveLength(MAX_SEARCH_WORDS)
  })
})

describe('resolveSearchWords', () => {
  it('par défaut, tous les mots sont obligatoires', () => {
    expect(resolveSearchWords('plan projet').map((w) => w.mode)).toEqual(['required', 'required'])
  })

  it('applique any et not sans tenir compte de la casse, ignore les mots absents de q', () => {
    expect(resolveSearchWords('plan projet budget', ['PROJET', 'absent'], ['budget'])).toEqual([
      { text: 'plan', mode: 'required' },
      { text: 'projet', mode: 'any' },
      { text: 'budget', mode: 'excluded' },
    ])
  })

  it('que des mots exclus : ils redeviennent obligatoires', () => {
    expect(resolveSearchWords('plan projet', [], ['plan', 'projet']).map((w) => w.mode)).toEqual(['required', 'required'])
  })
})

describe('nextSearchWordMode', () => {
  it('passe de obligatoire à au moins un, à exclu, à obligatoire', () => {
    const words = resolveSearchWords('plan projet', ['projet'])
    expect(nextSearchWordMode(words, 0)).toBe('any')
    expect(nextSearchWordMode(words, 1)).toBe('excluded')
    expect(nextSearchWordMode(resolveSearchWords('plan projet', [], ['projet']), 1)).toBe('required')
  })

  it('n\'exclut jamais le dernier mot positif', () => {
    const words = resolveSearchWords('plan projet', ['plan'], ['projet'])
    expect(nextSearchWordMode(words, 0)).toBe('required')
  })
})

describe('buildWordsWhere', () => {
  const fields = [{ name: 'title' }, { name: 'description', nullable: true }]
  const hit = (name: string, text: string) => ({ [name]: { contains: text, mode: 'insensitive' } })

  it('un mot obligatoire = une condition, cherchée dans toutes les colonnes', () => {
    const where = buildWordsWhere(resolveSearchWords('plan projet'), fields)
    expect(where.AND).toEqual([
      { OR: [hit('title', 'plan'), hit('description', 'plan')] },
      { OR: [hit('title', 'projet'), hit('description', 'projet')] },
    ])
  })

  it('les mots « au moins un » forment une seule condition OU', () => {
    const where = buildWordsWhere(resolveSearchWords('plan projet budget', ['projet', 'budget']), [{ name: 'title' }])
    expect(where.AND).toEqual([
      { OR: [hit('title', 'plan')] },
      { OR: [hit('title', 'projet'), hit('title', 'budget')] },
    ])
  })

  it('un mot exclu garde les lignes dont la colonne facultative est vide', () => {
    const where = buildWordsWhere(resolveSearchWords('plan budget', [], ['budget']), fields)
    expect(where.AND).toEqual([
      { OR: [hit('title', 'plan'), hit('description', 'plan')] },
      { NOT: hit('title', 'budget') },
      { OR: [{ description: null }, { NOT: hit('description', 'budget') }] },
    ])
  })
})
