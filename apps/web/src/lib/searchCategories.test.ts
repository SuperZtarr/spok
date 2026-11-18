/* Cohérence du registre des catégories de recherche (SEARCH_CATEGORY_REGISTRY, @spok/shared, 2026-11-18) : ids et
   libellés uniques, chaque icône connue de constants/viewIcons, au moins une section gardée sous filtre d'item,
   règles de searchCategoriesShown (filtres d'items, catégories réservées aux connectés) et phrase générée. */
import { describe, it, expect } from 'vitest';
import {
  SEARCH_CATEGORY_REGISTRY, SEARCH_CATEGORIES, DEFAULT_SEARCH_TYPES, searchCategoriesShown, searchCategoriesPhrase,
} from '@spok/shared';
import { hasViewIcon } from '../constants/viewIcons';

describe('SEARCH_CATEGORY_REGISTRY', () => {
  it('ids, libellés et noms uniques', () => {
    const uniq = (list: unknown[]) => new Set(list).size === list.length;
    expect(uniq(SEARCH_CATEGORY_REGISTRY.map((c) => c.id))).toBe(true);
    expect(uniq(SEARCH_CATEGORY_REGISTRY.map((c) => c.label))).toBe(true);
    expect(uniq(SEARCH_CATEGORY_REGISTRY.map((c) => c.noun))).toBe(true);
  });

  it.each(SEARCH_CATEGORY_REGISTRY.map((c) => [c.id, c.icon] as const))('%s : icône %s connue de viewIcons', (_id, icon) => {
    expect(hasViewIcon(icon)).toBe(true);
  });

  it('défaut = toutes les catégories, dans l\'ordre du registre', () => {
    expect(DEFAULT_SEARCH_TYPES.split(',')).toEqual([...SEARCH_CATEGORIES]);
  });

  it('au moins une catégorie gardée sous filtre d\'item, et au moins une visible sans connexion', () => {
    expect(SEARCH_CATEGORY_REGISTRY.some((c) => c.keptUnderItemFilter)).toBe(true);
    expect(SEARCH_CATEGORY_REGISTRY.some((c) => !c.signedInOnly)).toBe(true);
  });

  it('searchCategoriesShown : filtres d\'items, connexion, ids inconnus', () => {
    const all = SEARCH_CATEGORIES;
    expect(searchCategoriesShown(all, { itemFiltersActive: false, signedIn: true })).toEqual([...all]);
    expect(searchCategoriesShown(all, { itemFiltersActive: true, signedIn: true })).toEqual(['items', 'contributions']);
    expect(searchCategoriesShown(all, { itemFiltersActive: false, signedIn: false })).not.toContain('users');
    expect(searchCategoriesShown(['items', 'inconnu'], { itemFiltersActive: false, signedIn: true })).toEqual(['items']);
  });

  it('phrase générée', () => {
    expect(searchCategoriesPhrase()).toBe('communautés, espaces, items, utilisateurs et contributions');
    expect(searchCategoriesPhrase((c) => c.keptUnderItemFilter)).toBe('items et contributions');
  });
});
