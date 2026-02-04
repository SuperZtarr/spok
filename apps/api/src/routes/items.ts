import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit, serializeRelationForAudit } from '../utils/audit.js';

const createItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().nullable().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(4).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  parentId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

const createRelationSchema = z.object({
  toItemId: z.string(),
  type: z.string(),
});

const querySchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']).optional(),
  status: z.string().optional(),
  parentId: z.string().nullable().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const moveItemSchema = z.object({
  parentId: z.string().nullable().optional(),
  position: z.number().int().min(0),
});

const bulkMoveSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
});

const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
});

const createContributionSchema = z.object({
  content: z.string().min(1),
});

const updateContributionSchema = z.object({
  content: z.string().min(1),
});

export const itemsRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to check space access
  async function checkSpaceAccess(userId: string, spaceId: string) {
    return fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: { userId, spaceId },
      },
    });
  }

  // List items
  fastify.get<{ Params: { spaceId: string }; Querystring: z.infer<typeof querySchema> }>(
    '/',
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const query = querySchema.parse(request.query);
      const { page, pageSize, type, status, parentId, search } = query;

      const where: any = { spaceId: request.params.spaceId };

      if (type) where.type = type;
      if (status) where.status = status;
      if (parentId !== undefined) where.parentId = parentId === '' ? null : parentId;
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const [items, total] = await Promise.all([
        fastify.prisma.item.findMany({
          where,
          include: {
            tags: { include: { tag: true } },
            children: { select: { id: true } },
            _count: { select: { children: true, contributions: true } },
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        fastify.prisma.item.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          ...item,
          tags: item.tags.map((t) => t.tag),
          childCount: item._count.children,
          contributionCount: item._count.contributions,
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
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
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
          startDate: itemData.startDate ? new Date(itemData.startDate) : undefined,
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

      return reply.status(201).send({
        ...item,
        tags: item.tags.map((t) => t.tag),
      });
    }
  );

  // Get item by ID
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
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
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
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
      const { tagIds, ...updateData } = body;

      // Save state before update for audit
      const beforeState = serializeItemForAudit(existingItem);

      // Handle tag updates
      if (tagIds !== undefined) {
        await fastify.prisma.itemTag.deleteMany({
          where: { itemId: request.params.id },
        });
      }

      const item = await fastify.prisma.item.update({
        where: { id: request.params.id },
        data: {
          ...updateData,
          dueDate: updateData.dueDate === null ? null : updateData.dueDate ? new Date(updateData.dueDate) : undefined,
          startDate: updateData.startDate === null ? null : updateData.startDate ? new Date(updateData.startDate) : undefined,
          endDate: updateData.endDate === null ? null : updateData.endDate ? new Date(updateData.endDate) : undefined,
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

      return {
        ...item,
        tags: item.tags.map((t) => t.tag),
      };
    }
  );

  // Delete item
  fastify.delete<{ Params: { spaceId: string; id: string } }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
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

    // Save state before delete for audit
    const beforeState = serializeItemForAudit(item);

    await fastify.prisma.item.delete({
      where: { id: request.params.id },
    });

    // Audit log for DELETE
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Item',
      entityId: item.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: beforeState,
      },
    });

    return { success: true };
  });

  // Create relation
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof createRelationSchema>;
  }>('/:id/relations', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot create relations');
    }

    const body = createRelationSchema.parse(request.body);

    // Verify both items exist in the space
    const [fromItem, toItem] = await Promise.all([
      fastify.prisma.item.findFirst({
        where: { id: request.params.id, spaceId: request.params.spaceId },
      }),
      fastify.prisma.item.findFirst({
        where: { id: body.toItemId, spaceId: request.params.spaceId },
      }),
    ]);

    if (!fromItem || !toItem) {
      return reply.notFound('One or both items not found');
    }

    const relation = await fastify.prisma.itemRelation.create({
      data: {
        fromItemId: request.params.id,
        toItemId: body.toItemId,
        type: body.type,
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

  // Delete relation
  fastify.delete<{ Params: { spaceId: string; id: string; relationId: string } }>(
    '/:id/relations/:relationId',
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
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

  // Move item (change parent and/or position)
  fastify.patch<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof moveItemSchema>;
  }>('/:id/move', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot move items');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    const body = moveItemSchema.parse(request.body);
    const newParentId = body.parentId === undefined ? item.parentId : body.parentId;
    const newPosition = body.position;

    // Save state before move for audit
    const beforeState = {
      parentId: item.parentId,
      position: item.position,
    };

    // Prevent moving an item to be its own descendant
    if (newParentId) {
      let parent = await fastify.prisma.item.findUnique({ where: { id: newParentId } });
      while (parent) {
        if (parent.id === request.params.id) {
          return reply.badRequest('Cannot move an item to be its own descendant');
        }
        parent = parent.parentId
          ? await fastify.prisma.item.findUnique({ where: { id: parent.parentId } })
          : null;
      }
    }

    // Get siblings at the new location
    const siblings = await fastify.prisma.item.findMany({
      where: {
        spaceId: request.params.spaceId,
        parentId: newParentId,
        id: { not: request.params.id },
      },
      orderBy: { position: 'asc' },
    });

    // Reorder siblings
    const updates = siblings.map((sibling, index) => {
      const pos = index >= newPosition ? index + 1 : index;
      return fastify.prisma.item.update({
        where: { id: sibling.id },
        data: { position: pos },
      });
    });

    // Update the moved item
    updates.push(
      fastify.prisma.item.update({
        where: { id: request.params.id },
        data: {
          parentId: newParentId,
          position: newPosition,
        },
      })
    );

    await fastify.prisma.$transaction(updates);

    // Audit log for MOVE
    await createAuditLog(fastify.prisma, {
      action: 'MOVE',
      entity: 'Item',
      entityId: item.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: beforeState,
        after: {
          parentId: newParentId,
          position: newPosition,
        },
      },
    });

    return { success: true };
  });

  // Bulk move items to another space
  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof bulkMoveSchema>;
  }>('/bulk-move', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot move items');
    }

    const body = bulkMoveSchema.parse(request.body);
    const { itemIds, targetSpaceId, includeChildren } = body;

    // Check access to target space
    const targetMembership = await checkSpaceAccess(request.user.userId, targetSpaceId);
    if (!targetMembership) {
      return reply.notFound('Target space not found');
    }

    if (targetMembership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot add items to the target space');
    }

    if (targetSpaceId === request.params.spaceId) {
      return reply.badRequest('Cannot move items to the same space');
    }

    // Get items to move
    const items = await fastify.prisma.item.findMany({
      where: {
        id: { in: itemIds },
        spaceId: request.params.spaceId,
      },
      include: {
        tags: true,
      },
    });

    if (items.length === 0) {
      return reply.notFound('No items found to move');
    }

    // Collect all item IDs to move (including children if requested)
    let allItemIds = items.map((item) => item.id);

    if (includeChildren) {
      // Recursively find all descendants
      const findDescendants = async (parentIds: string[]): Promise<string[]> => {
        if (parentIds.length === 0) return [];

        const children = await fastify.prisma.item.findMany({
          where: {
            parentId: { in: parentIds },
            spaceId: request.params.spaceId,
          },
          select: { id: true },
        });

        const childIds = children.map((c) => c.id);
        const grandchildIds = await findDescendants(childIds);
        return [...childIds, ...grandchildIds];
      };

      const descendantIds = await findDescendants(allItemIds);
      allItemIds = [...new Set([...allItemIds, ...descendantIds])];
    }

    // Get tags from target space for mapping
    const targetTags = await fastify.prisma.tag.findMany({
      where: { spaceId: targetSpaceId },
    });
    const sourceTags = await fastify.prisma.tag.findMany({
      where: { spaceId: request.params.spaceId },
    });

    // Create a mapping of source tag names to target tag IDs
    const tagNameToTargetId = new Map<string, string>();
    for (const tag of targetTags) {
      tagNameToTargetId.set(tag.name.toLowerCase(), tag.id);
    }

    // Create missing tags in target space and build complete mapping
    const sourceTagIdToTargetId = new Map<string, string>();
    for (const sourceTag of sourceTags) {
      const existingTargetId = tagNameToTargetId.get(sourceTag.name.toLowerCase());
      if (existingTargetId) {
        sourceTagIdToTargetId.set(sourceTag.id, existingTargetId);
      } else {
        // Create tag in target space
        const newTag = await fastify.prisma.tag.create({
          data: {
            name: sourceTag.name,
            color: sourceTag.color,
            spaceId: targetSpaceId,
          },
        });
        sourceTagIdToTargetId.set(sourceTag.id, newTag.id);
      }
    }

    // Get items before move for audit
    const itemsBeforeMove = await fastify.prisma.item.findMany({
      where: { id: { in: allItemIds } },
    });
    const itemsBeforeMoveMap = new Map(
      itemsBeforeMove.map((item) => [item.id, serializeItemForAudit(item)])
    );

    // Move items in a transaction
    await fastify.prisma.$transaction(async (tx) => {
      // For each item, update spaceId and handle parent references
      for (const itemId of allItemIds) {
        const item = await tx.item.findUnique({
          where: { id: itemId },
          include: { tags: true },
        });

        if (!item) continue;

        // Check if parent is being moved too
        const parentIsMoving = item.parentId && allItemIds.includes(item.parentId);

        // Update item
        await tx.item.update({
          where: { id: itemId },
          data: {
            spaceId: targetSpaceId,
            // Reset parent if parent is not being moved
            parentId: parentIsMoving ? item.parentId : null,
            position: parentIsMoving ? item.position : 0,
          },
        });

        // Update tags - delete old and create new mappings
        if (item.tags.length > 0) {
          await tx.itemTag.deleteMany({
            where: { itemId: itemId },
          });

          const newTagMappings = item.tags
            .map((t) => sourceTagIdToTargetId.get(t.tagId))
            .filter((id): id is string => id !== undefined);

          if (newTagMappings.length > 0) {
            await tx.itemTag.createMany({
              data: newTagMappings.map((tagId) => ({
                itemId: itemId,
                tagId: tagId,
              })),
            });
          }
        }
      }

      // Handle relations - keep only relations where both items are in target space
      // (either already there or being moved)
      await tx.itemRelation.deleteMany({
        where: {
          OR: [
            { fromItemId: { in: allItemIds } },
            { toItemId: { in: allItemIds } },
          ],
          NOT: {
            AND: [
              { fromItemId: { in: allItemIds } },
              { toItemId: { in: allItemIds } },
            ],
          },
        },
      });
    });

    // Audit log for BULK_MOVE - one log entry per item
    for (const itemId of allItemIds) {
      const beforeState = itemsBeforeMoveMap.get(itemId);
      await createAuditLog(fastify.prisma, {
        action: 'BULK_MOVE',
        entity: 'Item',
        entityId: itemId,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: beforeState,
          after: {
            spaceId: targetSpaceId,
          },
        },
      });
    }

    return {
      success: true,
      movedCount: allItemIds.length,
      targetSpaceId,
    };
  });

  // Bulk duplicate items to another space (or same space)
  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof bulkDuplicateSchema>;
  }>('/bulk-duplicate', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot duplicate items');
    }

    const body = bulkDuplicateSchema.parse(request.body);
    const { itemIds, targetSpaceId, includeChildren } = body;

    // Check access to target space
    const targetMembership = await checkSpaceAccess(request.user.userId, targetSpaceId);
    if (!targetMembership) {
      return reply.notFound('Target space not found');
    }

    if (targetMembership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot add items to the target space');
    }

    // Get items to duplicate
    const items = await fastify.prisma.item.findMany({
      where: {
        id: { in: itemIds },
        spaceId: request.params.spaceId,
      },
      include: {
        tags: true,
      },
    });

    if (items.length === 0) {
      return reply.notFound('No items found to duplicate');
    }

    // Collect all item IDs to duplicate (including children if requested)
    let allItemIds = items.map((item) => item.id);

    if (includeChildren) {
      // Recursively find all descendants
      const findDescendants = async (parentIds: string[]): Promise<string[]> => {
        if (parentIds.length === 0) return [];

        const children = await fastify.prisma.item.findMany({
          where: {
            parentId: { in: parentIds },
            spaceId: request.params.spaceId,
          },
          select: { id: true },
        });

        const childIds = children.map((c) => c.id);
        const grandchildIds = await findDescendants(childIds);
        return [...childIds, ...grandchildIds];
      };

      const descendantIds = await findDescendants(allItemIds);
      allItemIds = [...new Set([...allItemIds, ...descendantIds])];
    }

    // Get all items to duplicate with their data
    const allItems = await fastify.prisma.item.findMany({
      where: { id: { in: allItemIds } },
      include: { tags: true },
    });

    // Get tags from target space for mapping
    const targetTags = await fastify.prisma.tag.findMany({
      where: { spaceId: targetSpaceId },
    });
    const sourceTags = await fastify.prisma.tag.findMany({
      where: { spaceId: request.params.spaceId },
    });

    // Create a mapping of source tag names to target tag IDs
    const tagNameToTargetId = new Map<string, string>();
    for (const tag of targetTags) {
      tagNameToTargetId.set(tag.name.toLowerCase(), tag.id);
    }

    // Create missing tags in target space and build complete mapping
    const sourceTagIdToTargetId = new Map<string, string>();
    for (const sourceTag of sourceTags) {
      const existingTargetId = tagNameToTargetId.get(sourceTag.name.toLowerCase());
      if (existingTargetId) {
        sourceTagIdToTargetId.set(sourceTag.id, existingTargetId);
      } else {
        // Create tag in target space
        const newTag = await fastify.prisma.tag.create({
          data: {
            name: sourceTag.name,
            color: sourceTag.color,
            spaceId: targetSpaceId,
          },
        });
        sourceTagIdToTargetId.set(sourceTag.id, newTag.id);
      }
    }

    // Create a mapping from old IDs to new IDs
    const oldIdToNewId = new Map<string, string>();

    // First pass: create all items without parent relationships
    const createdItems: any[] = [];
    for (const item of allItems) {
      const newItem = await fastify.prisma.item.create({
        data: {
          type: item.type,
          title: item.title,
          description: item.description,
          content: item.content as any,
          url: item.url,
          status: item.status,
          priority: item.priority,
          position: item.position,
          dueDate: item.dueDate,
          spaceId: targetSpaceId,
          createdById: request.user.userId,
          parentId: null, // Will be set in second pass
        },
      });

      oldIdToNewId.set(item.id, newItem.id);
      createdItems.push({ oldItem: item, newItem });

      // Create tag associations
      if (item.tags.length > 0) {
        const newTagMappings = item.tags
          .map((t) => sourceTagIdToTargetId.get(t.tagId))
          .filter((id): id is string => id !== undefined);

        if (newTagMappings.length > 0) {
          await fastify.prisma.itemTag.createMany({
            data: newTagMappings.map((tagId) => ({
              itemId: newItem.id,
              tagId: tagId,
            })),
          });
        }
      }
    }

    // Second pass: update parent relationships
    for (const { oldItem, newItem } of createdItems) {
      if (oldItem.parentId && oldIdToNewId.has(oldItem.parentId)) {
        await fastify.prisma.item.update({
          where: { id: newItem.id },
          data: { parentId: oldIdToNewId.get(oldItem.parentId) },
        });
      }
    }

    // Duplicate relations between duplicated items
    const relations = await fastify.prisma.itemRelation.findMany({
      where: {
        fromItemId: { in: allItemIds },
        toItemId: { in: allItemIds },
      },
    });

    for (const relation of relations) {
      const newFromId = oldIdToNewId.get(relation.fromItemId);
      const newToId = oldIdToNewId.get(relation.toItemId);
      if (newFromId && newToId) {
        await fastify.prisma.itemRelation.create({
          data: {
            fromItemId: newFromId,
            toItemId: newToId,
            type: relation.type,
          },
        });
      }
    }

    // Audit log for duplication
    for (const { oldItem, newItem } of createdItems) {
      await createAuditLog(fastify.prisma, {
        action: 'CREATE',
        entity: 'Item',
        entityId: newItem.id,
        userId: request.user.userId,
        spaceId: targetSpaceId,
        changes: {
          after: serializeItemForAudit(newItem),
          duplicatedFrom: oldItem.id,
        } as any,
      });
    }

    return {
      success: true,
      duplicatedCount: createdItems.length,
      targetSpaceId,
    };
  });

  // ============================================
  // CONTRIBUTIONS
  // ============================================

  // List contributions for an item
  fastify.get<{ Params: { spaceId: string; id: string } }>(
    '/:id/contributions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const item = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!item) {
        return reply.notFound('Item not found');
      }

      const contributions = await fastify.prisma.contribution.findMany({
        where: { itemId: request.params.id },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return contributions;
    }
  );

  // Create a contribution
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof createContributionSchema>;
  }>('/:id/contributions', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot create contributions');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    const body = createContributionSchema.parse(request.body);

    const contribution = await fastify.prisma.contribution.create({
      data: {
        content: body.content,
        itemId: request.params.id,
        authorId: request.user.userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(fastify.prisma, {
      action: 'CREATE',
      entity: 'Contribution',
      entityId: contribution.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        after: { content: contribution.content, itemId: contribution.itemId },
      },
    });

    return reply.status(201).send(contribution);
  });

  // Update a contribution
  fastify.patch<{
    Params: { spaceId: string; id: string; contributionId: string };
    Body: z.infer<typeof updateContributionSchema>;
  }>('/:id/contributions/:contributionId', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const contribution = await fastify.prisma.contribution.findFirst({
      where: {
        id: request.params.contributionId,
        itemId: request.params.id,
      },
    });

    if (!contribution) {
      return reply.notFound('Contribution not found');
    }

    // Only author, space admins, or owners can update
    const canUpdate =
      contribution.authorId === request.user.userId ||
      ['OWNER', 'ADMIN'].includes(membership.role);

    if (!canUpdate) {
      return reply.forbidden('You cannot update this contribution');
    }

    const body = updateContributionSchema.parse(request.body);
    const beforeContent = contribution.content;

    const updated = await fastify.prisma.contribution.update({
      where: { id: request.params.contributionId },
      data: { content: body.content },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE',
      entity: 'Contribution',
      entityId: updated.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: { content: beforeContent },
        after: { content: updated.content },
      },
    });

    return updated;
  });

  // Delete a contribution
  fastify.delete<{ Params: { spaceId: string; id: string; contributionId: string } }>(
    '/:id/contributions/:contributionId',
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const contribution = await fastify.prisma.contribution.findFirst({
        where: {
          id: request.params.contributionId,
          itemId: request.params.id,
        },
      });

      if (!contribution) {
        return reply.notFound('Contribution not found');
      }

      // Only author, space admins, or owners can delete
      const canDelete =
        contribution.authorId === request.user.userId ||
        ['OWNER', 'ADMIN'].includes(membership.role);

      if (!canDelete) {
        return reply.forbidden('You cannot delete this contribution');
      }

      await fastify.prisma.contribution.delete({
        where: { id: request.params.contributionId },
      });

      // Audit log
      await createAuditLog(fastify.prisma, {
        action: 'DELETE',
        entity: 'Contribution',
        entityId: contribution.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: { content: contribution.content, itemId: contribution.itemId },
        },
      });

      return { success: true };
    }
  );
};
