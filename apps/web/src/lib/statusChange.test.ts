/* Tests des règles de dates d'un changement de statut (lib/statusChange.ts), partagées par la fiche et le Kanban / menu ⋯. */
import { describe, it, expect } from 'vitest';
import type { StatusConfig } from '@spok/shared';
import { statusChangeFields, isUndefinedStatus } from './statusChange';

const NOW = new Date('2026-11-11T10:00:00.000Z');

describe('statusChangeFields', () => {
  it('« Non défini » efface le statut et les deux dates', () => {
    const current = { startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-05T00:00:00.000Z' };
    for (const s of ['', null, undefined, 'undefined']) {
      expect(statusChangeFields(s, current, undefined, NOW)).toEqual({ status: null, startDate: null, endDate: null });
    }
  });

  it('un statut terminé remplit la fin et le début vides', () => {
    expect(statusChangeFields('done', {}, undefined, NOW)).toEqual({ status: 'done', startDate: NOW.toISOString(), endDate: NOW.toISOString() });
  });

  it('ne remplace jamais une date existante', () => {
    const current = { startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-05T00:00:00.000Z' };
    expect(statusChangeFields('done', current, undefined, NOW)).toEqual({ status: 'done' });
  });

  it('début vide et fin passée : début = fin', () => {
    expect(statusChangeFields('in_progress', { endDate: '2026-11-05T00:00:00.000Z' }, undefined, NOW))
      .toEqual({ status: 'in_progress', startDate: '2026-11-05T00:00:00.000Z' });
  });

  it('un statut ouvert ne remplit pas la fin', () => {
    expect(statusChangeFields('todo', {}, undefined, NOW)).toEqual({ status: 'todo', startDate: NOW.toISOString() });
  });

  it('un statut personnalisé de catégorie Terminé ferme l’élément', () => {
    const statuses = [{ id: 'livre', label: 'Livré', category: 'done' }] as unknown as StatusConfig[];
    expect(statusChangeFields('livre', { startDate: '2026-11-01T00:00:00.000Z' }, statuses, NOW))
      .toEqual({ status: 'livre', endDate: NOW.toISOString() });
  });
});

describe('isUndefinedStatus', () => {
  it('reconnaît les trois formes de « Non défini »', () => {
    expect(isUndefinedStatus('')).toBe(true);
    expect(isUndefinedStatus(null)).toBe(true);
    expect(isUndefinedStatus('undefined')).toBe(true);
    expect(isUndefinedStatus('todo')).toBe(false);
  });
});
