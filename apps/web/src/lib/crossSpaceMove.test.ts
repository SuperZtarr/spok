/* Tests de lib/crossSpaceMove.ts : branche déplacée et relations coupées par un dépôt entre espaces. */
import { describe, it, expect } from 'vitest';
import type { Item } from '@spok/shared';
import { branchIds, countCutRelations } from './crossSpaceMove';

const it_ = (id: string, parentId: string | null, rels: { id: string; from: string; to: string }[] = []) => ({
  id, parentId,
  relationsFrom: rels.map(r => ({ id: r.id, fromItemId: r.from, toItemId: r.to })),
}) as unknown as Item;

describe('crossSpaceMove', () => {
  it('branchIds : l\'élément et tous ses descendants', () => {
    const items = [it_('A', null), it_('B', 'A'), it_('C', 'B'), it_('D', null)];
    expect([...branchIds(items, 'A')].sort()).toEqual(['A', 'B', 'C']);
  });

  it('countCutRelations : seules les relations qui sortent de la branche comptent, une fois chacune', () => {
    const items = [
      it_('A', null, [{ id: 'r1', from: 'A', to: 'B' }, { id: 'r2', from: 'A', to: 'D' }]),
      it_('B', 'A'),
      it_('D', null, [{ id: 'r2', from: 'A', to: 'D' }]),
    ];
    expect(countCutRelations(items, branchIds(items, 'A'))).toBe(1);
  });

  it('countCutRelations : aucune relation → 0', () => {
    expect(countCutRelations([it_('A', null)], new Set(['A']))).toBe(0);
  });
});
