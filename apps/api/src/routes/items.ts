import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { createNotification } from '../utils/notifications.js';
import { notifyMentionedUsers } from '../utils/mentions.js';
import { itemRelationsRoutes } from './item-relations.js';
import { itemMoveRoutes } from './item-move.js';
import { itemBulkRoutes } from './item-bulk.js';
import { itemUploadRoutes } from './item-uploads.js';
import { itemContributionRoutes } from './item-contributions.js';
import { itemConvertRoutes } from './item-convert.js';

const createItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM']),
  title: z.string().default(''),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().nullable().optional(),
  status: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(4).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  parentId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  updatedAt: z.string().datetime().optional(),
});

const querySchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM']).optional(),
  status: z.string().optional(),
  parentId: z.string().nullable().optional(),
  search: z.string().optional(),
  include: z.string().optional(),
  additionalSpaceIds: z.string().optional(), // comma-separated space IDs
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
});

// Exported helper: check space access (direct membership, community membership, or public community)
export async function checkSpaceAccess(prisma: any, userId: string | undefined, spaceId: string) {
  // 1. If authenticated, check direct space membership
  if (userId) {
    const membership = await prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: { userId, spaceId },
      },
    });
    if (membership) return membership;
  }

  // 2. Community membership or public community → VIEWER access
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { communityId: true, community: { select: { isPublic: true } } },
  });
  if (space?.communityId) {
    if (userId) {
      const communityMembership = await prisma.communityMembership.findUnique({
        where: {
          userId_communityId: { userId, communityId: space.communityId },
        },
      });
      if (communityMembership) {
        return { userId, spaceId, role: 'VIEWER' as const, id: '', joinedAt: new Date() };
      }
    }

    // Public community: allow anonymous and non-member authenticated users
    if (space.community?.isPublic) {
      return { userId: userId || '', spaceId, role: 'VIEWER' as const, id: '', joinedAt: new Date() };
    }
  }

  return null;
}

export const itemsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register write sub-plugins — require authentication
  await fastify.register(async function (authInstance) {
    authInstance.addHook('preHandler', authInstance.authenticate);
    await authInstance.register(itemRelationsRoutes);
    await authInstance.register(itemMoveRoutes);
    await authInstance.register(itemBulkRoutes);
    await authInstance.register(itemUploadRoutes);
    await authInstance.register(itemContributionRoutes);
    await authInstance.register(itemConvertRoutes);
  });

  // List items
  fastify.get<{ Params: { spaceId: string }; Querystring: z.infer<typeof querySchema> }>(
    '/',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const query = querySchema.parse(request.query);
      const { page, pageSize, type, status, parentId, search, include, additionalSpaceIds } = query;

      const includeContributions = include?.split(',').includes('contributions');

      // Build spaceId filter (optionally include additional specific spaces)
      let spaceIdFilter: any = request.params.spaceId;
      if (additionalSpaceIds) {
        const extraIds = additionalSpaceIds.split(',').filter(Boolean);
        if (extraIds.length > 0) {
          spaceIdFilter = { in: [request.params.spaceId, ...extraIds] };
        }
      }

      const where: any = { spaceId: spaceIdFilter };

      if (type) where.type = type;
      if (status === 'none') {
        where.status = null;
      } else if (status) {
        where.status = status;
      }
      if (parentId !== undefined) where.parentId = parentId === '' ? null : parentId;
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const prismaInclude: any = {
        tags: { include: { tag: true } },
        children: { select: { id: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { children: true, contributions: true } },
        relationsFrom: {
          include: { toItem: { select: { id: true, title: true, type: true } } },
        },
        relationsTo: {
          include: { fromItem: { select: { id: true, title: true, type: true } } },
        },
      };

      if (includeContributions) {
        prismaInclude.contributions = {
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        };
      }

      const [items, total] = await Promise.all([
        fastify.prisma.item.findMany({
          where,
          include: prismaInclude,
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        fastify.prisma.item.count({ where }),
      ]);

      return {
        data: items.map((item: any) => ({
          ...item,
          tags: item.tags.map((t: any) => t.tag),
          childCount: item._count.children,
          contributionCount: item._count.contributions,
          ...(includeContributions && item.contributions ? { contributions: item.contributions } : {}),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }
  );

  // Create item
  fastify.post<{ Params: { spaceId: string }; Body: z.infer<typeof createItemSchema> }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
        return reply.forbidden('Viewers cannot create items');
      }

      const body = createItemSchema.parse(request.body);
      const { tagIds, ...itemData } = body;

      const item = await fastify.prisma.item.create({
        data: {
          ...itemData,
          dueDate: itemData.dueDate ? new Date(itemData.dueDate) : undefined,
          startDate: itemData.startDate ? new Date(itemData.startDate) : new Date(),
          endDate: itemData.endDate ? new Date(itemData.endDate) : undefined,
          spaceId: request.params.spaceId,
          createdById: request.user.userId,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        } as any,
        include: {
          tags: { include: { tag: true } },
        },
      });

      // Audit log for CREATE
      await createAuditLog(fastify.prisma, {
        action: 'CREATE',
        entity: 'Item',
        entityId: item.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          after: serializeItemForAudit(item),
        },
      });

      // Notify @mentioned users in description
      if (itemData.description) {
        const authorName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await notifyMentionedUsers(fastify.prisma, itemData.description, request.user.userId, authorName, item.id, item.title, request.params.spaceId);
      }

      return reply.status(201).send({
        ...item,
        tags: item.tags.map((t) => t.tag),
      });
    }
  );

  // Get item by ID
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
      include: {
        tags: { include: { tag: true } },
        children: {
          include: {
            tags: { include: { tag: true } },
          },
        },
        parent: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        relationsFrom: {
          include: { toItem: { select: { id: true, title: true, type: true } } },
        },
        relationsTo: {
          include: { fromItem: { select: { id: true, title: true, type: true } } },
        },
        contributions: {
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    return {
      ...item,
      tags: item.tags.map((t) => t.tag),
      children: item.children.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
    };
  });

  // Update item
  fastify.patch<{ Params: { spaceId: string; id: string }; Body: z.infer<typeof updateItemSchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
        return reply.forbidden('Viewers cannot update items');
      }

      const existingItem = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!existingItem) {
        return reply.notFound('Item not found');
      }

      const body = updateItemSchema.parse(request.body);
      const { tagIds, updatedAt: clientUpdatedAt, ...updateData } = body;

      // Optimistic locking: if client sends updatedAt, compare with server
      if (clientUpdatedAt) {
        const serverUpdatedAt = existingItem.updatedAt.toISOString();
        const clientDate = new Date(clientUpdatedAt).toISOString();

        if (serverUpdatedAt !== clientDate) {
          // Build list of conflicting fields (only fields the client is trying to change)
          const FIELD_LABELS: Record<string, string> = {
            type: 'Type',
            title: 'Titre',
            description: 'Description',
            url: 'URL',
            status: 'Statut',
            priority: 'Priorité',
            dueDate: 'Date d\'échéance',
            startDate: 'Date de début',
            endDate: 'Date de fin',
            parentId: 'Parent',
            assignedToId: 'Assigné à',
          };

          const conflicts: Array<{ field: string; label: string; serverValue: unknown; clientValue: unknown }> = [];

          for (const [field, clientValue] of Object.entries(updateData)) {
            // Skip content (not comparable) and fields not in labels
            if (field === 'content' || !FIELD_LABELS[field]) continue;

            const serverValue = (existingItem as any)[field];
            // Normalize for comparison: dates to ISO, null/undefined equivalence
            const normalizeValue = (v: unknown) => {
              if (v === undefined || v === null || v === '') return null;
              if (v instanceof Date) return v.toISOString();
              return v;
            };

            const normalizedServer = normalizeValue(serverValue);
            const normalizedClient = normalizeValue(clientValue);

            if (normalizedServer !== normalizedClient) {
              conflicts.push({
                field,
                label: FIELD_LABELS[field],
                serverValue: normalizedServer,
                clientValue: normalizedClient,
              });
            }
          }

          // Only return 409 if there are actual field conflicts
          if (conflicts.length > 0) {
            return reply.status(409).send({
              statusCode: 409,
              code: 'CONFLICT_DETECTED',
              message: 'Cet élément a été modifié par un autre utilisateur depuis votre dernière lecture.',
              serverUpdatedAt,
              conflicts,
            });
          }
        }
      }

      // Save state before update for audit
      const beforeState = serializeItemForAudit(existingItem);

      // Handle tag updates
      if (tagIds !== undefined) {
        await fastify.prisma.itemTag.deleteMany({
          where: { itemId: request.params.id },
        });
      }

      // Auto-set endDate to now when status changes to 'done' or 'cancelled', unless already defined
      const autoEndDate = (updateData.status === 'done' || updateData.status === 'cancelled') && updateData.endDate === undefined && !existingItem.endDate
        ? new Date()
        : undefined;

      const item = await fastify.prisma.item.update({
        where: { id: request.params.id },
        data: {
          ...updateData,
          dueDate: updateData.dueDate === null ? null : updateData.dueDate ? new Date(updateData.dueDate) : undefined,
          startDate: updateData.startDate === null ? null : updateData.startDate ? new Date(updateData.startDate) : undefined,
          endDate: updateData.endDate === null ? null : updateData.endDate ? new Date(updateData.endDate) : (autoEndDate || undefined),
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        } as any,
        include: {
          tags: { include: { tag: true } },
        },
      });

      // Audit log for UPDATE
      await createAuditLog(fastify.prisma, {
        action: 'UPDATE',
        entity: 'Item',
        entityId: item.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: beforeState,
          after: serializeItemForAudit(item),
        },
      });

      // Notify @mentioned users in updated description
      if (updateData.description && updateData.description !== existingItem.description) {
        const authorName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await notifyMentionedUsers(fastify.prisma, updateData.description, request.user.userId, authorName, item.id, item.title, request.params.spaceId);
      }

      // Notify on assignment change
      if (updateData.assignedToId && updateData.assignedToId !== existingItem.assignedToId && updateData.assignedToId !== request.user.userId) {
        const assignerName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await createNotification(fastify.prisma, {
          userId: updateData.assignedToId,
          type: 'ASSIGNMENT',
          title: `${assignerName} vous a assigné « ${item.title} »`,
          link: `/spaces/${request.params.spaceId}`,
          metadata: { actorId: request.user.userId, actorName: assignerName, itemId: item.id, itemTitle: item.title },
        });
      }

      return {
        ...item,
        tags: item.tags.map((t) => t.tag),
      };
    }
  );

  // Delete item
  fastify.delete<{ Params: { spaceId: string; id: string }; Querystring: { deleteChildren?: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
      return reply.forbidden('Insufficient permissions');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    const deleteChildren = request.query.deleteChildren === 'true';
    const batchId = crypto.randomUUID();

    if (deleteChildren) {
      // Recursively collect all descendant IDs
      const collectDescendantIds = async (parentId: string): Promise<string[]> => {
        const children = await fastify.prisma.item.findMany({
          where: { parentId, spaceId: request.params.spaceId },
          select: { id: true },
        });
        const ids: string[] = [];
        for (const child of children) {
          ids.push(child.id);
          ids.push(...await collectDescendantIds(child.id));
        }
        return ids;
      };

      const descendantIds = await collectDescendantIds(request.params.id);

      if (descendantIds.length > 0) {
        // Fetch full data for each descendant BEFORE deleting (for audit)
        const descendants = await fastify.prisma.item.findMany({
          where: { id: { in: descendantIds } },
        });

        await fastify.prisma.item.deleteMany({
          where: { id: { in: descendantIds } },
        });

        // Audit log for EACH descendant individually
        for (const descendant of descendants) {
          await createAuditLog(fastify.prisma, {
            action: 'DELETE',
            entity: 'Item',
            entityId: descendant.id,
            userId: request.user.userId,
            spaceId: request.params.spaceId,
            batchId,
            changes: {
              before: serializeItemForAudit(descendant),
            },
          });
        }
      }
    }

    // Save state before delete for audit
    const beforeState = serializeItemForAudit(item);

    await fastify.prisma.item.delete({
      where: { id: request.params.id },
    });

    // Audit log for DELETE (parent item)
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Item',
      entityId: item.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      batchId: deleteChildren ? batchId : undefined,
      changes: {
        before: beforeState,
      },
    });

    return { success: true };
  });
};
