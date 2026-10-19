/*
 * Routes /spaces/:spaceId/process-nodes : positions des items sur le canevas de la vue Process
 * (une ligne process_nodes = un item placé ; pas de ligne = item « non placé »). Partagées entre membres.
 * - GET : tout accès à l'espace (checkSpaceAccess, VIEWER compris).
 * - PUT /:itemId { x, y } : place ou déplace (upsert) — OWNER/MEMBER, item obligatoirement dans l'espace.
 * - DELETE /:itemId : retire du process (l'item n'est PAS supprimé), idempotent.
 * Pas d'audit log : mise en page, pas une donnée métier.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const processNodesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { spaceId: string } }>(
    '/:spaceId/process-nodes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
      if (!membership) return reply.notFound('Space not found');

      return fastify.prisma.processNode.findMany({
        where: { spaceId },
        select: { itemId: true, x: true, y: true },
      });
    }
  );

  fastify.put<{ Params: { spaceId: string; itemId: string }; Body: unknown }>(
    '/:spaceId/process-nodes/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId, itemId } = request.params;
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
      if (!membership) return reply.notFound('Space not found');
      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot edit the process');
      }

      const { x, y } = positionSchema.parse(request.body);

      const item = await fastify.prisma.item.findFirst({ where: { id: itemId, spaceId }, select: { id: true } });
      if (!item) return reply.notFound('Item not found');

      return fastify.prisma.processNode.upsert({
        where: { spaceId_itemId: { spaceId, itemId } },
        create: { spaceId, itemId, x, y },
        update: { x, y },
        select: { itemId: true, x: true, y: true },
      });
    }
  );

  fastify.delete<{ Params: { spaceId: string; itemId: string } }>(
    '/:spaceId/process-nodes/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId, itemId } = request.params;
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
      if (!membership) return reply.notFound('Space not found');
      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot edit the process');
      }

      await fastify.prisma.processNode.deleteMany({ where: { spaceId, itemId } });
      return reply.status(204).send();
    }
  );
};
