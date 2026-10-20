/* TNR de la logique pure de la vue Process : placés / non placés, arêtes des relations, recherche du panneau. */
import { describe, it, expect } from 'vitest';
import type { Item, ItemRelation } from '@spok/shared';
import {
  splitPlaced, buildProcessEdges, filterUnplaced, layoutAsProcess, computeLaneLayout, findLaneAt,
  PROCESS_COLUMN_GAP, PROCESS_ROW_GAP, LANE_MIN_HEIGHT, LANE_GAP, LANE_PADDING, LANE_CONTENT_X, PROCESS_NODE_HEIGHT,
} from './process-utils';
import { getRelationMeta } from '../../constants/relationTypes';

const item = (id: string, title = id) => ({ id, title, type: 'NOTE' } as unknown as Item);
const rel = (id: string, fromItemId: string, toItemId: string, type = 'relates'): ItemRelation => ({ id, fromItemId, toItemId, type });

describe('splitPlaced', () => {
  it('sépare placés et non placés', () => {
    const [a, b, c] = [item('a'), item('b'), item('c')];
    const { placed, unplaced } = splitPlaced([a, b, c], [{ itemId: 'b', x: 1, y: 2 }]);
    expect(placed).toEqual([{ item: b, x: 1, y: 2, laneId: null }]);
    expect(unplaced).toEqual([a, c]);
  });

  it('exclut les items devenus titres de couloir', () => {
    const { placed, unplaced } = splitPlaced([item('a'), item('p1')], [], new Set(['p1']));
    expect(placed).toEqual([]);
    expect(unplaced.map((i) => i.id)).toEqual(['a']);
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
    // c se place à la hauteur moyenne de ses deux prédécesseurs (0 et 90)
    expect(pos(result, 'c')).toEqual({ itemId: 'c', x: PROCESS_COLUMN_GAP, y: PROCESS_ROW_GAP / 2 });
  });

  it('garde chaque branche sur sa ligne (pas de croisement)', () => {
    // a → b → c et a → d → e ; avant rangement, e est au-dessus de c alors que d est sous b
    const result = layoutAsProcess(
      [at('a', 0, 0), at('b', 0, 0), at('d', 0, 50), at('c', 0, 100), at('e', 0, -100)],
      [rel('r1', 'a', 'b', 'blocks'), rel('r2', 'a', 'd', 'blocks'), rel('r3', 'b', 'c', 'blocks'), rel('r4', 'd', 'e', 'blocks')],
    );
    expect(pos(result, 'c')!.y).toBe(pos(result, 'b')!.y);
    expect(pos(result, 'e')!.y).toBe(pos(result, 'd')!.y);
    expect(pos(result, 'd')!.y).toBeGreaterThan(pos(result, 'b')!.y);
  });

  it('« Lié à » et « Entraîne » n\'ordonnent pas', () => {
    const result = layoutAsProcess([at('a', 0, 0), at('b', 0, 50)], [rel('r1', 'a', 'b', 'relates'), rel('r2', 'a', 'b', 'drives')]);
    expect(result.map((p) => p.x)).toEqual([0, 0]);
  });
});

describe('couloirs', () => {
  const lanes = [{ id: 'L1', itemId: 'p1', position: 0 }, { id: 'L2', itemId: 'p2', position: 1 }];

  it('empile les couloirs, hauteur selon le membre le plus bas, hauteur minimale si vide', () => {
    const layout = computeLaneLayout(lanes, [{ x: LANE_CONTENT_X, y: 200, laneId: 'L1' }]);
    const h1 = 200 + PROCESS_NODE_HEIGHT + LANE_PADDING;
    expect(layout.lanes[0]).toMatchObject({ id: 'L1', y: 0, height: h1 });
    expect(layout.lanes[1]).toMatchObject({ id: 'L2', y: h1 + LANE_GAP, height: LANE_MIN_HEIGHT });
    expect(layout.bottom).toBe(h1 + LANE_GAP + LANE_MIN_HEIGHT);
  });

  it('trouve le couloir sous un point, null hors des bandes', () => {
    const layout = computeLaneLayout(lanes, []);
    expect(findLaneAt(layout, { x: 300, y: LANE_MIN_HEIGHT + LANE_GAP + 10 })).toBe('L2');
    expect(findLaneAt(layout, { x: 300, y: layout.bottom + 50 })).toBeNull();
    expect(findLaneAt(layout, { x: -20, y: 10 })).toBeNull();
  });

  it('Réorganiser : colonnes communes, chaque item garde son couloir, libres sous les couloirs', () => {
    const result = layoutAsProcess(
      [
        { item: item('a'), x: 500, y: 30, laneId: 'L1' },
        { item: item('b'), x: 10, y: 90, laneId: 'L2' },
        { item: item('c'), x: 0, y: 900, laneId: null },
      ],
      [rel('r1', 'a', 'b', 'blocks')],
      lanes,
    );
    const a = pos(result, 'a')!, b = pos(result, 'b')!, c = pos(result, 'c')!;
    expect(a).toMatchObject({ laneId: 'L1', x: LANE_CONTENT_X, y: LANE_PADDING });
    expect(b).toMatchObject({ laneId: 'L2', x: LANE_CONTENT_X + PROCESS_COLUMN_GAP, y: LANE_PADDING });
    expect(c.laneId).toBeNull();
    expect(c.x).toBe(LANE_CONTENT_X);
    const layout = computeLaneLayout(lanes, result);
    expect(c.y).toBeGreaterThanOrEqual(layout.bottom);
  });

  const pos = (result: { itemId: string }[], id: string) => result.find((p) => p.itemId === id) as any;
});

describe('filterUnplaced', () => {
  it('ignore casse et accents', () => {
    const items = [item('1', 'Réunion'), item('2', 'Budget')];
    expect(filterUnplaced(items, 'reu').map((i) => i.title)).toEqual(['Réunion']);
  });
});
