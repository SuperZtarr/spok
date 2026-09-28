/*
 * Feed d'activité non lue : contributions/items récents groupés communauté > espace, avec
 * respect des mutes (membership.muted) et du suivi de lecture (ItemView).
 * « Marquer comme non lu » (ItemView.markedUnread, POST /items/:id/unread) : l'item est inclus quels
 * que soient âge / auteur / mute / espace (perso → groupe PERSONAL_GROUP), effacé par POST …/view.
 */
import { FastifyPluginAsync } from 'fastify';

/** Pseudo-communauté regroupant les items d'espaces perso marqués non lus (pas de mute côté UI). */
export const PERSONAL_GROUP_ID = '__personal__';
const PERSONAL_GROUP = { id: PERSONAL_GROUP_ID, name: 'Espaces personnels', avatarUrl: null, coverUrl: null };

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

    // Items explicitement « marqués comme non lus » : inclus quels que soient leur âge, l'auteur de la
    // dernière modif, le mute et l'espace (perso compris) — tant que l'utilisateur y a encore accès.
    const markedViews = await app.prisma.itemView.findMany({
      where: { userId, markedUnread: true },
      select: { itemId: true },
    });
    const markedIds = markedViews.map((v) => v.itemId);

    if (communityIds.length === 0 && markedIds.length === 0) return { groups: [], total: 0 };

    // Only look at items updated in the last 60 days
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Items récents modifiés par d'autres dans les communautés suivies + items marqués non lus
    const items = await app.prisma.item.findMany({
      where: {
        OR: [
          {
            space: { communityId: { in: communityIds } },
            updatedAt: { gte: since },
            // Created or last-updated by someone else
            OR: [
              { updatedById: { not: userId } },
              { updatedById: null, createdById: { not: userId } },
            ],
          },
          {
            id: { in: markedIds },
            space: {
              OR: [
                { community: { memberships: { some: { userId } } } },
                { memberships: { some: { userId } } },
              ],
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        spaceId: true,
        updatedAt: true,
        createdAt: true,
        space: {
          select: {
            id: true,
            name: true,
            parentId: true,
            communityId: true,
            avatarUrl: true,
            coverUrl: true,
            community: { select: { id: true, name: true, avatarUrl: true, coverUrl: true } },
          },
        },
        updatedBy: { select: { id: true, name: true, avatarUrl: true } },
        views: { where: { userId }, select: { viewedAt: true, markedUnread: true } },
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

        // Unseen = marqué non lu, no view, or activity happened after last view
        const unseen = !!item.views[0]?.markedUnread || !viewedAt || activityAt > viewedAt;
        return { ...item, activityAt, unseen };
      })
      .filter((item) => item.unseen)
      .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());

    const total = unseenItems.length;

    // Group by community > space (flat)
    const communityMap = new Map<string, {
      community: { id: string; name: string; avatarUrl: string | null; coverUrl: string | null };
      spaces: Map<string, { space: { id: string; name: string; parentId: string | null; avatarUrl: string | null; coverUrl: string | null }; items: typeof unseenItems }>;
    }>();

    for (const item of unseenItems) {
      // Espace perso (sans communauté) : seul un item marqué non lu peut arriver ici → groupe dédié
      const community = item.space.community ?? PERSONAL_GROUP;

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
            parentId: item.space.parentId ?? null,
            avatarUrl: item.space.avatarUrl ?? null,
            coverUrl: item.space.coverUrl ?? null,
          },
          items: [],
        });
      }
      communityEntry.spaces.get(spaceId)!.items.push(item);
    }

    // Restructure: nest child spaces under their parent (one level)
    const groups = [...communityMap.values()].map(({ community, spaces }) => {
      const spaceEntries = [...spaces.values()];
      const spaceIds = new Set(spaces.keys());

      const rootSpaces = spaceEntries.filter(
        (s) => !s.space.parentId || !spaceIds.has(s.space.parentId),
      );

      return {
        community,
        spaces: rootSpaces.map(({ space, items: spaceItems }) => ({
          space,
          items: spaceItems.map(({ views, contributions, unseen, ...item }) => item),
          children: spaceEntries
            .filter((s) => s.space.parentId === space.id)
            .map(({ space: childSpace, items: childItems }) => ({
              space: childSpace,
              items: childItems.map(({ views, contributions, unseen, ...item }) => item),
            })),
        })),
      };
    });

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
        // Consulter l'item efface la marque « non lu » (comme un mail)
        update: { viewedAt: new Date(), markedUnread: false },
      });

      reply.status(204).send();
    }
  );

  // POST /activity/items/:id/unread — « Marquer comme non lu » (réapparaît dans /activity et clignote
  // dans les vues jusqu'à la prochaine consultation)
  app.post<{ Params: { id: string } }>(
    '/items/:id/unread',
    async (request, reply) => {
      const userId = request.user.userId;
      const itemId = request.params.id;

      const item = await app.prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
      if (!item) return reply.status(404).send({ message: 'Élément introuvable' });

      await app.prisma.itemView.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId, markedUnread: true },
        update: { markedUnread: true },
      });

      return reply.status(204).send();
    }
  );
};
