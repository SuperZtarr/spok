import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_VIEW_CONFIG, DEFAULT_VIEW_CATEGORIES } from '@spok/shared';
import type { ViewConfigItem, ViewCategoryConfig } from '@spok/shared';

const VIEW_CONFIG_KEY = 'views';
const VIEW_CATEGORIES_KEY = 'view_categories';

const viewConfigItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  icon: z.string(),
  category: z.enum(['dashboard', 'basic', 'planning', 'exploration']),
  order: z.number().int().min(0),
  visible: z.boolean(),
  access: z.enum(['public', 'user', 'admin']),
});

const viewCategorySchema = z.object({
  id: z.enum(['dashboard', 'basic', 'planning', 'exploration']),
  label: z.string().min(1),
  order: z.number().int().min(0),
});

export const adminConfigRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin auth
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/config/views — get view configuration
  fastify.get('/views', async () => {
    const config = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CONFIG_KEY } });
    const categories = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CATEGORIES_KEY } });

    return {
      views: (config?.value as unknown as ViewConfigItem[]) || DEFAULT_VIEW_CONFIG,
      categories: (categories?.value as unknown as ViewCategoryConfig[]) || DEFAULT_VIEW_CATEGORIES,
    };
  });

  // PUT /admin/config/views — update view configuration
  fastify.put<{ Body: { views: unknown[]; categories?: unknown[] } }>('/views', async (request, reply) => {
    const viewsResult = z.array(viewConfigItemSchema).safeParse(request.body.views);
    if (!viewsResult.success) {
      return reply.badRequest(`Invalid views config: ${viewsResult.error.message}`);
    }

    await fastify.prisma.appConfig.upsert({
      where: { key: VIEW_CONFIG_KEY },
      create: { key: VIEW_CONFIG_KEY, value: viewsResult.data as any },
      update: { value: viewsResult.data as any },
    });

    if (request.body.categories) {
      const catResult = z.array(viewCategorySchema).safeParse(request.body.categories);
      if (!catResult.success) {
        return reply.badRequest(`Invalid categories config: ${catResult.error.message}`);
      }
      await fastify.prisma.appConfig.upsert({
        where: { key: VIEW_CATEGORIES_KEY },
        create: { key: VIEW_CATEGORIES_KEY, value: catResult.data as any },
        update: { value: catResult.data as any },
      });
    }

    return { success: true };
  });

  // POST /admin/config/views/reset — reset to defaults
  fastify.post('/views/reset', async () => {
    await fastify.prisma.appConfig.deleteMany({
      where: { key: { in: [VIEW_CONFIG_KEY, VIEW_CATEGORIES_KEY] } },
    });
    return {
      views: DEFAULT_VIEW_CONFIG,
      categories: DEFAULT_VIEW_CATEGORIES,
    };
  });
};

// Public endpoint (no auth) for reading view config
export const publicConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/views', async () => {
    const config = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CONFIG_KEY } });
    const categories = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CATEGORIES_KEY } });

    return {
      views: (config?.value as unknown as ViewConfigItem[]) || DEFAULT_VIEW_CONFIG,
      categories: (categories?.value as unknown as ViewCategoryConfig[]) || DEFAULT_VIEW_CATEGORIES,
    };
  });
};
