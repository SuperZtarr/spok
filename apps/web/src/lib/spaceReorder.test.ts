/* Tests de lib/spaceReorder.ts : frères d'un emplacement, dépôt avant/après, monter/descendre. */
import { describe, it, expect } from 'vitest';
import { siblingOrder, placeRelative, shiftInOrder } from './spaceReorder';

const spaces = [
  { id: 'a', parentId: null, communityId: 'c1', type: 'GROUP' },
  { id: 'a1', parentId: 'a', communityId: 'c1', type: 'GROUP' },
  { id: 'b', parentId: null, communityId: 'c1', type: 'GROUP' },
  { id: 'z', parentId: null, communityId: 'c2', type: 'GROUP' },
  { id: 'perso', parentId: null, communityId: null, type: 'PERSONAL' },
];

describe('siblingOrder', () => {
  it('racine d\'une communauté, ou enfants d\'un parent, dans l\'ordre reçu', () => {
    expect(siblingOrder(spaces, null, 'c1')).toEqual(['a', 'b']);
    expect(siblingOrder(spaces, 'a', 'c1')).toEqual(['a1']);
    expect(siblingOrder(spaces, null, null)).toEqual([]);
  });
});

describe('placeRelative', () => {
  it('place avant ou après la cible, en retirant l\'ancienne place', () => {
    expect(placeRelative(['a', 'b', 'c'], 'c', 'a', 'before')).toEqual(['c', 'a', 'b']);
    expect(placeRelative(['a', 'b', 'c'], 'a', 'c', 'after')).toEqual(['b', 'c', 'a']);
  });
  it('ajoute un espace venu d\'ailleurs', () => {
    expect(placeRelative(['a', 'b'], 'x', 'b', 'before')).toEqual(['a', 'x', 'b']);
  });
});

describe('shiftInOrder', () => {
  it('monte ou descend d\'un cran, null en bout de liste', () => {
    expect(shiftInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(shiftInOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(shiftInOrder(['a', 'b'], 'a', -1)).toBeNull();
    expect(shiftInOrder(['a', 'b'], 'b', 1)).toBeNull();
  });
});
