/* TNR de mindmap-layout — withCurrentCallbacks (actions rafraîchies sans reconstruire la carte), radialLayout (étalement
 * régulier et borné, sans chevauchement), anchorToSaved (nœud sans position qui suit son parent figé). */
import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { ItemWithRelations } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { anchorToSaved, calculateLayout, radialLayout, withCurrentCallbacks, type MindMapCallbacks } from './mindmap-layout';
import { buildTree } from './mindmap-utils';

interface T { id: string; children: T[] }
const leaf = (id: string): T => ({ id, children: [] });
const parent = (id: string, count: number): T => ({ id, children: Array.from({ length: count }, (_, i) => leaf(`${id}-${i}`)) });
const dist = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
const layout = (roots: T[], arc = Math.PI) => radialLayout(roots, n => n.children, { x: 0, y: 0 }, 0, arc);

describe('radialLayout', () => {
  it('tous les nœuds d\'une même profondeur à la même distance : une grosse branche ne s\'éloigne pas plus que ses sœurs', () => {
    const pos = layout([leaf('a'), parent('b', 10), leaf('c')]);
    expect(dist(pos.get('a')!)).toBeCloseTo(dist(pos.get('b')!));
    expect(dist(pos.get('c')!)).toBeCloseTo(dist(pos.get('b')!));
    expect(dist(pos.get('b-0')!)).toBeCloseTo(2 * dist(pos.get('b')!));
  });

  it('une grosse branche reçoit plus d\'angle que ses sœurs, sans les écraser', () => {
    const pos = layout([leaf('a'), parent('b', 16), leaf('c')]);
    const angle = (id: string) => Math.atan2(pos.get(id)!.y, pos.get(id)!.x);
    expect(angle('b') - angle('a')).toBeGreaterThan(Math.PI / 4);
    expect(angle('c') - angle('b')).toBeGreaterThan(Math.PI / 4);
  });

  it('l\'intervalle reste borné, même avec une énorme branche', () => {
    const pos = layout([leaf('a'), parent('b', 900)], 0.5);
    expect(dist(pos.get('b')!)).toBeLessThanOrEqual(1200);
  });

  it('nœud seul : dans la direction demandée', () => {
    const pos = radialLayout([leaf('a')], n => n.children, { x: 10, y: 10 }, 0, Math.PI);
    expect(pos.get('a')).toEqual({ x: 310, y: 10 });
  });

  it('disposition d\'une carte type : aucun nœud ne recouvre un autre', () => {
    const items: Partial<ItemWithRelations>[] = [];
    for (let r = 0; r < 5; r++) {
      items.push({ id: `r${r}`, title: 'R', type: 'NOTE', parentId: null });
      for (let c = 0; c < 5; c++) {
        items.push({ id: `r${r}c${c}`, title: 'C', type: 'NOTE', parentId: `r${r}` });
        for (let g = 0; g < 3; g++) items.push({ id: `r${r}c${c}g${g}`, title: 'G', type: 'NOTE', parentId: `r${r}c${c}` });
      }
    }
    const typed = items as ItemWithRelations[];
    const { nodes } = calculateLayout(buildTree(typed), typed, DEFAULT_REFERENTIELS.statuses, new Set(), 'E', typed.length, makeCallbacks(noop), { hasPortalSupport: false, statusOptions: [] });
    const placed = nodes.filter(n => n.type === 'mindmap');
    expect(placed).toHaveLength(typed.length);
    const overlaps = placed.flatMap((a, i) => placed.slice(i + 1).filter(b =>
      Math.abs(a.position.x - b.position.x) < 150 && Math.abs(a.position.y - b.position.y) < 40));
    expect(overlaps.length).toBe(0);
  });
});

describe('anchorToSaved', () => {
  const node = (id: string, x: number, y: number) => ({ id, position: { x, y }, data: {} }) as Node;
  const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target }) as Edge;
  const pos = (nodes: Node[], id: string) => nodes.find(n => n.id === id)!.position;

  it('une position enregistrée fait foi ; rien d\'enregistré : la position calculée', () => {
    const nodes = [node('a', 0, 0), node('b', 100, 0)];
    const out = anchorToSaved(nodes, [edge('a', 'b')], { b: { x: 7, y: 8 } });
    expect(pos(out, 'a')).toEqual({ x: 0, y: 0 });
    expect(pos(out, 'b')).toEqual({ x: 7, y: 8 });
  });

  it('un enfant sans position suit la translation de son parent figé', () => {
    const out = anchorToSaved([node('p', 100, 0), node('c', 200, 0)], [edge('p', 'c')], { p: { x: 500, y: 500 } });
    expect(pos(out, 'c')).toEqual({ x: 600, y: 500 });
  });

  it('une branche sans position suit aussi la rotation : elle reste tournée vers l\'extérieur', () => {
    // Calculé : g(0,0) → p(100,0) → c(200,0). Figé : p tourné d'un quart de tour autour de g, en (0,100)
    const out = anchorToSaved(
      [node('g', 0, 0), node('p', 100, 0), node('c', 200, 0), node('d', 300, 0)],
      [edge('g', 'p'), edge('p', 'c'), edge('c', 'd')],
      { p: { x: 0, y: 100 } },
    );
    expect(pos(out, 'c').x).toBeCloseTo(0);
    expect(pos(out, 'c').y).toBeCloseTo(200);
    expect(pos(out, 'd').x).toBeCloseTo(0);
    expect(pos(out, 'd').y).toBeCloseTo(300);
  });
});

const noop = () => {};
const makeCallbacks = (onDelete: (id: string) => void): MindMapCallbacks => ({
  onEdit: noop, onDelete, onUpdateStatus: noop, onAddChild: noop, onAddPortal: noop,
  onToggleCollapse: noop, onReorganizeChildren: noop,
});

describe('withCurrentCallbacks', () => {
  it('remplace une action périmée (bug : onDelete comptait les enfants sur une liste ancienne)', () => {
    const oldDelete = () => {};
    const newDelete = () => {};
    const data = { label: 'P', childCount: 3, onDelete: oldDelete, onEdit: noop };
    const next = withCurrentCallbacks(data, makeCallbacks(newDelete));
    expect(next.onDelete).toBe(newDelete);
    expect(next.label).toBe('P');
    expect(next.childCount).toBe(3);
  });

  it("n'ajoute pas d'action absente des données (nœud portail, espace…)", () => {
    const data = { space: { id: 's' }, onRemove: noop };
    expect(withCurrentCallbacks(data, makeCallbacks(noop))).toBe(data);
  });

  it('renvoie le même objet si rien ne change (pas de rendu inutile)', () => {
    const cbs = makeCallbacks(noop);
    const data = { onDelete: cbs.onDelete, onEdit: cbs.onEdit };
    expect(withCurrentCallbacks(data, cbs)).toBe(data);
  });

  it('onTogglePin absent des callbacks : garde le repli existant', () => {
    const fallback = () => {};
    const data = { onTogglePin: fallback };
    expect(withCurrentCallbacks(data, makeCallbacks(noop))).toBe(data);
  });
});
