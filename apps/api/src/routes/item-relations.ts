/*
 * Relations entre items (blocks, depends, implements, relates) : CRUD + commentaire de relation.
 * La sémantique PERT des types vit côté web (pert-utils) — cf. spec 2026-06-11.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeRelationForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const createRelationSchema = z.object({
  toItemId: z.string(),
  type: z.string(),
  label: z.string().nullable().optional(),
});

const updateRelationSchema = z.object({
  type: z.string().optional(),
  label: z.string().nullable().optional(),
});

export const itemRelationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create relation
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof createRelationSchema>;
  }>('/:id/relations', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot create relations');
    }

    const body = createRelationSchema.parse(request.body);

    // Verify both items exist (fromItem must be in the request space, toItem can be cross-space)
    const [fromItem, toItem] = await Promise.all([
      fastify.prisma.item.findFirst({
        where: { id: request.params.id, spaceId: request.params.spaceId },
      }),
      fastify.prisma.item.findFirst({
        where: { id: body.toItemId },
      }),
    ]);

    if (!fromItem || !toItem) {
      return reply.notFound('One or both items not found');
    }

    // Cross-space relation: verify user can at least view the target item's space
    if (toItem.spaceId !== request.params.spaceId) {
      const targetMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, toItem.spaceId);
      if (!targetMembership) {
        return reply.notFound('One or both items not found');
      }
    }

    const relation = await fastify.prisma.itemRelation.create({
      data: {
        fromItemId: request.params.id,
        toItemId: body.toItemId,
        type: body.type,
        label: body.label || null,
      },
    });

    // Audit log for ADD_RELATION
    await createAuditLog(fastify.prisma, {
      action: 'ADD_RELATION',
      entity: 'ItemRelation',
      entityId: relation.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        after: serializeRelationForAudit(relation),
      },
    });

    return reply.status(201).send(relation);
  });

  // Update relation
  fastify.patch<{
    Params: { spaceId: string; id: string; relationId: string };
    Body: z.infer<typeof updateRelationSchema>;
  }>('/:id/relations/:relationId', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot update relations');
    }

    const relation = await fastify.prisma.itemRelation.findFirst({
      where: {
        id: request.params.relationId,
        fromItemId: request.params.id,
      },
    });

    if (!relation) {
      return reply.notFound('Relation not found');
    }

    const body = updateRelationSchema.parse(request.body);
    const beforeState = serializeRelationForAudit(relation);

    const updated = await fastify.prisma.itemRelation.update({
      where: { id: request.params.relationId },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.label !== undefined ? { label: body.label } : {}),
      },
    });

    await createAuditLog(fastify.prisma, {
      action: 'UPDATE_RELATION',
      entity: 'ItemRelation',
      entityId: relation.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: beforeState,
        after: serializeRelationForAudit(updated),
      },
    });

    return updated;
  });

  // Delete relation
  fastify.delete<{ Params: { spaceId: string; id: string; relationId: string } }>(
    '/:id/relations/:relationId',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot delete relations');
      }

      const relation = await fastify.prisma.itemRelation.findFirst({
        where: {
          id: request.params.relationId,
          fromItemId: request.params.id,
        },
      });

      if (!relation) {
        return reply.notFound('Relation not found');
      }

      // Save state before delete for audit
      const beforeState = serializeRelationForAudit(relation);

      await fastify.prisma.itemRelation.delete({
        where: { id: request.params.relationId },
      });

      // Audit log for DELETE_RELATION
      await createAuditLog(fastify.prisma, {
        action: 'DELETE_RELATION',
        entity: 'ItemRelation',
        entityId: relation.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: beforeState,
        },
      });

      return { success: true };
    }
  );
};
