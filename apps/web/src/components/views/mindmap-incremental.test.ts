/* Tests du diff incrémental MindMap : détection ajouts/suppressions/reparentages/relations
 * et calcul des parents à ré-éventailler (spec 2026-07-15-mindmap-incremental-layout). */
import { describe, it, expect } from 'vitest';
import { diffItems, diffRelations, initialPositionForNew } from './mindmap-incremental';

const item = (id: string, parentId: string | null = null, spaceId = 'S1') =>
  ({ id, parentId, spaceId }) as any;

describe('diffItems', () => {
  it('détecte un ajout et marque son parent comme affecté', () => {
    const prev = [item('a'), item('b', 'a')];
    const next = [item('a'), item('b', 'a'), item('c', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.addedIds).toEqual(['c']);
    expect(d.deletedIds).toEqual([]);
    expect(d.reparented).toEqual([]);
    expect(d.affectedParentIds).toEqual(['a']);
  });

  it('détecte une suppression et marque le parent (les frères se resserrent)', () => {
    const prev = [item('a'), item('b', 'a'), item('c', 'a')];
    const next = [item('a'), item('b', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.deletedIds).toEqual(['c']);
    expect(d.affectedParentIds).toEqual(['a']);
  });

  it('détecte un reparentage et marque les DEUX parents', () => {
    const prev = [item('a'), item('b'), item('x', 'a')];
    const next = [item('a'), item('b'), item('x', 'b')];
    const d = diffItems(prev, next, 'S1');
    expect(d.reparented).toEqual([{ id: 'x', oldParentId: 'a', newParentId: 'b' }]);
    expect(d.affectedParentIds.sort()).toEqual(['a', 'b']);
  });

  it("ne ré-éventaille jamais la racine de l'espace courant", () => {
    const prev = [item('a')];
    const next = [item('a'), item('b')]; // ajout à la racine
    const d = diffItems(prev, next, 'S1');
    expect(d.addedIds).toEqual(['b']);
    expect(d.affectedParentIds).toEqual([]);
  });

  it("un item racine d'un autre espace (portail) affecte le nœud portail", () => {
    const prev = [item('a')];
    const next = [item('a'), item('p1', null, 'S2')];
    const d = diffItems(prev, next, 'S1');
    expect(d.affectedParentIds).toEqual(['child-space-S2']);
  });

  it("un parent supprimé en cascade n'est pas dans les parents affectés", () => {
    const prev = [item('a'), item('b', 'a'), item('c', 'b')];
    const next = [item('a')]; // b et c supprimés ensemble
    const d = diffItems(prev, next, 'S1');
    expect(d.deletedIds.sort()).toEqual(['b', 'c']);
    expect(d.affectedParentIds).toEqual(['a']); // pas 'b'
  });

  it('un déplacement racine → parent marque seulement le nouveau parent', () => {
    const prev = [item('a'), item('x')];
    const next = [item('a'), item('x', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.affectedParentIds).toEqual(['a']);
  });
});

describe('diffRelations', () => {
  const withRel = (id: string, rels: any[]) => ({ id, parentId: null, relationsFrom: rels }) as any;
  const rel = (id: string, from: string, to: string, type = 'relates', label: string | null = null) =>
    ({ id, fromItemId: from, toItemId: to, type, label });

  it('détecte une relation ajoutée', () => {
    const prev = [withRel('a', [])];
    const next = [withRel('a', [rel('r1', 'a', 'b')])];
    const d = diffRelations(prev, next);
    expect(d.added.map(r => r.id)).toEqual(['r1']);
    expect(d.removedIds).toEqual([]);
  });

  it('détecte une relation supprimée', () => {
    const prev = [withRel('a', [rel('r1', 'a', 'b')])];
    const next = [withRel('a', [])];
    const d = diffRelations(prev, next);
    expect(d.removedIds).toEqual(['r1']);
  });

  it('une relation modifiée (type/label) est retirée puis ré-ajoutée', () => {
    const prev = [withRel('a', [rel('r1', 'a', 'b', 'relates')])];
    const next = [withRel('a', [rel('r1', 'a', 'b', 'blocks')])];
    const d = diffRelations(prev, next);
    expect(d.removedIds).toEqual(['r1']);
    expect(d.added.map(r => r.id)).toEqual(['r1']);
  });
});

describe('initialPositionForNew', () => {
  it('place un enfant près de son parent (le ré-éventail suit)', () => {
    const pos = initialPositionForNew('a', { x: 100, y: 50 }, 0, 1);
    expect(Math.hypot(pos.x - 100, pos.y - 50)).toBeLessThan(300);
  });

  it('place un ajout racine sur le cercle RADIAL_STEP autour du centre', () => {
    const pos = initialPositionForNew('__space__', undefined, 2, 5);
    expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(420, 0);
  });
});
