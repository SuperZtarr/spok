/*
 * Article (type d'item ARTICLE, 2026-10-23) : ses blocs sont des références ordonnées vers des éléments existants
 * (table article_blocks), qui restent où ils sont et peuvent figurer dans plusieurs articles.
 * Droits (spec validée par Thomas) :
 * - un bloc n'est montré que si la personne qui a ajouté la référence (addedById) peut encore lire l'élément —
 *   évalué à la lecture, toujours HORS mode admin ; sinon available=false et item=null (rien du contenu n'est envoyé) ;
 * - le lecteur voit le contenu des blocs sans accès à l'élément source : canOpen / spaceId seulement s'il lit
 *   lui-même l'espace source ; canEdit = OWNER de l'espace source, ou MEMBER auteur/assigné (canMemberManageItem).
 * GET /spaces/:spaceId/items/:id/article (itemArticleReadRoutes, authentification facultative) → ArticleView.
 * Les écritures (itemArticleWriteRoutes) sont enregistrées dans la portée authentifiée d'itemsRoutes ; toutes
 * exigent de pouvoir modifier l'article (même règle que canEditArticle, article non verrouillé) :
 * POST …/article/blocks (référence ; 400 si ARTICLE, 403 si élément illisible hors mode admin, 409
 * DUPLICATE_REFERENCE, 409 LESS_VISIBLE sans confirmLessVisible), POST …/article/texts (nouvelle NOTE + bloc),
 * PATCH …/article/blocks/:blockId (width/align), PUT …/article/order (tous les blocs), DELETE …/article/blocks/:blockId
 * (retire la référence, ne supprime jamais l'élément).
 * GET …/article/candidates?q=&scope=community|all (même droit) : éléments proposés par le sélecteur — espaces lisibles
 * hors mode admin (allReadableSpaceIds), portée communauté de l'article par défaut, sans ARTICLE ni éléments déjà
 * présents ; q vide = 15 récents de l'espace de l'article ; sinon titres (100 max) + descriptions/adresses (300 plus
 * récentes) classés par rankArticleCandidates (utils/articleCandidates.ts, texte visible seulement).
 * Chaque bloc disponible porte aussi statut (libellé résolu dans les référentiels de la communauté de l'espace
 * d'origine, sinon DEFAULT_STATUSES ; 'undefined' → null), priorité et dates ISO : ligne d'infos du rendu par type.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_STATUSES } from '@spok/shared';
import type { ArticleBlockAlign, ArticleBlockView, ArticleBlockWidth, ArticleCandidate, ArticleView, ItemType, StatusConfig } from '@spok/shared';
import { checkSpaceAccess, filterReadableSpaceIds, getEffectiveVisibilities, allReadableSpaceIds } from '../utils/articleAccess.js';
import { rankArticleCandidates, type CandidateRow } from '../utils/articleCandidates.js';
import { canMemberManageItem } from '../utils/itemOwnership.js';
import { isLessVisible, type VisibilityInfo } from '../utils/articleVisibility.js';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';

type RefItem = {
  id: string; type: string; title: string; description: string | null; url: string | null; spaceId: string;
  createdById: string | null; assignedToId: string | null; lockedAt: Date | string | null;
  status?: string | null; priority?: number | null;
  startDate?: Date | string | null; endDate?: Date | string | null; dueDate?: Date | string | null;
};

const isoOrNull = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Statuts de chaque espace : référentiels de sa communauté, sinon statuts par défaut. */
async function statusesBySpace(prisma: any, spaceIds: string[]): Promise<Map<string, StatusConfig[]>> {
  const spaces: { id: string; community: { referentiels: unknown } | null }[] = spaceIds.length
    ? (await prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true, community: { select: { referentiels: true } } } })) ?? []
    : [];
  return new Map(spaces.map((s) => {
    const statuses = (s.community?.referentiels as { statuses?: StatusConfig[] } | null)?.statuses;
    return [s.id, Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_STATUSES];
  }));
}
type BlockRow = { id: string; position: number; width: string; align: string; addedById: string | null; item: RefItem };

export const REF_ITEM_SELECT = {
  id: true, type: true, title: true, description: true, url: true, spaceId: true,
  createdById: true, assignedToId: true, lockedAt: true,
  status: true, priority: true, startDate: true, endDate: true, dueDate: true,
} as const;

/** Droit de modifier un élément d'un espace donné, pour un rôle déjà résolu (OWNER libre, MEMBER auteur/assigné). */
export function canEditWithRole(role: string | undefined, item: { createdById: string | null; assignedToId: string | null; lockedAt: unknown }, userId: string | undefined): boolean {
  if (!userId || item.lockedAt) return false;
  if (role === 'OWNER') return true;
  return role === 'MEMBER' && canMemberManageItem(item, userId);
}

/** Résout des lignes article_blocks en ArticleBlockView pour un lecteur (cf. règles de l'en-tête). */
export async function resolveBlocks(prisma: any, rows: BlockRow[], readerId: string | undefined, isAdminMode: boolean): Promise<ArticleBlockView[]> {
  const spaceIds = [...new Set(rows.map((r) => r.item.spaceId))];
  const adders = [...new Set(rows.map((r) => r.addedById).filter((a): a is string => !!a))];
  const adderReadable = new Map<string, Set<string>>();
  for (const adder of adders) {
    adderReadable.set(adder, new Set(await filterReadableSpaceIds(prisma, adder, spaceIds, false)));
  }
  const readerReadable = new Set(await filterReadableSpaceIds(prisma, readerId, spaceIds, isAdminMode));
  const statuses = await statusesBySpace(prisma, spaceIds);
  const readerRole = new Map<string, string | undefined>();
  if (readerId) {
    for (const spaceId of readerReadable) {
      readerRole.set(spaceId, (await checkSpaceAccess(prisma, readerId, spaceId, isAdminMode))?.role);
    }
  }

  return rows.map((r) => {
    const base = { id: r.id, position: r.position, width: r.width as ArticleBlockWidth, align: r.align as ArticleBlockAlign };
    const available = !!r.addedById && !!adderReadable.get(r.addedById)?.has(r.item.spaceId);
    if (!available) return { ...base, available: false, item: null };
    const canOpen = readerReadable.has(r.item.spaceId);
    const status = r.item.status && r.item.status !== 'undefined' ? r.item.status : null;
    const statusList = statuses.get(r.item.spaceId) ?? DEFAULT_STATUSES;
    return {
      ...base,
      available: true,
      item: {
        id: r.item.id,
        type: r.item.type as ItemType,
        title: r.item.title,
        description: r.item.description,
        url: r.item.url,
        status,
        statusLabel: status ? (statusList.find((s) => s.id === status)?.label ?? status) : null,
        priority: r.item.priority ?? null,
        startDate: isoOrNull(r.item.startDate),
        endDate: isoOrNull(r.item.endDate),
        dueDate: isoOrNull(r.item.dueDate),
        canOpen,
        canEdit: canOpen && canEditWithRole(readerRole.get(r.item.spaceId), r.item, readerId),
        spaceId: canOpen ? r.item.spaceId : null,
      },
    };
  });
}

/** Charge l'article (404 si illisible ou pas un ARTICLE) et son ArticleView pour le lecteur. */
export async function loadArticleView(prisma: any, spaceId: string, articleId: string, readerId: string | undefined, isAdminMode: boolean): Promise<ArticleView | null> {
  const membership = await checkSpaceAccess(prisma, readerId, spaceId, isAdminMode);
  if (!membership) return null;
  const article = await prisma.item.findFirst({
    where: { id: articleId, spaceId },
    select: { id: true, type: true, createdById: true, assignedToId: true, lockedAt: true },
  });
  if (!article || article.type !== 'ARTICLE') return null;
  const rows = await prisma.articleBlock.findMany({
    where: { articleId },
    orderBy: { position: 'asc' },
    include: { item: { select: REF_ITEM_SELECT } },
  });
  return {
    articleId,
    blocks: await resolveBlocks(prisma, rows, readerId, isAdminMode),
    canEditArticle: canEditWithRole(membership.role, article, readerId),
  };
}

export const itemArticleReadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id/article', async (request, reply) => {
    const view = await loadArticleView(fastify.prisma, request.params.spaceId, request.params.id, request.user?.userId, request.isAdminMode);
    if (!view) return reply.notFound('Article not found');
    return view;
  });
};

const WIDTHS = ['full', 'wide', 'medium'] as const;
const ALIGNS = ['center', 'left', 'right'] as const;
const addBlockSchema = z.object({
  itemId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  confirmLessVisible: z.boolean().optional(),
});
const addTextSchema = z.object({ position: z.number().int().min(0).optional() });
const updateBlockSchema = z.object({ width: z.enum(WIDTHS).optional(), align: z.enum(ALIGNS).optional() });
const orderSchema = z.object({ blockIds: z.array(z.string().min(1)) });

type Params = { spaceId: string; id: string };

/** Article modifiable par le demandeur, sinon réponse 404/403 envoyée et null renvoyé. */
async function requireArticleEditor(fastify: any, request: any, reply: any) {
  const { spaceId, id } = request.params as Params;
  const userId = request.user.userId as string;
  const membership = await checkSpaceAccess(fastify.prisma, userId, spaceId, request.isAdminMode);
  if (!membership) { reply.notFound('Article not found'); return null; }
  const article = await fastify.prisma.item.findFirst({
    where: { id, spaceId },
    select: { id: true, type: true, spaceId: true, createdById: true, assignedToId: true, lockedAt: true },
  });
  if (!article || article.type !== 'ARTICLE') { reply.notFound('Article not found'); return null; }
  if (!canEditWithRole(membership.role, article, userId)) { reply.forbidden('You cannot edit this article'); return null; }
  return { article, userId };
}

/** Insère un bloc à `position` (fin par défaut) en décalant les suivants. */
async function insertBlock(tx: any, articleId: string, itemId: string, addedById: string, position: number | undefined) {
  const count = await tx.articleBlock.count({ where: { articleId } });
  const pos = position === undefined ? count : Math.min(position, count);
  if (pos < count) {
    await tx.articleBlock.updateMany({ where: { articleId, position: { gte: pos } }, data: { position: { increment: 1 } } });
  }
  return tx.articleBlock.create({
    data: { articleId, itemId, position: pos, addedById },
    include: { item: { select: REF_ITEM_SELECT } },
  });
}

const visibilityOf = (map: Map<string, any>, spaceId: string): VisibilityInfo => {
  const v = map.get(spaceId);
  return { spaceId, visibility: v?.visibility ?? 'PRIVATE', communityId: v?.communityId ?? null, communityVisibility: v?.communityVisibility ?? null };
};

const CANDIDATE_SELECT = {
  id: true, type: true, title: true, description: true, url: true, spaceId: true, updatedAt: true,
  space: { select: { name: true, communityId: true, community: { select: { name: true } } } },
} as const;

export const itemArticleWriteRoutes: FastifyPluginAsync = async (fastify) => {
  // Sélecteur « Ajouter un élément » : candidats lisibles hors mode admin (comme l'ajout), classés par pertinence
  fastify.get<{ Params: Params; Querystring: { q?: string; scope?: string } }>('/:id/article/candidates', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const term = (request.query.q ?? '').trim();
    const scopeAll = request.query.scope === 'all';
    const articleSpace = await fastify.prisma.space.findUnique({ where: { id: ctx.article.spaceId }, select: { id: true, communityId: true } });
    const readable = await allReadableSpaceIds(fastify.prisma, ctx.userId);
    let spaceIds = readable;
    if (!scopeAll) {
      const scoped = articleSpace?.communityId
        ? (await fastify.prisma.space.findMany({ where: { communityId: articleSpace.communityId }, select: { id: true } })).map((s: { id: string }) => s.id)
        : [ctx.article.spaceId];
      const readableSet = new Set(readable);
      spaceIds = scoped.filter((id: string) => readableSet.has(id));
    }
    const present = (await fastify.prisma.articleBlock.findMany({ where: { articleId: ctx.article.id }, select: { itemId: true } }))
      .map((b: { itemId: string }) => b.itemId);
    const excluded = [...present, ctx.article.id];
    const base = { type: { not: 'ARTICLE' as const }, id: { notIn: excluded } };

    if (!term) {
      const recent = readable.includes(ctx.article.spaceId)
        ? await fastify.prisma.item.findMany({ where: { ...base, spaceId: ctx.article.spaceId }, orderBy: { updatedAt: 'desc' }, take: 15, select: CANDIDATE_SELECT })
        : [];
      const items: ArticleCandidate[] = recent.map((r: CandidateRow) => ({
        id: r.id, type: r.type as ItemType, title: r.title, spaceId: r.spaceId, spaceName: r.space.name,
        communityName: r.space.community?.name ?? null, snippet: null,
      }));
      return { items };
    }

    const inSpaces = { spaceId: { in: spaceIds } };
    const titleRows: CandidateRow[] = await fastify.prisma.item.findMany({
      where: { ...base, ...inSpaces, title: { contains: term, mode: 'insensitive' } },
      take: 100,
      select: CANDIDATE_SELECT,
    });
    const textRows: CandidateRow[] = await fastify.prisma.item.findMany({
      where: {
        ...base, ...inSpaces,
        id: { notIn: [...excluded, ...titleRows.map((r) => r.id)] },
        OR: [{ description: { contains: term, mode: 'insensitive' } }, { url: { contains: term, mode: 'insensitive' } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: CANDIDATE_SELECT,
    });
    return {
      items: rankArticleCandidates(term, [...titleRows, ...textRows], {
        articleSpaceId: ctx.article.spaceId,
        articleCommunityId: articleSpace?.communityId ?? null,
      }),
    };
  });

  fastify.post<{ Params: Params }>('/:id/article/blocks', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { itemId, position, confirmLessVisible } = addBlockSchema.parse(request.body);
    const ref = await fastify.prisma.item.findUnique({ where: { id: itemId }, select: REF_ITEM_SELECT });
    if (!ref) return reply.notFound('Item not found');
    if (ref.type === 'ARTICLE') return reply.badRequest('An article cannot contain an article');
    const readable = await filterReadableSpaceIds(fastify.prisma, ctx.userId, [ref.spaceId], false);
    if (readable.length === 0) return reply.forbidden('You cannot read this item');
    const existing = await fastify.prisma.articleBlock.findUnique({
      where: { articleId_itemId: { articleId: ctx.article.id, itemId } },
    });
    if (existing) return reply.status(409).send({ statusCode: 409, code: 'DUPLICATE_REFERENCE', message: 'Item already in this article' });
    if (!confirmLessVisible) {
      const vis = await getEffectiveVisibilities(fastify.prisma, [ctx.article.spaceId, ref.spaceId]);
      if (isLessVisible(visibilityOf(vis, ctx.article.spaceId), visibilityOf(vis, ref.spaceId))) {
        return reply.status(409).send({ statusCode: 409, code: 'LESS_VISIBLE', message: 'Item is less visible than the article' });
      }
    }
    const row = await fastify.prisma.$transaction((tx: any) => insertBlock(tx, ctx.article.id, itemId, ctx.userId, position));
    const [view] = await resolveBlocks(fastify.prisma, [row], ctx.userId, request.isAdminMode);
    return reply.status(201).send(view);
  });

  fastify.post<{ Params: Params }>('/:id/article/texts', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { position } = addTextSchema.parse(request.body ?? {});
    const row = await fastify.prisma.$transaction(async (tx: any) => {
      const note = await tx.item.create({
        data: { title: 'Texte', description: '', type: 'NOTE', spaceId: ctx.article.spaceId, createdById: ctx.userId },
      });
      await createAuditLog(tx, {
        action: 'CREATE', entity: 'Item', entityId: note.id, userId: ctx.userId, spaceId: ctx.article.spaceId,
        changes: { after: serializeItemForAudit(note) as Record<string, unknown> },
      });
      return insertBlock(tx, ctx.article.id, note.id, ctx.userId, position);
    });
    const [view] = await resolveBlocks(fastify.prisma, [row], ctx.userId, request.isAdminMode);
    return reply.status(201).send(view);
  });

  fastify.patch<{ Params: Params & { blockId: string } }>('/:id/article/blocks/:blockId', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const data = updateBlockSchema.parse(request.body);
    const block = await fastify.prisma.articleBlock.findFirst({ where: { id: request.params.blockId, articleId: ctx.article.id } });
    if (!block) return reply.notFound('Block not found');
    const row = await fastify.prisma.articleBlock.update({
      where: { id: block.id }, data, include: { item: { select: REF_ITEM_SELECT } },
    });
    const [view] = await resolveBlocks(fastify.prisma, [row], ctx.userId, request.isAdminMode);
    return view;
  });

  fastify.put<{ Params: Params }>('/:id/article/order', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { blockIds } = orderSchema.parse(request.body);
    const current = await fastify.prisma.articleBlock.findMany({ where: { articleId: ctx.article.id }, select: { id: true } });
    const ids = new Set(current.map((b: { id: string }) => b.id));
    if (blockIds.length !== ids.size || new Set(blockIds).size !== ids.size || blockIds.some((b) => !ids.has(b))) {
      return reply.badRequest('blockIds must list every block of the article exactly once');
    }
    await fastify.prisma.$transaction(async (tx: any) => {
      for (const [position, id] of blockIds.entries()) await tx.articleBlock.update({ where: { id }, data: { position } });
    });
    return loadArticleView(fastify.prisma, request.params.spaceId, ctx.article.id, ctx.userId, request.isAdminMode);
  });

  fastify.delete<{ Params: Params & { blockId: string } }>('/:id/article/blocks/:blockId', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const block = await fastify.prisma.articleBlock.findFirst({ where: { id: request.params.blockId, articleId: ctx.article.id } });
    if (!block) return reply.notFound('Block not found');
    await fastify.prisma.articleBlock.delete({ where: { id: block.id } });
    return reply.status(204).send();
  });
};
