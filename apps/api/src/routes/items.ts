import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  url: z.string().url().nullable().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(4).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  parentId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

const createRelationSchema = z.object({
  toItemId: z.string(),
  type: z.string(),
});

const querySchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE']).optional(),
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
            _count: { select: { children: true } },
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
        relationsFrom: {
          include: { toItem: { select: { id: true, title: true, type: true } } },
        },
        relationsTo: {
          include: { fromItem: { select: { id: true, title: true, type: true } } },
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
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    await fastify.prisma.item.delete({
      where: { id: request.params.id },
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

      await fastify.prisma.itemRelation.delete({
        where: { id: request.params.relationId },
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

    return {
      success: true,
      movedCount: allItemIds.length,
      targetSpaceId,
    };
  });
};
