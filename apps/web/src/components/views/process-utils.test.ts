/* TNR de la logique pure de la vue Process : placés / non placés, arêtes des relations, recherche du panneau. */
import { describe, it, expect } from 'vitest';
import type { Item, ItemRelation } from '@spok/shared';
import {
  splitPlaced, buildProcessEdges, filterUnplaced, layoutAsProcess, computeLaneLayout, findLaneAt, assignEdgeChannels,
  PROCESS_NODE_WIDTH,
  PROCESS_COLUMN_GAP, PROCESS_ROW_GAP, LANE_MIN_HEIGHT, LANE_GAP, LANE_PADDING, LANE_CONTENT_X, PROCESS_NODE_HEIGHT,
  LANE_COLLAPSED_HEIGHT, LANE_COLLAPSED_WIDTH,
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

  it('garde une relation vers ou depuis un item devenu couloir, reliée au couloir (sous-processus)', () => {
    const laneNodes = new Map([['p1', 'lane-L1']]);
    const edges = buildProcessEdges([rel('r1', 'a', 'p1', 'blocks'), rel('r2', 'p1', 'b', 'blocks'), rel('r3', 'z', 'p1')], new Set(['a', 'b']), laneNodes);
    expect(edges.map((e) => [e.source, e.target])).toEqual([['a', 'lane-L1'], ['lane-L1', 'b']]);
    expect((edges[0].data as { relationId: string }).relationId).toBe('r1');
    // la modale d'édition doit recevoir les vrais items, pas le nœud du couloir
    expect(edges[0].data).toMatchObject({ fromItemId: 'a', toItemId: 'p1' });
  });

  it('couloir replié : liens de ses items rattachés au couloir, liens internes masqués', () => {
    // m1, m2 dans le couloir replié L1 ; a et b dehors
    const overrides = new Map([['m1', 'lane-L1'], ['m2', 'lane-L1']]);
    const edges = buildProcessEdges(
      [rel('r1', 'a', 'm1', 'blocks'), rel('r2', 'm1', 'm2', 'blocks'), rel('r3', 'm2', 'b', 'blocks')],
      new Set(['a', 'b', 'm1', 'm2']), overrides,
    );
    expect(edges.map((e) => [e.source, e.target])).toEqual([['a', 'lane-L1'], ['lane-L1', 'b']]);
  });

  it('commentaire : arête « relation » avec icône (pas de texte sur la flèche), titres pour l\'infobulle', () => {
    const titles = new Map([['a', 'Maquette'], ['b', 'Dév']]);
    const [edge] = buildProcessEdges([{ ...rel('r1', 'a', 'b', 'blocks'), label: 'Après validation' }], new Set(['a', 'b']), new Map(), (id) => titles.get(id) ?? '');
    expect(edge.type).toBe('relation');
    expect(edge.label).toBeUndefined();
    expect(edge.data).toMatchObject({ label: 'Après validation', fromTitle: 'Maquette', toTitle: 'Dév' });
    // tracé à angles droits (lisibilité des couloirs), pas les courbes de la MindMap
    expect(edge.data).toMatchObject({ pathStyle: 'smoothstep' });
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

  it('un couloir replié prend la hauteur réduite, quels que soient ses items', () => {
    const layout = computeLaneLayout(lanes, [{ x: LANE_CONTENT_X, y: 400, laneId: 'L1' }], new Set(['L1']));
    expect(layout.lanes[0]).toMatchObject({ id: 'L1', y: 0, height: LANE_COLLAPSED_HEIGHT, collapsed: true });
    expect(layout.lanes[1].y).toBe(LANE_COLLAPSED_HEIGHT + LANE_GAP);
  });

  it('un couloir replié est aussi réduit en longueur ; les autres gardent la largeur commune', () => {
    const layout = computeLaneLayout(lanes, [], new Set(['L1']));
    expect(layout.lanes[0].width).toBe(LANE_COLLAPSED_WIDTH);
    expect(layout.lanes[1].width).toBe(layout.width);
    // un point à droite de la boîte repliée, à sa hauteur, n'est dans aucun couloir
    expect(findLaneAt(layout, { x: LANE_COLLAPSED_WIDTH + 50, y: 10 })).toBeNull();
  });

  it('un couloir déplacé garde sa position ; les autres restent empilés sans lui', () => {
    const moved = [{ id: 'L1', itemId: 'p1', position: 0, x: 400, y: 900 }, { id: 'L2', itemId: 'p2', position: 1, x: null, y: null }];
    const layout = computeLaneLayout(moved, []);
    expect(layout.lanes.find((l) => l.id === 'L1')).toMatchObject({ x: 400, y: 900 });
    expect(layout.lanes.find((l) => l.id === 'L2')).toMatchObject({ x: 0, y: 0 });
    // l'appartenance tient compte du décalage horizontal
    expect(findLaneAt(layout, { x: 450, y: 920 })).toBe('L1');
    expect(findLaneAt(layout, { x: 350, y: 920 })).toBeNull();
  });

  it('Réorganiser range comme si les couloirs étaient remis dans la pile', () => {
    const moved = [{ id: 'L1', itemId: 'p1', position: 0, x: 400, y: 900 }];
    const result = layoutAsProcess([{ item: item('a'), x: 0, y: 0, laneId: 'L1' }, { item: item('c'), x: 0, y: 0, laneId: null }], [], moved);
    const c = result.find((p) => p.itemId === 'c')!;
    // libres sous la pile (couloir remis à y = 0), pas sous la position déplacée
    expect(c.y).toBeLessThan(900);
    expect(c.y).toBeGreaterThanOrEqual(LANE_MIN_HEIGHT);
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

describe('assignEdgeChannels', () => {
  const box = (x: number, y: number) => ({ x, y, width: PROCESS_NODE_WIDTH, height: PROCESS_NODE_HEIGHT });
  const edge = (id: string, source: string, target: string) => ({ id, source, target, data: {} });

  it('chaque flèche tourne juste avant la colonne de sa cible, sur une voie qui lui est propre', () => {
    // a (col 0) → e (col 3) et c (col 1) → d (col 3, autre ligne) : même colonne cible
    const boxes = new Map([['a', box(0, 300)], ['c', box(260, 0)], ['e', box(780, 0)], ['d', box(780, 150)]]);
    const out = assignEdgeChannels([edge('1', 'a', 'e'), edge('2', 'c', 'd')], boxes);
    const xs = out.map((e) => (e.data as { centerX: number }).centerX);
    expect(new Set(xs).size).toBe(2); // voies distinctes
    for (const x of xs) {
      expect(x).toBeLessThan(780); // avant la cible
      expect(x).toBeGreaterThan(260 + PROCESS_NODE_WIDTH); // après la sortie de la source la plus proche
    }
  });

  it('ne traverse pas un item placé sur sa ligne : passe par une voie de contournement', () => {
    // s → t sur la même ligne, un item b entre les deux (cas « Overflow » du bas → item E)
    const boxes = new Map([['s', box(0, 0)], ['b', box(390, 0)], ['t', box(780, 0)]]);
    const [e] = assignEdgeChannels([edge('1', 's', 't')], boxes);
    const corridor = (e.data as { corridor?: { y: number } }).corridor;
    expect(corridor).toBeDefined();
    // la voie horizontale passe hors de la boîte de b (marge comprise)
    expect(corridor!.y < 0 || corridor!.y > PROCESS_NODE_HEIGHT).toBe(true);
  });

  it('deux contournements ne partagent pas la même voie horizontale', () => {
    const boxes = new Map([
      ['a', box(0, 0)], ['b1', box(390, 0)], ['e', box(780, 0)],
      ['a2', box(0, 70)], ['b2', box(390, 70)], ['e2', box(780, 70)],
    ]);
    const out = assignEdgeChannels([edge('1', 'a', 'e'), edge('2', 'a2', 'e2')], boxes);
    const ys = out.map((e) => (e.data as { corridor?: { y: number } }).corridor?.y);
    expect(ys.every((y) => y !== undefined)).toBe(true);
    expect(Math.abs(ys[0]! - ys[1]!)).toBeGreaterThanOrEqual(6);
  });

  it('un couloir (boîte englobante) n\'est pas un obstacle', () => {
    const boxes = new Map([['lane-L1', { x: 0, y: -20, width: 1200, height: 120 }], ['s', box(170, 0)], ['t', box(950, 0)]]);
    const [e] = assignEdgeChannels([edge('1', 's', 't')], boxes, (id) => !id.startsWith('lane-'));
    expect((e.data as { corridor?: unknown }).corridor).toBeUndefined();
    expect((e.data as { centerX?: number }).centerX).toBeDefined();
  });

  it('flèche vers l\'arrière : pas de voie imposée (tracé par défaut)', () => {
    const boxes = new Map([['a', box(520, 0)], ['b', box(0, 0)]]);
    const [e] = assignEdgeChannels([edge('1', 'a', 'b')], boxes);
    expect((e.data as { centerX?: number }).centerX).toBeUndefined();
  });
});

describe('filterUnplaced', () => {
  it('ignore casse et accents', () => {
    const items = [item('1', 'Réunion'), item('2', 'Budget')];
    expect(filterUnplaced(items, 'reu').map((i) => i.title)).toEqual(['Réunion']);
  });
});
