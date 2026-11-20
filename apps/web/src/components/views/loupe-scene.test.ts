/* Tests des calculs de la vue Loupe : liens locaux et distants, disposition, tailles des vignettes, absence de
   recouvrement, maintien dans le cadre, chemin parcouru. */
import { describe, it, expect } from 'vitest';
import type { ItemLink } from '../../lib/api';
import {
  MAX_ZOOMED_LINKS, SCALE_MAX, advanceTrail, buildIndex, buildLocalEdges, collectLocalLinks, computeScene,
  MARK_SIZE, MIN_READABLE_H, allocateRest, degrees, dims, edgeStrength, edgesFromLinks, restDims, restFormatFor, sceneDims, externalPosition, fitMap, fitView, levelOf, titleLinesFor, mergeLinks, orderedLinkedIds, relativeWeights, settlePositions, weightScore,
  worldPositions, type LoupeSourceItem, type Point, type RestShape, type SceneNode,
} from './loupe-scene';
import type { FaceContent } from '../../lib/itemFace';

const item = (id: string, extra: Partial<LoupeSourceItem> = {}): LoupeSourceItem => ({ id, title: id, type: 'TASK', ...extra });
const items = [
  item('root'),
  item('a', { parentId: 'root', relationsFrom: [{ type: 'blocks', toItemId: 'b' }, { type: 'relates', toItemId: 'hors-espace' }] }),
  item('b', { parentId: 'root', relationsTo: [{ type: 'blocks', fromItemId: 'a' }] }),
  item('c', { parentId: 'a' }),
];
const index = buildIndex(items);
const linked = (id: string) => ({ id, title: id, type: 'TASK', status: null, spaceId: 's2', spaceName: 'Autre' });

const FULL: RestShape = { scale: 1, shape: 'full' };

function overlap(a: SceneNode, b: SceneNode) {
  const [sa, sb] = [sceneDims(a), sceneDims(b)];
  return Math.abs(a.cx - b.cx) < (sa.w + sb.w) / 2 && Math.abs(a.cy - b.cy) < (sa.h + sb.h) / 2;
}

describe('liens', () => {
  it('collecte le parent, les enfants et les relations présentes dans l\'espace', () => {
    const links = collectLocalLinks(index, 'a', 's1', 'Espace');
    expect(links.map((l) => [l.kind, l.item.id])).toEqual([['parent', 'root'], ['child', 'c'], ['relation', 'b']]);
  });

  it('ignore une relation dont l\'autre bout est hors de l\'espace : seule l\'API peut en dire plus', () => {
    expect(collectLocalLinks(index, 'a', 's1').some((l) => l.item.id === 'hors-espace')).toBe(false);
  });

  it('item inconnu : aucun lien', () => {
    expect(collectLocalLinks(index, 'inconnu', 's1')).toEqual([]);
  });

  it('l\'API complète les liens locaux et fait foi sur un même lien', () => {
    const local: ItemLink[] = [{ kind: 'parent', item: { ...linked('root'), spaceName: '' } }];
    const remote: ItemLink[] = [{ kind: 'parent', item: { ...linked('root'), spaceName: 'Espace' } }, { kind: 'relation', direction: 'from', relationType: 'relates', item: linked('x') }];
    const merged = mergeLinks(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged[0].item.spaceName).toBe('Espace');
  });

  it('ordonne les liés : relations, parent, enfants, sans doublon', () => {
    const links: ItemLink[] = [
      { kind: 'child', item: linked('c') },
      { kind: 'parent', item: linked('p') },
      { kind: 'relation', direction: 'from', relationType: 'blocks', item: linked('r') },
      { kind: 'relation', direction: 'to', relationType: 'relates', item: linked('c') },
    ];
    expect(orderedLinkedIds(links)).toEqual(['r', 'c', 'p']);
  });

  it('traits locaux et distants ont les mêmes identifiants : pas de trait en double', () => {
    const local = buildLocalEdges(index).map((e) => e.id);
    const distant = edgesFromLinks('a', collectLocalLinks(index, 'a', 's1')).map((e) => e.id);
    expect(local).toEqual(expect.arrayContaining(distant));
    expect(local).toContain('r:a:b:blocks');
    expect(local.some((id) => id.includes('hors-espace'))).toBe(false);
  });
});

describe('disposition', () => {
  it('place chaque item de l\'espace, un enfant dont le parent est absent devenant une racine', () => {
    const orphan = buildIndex([item('seul', { parentId: 'absent' })]);
    expect(orphan.roots.map((r) => r.id)).toEqual(['seul']);
    expect([...worldPositions(index).keys()].sort()).toEqual(['a', 'b', 'c', 'root']);
  });

  it('un item d\'un autre espace s\'éloigne du centre au-delà de son item source', () => {
    const source = { x: 300, y: 0 };
    expect(Math.hypot(...Object.values(externalPosition(source, 0, 1)) as [number, number])).toBeGreaterThan(300);
    expect(externalPosition(source, 0, 3)).not.toEqual(externalPosition(source, 2, 3));
  });

  it('le cadrage fait tenir toute la carte', () => {
    const points: Point[] = [{ x: -1000, y: -500 }, { x: 1000, y: 500 }];
    const view = fitView(points, 800, 600);
    points.forEach((p) => {
      const sx = p.x * view.k + view.x;
      const sy = p.y * view.k + view.y;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(800);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sy).toBeLessThanOrEqual(600);
    });
  });

  it('carte très réduite : les vignettes minimales s\'écartent au lieu de se recouvrir', () => {
    const positions = new Map<string, Point>(Array.from({ length: 40 }, (_, i) => [`n${i}`, { x: 100 * Math.cos(i), y: 100 * Math.sin(i) }]));
    const settled = [...settlePositions(positions, 0.2).values()].map((p): SceneNode => ({ cx: p.x, cy: p.y, size: 'small', state: 'rest', rest: FULL }));
    expect(settled).toHaveLength(40);
    settled.forEach((a, i) => settled.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
  });

  it('vignettes agrandies ou réduites : l\'écartement tient compte de leur taille réelle', () => {
    const positions = new Map<string, Point>(Array.from({ length: 40 }, (_, i) => [`n${i}`, { x: 100 * Math.cos(i), y: 100 * Math.sin(i) }]));
    const shapes: RestShape[] = [{ scale: SCALE_MAX, shape: 'full' }, FULL, { scale: 0.6, shape: 'full' }, { scale: 1, shape: 'mark' }];
    const rest = new Map([...positions.keys()].map((id, i) => [id, shapes[i % 4]]));
    const settled = [...settlePositions(positions, 0.2, rest)].map(([id, p]): SceneNode => ({ cx: p.x, cy: p.y, size: 'small', state: 'rest', rest: rest.get(id)! }));
    settled.forEach((a, i) => settled.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
  });

  it('cadrage : les vignettes entières (forme comprise, écartées) tiennent dans le cadre, centrées', () => {
    const positions = new Map<string, Point>(Array.from({ length: 65 }, (_, i) => [`n${i}`, { x: 400 * Math.cos(i * 0.7) * (1 + (i % 5)), y: 260 * Math.sin(i * 0.7) * (1 + (i % 3)) }]));
    const [width, height] = [1198, 610];
    const rest = allocateRest(new Map([...positions.keys()].map((id, i) => [id, 1 + (i % 4) * 0.6])), width, height);
    const view = fitMap(positions, width, height, rest);
    const boxes = [...settlePositions(positions, view.k, rest, view.bias)].map(([id, p]) => ({ ...p, ...restDims(rest.get(id)) }));
    const [l, r] = [Math.min(...boxes.map((b) => b.x - b.w / 2)), Math.max(...boxes.map((b) => b.x + b.w / 2))];
    const [t, b] = [Math.min(...boxes.map((q) => q.y - q.h / 2)), Math.max(...boxes.map((q) => q.y + q.h / 2))];
    expect(view.x + l).toBeGreaterThanOrEqual(0);
    expect(view.x + r).toBeLessThanOrEqual(width);
    expect(view.y + t).toBeGreaterThanOrEqual(0);
    expect(view.y + b).toBeLessThanOrEqual(height);
    expect(view.x + (l + r) / 2).toBeCloseTo(width / 2);
  });

  describe('répartition de la place au repos (allocateRest)', () => {
    // Trois cadres : portable réduit, panneau mesuré chez Thomas (930×615), grand écran
    const FRAMES: Array<[number, number]> = [[760, 420], [930, 615], [1650, 800]];
    // Espace type « Développement Produit » : 3 très riches, 48 moyens (priorité, contenus), 14 sans poids
    const devSpace = new Map<string, number>(Array.from({ length: 65 }, (_, i) =>
      [`n${String(i).padStart(2, '0')}`, i < 3 ? 3 : i < 51 ? 1.4 + (i % 4) * 0.2 : 1] as [string, number]));
    const area = (rest: Map<string, RestShape>) =>
      [...rest.values()].reduce((sum, r) => { const { w, h } = restDims(r); return sum + (w + 8) * (h + 8); }, 0);

    it('petit espace : facteur d\'écran au plus haut, rapports de poids intacts', () => {
      const rest = allocateRest(new Map([['a', 3], ['b', 2], ['c', 1]]), 930, 615);
      expect(rest.get('a')!.scale / rest.get('c')!.scale).toBeCloseTo(3);
      expect(rest.get('c')!.scale).toBeGreaterThanOrEqual(1);
    });

    it.each(FRAMES)('cadre %i×%i : un seul facteur, rapports gardés, pastilles en bas du classement, surface dans le budget', (w, h) => {
      const rest = allocateRest(devSpace, w, h);
      const full = [...devSpace].filter(([id]) => rest.get(id)!.shape === 'full');
      const marks = [...devSpace].filter(([id]) => rest.get(id)!.shape === 'mark');
      // Un seul facteur : taille / poids identique pour toutes les vignettes
      const g = rest.get(full[0][0])!.scale / full[0][1];
      full.forEach(([id, weight]) => expect(rest.get(id)!.scale).toBeCloseTo(g * weight));
      // Les 3 plus riches restent des vignettes, 3 fois plus grandes qu'une vignette de poids 1 au même facteur
      ['n00', 'n01', 'n02'].forEach((id) => expect(rest.get(id)!.shape).toBe('full'));
      // Toute pastille pèse moins (ou autant) que toute vignette
      if (marks.length && full.length) expect(Math.max(...marks.map(([, s]) => s))).toBeLessThanOrEqual(Math.min(...full.map(([, s]) => s)));
      // Toute vignette reste lisible
      full.forEach(([id]) => expect(restDims(rest.get(id)).h).toBeGreaterThanOrEqual(MIN_READABLE_H));
      expect(area(rest)).toBeLessThanOrEqual(0.35 * w * h);
    });

    it('plus de place, plus grand : le facteur d\'écran croît avec le cadre', () => {
      const g = ([w, h]: [number, number]) => allocateRest(devSpace, w, h).get('n00')!.scale;
      expect(g(FRAMES[0])).toBeLessThan(g(FRAMES[1]));
      expect(g(FRAMES[1])).toBeLessThan(g(FRAMES[2]));
    });

    it('1000 éléments : toute pastille pèse moins que toute vignette', () => {
      const weights = new Map<string, number>(Array.from({ length: 1000 }, (_, i) => [`n${i}`, 1 + ((i * 7) % 11) / 5]));
      const rest = allocateRest(weights, 930, 615);
      const markWeights = [...weights].filter(([id]) => rest.get(id)!.shape === 'mark').map(([, s]) => s);
      const fullWeights = [...weights].filter(([id]) => rest.get(id)!.shape === 'full').map(([, s]) => s);
      if (markWeights.length && fullWeights.length) expect(Math.max(...markWeights)).toBeLessThanOrEqual(Math.min(...fullWeights));
      expect(restDims({ scale: 1, shape: 'mark' })).toEqual({ w: MARK_SIZE, h: MARK_SIZE });
    });
  });

  it('format carte quand la vignette au repos est assez haute', () => {
    expect(restFormatFor(dims('small', 1).h)).toBe('ligne');
    expect(restFormatFor(dims('small', SCALE_MAX).h)).toBe('carte');
  });

  it('traits : degré de chaque élément, plus épais et plus foncés vers les plus reliés', () => {
    const deg = degrees([
      { id: '1', from: 'a', to: 'b', kind: 'hierarchy' },
      { id: '2', from: 'a', to: 'c', kind: 'hierarchy' },
      { id: '3', from: 'a', to: 'd', kind: 'relation' },
    ]);
    expect(deg.get('a')).toBe(3);
    expect(deg.get('b')).toBe(1);
    const weak = edgeStrength(1, 1, 3);
    const strong = edgeStrength(3, 1, 3);
    expect(weak).toEqual({ width: 1, opacity: 0.3 });
    expect(strong.width).toBe(3);
    expect(strong.opacity).toBeCloseTo(0.85);
    expect(edgeStrength(1, 1, 1)).toEqual({ width: 1, opacity: 0.3 });
  });

  it('lignes de titre selon la hauteur du cadre', () => {
    expect(titleLinesFor(22)).toBe(1);
    expect(titleLinesFor(44)).toBe(2);
    expect(titleLinesFor(66)).toBe(3);
    expect(titleLinesFor(200)).toBe(3);
  });

  it('des vignettes déjà séparées ne bougent pas', () => {
    const positions = new Map<string, Point>([['a', { x: 0, y: 0 }], ['b', { x: 500, y: 300 }]]);
    expect(settlePositions(positions, 1).get('b')).toEqual({ x: 500, y: 300 });
  });
});

describe('scène', () => {
  const base = { offset: { x: 500, y: 400 }, width: 1000, height: 800 };

  it('sans item zoomé, tout est au repos', () => {
    const scene = computeScene({ ...base, positions: worldPositions(index), focusId: null, linkedIds: [] });
    expect([...scene.values()].every((n) => n.state === 'rest' && n.size === 'small')).toBe(true);
  });

  it('item zoomé : grand, ses liés intermédiaires, les autres estompés', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 200, y: 0 }], ['o', { x: -300, y: 200 }]]);
    const scene = computeScene({ ...base, positions, focusId: 'f', linkedIds: ['l'] });
    expect(scene.get('f')).toMatchObject({ size: 'big', state: 'focus' });
    expect(scene.get('l')).toMatchObject({ size: 'mid', state: 'linked' });
    expect(scene.get('o')).toMatchObject({ size: 'small', state: 'dim' });
  });

  it('les éléments ni zoomés ni liés restent exactement à leur place, même sous la vignette zoomée', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 250, y: 0 }], ['proche', { x: 20, y: 10 }], ['loin', { x: -300, y: 200 }]]);
    const rest = computeScene({ ...base, positions, focusId: null, linkedIds: [] });
    const scene = computeScene({ ...base, positions, focusId: 'f', linkedIds: ['l'] });
    (['proche', 'loin'] as const).forEach((id) => {
      expect(scene.get(id)).toMatchObject({ cx: rest.get(id)!.cx, cy: rest.get(id)!.cy, state: 'dim' });
    });
  });

  it('aperçu : l\'item survolé passe en taille intermédiaire, aucune autre vignette ne bouge', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 250, y: 0 }], ['o', { x: -300, y: 200 }], ['p', { x: -300, y: 230 }]]);
    const params = { ...base, positions, focusId: 'f', linkedIds: ['l'] };
    const without = computeScene(params);
    const scene = computeScene({ ...params, previewId: 'o' });
    expect(scene.get('o')).toMatchObject({ size: 'mid', state: 'preview' });
    (['f', 'l', 'p'] as const).forEach((id) => expect(scene.get(id)).toEqual(without.get(id)));
  });

  it('élément à miniature : vignettes agrandies plus hautes, zoomé et lié comme en aperçu', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 300, y: 0 }], ['o', { x: -300, y: 200 }]]);
    const tallIds = new Set(['f', 'l', 'o']);
    const scene = computeScene({ ...base, positions, focusId: 'f', linkedIds: ['l'], previewId: 'o', tallIds });
    expect(scene.get('f')?.size).toBe('bigTall');
    expect(scene.get('l')?.size).toBe('midTall');
    expect(scene.get('o')?.size).toBe('midTall');
    expect(levelOf('bigTall')).toBe('big');
    expect(levelOf('midTall')).toBe('mid');
    expect(levelOf('small')).toBe('small');
  });

  it('aperçu sur un lié déjà agrandi ou sur l\'item zoomé : rien ne change', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 250, y: 0 }]]);
    const params = { ...base, positions, focusId: 'f', linkedIds: ['l'] };
    expect(computeScene({ ...params, previewId: 'l' })).toEqual(computeScene(params));
    expect(computeScene({ ...params, previewId: 'f' })).toEqual(computeScene(params));
  });

  it('un item zoomé absent de la carte revient au repos, sans erreur', () => {
    const scene = computeScene({ ...base, positions: new Map([['a', { x: 0, y: 0 }]]), focusId: 'supprimé', linkedIds: [] });
    expect(scene.get('a')?.state).toBe('rest');
  });

  it('aucune vignette ne recouvre l\'item zoomé, et les liés ne se recouvrent pas entre eux', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }]]);
    const ids = Array.from({ length: 12 }, (_, i) => `l${i}`);
    ids.forEach((id, i) => positions.set(id, { x: 20 * Math.cos(i), y: 20 * Math.sin(i) }));
    const scene = computeScene({ ...base, positions, focusId: 'f', linkedIds: ids });
    const focus = scene.get('f')!;
    const nodes = ids.map((id) => scene.get(id)!);
    nodes.forEach((n) => expect(overlap(focus, n)).toBe(false));
    nodes.forEach((n, i) => nodes.slice(i + 1).forEach((m) => expect(overlap(n, m)).toBe(false)));
  });

  it('un lié hors du cadre y est ramené', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['loin', { x: 5000, y: 5000 }]]);
    const node = computeScene({ ...base, positions, focusId: 'f', linkedIds: ['loin'] }).get('loin')!;
    expect(node.cx).toBeLessThanOrEqual(1000);
    expect(node.cy).toBeLessThanOrEqual(800);
  });

  it('au-delà du plafond, les liés restants gardent leur petite taille mais restent mis en valeur', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }]]);
    const ids = Array.from({ length: MAX_ZOOMED_LINKS + 3 }, (_, i) => `l${i}`);
    ids.forEach((id, i) => positions.set(id, { x: 300 * Math.cos(i), y: 300 * Math.sin(i) }));
    const scene = computeScene({ ...base, positions, focusId: 'f', linkedIds: ids });
    expect(ids.filter((id) => scene.get(id)!.size === 'mid')).toHaveLength(MAX_ZOOMED_LINKS);
    expect(ids.every((id) => scene.get(id)!.state === 'linked')).toBe(true);
  });
});

describe('poids : score brut (weightScore) et poids relatif à l\'espace (relativeWeights)', () => {
  const contents = (n: number) => Array.from({ length: n }, () => ({}) as FaceContent);
  const relFrom = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'relates', toItemId: `t${i}` }));
  const relTo = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'relates', fromItemId: `f${i}` }));

  it('score brut sans plafond : contenus, enfants et relations (deux sens) comptent 1 chacun', () => {
    expect(weightScore(item('x'))).toBe(0);
    expect(weightScore(item('x', { contents: contents(4) }))).toBe(4);
    expect(weightScore(item('x', { relationsFrom: relFrom(2), relationsTo: relTo(2) }))).toBe(4);
    expect(weightScore(item('x', { contents: contents(1), relationsTo: relTo(1) }), 2)).toBe(4);
    expect(weightScore(item('x', { relationsFrom: relFrom(20) }))).toBe(20);
  });

  it('priorité − 1 (Basse 0 … Critique 3, rien si non renseignée) et éléments d\'un article', () => {
    expect(weightScore(item('x', { priority: null }))).toBe(0);
    expect(weightScore(item('x', { priority: 1 }))).toBe(0);
    expect(weightScore(item('x', { priority: 4 }))).toBe(3);
    expect(weightScore(item('a', { type: 'ARTICLE', articleBlockCount: 3, priority: 2 }))).toBe(4);
  });

  it('relatif à l\'espace : le plus haut ×3, le plus bas ×1, proportionnel entre les deux', () => {
    const w = relativeWeights(new Map([['image', 3], ['relation', 3], ['tres-relie', 22], ['vide', 2]]));
    expect(w.get('tres-relie')).toBe(SCALE_MAX);
    expect(w.get('vide')).toBe(1);
    expect(w.get('image')).toBeCloseTo(1 + 2 * (1 / 20));
    expect(w.get('image')).toBe(w.get('relation'));
  });

  it('un bonus partagé par tout l\'espace (même priorité) ne change rien aux écarts', () => {
    const sans = relativeWeights(new Map([['a', 0], ['b', 5], ['c', 10]]));
    const avec = relativeWeights(new Map([['a', 2], ['b', 7], ['c', 12]]));
    ['a', 'b', 'c'].forEach((id) => expect(avec.get(id)).toBeCloseTo(sans.get(id)!));
  });

  it('tous les scores égaux : ×1 pour tous', () => {
    expect([...relativeWeights(new Map([['a', 4], ['b', 4]])).values()]).toEqual([1, 1]);
  });

  it('seule la petite taille est agrandie : zoomé, lié à mi-taille et aperçu gardent leur taille fixe', () => {
    const positions = new Map<string, Point>([['f', { x: 0, y: 0 }], ['l', { x: 200, y: 0 }], ['o', { x: -300, y: 200 }], ['p', { x: 300, y: 300 }]]);
    const shape = (scale: number): RestShape => ({ scale, shape: 'full' });
    const rest = new Map([['f', shape(2)], ['l', shape(1.6)], ['o', { scale: 1, shape: 'mark' } as RestShape], ['p', shape(1.8)]]);
    const base = { offset: { x: 500, y: 400 }, width: 1000, height: 800, positions, rest };
    expect(computeScene({ ...base, focusId: null, linkedIds: [] }).get('f')!.rest).toEqual(shape(2));
    const scene = computeScene({ ...base, focusId: 'f', linkedIds: ['l'], previewId: 'p' });
    expect(scene.get('f')!.rest).toEqual(FULL);
    expect(scene.get('l')!.rest).toEqual(FULL);
    expect(scene.get('p')!.rest).toEqual(FULL);
    expect(scene.get('o')!).toMatchObject({ size: 'small', state: 'dim', rest: { scale: 1, shape: 'mark' } });
  });
});

describe('chemin', () => {
  const entry = (id: string) => ({ id, title: id });

  it('ajoute une étape, et revenir sur une étape coupe la suite', () => {
    const trail = advanceTrail(advanceTrail(advanceTrail([], entry('a')), entry('b')), entry('c'));
    expect(trail.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(advanceTrail(trail, entry('b')).map((t) => t.id)).toEqual(['a', 'b']);
    expect(advanceTrail(trail, entry('c'))).toHaveLength(3);
  });
});
