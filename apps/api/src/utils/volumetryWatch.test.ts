/* Volumétrie (utils/volumetryWatch.ts, 2026-11-18) : rapport (niveaux, tri, tables hors registre) et alertes (une par
   seuil dépassé et par admin, pas de deuxième alerte tant que la première n'est pas lue). Fonctions pures, sans base. */
import { describe, it, expect } from 'vitest';
import { buildVolumetryReport, alertsToSend, DATABASE_KEY, STORAGE_KEY } from './volumetryWatch.js';

const MB = 1024 * 1024;

describe('buildVolumetryReport', () => {
  const report = buildVolumetryReport({
    tables: [
      { table: 'users', rows: 10, sizeBytes: 50 * MB },
      { table: 'audit_logs', rows: 150_000, sizeBytes: 10 * MB },
      { table: 'notifications', rows: 85_000, sizeBytes: 1 * MB },
      { table: 'item_views', rows: 10, sizeBytes: 1 * MB },
    ],
    growth: { audit_logs: { last7d: 700, last30d: 3000 } },
    databaseBytes: 2000 * MB,
  });

  it('dépassées d\'abord, puis proches, normales, non surveillées', () => {
    expect(report.tables.map((t) => [t.table, t.level])).toEqual([
      ['audit_logs', 'exceeded'],
      ['notifications', 'warning'],
      ['item_views', 'ok'],
      ['users', 'unwatched'],
    ]);
  });

  it('libellé, croissance et purge viennent du registre', () => {
    const audit = report.tables[0];
    expect(audit.label).toBe('Historique des modifications');
    expect(audit.last7d).toBe(700);
    expect(audit.purgeRoute).toBe('/admin/audit-logs');
    expect(report.tables[3].label).toBe('users');
    expect(report.tables[3].last7d).toBeNull();
  });

  it('base entière au-delà de son seuil', () => {
    expect(report.database.level).toBe('exceeded');
  });

  it('alertes : une par seuil dépassé et par admin sans alerte non lue', () => {
    const alerts = alertsToSend(report, ['a1', 'a2'], { audit_logs: new Set(['a1']) });
    expect(alerts.map((a) => [a.table, a.userId])).toEqual([
      ['audit_logs', 'a2'],
      [DATABASE_KEY, 'a1'],
      [DATABASE_KEY, 'a2'],
    ]);
  });

  it('stockage de fichiers au-delà du seuil : une alerte par admin sans alerte non lue (2026-11-26)', () => {
    const storage = {
      measuredAt: '', active: { count: 10, sizeMB: 4000 }, trash: { count: 2, sizeMB: 2000 },
      maxMB: 5000, level: 'exceeded' as const, graceDays: 60,
    };
    const alerts = alertsToSend(report, ['a1', 'a2'], { audit_logs: new Set(['a1', 'a2']), [DATABASE_KEY]: new Set(['a1', 'a2']), [STORAGE_KEY]: new Set(['a1']) }, storage);
    expect(alerts.map((a) => [a.table, a.userId])).toEqual([[STORAGE_KEY, 'a2']]);
    expect(alerts[0].message).toContain('6000 Mo');
    expect(alertsToSend(report, ['a1'], { audit_logs: new Set(['a1']), [DATABASE_KEY]: new Set(['a1']) }, { ...storage, level: 'ok' })).toEqual([]);
  });
});
