import { FastifyPluginAsync } from 'fastify';

export const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/stats?period=30d
  fastify.get('/', async (request) => {
    const prisma = fastify.prisma;
    const { period = '30d' } = request.query as { period?: string };

    // Calculate date range
    const now = new Date();
    let since: Date | null = null;
    switch (period) {
      case '7d':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        since = null;
        break;
      default:
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Totals (always global, not filtered by period)
    const [totalItems, totalContributions, totalUsers, totalSpaces] = await Promise.all([
      prisma.item.count(),
      prisma.contribution.count(),
      prisma.user.count(),
      prisma.space.count(),
    ]);

    const totals = {
      items: totalItems,
      contributions: totalContributions,
      users: totalUsers,
      spaces: totalSpaces,
    };

    // Time series: items created, items modified (via AuditLog), contributions
    const dateFilter = since
      ? `AND "createdAt" >= '${since.toISOString()}'`
      : '';
    const auditDateFilter = since
      ? `AND al."createdAt" >= '${since.toISOString()}'`
      : '';

    const [itemsCreatedSeries, contributionsSeries, itemsModifiedSeries] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM items
        WHERE 1=1 ${dateFilter}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `),
      prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM contributions
        WHERE 1=1 ${dateFilter}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `),
      prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(`
        SELECT DATE(al."createdAt") as date, COUNT(*) as count
        FROM audit_logs al
        WHERE al.action = 'UPDATE' AND al.entity = 'Item'
        ${auditDateFilter}
        GROUP BY DATE(al."createdAt")
        ORDER BY date
      `),
    ]);

    // Merge time series into a single array
    const dateMap = new Map<string, { itemsCreated: number; itemsModified: number; contributions: number }>();

    for (const row of itemsCreatedSeries) {
      const d = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(d)) dateMap.set(d, { itemsCreated: 0, itemsModified: 0, contributions: 0 });
      dateMap.get(d)!.itemsCreated = Number(row.count);
    }
    for (const row of contributionsSeries) {
      const d = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(d)) dateMap.set(d, { itemsCreated: 0, itemsModified: 0, contributions: 0 });
      dateMap.get(d)!.contributions = Number(row.count);
    }
    for (const row of itemsModifiedSeries) {
      const d = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(d)) dateMap.set(d, { itemsCreated: 0, itemsModified: 0, contributions: 0 });
      dateMap.get(d)!.itemsModified = Number(row.count);
    }

    // Fill in missing dates if period is bounded
    if (since) {
      const current = new Date(since);
      while (current <= now) {
        const d = current.toISOString().split('T')[0];
        if (!dateMap.has(d)) dateMap.set(d, { itemsCreated: 0, itemsModified: 0, contributions: 0 });
        current.setDate(current.getDate() + 1);
      }
    }

    const timeSeries = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // By type
    const byTypeRaw = await prisma.item.groupBy({
      by: ['type'],
      _count: true,
    });
    const byType = byTypeRaw.map((row) => ({
      type: row.type,
      count: row._count,
    }));

    // Top 10 spaces by activity (items + contributions)
    const topSpacesRaw = await prisma.$queryRaw<
      Array<{ spaceId: string; spaceName: string; itemCount: bigint; contributionCount: bigint }>
    >`
      SELECT
        s.id as "spaceId",
        s.name as "spaceName",
        (SELECT COUNT(*) FROM items i WHERE i."spaceId" = s.id) as "itemCount",
        (SELECT COUNT(*) FROM contributions c JOIN items i ON c."itemId" = i.id WHERE i."spaceId" = s.id) as "contributionCount"
      FROM spaces s
      ORDER BY (
        (SELECT COUNT(*) FROM items i WHERE i."spaceId" = s.id) +
        (SELECT COUNT(*) FROM contributions c JOIN items i ON c."itemId" = i.id WHERE i."spaceId" = s.id)
      ) DESC
      LIMIT 10
    `;

    const topSpaces = topSpacesRaw.map((row) => ({
      spaceId: row.spaceId,
      spaceName: row.spaceName,
      itemCount: Number(row.itemCount),
      contributionCount: Number(row.contributionCount),
    }));

    return { totals, timeSeries, byType, topSpaces };
  });
};
