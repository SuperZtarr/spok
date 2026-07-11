/* Vue d'ensemble admin des référentiels : défauts + communautés personnalisées (community.referentiels). */
import { FastifyPluginAsync } from 'fastify';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS } from '@spok/shared';

export const adminReferentielsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/referentiels - Summary of defaults + customized communities
  fastify.get('/', async () => {
    const prisma = fastify.prisma;

    // Get communities that have customized referentiels
    const communities = await prisma.community.findMany({
      where: { referentiels: { not: null } },
      select: {
        id: true,
        name: true,
        referentiels: true,
        _count: { select: { spaces: true } },
      },
    });

    const totalCommunities = await prisma.community.count();

    const customizedCommunities = communities.map((c) => {
      const config = c.referentiels as Record<string, unknown> | null;
      const statuses = config?.statuses as unknown[] | undefined;
      const typeLabels = config?.typeLabels as Record<string, unknown> | undefined;

      return {
        id: c.id,
        name: c.name,
        spaceCount: c._count.spaces,
        customStatusCount: statuses ? statuses.length : 0,
        customTypeCount: typeLabels ? Object.keys(typeLabels).length : 0,
      };
    });

    return {
      defaults: {
        statuses: DEFAULT_STATUSES,
        typeLabels: DEFAULT_TYPE_LABELS,
      },
      customizedCommunities,
      totalCommunities,
      customizedCount: customizedCommunities.length,
    };
  });
};
