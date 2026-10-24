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
 * Sélecteur à parcourir (même droit, espaces lisibles hors mode admin, portée pickerSpaces community | all | space) :
 * GET …/article/browse/spaces?scope= → ArticleBrowseSpace[] (nombre d'éléments, processus éventuel) ;
 * GET …/article/browse/items?spaceId= → { items: ArticleBrowseItem[] (500 max, sans ARTICLE), truncated } ;
 * GET …/article/candidates?q=&scope=&spaceId= : recherche, sans ARTICLE ni l'article lui-même — les éléments déjà
 * présents sont renvoyés (le web les grise) ; q vide = 15 récents de l'espace de l'article ; sinon titres (100 max) +
 * descriptions/adresses (300 plus récentes) classés par rankArticleCandidates (texte visible seulement).
 * Ajout groupé (même droit, 2026-10-24) : POST …/article/batch/preview { source } → ArticleBatchPreview ;
 * POST …/article/batch { source, position?, confirmLessVisible? } → 201 { blocks } (400 TOO_MANY > 100, 400 EMPTY,
 * 409 LESS_VISIBLE). Source = éléments cochés (chacun avec enfants et/ou chaîne de relations sortantes, dans l'ordre
 * reçu, sans doublon) ou processus d'un espace / d'un couloir, ordonnée par utils/articleBatch.ts ; articles,
 * éléments présents et illisibles (hors mode admin) sautés et comptés. Photo au moment de l'ajout.
 * Chaque bloc disponible porte aussi statut (libellé résolu dans les référentiels de la communauté de l'espace
 * d'origine, sinon DEFAULT_STATUSES ; 'undefined' → null), priorité et dates ISO : ligne d'infos du rendu par type.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_STATUSES } from '@spok/shared';
import type {
  ArticleBatchPreview, ArticleBatchSource, ArticleBlockAlign, ArticleBlockView, ArticleBlockWidth, ArticleCandidate,
  ArticleBrowseItem, ArticleBrowseSpace, ArticleView, ItemType, StatusConfig,
} from '@spok/shared';
import { orderChain, orderCluster, orderDescendants, orderProcess } from '../utils/articleBatch.js';
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

/** Espaces proposés par les sélecteurs du Composer : lisibles hors mode admin ; portée 'community' (défaut :
 *  communauté de l'article, son espace seul s'il n'a pas de communauté), 'all', ou 'space' (spaceId seul). */
async function pickerSpaces(prisma: any, articleSpaceId: string, userId: string, scope: string | undefined, spaceId?: string) {
  const articleSpace = await prisma.space.findUnique({ where: { id: articleSpaceId }, select: { id: true, communityId: true } });
  const readable: string[] = await allReadableSpaceIds(prisma, userId);
  const articleCommunityId: string | null = articleSpace?.communityId ?? null;
  if (scope === 'all') return { spaceIds: readable, readable, articleCommunityId };
  if (scope === 'space' && spaceId) return { spaceIds: readable.includes(spaceId) ? [spaceId] : [], readable, articleCommunityId };
  const scoped: string[] = articleCommunityId
    ? (await prisma.space.findMany({ where: { communityId: articleCommunityId }, select: { id: true } })).map((s: { id: string }) => s.id)
    : [articleSpaceId];
  const readableSet = new Set(readable);
  return { spaceIds: scoped.filter((id) => readableSet.has(id)), readable, articleCommunityId };
}

const BATCH_MAX = 100;
const BROWSE_MAX = 500;
const batchSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('items'), itemIds: z.array(z.string().min(1)).min(1).max(BATCH_MAX), children: z.boolean(), chain: z.boolean() }),
  z.object({ kind: z.literal('process'), spaceId: z.string().min(1), laneId: z.string().min(1).optional() }),
]);
const batchPreviewSchema = z.object({ source: batchSourceSchema });
const batchInsertSchema = z.object({
  source: batchSourceSchema,
  position: z.number().int().min(0).optional(),
  confirmLessVisible: z.boolean().optional(),
});

type BatchError = { status: 403 | 404; message: string };

/** Éléments d'une source, ordonnés (articleBatch.ts), avant filtrage. */
async function orderedSourceIds(prisma: any, userId: string, source: ArticleBatchSource): Promise<string[] | BatchError> {
  if (source.kind === 'process') {
    const readable = await filterReadableSpaceIds(prisma, userId, [source.spaceId], false);
    if (readable.length === 0) return { status: 403, message: 'You cannot read this process' };
    const lanes = await prisma.processLane.findMany({ where: { spaceId: source.spaceId }, select: { id: true, itemId: true, position: true } });
    if (source.laneId && !lanes.some((l: { id: string }) => l.id === source.laneId)) return { status: 404, message: 'Lane not found' };
    const nodes = await prisma.processNode.findMany({ where: { spaceId: source.spaceId }, select: { itemId: true, laneId: true, x: true, y: true } });
    return orderProcess(lanes, nodes, source.laneId);
  }
  const out: string[] = [];
  for (const itemId of source.itemIds) {
    const ids = await clusterIds(prisma, itemId, source.children, source.chain);
    if (ids) out.push(...ids);
  }
  if (out.length === 0) return { status: 404, message: 'Item not found' };
  return [...new Set(out)];
}

/** Un élément avec, au choix, sa descendance et la chaîne de ses relations sortantes ; null s'il n'existe pas. */
async function clusterIds(prisma: any, itemId: string, withChildren: boolean, withChain: boolean): Promise<string[] | null> {
  const root = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, spaceId: true } });
  if (!root) return null;
  let descendants: string[] | null = null;
  if (withChildren) {
    const rows: { id: string; parentId: string | null; position: number; createdAt: Date }[] = [];
    const seen = new Set<string>([root.id]);
    let frontier = [root.id];
    while (frontier.length) {
      const found = (await prisma.item.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true, parentId: true, position: true, createdAt: true },
      })).filter((r: { id: string }) => !seen.has(r.id));
      found.forEach((r: { id: string }) => seen.add(r.id));
      rows.push(...found);
      frontier = found.map((r: { id: string }) => r.id);
    }
    descendants = orderDescendants(root.id, rows);
  }
  let chain: string[] | null = null;
  if (withChain) {
    const relations: { fromItemId: string; toItemId: string; type: string }[] = [];
    const seen = new Set<string>([root.id]);
    let frontier = [root.id];
    while (frontier.length) {
      const found = await prisma.itemRelation.findMany({
        where: { fromItemId: { in: frontier }, type: { in: ['blocks', 'implements', 'drives'] } },
        select: { fromItemId: true, toItemId: true, type: true },
      });
      relations.push(...found);
      frontier = found.map((r: { toItemId: string }) => r.toItemId).filter((id: string) => !seen.has(id));
      frontier.forEach((id) => seen.add(id));
    }
    chain = orderChain(root.id, relations);
  }
  return orderCluster(root.id, descendants, chain);
}

/** Source résolue pour un article : ids retenus dans l'ordre + aperçu (comptes, limite, visibilité). */
async function resolveBatch(prisma: any, article: { id: string; spaceId: string }, userId: string, source: ArticleBatchSource): Promise<{ ids: string[]; preview: ArticleBatchPreview } | BatchError> {
  const ordered = await orderedSourceIds(prisma, userId, source);
  if (!Array.isArray(ordered)) return ordered;
  const infos: { id: string; type: string; spaceId: string }[] = ordered.length
    ? await prisma.item.findMany({ where: { id: { in: ordered } }, select: { id: true, type: true, spaceId: true } })
    : [];
  const byId = new Map(infos.map((i) => [i.id, i]));
  const present = new Set((await prisma.articleBlock.findMany({ where: { articleId: article.id }, select: { itemId: true } }))
    .map((b: { itemId: string }) => b.itemId));
  const readable = new Set(await filterReadableSpaceIds(prisma, userId, [...new Set(infos.map((i) => i.spaceId))], false));
  const skipped = { present: 0, unreadable: 0, articles: 0 };
  const ids: string[] = [];
  for (const id of ordered) {
    const info = byId.get(id);
    if (!info) continue;
    if (info.type === 'ARTICLE') skipped.articles++;
    else if (present.has(id)) skipped.present++;
    else if (!readable.has(info.spaceId)) skipped.unreadable++;
    else ids.push(id);
  }
  const spaces = [...new Set(ids.map((id) => byId.get(id)!.spaceId))];
  let lessVisible = false;
  if (spaces.length) {
    const vis = await getEffectiveVisibilities(prisma, [article.spaceId, ...spaces]);
    lessVisible = spaces.some((s) => isLessVisible(visibilityOf(vis, article.spaceId), visibilityOf(vis, s)));
  }
  return { ids, preview: { count: ids.length, skipped, tooMany: ids.length > BATCH_MAX, lessVisible } };
}

const CANDIDATE_SELECT = {
  id: true, type: true, title: true, description: true, url: true, spaceId: true, updatedAt: true,
  space: { select: { name: true, communityId: true, community: { select: { name: true } } } },
} as const;

export const itemArticleWriteRoutes: FastifyPluginAsync = async (fastify) => {
  // Ajout groupé : aperçu (comptes, limite, visibilité) puis insertion, même résolution de la source
  fastify.post<{ Params: Params }>('/:id/article/batch/preview', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { source } = batchPreviewSchema.parse(request.body);
    const res = await resolveBatch(fastify.prisma, ctx.article, ctx.userId, source as ArticleBatchSource);
    if ('status' in res) return reply.status(res.status).send({ statusCode: res.status, message: res.message });
    return res.preview;
  });

  fastify.post<{ Params: Params }>('/:id/article/batch', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { source, position, confirmLessVisible } = batchInsertSchema.parse(request.body);
    const res = await resolveBatch(fastify.prisma, ctx.article, ctx.userId, source as ArticleBatchSource);
    if ('status' in res) return reply.status(res.status).send({ statusCode: res.status, message: res.message });
    const { ids, preview } = res;
    if (preview.tooMany) return reply.status(400).send({ statusCode: 400, code: 'TOO_MANY', message: `At most ${BATCH_MAX} items at once` });
    if (ids.length === 0) return reply.status(400).send({ statusCode: 400, code: 'EMPTY', message: 'Nothing to add' });
    if (preview.lessVisible && !confirmLessVisible) {
      return reply.status(409).send({ statusCode: 409, code: 'LESS_VISIBLE', message: 'Some items are less visible than the article' });
    }
    await fastify.prisma.$transaction(async (tx: any) => {
      const count = await tx.articleBlock.count({ where: { articleId: ctx.article.id } });
      const pos = position === undefined ? count : Math.min(position, count);
      if (pos < count) {
        await tx.articleBlock.updateMany({ where: { articleId: ctx.article.id, position: { gte: pos } }, data: { position: { increment: ids.length } } });
      }
      await tx.articleBlock.createMany({
        data: ids.map((itemId, i) => ({ articleId: ctx.article.id, itemId, position: pos + i, addedById: ctx.userId })),
      });
    });
    const rows = await fastify.prisma.articleBlock.findMany({
      where: { articleId: ctx.article.id, itemId: { in: ids } },
      orderBy: { position: 'asc' },
      include: { item: { select: REF_ITEM_SELECT } },
    });
    return reply.status(201).send({ blocks: await resolveBlocks(fastify.prisma, rows, ctx.userId, request.isAdminMode) });
  });

  // Sélecteur à parcourir — espaces de la portée, avec nombre d'éléments et processus éventuel
  fastify.get<{ Params: Params; Querystring: { scope?: string } }>('/:id/article/browse/spaces', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const { spaceIds } = await pickerSpaces(fastify.prisma, ctx.article.spaceId, ctx.userId, request.query.scope);
    if (spaceIds.length === 0) return [];
    const prisma = fastify.prisma as any;
    const [spaces, itemCounts, nodeCounts] = await Promise.all([
      prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true, name: true, parentId: true, community: { select: { name: true } } }, orderBy: { name: 'asc' } }),
      prisma.item.groupBy({ by: ['spaceId'], where: { spaceId: { in: spaceIds }, type: { not: 'ARTICLE' } }, _count: { _all: true } }),
      prisma.processNode.groupBy({ by: ['spaceId'], where: { spaceId: { in: spaceIds } }, _count: { _all: true } }),
    ]);
    const count = (rows: { spaceId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.spaceId, r._count._all]));
    const items = count(itemCounts);
    const nodes = count(nodeCounts);
    const withProcess = [...nodes.entries()].filter(([, n]) => n > 0).map(([id]) => id);
    const lanes: { id: string; spaceId: string; item: { title: string } }[] = withProcess.length
      ? await prisma.processLane.findMany({ where: { spaceId: { in: withProcess } }, orderBy: { position: 'asc' }, select: { id: true, spaceId: true, item: { select: { title: true } } } })
      : [];
    const result: ArticleBrowseSpace[] = spaces.map((s: { id: string; name: string; parentId: string | null; community: { name: string } | null }) => ({
      spaceId: s.id,
      name: s.name,
      parentId: s.parentId,
      communityName: s.community?.name ?? null,
      itemCount: items.get(s.id) ?? 0,
      process: (nodes.get(s.id) ?? 0) > 0
        ? { nodeCount: nodes.get(s.id)!, lanes: lanes.filter((l) => l.spaceId === s.id).map((l) => ({ id: l.id, title: l.item.title })) }
        : null,
    }));
    return result;
  });

  // Sélecteur à parcourir — éléments d'un espace pour l'arbre (500 au plus, articles exclus)
  fastify.get<{ Params: Params; Querystring: { spaceId?: string } }>('/:id/article/browse/items', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const spaceId = request.query.spaceId ?? '';
    const readable = await filterReadableSpaceIds(fastify.prisma, ctx.userId, [spaceId], false);
    if (!spaceId || readable.length === 0) return reply.forbidden('You cannot read this space');
    const rows: { id: string; type: string; title: string; status: string | null; parentId: string | null; position: number }[] =
      await fastify.prisma.item.findMany({
        where: { spaceId, type: { not: 'ARTICLE' } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: BROWSE_MAX + 1,
        select: { id: true, type: true, title: true, status: true, parentId: true, position: true },
      });
    const statusList = (await statusesBySpace(fastify.prisma, [spaceId])).get(spaceId) ?? DEFAULT_STATUSES;
    const items: ArticleBrowseItem[] = rows.slice(0, BROWSE_MAX).map((r) => {
      const status = r.status && r.status !== 'undefined' ? r.status : null;
      return {
        id: r.id, type: r.type as ItemType, title: r.title, status,
        statusLabel: status ? (statusList.find((s) => s.id === status)?.label ?? status) : null,
        parentId: r.parentId, position: r.position,
      };
    });
    return { items, truncated: rows.length > BROWSE_MAX };
  });

  // Sélecteur « Ajouter un élément » : candidats lisibles hors mode admin (comme l'ajout), classés par pertinence
  fastify.get<{ Params: Params; Querystring: { q?: string; scope?: string; spaceId?: string } }>('/:id/article/candidates', async (request, reply) => {
    const ctx = await requireArticleEditor(fastify, request, reply);
    if (!ctx) return reply;
    const term = (request.query.q ?? '').trim();
    const { spaceIds, readable, articleCommunityId } = await pickerSpaces(fastify.prisma, ctx.article.spaceId, ctx.userId, request.query.scope, request.query.spaceId);
    // Les éléments déjà présents restent proposés : le sélecteur les grise (« déjà ajouté »)
    const excluded = [ctx.article.id];
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
        articleCommunityId,
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
