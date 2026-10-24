/* Tests de l'arbre du sélecteur d'éléments d'un article (articleBrowserTree.ts). */
import { describe, it, expect } from 'vitest';
import type { ArticleBrowseItem } from '@spok/shared';
import { buildBrowserRows, orderSelection } from './articleBrowserTree';

const it_ = (id: string, parentId: string | null, position: number, type = 'NOTE'): ArticleBrowseItem => ({
  id, type: type as ArticleBrowseItem['type'], title: id.toUpperCase(), status: null, statusLabel: null, parentId, position,
});
// A > (B > D), C ; E dont le parent n'est pas chargé
const items = [it_('C', null, 1), it_('B', 'A', 0, 'IMAGE'), it_('A', null, 0), it_('D', 'B', 0), it_('E', 'absent', 2, 'IMAGE')];

describe('buildBrowserRows', () => {
  it('replié : racines seulement, parent absent → racine', () => {
    const rows = buildBrowserRows(items, new Set(), new Set());
    expect(rows.map((r) => r.item.id)).toEqual(['A', 'C', 'E']);
    expect(rows.find((r) => r.item.id === 'A')!.hasChildren).toBe(true);
    expect(rows.find((r) => r.item.id === 'C')!.hasChildren).toBe(false);
  });

  it('déplié : enfants sous leur parent avec profondeur', () => {
    const rows = buildBrowserRows(items, new Set(['A']), new Set());
    expect(rows.map((r) => [r.item.id, r.depth])).toEqual([['A', 0], ['B', 1], ['C', 0], ['E', 0]]);
    const all = buildBrowserRows(items, new Set(['A', 'B']), new Set());
    expect(all.map((r) => r.item.id)).toEqual(['A', 'B', 'D', 'C', 'E']);
  });

  it('filtre de type : liste à plat avec le titre du parent', () => {
    const rows = buildBrowserRows(items, new Set(), new Set(['IMAGE']));
    expect(rows.map((r) => [r.item.id, r.depth, r.parentTitle])).toEqual([['B', 0, 'A'], ['E', 0, null]]);
  });
});

describe('orderSelection', () => {
  it('ordre de l’arbre complet, puis ids hors liste dans l’ordre fourni', () => {
    expect(orderSelection(new Set(['C', 'B', 'X', 'D']), items, ['X'])).toEqual(['B', 'D', 'C', 'X']);
  });
});
