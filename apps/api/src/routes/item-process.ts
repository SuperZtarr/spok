/*
 * Process (type d'item PROCESS, 2026-11-21) : canevas d'éléments de tous espaces — places (process_item_nodes) et
 * couloirs (process_item_lanes) rattachés à l'élément Process, comme les blocs d'un Article. Remplace le process
 * unique par espace (routes/process-nodes.ts, supprimée ; données abandonnées sans reprise, accord Thomas).
 * Droits de lecture (règles de l'Article) :
 * - un élément n'est montré que si la personne qui l'a posé (addedById) peut encore le lire — évalué à la lecture, HORS
 *   mode admin ; sinon available=false, item=null (seul itemId, clé du canevas, est renvoyé) ;
 * - le lecteur voit titre, type, statut sans accès à l'espace source : canOpen / spaceId seulement s'il le lit ;
 *   canEdit = droit de modifier l'élément source (canEditWithRole) ;
 * - relations renvoyées seulement entre éléments montrés ; parentId et refItemId des réponses d'une Question idem.
 * Droit de modifier le canevas (canEditProcess) : OWNER/MEMBER de l'espace du process (comme l'ancienne vue), process non
 * verrouillé ; mode admin = OWNER via checkSpaceAccess.
 * GET /spaces/:spaceId/items/:id/process (itemProcessReadRoutes, authentification facultative) → ProcessCanvasView.
 * Écritures (itemProcessWriteRoutes, portée authentifiée d'itemsRoutes), toutes sous canEditProcess :
 * - PUT …/process/nodes/:itemId { x, y, laneId?, confirmLessVisible? } : pose ou déplace. Nouvelle place : 400 si
 *   l'élément est le process lui-même, 403 s'il est illisible pour le demandeur (hors mode admin), 409 IS_LANE s'il est
 *   déjà un couloir, 409 LESS_VISIBLE s'il est moins visible que le process (sans confirmLessVisible). laneId : couloir
 *   du process (sinon 400) → x/y relatifs ; null → libre ; absent → inchangé.
 * - PUT …/process/nodes { positions } : enregistrement groupé (Réorganiser, retrait d'un couloir) des places EXISTANTES
 *   seulement (les autres ids sont ignorés), une transaction.
 * - DELETE …/process/nodes/:itemId : retire du process (l'élément n'est pas supprimé), idempotent.
 * - POST …/process/lanes { itemId, confirmLessVisible? } : l'élément devient couloir (en dernier) et cesse d'être une
 *   place ; mêmes contrôles qu'une nouvelle place s'il n'était pas déjà posé ; 409 s'il est déjà couloir.
 * - PUT …/process/lanes/order { ids } ; PUT …/process/lanes/layout { lanes: [{ id, x, y }] } (x/y null = pile) ;
 *   DELETE …/process/lanes/:laneId (places du couloir rendues libres via onDelete SetNull — le client convertit
 *   d'abord leurs coordonnées en absolu).
 * Mise en page : pas d'audit log (comme l'ancienne vue).
 */
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DEFAULT_STATUSES, isQuestionAnswered } from '@spok/shared';
import type { ItemType, ProcessCanvasView, ProcessItemView } from '@spok/shared';
import { checkSpaceAccess, filterReadableSpaceIds, getEffectiveVisibilities } from '../utils/articleAccess.js';
import { isLessVisible, type VisibilityInfo } from '../utils/articleVisibility.js';
import { canEditWithRole, statusesBySpace } from './item-article.js';

/** Champs d'un élément posé, lus pour le résoudre (question : réponses dans l'ordre, réponse retenue) */
export const PROCESS_ITEM_SELECT = {
  id: true, type: true, title: true, spaceId: true, parentId: true,
  createdById: true, assignedToId: true, lockedAt: true,
  status: true, priority: true, dueDate: true,
  question: { select: { chosenOptionId: true } },
  questionOptions: { select: { id: true, label: true, refItemId: true }, orderBy: { position: 'asc' } as const },
} as const;

type ProcItem = {
  id: string; type: string; title: string; spaceId: string; parentId: string | null;
  createdById: string | null; assignedToId: string | null; lockedAt: Date | string | null;
  status: string | null; priority: number | null; dueDate: Date | string | null;
  question?: { chosenOptionId: string | null } | null;
  questionOptions?: { id: string; label: string; refItemId: string | null }[];
};
type Row = { itemId: string; addedById: string | null; item: ProcItem };

const isoOrNull = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Résout des lignes (places et couloirs) pour un lecteur : Map itemId → vue (null = indisponible).
 * Les liens internes (parent, réponses) sont filtrés ensuite par loadProcessView, quand tous les montrés sont connus.
 */
export async function resolveProcessItems(prisma: any, rows: Row[], readerId: string | undefined, isAdminMode: boolean): Promise<Map<string, ProcessItemView | null>> {
  const spaceIds = [...new Set(rows.map((r) => r.item.spaceId))];
  const adders = [...new Set(rows.map((r) => r.addedById).filter((a): a is string => !!a))];
  const adderReadable = new Map<string, Set<string>>();
  for (const adder of adders) adderReadable.set(adder, new Set(await filterReadableSpaceIds(prisma, adder, spaceIds, false)));
  const readerReadable = new Set(await filterReadableSpaceIds(prisma, readerId, spaceIds, isAdminMode));
  const statuses = await statusesBySpace(prisma, spaceIds);
  const readerRole = new Map<string, string | undefined>();
  if (readerId) {
    for (const spaceId of readerReadable) readerRole.set(spaceId, (await checkSpaceAccess(prisma, readerId, spaceId, isAdminMode))?.role);
  }
  const out = new Map<string, ProcessItemView | null>();
  for (const r of rows) {
    const it = r.item;
    const available = !!r.addedById && !!adderReadable.get(r.addedById)?.has(it.spaceId);
    if (!available) { out.set(r.itemId, null); continue; }
    const canOpen = readerReadable.has(it.spaceId);
    const status = it.status && it.status !== 'undefined' ? it.status : null;
    const statusList = statuses.get(it.spaceId) ?? DEFAULT_STATUSES;
    out.set(r.itemId, {
      id: it.id,
      type: it.type as ItemType,
      title: it.title,
      status,
      statusLabel: status ? (statusList.find((s) => s.id === status)?.label ?? status) : null,
      priority: it.priority ?? null,
      dueDate: isoOrNull(it.dueDate),
      parentId: it.parentId,
      canOpen,
      canEdit: canOpen && canEditWithRole(readerRole.get(it.spaceId), it, readerId),
      spaceId: canOpen ? it.spaceId : null,
      question: it.type === 'QUESTION'
        ? {
            options: (it.questionOptions ?? []).map((o) => ({ id: o.id, label: o.label, refItemId: o.refItemId })),
            chosenOptionId: it.question?.chosenOptionId ?? null,
            decided: isQuestionAnswered(it.status), // Tranchée ou Arbitrée (2026-11-21)
          }
        : null,
    });
  }
  return out;
}

/** Charge le process (null si illisible ou pas un PROCESS) et son canevas pour le lecteur. */
export async function loadProcessView(prisma: any, spaceId: string, processId: string, readerId: string | undefined, isAdminMode: boolean): Promise<ProcessCanvasView | null> {
  const membership = await checkSpaceAccess(prisma, readerId, spaceId, isAdminMode);
  if (!membership) return null;
  const process = await prisma.item.findFirst({
    where: { id: processId, spaceId },
    select: { id: true, type: true, lockedAt: true },
  });
  if (!process || process.type !== 'PROCESS') return null;
  const [nodeRows, laneRows] = await Promise.all([
    prisma.processNode.findMany({ where: { processId }, include: { item: { select: PROCESS_ITEM_SELECT } } }),
    prisma.processLane.findMany({ where: { processId }, orderBy: { position: 'asc' }, include: { item: { select: PROCESS_ITEM_SELECT } } }),
  ]);
  const resolved = await resolveProcessItems(prisma, [...nodeRows, ...laneRows], readerId, isAdminMode);
  const shown = new Set([...resolved.entries()].filter(([, v]) => v).map(([id]) => id));
  // Liens internes limités aux éléments montrés : rien n'est révélé d'un élément absent ou indisponible
  for (const view of resolved.values()) {
    if (!view) continue;
    if (view.parentId && !shown.has(view.parentId)) view.parentId = null;
    view.question?.options.forEach((o) => { if (o.refItemId && !shown.has(o.refItemId)) o.refItemId = null; });
  }
  const relations = shown.size
    ? await prisma.itemRelation.findMany({
        where: { fromItemId: { in: [...shown] }, toItemId: { in: [...shown] } },
        select: { id: true, fromItemId: true, toItemId: true, type: true, label: true },
      })
    : [];
  return {
    processId,
    spaceId,
    canEditProcess: !process.lockedAt && (membership.role === 'OWNER' || membership.role === 'MEMBER') && !!readerId,
    nodes: nodeRows.map((n: any) => ({
      itemId: n.itemId, x: n.x, y: n.y, laneId: n.laneId ?? null,
      available: !!resolved.get(n.itemId), item: resolved.get(n.itemId) ?? null,
    })),
    lanes: laneRows.map((l: any) => ({
      id: l.id, itemId: l.itemId, position: l.position, x: l.x ?? null, y: l.y ?? null,
      available: !!resolved.get(l.itemId), item: resolved.get(l.itemId) ?? null,
    })),
    relations: relations.map((r: any) => ({ id: r.id, fromItemId: r.fromItemId, toItemId: r.toItemId, type: r.type, label: r.label ?? null })),
  };
}

export const itemProcessReadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id/process', async (request, reply) => {
    const view = await loadProcessView(fastify.prisma, request.params.spaceId, request.params.id, request.user?.userId, request.isAdminMode);
    if (!view) return reply.notFound('Process not found');
    return view;
  });
};

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  laneId: z.string().min(1).nullable().optional(),
  confirmLessVisible: z.boolean().optional(),
});
const bulkSchema = z.object({
  positions: z.array(z.object({
    itemId: z.string().min(1), x: z.number().finite(), y: z.number().finite(), laneId: z.string().min(1).nullable().optional(),
  })).max(2000),
});
const addLaneSchema = z.object({ itemId: z.string().min(1), confirmLessVisible: z.boolean().optional() });
const laneOrderSchema = z.object({ ids: z.array(z.string().min(1)).max(500) });
const laneLayoutSchema = z.object({
  lanes: z.array(z.object({ id: z.string().min(1), x: z.number().finite().nullable(), y: z.number().finite().nullable() })).max(500),
});

const NODE_SELECT = { itemId: true, x: true, y: true, laneId: true } as const;
const LANE_SELECT = { id: true, itemId: true, position: true, x: true, y: true } as const;

type Params = { spaceId: string; id: string };
type Ctx = { process: { id: string; spaceId: string }; userId: string };

const visibilityOf = (map: Map<string, any>, spaceId: string): VisibilityInfo => {
  const v = map.get(spaceId);
  return { spaceId, visibility: v?.visibility ?? 'PRIVATE', communityId: v?.communityId ?? null, communityVisibility: v?.communityVisibility ?? null };
};

export const itemProcessWriteRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma as any;

  /**
   * Process modifiable par le demandeur, sinon 404/403 envoyée et null renvoyé.
   * ⚠ Renvoyer null et tester le résultat, jamais renvoyer `reply` depuis une fonction async (thenable → undefined :
   * faille de l'ancienne vue corrigée le 2026-10-21).
   */
  async function requireProcessEditor(request: FastifyRequest, reply: FastifyReply): Promise<Ctx | null> {
    const { spaceId, id } = request.params as Params;
    const userId = request.user.userId as string;
    const membership = await checkSpaceAccess(prisma, userId, spaceId, request.isAdminMode);
    if (!membership) { reply.notFound('Process not found'); return null; }
    const process = await prisma.item.findFirst({ where: { id, spaceId }, select: { id: true, type: true, spaceId: true, lockedAt: true } });
    if (!process || process.type !== 'PROCESS') { reply.notFound('Process not found'); return null; }
    if (process.lockedAt || (membership.role !== 'OWNER' && membership.role !== 'MEMBER')) {
      reply.forbidden('You cannot edit this process');
      return null;
    }
    return { process, userId };
  }

  /** Contrôles d'une nouvelle entrée (place ou couloir) : message d'erreur envoyé et false si refusée. */
  async function checkNewEntry(ctx: Ctx, itemId: string, confirmLessVisible: boolean | undefined, reply: FastifyReply): Promise<boolean> {
    if (itemId === ctx.process.id) { reply.badRequest('A process cannot contain itself'); return false; }
    const ref = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, spaceId: true } });
    if (!ref) { reply.notFound('Item not found'); return false; }
    const readable = await filterReadableSpaceIds(prisma, ctx.userId, [ref.spaceId], false);
    if (readable.length === 0) { reply.forbidden('You cannot read this item'); return false; }
    if (!confirmLessVisible && ref.spaceId !== ctx.process.spaceId) {
      const vis = await getEffectiveVisibilities(prisma, [ctx.process.spaceId, ref.spaceId]);
      if (isLessVisible(visibilityOf(vis, ctx.process.spaceId), visibilityOf(vis, ref.spaceId))) {
        reply.status(409).send({ statusCode: 409, code: 'LESS_VISIBLE', message: 'Item is less visible than the process' });
        return false;
      }
    }
    return true;
  }

  /** Tous les couloirs cités appartiennent au process ? */
  async function lanesBelong(processId: string, laneIds: string[]) {
    const unique = [...new Set(laneIds)];
    if (unique.length === 0) return true;
    const found = await prisma.processLane.findMany({ where: { id: { in: unique }, processId }, select: { id: true } });
    return found.length === unique.length;
  }

  fastify.put<{ Params: Params & { itemId: string } }>('/:id/process/nodes/:itemId', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    const { itemId } = request.params;
    const { x, y, laneId, confirmLessVisible } = positionSchema.parse(request.body);
    if (laneId && !(await lanesBelong(ctx.process.id, [laneId]))) return reply.badRequest('Lane not found in process');
    const lane = laneId === undefined ? {} : { laneId };
    const existing = await prisma.processNode.findUnique({ where: { processId_itemId: { processId: ctx.process.id, itemId } }, select: { id: true } });
    if (existing) {
      return prisma.processNode.update({ where: { id: existing.id }, data: { x, y, ...lane }, select: NODE_SELECT });
    }
    if (await prisma.processLane.findFirst({ where: { processId: ctx.process.id, itemId }, select: { id: true } })) {
      return reply.status(409).send({ statusCode: 409, code: 'IS_LANE', message: 'Item is a lane of this process' });
    }
    if (!(await checkNewEntry(ctx, itemId, confirmLessVisible, reply))) return reply;
    const created = await prisma.processNode.create({
      data: { processId: ctx.process.id, itemId, x, y, addedById: ctx.userId, ...lane },
      select: NODE_SELECT,
    });
    return reply.status(201).send(created);
  });

  // Enregistrement groupé (Réorganiser, retrait d'un couloir) : places existantes seulement, un seul appel
  fastify.put<{ Params: Params }>('/:id/process/nodes', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    const { positions } = bulkSchema.parse(request.body);
    const laneIds = positions.map((p) => p.laneId).filter((l): l is string => !!l);
    if (!(await lanesBelong(ctx.process.id, laneIds))) return reply.badRequest('Lane not found in process');
    return prisma.$transaction(async (tx: any) => {
      for (const { itemId, x, y, laneId } of positions) {
        await tx.processNode.updateMany({
          where: { processId: ctx.process.id, itemId },
          data: { x, y, ...(laneId === undefined ? {} : { laneId }) },
        });
      }
      return tx.processNode.findMany({ where: { processId: ctx.process.id }, select: NODE_SELECT });
    });
  });

  fastify.delete<{ Params: Params & { itemId: string } }>('/:id/process/nodes/:itemId', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    await prisma.processNode.deleteMany({ where: { processId: ctx.process.id, itemId: request.params.itemId } });
    return reply.status(204).send();
  });

  // ── Couloirs ──

  fastify.post<{ Params: Params }>('/:id/process/lanes', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    const { itemId, confirmLessVisible } = addLaneSchema.parse(request.body);
    if (await prisma.processLane.findFirst({ where: { processId: ctx.process.id, itemId }, select: { id: true } })) {
      return reply.conflict('Item is already a lane');
    }
    const node = await prisma.processNode.findUnique({
      where: { processId_itemId: { processId: ctx.process.id, itemId } }, select: { id: true, addedById: true },
    });
    // Déjà posé : contrôlé à la pose, la personne qui l'avait posé reste celle dont les droits comptent
    if (!node && !(await checkNewEntry(ctx, itemId, confirmLessVisible, reply))) return reply;
    const max = await prisma.processLane.aggregate({ where: { processId: ctx.process.id }, _max: { position: true } });
    const position = (max._max.position ?? -1) + 1;
    const lane = await prisma.$transaction(async (tx: any) => {
      if (node) await tx.processNode.delete({ where: { id: node.id } });
      return tx.processLane.create({
        data: { processId: ctx.process.id, itemId, position, addedById: node?.addedById ?? ctx.userId },
        select: LANE_SELECT,
      });
    });
    return reply.status(201).send(lane);
  });

  fastify.put<{ Params: Params }>('/:id/process/lanes/order', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    const { ids } = laneOrderSchema.parse(request.body);
    await prisma.$transaction(async (tx: any) => {
      for (const [position, id] of ids.entries()) await tx.processLane.updateMany({ where: { id, processId: ctx.process.id }, data: { position } });
    });
    return reply.status(204).send();
  });

  // Déplacement libre (glisser par le titre) et remise dans la pile (x/y à null)
  fastify.put<{ Params: Params }>('/:id/process/lanes/layout', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    const { lanes } = laneLayoutSchema.parse(request.body);
    await prisma.$transaction(async (tx: any) => {
      for (const { id, x, y } of lanes) {
        // x et y vont ensemble : un seul des deux à null remet le couloir dans la pile
        const free = x !== null && y !== null;
        await tx.processLane.updateMany({ where: { id, processId: ctx.process.id }, data: free ? { x, y } : { x: null, y: null } });
      }
    });
    return reply.status(204).send();
  });

  fastify.delete<{ Params: Params & { laneId: string } }>('/:id/process/lanes/:laneId', async (request, reply) => {
    const ctx = await requireProcessEditor(request, reply);
    if (!ctx) return reply;
    await prisma.processLane.deleteMany({ where: { id: request.params.laneId, processId: ctx.process.id } });
    return reply.status(204).send();
  });
};
