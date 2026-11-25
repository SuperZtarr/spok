/* TNR de la position de dépôt des arborescences (useTreeDropPosition) : zones tiers haut / milieu / tiers bas, et
 * position recalculée au mouvement du pointeur dans la même ligne (cause du signalement cmwqiehge00357iccoco9r4ut). */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { dropPositionAt, useTreeDropPosition } from './useTreeDropPosition';

describe('dropPositionAt', () => {
  const rect = { top: 100, height: 30 };
  it('tiers haut = avant, milieu = dedans, tiers bas = après', () => {
    expect(dropPositionAt(102, rect)).toBe('before');
    expect(dropPositionAt(115, rect)).toBe('nest');
    expect(dropPositionAt(128, rect)).toBe('after');
  });
  it('ligne absente ou sans hauteur = dedans', () => {
    expect(dropPositionAt(5, null)).toBe('nest');
    expect(dropPositionAt(5, { top: 0, height: 0 })).toBe('nest');
  });
});

describe('useTreeDropPosition', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('suit le pointeur dans la ligne survolée, sans changement de ligne', () => {
    const row = document.createElement('div');
    row.setAttribute('data-item-id', 'a');
    row.getBoundingClientRect = () => ({ top: 100, height: 30, bottom: 130, left: 0, right: 0, width: 0, x: 0, y: 100, toJSON: () => ({}) });
    document.body.appendChild(row);
    const { result } = renderHook(() => useTreeDropPosition('x', 'a', (id) => `[data-item-id="${id}"]`));
    const move = (y: number) => act(() => { window.dispatchEvent(Object.assign(new Event('pointermove'), { clientY: y })); });
    move(101);
    expect(result.current).toBe('before');
    move(115);
    expect(result.current).toBe('nest');
    move(129);
    expect(result.current).toBe('after');
  });

  it('sans glisser en cours : dedans', () => {
    const { result } = renderHook(() => useTreeDropPosition(null, 'a', (id) => `[data-item-id="${id}"]`));
    expect(result.current).toBe('nest');
  });
});
