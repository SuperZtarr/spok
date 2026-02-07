import { FastifyPluginAsync } from 'fastify';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS } from '@spok/shared';

export const adminReferentielsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/referentiels - Summary of defaults + customized spaces
  fastify.get('/', async () => {
    const prisma = fastify.prisma;

    // Get spaces that have customized their referentiels
    const customModules = await prisma.spaceModule.findMany({
      where: { moduleKey: 'referentiels', enabled: true },
      include: {
        space: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    const totalSpaces = await prisma.space.count();

    const customizedSpaces = customModules.map((m) => {
      const config = m.config as Record<string, unknown> | null;
      const statuses = config?.statuses as unknown[] | undefined;
      const typeLabels = config?.typeLabels as Record<string, unknown> | undefined;

      return {
        id: m.space.id,
        name: m.space.name,
        type: m.space.type,
        customStatusCount: statuses ? statuses.length : 0,
        customTypeCount: typeLabels ? Object.keys(typeLabels).length : 0,
      };
    });

    return {
      defaults: {
        statuses: DEFAULT_STATUSES,
        typeLabels: DEFAULT_TYPE_LABELS,
      },
      customizedSpaces,
      totalSpaces,
      customizedCount: customizedSpaces.length,
    };
  });
};
