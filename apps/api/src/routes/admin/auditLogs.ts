import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AuditAction, AuditEntity } from '@spok/shared';

const querySchema = z.object({
  entity: z.enum(['Item', 'ItemRelation', 'Space', 'Community']).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'MOVE', 'BULK_MOVE', 'ADD_RELATION', 'DELETE_RELATION']).optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  spaceId: z.string().optional(),
  communityId: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminAuditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin authentication
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/audit-logs - List all audit logs with filters and pagination
  fastify.get<{
    Querystring: z.infer<typeof querySchema>;
  }>('/', async (request) => {
    const query = querySchema.parse(request.query);
    const { page, pageSize, entity, action, entityId, userId, spaceId, communityId, batchId, from, to } = query;

    const where: any = {};

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (spaceId) where.spaceId = spaceId;
    if (batchId) where.batchId = batchId;

    // Filter by communityId: find logs for spaces belonging to this community
    if (communityId) {
      const communitySpaces = await fastify.prisma.space.findMany({
        where: { communityId },
        select: { id: true },
      });
      const spaceIds = communitySpaces.map(s => s.id);
      // Include logs for these spaces OR logs directly on the community entity
      where.OR = [
        { spaceId: { in: spaceIds } },
        { entity: 'Community', entityId: communityId },
      ];
    }

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
          space: {
            select: {
              id: true,
              name: true,
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

  // GET /admin/audit-logs/stats - Audit log statistics
  fastify.get('/stats', async (request) => {
    const [
      totalCount,
      entityCounts,
      actionCounts,
      batchCount,
    ] = await Promise.all([
      fastify.prisma.auditLog.count(),
      fastify.prisma.auditLog.groupBy({
        by: ['entity'],
        _count: true,
        orderBy: { _count: { entity: 'desc' } },
      }),
      fastify.prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
      }),
      fastify.prisma.auditLog.groupBy({
        by: ['batchId'],
        where: { batchId: { not: null } },
        _count: true,
      }),
    ]);

    // Get recent daily activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await fastify.prisma.auditLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyActivity: Record<string, number> = {};
    for (const log of recentLogs) {
      const day = log.createdAt.toISOString().split('T')[0];
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    }

    // Estimate storage size (rough: ~500 bytes per log)
    const estimatedSizeBytes = totalCount * 500;

    // Alerte accumulation : si > 10 000 logs et pas de notif AUDIT_ALERT non lue pour cet admin
    const AUDIT_ALERT_THRESHOLD = 10_000;
    if (totalCount > AUDIT_ALERT_THRESHOLD) {
      const existingAlert = await fastify.prisma.notification.findFirst({
        where: {
          userId: request.user.userId,
          type: 'AUDIT_ALERT',
          read: false,
        },
      });

      if (!existingAlert) {
        // Créer une notification pour tous les admins
        const admins = await fastify.prisma.user.findMany({
          where: { globalRole: 'ADMIN' },
          select: { id: true },
        });

        await fastify.prisma.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            type: 'AUDIT_ALERT' as const,
            title: 'Accumulation de logs d\'audit',
            message: `${totalCount.toLocaleString('fr-FR')} logs enregistrés. Une purge est recommandée.`,
            link: '/admin/audit',
          })),
          skipDuplicates: true,
        });
      }
    }

    return {
      totalCount,
      entityBreakdown: entityCounts.map(e => ({
        entity: e.entity,
        count: e._count,
      })),
      actionBreakdown: actionCounts.map(a => ({
        action: a.action,
        count: a._count,
      })),
      batchCount: batchCount.length,
      dailyActivity,
      estimatedSizeMB: Math.round(estimatedSizeBytes / 1024 / 1024 * 100) / 100,
    };
  });

  // POST /admin/audit-logs/:id/restore - Restore from a single audit log
  fastify.post<{
    Params: { id: string };
    Body: { fieldsToRestore?: string[] };
  }>('/:id/restore', async (request, reply) => {
    const log = await fastify.prisma.auditLog.findUnique({
      where: { id: request.params.id },
    });

    if (!log) {
      return reply.notFound('Audit log not found');
    }

    const changes = log.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;

    // Handle UPDATE/MOVE: restore selected fields to their before-state
    if ((log.action === 'UPDATE' || log.action === 'MOVE') && changes?.before) {
      const body = request.body as { fieldsToRestore?: string[] } | null;
      const fieldsToRestore = body?.fieldsToRestore;

      // Determine which fields to restore
      const before = changes.before;
      const restoreData: Record<string, unknown> = {};

      // Allowed fields for each entity type
      const ITEM_FIELDS = ['type', 'title', 'description', 'content', 'url', 'status', 'priority', 'position', 'dueDate', 'startDate', 'endDate', 'parentId', 'spaceId', 'assignedToId'];
      const SPACE_FIELDS = ['name', 'type', 'parentId', 'communityId', 'avatarUrl', 'coverUrl', 'defaultRole'];
      const COMMUNITY_FIELDS = ['name', 'description', 'isPublic', 'avatarUrl', 'coverUrl'];

      let allowedFields: string[];
      switch (log.entity) {
        case 'Item': allowedFields = ITEM_FIELDS; break;
        case 'Space': allowedFields = SPACE_FIELDS; break;
        case 'Community': allowedFields = COMMUNITY_FIELDS; break;
        default:
          return reply.badRequest(`Restore not supported for entity type: ${log.entity}`);
      }

      for (const field of (fieldsToRestore || Object.keys(before))) {
        if (allowedFields.includes(field) && field in before) {
          let value = before[field];
          // Convert date strings back to Date objects for Prisma
          if (['dueDate', 'startDate', 'endDate'].includes(field) && typeof value === 'string') {
            value = new Date(value);
          }
          restoreData[field] = value ?? null;
        }
      }

      if (Object.keys(restoreData).length === 0) {
        return reply.badRequest('No valid fields to restore');
      }

      let restored: unknown;
      switch (log.entity) {
        case 'Item': {
          const existing = await fastify.prisma.item.findUnique({ where: { id: log.entityId } });
          if (!existing) return reply.notFound('Item no longer exists');
          restored = await fastify.prisma.item.update({
            where: { id: log.entityId },
            data: restoreData as any,
          });
          break;
        }
        case 'Space': {
          const existing = await fastify.prisma.space.findUnique({ where: { id: log.entityId } });
          if (!existing) return reply.notFound('Space no longer exists');
          restored = await fastify.prisma.space.update({
            where: { id: log.entityId },
            data: restoreData as any,
          });
          break;
        }
        case 'Community': {
          const existing = await fastify.prisma.community.findUnique({ where: { id: log.entityId } });
          if (!existing) return reply.notFound('Community no longer exists');
          restored = await fastify.prisma.community.update({
            where: { id: log.entityId },
            data: restoreData as any,
          });
          break;
        }
      }

      await fastify.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: log.entity,
          entityId: log.entityId,
          spaceId: log.spaceId,
          userId: request.user.userId,
          changes: {
            before: changes.after || {},
            after: restoreData,
            restoredFromAuditLogId: log.id,
            restoredFields: Object.keys(restoreData),
          } as any,
        },
      });

      return { success: true, restored, entity: log.entity, restoredFields: Object.keys(restoreData) };
    }

    if (log.action !== 'DELETE' || !changes?.before) {
      return reply.badRequest('Only DELETE or UPDATE/MOVE logs with before-state can be restored');
    }

    const before = changes.before;

    switch (log.entity) {
      case 'Item': {
        const existing = await fastify.prisma.item.findUnique({ where: { id: log.entityId } });
        if (existing) {
          return reply.conflict('Item already exists');
        }

        // Check parent exists
        let parentId = before.parentId as string | null;
        if (parentId) {
          const parentExists = await fastify.prisma.item.findUnique({ where: { id: parentId }, select: { id: true } });
          if (!parentExists) parentId = null;
        }

        // Check space exists
        const spaceExists = log.spaceId
          ? await fastify.prisma.space.findUnique({ where: { id: log.spaceId }, select: { id: true } })
          : null;
        if (!spaceExists && log.spaceId) {
          return reply.badRequest('Target space no longer exists. Restore the space first.');
        }

        // Check creator exists
        let createdById = before.createdById as string;
        const creatorExists = await fastify.prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
        if (!creatorExists) createdById = request.user.userId;

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
            startDate: before.startDate ? new Date(before.startDate as string) : null,
            endDate: before.endDate ? new Date(before.endDate as string) : null,
            spaceId: log.spaceId!,
            createdById,
            parentId,
          } as any,
        });

        await fastify.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'Item',
            entityId: log.entityId,
            spaceId: log.spaceId,
            userId: request.user.userId,
            changes: { after: before, restoredFromAuditLogId: log.id } as any,
          },
        });

        return { success: true, restored: restoredItem, entity: 'Item' };
      }

      case 'Contribution': {
        // Check if the parent item still exists
        const parentItem = await fastify.prisma.item.findUnique({
          where: { id: before.itemId as string },
          select: { id: true },
        });
        if (!parentItem) {
          return reply.badRequest('The parent item no longer exists');
        }

        let authorId = before.authorId as string | undefined;
        if (authorId) {
          const authorExists = await fastify.prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
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
            spaceId: log.spaceId,
            userId: request.user.userId,
            changes: { after: { content: restoredContribution.content, itemId: restoredContribution.itemId }, restoredFromAuditLogId: log.id } as any,
          },
        });

        return { success: true, restored: restoredContribution, entity: 'Contribution' };
      }

      case 'ItemRelation': {
        const existing = await fastify.prisma.itemRelation.findUnique({ where: { id: log.entityId } });
        if (existing) {
          return reply.conflict('Relation already exists');
        }

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

        await fastify.prisma.auditLog.create({
          data: {
            action: 'ADD_RELATION',
            entity: 'ItemRelation',
            entityId: log.entityId,
            spaceId: log.spaceId,
            userId: request.user.userId,
            changes: { after: before, restoredFromAuditLogId: log.id } as any,
          },
        });

        return { success: true, restored: restoredRelation, entity: 'ItemRelation' };
      }

      case 'Space': {
        const existing = await fastify.prisma.space.findUnique({ where: { id: log.entityId } });
        if (existing) {
          return reply.conflict('Space already exists');
        }

        // Check parent space exists
        let parentId = before.parentId as string | null;
        if (parentId) {
          const parentExists = await fastify.prisma.space.findUnique({ where: { id: parentId }, select: { id: true } });
          if (!parentExists) parentId = null;
        }

        // Check community exists
        let communityId = before.communityId as string | null;
        if (communityId) {
          const communityExists = await fastify.prisma.community.findUnique({ where: { id: communityId }, select: { id: true } });
          if (!communityExists) communityId = null;
        }

        const restoredSpace = await fastify.prisma.space.create({
          data: {
            id: before.id as string,
            name: before.name as string,
            type: before.type as string,
            communityId,
            parentId,
            avatarUrl: before.avatarUrl as string | null,
            coverUrl: before.coverUrl as string | null,
          } as any,
        });

        // Create OWNER membership for the restoring admin
        await fastify.prisma.spaceMembership.create({
          data: {
            userId: request.user.userId,
            spaceId: restoredSpace.id,
            role: 'OWNER',
          },
        });

        await fastify.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'Space',
            entityId: log.entityId,
            spaceId: log.entityId,
            userId: request.user.userId,
            changes: { after: before, restoredFromAuditLogId: log.id } as any,
          },
        });

        return { success: true, restored: restoredSpace, entity: 'Space' };
      }

      case 'Community': {
        const existing = await fastify.prisma.community.findUnique({ where: { id: log.entityId } });
        if (existing) {
          return reply.conflict('Community already exists');
        }

        const restoredCommunity = await fastify.prisma.community.create({
          data: {
            id: before.id as string,
            name: before.name as string,
            description: before.description as string | null,
            isPublic: before.isPublic as boolean,
            avatarUrl: before.avatarUrl as string | null,
            coverUrl: before.coverUrl as string | null,
          } as any,
        });

        // Create OWNER membership for the restoring admin
        await fastify.prisma.communityMembership.create({
          data: {
            userId: request.user.userId,
            communityId: restoredCommunity.id,
            role: 'OWNER',
          },
        });

        await fastify.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'Community',
            entityId: log.entityId,
            spaceId: null,
            userId: request.user.userId,
            changes: { after: before, restoredFromAuditLogId: log.id } as any,
          },
        });

        return { success: true, restored: restoredCommunity, entity: 'Community' };
      }

      default:
        return reply.badRequest(`Restore not supported for entity type: ${log.entity}`);
    }
  });

  // POST /admin/audit-logs/batch/:batchId/restore - Restore all logs of a batch
  fastify.post<{
    Params: { batchId: string };
  }>('/batch/:batchId/restore', async (request, reply) => {
    const { batchId } = request.params;

    const batchLogs = await fastify.prisma.auditLog.findMany({
      where: { batchId, action: 'DELETE' },
      orderBy: { createdAt: 'asc' }, // Restore in order: parent entities first
    });

    if (batchLogs.length === 0) {
      return reply.notFound('No DELETE logs found for this batch');
    }

    // Sort: Communities first, then Spaces (by hierarchy), then Items
    const entityOrder: Record<string, number> = { Community: 0, Space: 1, Item: 2, ItemRelation: 3 };
    const sortedLogs = batchLogs.sort((a, b) => {
      const orderA = entityOrder[a.entity] ?? 99;
      const orderB = entityOrder[b.entity] ?? 99;
      return orderA - orderB;
    });

    const results: Array<{ logId: string; entity: string; entityId: string; status: 'restored' | 'skipped' | 'error'; message?: string }> = [];

    for (const log of sortedLogs) {
      const changes = log.changes as { before?: Record<string, unknown> } | null;
      if (!changes?.before) {
        results.push({ logId: log.id, entity: log.entity, entityId: log.entityId, status: 'skipped', message: 'No before-state' });
        continue;
      }

      const before = changes.before;

      try {
        switch (log.entity) {
          case 'Community': {
            const existing = await fastify.prisma.community.findUnique({ where: { id: log.entityId } });
            if (existing) {
              results.push({ logId: log.id, entity: 'Community', entityId: log.entityId, status: 'skipped', message: 'Already exists' });
              break;
            }
            await fastify.prisma.community.create({
              data: {
                id: before.id as string,
                name: before.name as string,
                description: before.description as string | null,
                isPublic: before.isPublic as boolean,
                avatarUrl: before.avatarUrl as string | null,
                coverUrl: before.coverUrl as string | null,
              } as any,
            });
            await fastify.prisma.communityMembership.create({
              data: { userId: request.user.userId, communityId: log.entityId, role: 'OWNER' },
            });
            results.push({ logId: log.id, entity: 'Community', entityId: log.entityId, status: 'restored' });
            break;
          }

          case 'Space': {
            const existing = await fastify.prisma.space.findUnique({ where: { id: log.entityId } });
            if (existing) {
              results.push({ logId: log.id, entity: 'Space', entityId: log.entityId, status: 'skipped', message: 'Already exists' });
              break;
            }

            let parentId = before.parentId as string | null;
            if (parentId) {
              const parentExists = await fastify.prisma.space.findUnique({ where: { id: parentId }, select: { id: true } });
              if (!parentExists) parentId = null;
            }

            let communityId = before.communityId as string | null;
            if (communityId) {
              const communityExists = await fastify.prisma.community.findUnique({ where: { id: communityId }, select: { id: true } });
              if (!communityExists) communityId = null;
            }

            await fastify.prisma.space.create({
              data: {
                id: before.id as string,
                name: before.name as string,
                type: before.type as string,
                communityId,
                parentId,
                avatarUrl: before.avatarUrl as string | null,
                coverUrl: before.coverUrl as string | null,
              } as any,
            });
            await fastify.prisma.spaceMembership.create({
              data: { userId: request.user.userId, spaceId: log.entityId, role: 'OWNER' },
            });
            results.push({ logId: log.id, entity: 'Space', entityId: log.entityId, status: 'restored' });
            break;
          }

          case 'Item': {
            const existing = await fastify.prisma.item.findUnique({ where: { id: log.entityId } });
            if (existing) {
              results.push({ logId: log.id, entity: 'Item', entityId: log.entityId, status: 'skipped', message: 'Already exists' });
              break;
            }

            // Check space exists
            if (log.spaceId) {
              const spaceExists = await fastify.prisma.space.findUnique({ where: { id: log.spaceId }, select: { id: true } });
              if (!spaceExists) {
                results.push({ logId: log.id, entity: 'Item', entityId: log.entityId, status: 'skipped', message: 'Space does not exist' });
                break;
              }
            }

            let parentId = before.parentId as string | null;
            if (parentId) {
              const parentExists = await fastify.prisma.item.findUnique({ where: { id: parentId }, select: { id: true } });
              if (!parentExists) parentId = null;
            }

            let createdById = before.createdById as string;
            const creatorExists = await fastify.prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
            if (!creatorExists) createdById = request.user.userId;

            await fastify.prisma.item.create({
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
                startDate: before.startDate ? new Date(before.startDate as string) : null,
                endDate: before.endDate ? new Date(before.endDate as string) : null,
                spaceId: log.spaceId!,
                createdById,
                parentId,
              } as any,
            });
            results.push({ logId: log.id, entity: 'Item', entityId: log.entityId, status: 'restored' });
            break;
          }

          case 'ItemRelation': {
            const existing = await fastify.prisma.itemRelation.findUnique({ where: { id: log.entityId } });
            if (existing) {
              results.push({ logId: log.id, entity: 'ItemRelation', entityId: log.entityId, status: 'skipped', message: 'Already exists' });
              break;
            }

            const [fromItem, toItem] = await Promise.all([
              fastify.prisma.item.findUnique({ where: { id: before.fromItemId as string } }),
              fastify.prisma.item.findUnique({ where: { id: before.toItemId as string } }),
            ]);

            if (!fromItem || !toItem) {
              results.push({ logId: log.id, entity: 'ItemRelation', entityId: log.entityId, status: 'skipped', message: 'Related items do not exist' });
              break;
            }

            await fastify.prisma.itemRelation.create({
              data: {
                id: before.id as string,
                fromItemId: before.fromItemId as string,
                toItemId: before.toItemId as string,
                type: before.type as string,
              } as any,
            });
            results.push({ logId: log.id, entity: 'ItemRelation', entityId: log.entityId, status: 'restored' });
            break;
          }

          default:
            results.push({ logId: log.id, entity: log.entity, entityId: log.entityId, status: 'skipped', message: 'Unknown entity type' });
        }
      } catch (err: any) {
        results.push({ logId: log.id, entity: log.entity, entityId: log.entityId, status: 'error', message: err.message });
      }
    }

    // Create a single audit log for the batch restore
    await fastify.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Item',
        entityId: batchId,
        spaceId: null,
        userId: request.user.userId,
        changes: {
          batchRestore: true,
          batchId,
          results: results.filter(r => r.status === 'restored').length,
        } as any,
      },
    });

    const restored = results.filter(r => r.status === 'restored').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return {
      success: true,
      batchId,
      summary: { restored, skipped, errors, total: results.length },
      details: results,
    };
  });

  // DELETE /admin/audit-logs/purge-overflow - Purge logs beyond the threshold (keep the N most recent)
  fastify.delete<{
    Querystring: { keep?: string };
  }>('/purge-overflow', async (request, reply) => {
    const keep = parseInt((request.query as Record<string, string>).keep || '10000', 10);
    if (isNaN(keep) || keep < 1) {
      return reply.badRequest('keep must be a positive integer');
    }

    const totalCount = await fastify.prisma.auditLog.count();
    if (totalCount <= keep) {
      return { success: true, purged: 0, totalCount, message: `Moins de ${keep} logs, aucune purge nécessaire.` };
    }

    // Find the ID of the Nth most recent log (cutoff)
    const cutoffLog = await fastify.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: keep - 1,
      take: 1,
      select: { createdAt: true },
    });

    if (!cutoffLog.length) {
      return { success: true, purged: 0, totalCount };
    }

    const cutoffDate = cutoffLog[0].createdAt;
    const result = await fastify.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return {
      success: true,
      purged: result.count,
      kept: keep,
      cutoffDate: cutoffDate.toISOString(),
    };
  });

  // DELETE /admin/audit-logs/purge - Purge old audit logs
  fastify.delete<{
    Querystring: { olderThanDays?: string };
  }>('/purge', async (request, reply) => {
    const days = parseInt((request.query as Record<string, string>).olderThanDays || '90', 10);
    if (isNaN(days) || days < 1) {
      return reply.badRequest('olderThanDays must be a positive integer');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await fastify.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return {
      success: true,
      purged: result.count,
      olderThan: cutoffDate.toISOString(),
    };
  });
};
