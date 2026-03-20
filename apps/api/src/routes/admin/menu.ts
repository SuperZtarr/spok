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

  // GET /admin/menu — all menu items
  fastify.get('/', async () => {
    const items = await fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
    if (items.length === 0) {
      // Seed defaults on first access
      await seedDefaults(fastify);
      return fastify.prisma.menuItem.findMany({
        orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
      });
    }
    return items;
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
    await seedDefaults(fastify);
    return fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
  });
};

// Public route (no auth)
export const publicMenuRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /menu — all visible menu items
  fastify.get('/', async () => {
    let items = await fastify.prisma.menuItem.findMany({
      orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
    });
    if (items.length === 0) {
      await seedDefaults(fastify);
      items = await fastify.prisma.menuItem.findMany({
        orderBy: [{ sectionOrder: 'asc' }, { order: 'asc' }],
      });
    }
    return items;
  });
};

// Seed helper
async function seedDefaults(fastify: any) {
  for (const item of DEFAULT_MENU_ITEMS) {
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
  }
}
