/*
 * Relations entre items : CRUD + commentaire de relation. Types acceptés = RELATION_TYPES (@spok/shared :
 * blocks, relates, implements, drives) — tout autre type (ancien `depends`, `tests`, `parent`…) est refusé
 * en 400 depuis le 2026-09-28. Détection de cycle pour `drives`. La sémantique des types (ordonnancement,
 * libellés) vit côté web : apps/web/src/constants/relationTypes.ts.
 * GET /:id/links (lecture seule, vue Loupe) : parent, enfants et relations d'un item, avec leur espace. Tout lien (parent,
 * enfant, relation) vers un espace que le lecteur ne peut pas lire est retiré (filterReadableSpaceIds) : ni titre ni
 * existence divulgués. Parent et enfants sont censés être dans le même espace ; le filtre couvre les liens anciens.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { RELATION_TYPES } from '@spok/shared';
import { createAuditLog, serializeRelationForAudit } from '../utils/audit.js';
import { checkSpaceAccess, filterReadableSpaceIds } from './items.js';
import { getDrivesReachableIds } from '../utils/drivesGraph.js';

const createRelationSchema = z.object({
  toItemId: z.string(),
  type: z.enum(RELATION_TYPES),
  label: z.string().nullable().optional(),
});

const updateRelationSchema = z.object({
  type: z.enum(RELATION_TYPES).optional(),
  label: z.string().nullable().optional(),
});

/** Champs d'un item lié renvoyés à la vue Loupe, pour ses vignettes (sans description : elle arrive quand l'item est à son tour zoomé). */
const LINKED_ITEM_SELECT = {
  id: true, title: true, type: true, status: true, spaceId: true, space: { select: { name: true } },
  url: true, priority: true, dueDate: true, startDate: true, endDate: true,
  assignedToName: true, assignedTo: { select: { name: true } }, _count: { select: { children: true } },
} as const;

type LinkedItemRow = {
  id: string; title: string; type: string; status: string | null; spaceId: string; space: { name: string };
  url: string | null; priority: number | null; dueDate: Date | null; startDate: Date | null; endDate: Date | null;
  assignedToName: string | null; assignedTo: { name: string | null } | null; _count: { children: number };
};

/** Liste explicite des champs : l'item racine porte aussi ses relations brutes, qui ne doivent jamais sortir telles quelles. */
const toLinkedItem = (row: LinkedItemRow) => ({
  id: row.id, title: row.title, type: row.type, status: row.status, spaceId: row.spaceId, spaceName: row.space.name,
  url: row.url, priority: row.priority, dueDate: row.dueDate, startDate: row.startDate, endDate: row.endDate,
  assigneeName: row.assignedTo?.name ?? row.assignedToName, childCount: row._count.children,
});

export const itemRelationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Liens d'un item (vue Loupe)
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id/links', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');

    const item = await fastify.prisma.item.findFirst({
      where: { id: request.params.id, spaceId: request.params.spaceId },
      select: {
        ...LINKED_ITEM_SELECT,
        description: true,
        parent: { select: LINKED_ITEM_SELECT },
        children: { select: LINKED_ITEM_SELECT },
        relationsFrom: { select: { type: true, label: true, toItem: { select: LINKED_ITEM_SELECT } } },
        relationsTo: { select: { type: true, label: true, fromItem: { select: LINKED_ITEM_SELECT } } },
      },
    });
    if (!item) return reply.notFound('Item not found');

    // L'espace de la requête vient d'être validé par checkSpaceAccess : seuls les autres espaces sont à filtrer
    const otherSpaceIds = [
      ...(item.parent ? [item.parent.spaceId] : []),
      ...item.children.map((c) => c.spaceId),
      ...item.relationsFrom.map((r) => r.toItem.spaceId),
      ...item.relationsTo.map((r) => r.fromItem.spaceId),
    ].filter((id) => id !== request.params.spaceId);
    const readable = new Set(await filterReadableSpaceIds(fastify.prisma, request.user.userId, otherSpaceIds, request.isAdminMode));
    readable.add(request.params.spaceId);

    return {
      item: { ...toLinkedItem(item), description: item.description },
      links: [
        ...(item.parent && readable.has(item.parent.spaceId) ? [{ kind: 'parent' as const, item: toLinkedItem(item.parent) }] : []),
        ...item.children
          .filter((child) => readable.has(child.spaceId))
          .map((child) => ({ kind: 'child' as const, item: toLinkedItem(child) })),
        ...item.relationsFrom
          .filter((r) => readable.has(r.toItem.spaceId))
          .map((r) => ({ kind: 'relation' as const, direction: 'from' as const, relationType: r.type, relationLabel: r.label, item: toLinkedItem(r.toItem) })),
        ...item.relationsTo
          .filter((r) => readable.has(r.fromItem.spaceId))
          .map((r) => ({ kind: 'relation' as const, direction: 'to' as const, relationType: r.type, relationLabel: r.label, item: toLinkedItem(r.fromItem) })),
      ],
    };
  });

  // Create relation
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof createRelationSchema>;
  }>('/:id/relations', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot create relations');
    }

    const body = createRelationSchema.parse(request.body);

    // Cascade "Entraîne" : une relation drives A→B doit rester acyclique, sinon décaler A
    // en cascade finirait par redécaler A lui-même via la boucle.
    if (body.type === 'drives') {
      if (body.toItemId === request.params.id) {
        return reply.badRequest("Un item ne peut pas s'entraîner lui-même");
      }
      const reachableFromTarget = await getDrivesReachableIds(fastify.prisma, body.toItemId);
      if (reachableFromTarget.has(request.params.id)) {
        return reply.badRequest('Ce lien créerait une boucle entre les items');
      }
    }

    // Verify both items exist (fromItem must be in the request space, toItem can be cross-space)
    const [fromItem, toItem] = await Promise.all([
      fastify.prisma.item.findFirst({
        where: { id: request.params.id, spaceId: request.params.spaceId },
      }),
      fastify.prisma.item.findFirst({
        where: { id: body.toItemId },
      }),
    ]);

    if (!fromItem || !toItem) {
      return reply.notFound('One or both items not found');
    }

    // Cross-space relation: verify user can at least view the target item's space
    if (toItem.spaceId !== request.params.spaceId) {
      const targetMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, toItem.spaceId, request.isAdminMode);
      if (!targetMembership) {
        return reply.notFound('One or both items not found');
      }
    }

    const relation = await fastify.prisma.itemRelation.create({
      data: {
        fromItemId: request.params.id,
        toItemId: body.toItemId,
        type: body.type,
        label: body.label || null,
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

  // Update relation
  fastify.patch<{
    Params: { spaceId: string; id: string; relationId: string };
    Body: z.infer<typeof updateRelationSchema>;
  }>('/:id/relations/:relationId', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot update relations');
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

    const body = updateRelationSchema.parse(request.body);
    const beforeState = serializeRelationForAudit(relation);

    const updated = await fastify.prisma.itemRelation.update({
      where: { id: request.params.relationId },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.label !== undefined ? { label: body.label } : {}),
      },
    });

    await createAuditLog(fastify.prisma, {
      action: 'UPDATE_RELATION',
      entity: 'ItemRelation',
      entityId: relation.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: beforeState,
        after: serializeRelationForAudit(updated),
      },
    });

    return updated;
  });

  // Delete relation
  fastify.delete<{ Params: { spaceId: string; id: string; relationId: string } }>(
    '/:id/relations/:relationId',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
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
};
