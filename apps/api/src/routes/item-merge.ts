import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const mergeItemSchema = z.object({
  targetItemId: z.string(),
  // For each field, which item to keep: 'source' or 'target'
  keep: z.object({
    title: z.enum(['source', 'target']),
    type: z.enum(['source', 'target']),
    status: z.enum(['source', 'target']),
    priority: z.enum(['source', 'target']),
    assignedToId: z.enum(['source', 'target']),
    startDate: z.enum(['source', 'target']),
    endDate: z.enum(['source', 'target']),
    dueDate: z.enum(['source', 'target']),
    url: z.enum(['source', 'target']),
    description: z.enum(['source', 'target', 'concat']),
  }),
});

const absorbChildrenSchema = z.object({
  // No body needed — absorbs all direct children
});

export const itemMergeRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /spaces/:spaceId/items/:id/merge
  // Merge source item (id) INTO target item (targetItemId)
  // Source is deleted after merge
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof mergeItemSchema>;
  }>('/merge', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) return reply.notFound('Space not found');
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot merge items');
    }

    const { targetItemId, keep } = mergeItemSchema.parse(request.body);
    const sourceId = request.params.id;

    if (sourceId === targetItemId) {
      return reply.badRequest('Cannot merge an item with itself');
    }

    // Fetch both items with relations
    const [source, target] = await Promise.all([
      fastify.prisma.item.findUnique({
        where: { id: sourceId },
        include: { tags: true, relationsFrom: true, relationsTo: true },
      }),
      fastify.prisma.item.findUnique({
        where: { id: targetItemId },
        include: { tags: true, relationsFrom: true, relationsTo: true },
      }),
    ]);

    if (!source) return reply.notFound('Source item not found');
    if (!target) return reply.notFound('Target item not found');

    const beforeSource = serializeItemForAudit(source);
    const beforeTarget = serializeItemForAudit(target);

    // Build merged data
    const pick = (field: keyof typeof keep) => keep[field] === 'source' ? source : target;

    // Description: source, target, or concatenated
    let mergedDescription: string | null = null;
    if (keep.description === 'source') {
      mergedDescription = source.description;
    } else if (keep.description === 'target') {
      mergedDescription = target.description;
    } else {
      const parts: string[] = [];
      if (target.description) parts.push(target.description);
      if (source.description) parts.push(source.description);
      mergedDescription = parts.length > 0 ? parts.join('\n<hr />\n') : null;
    }

    // Update target with merged data
    await fastify.prisma.item.update({
      where: { id: targetItemId },
      data: {
        title: pick('title').title,
        type: pick('type').type as any,
        status: pick('status').status,
        priority: pick('priority').priority,
        assignedToId: pick('assignedToId').assignedToId,
        startDate: pick('startDate').startDate,
        endDate: pick('endDate').endDate,
        dueDate: pick('dueDate').dueDate,
        url: pick('url').url,
        description: mergedDescription,
      },
    });

    // Move children from source to target
    await fastify.prisma.item.updateMany({
      where: { parentId: sourceId },
      data: { parentId: targetItemId },
    });

    // Move contributions from source to target
    await fastify.prisma.contribution.updateMany({
      where: { itemId: sourceId },
      data: { itemId: targetItemId },
    });

    // Merge tags (union) — add source tags not already on target
    const targetTagIds = new Set(target.tags.map(t => t.tagId));
    const newTagIds = source.tags.filter(t => !targetTagIds.has(t.tagId)).map(t => t.tagId);
    if (newTagIds.length > 0) {
      await fastify.prisma.itemTag.createMany({
        data: newTagIds.map(tagId => ({ itemId: targetItemId, tagId })),
        skipDuplicates: true,
      });
    }
    // Remove source item tags
    await fastify.prisma.itemTag.deleteMany({ where: { itemId: sourceId } });

    // Merge relations — transfer source relations to target (skip duplicates and self-refs)
    const existingFromPairs = new Set(target.relationsFrom.map(r => `${r.toItemId}::${r.type}`));
    const existingToPairs = new Set(target.relationsTo.map(r => `${r.fromItemId}::${r.type}`));

    for (const rel of source.relationsFrom) {
      if (rel.toItemId === targetItemId) continue; // skip self-ref
      if (existingFromPairs.has(`${rel.toItemId}::${rel.type}`)) continue; // skip duplicate
      await fastify.prisma.itemRelation.update({
        where: { id: rel.id },
        data: { fromItemId: targetItemId },
      });
    }
    for (const rel of source.relationsTo) {
      if (rel.fromItemId === targetItemId) continue;
      if (existingToPairs.has(`${rel.fromItemId}::${rel.type}`)) continue;
      await fastify.prisma.itemRelation.update({
        where: { id: rel.id },
        data: { toItemId: targetItemId },
      });
    }

    // Delete remaining relations that couldn't be transferred (duplicates)
    await fastify.prisma.itemRelation.deleteMany({
      where: { OR: [{ fromItemId: sourceId }, { toItemId: sourceId }] },
    });

    // Delete source item
    await fastify.prisma.item.delete({ where: { id: sourceId } });

    // Audit logs
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Item',
      entityId: sourceId,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: { before: { ...beforeSource, mergedInto: targetItemId } as Record<string, unknown> },
    });
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE',
      entity: 'Item',
      entityId: targetItemId,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: { before: beforeTarget, after: { mergedFrom: sourceId } as Record<string, unknown> },
    });

    // Return updated target
    const result = await fastify.prisma.item.findUnique({
      where: { id: targetItemId },
      include: { tags: true, relationsFrom: true, relationsTo: true, contributions: true },
    });

    return result;
  });

  // POST /spaces/:spaceId/items/:id/absorb-children
  // Absorb all direct children into this item
  fastify.post<{
    Params: { spaceId: string; id: string };
  }>('/absorb-children', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) return reply.notFound('Space not found');
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot absorb items');
    }

    const parentId = request.params.id;
    const parent = await fastify.prisma.item.findUnique({
      where: { id: parentId },
      include: { tags: true },
    });
    if (!parent) return reply.notFound('Item not found');

    const children = await fastify.prisma.item.findMany({
      where: { parentId },
      orderBy: { position: 'asc' },
      include: { tags: true, relationsFrom: true, relationsTo: true },
    });

    if (children.length === 0) {
      return reply.badRequest('No children to absorb');
    }

    const beforeParent = serializeItemForAudit(parent);

    // Build concatenated description
    const descParts: string[] = [];
    if (parent.description) descParts.push(parent.description);

    const parentTagIds = new Set(parent.tags.map(t => t.tagId));
    const allNewTagIds: string[] = [];

    for (const child of children) {
      // Add child content with title as separator
      if (child.title || child.description) {
        let section = '';
        if (child.title) section += `<h3>${child.title}</h3>\n`;
        if (child.description) section += child.description;
        descParts.push(section);
      }

      // Move grandchildren to parent
      await fastify.prisma.item.updateMany({
        where: { parentId: child.id },
        data: { parentId },
      });

      // Move contributions to parent
      await fastify.prisma.contribution.updateMany({
        where: { itemId: child.id },
        data: { itemId: parentId },
      });

      // Collect tags
      for (const tag of child.tags) {
        if (!parentTagIds.has(tag.tagId)) {
          parentTagIds.add(tag.tagId);
          allNewTagIds.push(tag.tagId);
        }
      }

      // Remove child tags before deleting
      await fastify.prisma.itemTag.deleteMany({ where: { itemId: child.id } });

      // Transfer relations (skip self-refs and duplicates)
      for (const rel of child.relationsFrom) {
        if (rel.toItemId === parentId) continue;
        try {
          await fastify.prisma.itemRelation.update({
            where: { id: rel.id },
            data: { fromItemId: parentId },
          });
        } catch { /* duplicate — will be cleaned up */ }
      }
      for (const rel of child.relationsTo) {
        if (rel.fromItemId === parentId) continue;
        try {
          await fastify.prisma.itemRelation.update({
            where: { id: rel.id },
            data: { toItemId: parentId },
          });
        } catch { /* duplicate */ }
      }

      // Delete remaining relations
      await fastify.prisma.itemRelation.deleteMany({
        where: { OR: [{ fromItemId: child.id }, { toItemId: child.id }] },
      });

      // Audit log for child deletion
      await createAuditLog(fastify.prisma, {
        action: 'DELETE',
        entity: 'Item',
        entityId: child.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: { before: { ...serializeItemForAudit(child), absorbedInto: parentId } as Record<string, unknown> },
      });

      // Delete child
      await fastify.prisma.item.delete({ where: { id: child.id } });
    }

    // Add new tags to parent
    if (allNewTagIds.length > 0) {
      await fastify.prisma.itemTag.createMany({
        data: allNewTagIds.map(tagId => ({ itemId: parentId, tagId })),
        skipDuplicates: true,
      });
    }

    // Update parent description
    const mergedDescription = descParts.length > 0 ? descParts.join('\n') : null;
    await fastify.prisma.item.update({
      where: { id: parentId },
      data: { description: mergedDescription },
    });

    // Audit log for parent update
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE',
      entity: 'Item',
      entityId: parentId,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: { before: beforeParent, after: { absorbedChildren: children.map(c => c.id) } as Record<string, unknown> },
    });

    const result = await fastify.prisma.item.findUnique({
      where: { id: parentId },
      include: { tags: true, relationsFrom: true, relationsTo: true, contributions: true },
    });

    return result;
  });
};
