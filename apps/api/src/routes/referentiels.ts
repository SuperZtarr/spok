import { FastifyPluginAsync } from 'fastify';
import { DEFAULT_REFERENTIELS, type SpaceReferentiels } from '@spok/shared';
import { checkSpaceAccess } from './items.js';

function parseReferentiels(config: unknown): SpaceReferentiels | null {
  if (!config || typeof config !== 'object') return null;
  const obj = config as Record<string, unknown>;
  if (!Array.isArray(obj.statuses) || typeof obj.typeLabels !== 'object') return null;
  return config as SpaceReferentiels;
}

export const referentielsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /spaces/:spaceId/referentiels — résout via communauté ou défauts
  fastify.get('/', async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    // Chercher la communauté parente
    const space = await fastify.prisma.space.findUnique({
      where: { id: spaceId },
      select: { communityId: true },
    });

    if (space?.communityId) {
      const community = await fastify.prisma.community.findUnique({
        where: { id: space.communityId },
        select: { referentiels: true },
      });

      const referentiels = parseReferentiels(community?.referentiels);
      if (referentiels) {
        return { referentiels, isDefault: false };
      }
    }

    return { referentiels: DEFAULT_REFERENTIELS, isDefault: true };
  });
};
