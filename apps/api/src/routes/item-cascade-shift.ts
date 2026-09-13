/* Décalage en cascade des dates des dépendants d'un item ancre via une relation 'drives'
 * ("Entraîne"). Le client (ItemEditModal, TimelineView) calcule et affiche la liste des
 * dépendants affectés pour confirmation ; cette route revalide côté serveur que chaque id
 * confirmé est bien atteignable depuis l'ancre avant d'appliquer le décalage — ne fait jamais
 * confiance à la liste envoyée par le client seule (TOCTOU entre la prévisualisation et l'envoi). */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
import { shiftItemDates } from '../utils/dateShift.js';
import { getDrivesReachableIds } from '../utils/drivesGraph.js';

const cascadeShiftSchema = z.object({
  deltaDays: z.number().int(),
  dependentIds: z.array(z.string()).min(1),
});

export const itemCascadeShiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof cascadeShiftSchema>;
  }>('/:id/cascade-shift', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot shift item dates');
    }

    const body = cascadeShiftSchema.parse(request.body);

    const anchor = await fastify.prisma.item.findFirst({
      where: { id: request.params.id, spaceId: request.params.spaceId },
    });
    if (!anchor) {
      return reply.notFound('Anchor item not found');
    }

    const reachable = await getDrivesReachableIds(fastify.prisma, anchor.id);
    const invalidIds = body.dependentIds.filter((id) => !reachable.has(id));
    if (invalidIds.length > 0) {
      return reply.badRequest(`Éléments non atteignables via une relation "drives" depuis l'ancre : ${invalidIds.join(', ')}`);
    }

    const dependents = await fastify.prisma.item.findMany({
      where: { id: { in: body.dependentIds } },
    });

    // Les relations drives peuvent être cross-space (même règle que la création de relation) —
    // vérifier l'accès en écriture à chaque espace distinct touché, pas seulement celui de l'ancre.
    const dependentSpaceIds = [...new Set(dependents.map((d) => d.spaceId).filter((id): id is string => !!id))];
    for (const depSpaceId of dependentSpaceIds) {
      if (depSpaceId === request.params.spaceId) continue;
      const depMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, depSpaceId);
      if (!depMembership || (depMembership.role !== 'OWNER' && depMembership.role !== 'MEMBER')) {
        return reply.forbidden(`Accès insuffisant à l'espace d'un élément lié (${depSpaceId})`);
      }
    }

    let shiftedCount = 0;
    for (const dep of dependents) {
      const beforeState = serializeItemForAudit(dep);
      const shiftedDates = shiftItemDates(dep, 'day', body.deltaDays);
      const newItem = await fastify.prisma.item.update({
        where: { id: dep.id },
        data: shiftedDates,
      });
      shiftedCount += 1;

      await createAuditLog(fastify.prisma, {
        action: 'UPDATE',
        entity: 'Item',
        entityId: dep.id,
        userId: request.user.userId,
        spaceId: dep.spaceId,
        changes: {
          before: beforeState,
          after: serializeItemForAudit(newItem),
        },
      });
    }

    return { success: true, shiftedCount };
  });
};
