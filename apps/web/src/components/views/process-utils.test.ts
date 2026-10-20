/* TNR de la logique pure de la vue Process : placés / non placés, arêtes des relations, recherche du panneau. */
import { describe, it, expect } from 'vitest';
import type { Item, ItemRelation } from '@spok/shared';
import { splitPlaced, buildProcessEdges, filterUnplaced, layoutAsProcess, PROCESS_COLUMN_GAP, PROCESS_ROW_GAP } from './process-utils';
import { getRelationMeta } from '../../constants/relationTypes';

const item = (id: string, title = id) => ({ id, title, type: 'NOTE' } as unknown as Item);
const rel = (id: string, fromItemId: string, toItemId: string, type = 'relates'): ItemRelation => ({ id, fromItemId, toItemId, type });

describe('splitPlaced', () => {
  it('sépare placés et non placés', () => {
    const [a, b, c] = [item('a'), item('b'), item('c')];
    const { placed, unplaced } = splitPlaced([a, b, c], [{ itemId: 'b', x: 1, y: 2 }]);
    expect(placed).toEqual([{ item: b, x: 1, y: 2 }]);
    expect(unplaced).toEqual([a, c]);
  });

  it("ignore une position d'item disparu", () => {
    const { placed } = splitPlaced([item('a')], [{ itemId: 'zz', x: 0, y: 0 }]);
    expect(placed).toEqual([]);
  });
});

describe('buildProcessEdges', () => {
  it('ne garde que les relations entre items placés', () => {
    const edges = buildProcessEdges([rel('r1', 'a', 'b'), rel('r2', 'a', 'c')], new Set(['a', 'b']));
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 'a', target: 'b' });
  });

  it('ignore un type non officiel', () => {
    expect(buildProcessEdges([rel('r1', 'a', 'b', 'foo')], new Set(['a', 'b']))).toEqual([]);
  });

  it('colore selon le type', () => {
    const [edge] = buildProcessEdges([rel('r1', 'a', 'b', 'blocks')], new Set(['a', 'b']));
    expect(edge.style?.stroke).toBe(getRelationMeta('blocks').hex);
    expect((edge.data as { relationId: string }).relationId).toBe('r1');
  });
});

describe('layoutAsProcess', () => {
  const at = (id: string, x: number, y: number) => ({ item: item(id), x, y });
  const pos = (result: { itemId: string; x: number; y: number }[], id: string) => result.find((p) => p.itemId === id);

  it('range une chaîne « bloque » de gauche à droite', () => {
    const result = layoutAsProcess([at('a', 500, 500), at('b', 0, 0), at('c', 90, 40)], [rel('r1', 'a', 'b', 'blocks'), rel('r2', 'b', 'c', 'blocks')]);
    expect(pos(result, 'a')).toEqual({ itemId: 'a', x: 0, y: 0 });
    expect(pos(result, 'b')).toEqual({ itemId: 'b', x: PROCESS_COLUMN_GAP, y: 0 });
    expect(pos(result, 'c')).toEqual({ itemId: 'c', x: 2 * PROCESS_COLUMN_GAP, y: 0 });
  });

  it('empile une même colonne en gardant l\'ordre vertical actuel', () => {
    const result = layoutAsProcess([at('a', 0, 300), at('b', 0, 10), at('c', 0, 0)], [rel('r1', 'a', 'c', 'implements'), rel('r2', 'b', 'c', 'blocks')]);
    expect(pos(result, 'b')).toEqual({ itemId: 'b', x: 0, y: 0 });
    expect(pos(result, 'a')).toEqual({ itemId: 'a', x: 0, y: PROCESS_ROW_GAP });
    expect(pos(result, 'c')).toEqual({ itemId: 'c', x: PROCESS_COLUMN_GAP, y: 0 });
  });

  it('« Lié à » et « Entraîne » n\'ordonnent pas', () => {
    const result = layoutAsProcess([at('a', 0, 0), at('b', 0, 50)], [rel('r1', 'a', 'b', 'relates'), rel('r2', 'a', 'b', 'drives')]);
    expect(result.map((p) => p.x)).toEqual([0, 0]);
  });
});

describe('filterUnplaced', () => {
  it('ignore casse et accents', () => {
    const items = [item('1', 'Réunion'), item('2', 'Budget')];
    expect(filterUnplaced(items, 'reu').map((i) => i.title)).toEqual(['Réunion']);
  });
});
