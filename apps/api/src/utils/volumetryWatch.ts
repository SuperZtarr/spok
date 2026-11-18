/* Volumétrie des données (décision Thomas 2026-11-18, élément SPOK cmwlvqf5u000qgxbey2330zg4).
   Raison d'être : voir et signaler les tables qui gonflent (historique, notifications…) avant qu'elles ne pèsent.
   - measureVolumetry(prisma) : mesure toutes les tables (taille réelle sur disque, lignes, croissance 7/30 jours pour les
     tables du registre qui ont une date) et la taille de toute la base. Lue par GET /admin/volumetry.
   - startVolumetryWatch(prisma, log) : lancée au démarrage de l'API (index.ts), mesure 1 min après puis toutes les
     VOLUMETRY_WATCH_INTERVAL_HOURS heures ; pour chaque seuil dépassé, notifie (AUDIT_ALERT) les admins qui n'ont pas
     déjà une alerte non lue pour la même table (metadata.table). Jamais de purge : elle reste manuelle.
   Seuils : registre @spok/shared constants/volumetry.ts, jamais recopiés ici. Les noms de tables injectés dans le SQL
   viennent du registre (constantes) ou de pg_stat_user_tables, jamais d'une saisie. */
import type { PrismaClient } from '@spok/database';
import {
  VOLUMETRY_WATCHED_TABLES, VOLUMETRY_DATABASE_MAX_MB, VOLUMETRY_WATCH_INTERVAL_HOURS, findWatchedTable,
  volumetryLevel, type VolumetryLevel, type VolumetryEntry, type VolumetryReport,
} from '@spok/shared';

/** Pseudo-table de la base entière, dans le rapport et dans metadata.table des alertes */
export const DATABASE_KEY = '__database__';

export interface VolumetryRaw {
  tables: Array<{ table: string; rows: number; sizeBytes: number }>;
  growth: Record<string, { last7d: number; last30d: number }>;
  databaseBytes: number;
}

const LEVEL_ORDER: Record<VolumetryLevel, number> = { exceeded: 0, warning: 1, ok: 2, unwatched: 3 };
const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

/** Rapport à partir des mesures brutes : niveaux, tri (dépassées d'abord, puis par taille). Pur, testé. */
export function buildVolumetryReport(raw: VolumetryRaw, now = new Date()): VolumetryReport {
  const tables = raw.tables.map((t): VolumetryEntry => {
    const watched = findWatchedTable(t.table);
    const sizeMB = toMB(t.sizeBytes);
    const growth = raw.growth[t.table];
    return {
      table: t.table,
      label: watched?.label ?? t.table,
      rows: t.rows,
      sizeMB,
      last7d: growth?.last7d ?? null,
      last30d: growth?.last30d ?? null,
      maxRows: watched?.maxRows ?? null,
      maxMB: watched?.maxMB ?? null,
      level: volumetryLevel(t.rows, sizeMB, watched?.maxRows ?? null, watched?.maxMB ?? null),
      purgeRoute: watched?.purgeRoute ?? null,
    };
  });
  tables.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.sizeMB - a.sizeMB);
  const dbMB = toMB(raw.databaseBytes);
  return {
    measuredAt: now.toISOString(),
    database: { sizeMB: dbMB, maxMB: VOLUMETRY_DATABASE_MAX_MB, level: volumetryLevel(0, dbMB, null, VOLUMETRY_DATABASE_MAX_MB) },
    tables,
  };
}

export async function measureVolumetry(prisma: PrismaClient): Promise<VolumetryReport> {
  const stats = await prisma.$queryRawUnsafe<Array<{ table: string; rows: bigint; size: bigint }>>(`
    SELECT relname AS "table", n_live_tup AS rows, pg_total_relation_size(relid) AS size
    FROM pg_stat_user_tables WHERE schemaname = current_schema()
  `);
  const [{ size: dbSize }] = await prisma.$queryRawUnsafe<Array<{ size: bigint }>>(
    'SELECT pg_database_size(current_database()) AS size',
  );
  const present = new Set(stats.map((s) => s.table));
  const rows: Record<string, number> = {};
  const growth: VolumetryRaw['growth'] = {};
  // Tables du registre : compte exact (n_live_tup n'est qu'une estimation) et croissance si elles ont une date
  for (const t of VOLUMETRY_WATCHED_TABLES) {
    if (!present.has(t.table)) continue;
    if (t.dateColumn) {
      const [r] = await prisma.$queryRawUnsafe<Array<{ total: bigint; d7: bigint; d30: bigint }>>(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE "${t.dateColumn}" >= now() - interval '7 days') AS d7,
          COUNT(*) FILTER (WHERE "${t.dateColumn}" >= now() - interval '30 days') AS d30
        FROM "${t.table}"
      `);
      rows[t.table] = Number(r.total);
      growth[t.table] = { last7d: Number(r.d7), last30d: Number(r.d30) };
    } else {
      const [r] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(`SELECT COUNT(*) AS total FROM "${t.table}"`);
      rows[t.table] = Number(r.total);
    }
  }
  return buildVolumetryReport({
    tables: stats.map((s) => ({ table: s.table, rows: rows[s.table] ?? Number(s.rows), sizeBytes: Number(s.size) })),
    growth,
    databaseBytes: Number(dbSize),
  });
}

export interface VolumetryAlert { table: string; userId: string; title: string; message: string }

/** Alertes à créer : une par seuil dépassé et par admin sans alerte non lue pour cette table. Pur, testé. */
export function alertsToSend(
  report: VolumetryReport,
  adminIds: string[],
  unreadByTable: Record<string, Set<string>>,
): VolumetryAlert[] {
  const exceeded: Array<{ table: string; title: string; message: string }> = report.tables
    .filter((t) => t.level === 'exceeded')
    .map((t) => ({
      table: t.table,
      title: `Volumétrie : ${t.label}`,
      message: `${t.rows.toLocaleString('fr-FR')} lignes, ${t.sizeMB} Mo (seuil : ${t.maxRows?.toLocaleString('fr-FR')} lignes ou ${t.maxMB} Mo). Une purge est à envisager.`,
    }));
  if (report.database.level === 'exceeded') {
    exceeded.push({
      table: DATABASE_KEY,
      title: 'Volumétrie : base de données',
      message: `La base pèse ${report.database.sizeMB} Mo (seuil : ${report.database.maxMB} Mo).`,
    });
  }
  return exceeded.flatMap((e) =>
    adminIds.filter((id) => !unreadByTable[e.table]?.has(id)).map((userId) => ({ ...e, userId })),
  );
}

export async function runVolumetryWatch(prisma: PrismaClient): Promise<number> {
  const report = await measureVolumetry(prisma);
  const admins = await prisma.user.findMany({ where: { globalRole: 'ADMIN' }, select: { id: true } });
  const unread = await prisma.notification.findMany({
    where: { type: 'AUDIT_ALERT', read: false },
    select: { userId: true, metadata: true },
  });
  const unreadByTable: Record<string, Set<string>> = {};
  for (const n of unread) {
    const table = (n.metadata as { table?: string } | null)?.table;
    if (!table) continue;
    (unreadByTable[table] ??= new Set()).add(n.userId);
  }
  const alerts = alertsToSend(report, admins.map((a) => a.id), unreadByTable);
  if (alerts.length) {
    await prisma.notification.createMany({
      data: alerts.map((a) => ({
        userId: a.userId,
        type: 'AUDIT_ALERT' as const,
        title: a.title,
        message: a.message,
        link: '/admin/volumetry',
        metadata: { table: a.table },
      })),
    });
  }
  return alerts.length;
}

/** Surveillance périodique ; minuteurs non bloquants (unref) pour ne pas retenir l'arrêt du processus. */
export function startVolumetryWatch(prisma: PrismaClient, log: { error: (o: unknown, msg: string) => void }) {
  const tick = () => { runVolumetryWatch(prisma).catch((err) => log.error(err, 'Surveillance de la volumétrie en échec')); };
  const first = setTimeout(tick, 60_000);
  const every = setInterval(tick, VOLUMETRY_WATCH_INTERVAL_HOURS * 3600_000);
  first.unref();
  every.unref();
  return () => { clearTimeout(first); clearInterval(every); };
}
