/* Tests de la comparaison Types / Statuts à choix multiple des vues en Aperçu (lib/itemHighlight). */
import { describe, expect, it } from 'vitest';
import { matchesCriteria, matchesStatus, matchesType } from './itemHighlight';

describe('matchesCriteria', () => {
  it('exige un type coché ET un statut coché', () => {
    expect(matchesCriteria(['TASK', 'BUG'], ['todo'], 'BUG', 'todo')).toBe(true);
    expect(matchesCriteria(['TASK', 'BUG'], ['todo'], 'BUG', 'done')).toBe(false);
    expect(matchesCriteria(['TASK', 'BUG'], ['todo'], 'NOTE', 'todo')).toBe(false);
  });

  it('ignore le critère qui n est pas posé', () => {
    expect(matchesCriteria(['TASK'], undefined, 'TASK', 'done')).toBe(true);
    expect(matchesCriteria(undefined, ['done'], 'TASK', 'done')).toBe(true);
  });

  it('ne met rien en évidence sans critère', () => {
    expect(matchesCriteria(undefined, undefined, 'TASK', 'done')).toBe(false);
  });
});

describe('matchesType', () => {
  it('reconnaît chacun des types cochés', () => {
    expect(matchesType(['TASK', 'BUG'], 'TASK')).toBe(true);
    expect(matchesType(['TASK', 'BUG'], 'BUG')).toBe(true);
    expect(matchesType(['TASK', 'BUG'], 'NOTE')).toBe(false);
  });

  it('ne correspond à rien sans critère ou sans type', () => {
    expect(matchesType(undefined, 'TASK')).toBe(false);
    expect(matchesType(['TASK'], null)).toBe(false);
  });
});

describe('matchesStatus', () => {
  it('reconnaît chacun des statuts cochés', () => {
    expect(matchesStatus(['todo', 'done'], 'done')).toBe(true);
    expect(matchesStatus(['todo', 'done'], 'in_progress')).toBe(false);
  });

  it("traite 'undefined' comme l'absence de statut, combinable avec un statut", () => {
    expect(matchesStatus(['undefined'], null)).toBe(true);
    expect(matchesStatus(['undefined'], '')).toBe(true);
    expect(matchesStatus(['undefined'], 'todo')).toBe(false);
    expect(matchesStatus(['undefined', 'todo'], 'todo')).toBe(true);
    expect(matchesStatus(['todo'], null)).toBe(false);
  });

  it('ne correspond à rien sans critère', () => {
    expect(matchesStatus(undefined, 'todo')).toBe(false);
    expect(matchesStatus(undefined, null)).toBe(false);
  });
});
