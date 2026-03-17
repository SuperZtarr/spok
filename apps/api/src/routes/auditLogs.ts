import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AuditAction, AuditEntity } from '@spok/shared';
import { checkSpaceAccess } from './items.js';

const querySchema = z.object({
  entity: z.enum(['Item', 'ItemRelation', 'Space', 'Community']).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'MOVE', 'BULK_MOVE', 'ADD_RELATION', 'DELETE_RELATION']).optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  // Audit logs always require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // List audit logs
  fastify.get<{
    Params: { spaceId: string };
    Querystring: z.infer<typeof querySchema>;
  }>('/', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const query = querySchema.parse(request.query);
    const { page, pageSize, entity, action, entityId, userId, batchId, from, to } = query;

    const where: any = { spaceId: request.params.spaceId };

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (batchId) where.batchId = batchId;
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
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
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
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
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
        // Recreate the deleted entity
        if (!changes?.before) {
          return reply.badRequest('No previous state available to restore');
        }

        const before = changes.before;

        // Handle Contribution restore
        if (log.entity === 'Contribution') {
          // Check if the parent item still exists
          const parentItem = await fastify.prisma.item.findUnique({
            where: { id: before.itemId as string },
            select: { id: true },
          });
          if (!parentItem) {
            return reply.badRequest('The parent item no longer exists');
          }

          // Check if the original author still exists
          let authorId = before.authorId as string | undefined;
          if (authorId) {
            const authorExists = await fastify.prisma.user.findUnique({
              where: { id: authorId },
              select: { id: true },
            });
            if (!authorExists) authorId = request.user.userId;
          } else {
            authorId = request.user.userId;
          }

          const restoredContribution = await fastify.prisma.contribution.create({
            data: {
              content: before.content as string,
              itemId: before.itemId as string,
              authorId,
            },
          });

          await fastify.prisma.auditLog.create({
            data: {
              action: 'CREATE',
              entity: 'Contribution',
              entityId: restoredContribution.id,
              spaceId: request.params.spaceId,
              userId: request.user.userId,
              changes: {
                after: { content: restoredContribution.content, itemId: restoredContribution.itemId },
                restoredFromAuditLogId: log.id,
              } as any,
            },
          });

          return {
            success: true,
            restored: restoredContribution,
            message: 'Contribution restored successfully',
          };
        }

        // Handle Item restore
        // Check if item already exists (was already restored)
        const existingItem = await fastify.prisma.item.findUnique({
          where: { id: log.entityId },
        });

        if (existingItem) {
          return reply.conflict('Item already exists - may have been restored previously');
        }

        // Check if the parent still exists, otherwise reset to root
        let parentId = before.parentId as string | null;
        if (parentId) {
          const parentExists = await fastify.prisma.item.findUnique({
            where: { id: parentId },
            select: { id: true },
          });
          if (!parentExists) {
            parentId = null;
          }
        }

        // Check if the original creator still exists
        let createdById = before.createdById as string;
        const creatorExists = await fastify.prisma.user.findUnique({
          where: { id: createdById },
          select: { id: true },
        });
        if (!creatorExists) {
          createdById = request.user.userId;
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
            createdById,
            parentId,
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
