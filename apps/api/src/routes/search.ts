/*
 * Recherche globale (/search et /search/advanced) sur items et contributions.
 * /search (recherche rapide) : anonyme = résultats vides ; utilisateur = ses espaces directs.
 * /advanced (page Recherche, spec SPOK « Recherche [SearchPage] ») :
 * - périmètre = espaces LISIBLES : directs + communautés de l'utilisateur + communautés non privées,
 *   filtrés par la visibilité effective (allReadableSpaceIds, items.ts), anonyme compris ; admin en mode admin = tout ;
 * - dès 1 caractère, 10 résultats par page (pagination par section : page s'applique à chaque section) ;
 * - plusieurs mots : chacun obligatoire par défaut, dans n'importe quel ordre ; any (répétable) = au moins un de ces mots,
 *   not (répétable) = mot exclu ; "guillemets" = expression exacte (searchWords, @spok/shared ; searchWhere, utils) ;
 * - items et contributions triés communauté › espace › récence (regroupés à l'affichage, groupes contigus) ;
 * - filtres d'items (type, statut, priorité, tags) : appliqués aux items ET aux contributions (via leur item) ;
 *   les sections communautés, espaces et utilisateurs sont alors omises (itemFiltersActive dans la réponse) ;
 * - spaceId = l'espace + ses sous-espaces ; spaceId/communityId restreignent aussi la section
 *   utilisateurs aux membres (portée par défaut posée par la page Recherche) ;
 * - section utilisateurs (décision Thomas 2026-11-06, businessRules search-users-scope) : anonyme = aucun résultat ;
 *   connecté = nom seul, comptes actifs, membres de la portée lisible ou, sans portée, soi-même et ceux avec qui il
 *   partage un espace ou une communauté, réponse limitée à id, nom, avatar ; admin en mode admin = tous, nom et e-mail,
 *   réponse complète. Ne pas élargir sans décision : la colonne email ne se cherche jamais hors mode admin.
 * Communauté publique = visibility !== 'PRIVATE' uniquement (colonne isPublic supprimée le 2026-10-16).
 */
import { FastifyPluginAsync } from 'fastify';
import { resolveSearchWords } from '@spok/shared';
import { allReadableSpaceIds } from './items.js';
import { buildWordsWhere } from '../utils/searchWhere.js';

interface AdvancedSearchQuery {
  q?: string;
  any?: string | string[]; // répétable : mots dont au moins un doit être présent
  not?: string | string[]; // répétable : mots exclus
  types?: string; // comma-separated: communities,spaces,items,users,contributions
  communityId?: string;
  spaceId?: string;
  itemType?: string;
  itemStatus?: string;
  itemPriority?: string;
  tagIds?: string;
  page?: string;
  pageSize?: string;
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Advanced search (multiple entity types) ──
  fastify.get<{ Querystring: AdvancedSearchQuery }>('/advanced', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const { q, any: anyWords, not: notWords, types: typesParam, communityId, spaceId, itemType, itemStatus, itemPriority, tagIds: tagIdsParam } = request.query;

    // Dès 1 caractère (spec SearchPage)
    if (!q || q.trim().length < 1) {
      return reply.status(400).send({ statusCode: 400, message: 'Le terme de recherche est requis' });
    }

    const words = resolveSearchWords(q, ([] as string[]).concat(anyWords ?? []), ([] as string[]).concat(notWords ?? []));
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(request.query.pageSize || '10', 10)));
    const skip = (page - 1) * pageSize;

    // Filtres d'items actifs : seules les sections items et contributions (filtrées via leur item) ont un sens
    const itemFiltersActive = !!(itemType || itemStatus || itemPriority || tagIdsParam);
    const enabledTypes = new Set((typesParam || 'communities,spaces,items,users,contributions').split(','));
    if (itemFiltersActive) ['communities', 'spaces', 'users'].forEach((t) => enabledTypes.delete(t));

    const userId = request.user?.userId;
    // Admin global : tout EN MODE ADMIN seulement (hors mode admin = utilisateur normal)
    const isAdmin = userId && request.isAdminMode
      ? (await fastify.prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }))?.globalRole === 'ADMIN'
      : false;

    // Espaces lisibles (null = tout, admin en mode admin) : espaces directs + ceux des communautés de
    // l'utilisateur + ceux des communautés non privées, filtrés par la visibilité EFFECTIVE
    // (filterReadableSpaceIds) — anonyme compris : un sous-espace héritant d'un parent privé est exclu.
    let accessibleSpaceIds: string[] | null = null;
    if (!isAdmin) {
      accessibleSpaceIds = await allReadableSpaceIds(fastify.prisma, userId);
    }

    const spaceFilter = accessibleSpaceIds ? { in: accessibleSpaceIds } : undefined;
    // Portée espace : l'espace ET ses sous-espaces (parcours en largeur sur parentId),
    // intersectés avec les espaces accessibles
    let effectiveSpaceIds: string[] | null = null;
    if (spaceId) {
      const subtree = [spaceId];
      let frontier = [spaceId];
      while (frontier.length > 0) {
        const children = await fastify.prisma.space.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        frontier = children.map(c => c.id).filter(id => !subtree.includes(id));
        subtree.push(...frontier);
      }
      effectiveSpaceIds = accessibleSpaceIds ? subtree.filter(id => accessibleSpaceIds!.includes(id)) : subtree;
    }
    const effectiveSpaceFilter = effectiveSpaceIds ? { in: effectiveSpaceIds } : spaceFilter ? { in: spaceFilter.in } : undefined;

    // Filtres d'items (type, statut, priorité, tags) — partagés par les sections Items et Contributions
    const itemFilterWhere: Record<string, unknown> = {};
    if (itemType) itemFilterWhere.type = itemType;
    if (itemStatus) itemFilterWhere.status = itemStatus;
    if (itemPriority) itemFilterWhere.priority = parseInt(itemPriority, 10);
    if (tagIdsParam) {
      const tagValues = tagIdsParam.split(',').filter(Boolean);
      if (tagValues.length > 0) {
        // Support both IDs and names
        itemFilterWhere.tags = { some: { tag: { OR: [{ id: { in: tagValues } }, { name: { in: tagValues } }] } } };
      }
    }

    const truncate = (text: string | null, maxLen = 200) => {
      if (!text) return null;
      const plain = text.replace(/<[^>]*>/g, '');
      return plain.length <= maxLen ? plain : plain.substring(0, maxLen) + '...';
    };

    // ── Communities ──
    let communities: any[] = [];
    let totalCommunities = 0;
    if (enabledTypes.has('communities') && !spaceId) {
      const communityWhere: Record<string, unknown> = buildWordsWhere(words, [{ name: 'name' }, { name: 'description', nullable: true }]);
      if (communityId) {
        communityWhere.id = communityId;
      }
      // Access: user sees their communities + public ones; anonymous sees public only
      if (!userId) {
        communityWhere.visibility = { not: 'PRIVATE' };
      } else if (!isAdmin) {
        const myCommunityIds = (await fastify.prisma.communityMembership.findMany({
          where: { userId },
          select: { communityId: true },
        })).map(m => m.communityId);
        communityWhere.OR = [{ id: { in: myCommunityIds } }, { visibility: { not: 'PRIVATE' } }];
      }

      const [rows, count] = await Promise.all([
        fastify.prisma.community.findMany({
          where: communityWhere as any,
          include: { _count: { select: { memberships: true, spaces: true } } },
          orderBy: { name: 'asc' },
          skip, take: pageSize,
        }),
        fastify.prisma.community.count({ where: communityWhere as any }),
      ]);
      communities = rows.map(c => ({
        id: c.id, name: c.name, description: truncate(c.description),
        avatarUrl: c.avatarUrl, visibility: c.visibility,
        memberCount: c._count.memberships, spaceCount: c._count.spaces,
      }));
      totalCommunities = count;
    }

    // ── Spaces ──
    let spaces: any[] = [];
    let totalSpaces = 0;
    if (enabledTypes.has('spaces')) {
      const spaceWhere: Record<string, unknown> = buildWordsWhere(words, [{ name: 'name' }]);
      if (communityId) spaceWhere.communityId = communityId;
      if (effectiveSpaceFilter) spaceWhere.id = effectiveSpaceFilter;
      else if (!isAdmin) {
        // Non-admin: accessible spaces
        if (accessibleSpaceIds) spaceWhere.id = { in: accessibleSpaceIds };
      }

      const [rows, count] = await Promise.all([
        fastify.prisma.space.findMany({
          where: spaceWhere as any,
          include: {
            _count: { select: { memberships: true, items: true } },
            community: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
          skip, take: pageSize,
        }),
        fastify.prisma.space.count({ where: spaceWhere as any }),
      ]);
      spaces = rows.map(s => ({
        id: s.id, name: s.name, type: s.type,
        communityId: s.communityId, communityName: s.community?.name || null,
        memberCount: s._count.memberships, itemCount: s._count.items,
      }));
      totalSpaces = count;
    }

    // ── Items ──
    let items: any[] = [];
    let totalItems = 0;
    if (enabledTypes.has('items')) {
      const itemWhere: Record<string, unknown> = buildWordsWhere(words, [
        { name: 'title' }, { name: 'description', nullable: true }, { name: 'url', nullable: true },
      ]);
      if (effectiveSpaceFilter) itemWhere.spaceId = effectiveSpaceFilter;
      else if (spaceFilter) itemWhere.spaceId = spaceFilter;
      if (communityId && !spaceId) itemWhere.space = { communityId };
      Object.assign(itemWhere, itemFilterWhere);

      const [rows, count] = await Promise.all([
        fastify.prisma.item.findMany({
          where: itemWhere as any,
          select: {
            id: true, title: true, type: true, status: true, priority: true,
            description: true, spaceId: true, createdAt: true,
            space: { select: { name: true, community: { select: { name: true } } } },
            tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
          },
          // Tri communauté › espace › récence : un groupe reste d'un seul tenant d'une page à l'autre
          orderBy: [{ space: { community: { name: 'asc' } } }, { space: { name: 'asc' } }, { spaceId: 'asc' }, { updatedAt: 'desc' }],
          skip, take: pageSize,
        }),
        fastify.prisma.item.count({ where: itemWhere as any }),
      ]);
      items = rows.map(i => ({
        id: i.id, title: i.title, type: i.type, status: i.status, priority: i.priority,
        description: truncate(i.description), spaceId: i.spaceId, spaceName: i.space.name,
        communityName: i.space.community?.name || null, createdAt: i.createdAt,
        tags: i.tags.map((t: any) => t.tag),
      }));
      totalItems = count;
    }

    // ── Users ──
    let users: any[] = [];
    let totalUsers = 0;
    // Règle complète en tête de fichier. Anonyme : aucune requête, rien à deviner (businessRules search-users-scope).
    if (enabledTypes.has('users') && userId) {
      // E-mail cherché en mode admin seulement : le chercher ailleurs permettrait d'en deviner le contenu, mots exclus compris
      const userWhere: Record<string, unknown> = buildWordsWhere(words, isAdmin ? [{ name: 'name' }, { name: 'email' }] : [{ name: 'name' }]);
      // Portée : membres de l'espace (sous-espaces inclus, déjà bornés aux espaces accessibles)
      // ou de la communauté — seulement si le demandeur peut la voir (admin, membre, ou publique
      // non privée), sinon on ne révèle pas ses membres
      let canListMembers = true;
      if (!effectiveSpaceIds && communityId && !isAdmin) {
        const [membership, publicCommunity] = await Promise.all([
          fastify.prisma.communityMembership.findFirst({ where: { communityId, userId }, select: { id: true } }),
          fastify.prisma.community.findFirst({ where: { id: communityId, visibility: { not: 'PRIVATE' } }, select: { id: true } }),
        ]);
        canListMembers = !!(membership || publicCommunity);
      }
      if (effectiveSpaceIds) userWhere.memberships = { some: { spaceId: { in: effectiveSpaceIds } } };
      else if (communityId) userWhere.communityMemberships = { some: { communityId } };
      else if (!isAdmin) {
        // Sans portée : soi-même et les personnes avec qui on partage un espace ou une communauté
        const [mySpaces, myCommunities] = await Promise.all([
          fastify.prisma.spaceMembership.findMany({ where: { userId }, select: { spaceId: true } }),
          fastify.prisma.communityMembership.findMany({ where: { userId }, select: { communityId: true } }),
        ]);
        userWhere.OR = [
          { id: userId },
          { memberships: { some: { spaceId: { in: mySpaces.map(m => m.spaceId) } } } },
          { communityMemberships: { some: { communityId: { in: myCommunities.map(m => m.communityId) } } } },
        ];
      }
      if (!isAdmin) userWhere.disabledAt = null;

      const [rows, count] = canListMembers ? await Promise.all([
        fastify.prisma.user.findMany({
          where: userWhere as any,
          select: {
            id: true, name: true, avatarUrl: true,
            // Rôle et compteurs (espaces privés compris) : mode admin seulement
            ...(isAdmin ? {
              email: true, globalRole: true,
              _count: { select: { communityMemberships: true, memberships: true } },
            } : {}),
          } as any,
          orderBy: { name: 'asc' },
          skip, take: pageSize,
        }),
        fastify.prisma.user.count({ where: userWhere as any }),
      ]) : [[], 0] as const;
      users = (rows as any[]).map(u => isAdmin ? {
        id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, globalRole: u.globalRole,
        communityCount: u._count.communityMemberships, spaceCount: u._count.memberships,
      } : { id: u.id, name: u.name, avatarUrl: u.avatarUrl });
      totalUsers = count;
    }

    // ── Contributions ──
    let contributions: any[] = [];
    let totalContributions = 0;
    if (enabledTypes.has('contributions')) {
      const contribWhere: Record<string, unknown> = buildWordsWhere(words, [{ name: 'content' }]);
      // Contraintes sur l'item de la contribution : périmètre + mêmes filtres d'items que la section Items
      const contribItem: Record<string, unknown> = {};
      if (effectiveSpaceFilter) contribItem.spaceId = effectiveSpaceFilter;
      else if (spaceFilter) contribItem.spaceId = spaceFilter;
      if (communityId && !spaceId) contribItem.space = { communityId };
      Object.assign(contribItem, itemFilterWhere);
      if (Object.keys(contribItem).length > 0) contribWhere.item = contribItem;

      const [rows, count] = await Promise.all([
        fastify.prisma.contribution.findMany({
          where: contribWhere as any,
          select: {
            id: true, content: true, createdAt: true,
            author: { select: { name: true } },
            item: { select: { id: true, title: true, spaceId: true, space: { select: { name: true, community: { select: { name: true } } } } } },
          },
          // Même regroupement que les items : communauté › espace › récence
          orderBy: [
            { item: { space: { community: { name: 'asc' } } } }, { item: { space: { name: 'asc' } } },
            { item: { spaceId: 'asc' } }, { createdAt: 'desc' },
          ],
          skip, take: pageSize,
        }),
        fastify.prisma.contribution.count({ where: contribWhere as any }),
      ]);
      contributions = rows.map(c => ({
        id: c.id, content: truncate(c.content), authorName: c.author.name,
        itemId: c.item.id, itemTitle: c.item.title,
        spaceId: c.item.spaceId, spaceName: c.item.space.name,
        communityName: c.item.space.community?.name || null, createdAt: c.createdAt,
      }));
      totalContributions = count;
    }

    return {
      communities, spaces, items, users, contributions,
      totals: {
        communities: totalCommunities, spaces: totalSpaces,
        items: totalItems, users: totalUsers, contributions: totalContributions,
      },
      pagination: { page, pageSize },
      itemFiltersActive,
    };
  });

  // ── Basic search (existing) ──
  fastify.get<{
    Querystring: { q?: string; page?: string; pageSize?: string };
  }>('/', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const { q, page: pageStr, pageSize: pageSizeStr } = request.query;

    if (!q || q.trim().length < 2) {
      return reply.status(400).send({
        statusCode: 400,
        message: 'Le terme de recherche doit contenir au moins 2 caractères',
      });
    }

    const query = q.trim();
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeStr || '20', 10)));
    const skip = (page - 1) * pageSize;

    // optionalAuthenticate : un anonyme n'a accès à aucun espace → résultats vides (évite un crash sur request.user)
    if (!request.user?.userId) {
      return { items: [], contributions: [], totalItems: 0, totalContributions: 0 };
    }

    // Determine accessible space IDs based on user role
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { globalRole: true },
    });

    // Admin global : recherche sur tout EN MODE ADMIN seulement (hors mode admin = utilisateur normal)
    const isAdmin = user?.globalRole === 'ADMIN' && request.isAdminMode;

    let spaceFilter: { spaceId?: { in: string[] } } = {};

    if (!isAdmin) {
      const memberships = await fastify.prisma.spaceMembership.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
      });
      const spaceIds = memberships.map((m) => m.spaceId);
      if (spaceIds.length === 0) {
        return {
          items: [],
          contributions: [],
          totalItems: 0,
          totalContributions: 0,
        };
      }
      spaceFilter = { spaceId: { in: spaceIds } };
    }

    // Search items (title + description)
    const itemWhere = {
      ...spaceFilter,
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [items, totalItems] = await Promise.all([
      fastify.prisma.item.findMany({
        where: itemWhere,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          createdAt: true,
          description: true,
          space: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      fastify.prisma.item.count({ where: itemWhere }),
    ]);

    // Search contributions (content)
    const contributionWhere = {
      content: { contains: query, mode: 'insensitive' as const },
      item: spaceFilter.spaceId ? { spaceId: spaceFilter.spaceId } : undefined,
    };

    const [contributions, totalContributions] = await Promise.all([
      fastify.prisma.contribution.findMany({
        where: contributionWhere,
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { name: true } },
          item: {
            select: {
              id: true,
              title: true,
              spaceId: true,
              space: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      fastify.prisma.contribution.count({ where: contributionWhere }),
    ]);

    // Truncate long content for response
    const truncate = (text: string | null, maxLen = 150) => {
      if (!text) return null;
      // Strip HTML tags for display
      const plain = text.replace(/<[^>]*>/g, '');
      if (plain.length <= maxLen) return plain;
      return plain.substring(0, maxLen) + '…';
    };

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        spaceId: item.spaceId,
        spaceName: item.space.name,
        createdAt: item.createdAt,
        description: truncate(item.description),
      })),
      contributions: contributions.map((c) => ({
        id: c.id,
        content: truncate(c.content),
        itemId: c.item.id,
        itemTitle: c.item.title,
        spaceId: c.item.spaceId,
        spaceName: c.item.space.name,
        authorName: c.author.name,
        createdAt: c.createdAt,
      })),
      totalItems,
      totalContributions,
    };
  });
};
