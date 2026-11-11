/*
 * Tests des catégories de statut (@spok/shared constants/statusCategory.ts) et de leur lecture côté API :
 * statut personnalisé de catégorie « terminé » qui ferme l'élément (statusDateDefaults), statuts des communautés
 * (statusesOfSpaces), statut posé par catégorie (firstStatusIn).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CLOSED_CATEGORIES, DEFAULT_STATUSES, firstStatusIn, isClosedStatus, statusCategory, statusIdsIn, withDefaultStatuses,
  type StatusConfig,
} from '@spok/shared';
import { statusDateDefaults } from './statusDates.js';
import { statusesOfSpaces } from './referentiels.js';

const archived: StatusConfig = { id: 'archive', label: 'Archivé', color: 'bg-gray-100 text-gray-800', borderColor: '', order: 20, visible: true, category: 'done' };
const custom: StatusConfig[] = [...DEFAULT_STATUSES, archived];

describe('catégories de statut', () => {
  it('statuts par défaut : sens attendu', () => {
    expect(statusCategory(null)).toBe('none');
    expect(statusCategory('undefined')).toBe('none');
    expect(statusCategory(firstStatusIn('open'))).toBe('open');
    expect(isClosedStatus(firstStatusIn('done'))).toBe(true);
    expect(isClosedStatus(firstStatusIn('cancelled'))).toBe(true);
    expect(isClosedStatus(firstStatusIn('active'))).toBe(false);
  });

  it('statut personnalisé : sa catégorie compte, inconnu = à faire', () => {
    expect(isClosedStatus('archive', custom)).toBe(true);
    expect(statusIdsIn(CLOSED_CATEGORIES, custom)).toContain('archive');
    expect(statusCategory('maison', custom)).toBe('open');
  });

  it('statut réservé : catégorie rétablie à la lecture', () => {
    const reserved = DEFAULT_STATUSES.find((s) => s.types?.length && s.category === 'done')!;
    const tampered = withDefaultStatuses([{ ...reserved, category: 'open' }]);
    expect(tampered.find((s) => s.id === reserved.id)?.category).toBe('done');
  });

  it('date de fin remplie pour un statut personnalisé terminé', () => {
    const now = new Date('2026-11-08T10:00:00Z');
    expect(statusDateDefaults('archive', { startDate: null, endDate: null }, now, custom).endDate).toEqual(now);
    expect(statusDateDefaults('archive', { startDate: null, endDate: null }, now).endDate).toBeUndefined();
  });

  it('statusesOfSpaces : statuts de la communauté, défauts sinon', async () => {
    const prisma = { space: { findMany: vi.fn().mockResolvedValue([
      { community: { referentiels: { statuses: [archived], typeLabels: {} } } },
      { community: null },
    ]) } };
    const list = await statusesOfSpaces(prisma as never, ['a', 'b']);
    expect(list.map((s) => s.id)).toContain('archive');
    expect(list.map((s) => s.id)).toContain(firstStatusIn('done'));
  });
});
