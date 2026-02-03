import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AuditAction, AuditEntity } from '@spok/shared';

const querySchema = z.object({
  entity: z.enum(['Item', 'ItemRelation']).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'MOVE', 'BULK_MOVE', 'ADD_RELATION', 'DELETE_RELATION']).optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to check space access
  async function checkSpaceAccess(userId: string, spaceId: string) {
    return fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: { userId, spaceId },
      },
    });
  }

  // List audit logs
  fastify.get<{
    Params: { spaceId: string };
    Querystring: z.infer<typeof querySchema>;
  }>('/', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const query = querySchema.parse(request.query);
    const { page, pageSize, entity, action, entityId, userId, from, to } = query;

    const where: any = { spaceId: request.params.spaceId };

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        ...log,
        action: log.action as AuditAction,
        entity: log.entity as AuditEntity,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  // Get single audit log
  fastify.get<{
    Params: { spaceId: string; id: string };
  }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const log = await fastify.prisma.auditLog.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      return reply.notFound('Audit log not found');
    }

    return {
      ...log,
      action: log.action as AuditAction,
      entity: log.entity as AuditEntity,
    };
  });

  // Restore from audit log
  fastify.post<{
    Params: { spaceId: string; id: string };
  }>('/:id/restore', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      return reply.forbidden('Insufficient permissions to restore');
    }

    const log = await fastify.prisma.auditLog.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
    });

    if (!log) {
      return reply.notFound('Audit log not found');
    }

    const changes = log.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;

    switch (log.action) {
      case 'UPDATE':
      case 'MOVE': {
        // Restore to previous state
        if (!changes?.before) {
          return reply.badRequest('No previous state available to restore');
        }

        const existingItem = await fastify.prisma.item.findUnique({
          where: { id: log.entityId },
        });

        if (!existingItem) {
          return reply.notFound('Item no longer exists');
        }

        // Only restore fields that were changed
        const restoreData: Record<string, unknown> = {};
        const before = changes.before;

        if (log.action === 'MOVE') {
          // For MOVE, only restore parentId and position
          restoreData.parentId = before.parentId;
          restoreData.position = before.position;
        } else {
          // For UPDATE, restore all changed fields
          if ('title' in before) restoreData.title = before.title;
          if ('description' in before) restoreData.description = before.description;
          if ('content' in before) restoreData.content = before.content;
          if ('url' in before) restoreData.url = before.url;
          if ('status' in before) restoreData.status = before.status;
          if ('priority' in before) restoreData.priority = before.priority;
          if ('dueDate' in before) restoreData.dueDate = before.dueDate ? new Date(before.dueDate as string) : null;
          if ('parentId' in before) restoreData.parentId = before.parentId;
          if ('type' in before) restoreData.type = before.type;
        }

        const restoredItem = await fastify.prisma.item.update({
          where: { id: log.entityId },
          data: restoreData as any,
        });

        // Create audit log for the restore action
        await fastify.prisma.auditLog.create({
          data: {
            action: 'UPDATE',
            entity: 'Item',
            entityId: log.entityId,
            spaceId: request.params.spaceId,
            userId: request.user.userId,
            changes: {
              before: changes.after,
              after: changes.before,
              restoredFromAuditLogId: log.id,
            } as any,
          },
        });

        return {
          success: true,
          restored: restoredItem,
          message: 'Item restored successfully',
        };
      }

      case 'DELETE': {
        // Recreate the deleted item
        if (!changes?.before) {
          return reply.badRequest('No previous state available to restore');
        }

        const before = changes.before;

        // Check if item already exists (was already restored)
        const existingItem = await fastify.prisma.item.findUnique({
          where: { id: log.entityId },
        });

        if (existingItem) {
          return reply.conflict('Item already exists - may have been restored previously');
        }

        // Recreate the item
        const restoredItem = await fastify.prisma.item.create({
          data: {
            id: before.id as string,
            type: before.type as string,
            title: before.title as string,
            description: before.description as string | null,
            content: before.content as any,
            url: before.url as string | null,
            status: before.status as string | null,
            priority: before.priority as number | null,
            position: before.position as number,
            dueDate: before.dueDate ? new Date(before.dueDate as string) : null,
            spaceId: request.params.spaceId,
            createdById: before.createdById as string,
            parentId: before.parentId as string | null,
          } as any,
        });

        // Create audit log for the restore action
        await fastify.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'Item',
            entityId: log.entityId,
            spaceId: request.params.spaceId,
            userId: request.user.userId,
            changes: {
              after: before,
              restoredFromAuditLogId: log.id,
            } as any,
          },
        });

        return {
          success: true,
          restored: restoredItem,
          message: 'Item recreated successfully',
        };
      }

      case 'DELETE_RELATION': {
        // Recreate the deleted relation
        if (!changes?.before) {
          return reply.badRequest('No previous state available to restore');
        }

        const before = changes.before;

        // Check if relation already exists
        const existingRelation = await fastify.prisma.itemRelation.findUnique({
          where: { id: log.entityId },
        });

        if (existingRelation) {
          return reply.conflict('Relation already exists - may have been restored previously');
        }

        // Verify both items still exist
        const [fromItem, toItem] = await Promise.all([
          fastify.prisma.item.findUnique({ where: { id: before.fromItemId as string } }),
          fastify.prisma.item.findUnique({ where: { id: before.toItemId as string } }),
        ]);

        if (!fromItem || !toItem) {
          return reply.badRequest('One or both related items no longer exist');
        }

        const restoredRelation = await fastify.prisma.itemRelation.create({
          data: {
            id: before.id as string,
            fromItemId: before.fromItemId as string,
            toItemId: before.toItemId as string,
            type: before.type as string,
          } as any,
        });

        // Create audit log for the restore action
        await fastify.prisma.auditLog.create({
          data: {
            action: 'ADD_RELATION',
            entity: 'ItemRelation',
            entityId: log.entityId,
            spaceId: request.params.spaceId,
            userId: request.user.userId,
            changes: {
              after: before,
              restoredFromAuditLogId: log.id,
            } as any,
          },
        });

        return {
          success: true,
          restored: restoredRelation,
          message: 'Relation recreated successfully',
        };
      }

      case 'CREATE':
      case 'ADD_RELATION': {
        // Optionally delete the created item/relation
        return reply.badRequest(
          'Restoring CREATE actions requires deleting the created item. Use the delete endpoint directly.'
        );
      }

      case 'BULK_MOVE': {
        // BULK_MOVE is complex - suggest restoring individual items
        return reply.badRequest(
          'Bulk move cannot be restored automatically. Please restore individual items if needed.'
        );
      }

      default:
        return reply.badRequest('Unknown action type');
    }
  });
};
