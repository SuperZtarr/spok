import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_MENU_ITEMS } from '@spok/shared';

const menuItemSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  section: z.string().min(1),
  sectionLabel: z.string().min(1),
  sectionOrder: z.number().int().min(0),
  route: z.string().nullable(),
  viewMode: z.string().nullable(),
  order: z.number().int().min(0),
  visible: z.boolean(),
  access: z.enum(['public', 'user', 'admin']),
});

// Admin routes (CRUD)
export const adminMenuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/menu — all menu items (auto-sync missing defaults)
  fastify.get('/', async () => {
    await syncDefaults(fastify);
    return fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
  });

  // PUT /admin/menu — bulk update all menu items
  fastify.put<{ Body: unknown[] }>('/', async (request, reply) => {
    const result = z.array(menuItemSchema).safeParse(request.body);
    if (!result.success) {
      return reply.badRequest(`Invalid menu config: ${result.error.message}`);
    }

    // Delete all and re-insert (transactional)
    await fastify.prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany();
      for (const item of result.data) {
        await tx.menuItem.create({
          data: {
            key: item.key,
            label: item.label,
            icon: item.icon,
            section: item.section,
            sectionLabel: item.sectionLabel,
            sectionOrder: item.sectionOrder,
            route: item.route,
            viewMode: item.viewMode,
            order: item.order,
            visible: item.visible,
            access: item.access,
          },
        });
      }
    });

    return { success: true };
  });

  // POST /admin/menu/reset — reset to defaults
  fastify.post('/reset', async () => {
    await fastify.prisma.menuItem.deleteMany();
    await syncDefaults(fastify);
    return fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
  });
};

// Public route (no auth)
export const publicMenuRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /menu — all visible menu items (auto-sync missing defaults)
  fastify.get('/', async () => {
    await syncDefaults(fastify);
    return fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
  });
};

// Sync helper — creates missing items and updates order/icon/section of existing ones
async function syncDefaults(fastify: any) {
  const existing = await fastify.prisma.menuItem.findMany({ select: { key: true, order: true, icon: true, sectionOrder: true } });
  const existingMap = new Map(existing.map((e: any) => [e.key, e]));

  for (const item of DEFAULT_MENU_ITEMS) {
    const current = existingMap.get(item.key);
    if (!current) {
      await fastify.prisma.menuItem.create({
        data: {
          key: item.key,
          label: item.label,
          icon: item.icon,
          section: item.section,
          sectionLabel: item.sectionLabel,
          sectionOrder: item.sectionOrder,
          route: item.route,
          viewMode: item.viewMode,
          order: item.order,
          visible: item.visible,
          access: item.access,
        },
      });
    } else if (current.order !== item.order || current.icon !== item.icon || current.sectionOrder !== item.sectionOrder) {
      await fastify.prisma.menuItem.update({
        where: { key: item.key },
        data: { order: item.order, icon: item.icon, sectionOrder: item.sectionOrder },
      });
    }
  }
}
