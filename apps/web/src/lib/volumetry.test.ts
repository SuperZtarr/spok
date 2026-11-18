/* Cohérence du registre de volumétrie (VOLUMETRY_WATCHED_TABLES, @spok/shared, 2026-11-18) : tables uniques, seuils
   positifs, chaque page de purge déclarée dans MENU_REGISTRY, niveaux calculés (le plus grave des deux seuils) et texte
   des seuils généré depuis le registre. */
import { describe, it, expect } from 'vitest';
import {
  VOLUMETRY_WATCHED_TABLES, VOLUMETRY_DATABASE_MAX_MB, MENU_REGISTRY, volumetryLevel, describeVolumetryThresholds,
  findWatchedTable,
} from '@spok/shared';

describe('VOLUMETRY_WATCHED_TABLES', () => {
  it('tables et libellés uniques, seuils positifs', () => {
    const tables = VOLUMETRY_WATCHED_TABLES.map((t) => t.table);
    expect(new Set(tables).size).toBe(tables.length);
    expect(new Set(VOLUMETRY_WATCHED_TABLES.map((t) => t.label)).size).toBe(tables.length);
    for (const t of VOLUMETRY_WATCHED_TABLES) {
      expect(t.maxRows).toBeGreaterThan(0);
      expect(t.maxMB).toBeGreaterThan(0);
    }
    expect(VOLUMETRY_DATABASE_MAX_MB).toBeGreaterThan(0);
  });

  it('chaque page de purge est une page admin du menu', () => {
    const routes = new Set(MENU_REGISTRY.filter((m) => m.access === 'admin').map((m) => m.route));
    for (const t of VOLUMETRY_WATCHED_TABLES) {
      if (t.purgeRoute) expect(routes.has(t.purgeRoute)).toBe(true);
    }
    expect(routes.has('/admin/volumetry')).toBe(true);
  });

  it('niveau : le plus grave des deux seuils', () => {
    expect(volumetryLevel(10, 1, 100, 100)).toBe('ok');
    expect(volumetryLevel(85, 1, 100, 100)).toBe('warning');
    expect(volumetryLevel(10, 120, 100, 100)).toBe('exceeded');
    expect(volumetryLevel(100, 1, 100, 100)).toBe('exceeded');
    expect(volumetryLevel(999, 999, null, null)).toBe('unwatched');
  });

  it('texte des seuils généré depuis le registre', () => {
    const text = describeVolumetryThresholds();
    for (const t of VOLUMETRY_WATCHED_TABLES) expect(text).toContain(t.label);
    expect(findWatchedTable('audit_logs')?.purgeRoute).toBe('/admin/audit-logs');
    expect(findWatchedTable('inconnue')).toBeUndefined();
  });
});
