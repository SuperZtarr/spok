/* Préférences par espace et par utilisateur (état MindMap : repliés, épinglés, portails ; champs d'export choisis,
   `export.fields`, ids du registre shared EXPORT_FIELD_REGISTRY dans l'ordre des colonnes — 2026-11-18). */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { EXPORT_FIELD_IDS } from '@spok/shared';

const preferencesSchema = z.object({
  export: z.object({
    fields: z.array(z.enum(EXPORT_FIELD_IDS)).min(1).max(EXPORT_FIELD_IDS.length),
  }).optional(),
  mindmap: z.object({
    collapsedIds: z.array(z.string()).optional(),
    pinnedIds: z.array(z.string()).optional(),
    portals: z.array(z.any()).optional(),
  }).optional(),
}).passthrough();

export const spacePreferencesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /spaces/:spaceId/preferences
  fastify.get<{ Params: { spaceId: string } }>(
    '/:spaceId/preferences',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      const userId = request.user.userId;

      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId } },
        select: { preferences: true },
      });

      if (!membership) return reply.notFound('Membership not found');
      return membership.preferences ?? {};
    }
  );

  // PATCH /spaces/:spaceId/preferences
  fastify.patch<{ Params: { spaceId: string }; Body: unknown }>(
    '/:spaceId/preferences',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      const userId = request.user.userId;

      const parsed = preferencesSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);

      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId } },
        select: { preferences: true },
      });

      if (!membership) return reply.notFound('Membership not found');

      // Merge avec les préférences existantes
      const current = (membership.preferences as Record<string, unknown>) ?? {};
      const updated = { ...current, ...parsed.data };

      await fastify.prisma.spaceMembership.update({
        where: { userId_spaceId: { userId, spaceId } },
        data: { preferences: updated as Parameters<typeof fastify.prisma.spaceMembership.update>[0]['data']['preferences'] },
      });

      return updated;
    }
  );
};
