/*
 * Routes de la vue Process (positions partagées entre membres, mise en page : pas d'audit log).
 * Nœuds — /spaces/:spaceId/process-nodes (une ligne = un item placé ; pas de ligne = item « non placé ») :
 * - GET : tout accès à l'espace (checkSpaceAccess, VIEWER compris) → { itemId, x, y, laneId }.
 * - PUT /:itemId { x, y, laneId? } : place ou déplace (upsert) — OWNER/MEMBER, item obligatoirement dans l'espace.
 *   laneId : couloir de l'espace (sinon 400) → x/y relatifs au couloir ; null → item libre (x/y absolus) ;
 *   absent → couloir inchangé.
 * - PUT (sans itemId) { positions: [{ itemId, x, y, laneId? }] } : enregistrement groupé (réorganisation, retrait
 *   d'un couloir), mêmes droits, ids hors espace ignorés, une transaction.
 * - DELETE /:itemId : retire du process (l'item n'est PAS supprimé), idempotent.
 * Couloirs — /spaces/:spaceId/process-lanes (2026-10-21, bande nommée par un item, rangement purement visuel) :
 * - GET : couloirs dans l'ordre d'empilement ; POST { itemId } : l'item devient couloir (ajouté en dernier) et cesse
 *   d'être un nœud ; PUT /order { ids } : nouvel ordre ; PUT /layout { lanes: [{ id, x, y }] } : position libre
 *   (x/y null = empilé automatiquement) ; DELETE /:laneId : supprime le couloir (ses nœuds deviennent
 *   libres via onDelete SetNull — le client convertit d'abord leurs coordonnées en absolu).
 */
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  laneId: z.string().min(1).nullable().optional(),
});

const bulkSchema = z.object({
  positions: z.array(positionSchema.extend({ itemId: z.string().min(1) })).max(2000),
});

const NODE_SELECT = { itemId: true, x: true, y: true, laneId: true } as const;
const LANE_SELECT = { id: true, itemId: true, position: true, x: true, y: true } as const;

// Position libre d'un couloir : null/null = empilé automatiquement ; deux nombres = posé à (x, y)
const laneLayoutSchema = z.object({
  lanes: z.array(z.object({
    id: z.string().min(1),
    x: z.number().finite().nullable(),
    y: z.number().finite().nullable(),
  })).max(500),
});

export const processNodesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Accès à l'espace ; en écriture, OWNER/MEMBER seulement. Envoie l'erreur (404/403) et renvoie true si refusé.
   * ⚠ Renvoyer un booléen, jamais `reply` : reply est « thenable », une fonction async qui le renvoie se résout
   * à undefined → le refus passait inaperçu et la route continuait d'écrire (faille corrigée le 2026-10-21).
   */
  async function denied(request: FastifyRequest, reply: FastifyReply, spaceId: string, write: boolean): Promise<boolean> {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
    if (!membership) { reply.notFound('Space not found'); return true; }
    if (write && membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      reply.forbidden('Viewers cannot edit the process');
      return true;
    }
    return false;
  }

  /** Tous les couloirs cités appartiennent à l'espace ? */
  async function lanesBelongToSpace(spaceId: string, laneIds: string[]) {
    const unique = [...new Set(laneIds)];
    if (unique.length === 0) return true;
    if (unique.length === 1) {
      return !!(await fastify.prisma.processLane.findFirst({ where: { id: unique[0], spaceId }, select: { id: true } }));
    }
    const found = await fastify.prisma.processLane.findMany({ where: { id: { in: unique }, spaceId }, select: { id: true } });
    return found.length === unique.length;
  }

  fastify.get<{ Params: { spaceId: string } }>(
    '/:spaceId/process-nodes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, false)) return reply;
      return fastify.prisma.processNode.findMany({ where: { spaceId }, select: NODE_SELECT });
    }
  );

  // Enregistrement groupé (bouton « Réorganiser en processus », retrait d'un couloir) : un seul appel au lieu d'un
  // par item, pour rester sous la limite de requêtes. Les ids absents de l'espace (item supprimé entre-temps) sont ignorés.
  fastify.put<{ Params: { spaceId: string }; Body: unknown }>(
    '/:spaceId/process-nodes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      const { positions } = bulkSchema.parse(request.body);
      const laneIds = positions.map((p) => p.laneId).filter((l): l is string => !!l);
      if (!(await lanesBelongToSpace(spaceId, laneIds))) return reply.badRequest('Lane not found in space');

      const ids = positions.map((p) => p.itemId);
      const valid = await fastify.prisma.item.findMany({ where: { id: { in: ids }, spaceId }, select: { id: true } });
      const validIds = new Set(valid.map((i: { id: string }) => i.id));
      const toSave = positions.filter((p) => validIds.has(p.itemId));

      return fastify.prisma.$transaction(async (tx) => {
        const saved = [];
        for (const { itemId, x, y, laneId } of toSave) {
          const lane = laneId === undefined ? {} : { laneId };
          saved.push(await tx.processNode.upsert({
            where: { spaceId_itemId: { spaceId, itemId } },
            create: { spaceId, itemId, x, y, ...lane },
            update: { x, y, ...lane },
            select: NODE_SELECT,
          }));
        }
        return saved;
      });
    }
  );

  fastify.put<{ Params: { spaceId: string; itemId: string }; Body: unknown }>(
    '/:spaceId/process-nodes/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId, itemId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      const { x, y, laneId } = positionSchema.parse(request.body);

      const item = await fastify.prisma.item.findFirst({ where: { id: itemId, spaceId }, select: { id: true } });
      if (!item) return reply.notFound('Item not found');
      if (laneId && !(await lanesBelongToSpace(spaceId, [laneId]))) return reply.badRequest('Lane not found in space');

      const lane = laneId === undefined ? {} : { laneId };
      return fastify.prisma.processNode.upsert({
        where: { spaceId_itemId: { spaceId, itemId } },
        create: { spaceId, itemId, x, y, ...lane },
        update: { x, y, ...lane },
        select: NODE_SELECT,
      });
    }
  );

  fastify.delete<{ Params: { spaceId: string; itemId: string } }>(
    '/:spaceId/process-nodes/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId, itemId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      await fastify.prisma.processNode.deleteMany({ where: { spaceId, itemId } });
      return reply.status(204).send();
    }
  );

  // ── Couloirs ──

  fastify.get<{ Params: { spaceId: string } }>(
    '/:spaceId/process-lanes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, false)) return reply;
      return fastify.prisma.processLane.findMany({ where: { spaceId }, orderBy: { position: 'asc' }, select: LANE_SELECT });
    }
  );

  fastify.post<{ Params: { spaceId: string }; Body: unknown }>(
    '/:spaceId/process-lanes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(request.body);
      const item = await fastify.prisma.item.findFirst({ where: { id: itemId, spaceId }, select: { id: true } });
      if (!item) return reply.notFound('Item not found');
      const existing = await fastify.prisma.processLane.findFirst({ where: { spaceId, itemId }, select: { id: true } });
      if (existing) return reply.conflict('Item is already a lane');

      const max = await fastify.prisma.processLane.aggregate({ where: { spaceId }, _max: { position: true } });
      const position = (max._max.position ?? -1) + 1;

      // L'item devient le titre du couloir : il cesse d'être un nœud du canevas
      const lane = await fastify.prisma.$transaction(async (tx) => {
        await tx.processNode.deleteMany({ where: { spaceId, itemId } });
        return tx.processLane.create({ data: { spaceId, itemId, position }, select: LANE_SELECT });
      });
      return reply.status(201).send(lane);
    }
  );

  fastify.put<{ Params: { spaceId: string }; Body: unknown }>(
    '/:spaceId/process-lanes/order',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      const { ids } = z.object({ ids: z.array(z.string().min(1)).max(500) }).parse(request.body);
      await fastify.prisma.$transaction(async (tx) => {
        for (const [position, id] of ids.entries()) {
          await tx.processLane.updateMany({ where: { id, spaceId }, data: { position } });
        }
      });
      return reply.status(204).send();
    }
  );

  // Déplacement libre des couloirs (glisser par le titre) et remise dans la pile (Réorganiser : x/y à null)
  fastify.put<{ Params: { spaceId: string }; Body: unknown }>(
    '/:spaceId/process-lanes/layout',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      const { lanes } = laneLayoutSchema.parse(request.body);
      await fastify.prisma.$transaction(async (tx) => {
        for (const { id, x, y } of lanes) {
          // x et y vont ensemble : un seul des deux à null remet le couloir dans la pile
          const free = x !== null && y !== null;
          await tx.processLane.updateMany({ where: { id, spaceId }, data: free ? { x, y } : { x: null, y: null } });
        }
      });
      return reply.status(204).send();
    }
  );

  fastify.delete<{ Params: { spaceId: string; laneId: string } }>(
    '/:spaceId/process-lanes/:laneId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { spaceId, laneId } = request.params;
      if (await denied(request, reply, spaceId, true)) return reply;

      await fastify.prisma.processLane.deleteMany({ where: { id: laneId, spaceId } });
      return reply.status(204).send();
    }
  );
};
