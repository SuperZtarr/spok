import { FastifyPluginAsync } from 'fastify';

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ message: 'Non authentifié' });
    }
  });

  // GET /activity — items with unseen changes, grouped by community > space
  app.get('/', async (request) => {
    const userId = request.user.userId;

    // Communities the user is member of and has not muted
    const memberships = await app.prisma.communityMembership.findMany({
      where: { userId, muted: false },
      select: { communityId: true },
    });
    const communityIds = memberships.map((m) => m.communityId);

    if (communityIds.length === 0) return { groups: [], total: 0 };

    // All items in those community spaces, with views and contributions
    const items = await app.prisma.item.findMany({
      where: {
        space: { communityId: { in: communityIds } },
        // Created or last-updated by someone else
        OR: [
          { updatedById: { not: userId } },
          { updatedById: null, createdById: { not: userId } },
        ],
      },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            communityId: true,
            avatarUrl: true,
            coverUrl: true,
            community: { select: { id: true, name: true, avatarUrl: true, coverUrl: true } },
          },
        },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        updatedBy: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
        views: { where: { userId }, select: { viewedAt: true } },
        contributions: {
          where: { authorId: { not: userId } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    // Determine per-item activity_at and whether it's unseen
    const unseenItems = items
      .map((item) => {
        const viewedAt = item.views[0]?.viewedAt ?? null;
        const itemUpdatedAt = item.updatedAt;
        const lastContribAt = item.contributions[0]?.createdAt ?? null;

        // Most recent activity from others
        const activityAt = lastContribAt && lastContribAt > itemUpdatedAt
          ? lastContribAt
          : itemUpdatedAt;

        // Unseen = no view, or activity happened after last view
        const unseen = !viewedAt || activityAt > viewedAt;
        return { ...item, activityAt, unseen };
      })
      .filter((item) => item.unseen)
      .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());

    const total = unseenItems.length;

    // Group by community > space
    const communityMap = new Map<string, {
      community: { id: string; name: string; avatarUrl: string | null; coverUrl: string | null };
      spaces: Map<string, { space: { id: string; name: string; avatarUrl: string | null; coverUrl: string | null }; items: typeof unseenItems }>;
    }>();

    for (const item of unseenItems) {
      const community = item.space.community;
      if (!community) continue;

      if (!communityMap.has(community.id)) {
        communityMap.set(community.id, { community, spaces: new Map() });
      }
      const communityEntry = communityMap.get(community.id)!;

      const spaceId = item.space.id;
      if (!communityEntry.spaces.has(spaceId)) {
        communityEntry.spaces.set(spaceId, {
          space: {
            id: item.space.id,
            name: item.space.name,
            avatarUrl: item.space.avatarUrl ?? null,
            coverUrl: item.space.coverUrl ?? null,
          },
          items: [],
        });
      }
      communityEntry.spaces.get(spaceId)!.items.push(item);
    }

    const groups = [...communityMap.values()].map(({ community, spaces }) => ({
      community,
      spaces: [...spaces.values()].map(({ space, items: spaceItems }) => ({
        space,
        items: spaceItems.map(({ views, contributions, unseen, ...item }) => item),
      })),
    }));

    return { groups, total };
  });

  // POST /activity/items/:id/view — mark item as viewed
  app.post<{ Params: { id: string } }>(
    '/items/:id/view',
    async (request, reply) => {
      const userId = request.user.userId;
      const itemId = request.params.id;

      await app.prisma.itemView.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId },
        update: { viewedAt: new Date() },
      });

      reply.status(204).send();
    }
  );
};
