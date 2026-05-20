import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { MENU_REGISTRY } from '@spok/shared';
import type { MenuOverride } from '@spok/shared';

const OVERRIDES_KEY = 'menu_overrides';

const overrideSchema = z.object({
  key: z.string().min(1),
  visible: z.boolean(),
  access: z.enum(['public', 'user', 'admin']),
});

function applyOverrides(overrides: MenuOverride[]) {
  const map = new Map(overrides.map(o => [o.key, o]));
  return MENU_REGISTRY.map(item => {
    const o = map.get(item.key);
    return o ? { ...item, visible: o.visible, access: o.access } : item;
  });
}

async function getOverrides(fastify: any): Promise<MenuOverride[]> {
  const row = await fastify.prisma.appConfig.findUnique({ where: { key: OVERRIDES_KEY } });
  return (row?.value as MenuOverride[]) ?? [];
}

// Admin routes (auth required)
export const adminMenuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  fastify.get('/', async () => {
    const overrides = await getOverrides(fastify);
    return applyOverrides(overrides);
  });

  fastify.put<{ Body: unknown[] }>('/', async (request, reply) => {
    const result = z.array(overrideSchema).safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(`Invalid menu overrides: ${result.error.message}`);
    }
    await fastify.prisma.appConfig.upsert({
      where: { key: OVERRIDES_KEY },
      create: { key: OVERRIDES_KEY, value: result.data as any },
      update: { value: result.data as any },
    });
    return applyOverrides(result.data);
  });

  fastify.post('/reset', async () => {
    await fastify.prisma.appConfig.deleteMany({ where: { key: OVERRIDES_KEY } });
    return MENU_REGISTRY;
  });
};

// Public route (no auth)
export const publicMenuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const overrides = await getOverrides(fastify);
    return applyOverrides(overrides);
  });
};
