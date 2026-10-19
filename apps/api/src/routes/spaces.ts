/*
 * Routes /spaces : CRUD (visibilité effective, accès anonyme aux espaces publics), hiérarchie,
 * membres (multi-OWNER), invitations par token, join/leave, avatar/cover, sous-routes items/tags/
 * referentiels. Suppression : space OWNER, community OWNER ou admin en mode admin — écriture déléguée
 * à utils/spaceDeletion.ts, en transaction (tout ou rien).
 * Gestion (membres, invitations, images, emails) : isSpaceOwnerOrAdmin — le mode admin voit et fait
 * tout. Actions personnelles (join/leave, transfert de sa propriété) liées à l'appelant.
 * leave : un propriétaire peut partir s'il reste un autre propriétaire (jamais d'espace sans OWNER).
 * GET / en mode admin : espaces de toutes les communautés (ou de celle demandée), privés compris, rôle OWNER.
 * POST / et PATCH visibility : OPEN/READONLY/PRIVATE ou null (= héritée) — POST l'applique dès la création (GROUP). GET /:id renvoie inheritedVisibility +
 * inheritedFrom ('parent' | 'community') pour l'écran des paramètres.
 * Communauté publique = visibility !== 'PRIVATE' uniquement (isPublic déprécié, jamais lu).
 * Images avatar/cover : formats et tailles via validateUpload('image') de @spok/shared.
 * GET / (sidebar) : espaces non-membre filtrés sur la visibilité EFFECTIVE (keepVisibleWithRole) — jamais
 * sur la visibilité propre seule, sinon un sous-espace d'un parent privé fuit dans la liste.
 * PATCH /:id : isSpaceOwnerOrAdmin comme le reste de la gestion — un admin global hors mode admin est refusé.
 * Changement de communauté (explicite ou hérité du nouveau parent) : appliqué à tous les sous-espaces
 * descendants, dans la même transaction que l'espace (membre de la communauté cible requis hors mode admin).
 * Espace PRIVATE (visibilité effective) : réservé aux membres directs et à l'admin — GET /:id et
 * /:id/members passent par checkSpaceAccess (READONLY → rôle VIEWER), /:id/join réservé aux espaces
 * OUVERTS (hors propriétaire de communauté / mode admin), création d'un sous-espace ou rattachement
 * (PATCH parentId) = accès en écriture (OWNER/MEMBER) au parent. Être membre de la
 * communauté ne suffit jamais pour un espace privé — être son PROPRIÉTAIRE, si : rôle OWNER dans
 * tous les espaces de la communauté (GET /, GET /:id, PATCH, gestion, join, contenu via checkSpaceAccess).
 * Ordre manuel (2026-10-16, utils/spaceOrder.ts) : listes triées position puis nom ; création / changement
 * d'emplacement → en dernier parmi les frères ; PUT /reorder réordonne des frères (droits : voir la route).
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Role, SpaceDeletePreview } from '@spok/shared';
import { SPACE_TEMPLATES, validateUpload } from '@spok/shared';
import type { SpaceTemplateItem } from '@spok/shared';
import { itemsRoutes, getEffectiveVisibility, getEffectiveVisibilities, checkSpaceAccess, isCommunityOwnerOfSpace } from './items.js';
import { tagsRoutes } from './tags.js';
import { referentielsRoutes } from './referentiels.js';
import { auditLogsRoutes } from './auditLogs.js';
import { isR2Configured, processAvatar, processCover, uploadEntityImage, deleteFileFromR2 } from '../utils/r2.js';
import { wrapEmailTemplate } from '../utils/emailTemplate.js';
import { runDeletion, deleteSpaceTree } from '../utils/spaceDeletion.js';
import { SPACE_ORDER_BY, compareSpaceOrder, nextSiblingPosition, reorderSiblings } from '../utils/spaceOrder.js';
import { createNotification, sendInvitationEmail } from '../utils/notifications.js';
import { createInvitation as createInvitationHelper } from './invitations.js';
import { createItemTree } from '../utils/itemTree.js';

const createSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'GROUP']),
  communityId: z.string().optional(),
  parentId: z.string().optional(),
  templateId: z.string().optional(),
  // Visibilité dès la création (GROUP seulement) : évite qu'un espace voulu privé naisse « hérité »,
  // donc visible dans une communauté publique, le temps d'un PATCH. null/absent = héritée
  visibility: z.enum(['OPEN', 'READONLY', 'PRIVATE']).nullable().optional(),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  communityId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  defaultRole: z.enum(['MEMBER']).nullable().optional(),
  visibility: z.enum(['OPEN', 'READONLY', 'PRIVATE']).nullable().optional(), // null = héritée (parent → communauté)
  defaultView: z.string().nullable().optional(),
  coverPosition: z.number().int().min(0).max(100).optional(),
  coverPositionX: z.number().int().min(0).max(100).optional(),
  coverZoom: z.number().int().min(100).max(300).optional(),
});

// PUT /reorder : frères d'un parent (parentId) ou de la racine d'une communauté (parentId null + communityId)
const reorderSpacesSchema = z.object({
  parentId: z.string().nullable().optional(),
  communityId: z.string().nullable().optional(),
  orderedIds: z.array(z.string()).min(1).max(500),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'MEMBER']),
  message: z.string().optional(),
});

// Admin global avec le mode admin activé (header X-Admin-Mode) : le mode admin voit et fait tout
async function isAdminModeActive(prisma: any, userId: string, isAdminMode: boolean): Promise<boolean> {
  if (!isAdminMode) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
  return user?.globalRole === 'ADMIN';
}

// Visibilité qu'aurait l'espace sans réglage propre : celle (effective) du parent, sinon celle de la
// communauté, sinon PRIVATE. Renvoyée par GET /:id pour afficher le choix « Héritée » des paramètres.
async function getInheritedVisibility(prisma: any, space: { parentId: string | null; communityId: string | null }) {
  if (space.parentId) return { inheritedVisibility: await getEffectiveVisibility(prisma, space.parentId), inheritedFrom: 'parent' as const };
  if (space.communityId) {
    const community = await prisma.community.findUnique({ where: { id: space.communityId }, select: { visibility: true } });
    return { inheritedVisibility: community?.visibility ?? 'PRIVATE', inheritedFrom: 'community' as const };
  }
  return { inheritedVisibility: 'PRIVATE', inheritedFrom: null };
}

// Garde des actions de gestion d'un espace : OWNER de l'espace, OWNER de sa communauté, ou admin
// en mode admin. Ne pas l'utiliser pour les actions personnelles (join/leave, transfert de sa propre propriété).
async function isSpaceOwnerOrAdmin(prisma: any, spaceId: string, userId: string, isAdminMode: boolean): Promise<boolean> {
  if (await isAdminModeActive(prisma, userId, isAdminMode)) return true;
  const membership = await prisma.spaceMembership.findUnique({
    where: { userId_spaceId: { userId, spaceId } },
    select: { role: true },
  });
  if (membership?.role === 'OWNER') return true;
  return isCommunityOwnerOfSpace(prisma, userId, spaceId);
}

export const spacesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register nested routes — optional auth (each file adds authenticate on write routes)
  await fastify.register(async function (optInstance) {
    optInstance.addHook('preHandler', optInstance.optionalAuthenticate);
    await optInstance.register(itemsRoutes, { prefix: '/:spaceId/items' });
    await optInstance.register(tagsRoutes, { prefix: '/:spaceId/tags' });
    await optInstance.register(referentielsRoutes, { prefix: '/:spaceId/referentiels' });
    await optInstance.register(auditLogsRoutes, { prefix: '/:spaceId/audit-logs' });
  });

  // Espaces non-membre listés : visibilité EFFECTIVE (héritée des parents) — un sous-espace sous un parent
  // privé n'apparaît pas, et le rôle implicite suit la visibilité héritée (READONLY → VIEWER, OPEN → MEMBER).
  // Renvoie les espaces non privés avec leur rôle ; ne s'applique pas aux espaces gérés (OWNER).
  async function keepVisibleWithRole<T extends { id: string }>(spaces: T[]): Promise<Array<{ space: T; role: Role }>> {
    const visibilities = await getEffectiveVisibilities(fastify.prisma, spaces.map(s => s.id));
    return spaces.flatMap((space) => {
      const v = visibilities.get(space.id)?.visibility;
      if (!v || v === 'PRIVATE') return [];
      return [{ space, role: (v === 'READONLY' ? 'VIEWER' : 'MEMBER') as Role }];
    });
  }

  // List spaces (authenticated: all accessible; anonymous: public community spaces only)
  fastify.get<{ Querystring: { communityId?: string; parentId?: string } }>('/', { preHandler: [fastify.optionalAuthenticate] }, async (request) => {
    const { communityId } = request.query;
    const userId = request.user?.userId;

    // Anonymous visitor: only non-PRIVATE community spaces
    if (!userId) {
      // No communityId: return all spaces from public communities
      if (!communityId || communityId === 'none') {
        const spaces = await fastify.prisma.space.findMany({
          where: {
            type: 'GROUP',
            community: { visibility: { not: 'PRIVATE' } },
            // Pré-filtre (null = héritée, à garder) ; l'héritage est tranché par keepVisibleWithRole
            OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }],
          },
          include: {
            _count: { select: { memberships: true, items: true } },
            community: { select: { id: true, name: true, avatarUrl: true } },
            parent: { select: { id: true, name: true } },
          },
          orderBy: SPACE_ORDER_BY,
        });

        return (await keepVisibleWithRole(spaces)).map(({ space: s, role }) => ({
          ...s,
          role,
          memberCount: s._count.memberships,
          itemCount: s._count.items,
          isMember: false,
        }));
      }

      const community = await fastify.prisma.community.findUnique({
        where: { id: communityId },
        select: { visibility: true },
      });
      if (!community || community.visibility === 'PRIVATE') return [];

      const spaces = await fastify.prisma.space.findMany({
        where: { communityId, type: 'GROUP', OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }] },
        include: {
          _count: { select: { memberships: true, items: true } },
          community: { select: { id: true, name: true, avatarUrl: true } },
          parent: { select: { id: true, name: true } },
        },
        orderBy: SPACE_ORDER_BY,
      });

      return (await keepVisibleWithRole(spaces)).map(({ space: s, role }) => ({
        ...s,
        role,
        memberCount: s._count.memberships,
        itemCount: s._count.items,
        isMember: false,
      }));
    }

    // Build filter based on communityId parameter
    let spaceFilter: { communityId?: string | null } = {};
    let isPublicCommunity = false;
    let hasCommunityMembership = false;

    if (communityId === 'none') {
      spaceFilter = { communityId: null };
    } else if (communityId) {
      const [communityMembership, community, currentUser] = await Promise.all([
        fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId: request.user.userId, communityId } },
        }),
        fastify.prisma.community.findUnique({
          where: { id: communityId },
          select: { visibility: true },
        }),
        fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } }),
      ]);

      const isAdminBypass = currentUser?.globalRole === 'ADMIN' && request.isAdminMode;
      isPublicCommunity = !!community && community.visibility !== 'PRIVATE';
      hasCommunityMembership = !!communityMembership;

      if (!communityMembership && !isAdminBypass && !isPublicCommunity) {
        return [];
      }

      spaceFilter = { communityId };
    }

    // 1. Get spaces where user is a member
    const memberships = await fastify.prisma.spaceMembership.findMany({
      where: {
        userId: request.user.userId,
        space: spaceFilter,
      },
      include: {
        space: {
          include: {
            _count: {
              select: { memberships: true, items: true },
            },
            community: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
            memberships: {
              where: { role: 'OWNER' },
              include: { user: { select: { id: true, name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ space: { position: 'asc' } }, { space: { name: 'asc' } }],
    });

    // Communautés dont l'utilisateur est propriétaire : OWNER dans tous leurs espaces, privés compris
    const userCommunities = await fastify.prisma.communityMembership.findMany({
      where: { userId: request.user.userId },
      select: { communityId: true, role: true },
    });
    const ownedCommunityIds = new Set(userCommunities.filter(c => c.role === 'OWNER').map(c => c.communityId));

    const memberSpaces = memberships.map((m) => ({
      ...m.space,
      role: (m.space.communityId && ownedCommunityIds.has(m.space.communityId) ? 'OWNER' : m.role) as Role,
      memberCount: m.space._count.memberships,
      itemCount: m.space._count.items,
      isMember: true,
      owner: (m.space as any).memberships?.[0]?.user || null,
    }));

    // 2. Get community spaces the user can see but hasn't joined
    const communityIds = userCommunities.map(c => c.communityId);
    const memberSpaceIds = new Set(memberSpaces.map(s => s.id));

    // If a specific public community is requested but user is not a member, include it anyway
    const effectiveCommunityIds = communityId && communityId !== 'none' && isPublicCommunity && !hasCommunityMembership
      ? [communityId]
      : communityIds;

    // Mode admin : espaces de TOUTES les communautés (ou de celle demandée), privés compris, rôle OWNER —
    // sinon la sidebar (liste sans communityId) omet les espaces des communautés dont l'admin n'est pas membre.
    const adminModeOn = communityId !== 'none' && await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode);

    if (effectiveCommunityIds.length > 0 || adminModeOn) {
      const communitySpaceFilter: Record<string, unknown> = {
        communityId: communityId && communityId !== 'none'
          ? communityId
          : adminModeOn ? { not: null } : { in: effectiveCommunityIds },
        type: 'GROUP',
        id: { notIn: Array.from(memberSpaceIds) },
        ...(adminModeOn ? {} : { OR: [
          { visibility: null },
          { visibility: { not: 'PRIVATE' } },
          ...(ownedCommunityIds.size > 0 ? [{ communityId: { in: Array.from(ownedCommunityIds) } }] : []),
        ] }),
      };

      const visibleSpaces = await fastify.prisma.space.findMany({
        where: communitySpaceFilter,
        include: {
          _count: {
            select: { memberships: true, items: true },
          },
          community: {
            select: { id: true, name: true },
          },
          parent: {
            select: { id: true, name: true },
          },
          memberships: {
            where: { role: 'OWNER' },
            include: { user: { select: { id: true, name: true } } },
            take: 1,
          },
        },
        orderBy: SPACE_ORDER_BY,
      });

      // Mode admin / communauté possédée → OWNER, tout est listé. Sinon visibilité effective : un sous-espace
      // hérité d'un parent privé est retiré, le rôle implicite suit la visibilité héritée.
      const managed = visibleSpaces.filter(s => adminModeOn || (s.communityId && ownedCommunityIds.has(s.communityId)));
      const managedIds = new Set(managed.map(s => s.id));
      const others = await keepVisibleWithRole(visibleSpaces.filter(s => !managedIds.has(s.id)));
      const roleById = new Map<string, Role>([
        ...managed.map(s => [s.id, 'OWNER' as Role] as const),
        ...others.map(({ space, role }) => [space.id, role] as const),
      ]);

      const nonMemberSpaces = visibleSpaces.filter(s => roleById.has(s.id)).map((s) => ({
        ...s,
        role: roleById.get(s.id)!,
        memberCount: s._count.memberships,
        itemCount: s._count.items,
        isMember: false,
        owner: (s as any).memberships?.[0]?.user || null,
      }));

      // Deux requêtes fusionnées : ordre manuel global (position puis nom), voir utils/spaceOrder.ts
      return [...memberSpaces, ...nonMemberSpaces].sort(compareSpaceOrder);
    }

    return memberSpaces;
  });

  // Create space
  fastify.post<{ Body: z.infer<typeof createSpaceSchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createSpaceSchema.parse(request.body);

    // PERSONAL spaces cannot be nested or have communities
    if (body.type === 'PERSONAL') {
      if (body.communityId) {
        return reply.badRequest('Personal spaces cannot be associated with a community');
      }
      if (body.parentId) {
        return reply.badRequest('Les espaces personnels ne peuvent pas être imbriqués');
      }
    }

    let communityId = body.communityId;

    // If parentId is specified, validate parent and inherit communityId
    if (body.parentId) {
      const parentSpace = await fastify.prisma.space.findUnique({
        where: { id: body.parentId },
      });

      if (!parentSpace) {
        return reply.notFound('Espace parent introuvable');
      }

      if (parentSpace.type !== 'GROUP') {
        return reply.badRequest('Seuls les espaces de groupe peuvent avoir des sous-espaces');
      }

      // Créer un sous-espace = écrire dans le parent : OWNER/MEMBER (direct ou implicite OPEN),
      // mode admin compris — un membre de la communauté sans accès à un parent privé est refusé
      const parentAccess = await checkSpaceAccess(fastify.prisma, request.user.userId, body.parentId, request.isAdminMode);
      if (!parentAccess || (parentAccess.role !== 'OWNER' && parentAccess.role !== 'MEMBER')) {
        return reply.forbidden('Accès en écriture à l\'espace parent requis');
      }

      // Inherit communityId from parent (ignore what was passed)
      communityId = parentSpace.communityId || undefined;
    }

    // Verify user is member of the community if specified (bypass for admin mode)
    if (communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId,
          },
        },
      });

      if (!communityMembership) {
        const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } });
        const isAdminBypass = currentUser?.globalRole === 'ADMIN' && request.isAdminMode;
        if (!isAdminBypass) {
          return reply.forbidden('You are not a member of this community');
        }
      }
    }

    // Ordre manuel : le nouvel espace arrive en dernier parmi ses frères
    const position = body.type === 'GROUP' ? await nextSiblingPosition(fastify.prisma, body.parentId ?? null, communityId ?? null) : 0;

    const space = await fastify.prisma.space.create({
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        communityId,
        parentId: body.parentId,
        position,
        ...(body.type === 'GROUP' && body.visibility !== undefined && { visibility: body.visibility }),
        memberships: {
          create: {
            userId: request.user.userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Apply template if specified
    const template = body.templateId ? SPACE_TEMPLATES.find(t => t.id === body.templateId) : null;
    if (template && template.id !== 'blank') {
      // Create template items (les statuts restent ceux de la communauté)
      if (template.items && template.items.length > 0) {
        await createItemTree(fastify.prisma, template.items, {
          spaceId: space.id,
          createdById: request.user.userId,
          parentId: null,
        });
      }
    }

    return reply.status(201).send({ ...space, role: 'OWNER' as Role });
  });

  // Réordonner des espaces frères (ordre manuel, commun à tous les membres — utils/spaceOrder.ts).
  // Droits : sous un parent → gestion du parent (OWNER, OWNER de la communauté, admin en mode admin) ;
  // racine d'une communauté → OWNER de la communauté ou admin ; racine sans communauté → admin seulement.
  fastify.put<{ Body: z.infer<typeof reorderSpacesSchema> }>('/reorder', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = reorderSpacesSchema.parse(request.body);
    const userId = request.user.userId;
    let communityId = body.communityId ?? null;

    if (body.parentId) {
      const parent = await fastify.prisma.space.findUnique({ where: { id: body.parentId }, select: { communityId: true } });
      if (!parent) return reply.notFound('Espace parent introuvable');
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, body.parentId, userId, request.isAdminMode))) {
        return reply.forbidden('Seul le propriétaire de l\'espace parent peut réordonner ses sous-espaces');
      }
      communityId = parent.communityId;
    } else if (!(await isAdminModeActive(fastify.prisma, userId, request.isAdminMode))) {
      const membership = communityId
        ? await fastify.prisma.communityMembership.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { role: true } })
        : null;
      if (membership?.role !== 'OWNER') {
        return reply.forbidden('Seul le propriétaire de la communauté peut réordonner ses espaces');
      }
    }

    const order = await fastify.prisma.$transaction((tx) => reorderSiblings(tx, body.parentId ?? null, communityId, body.orderedIds));
    return { order };
  });

  // Get space by ID (direct membership, community membership, or public community)
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const userId = request.user?.userId;
    // Mode admin : rôle OWNER renvoyé (membre ou non) → les écrans débloquent toutes les actions
    const adminModeOn = !!userId && await isAdminModeActive(fastify.prisma, userId, request.isAdminMode);
    // Propriétaire de la communauté : OWNER dans tous ses espaces, privés compris
    const communityOwner = !!userId && await isCommunityOwnerOfSpace(fastify.prisma, userId, request.params.id);

    // 1. If authenticated, try direct membership
    if (userId) {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId,
            spaceId: request.params.id,
          },
        },
        include: {
          space: {
            include: {
              _count: {
                select: { memberships: true, items: true },
              },
              community: {
                select: { id: true, name: true },
              },
              parent: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (membership) {
        return {
          ...membership.space,
          ...(await getInheritedVisibility(fastify.prisma, membership.space)),
          role: adminModeOn || communityOwner ? ('OWNER' as Role) : membership.role,
          memberCount: membership.space._count.memberships,
          itemCount: membership.space._count.items,
        };
      }

      // 1b. Accès sans adhésion : propriétaire de la communauté ou admin EN MODE ADMIN → OWNER.
      // Hors mode admin, un admin global est un utilisateur normal (aucune lecture d'office).
      if (adminModeOn || communityOwner) {
        const adminSpace = await fastify.prisma.space.findUnique({
          where: { id: request.params.id },
          include: {
            _count: { select: { memberships: true, items: true } },
            community: { select: { id: true, name: true } },
            parent: { select: { id: true, name: true } },
          },
        });
        if (adminSpace) {
          return {
            ...adminSpace,
            ...(await getInheritedVisibility(fastify.prisma, adminSpace)),
            role: 'OWNER' as Role,
            memberCount: adminSpace._count.memberships,
            itemCount: adminSpace._count.items,
          };
        }
      }
    }

    // 2. Membre de la communauté ou communauté publique : même règle que checkSpaceAccess
    // (visibilité effective — PRIVATE réservé aux membres directs, OPEN → MEMBER, READONLY → VIEWER)
    const access = await checkSpaceAccess(fastify.prisma, userId, request.params.id);
    if (access && (access.role === 'MEMBER' || access.role === 'VIEWER')) {
      const space = await fastify.prisma.space.findUnique({
        where: { id: request.params.id },
        include: {
          _count: { select: { memberships: true, items: true } },
          community: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
        },
      });
      if (space) {
        return {
          ...space,
          role: access.role as Role,
          memberCount: space._count.memberships,
          itemCount: space._count.items,
        };
      }
    }

    return reply.notFound('Space not found or access denied');
  });

  // Update space
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateSpaceSchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      // Même garde que toute la gestion d'espace : OWNER de l'espace, OWNER de la communauté, ou admin
      // EN MODE ADMIN (un admin global hors mode admin n'a que ses droits de membre — aligné 2026-10-12)
      const adminModeOn = await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode);
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        const isMember = await fastify.prisma.spaceMembership.findUnique({
          where: { userId_spaceId: { userId: request.user.userId, spaceId: request.params.id } },
          select: { id: true },
        });
        return isMember ? reply.forbidden('Insufficient permissions') : reply.notFound('Space not found');
      }

      const space = await fastify.prisma.space.findUnique({
        where: { id: request.params.id },
      });
      if (!space) {
        return reply.notFound('Space not found');
      }

      const body = updateSpaceSchema.parse(request.body);

      // Cannot assign community to personal space
      if (body.communityId && space.type === 'PERSONAL') {
        return reply.badRequest('Les espaces personnels ne peuvent pas être rattachés à une communauté');
      }

      // Cannot nest personal spaces
      if (body.parentId && space.type === 'PERSONAL') {
        return reply.badRequest('Les espaces personnels ne peuvent pas être imbriqués');
      }

      // Validate parentId if provided
      let communityIdOverride: string | null | undefined = body.communityId;
      if (body.parentId !== undefined) {
        if (body.parentId !== null) {
          // Cannot set self as parent
          if (body.parentId === request.params.id) {
            return reply.badRequest('Un espace ne peut pas être son propre parent');
          }

          const parentSpace = await fastify.prisma.space.findUnique({
            where: { id: body.parentId },
          });

          if (!parentSpace) {
            return reply.notFound('Espace parent introuvable');
          }

          if (parentSpace.type !== 'GROUP') {
            return reply.badRequest('Seuls les espaces de groupe peuvent avoir des sous-espaces');
          }

          // Rattacher sous un parent = écrire dans ce parent (même règle que POST /) : sinon on
          // greffe un espace sous un parent privé auquel on n'a pas accès. Admin en mode admin : tout
          if (!adminModeOn) {
            const parentAccess = await checkSpaceAccess(fastify.prisma, request.user.userId, body.parentId, request.isAdminMode);
            if (!parentAccess || (parentAccess.role !== 'OWNER' && parentAccess.role !== 'MEMBER')) {
              return reply.forbidden('Accès en écriture à l\'espace parent requis');
            }
          }

          // Check circular reference: walk up the chain
          let currentParentId: string | null = parentSpace.parentId;
          while (currentParentId) {
            if (currentParentId === request.params.id) {
              return reply.badRequest('Référence circulaire détectée');
            }
            const ancestor = await fastify.prisma.space.findUnique({
              where: { id: currentParentId },
              select: { parentId: true },
            });
            currentParentId = ancestor?.parentId || null;
          }

          // Inherit communityId from parent
          communityIdOverride = parentSpace.communityId;
        }
      }

      // Verify user is member of the target community (skip for admin in admin mode)
      if (communityIdOverride && !adminModeOn) {
        const communityMembership = await fastify.prisma.communityMembership.findUnique({
          where: {
            userId_communityId: {
              userId: request.user.userId,
              communityId: communityIdOverride,
            },
          },
        });

        if (!communityMembership) {
          return reply.forbidden('Vous devez être membre de la communauté pour y rattacher un espace');
        }
      }

      // If communityId changes and parentId wasn't explicitly set,
      // detach from parent if parent is in a different community
      if (communityIdOverride !== undefined && body.parentId === undefined && space.parentId) {
        const currentParent = await fastify.prisma.space.findUnique({
          where: { id: space.parentId },
          select: { communityId: true },
        });
        if (currentParent && currentParent.communityId !== communityIdOverride) {
          body.parentId = null;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.parentId !== undefined) updateData.parentId = body.parentId;
      if (communityIdOverride !== undefined) updateData.communityId = communityIdOverride;
      if (body.defaultRole !== undefined) updateData.defaultRole = body.defaultRole;
      if (body.coverPosition !== undefined) updateData.coverPosition = body.coverPosition;
      if (body.coverPositionX !== undefined) updateData.coverPositionX = body.coverPositionX;
      if (body.coverZoom !== undefined) updateData.coverZoom = body.coverZoom;
      if (body.defaultView !== undefined) updateData.defaultView = body.defaultView;
      if (body.visibility !== undefined) updateData.visibility = body.visibility;

      // Ordre manuel : changer d'emplacement (parent ou communauté) = arriver en dernier parmi les nouveaux frères
      const newParentId = body.parentId !== undefined ? body.parentId : (space.parentId ?? null);
      const newCommunityId = communityIdOverride !== undefined ? communityIdOverride : (space.communityId ?? null);
      if (newParentId !== (space.parentId ?? null) || newCommunityId !== (space.communityId ?? null)) {
        updateData.position = await nextSiblingPosition(fastify.prisma, newParentId, newCommunityId, space.id);
      }

      // Si la communauté change réellement, embarquer tous les sous-espaces descendants —
      // sinon un enfant reste rattaché à l'ancienne communauté alors que son parent a bougé.
      const communityIsChanging = communityIdOverride !== undefined && communityIdOverride !== (space.communityId ?? null);
      let descendantIds: string[] = [];
      if (communityIsChanging) {
        async function collectDescendantSpaces(parentId: string): Promise<string[]> {
          const children = await fastify.prisma.space.findMany({
            where: { parentId },
            select: { id: true },
          });
          const ids: string[] = [];
          for (const child of children) {
            ids.push(child.id);
            ids.push(...(await collectDescendantSpaces(child.id)));
          }
          return ids;
        }
        descendantIds = await collectDescendantSpaces(request.params.id);
      }

      // Espace + descendants en une transaction : jamais d'arbre à moitié déplacé entre deux communautés
      const updatedSpace = await fastify.prisma.$transaction(async (tx) => {
        const updated = await tx.space.update({
          where: { id: request.params.id },
          data: updateData,
          include: {
            community: {
              select: {
                id: true,
                name: true,
              },
            },
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (descendantIds.length > 0) {
          await tx.space.updateMany({
            where: { id: { in: descendantIds } },
            data: { communityId: communityIdOverride },
          });
        }

        return updated;
      });

      return updatedSpace;
    }
  );

  // Delete preview — list children that will be affected
  fastify.get<{ Params: { id: string } }>('/:id/delete-preview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    // Check permission: space OWNER or community OWNER/ADMIN
    const spaceMembership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    let canDelete = spaceMembership?.role === 'OWNER'
      || await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode);

    if (!canDelete && space.communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: space.communityId,
          },
        },
      });
      if (communityMembership && communityMembership.role === 'OWNER') {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return reply.forbidden('Insufficient permissions');
    }

    // Collect all descendant spaces recursively
    async function collectDescendantSpaces(parentId: string): Promise<string[]> {
      const children = await fastify.prisma.space.findMany({
        where: { parentId },
        select: { id: true },
      });
      const ids: string[] = [];
      for (const child of children) {
        ids.push(child.id);
        const grandChildren = await collectDescendantSpaces(child.id);
        ids.push(...grandChildren);
      }
      return ids;
    }

    const descendantIds = await collectDescendantSpaces(request.params.id);

    // Get child spaces with item counts
    const childSpaces = await fastify.prisma.space.findMany({
      where: { id: { in: descendantIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Count direct items
    const directItemCount = await fastify.prisma.item.count({
      where: { spaceId: request.params.id },
    });

    // Count total items across all spaces (current + descendants)
    const allSpaceIds = [request.params.id, ...descendantIds];
    const totalItemCount = await fastify.prisma.item.count({
      where: { spaceId: { in: allSpaceIds } },
    });

    // Count total contributions
    const totalContributionCount = await fastify.prisma.contribution.count({
      where: { item: { spaceId: { in: allSpaceIds } } },
    });

    const preview: SpaceDeletePreview = {
      childSpaces: childSpaces.map(s => ({
        id: s.id,
        name: s.name,
        itemCount: s._count.items,
      })),
      directItemCount,
      totalItemCount,
      totalContributionCount,
    };

    return preview;
  });

  // Delete space
  fastify.delete<{ Params: { id: string }; Querystring: { deleteChildren?: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    // Check space membership
    const spaceMembership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    let canDelete = false;

    // Space OWNER can always delete (including personal spaces) ; admin en mode admin aussi
    if (spaceMembership?.role === 'OWNER' || await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode)) {
      canDelete = true;
    }

    // Community OWNER can delete community spaces (CommunityRole n'a que OWNER/MEMBER —
    // pas de rôle ADMIN au niveau communauté)
    if (!canDelete && space.communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: space.communityId,
          },
        },
      });

      if (communityMembership && communityMembership.role === 'OWNER') {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return reply.forbidden('Insufficient permissions to delete this space');
    }

    const deleteChildren = request.query.deleteChildren === 'true';
    const ctx = { userId: request.user.userId, batchId: crypto.randomUUID() };

    // Tout ou rien (utils/spaceDeletion.ts) : une erreur en cours ne laisse plus de suppression partielle
    await runDeletion(fastify.prisma, (tx) =>
      deleteSpaceTree(tx, space as unknown as { id: string } & Record<string, unknown>, deleteChildren, ctx));

    return { success: true };
  });

  // Join a community space
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    // Check the space exists and belongs to a community
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    if (!space.communityId) {
      return reply.forbidden('Can only join community spaces');
    }

    // Verify user is member of the community
    const communityMembership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: space.communityId,
        },
      },
    });

    if (!communityMembership) {
      return reply.forbidden('You must be a member of the community');
    }

    // Rejoindre de soi-même = adhésion MEMBER (écriture) : seulement sur un espace OUVERT. Privé →
    // invitation ; Lecture seule → la lecture est déjà acquise, l'écriture passe par une invitation
    // (pas de rôle VIEWER en base). Propriétaire de la communauté et mode admin : toujours autorisés
    const effectiveVisibility = await getEffectiveVisibility(fastify.prisma, request.params.id);
    if (effectiveVisibility !== 'OPEN'
      && communityMembership.role !== 'OWNER'
      && !(await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode))) {
      return reply.forbidden(effectiveVisibility === 'PRIVATE'
        ? 'Espace privé : accès sur invitation uniquement'
        : 'Espace en lecture seule : accès en écriture sur invitation uniquement');
    }

    // Check not already a member
    const existing = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (existing) {
      return reply.conflict('Already a member of this space');
    }

    await fastify.prisma.spaceMembership.create({
      data: {
        userId: request.user.userId,
        spaceId: request.params.id,
        role: 'MEMBER',
      },
    });

    return { success: true };
  });

  // Leave a space
  fastify.post<{ Params: { id: string } }>('/:id/leave', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (!membership) {
      return reply.notFound('Not a member of this space');
    }

    // Un propriétaire peut partir s'il en reste un autre (espaces multi-OWNER) ; jamais d'espace sans propriétaire
    if (membership.role === 'OWNER') {
      const otherOwners = await fastify.prisma.spaceMembership.count({
        where: { spaceId: request.params.id, role: 'OWNER', NOT: { id: membership.id } },
      });
      if (otherOwners === 0) {
        return reply.forbidden('Vous êtes le seul propriétaire : transférez d\'abord la propriété ou nommez un autre propriétaire');
      }
    }

    await fastify.prisma.spaceMembership.delete({
      where: { id: membership.id },
    });

    return { success: true };
  });

  // Get space members
  fastify.get<{ Params: { id: string } }>('/:id/members', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    // Même règle que l'accès au contenu : membre direct, admin global, ou visibilité effective
    // non privée (membre de la communauté, ou communauté publique pour un non-membre/anonyme)
    const access = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.id, request.isAdminMode);
    if (!access) {
      return reply.notFound('Space not found');
    }

    const members = await fastify.prisma.spaceMembership.findMany({
      where: { spaceId: request.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  });

  // List users not yet members of this space (community members only)
  fastify.get<{ Params: { id: string } }>('/:id/available-users', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
      return reply.forbidden('Only owners can view available users');
    }

    // Get the space's community
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
      select: { communityId: true },
    });

    const existingMemberIds = await fastify.prisma.spaceMembership.findMany({
      where: { spaceId: request.params.id },
      select: { userId: true },
    });
    const memberIds = existingMemberIds.map(m => m.userId);

    // If space has a community, show community members not in the space
    // Otherwise, show all users not in the space
    let users;
    if (space?.communityId) {
      const communityMembers = await fastify.prisma.communityMembership.findMany({
        where: {
          communityId: space.communityId,
          userId: { notIn: memberIds },
          user: { disabledAt: null },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      });
      users = communityMembers.map(m => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
      }));
    } else {
      users = await fastify.prisma.user.findMany({
        where: { id: { notIn: memberIds }, disabledAt: null },
        select: { id: true, email: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    return users;
  });

  // Add member directly to space
  fastify.post<{ Params: { id: string }; Body: { userId: string; role: string } }>(
    '/:id/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Only owners can add members');
      }

      const { userId, role } = request.body;
      if (!['OWNER', 'MEMBER'].includes(role)) {
        return reply.badRequest('Invalid role');
      }

      // Check user exists
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.notFound('User not found');

      // Check not already member
      const existing = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId: request.params.id } },
      });
      if (existing) return reply.conflict('User is already a member');

      const membership = await fastify.prisma.spaceMembership.create({
        data: {
          userId,
          spaceId: request.params.id,
          role: role as any,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      return {
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        joinedAt: membership.joinedAt,
      };
    },
  );

  // Invite member to space (creates an Invitation, not a direct membership)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof inviteSchema> }>(
    '/:id/invite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const targetSpace = await fastify.prisma.space.findUnique({ where: { id: request.params.id } });
      if (!targetSpace) {
        return reply.notFound('Space not found');
      }

      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Insufficient permissions');
      }

      if (targetSpace.type === 'PERSONAL') {
        return reply.forbidden('Cannot invite members to personal space');
      }

      const body = inviteSchema.parse(request.body);

      // Check if user is already a member
      const invitedUser = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (invitedUser) {
        const existingMembership = await fastify.prisma.spaceMembership.findUnique({
          where: { userId_spaceId: { userId: invitedUser.id, spaceId: request.params.id } },
        });
        if (existingMembership) {
          return reply.conflict('User is already a member');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await fastify.prisma.invitation.findFirst({
        where: { email: body.email, spaceId: request.params.id, status: 'PENDING' },
      });
      if (existingInvitation) {
        return reply.conflict('An invitation is already pending for this email');
      }

      const invitation = await createInvitationHelper(fastify.prisma, {
        email: body.email,
        role: body.role,
        message: body.message,
        spaceId: request.params.id,
        invitedById: request.user.userId,
      });

      // Notify invited user
      const inviterName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';

      if (invitedUser) {
        await createNotification(fastify.prisma, {
          userId: invitedUser.id,
          type: 'INVITATION',
          title: `${inviterName} vous invite à rejoindre l'espace « ${targetSpace.name} »`,
          link: `/invitations`,
          metadata: { actorId: request.user.userId, actorName: inviterName, spaceName: targetSpace.name, invitationId: invitation.id },
        });
      }

      // Send invitation email
      await sendInvitationEmail({
        to: body.email,
        inviterName,
        targetName: targetSpace.name,
        targetType: 'espace',
        token: invitation.token,
        message: body.message,
        role: body.role,
      });

      return reply.status(201).send(invitation);
    }
  );

  // List pending invitations for a space
  fastify.get<{ Params: { id: string } }>(
    '/:id/invitations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Insufficient permissions');
      }

      const invitations = await fastify.prisma.invitation.findMany({
        where: { spaceId: request.params.id },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invitations;
    }
  );

  // Remove member from space
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Insufficient permissions');
      }

      const memberToRemove = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToRemove || memberToRemove.spaceId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      if (memberToRemove.role === 'OWNER') {
        return reply.forbidden('Cannot remove a space owner');
      }

      await fastify.prisma.spaceMembership.delete({
        where: { id: request.params.memberId },
      });

      return { success: true };
    }
  );

  // Update member role in space
  fastify.patch<{ Params: { id: string; memberId: string }; Body: { role: string } }>(
    '/:id/members/:memberId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Only the owner can change member roles');
      }

      const memberToUpdate = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToUpdate || memberToUpdate.spaceId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      // If demoting an owner, ensure at least one owner remains
      if (memberToUpdate.role === 'OWNER' && request.body.role !== 'OWNER') {
        const ownerCount = await fastify.prisma.spaceMembership.count({
          where: { spaceId: request.params.id, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return reply.forbidden('Cannot demote the last owner');
        }
      }

      const updated = await fastify.prisma.spaceMembership.update({
        where: { id: request.params.memberId },
        data: { role: request.body.role as any },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return {
        id: updated.id,
        userId: updated.userId,
        email: updated.user.email,
        name: updated.user.name,
        role: updated.role,
        joinedAt: updated.joinedAt,
      };
    }
  );

  // Transfer space ownership
  fastify.post<{ Params: { id: string }; Body: { targetMemberId: string } }>(
    '/:id/transfer-ownership',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const ownership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
      });

      if (!ownership || ownership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can transfer ownership');
      }

      const targetMember = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.body.targetMemberId },
      });

      if (!targetMember || targetMember.spaceId !== request.params.id) {
        return reply.notFound('Target member not found');
      }

      if (targetMember.userId === request.user.userId) {
        return reply.badRequest('Cannot transfer ownership to yourself');
      }

      // Transaction: demote current owner to MEMBER, promote target to OWNER
      await fastify.prisma.$transaction([
        fastify.prisma.spaceMembership.update({
          where: { id: ownership.id },
          data: { role: 'MEMBER' },
        }),
        fastify.prisma.spaceMembership.update({
          where: { id: targetMember.id },
          data: { role: 'OWNER' },
        }),
      ]);

      return { success: true };
    }
  );

  // Images avatar/cover : OWNER de l'espace ou admin en mode admin. Retourne l'espace (pour
  // supprimer l'ancienne image R2), null si absent, 'forbidden' sinon.
  async function getSpaceForImageEdit(spaceId: string, userId: string, isAdminMode: boolean) {
    if (!(await isSpaceOwnerOrAdmin(fastify.prisma, spaceId, userId, isAdminMode))) return 'forbidden' as const;
    return fastify.prisma.space.findUnique({
      where: { id: spaceId },
      select: { avatarUrl: true, coverUrl: true },
    });
  }

  // Upload space avatar
  fastify.post<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const imageSpace = await getSpaceForImageEdit(request.params.id, request.user.userId, request.isAdminMode);
    if (imageSpace === 'forbidden') return reply.forbidden('Permissions insuffisantes');
    if (!imageSpace) return reply.notFound('Space not found');

    const file = await request.file();
    if (!file) return reply.badRequest('Aucun fichier envoyé');
    const typeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename });
    if (typeError) return reply.badRequest(typeError);

    const buffer = await file.toBuffer();
    const sizeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename, size: buffer.length });
    if (sizeError) return reply.badRequest(sizeError);

    const processed = await processAvatar(buffer);
    let avatarUrl: string;

    if (isR2Configured()) {
      // Delete old avatar from R2 if exists
      if (imageSpace.avatarUrl?.startsWith('http')) {
        await deleteFileFromR2(imageSpace.avatarUrl);
      }
      avatarUrl = await uploadEntityImage(processed, `spaces/${request.params.id}/avatar`);
    } else {
      avatarUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const space = await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return { avatarUrl: space.avatarUrl };
  });

  // Delete space avatar
  fastify.delete<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const imageSpace = await getSpaceForImageEdit(request.params.id, request.user.userId, request.isAdminMode);
    if (imageSpace === 'forbidden') return reply.forbidden('Permissions insuffisantes');
    if (!imageSpace) return reply.notFound('Space not found');

    if (imageSpace.avatarUrl?.startsWith('http')) {
      await deleteFileFromR2(imageSpace.avatarUrl);
    }

    await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { avatarUrl: null },
    });

    return { success: true };
  });

  // Upload space cover
  fastify.post<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const imageSpace = await getSpaceForImageEdit(request.params.id, request.user.userId, request.isAdminMode);
    if (imageSpace === 'forbidden') return reply.forbidden('Permissions insuffisantes');
    if (!imageSpace) return reply.notFound('Space not found');

    const file = await request.file();
    if (!file) return reply.badRequest('Aucun fichier envoyé');
    const typeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename });
    if (typeError) return reply.badRequest(typeError);

    const buffer = await file.toBuffer();
    const sizeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename, size: buffer.length });
    if (sizeError) return reply.badRequest(sizeError);

    const processed = await processCover(buffer);
    let coverUrl: string;

    if (isR2Configured()) {
      if (imageSpace.coverUrl?.startsWith('http')) {
        await deleteFileFromR2(imageSpace.coverUrl);
      }
      coverUrl = await uploadEntityImage(processed, `spaces/${request.params.id}/cover`);
    } else {
      coverUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const space = await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { coverUrl, coverPosition: 50, coverPositionX: 50, coverZoom: 100 },
      select: { coverUrl: true, coverPosition: true, coverPositionX: true, coverZoom: true },
    });

    return { coverUrl: space.coverUrl, coverPosition: space.coverPosition, coverPositionX: space.coverPositionX, coverZoom: space.coverZoom };
  });

  // Delete space cover
  fastify.delete<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const imageSpace = await getSpaceForImageEdit(request.params.id, request.user.userId, request.isAdminMode);
    if (imageSpace === 'forbidden') return reply.forbidden('Permissions insuffisantes');
    if (!imageSpace) return reply.notFound('Space not found');

    if (imageSpace.coverUrl?.startsWith('http')) {
      await deleteFileFromR2(imageSpace.coverUrl);
    }

    await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { coverUrl: null },
    });

    return { success: true };
  });

  // ==================== Send Email to Members ====================

  const sendEmailSchema = z.object({
    subject: z.string().min(1),
    html: z.string().min(1),
    recipientIds: z.array(z.string()).min(1),
  });

  // POST /spaces/:id/send-email — send email to space members
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof sendEmailSchema> }>(
    '/:id/send-email',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!process.env.RESEND_API_KEY) {
        return reply.serviceUnavailable('Email service is not configured');
      }

      if (!(await isSpaceOwnerOrAdmin(fastify.prisma, request.params.id, request.user.userId, request.isAdminMode))) {
        return reply.forbidden('Insufficient permissions');
      }

      const body = sendEmailSchema.parse(request.body);

      // Fetch recipients that are members of this space
      const members = await fastify.prisma.spaceMembership.findMany({
        where: {
          spaceId: request.params.id,
          userId: { in: body.recipientIds },
        },
        include: {
          user: { select: { email: true } },
        },
      });

      const emails = members.map((m) => m.user.email);

      if (emails.length === 0) {
        return reply.badRequest('No valid recipients found among space members');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      let sent = 0;
      let failed = 0;

      for (const email of emails) {
        try {
          await resend.emails.send({
            from: 'SPOK <notifications@spok.space>',
            to: email,
            subject: body.subject,
            html: wrapEmailTemplate(body.html),
          });
          sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed };
    }
  );

  // ─── FAVORITES ──────────────────────────────────────────────────

  // List favorite space IDs for the current user
  fastify.get(
    '/favorites',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const favorites = await fastify.prisma.spaceFavorite.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
        orderBy: { createdAt: 'asc' },
      });
      return favorites.map(f => f.spaceId);
    }
  );

  // Add a space to favorites
  fastify.post<{ Params: { id: string } }>(
    '/:id/favorite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        await fastify.prisma.spaceFavorite.create({
          data: { userId: request.user.userId, spaceId: request.params.id },
        });
      } catch {
        // Already favorited — ignore
      }
      return { success: true };
    }
  );

  // Remove a space from favorites
  fastify.delete<{ Params: { id: string } }>(
    '/:id/favorite',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await fastify.prisma.spaceFavorite.deleteMany({
        where: { userId: request.user.userId, spaceId: request.params.id },
      });
      return { success: true };
    }
  );
};
