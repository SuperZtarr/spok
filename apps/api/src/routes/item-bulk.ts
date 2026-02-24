import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
});

export const itemBulkRoutes: FastifyPluginAsync = async (fastify) => {
  // Bulk duplicate items to another space (or same space)
  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof bulkDuplicateSchema>;
  }>('/bulk-duplicate', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot duplicate items');
    }

    const body = bulkDuplicateSchema.parse(request.body);
    const { itemIds, targetSpaceId, includeChildren } = body;

    // Check access to target space
    const targetMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, targetSpaceId);
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
      if (oldItem.parentId) {
        // If parent was also duplicated, use the new parent ID
        // If same space and parent exists, keep original parentId
        const newParentId = oldIdToNewId.get(oldItem.parentId)
          || (targetSpaceId === request.params.spaceId ? oldItem.parentId : null);
        if (newParentId) {
          await fastify.prisma.item.update({
            where: { id: newItem.id },
            data: { parentId: newParentId },
          });
        }
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
};
