/*
 * Déplacement d'un item dans l'arborescence (parentId + position) avec renumérotation des
 * frères. Utilisé par le DnD des vues (ListView, Gantt). Garde anti-cycle.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const moveItemSchema = z.object({
  parentId: z.string().nullable().optional(),
  position: z.number().int().min(0),
});

const bulkMoveSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
});

export const itemMoveRoutes: FastifyPluginAsync = async (fastify) => {
  // Move item (change parent and/or position)
  fastify.patch<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof moveItemSchema>;
  }>('/:id/move', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
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

    // Members can reorganize any item (move = structural operation, not content edit)

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

  // Reorder siblings by new position order
  const reorderSchema = z.object({
    // Array of { parentId, itemIds[] } — each group reorders siblings under that parent
    groups: z.array(z.object({
      parentId: z.string().nullable(),
      itemIds: z.array(z.string()).min(1),
    })).min(1),
  });

  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof reorderSchema>;
  }>('/reorder', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot reorder items');
    }

    const { groups } = reorderSchema.parse(request.body);

    const updates = groups.flatMap(group =>
      group.itemIds.map((id, index) =>
        fastify.prisma.item.updateMany({
          where: { id, spaceId: request.params.spaceId, parentId: group.parentId },
          data: { position: index },
        })
      )
    );

    await fastify.prisma.$transaction(updates);

    return { success: true };
  });

  // Bulk move items to another space
  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof bulkMoveSchema>;
  }>('/bulk-move', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot move items');
    }

    const body = bulkMoveSchema.parse(request.body);
    const { itemIds, targetSpaceId, includeChildren } = body;

    // Check access to target space
    const targetMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, targetSpaceId);
    if (!targetMembership) {
      return reply.notFound('Target space not found');
    }

    if (targetMembership.role !== 'OWNER' && targetMembership.role !== 'MEMBER') {
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

    if (membership.role === 'MEMBER') {
      const unauthorizedItems = items.filter(i => i.createdById !== request.user.userId);
      if (unauthorizedItems.length > 0) {
        return reply.forbidden('Members can only move their own items');
      }
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
};
