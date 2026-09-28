/* TNR de itemMenuGroups — hasChildItems : condition d'affichage de « Absorber les enfants ». */
import { describe, it, expect } from 'vitest';
import { hasChildItems } from './itemMenuGroups';

describe('hasChildItems', () => {
  it('vrai si childCount > 0 (liste API)', () => {
    expect(hasChildItems({ childCount: 2 })).toBe(true);
  });
  it('vrai si children non vide (vues en arbre)', () => {
    expect(hasChildItems({ children: [{}] })).toBe(true);
  });
  it('faux sans enfant (bug : action proposée → 400 « No children to absorb »)', () => {
    expect(hasChildItems({ childCount: 0, children: [] })).toBe(false);
    expect(hasChildItems({})).toBe(false);
    expect(hasChildItems(null)).toBe(false);
  });
});
