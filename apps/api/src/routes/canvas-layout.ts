import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const MODULE_KEY = 'canvas-layout';

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const updateCanvasLayoutSchema = z.object({
  positions: z.record(z.string(), positionSchema),
});

export type CanvasLayout = {
  positions: Record<string, { x: number; y: number }>;
};

function parseCanvasLayout(config: unknown): CanvasLayout | null {
  if (!config || typeof config !== 'object') return null;
  const obj = config as Record<string, unknown>;
  if (!obj.positions || typeof obj.positions !== 'object') return null;
  return config as CanvasLayout;
}

export const canvasLayoutRoutes: FastifyPluginAsync = async (fastify) => {
  async function checkSpaceAccess(userId: string | undefined, spaceId: string) {
    if (userId) {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId } },
      });
      if (membership) return membership;
    }

    const space = await fastify.prisma.space.findUnique({
      where: { id: spaceId },
      select: { communityId: true, community: { select: { isPublic: true } } },
    });
    if (space?.communityId) {
      if (userId) {
        const cm = await fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId, communityId: space.communityId } },
        });
        if (cm) return { userId, spaceId, role: 'MEMBER' as const, id: '', joinedAt: new Date() };
      }
      if (space.community?.isPublic) {
        return { userId: userId || '', spaceId, role: 'MEMBER' as const, id: '', joinedAt: new Date() };
      }
    }
    return null;
  }

  // GET /spaces/:spaceId/canvas-layout
  fastify.get('/', async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(request.user?.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    const module = await fastify.prisma.spaceModule.findUnique({
      where: { spaceId_moduleKey: { spaceId, moduleKey: MODULE_KEY } },
    });

    const layout = parseCanvasLayout(module?.config);
    return { positions: layout?.positions ?? {} };
  });

  // PUT /spaces/:spaceId/canvas-layout
  fastify.put('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(request.user.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Permissions insuffisantes');
    }

    const body = updateCanvasLayoutSchema.parse(request.body);

    const module = await fastify.prisma.spaceModule.upsert({
      where: { spaceId_moduleKey: { spaceId, moduleKey: MODULE_KEY } },
      create: {
        spaceId,
        moduleKey: MODULE_KEY,
        config: JSON.parse(JSON.stringify({ positions: body.positions })),
        enabled: true,
      },
      update: {
        config: JSON.parse(JSON.stringify({ positions: body.positions })),
      },
    });

    const layout = parseCanvasLayout(module.config);
    return { positions: layout?.positions ?? {} };
  });
};
