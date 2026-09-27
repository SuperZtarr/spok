/* Tests des utilitaires purs du Gantt — ici : fin de référence d'un déplacement de barre (moveInitialEnd). */
import { describe, it, expect } from 'vitest';
import { moveInitialEnd } from './timeline-utils';

const now = new Date(2026, 8, 28, 10, 0); // 28 sept 2026 10:00 local

describe('moveInitialEnd', () => {
  it('fin enregistrée : la reprend telle quelle', () => {
    const end = new Date(2026, 9, 5, 18, 0).toISOString();
    expect(moveInitialEnd({ startDate: new Date(2026, 8, 1).toISOString(), endDate: end, dueDate: null }, now)?.toISOString()).toBe(end);
  });

  it('début sans fin (barre dessinée jusqu\'à aujourd\'hui) : fin = maintenant — bug de la barre réduite à un jour', () => {
    const r = moveInitialEnd({ startDate: new Date(2026, 6, 12).toISOString(), endDate: null, dueDate: null }, now);
    expect(r?.getTime()).toBe(now.getTime());
  });

  it('début futur sans fin : fin = début (jamais avant le début)', () => {
    const start = new Date(2026, 10, 3, 9, 0);
    expect(moveInitialEnd({ startDate: start.toISOString(), endDate: null, dueDate: null }, now)?.getTime()).toBe(start.getTime());
  });

  it('échéance seule (sert de début affiché) : même règle', () => {
    expect(moveInitialEnd({ startDate: null, endDate: null, dueDate: new Date(2026, 5, 1).toISOString() }, now)?.getTime()).toBe(now.getTime());
  });

  it('aucune date : undefined (barre fantôme d\'un jour, comportement inchangé)', () => {
    expect(moveInitialEnd({ startDate: null, endDate: null, dueDate: null }, now)).toBeUndefined();
  });
});
