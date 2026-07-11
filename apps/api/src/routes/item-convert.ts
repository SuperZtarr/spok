/* Conversion d'un item en espace : crée l'espace, migre les enfants en items racine. */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const convertToSpaceSchema = z.object({
  spaceName: z.string().min(1),
  communityId: z.string().optional(),
  parentSpaceId: z.string().optional(),
});

export const itemConvertRoutes: FastifyPluginAsync = async (fastify) => {
  // Convert an item and its children into a new space
  fastify.post<{
    Params: { spaceId: string; itemId: string };
    Body: z.infer<typeof convertToSpaceSchema>;
  }>('/:itemId/convert-to-space', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Only owners can convert items to spaces');
    }

    const body = convertToSpaceSchema.parse(request.body);

    // Get the item
    const item = await fastify.prisma.item.findFirst({
      where: { id: request.params.itemId, spaceId: request.params.spaceId },
      include: { tags: true },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    // Get source space for default communityId
    const sourceSpace = await fastify.prisma.space.findUnique({
      where: { id: request.params.spaceId },
      select: { communityId: true },
    });

    const communityId = body.communityId ?? sourceSpace?.communityId ?? undefined;

    // Collect all descendant IDs recursively
    const findDescendants = async (parentIds: string[]): Promise<string[]> => {
      if (parentIds.length === 0) return [];
      const children = await fastify.prisma.item.findMany({
        where: { parentId: { in: parentIds }, spaceId: request.params.spaceId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      const grandchildIds = await findDescendants(childIds);
      return [...childIds, ...grandchildIds];
    };

    const descendantIds = await findDescendants([item.id]);
    const allItemIds = [item.id, ...descendantIds];

    // Create the new space
    const newSpace = await fastify.prisma.space.create({
      data: {
        name: body.spaceName,
        type: 'GROUP',
        communityId: communityId || null,
        parentId: body.parentSpaceId || null,
      },
    });

    // Create OWNER membership for the current user
    await fastify.prisma.spaceMembership.create({
      data: {
        spaceId: newSpace.id,
        userId: request.user.userId,
        role: 'OWNER',
      },
    });

    // Map tags from source space to new space
    const sourceTags = await fastify.prisma.tag.findMany({
      where: { spaceId: request.params.spaceId },
    });

    // Find which tags are actually used by items being moved
    const usedTagIds = new Set<string>();
    const itemTags = await fastify.prisma.itemTag.findMany({
      where: { itemId: { in: allItemIds } },
    });
    for (const it of itemTags) {
      usedTagIds.add(it.tagId);
    }

    // Create used tags in new space and build mapping
    const sourceTagIdToNewId = new Map<string, string>();
    for (const sourceTag of sourceTags) {
      if (!usedTagIds.has(sourceTag.id)) continue;
      const newTag = await fastify.prisma.tag.create({
        data: {
          name: sourceTag.name,
          color: sourceTag.color,
          spaceId: newSpace.id,
        },
      });
      sourceTagIdToNewId.set(sourceTag.id, newTag.id);
    }

    // Get items before move for audit
    const itemsBeforeMove = await fastify.prisma.item.findMany({
      where: { id: { in: allItemIds } },
    });
    const itemsBeforeMoveMap = new Map(
      itemsBeforeMove.map((i) => [i.id, serializeItemForAudit(i as unknown as Record<string, unknown>)])
    );

    // Move all items in a transaction
    await fastify.prisma.$transaction(async (tx) => {
      for (const itemId of allItemIds) {
        const currentItem = await tx.item.findUnique({
          where: { id: itemId },
          include: { tags: true },
        });
        if (!currentItem) continue;

        // Root item loses its parent, descendants keep their hierarchy
        const isRootItem = itemId === item.id;

        await tx.item.update({
          where: { id: itemId },
          data: {
            spaceId: newSpace.id,
            parentId: isRootItem ? null : currentItem.parentId,
          },
        });

        // Remap tags
        if (currentItem.tags.length > 0) {
          await tx.itemTag.deleteMany({ where: { itemId } });
          const newTagMappings = currentItem.tags
            .map((t) => sourceTagIdToNewId.get(t.tagId))
            .filter((id): id is string => id !== undefined);
          if (newTagMappings.length > 0) {
            await tx.itemTag.createMany({
              data: newTagMappings.map((tagId) => ({ itemId, tagId })),
            });
          }
        }
      }

      // Clean up cross-space relations (keep only internal ones)
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

    // Audit: log space creation
    await createAuditLog(fastify.prisma, {
      action: 'CREATE',
      entity: 'Space',
      entityId: newSpace.id,
      userId: request.user.userId,
      spaceId: newSpace.id,
      changes: {
        after: serializeSpaceForAudit(newSpace as unknown as Record<string, unknown>),
      },
    });

    // Audit: log item moves
    for (const itemId of allItemIds) {
      const beforeState = itemsBeforeMoveMap.get(itemId);
      await createAuditLog(fastify.prisma, {
        action: 'MOVE',
        entity: 'Item',
        entityId: itemId,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: beforeState,
          after: { spaceId: newSpace.id },
        },
      });
    }

    return {
      space: newSpace,
      movedCount: allItemIds.length,
    };
  });
};
