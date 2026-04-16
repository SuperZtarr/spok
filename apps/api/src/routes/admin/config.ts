import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_VIEW_CONFIG, DEFAULT_VIEW_CATEGORIES, DEFAULT_GLOBAL_PAGES, DEFAULT_GLOBAL_PAGE_GROUPS } from '@spok/shared';
import type { ViewConfigItem, ViewCategoryConfig, GlobalPageConfig, GlobalPageGroupConfig } from '@spok/shared';

const VIEW_CONFIG_KEY = 'views';
const VIEW_CATEGORIES_KEY = 'view_categories';
const GLOBAL_PAGES_KEY = 'global_pages';
const GLOBAL_PAGE_GROUPS_KEY = 'global_page_groups';

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

    const storedViews = config?.value as unknown as ViewConfigItem[] | undefined;
    // Merge: add any default views missing from stored config (new views added after initial setup)
    const views = storedViews
      ? [
          ...storedViews,
          ...DEFAULT_VIEW_CONFIG.filter(d => !storedViews.some(s => s.id === d.id)),
        ]
      : DEFAULT_VIEW_CONFIG;

    return {
      views,
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

  // ── Global pages ──

  const globalPageSchema = z.object({
    id: z.string(),
    label: z.string().min(1),
    icon: z.string(),
    group: z.enum(['global', 'myActivities']),
    order: z.number().int().min(0),
    visible: z.boolean(),
    access: z.enum(['public', 'user', 'admin']),
  });

  const globalPageGroupSchema = z.object({
    id: z.enum(['global', 'myActivities']),
    label: z.string().min(1),
    order: z.number().int().min(0),
  });

  // GET /admin/config/global-pages
  fastify.get('/global-pages', async () => {
    const pages = await fastify.prisma.appConfig.findUnique({ where: { key: GLOBAL_PAGES_KEY } });
    const groups = await fastify.prisma.appConfig.findUnique({ where: { key: GLOBAL_PAGE_GROUPS_KEY } });
    return {
      pages: (pages?.value as unknown as GlobalPageConfig[]) || DEFAULT_GLOBAL_PAGES,
      groups: (groups?.value as unknown as GlobalPageGroupConfig[]) || DEFAULT_GLOBAL_PAGE_GROUPS,
    };
  });

  // PUT /admin/config/global-pages
  fastify.put<{ Body: { pages: unknown[]; groups?: unknown[] } }>('/global-pages', async (request, reply) => {
    const pagesResult = z.array(globalPageSchema).safeParse(request.body.pages);
    if (!pagesResult.success) {
      return reply.badRequest(`Invalid global pages config: ${pagesResult.error.message}`);
    }
    await fastify.prisma.appConfig.upsert({
      where: { key: GLOBAL_PAGES_KEY },
      create: { key: GLOBAL_PAGES_KEY, value: pagesResult.data as any },
      update: { value: pagesResult.data as any },
    });
    if (request.body.groups) {
      const groupsResult = z.array(globalPageGroupSchema).safeParse(request.body.groups);
      if (!groupsResult.success) {
        return reply.badRequest(`Invalid groups config: ${groupsResult.error.message}`);
      }
      await fastify.prisma.appConfig.upsert({
        where: { key: GLOBAL_PAGE_GROUPS_KEY },
        create: { key: GLOBAL_PAGE_GROUPS_KEY, value: groupsResult.data as any },
        update: { value: groupsResult.data as any },
      });
    }
    return { success: true };
  });

  // POST /admin/config/global-pages/reset
  fastify.post('/global-pages/reset', async () => {
    await fastify.prisma.appConfig.deleteMany({
      where: { key: { in: [GLOBAL_PAGES_KEY, GLOBAL_PAGE_GROUPS_KEY] } },
    });
    return {
      pages: DEFAULT_GLOBAL_PAGES,
      groups: DEFAULT_GLOBAL_PAGE_GROUPS,
    };
  });
};

// Public endpoint (no auth) for reading view config
export const publicConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/views', async () => {
    const config = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CONFIG_KEY } });
    const categories = await fastify.prisma.appConfig.findUnique({ where: { key: VIEW_CATEGORIES_KEY } });

    const storedViews = config?.value as unknown as ViewConfigItem[] | undefined;
    const views = storedViews
      ? [
          ...storedViews,
          ...DEFAULT_VIEW_CONFIG.filter(d => !storedViews.some(s => s.id === d.id)),
        ]
      : DEFAULT_VIEW_CONFIG;

    return {
      views,
      categories: (categories?.value as unknown as ViewCategoryConfig[]) || DEFAULT_VIEW_CATEGORIES,
    };
  });

  fastify.get('/global-pages', async () => {
    const pages = await fastify.prisma.appConfig.findUnique({ where: { key: GLOBAL_PAGES_KEY } });
    const groups = await fastify.prisma.appConfig.findUnique({ where: { key: GLOBAL_PAGE_GROUPS_KEY } });
    return {
      pages: (pages?.value as unknown as GlobalPageConfig[]) || DEFAULT_GLOBAL_PAGES,
      groups: (groups?.value as unknown as GlobalPageGroupConfig[]) || DEFAULT_GLOBAL_PAGE_GROUPS,
    };
  });
};
