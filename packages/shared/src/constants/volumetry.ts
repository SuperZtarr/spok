/* Registre de la volumétrie surveillée (décision Thomas 2026-11-18, élément SPOK cmwlvqf5u000qgxbey2330zg4).
   Raison d'être : certaines tables (historique, notifications, consultations…) gonflent sans que personne ne le voie.
   Chaque entrée = une table PostgreSQL surveillée, avec ses seuils (lignes, Mo), sa colonne de date (croissance sur
   7 / 30 jours, null si la table n'en a pas) et la page admin où la purger à la main (null si aucune purge n'existe).
   Seule source des seuils : la page admin Volumétrie, la surveillance de l'API (utils/volumetryWatch.ts) et l'aide en
   dérivent. Pas de purge automatique : SPOK alerte les admins (notification AUDIT_ALERT), la purge reste manuelle.
   Les tables absentes du registre sont affichées sans seuil. */

export type VolumetryLevel = 'ok' | 'warning' | 'exceeded' | 'unwatched';

export interface VolumetryWatchedTable {
  /** Nom réel de la table PostgreSQL (@@map du schéma Prisma) */
  table: string;
  label: string;
  /** Seuil en nombre de lignes */
  maxRows: number;
  /** Seuil en taille totale (données + index), en Mo */
  maxMB: number;
  /** Colonne de date de création, pour la croissance ; null si la table n'en a pas */
  dateColumn: string | null;
  /** Page admin où purger à la main ; null si aucune purge n'existe */
  purgeRoute: string | null;
}

/** Une table mesurée (réponse de GET /admin/volumetry) */
export interface VolumetryEntry {
  table: string;
  label: string;
  rows: number;
  sizeMB: number;
  last7d: number | null;
  last30d: number | null;
  maxRows: number | null;
  maxMB: number | null;
  level: VolumetryLevel;
  purgeRoute: string | null;
}

/** Réponse de GET /admin/volumetry : tables dépassées d'abord, puis par taille */
export interface VolumetryReport {
  measuredAt: string;
  database: { sizeMB: number; maxMB: number; level: VolumetryLevel };
  tables: VolumetryEntry[];
}

export const VOLUMETRY_WATCHED_TABLES = [
  { table: 'audit_logs',     label: 'Historique des modifications', maxRows: 100_000, maxMB: 200, dateColumn: 'createdAt', purgeRoute: '/admin/audit-logs' },
  { table: 'notifications',  label: 'Notifications',                maxRows: 100_000, maxMB: 100, dateColumn: 'createdAt', purgeRoute: null },
  { table: 'item_views',     label: 'Consultations des éléments',   maxRows: 200_000, maxMB: 100, dateColumn: null,        purgeRoute: null },
  { table: 'contributions',  label: 'Contributions',                maxRows: 100_000, maxMB: 200, dateColumn: 'createdAt', purgeRoute: null },
  { table: 'item_contents',  label: 'Contenus des éléments',        maxRows: 50_000,  maxMB: 200, dateColumn: 'createdAt', purgeRoute: null },
  { table: 'items',          label: 'Éléments',                     maxRows: 100_000, maxMB: 500, dateColumn: 'createdAt', purgeRoute: null },
  { table: 'refresh_tokens', label: 'Jetons de connexion',          maxRows: 20_000,  maxMB: 20,  dateColumn: 'createdAt', purgeRoute: null },
] as const satisfies readonly VolumetryWatchedTable[];

/** Taille maximale de toute la base, en Mo */
export const VOLUMETRY_DATABASE_MAX_MB = 1_000;

/** Volume maximal des fichiers d'éléments stockés (actifs + corbeille, bucket R2), en Mo (2026-11-26) */
export const VOLUMETRY_STORAGE_MAX_MB = 5_000;

/** Part du seuil à partir de laquelle une table passe « proche du seuil » */
export const VOLUMETRY_WARNING_RATIO = 0.8;

/** Intervalle de la surveillance automatique côté API */
export const VOLUMETRY_WATCH_INTERVAL_HOURS = 6;

export const VOLUMETRY_LEVEL_LABELS: Record<VolumetryLevel, string> = {
  ok: 'Normal',
  warning: 'Proche du seuil',
  exceeded: 'Seuil dépassé',
  unwatched: 'Non surveillée',
};

export function findWatchedTable(table: string): VolumetryWatchedTable | undefined {
  return (VOLUMETRY_WATCHED_TABLES as readonly VolumetryWatchedTable[]).find((t) => t.table === table);
}

/** Niveau d'une mesure face à ses seuils : le plus grave des deux (lignes, taille) l'emporte. */
export function volumetryLevel(rows: number, sizeMB: number, maxRows: number | null, maxMB: number | null): VolumetryLevel {
  if (maxRows == null && maxMB == null) return 'unwatched';
  const ratios = [maxRows ? rows / maxRows : 0, maxMB ? sizeMB / maxMB : 0];
  const worst = Math.max(...ratios);
  if (worst >= 1) return 'exceeded';
  if (worst >= VOLUMETRY_WARNING_RATIO) return 'warning';
  return 'ok';
}

/** Texte de l'aide et des infobulles : les seuils, générés depuis le registre (jamais recopiés à la main). */
export function describeVolumetryThresholds(): string {
  const tables = VOLUMETRY_WATCHED_TABLES.map(
    (t) => `${t.label} : ${t.maxRows.toLocaleString('fr-FR')} lignes ou ${t.maxMB} Mo`,
  ).join(' ; ');
  return `${tables} ; base entière : ${VOLUMETRY_DATABASE_MAX_MB} Mo.`;
}
