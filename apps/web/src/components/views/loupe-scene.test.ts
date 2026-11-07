/* Tests des calculs de la vue Loupe : liens locaux et distants, disposition, tailles des vignettes, absence de
   recouvrement, maintien dans le cadre, chemin parcouru. */
import { describe, it, expect } from 'vitest';
import type { ItemLink } from '../../lib/api';
import {
  MAX_ZOOMED_LINKS, VIGNETTE_SIZES, advanceTrail, buildIndex, buildLocalEdges, collectLocalLinks, computeScene,
  edgesFromLinks, externalPosition, fitView, levelOf, mergeLinks, orderedLinkedIds, settlePositions, worldPositions,
  type LoupeSourceItem, type Point, type SceneNode,
} from './loupe-scene';

const item = (id: string, extra: Partial<LoupeSourceItem> = {}): LoupeSourceItem => ({ id, title: id, type: 'TASK', ...extra });
const items = [
  item('root'),
  item('a', { parentId: 'root', relationsFrom: [{ type: 'blocks', toItemId: 'b' }, { type: 'relates', toItemId: 'hors-espace' }] }),
  item('b', { parentId: 'root', relationsTo: [{ type: 'blocks', fromItemId: 'a' }] }),
  item('c', { parentId: 'a' }),
];
const index = buildIndex(items);
const linked = (id: string) => ({ id, title: id, type: 'TASK', status: null, spaceId: 's2', spaceName: 'Autre' });

function overlap(a: SceneNode, b: SceneNode) {
  const [sa, sb] = [VIGNETTE_SIZES[a.size], VIGNETTE_SIZES[b.size]];
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
    const settled = [...settlePositions(positions, 0.2).values()].map((p): SceneNode => ({ cx: p.x, cy: p.y, size: 'small', state: 'rest' }));
    expect(settled).toHaveLength(40);
    settled.forEach((a, i) => settled.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
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

describe('chemin', () => {
  const entry = (id: string) => ({ id, title: id });

  it('ajoute une étape, et revenir sur une étape coupe la suite', () => {
    const trail = advanceTrail(advanceTrail(advanceTrail([], entry('a')), entry('b')), entry('c'));
    expect(trail.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(advanceTrail(trail, entry('b')).map((t) => t.id)).toEqual(['a', 'b']);
    expect(advanceTrail(trail, entry('c'))).toHaveLength(3);
  });
});
