import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createItemSchema = z.object({
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT']),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
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
  type: z.enum(['NOTE', 'PROJECT', 'TASK', 'APPOINTMENT']).optional(),
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
};
