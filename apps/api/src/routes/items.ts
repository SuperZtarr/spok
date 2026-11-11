/*
 * Routes /spaces/:spaceId/items : CRUD des items (titre optionnel, dÃ©faut ''; statut '' normalisÃ© en null), split par titres,
 * dÃ©tail avec relations/contributions/reactionSummary. Exporte checkSpaceAccess et
 * getEffectiveVisibility (visibilitÃ© espace â†’ parent â†’ communautÃ© ; OPENâ†’MEMBER, READONLYâ†’VIEWER)
 * utilisÃ©s par de nombreuses routes â€” toute modification impacte l'accÃ¨s global.
 * checkSpaceAccess(â€¦, isAdminMode) : en mode admin (admin global + X-Admin-Mode) â†’ rÃ´le OWNER partout,
 * membre ou non ; hors mode admin, un admin global est un utilisateur normal (aucun passe-droit). Toute route
 * doit passer request.isAdminMode en 4e argument. Le propriÃ©taire de la communautÃ© a le rÃ´le OWNER
 * dans tous les espaces de sa communautÃ©, privÃ©s compris (isCommunityOwnerOfSpace).
 * AccusÃ© de lecture Ã  l'assignation : crÃ©ation/PATCH posent assignedAt/assignedById (assignmentStamp) ;
 * liste et dÃ©tail renvoient assignmentReceipt (computeAssignmentReceipts) â€” cf. utils/assignment.ts.
 * Verrou de sÃ©ance (copies lockedAt) : cf. utils/itemLock.ts â€” PATCH (organisation seule), DELETE (OWNER),
 * split refusÃ©, propagation de statut ignore les enfants verrouillÃ©s.
 * CommunautÃ© publique = visibility !== 'PRIVATE' uniquement (isPublic dÃ©prÃ©ciÃ©, jamais lu).
 * MEMBER : modifie/supprime les items qu'il a crÃ©Ã©s OU qui lui sont assignÃ©s (canMemberManageItem, utils/itemOwnership.ts).
 * Dates liÃ©es au statut (PATCH et propagation aux descendants) : utils/statusDates.ts â€” source unique,
 * tous chemins confondus (modale, menu â‹¯, Kanban, Today, MCP) ; ne complÃ¨te que les dates vides.
 * Plus de champ url (lot 4 contenus multiples, 2026-11-11) : un url envoyé est ignoré — médias = contenus. Le HTML des
 * descriptions n'est PAS nettoyÃ© ici : il l'est Ã  l'affichage (web, lib/sanitizeHtml.ts).
 * parentId : un parent qui change doit être dans le même espace (utils/itemParent.ts), refus en 400 sinon.
 * Personnes (auteur, assigné, auteurs de contributions) : id et nom seulement, jamais l'e-mail — ces routes sont
 * ouvertes aux visiteurs (règle members-email-scope, décision Thomas 2026-11-06).
 * contents (contenus multiples, 2026-11-08) : renvoyés triés par sorte puis position ; le détail les donne complets,
 * la liste sans xml (poids des schémas). Écriture : item-contents.ts (seule source des médias, plus de pont).
 * Types d'item (z.enum, filtre ?type=) : ITEM_TYPES / isItemType du registre des types (@spok/shared), jamais recopiés.
 */
import { FastifyPluginAsync } from 'fastify';
import { statusDateDefaults } from '../utils/statusDates.js';
import { statusesOfSpace } from '../utils/referentiels.js';
import { z } from 'zod';
import { assignmentStamp, computeAssignmentReceipts, exclusiveAssignee } from '../utils/assignment.js';
import { isLocked, lockedFieldViolations, LOCKED_MESSAGE } from '../utils/itemLock.js';
import { canMemberManageItem } from '../utils/itemOwnership.js';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { createItemTree } from '../utils/itemTree.js';
import { parentViolation } from '../utils/itemParent.js';
import { createNotification } from '../utils/notifications.js';
import { notifyMentionedUsers } from '../utils/mentions.js';
import { itemRelationsRoutes } from './item-relations.js';
import { itemCascadeShiftRoutes } from './item-cascade-shift.js';
import { itemMoveRoutes } from './item-move.js';
import { itemBulkRoutes } from './item-bulk.js';
import { itemContributionRoutes } from './item-contributions.js';
import { itemConvertRoutes } from './item-convert.js';
import { itemMergeRoutes } from './item-merge.js';
import { itemReactionRoutes } from './item-reactions.js';
import { itemArticleReadRoutes, itemArticleWriteRoutes } from './item-article.js';
import { itemQuestionReadRoutes, itemQuestionWriteRoutes } from './item-question.js';
import { itemContentRoutes } from './item-contents.js';

// Contenus renvoyés avec l'élément : ordre d'affichage (enum Prisma déclaré IMAGE, FILE, LINK, DIAGRAM)
const CONTENTS_ORDER = [{ kind: 'asc' as const }, { position: 'asc' as const }, { createdAt: 'asc' as const }];
// Liste : tout sauf le xml des schémas (aperçu d'un fichier inclus : vignettes)
const CONTENTS_LIST_SELECT = {
  id: true, itemId: true, kind: true, url: true, name: true, mimeType: true, size: true, previewUrl: true, excerpt: true,
  position: true, createdById: true, createdAt: true, updatedAt: true,
};
import { statusForType, syncQuestionAfterStatus } from '../utils/question.js';
import { ITEM_TYPES, isItemType, statusAllowedForType } from '@spok/shared';

// Â« Pas de statut Â» = null, jamais chaÃ®ne vide (le filtre status=none cherche null) â€” le web envoie '' Ã  la crÃ©ation.
const statusField = z.string().nullable().optional().transform((v) => (v === '' ? null : v));

const createItemSchema = z.object({
  type: z.enum(ITEM_TYPES),
  title: z.string().default(''),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  status: statusField,
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  parentId: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  assignedToName: z.string().max(120).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.record(z.unknown()).optional(),
  status: statusField,
  priority: z.number().int().min(1).max(4).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  manualHorizon: z.enum(['NOW', 'TODAY', 'WEEK', 'MONTH', 'LATER']).nullable().optional(),
  parentId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  assignedToName: z.string().max(120).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  updatedAt: z.string().datetime().optional(),
  propagateToChildren: z.boolean().optional(),
});


const querySchema = z.object({
  // Une ou plusieurs valeurs séparées par des virgules (filtre à choix multiple de la barre d'espace)
  type: z.string().refine((v) => v.split(',').every((t) => isItemType(t)), 'Type inconnu').optional(),
  status: z.string().optional(), // idem ; 'none' désigne les éléments sans statut
  parentId: z.string().nullable().optional(),
  search: z.string().optional(),
  include: z.string().optional(),
  additionalSpaceIds: z.string().optional(), // comma-separated space IDs
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
});

// Resolve effective visibility by walking up: space â†’ parent space â†’ community
export async function getEffectiveVisibility(prisma: any, spaceId: string): Promise<string> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { visibility: true, parentId: true, communityId: true },
  });
  if (!space) return 'PRIVATE';

  // Space has explicit visibility â†’ use it
  if (space.visibility) return space.visibility;

  // Inherit from parent space
  if (space.parentId) return getEffectiveVisibility(prisma, space.parentId);

  // Inherit from community
  if (space.communityId) {
    const community = await prisma.community.findUnique({
      where: { id: space.communityId },
      select: { visibility: true },
    });
    return community?.visibility || 'PRIVATE';
  }

  return 'PRIVATE';
}

// PropriÃ©taire de la communautÃ© de l'espace : droits OWNER sur tous ses espaces, privÃ©s compris,
// membre direct ou non (rÃ¨gle 2026-10-12). Faux pour un espace personnel (sans communautÃ©).
export async function isCommunityOwnerOfSpace(prisma: any, userId: string, spaceId: string): Promise<boolean> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  if (!space?.communityId) return false;
  const membership = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId: space.communityId } },
    select: { role: true },
  });
  return membership?.role === 'OWNER';
}

// Version en masse de checkSpaceAccess (lecture) : parmi spaceIds, ceux que l'utilisateur peut lire.
// Pour les vues qui agrÃ¨gent beaucoup d'espaces (graphes, sunburst) sans N requÃªtes rÃ©cursives.
// MÃªme rÃ¨gle : admin global en mode admin ou membre direct â†’ oui ; propriÃ©taire de la communautÃ© â†’ oui ;
// visibilitÃ© effective (espace â†’ parents â†’ communautÃ©) PRIVATE â†’ non ; sinon membre de la communautÃ©
// ou communautÃ© non privÃ©e â†’ oui. Ne jamais filtrer sur la visibilitÃ© propre de l'espace seule.
// Version en masse de getEffectiveVisibility : visibilitÃ© effective (espace â†’ parents â†’ communautÃ©) de
// chaque espace demandÃ©, en quelques requÃªtes. Inclut communityId et la visibilitÃ© de la communautÃ©.
// Espace inconnu â†’ absent de la Map.
export async function getEffectiveVisibilities(prisma: any, spaceIds: string[]): Promise<Map<string, {
  visibility: string; communityId: string | null; communityVisibility: string | null;
}>> {
  const ids = [...new Set(spaceIds)];
  const result = new Map<string, { visibility: string; communityId: string | null; communityVisibility: string | null }>();
  if (ids.length === 0) return result;

  // Espaces demandÃ©s + leurs ancÃªtres (nÃ©cessaires Ã  la visibilitÃ© hÃ©ritÃ©e)
  const byId = new Map<string, { id: string; parentId: string | null; visibility: string | null; communityId: string | null }>();
  let toLoad = ids;
  while (toLoad.length > 0) {
    const rows = await prisma.space.findMany({
      where: { id: { in: toLoad } },
      select: { id: true, parentId: true, visibility: true, communityId: true },
    });
    for (const r of rows) byId.set(r.id, r);
    toLoad = [...new Set<string>(rows.map((r: any) => r.parentId).filter((p: string | null) => !!p && !byId.has(p)))];
  }

  const communityIds = [...new Set([...byId.values()].map(s => s.communityId).filter((c): c is string => !!c))];
  const communities = communityIds.length > 0
    ? await prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true, visibility: true } })
    : [];
  const communityVisibility = new Map<string, string>(communities.map((c: any) => [c.id, c.visibility]));

  const effective = (spaceId: string, depth = 0): string => {
    const s = byId.get(spaceId);
    if (!s || depth > 50) return 'PRIVATE';
    if (s.visibility) return s.visibility;
    if (s.parentId) return effective(s.parentId, depth + 1);
    return (s.communityId && communityVisibility.get(s.communityId)) || 'PRIVATE';
  };

  for (const id of ids) {
    const s = byId.get(id);
    if (!s) continue;
    result.set(id, {
      visibility: effective(id),
      communityId: s.communityId,
      communityVisibility: s.communityId ? communityVisibility.get(s.communityId) ?? null : null,
    });
  }
  return result;
}

export async function filterReadableSpaceIds(prisma: any, userId: string | undefined, spaceIds: string[], isAdminMode = false): Promise<string[]> {
  const ids = [...new Set(spaceIds)];
  if (ids.length === 0) return [];
  // Admin global : tout lisible EN MODE ADMIN seulement (hors mode admin = utilisateur normal)
  if (userId && isAdminMode) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
    if (user?.globalRole === 'ADMIN') return ids;
  }

  const visibilities = await getEffectiveVisibilities(prisma, ids);
  const communityIds = [...new Set([...visibilities.values()].map(v => v.communityId).filter((c): c is string => !!c))];
  const [communityMemberships, directMemberships] = await Promise.all([
    userId && communityIds.length > 0
      ? prisma.communityMembership.findMany({ where: { userId, communityId: { in: communityIds } }, select: { communityId: true, role: true } })
      : [],
    userId
      ? prisma.spaceMembership.findMany({ where: { userId, spaceId: { in: ids } }, select: { spaceId: true } })
      : [],
  ]);
  const communityRole = new Map<string, string>(communityMemberships.map((m: any) => [m.communityId, m.role]));
  const directIds = new Set<string>(directMemberships.map((m: any) => m.spaceId));

  return ids.filter(id => {
    if (directIds.has(id)) return true;
    const v = visibilities.get(id);
    if (!v?.communityId) return false;
    const role = communityRole.get(v.communityId);
    if (role === 'OWNER') return true;
    if (v.visibility === 'PRIVATE') return false;
    return !!role || v.communityVisibility !== 'PRIVATE';
  });
}

/**
 * Espaces lisibles d'un utilisateur pour les Ã©crans transverses (tÃ¢ches, agenda, rÃ©vision, activitÃ©) :
 * ses espaces directs + ceux de ses communautÃ©s, filtrÃ©s par filterReadableSpaceIds. Ne jamais prendre
 * Â« tous les espaces de mes communautÃ©s Â» sans ce filtre (fuite des espaces privÃ©s, corrigÃ©e 2026-10-14).
 */
export async function readableSpaceIdsForUser(prisma: any, userId: string, isAdminMode = false): Promise<string[]> {
  const [direct, communities] = await Promise.all([
    prisma.spaceMembership.findMany({ where: { userId }, select: { spaceId: true } }),
    prisma.communityMembership.findMany({ where: { userId }, select: { communityId: true } }),
  ]);
  const communitySpaces = communities.length > 0
    ? await prisma.space.findMany({ where: { communityId: { in: communities.map((c: any) => c.communityId) } }, select: { id: true } })
    : [];
  return filterReadableSpaceIds(prisma, userId, [...direct.map((m: any) => m.spaceId), ...communitySpaces.map((s: any) => s.id)], isAdminMode);
}

/**
 * Tous les espaces qu'une personne peut lire, anonyme compris, HORS mode admin : readableSpaceIdsForUser + espaces
 * des communautÃ©s non privÃ©es filtrÃ©s par la visibilitÃ© effective. UtilisÃ© par /search/advanced et par le
 * sÃ©lecteur d'Ã©lÃ©ments d'un article (item-article.ts, candidats).
 */
export async function allReadableSpaceIds(prisma: any, userId: string | undefined): Promise<string[]> {
  const [ownSpaceIds, publicSpaces] = await Promise.all([
    userId ? readableSpaceIdsForUser(prisma, userId) : Promise.resolve([] as string[]),
    prisma.space.findMany({
      where: { type: 'GROUP', community: { visibility: { not: 'PRIVATE' } } },
      select: { id: true },
    }),
  ]);
  const publicReadable = await filterReadableSpaceIds(prisma, userId, publicSpaces.map((s: any) => s.id));
  return [...new Set([...ownSpaceIds, ...publicReadable])];
}

// Exported helper: check space access (direct membership, community membership, or public community)
// Returns membership with role: OWNER, MEMBER, or VIEWER depending on visibility settings
export async function checkSpaceAccess(prisma: any, userId: string | undefined, spaceId: string, isAdminMode = false) {
  // 1. If authenticated, check direct space membership (always has priority â€” sauf mode admin)
  if (userId) {
    const membership = await prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: { userId, spaceId },
      },
    });

    // Mode admin (admin global + header X-Admin-Mode) : droits OWNER partout, membre ou non â€”
    // le mode admin voit et fait tout. Les routes passent request.isAdminMode en 4e argument.
    if (isAdminMode) {
      const adminUser = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
      if (adminUser?.globalRole === 'ADMIN') {
        return { ...(membership ?? { id: '', joinedAt: new Date() }), userId, spaceId, role: 'OWNER' as const };
      }
    }

    if (membership?.role === 'OWNER') return membership;

    // PropriÃ©taire de la communautÃ© : OWNER dans tous ses espaces, privÃ©s compris
    if (await isCommunityOwnerOfSpace(prisma, userId, spaceId)) {
      return { ...(membership ?? { id: '', joinedAt: new Date() }), userId, spaceId, role: 'OWNER' as const };
    }

    if (membership) return membership;
    // Admin global HORS mode admin : aucun passe-droit, il suit les rÃ¨gles d'un utilisateur normal
  }

  // 2. Community membership or public community â†’ access depends on effective visibility
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { communityId: true, community: { select: { visibility: true } } },
  });
  if (space?.communityId) {
    const visibility = await getEffectiveVisibility(prisma, spaceId);

    // PRIVATE: only direct members (checked above) have access
    if (visibility === 'PRIVATE') return null;

    // OPEN â†’ MEMBER role, READONLY â†’ VIEWER role
    const implicitRole = visibility === 'OPEN' ? 'MEMBER' as const : 'VIEWER' as const;

    if (userId) {
      const communityMembership = await prisma.communityMembership.findUnique({
        where: {
          userId_communityId: { userId, communityId: space.communityId },
        },
      });
      if (communityMembership) {
        return { userId, spaceId, role: implicitRole, id: '', joinedAt: new Date() };
      }
    }

    // Public community (visibility != PRIVATE â€” isPublic dÃ©prÃ©ciÃ©, jamais lu): allow access
    const communityIsPublic = space.community?.visibility !== 'PRIVATE';
    if (communityIsPublic) {
      return { userId: userId || '', spaceId, role: implicitRole, id: '', joinedAt: new Date() };
    }
  }

  return null;
}

export const itemsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register write sub-plugins â€” require authentication
  await fastify.register(async function (authInstance) {
    authInstance.addHook('preHandler', authInstance.authenticate);
    await authInstance.register(itemRelationsRoutes);
    await authInstance.register(itemCascadeShiftRoutes);
    await authInstance.register(itemMoveRoutes);
    await authInstance.register(itemBulkRoutes);
    await authInstance.register(itemContributionRoutes);
    await authInstance.register(itemConvertRoutes);
    await authInstance.register(itemMergeRoutes);
    await authInstance.register(itemReactionRoutes);
    await authInstance.register(itemArticleWriteRoutes);
    await authInstance.register(itemQuestionWriteRoutes);
    await authInstance.register(itemContentRoutes);
  });

  // Lecture d'un article (authentification facultative : un article public se lit en anonyme)
  await fastify.register(itemArticleReadRoutes);
  // Question : décompte lisible en anonyme (sans vote)
  await fastify.register(itemQuestionReadRoutes);

  // List items
  fastify.get<{ Params: { spaceId: string }; Querystring: z.infer<typeof querySchema> }>(
    '/',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const query = querySchema.parse(request.query);
      const { page, pageSize, type, status, parentId, search, include, additionalSpaceIds } = query;

      const includeContributions = include?.split(',').includes('contributions');

      // Build spaceId filter (optionally include additional specific spaces)
      let spaceIdFilter: any = request.params.spaceId;
      if (additionalSpaceIds) {
        const extraIds = additionalSpaceIds.split(',').filter(Boolean);
        if (extraIds.length > 0) {
          spaceIdFilter = { in: [request.params.spaceId, ...extraIds] };
        }
      }

      const where: any = { spaceId: spaceIdFilter };

      if (type) {
        const types = type.split(',');
        where.type = types.length === 1 ? types[0] : { in: types };
      }
      if (status) {
        const statuses = status.split(',');
        const named = statuses.filter((s) => s !== 'none');
        if (named.length === statuses.length) where.status = named.length === 1 ? named[0] : { in: named };
        else if (named.length === 0) where.status = null;
        else where.AND = [{ OR: [{ status: null }, { status: { in: named } }] }];
      }
      if (parentId !== undefined) where.parentId = parentId === '' ? null : parentId;
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const userId = request.user?.userId ?? null;

      const prismaInclude: any = {
        tags: { include: { tag: true } },
        children: { select: { id: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { children: true, contributions: true } },
        contents: { select: CONTENTS_LIST_SELECT, orderBy: CONTENTS_ORDER },
        relationsFrom: {
          include: { toItem: { select: { id: true, title: true, type: true, status: true } } },
        },
        relationsTo: {
          include: { fromItem: { select: { id: true, title: true, type: true, status: true } } },
        },
      };

      if (userId) {
        prismaInclude.views = {
          where: { userId },
          select: { viewedAt: true, markedUnread: true },
          take: 1,
        };
      }

      if (includeContributions) {
        prismaInclude.contributions = {
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        };
      }

      const [items, total] = await Promise.all([
        fastify.prisma.item.findMany({
          where,
          include: prismaInclude,
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        fastify.prisma.item.count({ where }),
      ]);

      const since60days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const receipts = await computeAssignmentReceipts(fastify.prisma, items as any);

      return {
        data: items.map((item: any) => {
          const viewedAt = item.views?.[0]?.viewedAt ?? null;
          const updatedByOther = item.updatedById && item.updatedById !== userId;
          const recentUpdate = new Date(item.updatedAt) >= since60days;
          // Expose viewedAt only when item was updated by someone else recently
          // undefined = not exposed (seen/irrelevant), null = unseen (no view record), string = compare with updatedAt
          // MarquÃ© non lu par l'utilisateur â†’ toujours exposÃ© comme non vu (null), quels que soient auteur/Ã¢ge
          const markedUnread = !!item.views?.[0]?.markedUnread;
          const exposedViewedAt = userId && markedUnread
            ? null
            : userId && updatedByOther && recentUpdate
              ? (viewedAt ? viewedAt.toISOString() : null)
              : undefined;
          const { views, ...rest } = item;
          return {
            ...rest,
            tags: item.tags.map((t: any) => t.tag),
            childCount: item._count.children,
            contributionCount: item._count.contributions,
            assignmentReceipt: receipts.get(item.id) ?? null,
            ...(exposedViewedAt !== undefined ? { viewedAt: exposedViewedAt } : {}),
            ...(includeContributions && item.contributions ? { contributions: item.contributions } : {}),
          };
        }),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }
  );

  // Create item
  fastify.post<{ Params: { spaceId: string }; Body: z.infer<typeof createItemSchema> }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot create items');
      }

      const body = createItemSchema.parse(request.body);
      const { tagIds, ...itemData } = body;
      // Statut réservé à un autre type → retiré ; une question démarre « Ouverte » (utils/question.ts)
      itemData.status = statusForType(itemData.type, itemData.status);

      if (itemData.parentId) {
        const violation = await parentViolation(fastify.prisma, itemData.parentId, request.params.spaceId, request.user.userId, request.isAdminMode);
        if (violation) return reply.badRequest(violation);
      }

      const item = await fastify.prisma.item.create({
        data: {
          ...itemData,
          ...exclusiveAssignee(itemData),
          ...assignmentStamp(null, itemData.assignedToId, request.user.userId),
          dueDate: itemData.dueDate ? new Date(itemData.dueDate) : undefined,
          startDate: itemData.startDate ? new Date(itemData.startDate) : undefined,
          endDate: itemData.endDate ? new Date(itemData.endDate) : undefined,
          spaceId: request.params.spaceId,
          createdById: request.user.userId,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        } as any,
        include: {
          tags: { include: { tag: true } },
        },
      });

      // Audit log for CREATE
      await createAuditLog(fastify.prisma, {
        action: 'CREATE',
        entity: 'Item',
        entityId: item.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          after: serializeItemForAudit(item),
        },
      });

      // Notify @mentioned users in description
      if (itemData.description) {
        const authorName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await notifyMentionedUsers(fastify.prisma, itemData.description, request.user.userId, authorName, item.id, item.title, request.params.spaceId);
      }

      return reply.status(201).send({
        ...item,
        tags: item.tags.map((t) => t.tag),
      });
    }
  );

  // Create an item + its full sub-tree from a saved template
  fastify.post<{ Params: { spaceId: string }; Body: { templateId: string; parentId?: string } }>(
    '/from-template',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }
      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot create items');
      }

      const { templateId, parentId } = request.body;
      if (parentId) {
        const violation = await parentViolation(fastify.prisma, parentId, request.params.spaceId, request.user.userId, request.isAdminMode);
        if (violation) return reply.badRequest(violation);
      }
      const template = await fastify.prisma.itemTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return reply.notFound('Template not found');
      }

      const structure = template.structure as unknown as { title: string; type: string; children: any[] };
      const [rootItem] = await createItemTree(fastify.prisma, [structure as any], {
        spaceId: request.params.spaceId,
        createdById: request.user.userId,
        parentId: parentId ?? null,
      });

      await createAuditLog(fastify.prisma, {
        action: 'CREATE',
        entity: 'Item',
        entityId: rootItem.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: { after: { ...serializeItemForAudit(rootItem), fromTemplateId: templateId } },
      });

      return reply.status(201).send(rootItem);
    }
  );

  // Get item by ID
  fastify.get<{ Params: { spaceId: string; id: string } }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
      include: {
        tags: { include: { tag: true } },
        children: {
          include: {
            tags: { include: { tag: true } },
          },
        },
        parent: true,
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        contents: { orderBy: CONTENTS_ORDER },
        relationsFrom: {
          include: { toItem: { select: { id: true, title: true, type: true, status: true } } },
        },
        relationsTo: {
          include: { fromItem: { select: { id: true, title: true, type: true, status: true } } },
        },
        contributions: {
          include: {
            author: { select: { id: true, name: true } },
            reactions: { select: { reactionType: true, userId: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        reactions: { select: { reactionType: true, userId: true } },
        _count: {
          select: { contributions: true },
        },
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    const currentUserId = request.user?.userId;
    const assignmentReceipt = (await computeAssignmentReceipts(fastify.prisma, [item as any])).get(item.id) ?? null;

    // Build reaction summary helper
    const buildSummary = (reactions: { reactionType: string; userId: string }[]) => {
      const counts = new Map<string, { count: number; userReacted: boolean }>();
      for (const r of reactions) {
        const entry = counts.get(r.reactionType) || { count: 0, userReacted: false };
        entry.count++;
        if (r.userId === currentUserId) entry.userReacted = true;
        counts.set(r.reactionType, entry);
      }
      return Array.from(counts.entries()).map(([type, { count, userReacted }]) => ({ type, count, userReacted }));
    };

    return {
      ...item,
      tags: item.tags.map((t) => t.tag),
      children: item.children.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
      reactionSummary: buildSummary(item.reactions),
      assignmentReceipt,
      contributions: item.contributions.map((c: any) => ({
        ...c,
        reactionSummary: buildSummary(c.reactions),
        reactions: undefined,
      })),
      reactions: undefined,
    };
  });

  // Update item
  fastify.patch<{ Params: { spaceId: string; id: string }; Body: z.infer<typeof updateItemSchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot update items');
      }

      const existingItem = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!existingItem) {
        return reply.notFound('Item not found');
      }

      // Copie de sÃ©ance : seule l'organisation (parent, tags) est modifiable, par tout membre
      if (isLocked(existingItem)) {
        if (lockedFieldViolations(request.body as Record<string, unknown>).length > 0) {
          return reply.forbidden(LOCKED_MESSAGE);
        }
      } else if (membership.role === 'MEMBER' && !canMemberManageItem(existingItem, request.user.userId)) {
        return reply.forbidden('Members can only edit items they created or are assigned to');
      }

      const body = updateItemSchema.parse(request.body);
      const { tagIds, updatedAt: clientUpdatedAt, propagateToChildren, ...updateData } = body;
      // Statut cohérent avec le type (changement de type ou de statut) : statut réservé à un autre type retiré,
      // question remise à « Ouverte » si son statut n'est pas une issue (utils/question.ts)
      const finalType = updateData.type ?? existingItem.type;
      if (updateData.type !== undefined || updateData.status !== undefined) {
        const current = updateData.status !== undefined ? updateData.status : existingItem.status;
        const normalized = statusForType(finalType, current);
        if (normalized !== current) updateData.status = normalized;
      }

      if (updateData.parentId && updateData.parentId !== existingItem.parentId) {
        const violation = await parentViolation(fastify.prisma, updateData.parentId, request.params.spaceId, request.user.userId, request.isAdminMode);
        if (violation) return reply.badRequest(violation);
      }

      // Optimistic locking: if client sends updatedAt, compare with server
      if (clientUpdatedAt) {
        const serverUpdatedAt = existingItem.updatedAt.toISOString();
        const clientDate = new Date(clientUpdatedAt).toISOString();

        if (serverUpdatedAt !== clientDate) {
          // Build list of conflicting fields (only fields the client is trying to change)
          const FIELD_LABELS: Record<string, string> = {
            type: 'Type',
            title: 'Titre',
            description: 'Description',
            status: 'Statut',
            priority: 'PrioritÃ©',
            dueDate: 'Date d\'Ã©chÃ©ance',
            startDate: 'Date de dÃ©but',
            endDate: 'Date de fin',
            parentId: 'Parent',
            assignedToId: 'AssignÃ© Ã ',
            assignedToName: 'AssignÃ© Ã ',
            manualHorizon: 'Horizon',
          };

          const conflicts: Array<{ field: string; label: string; serverValue: unknown; clientValue: unknown }> = [];

          for (const [field, clientValue] of Object.entries(updateData)) {
            // Skip content (not comparable) and fields not in labels
            if (field === 'content' || !FIELD_LABELS[field]) continue;

            const serverValue = (existingItem as any)[field];
            // Normalize for comparison: dates to ISO, null/undefined equivalence
            const normalizeValue = (v: unknown) => {
              if (v === undefined || v === null || v === '') return null;
              if (v instanceof Date) return v.toISOString();
              return v;
            };

            const normalizedServer = normalizeValue(serverValue);
            const normalizedClient = normalizeValue(clientValue);

            if (normalizedServer !== normalizedClient) {
              conflicts.push({
                field,
                label: FIELD_LABELS[field],
                serverValue: normalizedServer,
                clientValue: normalizedClient,
              });
            }
          }

          // Only return 409 if there are actual field conflicts
          if (conflicts.length > 0) {
            return reply.status(409).send({
              statusCode: 409,
              code: 'CONFLICT_DETECTED',
              message: 'Cet Ã©lÃ©ment a Ã©tÃ© modifiÃ© par un autre utilisateur depuis votre derniÃ¨re lecture.',
              serverUpdatedAt,
              conflicts,
            });
          }
        }
      }

      // Save state before update for audit
      const beforeState = serializeItemForAudit(existingItem);

      // Handle tag updates
      if (tagIds !== undefined) {
        await fastify.prisma.itemTag.deleteMany({
          where: { itemId: request.params.id },
        });
      }

      // Dates liÃ©es au statut (utils/statusDates.ts) : ne complÃ¨te que les dates absentes du payload
      // Statuts de la communauté : un statut personnalisé de catégorie « terminé » remplit aussi la fin
      const spaceStatuses = updateData.status !== undefined ? await statusesOfSpace(fastify.prisma, existingItem.spaceId) : undefined;
      const autoDates = updateData.status !== undefined
        ? statusDateDefaults(updateData.status, {
            startDate: updateData.startDate !== undefined ? (updateData.startDate ? new Date(updateData.startDate) : null) : existingItem.startDate,
            endDate: updateData.endDate !== undefined ? (updateData.endDate ? new Date(updateData.endDate) : null) : existingItem.endDate,
          }, new Date(), spaceStatuses)
        : {};
      const autoStartDate = updateData.startDate === undefined ? autoDates.startDate : undefined;
      const autoEndDate = updateData.endDate === undefined ? autoDates.endDate : undefined;

      // Auto-set horizonSetAt Ã  chaque changement de manualHorizon â€” jamais fourni par le
      // client, c'est lui qui mesure le dÃ©passement de grÃ¢ce (isOverdueForReview), pas updatedAt.
      const autoHorizonSetAt = updateData.manualHorizon !== undefined ? new Date() : undefined;

      const item = await fastify.prisma.item.update({
        where: { id: request.params.id },
        data: {
          ...updateData,
          ...exclusiveAssignee(updateData),
          ...assignmentStamp(existingItem.assignedToId, exclusiveAssignee(updateData).assignedToId, request.user.userId),
          updatedById: request.user.userId,
          dueDate: updateData.dueDate === null ? null : updateData.dueDate ? new Date(updateData.dueDate) : undefined,
          startDate: updateData.startDate === null ? null : updateData.startDate ? new Date(updateData.startDate) : (autoStartDate || undefined),
          endDate: updateData.endDate === null ? null : updateData.endDate ? new Date(updateData.endDate) : (autoEndDate || undefined),
          horizonSetAt: autoHorizonSetAt,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        } as any,
        include: {
          tags: { include: { tag: true } },
        },
      });

      // Audit log for UPDATE
      await createAuditLog(fastify.prisma, {
        action: 'UPDATE',
        entity: 'Item',
        entityId: item.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: beforeState,
          after: serializeItemForAudit(item),
        },
      });

      // Question : issue détaillée cohérente avec le nouveau statut (qui/quand, option retenue effacée hors « Tranchée »)
      if (finalType === 'QUESTION' && item.status !== existingItem.status) {
        await syncQuestionAfterStatus(fastify.prisma, item.id, item.status, request.user.userId);
      }

      // Propagate status to all descendants recursively (seulement ceux dont le type admet ce statut)
      if (propagateToChildren && updateData.status !== undefined) {
        type Descendant = { id: string; type: string; startDate: Date | null; endDate: Date | null };
        const collectDescendants = async (parentId: string): Promise<Descendant[]> => {
          const children: Descendant[] = await fastify.prisma.item.findMany({
            where: { parentId, spaceId: request.params.spaceId, lockedAt: null },
            select: { id: true, type: true, startDate: true, endDate: true },
          });
          const all = [...children];
          for (const child of children) {
            all.push(...await collectDescendants(child.id));
          }
          return all;
        };
        const descendants = (await collectDescendants(request.params.id))
          .filter((d) => statusAllowedForType(updateData.status, d.type));
        if (descendants.length > 0) {
          await fastify.prisma.item.updateMany({
            where: { id: { in: descendants.map(d => d.id) } },
            data: { status: updateData.status },
          });
          // MÃªmes rÃ¨gles de dates que l'item propagÃ©, item par item (dates vides seulement)
          const now = new Date();
          for (const d of descendants) {
            const dates = statusDateDefaults(updateData.status, d, now, spaceStatuses);
            if (dates.startDate || dates.endDate) {
              await fastify.prisma.item.update({ where: { id: d.id }, data: dates });
            }
          }
        }
      }

      // Notify @mentioned users in updated description
      if (updateData.description && updateData.description !== existingItem.description) {
        const authorName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await notifyMentionedUsers(fastify.prisma, updateData.description, request.user.userId, authorName, item.id, item.title, request.params.spaceId);
      }

      // Notify on assignment change
      if (updateData.assignedToId && updateData.assignedToId !== existingItem.assignedToId && updateData.assignedToId !== request.user.userId) {
        const assignerName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';
        await createNotification(fastify.prisma, {
          userId: updateData.assignedToId,
          type: 'ASSIGNMENT',
          title: `${assignerName} vous a assignÃ© Â« ${item.title} Â»`,
          link: `/spaces/${request.params.spaceId}`,
          metadata: { actorId: request.user.userId, actorName: assignerName, itemId: item.id, itemTitle: item.title },
        });
      }

      return {
        ...item,
        tags: item.tags.map((t) => t.tag),
      };
    }
  );

  // Split item description by headings into child items
  // Contenus (images, fichiers, liens, schémas) : restent sur l'élément d'origine, enfants sans contenu (règle item-split-keeps-contents)
  fastify.post<{ Params: { spaceId: string; id: string } }>('/:id/split', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') return reply.forbidden('Insufficient permissions');

    const item = await fastify.prisma.item.findFirst({
      where: { id: request.params.id, spaceId: request.params.spaceId },
    });
    if (!item) return reply.notFound('Item not found');
    if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);
    if (!item.description) return reply.badRequest('Item has no description');

    // Parse HTML: split on H2/H3 (seuls niveaux disponibles dans l'Ã©diteur)
    const html = item.description;
    const headingRegex = /<h([2-3])[^>]*>([\s\S]*?)<\/h[2-3]>/gi;
    const matches: { index: number; end: number; title: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(html)) !== null) {
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      matches.push({ index: match.index, end: match.index + match[0].length, title });
    }

    if (matches.length === 0) return reply.badRequest('No H2/H3 headings found in description');

    // Content before first heading stays in parent
    const preContent = html.slice(0, matches[0].index).trim();

    // Sections: one child per heading
    const sections = matches.map((m, i) => ({
      title: m.title,
      description: html.slice(m.end, i + 1 < matches.length ? matches[i + 1].index : html.length).trim(),
    }));

    // Get max position among existing children
    const siblings = await fastify.prisma.item.findMany({
      where: { parentId: item.id, spaceId: item.spaceId },
      select: { position: true },
      orderBy: { position: 'desc' },
    });
    let nextPosition = siblings.length > 0 ? (siblings[0].position ?? 0) + 1 : 0;

    // Create children
    const children = await Promise.all(
      sections.map((section) => {
        const pos = nextPosition++;
        return fastify.prisma.item.create({
          data: {
            title: section.title || 'Sans titre',
            description: section.description || null,
            type: 'UNDEFINED',
            spaceId: item.spaceId,
            parentId: item.id,
            position: pos,
            status: item.status,
            createdById: request.user.userId,
          } as any,
        });
      })
    );

    // Update parent description (keep only pre-heading content)
    await fastify.prisma.item.update({
      where: { id: item.id },
      data: { description: preContent || null },
    });

    return { children, preContent };
  });

  // Delete item
  fastify.delete<{ Params: { spaceId: string; id: string }; Querystring: { deleteChildren?: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Insufficient permissions');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    // Copie de sÃ©ance : seul le propriÃ©taire de l'espace (animateur) peut la retirer
    if (isLocked(item) && membership.role !== 'OWNER') {
      return reply.forbidden(LOCKED_MESSAGE);
    }

    if (membership.role === 'MEMBER' && !canMemberManageItem(item, request.user.userId)) {
      return reply.forbidden('Members can only delete items they created or are assigned to');
    }

    const deleteChildren = request.query.deleteChildren === 'true';
    const batchId = crypto.randomUUID();

    if (deleteChildren) {
      // Recursively collect all descendant IDs
      const collectDescendantIds = async (parentId: string): Promise<string[]> => {
        const children = await fastify.prisma.item.findMany({
          where: { parentId, spaceId: request.params.spaceId },
          select: { id: true },
        });
        const ids: string[] = [];
        for (const child of children) {
          ids.push(child.id);
          ids.push(...await collectDescendantIds(child.id));
        }
        return ids;
      };

      const descendantIds = await collectDescendantIds(request.params.id);

      if (descendantIds.length > 0) {
        // Fetch full data for each descendant BEFORE deleting (for audit)
        const descendants = await fastify.prisma.item.findMany({
          where: { id: { in: descendantIds } },
        });

        // Copies de sÃ©ance parmi les descendants : seul le propriÃ©taire de l'espace peut les supprimer
        if (membership.role !== 'OWNER' && descendants.some(isLocked)) {
          return reply.forbidden(LOCKED_MESSAGE);
        }

        await fastify.prisma.item.deleteMany({
          where: { id: { in: descendantIds } },
        });

        // Audit log for EACH descendant individually
        for (const descendant of descendants) {
          await createAuditLog(fastify.prisma, {
            action: 'DELETE',
            entity: 'Item',
            entityId: descendant.id,
            userId: request.user.userId,
            spaceId: request.params.spaceId,
            batchId,
            changes: {
              before: serializeItemForAudit(descendant),
            },
          });
        }
      }
    }

    // Save state before delete for audit
    const beforeState = serializeItemForAudit(item);

    await fastify.prisma.item.delete({
      where: { id: request.params.id },
    });

    // Audit log for DELETE (parent item)
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Item',
      entityId: item.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      batchId: deleteChildren ? batchId : undefined,
      changes: {
        before: beforeState,
      },
    });

    return { success: true };
  });
};
