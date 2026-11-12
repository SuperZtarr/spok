/*
 * GET /spaces/:spaceId/items/:id/history?before=<ISO> — historique d'un élément pour sa fiche (règle
 * item-history-members, décision Thomas 2026-11-12) : toute personne connectée qui peut lire l'espace (propriétaire,
 * membre, lecteur ; admin en mode admin). L'historique de l'espace et la restauration restent réservés à l'admin
 * (auditLogs.ts, règle space-history-admin-only) : cette route ne renvoie que des lignes libellées
 * (utils/itemHistory.ts), jamais l'état brut du journal.
 * Entrées lues : entité Item de cet élément, et relations (ItemRelation) dont il est la source ou la cible.
 * Titre d'un élément lié / nom d'un espace : seulement s'ils sont lisibles par le lecteur (filterReadableSpaceIds).
 * Pagination par date (before = nextCursor précédent), PAGE_SIZE entrées visibles par page au plus ; les entrées
 * sans ligne utile (position seule…) sont sautées.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ItemHistoryEntry, ItemHistoryResponse } from '@spok/shared';
import { checkSpaceAccess, filterReadableSpaceIds } from './items.js';
import { collectHistoryRefs, describeHistoryLog, type HistoryLog } from '../utils/itemHistory.js';
import { statusesOfSpace } from '../utils/referentiels.js';

const PAGE_SIZE = 30;
const FETCH_SIZE = 60;
const MAX_ROUNDS = 5;

const querySchema = z.object({ before: z.string().datetime().optional() });

type LogRow = HistoryLog & { id: string; createdAt: Date; user: { id: string; name: string } | null };

export const itemHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { spaceId: string; id: string }; Querystring: { before?: string } }>(
    '/:id/history',
    async (request, reply) => {
      const { spaceId, id } = request.params;
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
      if (!membership) return reply.notFound('Space not found');
      const item = await fastify.prisma.item.findFirst({ where: { id, spaceId }, select: { id: true } });
      if (!item) return reply.notFound('Item not found');
      const { before } = querySchema.parse(request.query ?? {});

      const relationOf = (side: 'before' | 'after', key: 'fromItemId' | 'toItemId') =>
        ({ changes: { path: [side, key], equals: id } });
      const baseWhere = {
        OR: [
          { entity: 'Item', entityId: id },
          { entity: 'ItemRelation', OR: [relationOf('after', 'fromItemId'), relationOf('after', 'toItemId'), relationOf('before', 'fromItemId'), relationOf('before', 'toItemId')] },
        ],
      };

      // Lecture par paquets jusqu'à PAGE_SIZE entrées utiles (les entrées sans ligne sont sautées)
      const rows: LogRow[] = [];
      let cursor = before ? new Date(before) : undefined;
      let exhausted = false;
      for (let round = 0; round < MAX_ROUNDS && rows.length < PAGE_SIZE && !exhausted; round++) {
        const batch: LogRow[] = await fastify.prisma.auditLog.findMany({
          where: { ...baseWhere, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
          orderBy: { createdAt: 'desc' },
          take: FETCH_SIZE,
          select: { id: true, action: true, entity: true, entityId: true, changes: true, createdAt: true, user: { select: { id: true, name: true } } },
        });
        if (batch.length < FETCH_SIZE) exhausted = true;
        if (batch.length) cursor = batch[batch.length - 1].createdAt;
        rows.push(...batch);
      }

      // Libellés : statuts du référentiel, personnes, éléments et espaces lisibles par le lecteur
      const refs = collectHistoryRefs(rows, id);
      const [statuses, users, items, spaces] = await Promise.all([
        statusesOfSpace(fastify.prisma, spaceId),
        refs.userIds.length ? fastify.prisma.user.findMany({ where: { id: { in: refs.userIds } }, select: { id: true, name: true } }) : [],
        refs.itemIds.length ? fastify.prisma.item.findMany({ where: { id: { in: refs.itemIds } }, select: { id: true, title: true, spaceId: true } }) : [],
        refs.spaceIds.length ? fastify.prisma.space.findMany({ where: { id: { in: refs.spaceIds } }, select: { id: true, name: true } }) : [],
      ]);
      const readable = new Set(await filterReadableSpaceIds(
        fastify.prisma, request.user.userId,
        [...items.map((i: { spaceId: string }) => i.spaceId), ...spaces.map((s: { id: string }) => s.id)],
        request.isAdminMode,
      ));
      const statusMap = new Map<string, string>(statuses.map((s) => [s.id, s.label] as const));
      const userMap = new Map<string, string>(users.map((u: { id: string; name: string }) => [u.id, u.name] as const));
      const itemMap = new Map<string, string>(items.filter((i: { spaceId: string }) => readable.has(i.spaceId)).map((i: { id: string; title: string }) => [i.id, i.title || 'Sans titre'] as const));
      const spaceMap = new Map<string, string>(spaces.filter((s: { id: string }) => readable.has(s.id)).map((s: { id: string; name: string }) => [s.id, s.name] as const));
      const ctx = {
        itemId: id,
        statusLabel: (s: string) => statusMap.get(s) ?? s,
        userName: (u: string) => userMap.get(u),
        itemTitle: (i: string) => itemMap.get(i),
        spaceName: (s: string) => spaceMap.get(s),
      };

      const entries: ItemHistoryEntry[] = [];
      let consumed = 0;
      for (const row of rows) {
        if (entries.length >= PAGE_SIZE) break;
        consumed++;
        const lines = describeHistoryLog(row, ctx);
        if (!lines.length) continue;
        const source = (row.changes as { source?: { via?: string } } | null)?.source;
        entries.push({ id: row.id, createdAt: row.createdAt.toISOString(), user: row.user, viaMcp: source?.via === 'mcp', lines });
      }
      // Encore à lire : lignes lues mais non consommées, ou journal pas épuisé
      const more = consumed < rows.length || !exhausted;
      const lastRead = consumed > 0 ? rows[consumed - 1].createdAt : null;
      const response: ItemHistoryResponse = { entries, nextCursor: more && lastRead ? lastRead.toISOString() : null };
      return response;
    },
  );
};
