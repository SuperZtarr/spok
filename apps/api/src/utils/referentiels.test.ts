/* TNR withDefaultTypeLabels : une communauté aux référentiels personnalisés reçoit les types ajoutés depuis (ARTICLE). */
import { describe, it, expect } from 'vitest'
import { DEFAULT_TYPE_LABELS, DEFAULT_STATUSES } from '@spok/shared'
import { withDefaultTypeLabels } from './referentiels'

describe('withDefaultTypeLabels', () => {
  it('custom referentiels get ARTICLE from defaults', () => {
    const custom = { statuses: DEFAULT_STATUSES, typeLabels: { NOTE: { ...DEFAULT_TYPE_LABELS.NOTE, label: 'Idées' } } }
    const r = withDefaultTypeLabels(custom as never)
    expect(r.typeLabels.ARTICLE).toEqual(DEFAULT_TYPE_LABELS.ARTICLE)
    expect(r.typeLabels.NOTE.label).toBe('Idées')
  })

  it('ne remplace jamais un type déjà présent', () => {
    const custom = { statuses: DEFAULT_STATUSES, typeLabels: { ...DEFAULT_TYPE_LABELS, ARTICLE: { ...DEFAULT_TYPE_LABELS.ARTICLE, visible: false } } }
    expect(withDefaultTypeLabels(custom as never).typeLabels.ARTICLE.visible).toBe(false)
  })
})
