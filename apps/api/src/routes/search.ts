/*
 * Recherche globale (/search et /search/advanced) sur items et contributions.
 * optionalAuthenticate : un anonyme reçoit des résultats vides (pas d'espaces accessibles).
 * Le périmètre est borné aux espaces des memberships (pas de bypass admin).
 */
import { FastifyPluginAsync } from 'fastify';

interface AdvancedSearchQuery {
  q?: string;
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
    const { q, types: typesParam, communityId, spaceId, itemType, itemStatus, itemPriority, tagIds: tagIdsParam } = request.query;

    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ statusCode: 400, message: 'Le terme de recherche doit contenir au moins 2 caracteres' });
    }

    const query = q.trim();
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(request.query.pageSize || '20', 10)));
    const skip = (page - 1) * pageSize;

    const enabledTypes = new Set((typesParam || 'communities,spaces,items,users,contributions').split(','));

    const userId = request.user?.userId;
    const isAdmin = userId ? (await fastify.prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } }))?.globalRole === 'ADMIN' : false;

    // Build accessible space IDs for items/contributions
    let accessibleSpaceIds: string[] | null = null; // null = all (admin)
    if (userId && !isAdmin) {
      const memberships = await fastify.prisma.spaceMembership.findMany({
        where: { userId },
        select: { spaceId: true },
      });
      accessibleSpaceIds = memberships.map(m => m.spaceId);
    } else if (!userId) {
      // Anonymous: only spaces from public communities with open visibility
      const publicSpaces = await fastify.prisma.space.findMany({
        where: {
          type: 'GROUP',
          community: { isPublic: true, visibility: { not: 'PRIVATE' } },
          OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }],
        },
        select: { id: true },
      });
      accessibleSpaceIds = publicSpaces.map(s => s.id);
    }

    const spaceFilter = accessibleSpaceIds ? { in: accessibleSpaceIds } : undefined;
    // If spaceId is specified, intersect with accessible spaces
    const effectiveSpaceIds = spaceId
      ? (accessibleSpaceIds ? (accessibleSpaceIds.includes(spaceId) ? [spaceId] : []) : [spaceId])
      : null;
    const effectiveSpaceFilter = effectiveSpaceIds ? { in: effectiveSpaceIds } : spaceFilter ? { in: spaceFilter.in } : undefined;

    const truncate = (text: string | null, maxLen = 200) => {
      if (!text) return null;
      const plain = text.replace(/<[^>]*>/g, '');
      return plain.length <= maxLen ? plain : plain.substring(0, maxLen) + '...';
    };

    // ── Communities ──
    let communities: any[] = [];
    let totalCommunities = 0;
    if (enabledTypes.has('communities') && !spaceId) {
      const communityWhere: Record<string, unknown> = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      };
      if (communityId) {
        communityWhere.id = communityId;
      }
      // Access: user sees their communities + public ones; anonymous sees public only
      if (!userId) {
        communityWhere.isPublic = true;
        communityWhere.visibility = { not: 'PRIVATE' };
      } else if (!isAdmin) {
        const myCommunityIds = (await fastify.prisma.communityMembership.findMany({
          where: { userId },
          select: { communityId: true },
        })).map(m => m.communityId);
        communityWhere.OR = [
          { id: { in: myCommunityIds }, OR: (communityWhere as any).OR },
          { isPublic: true, visibility: { not: 'PRIVATE' }, OR: (communityWhere as any).OR },
        ];
        delete (communityWhere as any).OR; // moved into nested OR
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
        avatarUrl: c.avatarUrl, isPublic: c.isPublic,
        memberCount: c._count.memberships, spaceCount: c._count.spaces,
      }));
      totalCommunities = count;
    }

    // ── Spaces ──
    let spaces: any[] = [];
    let totalSpaces = 0;
    if (enabledTypes.has('spaces')) {
      const spaceWhere: Record<string, unknown> = {
        name: { contains: query, mode: 'insensitive' },
      };
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
      const itemWhere: Record<string, unknown> = {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { url: { contains: query, mode: 'insensitive' } },
        ],
      };
      if (effectiveSpaceFilter) itemWhere.spaceId = effectiveSpaceFilter;
      else if (spaceFilter) itemWhere.spaceId = spaceFilter;
      if (communityId && !spaceId) itemWhere.space = { communityId };
      if (itemType) itemWhere.type = itemType;
      if (itemStatus) itemWhere.status = itemStatus;
      if (itemPriority) itemWhere.priority = parseInt(itemPriority, 10);
      if (tagIdsParam) {
        const tagValues = tagIdsParam.split(',').filter(Boolean);
        if (tagValues.length > 0) {
          // Support both IDs and names
          itemWhere.tags = { some: { tag: { OR: [{ id: { in: tagValues } }, { name: { in: tagValues } }] } } };
        }
      }

      const [rows, count] = await Promise.all([
        fastify.prisma.item.findMany({
          where: itemWhere as any,
          select: {
            id: true, title: true, type: true, status: true, priority: true,
            description: true, spaceId: true, createdAt: true,
            space: { select: { name: true, community: { select: { name: true } } } },
            tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
          },
          orderBy: { updatedAt: 'desc' },
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
    if (enabledTypes.has('users') && !spaceId) {
      const userWhere = {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      };

      const [rows, count] = await Promise.all([
        fastify.prisma.user.findMany({
          where: userWhere,
          select: {
            id: true, name: true, email: true, avatarUrl: true, globalRole: true, createdAt: true,
            _count: { select: { communityMemberships: true, memberships: true } },
          },
          orderBy: { name: 'asc' },
          skip, take: pageSize,
        }),
        fastify.prisma.user.count({ where: userWhere }),
      ]);
      users = rows.map(u => ({
        id: u.id, name: u.name, email: userId ? u.email : null, // hide email for anonymous
        avatarUrl: u.avatarUrl, globalRole: u.globalRole,
        communityCount: u._count.communityMemberships, spaceCount: u._count.memberships,
      }));
      totalUsers = count;
    }

    // ── Contributions ──
    let contributions: any[] = [];
    let totalContributions = 0;
    if (enabledTypes.has('contributions')) {
      const contribWhere: Record<string, unknown> = {
        content: { contains: query, mode: 'insensitive' },
      };
      if (effectiveSpaceFilter) contribWhere.item = { spaceId: effectiveSpaceFilter };
      else if (spaceFilter) contribWhere.item = { spaceId: spaceFilter };
      if (communityId && !spaceId) {
        contribWhere.item = { ...(contribWhere.item as any || {}), space: { communityId } };
      }

      const [rows, count] = await Promise.all([
        fastify.prisma.contribution.findMany({
          where: contribWhere as any,
          select: {
            id: true, content: true, createdAt: true,
            author: { select: { name: true } },
            item: { select: { id: true, title: true, spaceId: true, space: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip, take: pageSize,
        }),
        fastify.prisma.contribution.count({ where: contribWhere as any }),
      ]);
      contributions = rows.map(c => ({
        id: c.id, content: truncate(c.content), authorName: c.author.name,
        itemId: c.item.id, itemTitle: c.item.title,
        spaceId: c.item.spaceId, spaceName: c.item.space.name, createdAt: c.createdAt,
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

    const isAdmin = user?.globalRole === 'ADMIN';

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
