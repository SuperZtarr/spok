/*
 * TNR du calcul de créneau libre (time-blocking /today) : journée vide, trous entre
 * blocs occupés, journée pleine, arrondi au quart d'heure.
 */
import { describe, it, expect } from 'vitest';
import { findFreeSlot, snapTo15 } from './timeblock';

const DAY = { start: new Date('2026-07-15T07:00:00Z'), end: new Date('2026-07-15T20:00:00Z') };
const busy = (s: string, e: string) => ({ start: new Date(s), end: new Date(e) });

describe('snapTo15', () => {
  it("arrondit au quart d'heure inférieur", () => {
    expect(snapTo15(new Date('2026-07-15T09:07:00Z')).toISOString()).toBe('2026-07-15T09:00:00.000Z');
    expect(snapTo15(new Date('2026-07-15T09:53:00Z')).toISOString()).toBe('2026-07-15T09:45:00.000Z');
  });
});

describe('findFreeSlot', () => {
  it('journée vide → à partir de "maintenant" arrondi au quart d\'heure supérieur', () => {
    const slot = findFreeSlot([], 30, new Date('2026-07-15T09:07:00Z'), DAY.start, DAY.end);
    expect(slot?.toISOString()).toBe('2026-07-15T09:15:00.000Z');
  });

  it('saute les blocs occupés et les trous trop courts', () => {
    const slot = findFreeSlot(
      [busy('2026-07-15T09:00:00Z', '2026-07-15T10:00:00Z'), busy('2026-07-15T10:15:00Z', '2026-07-15T11:00:00Z')],
      30, new Date('2026-07-15T09:00:00Z'), DAY.start, DAY.end,
    );
    expect(slot?.toISOString()).toBe('2026-07-15T11:00:00.000Z'); // le trou 10:00-10:15 est trop court
  });

  it('"maintenant" avant l\'ouverture → premier créneau du jour', () => {
    const slot = findFreeSlot([], 30, new Date('2026-07-15T05:00:00Z'), DAY.start, DAY.end);
    expect(slot?.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });

  it('journée pleine → null', () => {
    const slot = findFreeSlot([busy('2026-07-15T07:00:00Z', '2026-07-15T20:00:00Z')], 30, new Date('2026-07-15T08:00:00Z'), DAY.start, DAY.end);
    expect(slot).toBeNull();
  });
});
