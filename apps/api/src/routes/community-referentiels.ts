/*
 * Référentiels au niveau communauté (statuts, labels de types) : lecture, PUT (OWNER),
 * reset. Les espaces résolvent leurs référentiels ici (cf. routes/referentiels.ts).
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_REFERENTIELS, type SpaceReferentiels, type StatusConfig, type TypeLabelConfig } from '@spok/shared';

const statusConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  borderColor: z.string().min(1),
  order: z.number().int().min(0),
  visible: z.boolean(),
});

const typeLabelConfigSchema = z.object({
  label: z.string().min(1),
  labelShort: z.string().min(1),
  color: z.string().min(1),
  bgHover: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const updateReferentielsSchema = z.object({
  statuses: z.array(statusConfigSchema).optional(),
  typeLabels: z.record(z.string(), typeLabelConfigSchema).optional(),
});

function parseReferentiels(config: unknown): SpaceReferentiels | null {
  if (!config || typeof config !== 'object') return null;
  const obj = config as Record<string, unknown>;
  if (!Array.isArray(obj.statuses) || typeof obj.typeLabels !== 'object') return null;
  return config as SpaceReferentiels;
}

async function checkCommunityOwner(prisma: any, userId: string, communityId: string) {
  const membership = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });
  return membership?.role === 'OWNER' ? membership : null;
}

export const communityReferentielsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /communities/:communityId/referentiels
  fastify.get('/', async (request, reply) => {
    const { communityId } = request.params as { communityId: string };

    const community = await fastify.prisma.community.findUnique({
      where: { id: communityId },
      select: { referentiels: true },
    });

    if (!community) {
      return reply.notFound('Communauté non trouvée');
    }

    const referentiels = parseReferentiels(community.referentiels);
    return {
      referentiels: referentiels || DEFAULT_REFERENTIELS,
      isDefault: !referentiels,
    };
  });

  // PUT /communities/:communityId/referentiels
  fastify.put<{ Body: z.infer<typeof updateReferentielsSchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { communityId } = request.params as { communityId: string };

    const owner = await checkCommunityOwner(fastify.prisma, request.user.userId, communityId);
    if (!owner) {
      return reply.forbidden('Seul le propriétaire peut modifier les référentiels');
    }

    const body = updateReferentielsSchema.parse(request.body);

    const community = await fastify.prisma.community.findUnique({
      where: { id: communityId },
      select: { referentiels: true },
    });

    const current = parseReferentiels(community?.referentiels) || DEFAULT_REFERENTIELS;

    const updated: SpaceReferentiels = {
      statuses: (body.statuses as StatusConfig[]) || current.statuses,
      typeLabels: (body.typeLabels as Record<string, TypeLabelConfig>) || current.typeLabels,
    };

    await fastify.prisma.community.update({
      where: { id: communityId },
      data: { referentiels: JSON.parse(JSON.stringify(updated)) },
    });

    return { referentiels: updated, isDefault: false };
  });

  // POST /communities/:communityId/referentiels/reset
  fastify.post('/reset', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { communityId } = request.params as { communityId: string };

    const owner = await checkCommunityOwner(fastify.prisma, request.user.userId, communityId);
    if (!owner) {
      return reply.forbidden('Seul le propriétaire peut réinitialiser les référentiels');
    }

    await fastify.prisma.community.update({
      where: { id: communityId },
      data: { referentiels: null },
    });

    return { referentiels: DEFAULT_REFERENTIELS, isDefault: true };
  });

  // GET /communities/:communityId/referentiels/check-status-usage/:statusId
  fastify.get<{ Params: { statusId: string } }>('/check-status-usage/:statusId', async (request, reply) => {
    const { communityId, statusId } = request.params as { communityId: string; statusId: string };

    const community = await fastify.prisma.community.findUnique({
      where: { id: communityId },
      select: { spaces: { select: { id: true } } },
    });

    if (!community) {
      return reply.notFound('Communauté non trouvée');
    }

    const spaceIds = community.spaces.map((s: { id: string }) => s.id);

    const count = await fastify.prisma.item.count({
      where: {
        spaceId: { in: spaceIds },
        status: statusId === 'undefined' ? null : statusId,
      },
    });

    return { statusId, itemCount: count, isUsed: count > 0 };
  });
};
