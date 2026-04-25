import { FastifyPluginAsync } from 'fastify';

export const adminPerfRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      if (!(request.user as any).isAdmin) {
        reply.status(403).send({ message: 'Accès réservé aux administrateurs' });
      }
    } catch {
      reply.status(401).send({ message: 'Non authentifié' });
    }
  });

  // GET /admin/perf — dernières requêtes enregistrées
  app.get<{
    Querystring: { slow?: string; heavy?: string; limit?: string }
  }>('/', async (request) => {
    const buffer: any[] = (app as any).perfBuffer ?? [];
    const { slow, heavy, limit } = request.query;

    let entries = [...buffer].reverse(); // plus récent en premier

    if (slow === 'true') entries = entries.filter(e => e.slow);
    if (heavy === 'true') entries = entries.filter(e => e.heavy);

    const max = Math.min(Number(limit ?? 200), 500);
    entries = entries.slice(0, max);

    // Statistiques globales
    const all = buffer;
    const totalRequests = all.length;
    const slowCount = all.filter(e => e.slow).length;
    const heavyCount = all.filter(e => e.heavy).length;
    const avgMs = totalRequests > 0
      ? Math.round(all.reduce((sum, e) => sum + e.ms, 0) / totalRequests)
      : 0;

    // Top 10 endpoints les plus lents (par durée moyenne)
    const byUrl = new Map<string, { count: number; totalMs: number; totalKb: number; slowCount: number; heavyCount: number }>();
    for (const e of all) {
      const key = `${e.method} ${e.url}`;
      if (!byUrl.has(key)) byUrl.set(key, { count: 0, totalMs: 0, totalKb: 0, slowCount: 0, heavyCount: 0 });
      const entry = byUrl.get(key)!;
      entry.count++;
      entry.totalMs += e.ms;
      entry.totalKb += e.kb;
      if (e.slow) entry.slowCount++;
      if (e.heavy) entry.heavyCount++;
    }

    const topSlow = [...byUrl.entries()]
      .map(([endpoint, s]) => ({
        endpoint,
        count: s.count,
        avgMs: Math.round(s.totalMs / s.count),
        avgKb: Math.round(s.totalKb / s.count),
        slowCount: s.slowCount,
        heavyCount: s.heavyCount,
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);

    return {
      stats: { totalRequests, slowCount, heavyCount, avgMs },
      topSlow,
      entries,
    };
  });

  // DELETE /admin/perf — vider le buffer
  app.delete('/', async () => {
    const buffer: any[] = (app as any).perfBuffer ?? [];
    buffer.splice(0, buffer.length);
    return { ok: true };
  });
};
