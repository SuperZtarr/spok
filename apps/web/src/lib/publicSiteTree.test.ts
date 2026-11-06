/* Tests de buildPublicSpaceTree : seuls les espaces publics apparaissent au plan du site, héritage de visibilité compris. */
import { describe, it, expect } from 'vitest';
import { buildPublicSpaceTree, isPublicVisibility } from './publicSiteTree';

describe('isPublicVisibility', () => {
  it('accepte Ouvert et Lecture seule, refuse Privé et inconnu', () => {
    expect(isPublicVisibility('OPEN')).toBe(true);
    expect(isPublicVisibility('READONLY')).toBe(true);
    expect(isPublicVisibility('PRIVATE')).toBe(false);
    expect(isPublicVisibility(null)).toBe(false);
  });
});

describe('buildPublicSpaceTree', () => {
  it('imbrique les sous-espaces sous leur parent', () => {
    const tree = buildPublicSpaceTree([
      { id: 'a', name: 'A', type: 'GROUP', visibility: 'OPEN' },
      { id: 'b', name: 'B', type: 'GROUP', parentId: 'a' },
    ], 'OPEN');
    expect(tree.map((n) => n.id)).toEqual(['a']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['b']);
  });

  it('retire un espace privé et ceux qui en héritent', () => {
    const tree = buildPublicSpaceTree([
      { id: 'prive', name: 'Privé', type: 'GROUP', visibility: 'PRIVATE' },
      { id: 'enfant', name: 'Enfant', type: 'GROUP', parentId: 'prive' },
      { id: 'libre', name: 'Libre', type: 'GROUP', visibility: null },
    ], 'READONLY');
    expect(tree.map((n) => n.id)).toEqual(['libre']);
  });

  it('remonte à la racine un espace public dont le parent est privé', () => {
    const tree = buildPublicSpaceTree([
      { id: 'prive', name: 'Privé', type: 'GROUP', visibility: 'PRIVATE' },
      { id: 'public', name: 'Public', type: 'GROUP', parentId: 'prive', visibility: 'OPEN' },
    ], 'OPEN');
    expect(tree.map((n) => n.id)).toEqual(['public']);
  });

  it('hérite de la communauté quand le parent est absent de la liste', () => {
    const spaces = [{ id: 'a', name: 'A', type: 'GROUP', parentId: 'absent' }];
    expect(buildPublicSpaceTree(spaces, 'OPEN').map((n) => n.id)).toEqual(['a']);
    expect(buildPublicSpaceTree(spaces, 'PRIVATE')).toEqual([]);
  });

  it('ignore les espaces personnels', () => {
    expect(buildPublicSpaceTree([{ id: 'p', name: 'Perso', type: 'PERSONAL', visibility: 'OPEN' }], 'OPEN')).toEqual([]);
  });

  it('ne boucle pas sur une chaîne de parents circulaire', () => {
    const tree = buildPublicSpaceTree([
      { id: 'a', name: 'A', type: 'GROUP', parentId: 'b' },
      { id: 'b', name: 'B', type: 'GROUP', parentId: 'a' },
    ], 'PRIVATE');
    expect(tree).toEqual([]);
  });
});
