import { describe, it, expect } from 'vitest';
import { buildPertGraph, computePertRanks, computeCriticalPathNaive } from './pert-utils';
import type { Item, ItemRelation } from '@spok/shared';

function makeItem(id: string): Item {
  return { id, title: id } as Item;
}

function makeRel(fromItemId: string, toItemId: string, type: 'blocks' | 'depends'): ItemRelation {
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

  it('interprets depends relation: from depends on to → to is predecessor of from', () => {
    const items = [makeItem('X'), makeItem('Y')];
    const rels = [makeRel('X', 'Y', 'depends')]; // X depends on Y → Y precedes X
    const { predecessors } = buildPertGraph(items, rels);
    expect(predecessors.get('X')).toEqual(['Y']);
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
