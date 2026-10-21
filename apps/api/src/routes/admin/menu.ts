/*
 * Menu : MENU_REGISTRY (code, @spok/shared) + surcharges AppConfig 'menu_overrides' (visible / access par clé).
 * Pas de table MenuItem — cf. skill spok-menu.
 * - GET /menu (public) : registre avec les surcharges appliquées — lu par useMenuItems (navigation globale, sélecteur
 *   de vues d'espace).
 * - GET /admin/menu : registre + défaut du code + valeur effective, pour l'écran /admin/views (ViewsConfigPage).
 * - PUT /admin/menu/overrides : remplace TOUTES les surcharges ; seules celles qui diffèrent du défaut du code sont
 *   gardées (une surcharge égale au défaut n'est pas stockée) ; clé inconnue ou section admin → 400.
 * La section 'admin' n'est pas surchargeable (entrées d'administration : toujours visibles en mode admin).
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { MENU_REGISTRY } from '@spok/shared';
import type { MenuOverride } from '@spok/shared';

const OVERRIDES_KEY = 'menu_overrides';

async function getOverrides(fastify: any): Promise<MenuOverride[]> {
  const row = await fastify.prisma.appConfig.findUnique({ where: { key: OVERRIDES_KEY } });
  return (row?.value as MenuOverride[]) ?? [];
}

export const publicMenuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const overrides = await getOverrides(fastify);
    const map = new Map(overrides.map(o => [o.key, o]));
    return MENU_REGISTRY.map(item => {
      const o = map.get(item.key);
      return o ? { ...item, visible: o.visible, access: o.access } : item;
    });
  });
};

const overridesSchema = z.object({
  overrides: z.array(z.object({
    key: z.string().min(1),
    visible: z.boolean(),
    access: z.enum(['public', 'user', 'admin']),
  })),
});

export const adminMenuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/menu — entrées surchargeables : défaut du code, valeur effective, surchargée ou non
  fastify.get('/', async () => {
    const map = new Map((await getOverrides(fastify)).map(o => [o.key, o]));
    return MENU_REGISTRY.filter(item => item.section !== 'admin').map(item => {
      const o = map.get(item.key);
      return {
        ...item,
        defaultVisible: item.visible,
        defaultAccess: item.access,
        visible: o ? o.visible : item.visible,
        access: o ? o.access : item.access,
        overridden: !!o,
      };
    });
  });

  // PUT /admin/menu/overrides — remplace les surcharges (seules les différences avec le code sont gardées)
  fastify.put('/overrides', async (request, reply) => {
    const parsed = overridesSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('overrides invalides');
    const registry = new Map(MENU_REGISTRY.map(item => [item.key, item]));
    for (const o of parsed.data.overrides) {
      const item = registry.get(o.key);
      if (!item) return reply.badRequest(`Entrée de menu inconnue : ${o.key}`);
      if (item.section === 'admin') return reply.badRequest(`Entrée d'administration non modifiable : ${o.key}`);
    }
    const kept = parsed.data.overrides.filter(o => {
      const item = registry.get(o.key)!;
      return o.visible !== item.visible || o.access !== item.access;
    });
    await fastify.prisma.appConfig.upsert({
      where: { key: OVERRIDES_KEY },
      create: { key: OVERRIDES_KEY, value: kept as any },
      update: { value: kept as any },
    });
    return { overrides: kept };
  });
};
