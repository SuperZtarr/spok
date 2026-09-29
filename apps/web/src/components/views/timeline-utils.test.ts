/* Tests des utilitaires purs du Gantt : fin de référence d'un déplacement de barre (moveInitialEnd),
 * types de relation qui ordonnent le chemin critique (computeCriticalPath). */
import { describe, it, expect } from 'vitest';
import { moveInitialEnd, computeCriticalPath } from './timeline-utils';
import type { Item, ItemRelation } from '@spok/shared';

const now = new Date(2026, 8, 28, 10, 0); // 28 sept 2026 10:00 local

describe('moveInitialEnd', () => {
  it('fin enregistrée : la reprend telle quelle', () => {
    const end = new Date(2026, 9, 5, 18, 0).toISOString();
    expect(moveInitialEnd({ startDate: new Date(2026, 8, 1).toISOString(), endDate: end, dueDate: null }, now)?.toISOString()).toBe(end);
  });

  it('début sans fin (barre dessinée jusqu\'à aujourd\'hui) : fin = maintenant — bug de la barre réduite à un jour', () => {
    const r = moveInitialEnd({ startDate: new Date(2026, 6, 12).toISOString(), endDate: null, dueDate: null }, now);
    expect(r?.getTime()).toBe(now.getTime());
  });

  it('début futur sans fin : fin = début (jamais avant le début)', () => {
    const start = new Date(2026, 10, 3, 9, 0);
    expect(moveInitialEnd({ startDate: start.toISOString(), endDate: null, dueDate: null }, now)?.getTime()).toBe(start.getTime());
  });

  it('échéance seule (sert de début affiché) : même règle', () => {
    expect(moveInitialEnd({ startDate: null, endDate: null, dueDate: new Date(2026, 5, 1).toISOString() }, now)?.getTime()).toBe(now.getTime());
  });

  it('aucune date : undefined (barre fantôme d\'un jour, comportement inchangé)', () => {
    expect(moveInitialEnd({ startDate: null, endDate: null, dueDate: null }, now)).toBeUndefined();
  });
});

describe('computeCriticalPath — ordonnancement (blocks + implements, comme le PERT)', () => {
  const d = (day: number) => new Date(2026, 8, day).toISOString();
  const mk = (id: string, start: number, end: number) =>
    ({ id, title: id, startDate: d(start), endDate: d(end), dueDate: null } as unknown as Item);
  const rel = (fromItemId: string, toItemId: string, type: string) =>
    ({ id: `${fromItemId}-${toItemId}-${type}`, fromItemId, toItemId, type } as unknown as ItemRelation);
  // A (1→5) bloque B (6→10) ; D (1→2) court, avant B
  const items = [mk('A', 1, 5), mk('B', 6, 10), mk('D', 1, 2)];
  const base = [rel('A', 'B', 'blocks')];

  it('implements ordonne comme blocks : D devient prédécesseur de B, avec marge → non critique', () => {
    const cp = computeCriticalPath(items, [...base, rel('D', 'B', 'implements')]);
    expect(cp.has('A') && cp.has('B')).toBe(true);
    expect(cp.has('D')).toBe(false);
  });

  it.each(['depends', 'drives', 'relates'])("%s n'ordonne pas : même résultat que sans la relation", (type) => {
    const without = computeCriticalPath(items, base);
    const withRel = computeCriticalPath(items, [...base, rel('D', 'B', type), rel('B', 'D', type)]);
    expect([...withRel].sort()).toEqual([...without].sort());
  });
});

describe('computeCriticalPath — fin du projet (CPM standard)', () => {
  const d = (day: number) => new Date(2026, 8, day).toISOString();
  const mk = (id: string, start: number, end: number) =>
    ({ id, title: id, startDate: d(start), endDate: d(end), dueDate: null } as unknown as Item);
  const rel = (fromItemId: string, toItemId: string) =>
    ({ id: `${fromItemId}-${toItemId}`, fromItemId, toItemId, type: 'blocks' } as unknown as ItemRelation);

  it('un item isolé (sans relation d\'ordre) n\'est jamais critique, même s\'il finit en dernier', () => {
    const items = [mk('A', 1, 3), mk('B', 4, 6), mk('X', 1, 20)];
    const cp = computeCriticalPath(items, [rel('A', 'B')]);
    expect(cp.has('X')).toBe(false);
    expect(cp.has('A') && cp.has('B')).toBe(true);
  });

  it('une chaîne courte parallèle, qui finit avant la fin du projet, n\'est pas critique', () => {
    // Longue : A (1→5) → B (6→15) ; courte : C (1→2) → D (3→4)
    const items = [mk('A', 1, 5), mk('B', 6, 15), mk('C', 1, 2), mk('D', 3, 4)];
    const cp = computeCriticalPath(items, [rel('A', 'B'), rel('C', 'D')]);
    expect([...cp].sort()).toEqual(['A', 'B']);
  });

  it('aucune relation d\'ordre : aucun chemin critique', () => {
    expect(computeCriticalPath([mk('A', 1, 3), mk('B', 4, 9)], []).size).toBe(0);
  });
});
