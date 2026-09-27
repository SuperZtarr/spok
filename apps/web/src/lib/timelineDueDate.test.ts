/* Tests des helpers purs d'échéance du Gantt (clic droit / glisser du losange). */
import { describe, it, expect } from 'vitest';
import { dayAtLaneX, dueDateForDay } from './timelineDueDate';

const start = new Date(2026, 8, 1); // 1er sept 2026, minuit local

describe('dayAtLaneX', () => {
  it('renvoie le premier jour visible pour x dans la première colonne', () => {
    expect(dayAtLaneX(0, 40, start)).toEqual(new Date(2026, 8, 1));
    expect(dayAtLaneX(39.9, 40, start)).toEqual(new Date(2026, 8, 1));
  });

  it('avance d\'un jour par largeur de colonne', () => {
    expect(dayAtLaneX(40, 40, start)).toEqual(new Date(2026, 8, 2));
    expect(dayAtLaneX(410, 40, start)).toEqual(new Date(2026, 8, 11));
  });

  it('fonctionne en zoom large (colonnes de quelques px)', () => {
    expect(dayAtLaneX(95, 3, start)).toEqual(new Date(2026, 9, 2)); // floor(95/3)=31 jours
  });

  it('gère une position à gauche du début visible (drag hors cadre)', () => {
    expect(dayAtLaneX(-1, 40, start)).toEqual(new Date(2026, 7, 31));
  });

  it('reste à minuit local en traversant un changement d\'heure (fin oct.)', () => {
    const d = dayAtLaneX(60 * 40, 40, start); // +60 jours → 31 oct
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(9);
  });
});

describe('dueDateForDay', () => {
  it('sans échéance existante : midi local du jour choisi', () => {
    const iso = dueDateForDay(new Date(2026, 8, 15), null);
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 15, 12, 0]);
  });

  it('avec échéance existante : conserve son heure locale', () => {
    const existing = new Date(2026, 8, 3, 17, 45).toISOString();
    const d = new Date(dueDateForDay(new Date(2026, 8, 20), existing));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([20, 17, 45]);
  });

  it('renvoie une chaîne ISO', () => {
    expect(dueDateForDay(new Date(2026, 8, 15), null)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
