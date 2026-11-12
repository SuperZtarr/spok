/*
 * Administration des tags (/admin/tags, admin global — décision Thomas 2026-11-11). Portée : utils/tagScope.ts —
 * tags globaux, de communauté et d'espace (rétablis le 2026-11-12, hérités par les sous-espaces) ; portée « space »
 * listée avec son espace, fusionnable et promouvable comme les autres.
 * - GET /            : tous les tags, portée, communauté / espace, nombre d'éléments.
 * - GET /duplicates  : tags de même nom (sans casse, espaces retirés), toutes portées réunies ; pour chaque tag, les
 *                      communautés des espaces de ses éléments (communityIds, null = espace sans communauté) — sert à
 *                      savoir quel tag peut être gardé.
 * - POST /           : crée un tag global (nom unique sans casse parmi les globaux).
 * - PATCH /:id       : renomme / recolore (nom unique dans la portée du tag : communauté + globaux, ou globaux).
 * - DELETE /:id      : supprime le tag (retiré de tous ses éléments ; irréversible, journalisé).
 * - POST /:id/promote: rend le tag global (refus 409 si un tag global du même nom existe : fusionner plutôt).
 * - POST /merge      : { targetId, sourceIds } — les éléments des sources reçoivent la cible (sans double), puis les
 *                      sources sont supprimées, en transaction. Refus 400 si la cible n'est pas visible depuis tous
 *                      les éléments concernés (cible de communauté C et élément hors de C ; cible d'espace E et élément
 *                      hors de E et de ses sous-espaces) — rendre la cible globale.
 * Chaque écriture est journalisée (entité 'Tag' ; fusion = action 'MERGE'), sans restauration.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog } from '../../utils/audit.js';
import { communityScope, findTagByName, GLOBAL_TAG_WHERE, isGlobalTag, spaceTagScope, spaceWithDescendantIds } from '../../utils/tagScope.js';

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const createSchema = z.object({ name: z.string().trim().min(1), color: colorSchema.optional() });
const updateSchema = z.object({ name: z.string().trim().min(1).optional(), color: colorSchema.nullable().optional() });
const mergeSchema = z.object({ targetId: z.string().min(1), sourceIds: z.array(z.string().min(1)).min(1) });

export type AdminTagScope = 'global' | 'community' | 'space';

const TAG_INCLUDE = {
  community: { select: { id: true, name: true } },
  space: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

function scopeOf(tag: { communityId: string | null; spaceId: string | null }): AdminTagScope {
  return tag.communityId ? 'community' : tag.spaceId ? 'space' : 'global';
}

function toAdminTag(tag: any) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    scope: scopeOf(tag),
    communityId: tag.communityId,
    communityName: tag.community?.name ?? null,
    spaceId: tag.spaceId,
    spaceName: tag.space?.name ?? null,
    itemCount: tag._count?.items ?? 0,
  };
}

/** Clé de regroupement des doublons : nom sans casse, espaces de bord retirés */
export function duplicateKey(name: string): string {
  return name.trim().toLowerCase();
}

export const adminTagsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  fastify.get('/', async () => {
    const tags = await fastify.prisma.tag.findMany({ include: TAG_INCLUDE, orderBy: { name: 'asc' } });
    return tags.map(toAdminTag);
  });

  fastify.get('/duplicates', async () => {
    const tags = await fastify.prisma.tag.findMany({ include: TAG_INCLUDE, orderBy: { name: 'asc' } });
    const groups = new Map<string, any[]>();
    for (const tag of tags) {
      const key = duplicateKey(tag.name);
      groups.set(key, [...(groups.get(key) ?? []), tag]);
    }
    const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
    const dupIds = dupGroups.flatMap(([, list]) => list.map((t) => t.id));

    // Communautés des espaces des éléments de chaque tag (validité d'une cible de fusion)
    const links = dupIds.length
      ? await fastify.prisma.itemTag.findMany({
          where: { tagId: { in: dupIds } },
          select: { tagId: true, item: { select: { space: { select: { communityId: true } } } } },
        })
      : [];
    const communitiesByTag = new Map<string, Set<string | null>>();
    for (const link of links) {
      const set = communitiesByTag.get(link.tagId) ?? new Set<string | null>();
      set.add(link.item.space?.communityId ?? null);
      communitiesByTag.set(link.tagId, set);
    }

    return dupGroups.map(([key, list]) => ({
      key,
      tags: list.map((t) => ({ ...toAdminTag(t), communityIds: [...(communitiesByTag.get(t.id) ?? [])] })),
    }));
  });

  fastify.post<{ Body: z.infer<typeof createSchema> }>('/', async (request, reply) => {
    const body = createSchema.parse(request.body);
    if (await findTagByName(fastify.prisma, communityScope(null), body.name)) {
      return reply.conflict('Un tag global de ce nom existe déjà');
    }
    const tag = await fastify.prisma.tag.create({ data: { name: body.name, color: body.color ?? null }, include: TAG_INCLUDE });
    await createAuditLog(fastify.prisma, {
      action: 'CREATE', entity: 'Tag', entityId: tag.id, userId: request.user.userId, spaceId: null,
      changes: { after: { name: tag.name, color: tag.color, scope: 'global' } },
    });
    return reply.status(201).send(toAdminTag(tag));
  });

  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateSchema> }>('/:id', async (request, reply) => {
    const tag = await fastify.prisma.tag.findUnique({ where: { id: request.params.id } });
    if (!tag) return reply.notFound('Tag not found');
    const body = updateSchema.parse(request.body);

    if (body.name && duplicateKey(body.name) !== duplicateKey(tag.name)) {
      const scope = tag.spaceId ? await spaceTagScope(fastify.prisma, tag.spaceId) : communityScope(tag.communityId);
      const existing = await findTagByName(fastify.prisma, scope, body.name);
      if (existing && existing.id !== tag.id) return reply.conflict('Un tag de ce nom existe déjà dans cette portée');
    }

    const updated = await fastify.prisma.tag.update({
      where: { id: tag.id },
      data: { ...(body.name && { name: body.name }), ...(body.color !== undefined && { color: body.color }) },
      include: TAG_INCLUDE,
    });
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE', entity: 'Tag', entityId: tag.id, userId: request.user.userId, spaceId: null,
      changes: { before: { name: tag.name, color: tag.color }, after: { name: updated.name, color: updated.color } },
    });
    return toAdminTag(updated);
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const tag = await fastify.prisma.tag.findUnique({ where: { id: request.params.id }, include: TAG_INCLUDE });
    if (!tag) return reply.notFound('Tag not found');
    await fastify.prisma.tag.delete({ where: { id: tag.id } });
    await createAuditLog(fastify.prisma, {
      action: 'DELETE', entity: 'Tag', entityId: tag.id, userId: request.user.userId, spaceId: null,
      changes: { before: toAdminTag(tag) },
    });
    return { success: true };
  });

  fastify.post<{ Params: { id: string } }>('/:id/promote', async (request, reply) => {
    const tag = await fastify.prisma.tag.findUnique({ where: { id: request.params.id }, include: TAG_INCLUDE });
    if (!tag) return reply.notFound('Tag not found');
    if (isGlobalTag(tag)) return reply.badRequest('Ce tag est déjà global');

    const sameGlobal = await fastify.prisma.tag.findFirst({
      where: { ...GLOBAL_TAG_WHERE, name: { equals: tag.name.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (sameGlobal) return reply.conflict('Un tag global de ce nom existe déjà : fusionnez ce tag dans le tag global');

    const updated = await fastify.prisma.tag.update({
      where: { id: tag.id },
      data: { communityId: null, spaceId: null },
      include: TAG_INCLUDE,
    });
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE', entity: 'Tag', entityId: tag.id, userId: request.user.userId, spaceId: null,
      changes: { before: toAdminTag(tag), after: toAdminTag(updated) },
    });
    return toAdminTag(updated);
  });

  fastify.post<{ Body: z.infer<typeof mergeSchema> }>('/merge', async (request, reply) => {
    const { targetId, sourceIds: rawSources } = mergeSchema.parse(request.body);
    const sourceIds = [...new Set(rawSources)].filter((id) => id !== targetId);
    if (sourceIds.length === 0) return reply.badRequest('Aucun tag à fusionner');

    const tags = await fastify.prisma.tag.findMany({ where: { id: { in: [targetId, ...sourceIds] } }, include: TAG_INCLUDE });
    const target = tags.find((t) => t.id === targetId);
    if (!target || tags.length !== sourceIds.length + 1) return reply.notFound('Tag not found');

    // La cible doit être visible depuis l'espace de chaque élément concerné
    if (!isGlobalTag(target)) {
      const outside = await fastify.prisma.itemTag.count({
        where: {
          tagId: { in: sourceIds },
          item: target.communityId
            ? { space: { OR: [{ communityId: null }, { communityId: { not: target.communityId } }] } }
            : { spaceId: { notIn: await spaceWithDescendantIds(fastify.prisma, target.spaceId!) } },
        },
      });
      if (outside > 0) {
        return reply.badRequest(`${outside} élément(s) sont hors de la portée du tag gardé : rendez-le global avant de fusionner`);
      }
    }

    const links = await fastify.prisma.itemTag.findMany({ where: { tagId: { in: sourceIds } }, select: { itemId: true } });
    const itemIds = [...new Set(links.map((l) => l.itemId))];

    await fastify.prisma.$transaction(async (tx) => {
      if (itemIds.length) {
        await tx.itemTag.createMany({ data: itemIds.map((itemId) => ({ itemId, tagId: targetId })), skipDuplicates: true });
      }
      await tx.tag.deleteMany({ where: { id: { in: sourceIds } } });
      await createAuditLog(tx, {
        action: 'MERGE', entity: 'Tag', entityId: targetId, userId: request.user.userId, spaceId: null,
        changes: {
          before: { sources: tags.filter((t) => t.id !== targetId).map(toAdminTag) },
          after: { target: toAdminTag(target), itemCount: itemIds.length },
        },
      });
    });

    const merged = await fastify.prisma.tag.findUnique({ where: { id: targetId }, include: TAG_INCLUDE });
    return { tag: toAdminTag(merged), itemCount: itemIds.length, removed: sourceIds.length };
  });
};
