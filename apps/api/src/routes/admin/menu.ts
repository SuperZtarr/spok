/*
 * Menu : GET public (MENU_REGISTRY + overrides AppConfig 'menu_overrides'), PATCH admin des
 * overrides (visible/access par clé). Pas de table MenuItem — cf. skill spok-menu.
 */
import { FastifyPluginAsync } from 'fastify';
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
