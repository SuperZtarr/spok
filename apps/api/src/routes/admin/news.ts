/*
 * Publication des nouveautés : surcharges AppConfig 'news_overrides' des annonces écrites dans le code (éléments d'aide,
 * champ `changes`, datés à la MEP par scripts/stamp-help-dates.mjs). Le code reste la source des textes ; l'admin ne
 * décide que « masquée » et « date de publication ».
 * - GET /news/overrides (public) : les surcharges, lues par le web (help/announcements.ts) qui les applique au calcul
 *   des annonces — /news se lit sans connexion.
 * - PUT /admin/news/overrides : remplace TOUTES les surcharges ; une ligne sans effet (ni masquée ni datée) n'est pas
 *   gardée. Le serveur ne connaît pas la liste des annonces : un id inconnu est accepté et reste sans effet.
 * Écran : /admin/news (NewsAdminPage). Règle de gestion : apps/web/src/lib/businessRules.ts (news-publication).
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const OVERRIDES_KEY = 'news_overrides';

export interface NewsOverride {
  id: string;
  hidden?: boolean;
  /** Date de publication AAAA-MM-JJ qui remplace celle du code ; future = annonce programmée. */
  date?: string;
}

async function getOverrides(fastify: any): Promise<NewsOverride[]> {
  const row = await fastify.prisma.appConfig.findUnique({ where: { key: OVERRIDES_KEY } });
  return (row?.value as NewsOverride[]) ?? [];
}

export const publicNewsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/overrides', async () => getOverrides(fastify));
};

const overridesSchema = z.object({
  overrides: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_.-]{1,120}$/),
    hidden: z.boolean().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).max(1000),
});

export const adminNewsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // PUT /admin/news/overrides — remplace les surcharges (les lignes sans effet ne sont pas stockées)
  fastify.put('/overrides', async (request, reply) => {
    const parsed = overridesSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Surcharges de nouveautés invalides');
    const kept: NewsOverride[] = parsed.data.overrides
      .filter((o) => o.hidden || o.date)
      .map((o) => ({ id: o.id, ...(o.hidden ? { hidden: true } : {}), ...(o.date ? { date: o.date } : {}) }));
    await fastify.prisma.appConfig.upsert({
      where: { key: OVERRIDES_KEY },
      create: { key: OVERRIDES_KEY, value: kept as any },
      update: { value: kept as any },
    });
    return { overrides: kept };
  });
};
