import { FastifyPluginAsync } from 'fastify';

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get<{
    Querystring: { q?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
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
