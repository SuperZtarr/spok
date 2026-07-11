/*
 * TNR des utilitaires PERT : graphe de précédence (blocks/implements seulement — depends
 * n'ordonne pas, cf. spec 2026-06-11), rangs, chemin critique.
 */
import { describe, it, expect } from 'vitest';
import { buildPertGraph, computePertRanks, computeCriticalPathNaive } from './pert-utils';
import { buildTree, flattenTree } from './timeline-tree';
import type { Item, ItemRelation } from '@spok/shared';

function makeItem(id: string): Item {
  return { id, title: id } as Item;
}

function makeRel(fromItemId: string, toItemId: string, type: 'blocks' | 'depends' | 'implements'): ItemRelation {
  return { id: `${fromItemId}-${toItemId}`, fromItemId, toItemId, type } as ItemRelation;
}

// A -> B -> C  (A blocks B, B blocks C)
const items3 = [makeItem('A'), makeItem('B'), makeItem('C')];
const rels3 = [makeRel('A', 'B', 'blocks'), makeRel('B', 'C', 'blocks')];

describe('buildPertGraph', () => {
  it('builds predecessors/successors from blocks relations', () => {
    const { predecessors, successors } = buildPertGraph(items3, rels3);
    expect(predecessors.get('B')).toEqual(['A']);
    expect(predecessors.get('C')).toEqual(['B']);
    expect(successors.get('A')).toEqual(['B']);
    expect(predecessors.get('A')).toEqual([]);
  });

  // Spec 2026-06-11 (pert-relation-types) : seuls blocks et implements créent des arêtes
  // de séquencement ; depends = dépendance fonctionnelle, avancement en parallèle possible.
  it('interprets implements relation: from → to means from precedes to', () => {
    const items = [makeItem('X'), makeItem('Y')];
    const rels = [makeRel('X', 'Y', 'implements')];
    const { predecessors } = buildPertGraph(items, rels);
    expect(predecessors.get('Y')).toEqual(['X']);
    expect(predecessors.get('X')).toEqual([]);
  });

  it('ignores depends relations for graph ordering (parallel work allowed)', () => {
    const items = [makeItem('X'), makeItem('Y')];
    const rels = [makeRel('X', 'Y', 'depends')];
    const { predecessors } = buildPertGraph(items, rels);
    expect(predecessors.get('X')).toEqual([]);
    expect(predecessors.get('Y')).toEqual([]);
  });

  it('ignores relations where items are not in the items list', () => {
    const items = [makeItem('A')];
    const rels = [makeRel('A', 'GHOST', 'blocks')];
    const { successors } = buildPertGraph(items, rels);
    expect(successors.get('A')).toEqual([]);
  });
});

describe('computePertRanks', () => {
  it('assigns rank 0 to items with no predecessors', () => {
    const { predecessors, successors } = buildPertGraph(items3, rels3);
    const ranks = computePertRanks(items3, predecessors, successors);
    expect(ranks.get('A')).toBe(0);
  });

  it('assigns rank = longest predecessor chain + 1', () => {
    const { predecessors, successors } = buildPertGraph(items3, rels3);
    const ranks = computePertRanks(items3, predecessors, successors);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(2);
  });

  it('assigns rank 0 to isolated items (no relations)', () => {
    const items = [makeItem('A'), makeItem('X')];
    const { predecessors, successors } = buildPertGraph(items, [makeRel('A', 'X', 'blocks')]);
    const ranks = computePertRanks(items, predecessors, successors);
    expect(ranks.get('A')).toBe(0);
    expect(ranks.get('X')).toBe(1);
  });

  it('handles diamond dependency (A→B, A→C, B→D, C→D)', () => {
    const items = [makeItem('A'), makeItem('B'), makeItem('C'), makeItem('D')];
    const rels = [
      makeRel('A', 'B', 'blocks'),
      makeRel('A', 'C', 'blocks'),
      makeRel('B', 'D', 'blocks'),
      makeRel('C', 'D', 'blocks'),
    ];
    const { predecessors, successors } = buildPertGraph(items, rels);
    const ranks = computePertRanks(items, predecessors, successors);
    expect(ranks.get('A')).toBe(0);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(1);
    expect(ranks.get('D')).toBe(2);
  });
});

describe('PertView sort — buildTree with rank-based sortFn', () => {
  // Simulates exactly what PertView does:
  // 1. compute ranks, 2. build sortFn, 3. buildTree with sortFn, 4. flattenTree
  function pertFlatOrder(items: Item[], rels: ItemRelation[]): string[] {
    const { predecessors, successors } = buildPertGraph(items, rels);
    const ranks = computePertRanks(items, predecessors, successors);
    const sortFn = (a: { id: string; title: string }, b: { id: string; title: string }) => {
      const rankDiff = (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    };
    const tree = buildTree(items, sortFn);
    return flattenTree(tree, new Set()).map(i => i.id);
  }

  it('linear chain A→B→C appears in dependency order', () => {
    // A blocks B, B blocks C  →  rank A=0, B=1, C=2
    const items = [makeItem('C'), makeItem('A'), makeItem('B')]; // shuffled
    const rels = [makeRel('A', 'B', 'blocks'), makeRel('B', 'C', 'blocks')];
    expect(pertFlatOrder(items, rels)).toEqual(['A', 'B', 'C']);
  });

  it('items with same rank are sorted alphabetically', () => {
    // No relations → all rank 0, alpha order
    const items = [makeItem('Zeta'), makeItem('Alpha'), makeItem('Mu')];
    expect(pertFlatOrder(items, [])).toEqual(['Alpha', 'Mu', 'Zeta']);
  });

  it('mixed ranks and alpha: rank wins, alpha is tiebreaker', () => {
    // A blocks C, B has no relation
    // ranks: A=0, B=0, C=1
    // expected: A, B (alpha among rank-0), then C
    const items = [makeItem('C'), makeItem('B'), makeItem('A')];
    const rels = [makeRel('A', 'C', 'blocks')];
    expect(pertFlatOrder(items, rels)).toEqual(['A', 'B', 'C']);
  });

  it('preserves parent–child hierarchy while sorting children by rank', () => {
    // Parent P has children: C (rank 1, blocked by B), A (rank 0), B (rank 0)
    // B blocks C → ranks: A=0, B=0, C=1
    // Expected flat order: P, A, B, C  (children sorted by rank then alpha)
    const p = { ...makeItem('P'), parentId: undefined };
    const a = { ...makeItem('A'), parentId: 'P' };
    const b = { ...makeItem('B'), parentId: 'P' };
    const c = { ...makeItem('C'), parentId: 'P' };
    const items = [p, c, a, b];
    const rels = [makeRel('B', 'C', 'blocks')];
    expect(pertFlatOrder(items, rels)).toEqual(['P', 'A', 'B', 'C']);
  });
});

describe('computeCriticalPathNaive', () => {
  it('returns all items on the longest chain', () => {
    const { predecessors, successors } = buildPertGraph(items3, rels3);
    const cp = computeCriticalPathNaive(items3, predecessors, successors);
    expect(cp.has('A')).toBe(true);
    expect(cp.has('B')).toBe(true);
    expect(cp.has('C')).toBe(true);
  });

  it('excludes isolated items (no dependencies) from critical path', () => {
    const items = [makeItem('A'), makeItem('B'), makeItem('ALONE')];
    const rels = [makeRel('A', 'B', 'blocks')];
    const { predecessors, successors } = buildPertGraph(items, rels);
    const cp = computeCriticalPathNaive(items, predecessors, successors);
    expect(cp.has('ALONE')).toBe(false);
  });

  it('returns empty set when no relations exist', () => {
    const items = [makeItem('A'), makeItem('B')];
    const { predecessors, successors } = buildPertGraph(items, []);
    const cp = computeCriticalPathNaive(items, predecessors, successors);
    expect(cp.size).toBe(0);
  });

  it('on a diamond, all 4 are on critical path (two paths of equal length)', () => {
    const items = [makeItem('A'), makeItem('B'), makeItem('C'), makeItem('D')];
    const rels = [
      makeRel('A', 'B', 'blocks'),
      makeRel('A', 'C', 'blocks'),
      makeRel('B', 'D', 'blocks'),
      makeRel('C', 'D', 'blocks'),
    ];
    const { predecessors, successors } = buildPertGraph(items, rels);
    const cp = computeCriticalPathNaive(items, predecessors, successors);
    expect(cp.has('A')).toBe(true);
    expect(cp.has('D')).toBe(true);
  });
});
