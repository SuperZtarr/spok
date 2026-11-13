/* Opérations en masse sur les items : duplication/déplacement multi-items vers un autre espace.
   Question dupliquée : options et réglage repris (copyQuestionData), statut « Ouverte », ni votes ni issue.
   Tags des copies : tagMapping (utils/tagScope.ts) — un tag encore visible dans l'espace d'arrivée est gardé, sinon
   repris par nom, sinon recréé en tag de l'espace d'arrivée.
   Références externes (item-external-refs, 2026-11-13) : chaque copie reprend celles de l'original, dans leur ordre.
   POST /bulk-tags (2026-11-11) : ajout / retrait de tags sur plusieurs éléments en une transaction (vue Tags). */
import { QUESTION_STATUS } from '@spok/shared';
import { copyQuestionData } from '../utils/question.js';
import { copyItemContents } from '../utils/itemContentCopy.js';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, createAuditLogs, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
import { shiftItemDates } from '../utils/dateShift.js';
import { isTagVisible, spaceTagScope, tagMapping, type TagScope } from '../utils/tagScope.js';
import { canMemberManageItem } from '../utils/itemOwnership.js';

const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
  iterations: z.number().int().min(1).max(365).default(1),
  offsetUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
});

const bulkTagsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(500),
  addTagIds: z.array(z.string().min(1)).default([]),
  removeTagIds: z.array(z.string().min(1)).default([]),
}).refine((b) => b.addTagIds.length + b.removeTagIds.length > 0, { message: 'Aucun tag à ajouter ni à retirer' });

export const itemBulkRoutes: FastifyPluginAsync = async (fastify) => {
  // Tags de plusieurs éléments en une fois (vue Tags, sélection multiple — 2026-11-11). Éléments de cet espace ou de
  // ses sous-espaces affichés (droit d'écriture vérifié par espace) ; un tag ajouté doit être visible depuis l'espace
  // de chaque élément (global, de sa communauté, ou de son espace / d'un espace parent — utils/tagScope.ts). Tags seuls : permis sur une copie de séance
  // verrouillée, comme PATCH tagIds. Une transaction ; une entrée d'audit UPDATE par élément changé (même batchId).
  fastify.post<{ Params: { spaceId: string }; Body: z.infer<typeof bulkTagsSchema> }>('/bulk-tags', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') return reply.forbidden('Viewers cannot change tags');

    const { itemIds, addTagIds, removeTagIds } = bulkTagsSchema.parse(request.body);
    const items = await fastify.prisma.item.findMany({
      where: { id: { in: [...new Set(itemIds)] } },
      select: {
        id: true, spaceId: true, createdById: true, assignedToId: true, lockedAt: true,
        space: { select: { communityId: true } }, tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });
    if (items.length === 0) return reply.notFound('No items found');

    const roleOf = new Map<string, string>([[request.params.spaceId, membership.role]]);
    for (const spaceId of new Set(items.map((i) => i.spaceId))) {
      if (spaceId === request.params.spaceId) continue;
      const m = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
      if (!m || (m.role !== 'OWNER' && m.role !== 'MEMBER')) return reply.forbidden('Cannot change tags of items in another space');
      roleOf.set(spaceId, m.role);
    }
    // Même règle que PATCH /:id : un MEMBER ne change que ses éléments (auteur ou assigné), sauf copie de séance
    // verrouillée (tags libres) ; un seul élément étranger refuse toute la requête, comme bulk-move.
    if (items.some((i) => roleOf.get(i.spaceId) === 'MEMBER' && !i.lockedAt && !canMemberManageItem(i, request.user.userId))) {
      return reply.forbidden('Members can only change tags of items they created or are assigned to');
    }

    const addTags = addTagIds.length
      ? await fastify.prisma.tag.findMany({ where: { id: { in: addTagIds } }, select: { id: true, name: true, communityId: true, spaceId: true } })
      : [];
    if (addTags.length !== new Set(addTagIds).size) return reply.notFound('Tag not found');
    const scopeOf = new Map<string, TagScope>();
    for (const spaceId of new Set(items.map((i) => i.spaceId))) scopeOf.set(spaceId, await spaceTagScope(fastify.prisma, spaceId));
    const outOfScope = items.filter((i) => addTags.some((t) => !isTagVisible(t, scopeOf.get(i.spaceId)!)));
    if (outOfScope.length > 0) {
      return reply.badRequest(`${outOfScope.length} élément(s) hors de la portée d'un tag ajouté (autre communauté, ou espace qui n'hérite pas de ce tag)`);
    }

    const changed = items.filter((i) => {
      const current = new Set(i.tags.map((t) => t.tag.id));
      return addTagIds.some((id) => !current.has(id)) || removeTagIds.some((id) => current.has(id));
    });
    const ids = changed.map((i) => i.id);
    const batchId = crypto.randomUUID();
    const nameOf = new Map(addTags.map((t) => [t.id, t.name]));

    await fastify.prisma.$transaction(async (tx) => {
      if (ids.length === 0) return;
      if (addTagIds.length) {
        await tx.itemTag.createMany({ data: ids.flatMap((itemId) => addTagIds.map((tagId) => ({ itemId, tagId }))), skipDuplicates: true });
      }
      if (removeTagIds.length) await tx.itemTag.deleteMany({ where: { itemId: { in: ids }, tagId: { in: removeTagIds } } });
      // Fiche ouverte ailleurs : la date de modification change, la fiche relit l'élément
      await tx.item.updateMany({ where: { id: { in: ids } }, data: { updatedAt: new Date() } });
      await createAuditLogs(tx, changed.map((i) => {
        const before = i.tags.map((t) => t.tag.name);
        const kept = i.tags.filter((t) => !removeTagIds.includes(t.tag.id)).map((t) => t.tag.name);
        const added = addTagIds.filter((id) => !i.tags.some((t) => t.tag.id === id)).map((id) => nameOf.get(id) ?? id);
        return {
          action: 'UPDATE' as const, entity: 'Item' as const, entityId: i.id, userId: request.user.userId, spaceId: i.spaceId, batchId,
          changes: { before: { tags: before }, after: { tags: [...kept, ...added] } },
        };
      }));
    });

    return { updated: ids.length };
  });

  // Bulk duplicate items to another space (or same space)
  fastify.post<{
    Params: { spaceId: string };
    Body: z.infer<typeof bulkDuplicateSchema>;
  }>('/bulk-duplicate', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot duplicate items');
    }

    const body = bulkDuplicateSchema.parse(request.body);
    const { itemIds, targetSpaceId, includeChildren, iterations, offsetUnit } = body;

    // Check access to target space
    const targetMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, targetSpaceId, request.isAdminMode);
    if (!targetMembership) {
      return reply.notFound('Target space not found');
    }

    if (targetMembership.role !== 'OWNER' && targetMembership.role !== 'MEMBER') {
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
      include: {
        tags: { include: { tag: true } },
        externalRefs: { orderBy: { position: 'asc' }, select: { value: true, position: true } },
      },
    });

    // Tags des copies : visibles dans l'espace cible (utils/tagScope.ts — global ou même communauté gardé, sinon tag de
    // même nom, créé dans la communauté cible s'il manque ; cible sans communauté : globaux seulement)
    const sourceTagIdToTargetId = await tagMapping(fastify.prisma, allItems.flatMap((i) => i.tags.map((t) => t.tag)), targetSpaceId);

    const allCreatedItems: any[] = [];

    for (let iteration = 1; iteration <= iterations; iteration++) {
      const shiftAmount = iteration - 1; // copie 1 = +0, copie 2 = +1 unité, copie 3 = +2 unités...

      // Mapping from old IDs to new IDs — local à cette itération
      const oldIdToNewId = new Map<string, string>();
      const createdItems: any[] = [];

      // First pass: create all items without parent relationships
      for (const item of allItems) {
        const shiftedDates = shiftItemDates(item, offsetUnit, shiftAmount);
        const newItem = await fastify.prisma.item.create({
          data: {
            type: item.type,
            title: item.title,
            description: item.description,
            content: item.content as any,
            // Question dupliquée : repart « Ouverte », options et réglage repris, sans votes ni issue
            status: item.type === 'QUESTION' ? QUESTION_STATUS.OPEN : item.status,
            priority: item.priority,
            position: item.position,
            dueDate: shiftedDates.dueDate,
            startDate: shiftedDates.startDate,
            endDate: shiftedDates.endDate,
            spaceId: targetSpaceId,
            createdById: request.user.userId,
            parentId: null, // Will be set in second pass
            // Références externes reprises telles quelles, dans leur ordre (règle item-external-refs)
            ...(item.externalRefs?.length
              ? { externalRefs: { create: item.externalRefs.map((r) => ({ value: r.value, position: r.position })) } }
              : {}),
          },
        });

        oldIdToNewId.set(item.id, newItem.id);
        createdItems.push({ oldItem: item, newItem });
        // Contenus (lot 4 : remplacent l'ancien champ url) ; fichiers partagés avec l'original, comme avant
        await copyItemContents(fastify.prisma, item.id, newItem.id, { userId: request.user.userId, copyFiles: false });
        if (item.type === 'QUESTION') {
          await copyQuestionData(fastify.prisma, item.id, newItem.id, { withVotes: false, keepOutcome: false });
        }

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

      // Duplicate relations between duplicated items (this iteration only)
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

      allCreatedItems.push(...createdItems);
    }

    return {
      success: true,
      duplicatedCount: allCreatedItems.length,
      targetSpaceId,
    };
  });
};
