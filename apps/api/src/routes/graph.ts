import { FastifyPluginAsync } from 'fastify';

interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string | null;
  spaceId: string;
  spaceName: string;
  parentId: string | null;
  tagIds: string[];
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  linkType: 'hierarchy' | 'relation' | 'tag';
  relationLabel?: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

function parseLinkTypes(linkTypesParam?: string): Set<string> {
  if (!linkTypesParam) return new Set(['hierarchy', 'relation', 'tag']);
  return new Set(linkTypesParam.split(',').map(t => t.trim()));
}

async function buildGraph(
  prisma: any,
  items: Array<{
    id: string;
    title: string;
    type: string;
    status: string | null;
    spaceId: string;
    parentId: string | null;
    space: { name: string };
    tags: Array<{ tagId: string }>;
  }>,
  linkTypes: Set<string>,
  maxTagLinks: number = 10
): Promise<GraphResponse> {
  const nodes: GraphNode[] = items.map(item => ({
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    spaceId: item.spaceId,
    spaceName: item.space.name,
    parentId: item.parentId,
    tagIds: item.tags.map(t => t.tagId),
  }));

  const nodeIds = new Set(items.map(i => i.id));
  const links: GraphLink[] = [];
  let linkCounter = 0;

  // Hierarchy links
  if (linkTypes.has('hierarchy')) {
    for (const item of items) {
      if (item.parentId && nodeIds.has(item.parentId)) {
        links.push({
          id: `h-${linkCounter++}`,
          source: item.parentId,
          target: item.id,
          linkType: 'hierarchy',
        });
      }
    }
  }

  // Relation links
  if (linkTypes.has('relation')) {
    const itemIds = items.map(i => i.id);
    const relations = await prisma.itemRelation.findMany({
      where: {
        fromItemId: { in: itemIds },
        toItemId: { in: itemIds },
      },
    });

    for (const rel of relations) {
      links.push({
        id: `r-${linkCounter++}`,
        source: rel.fromItemId,
        target: rel.toItemId,
        linkType: 'relation',
        relationLabel: rel.type,
      });
    }
  }

  // Tag links (items sharing at least one tag)
  if (linkTypes.has('tag')) {
    // Build tag -> itemIds map
    const tagToItems = new Map<string, string[]>();
    for (const item of items) {
      for (const t of item.tags) {
        const list = tagToItems.get(t.tagId) || [];
        list.push(item.id);
        tagToItems.set(t.tagId, list);
      }
    }

    // Keep only the N most frequent tags (those with most items)
    const sortedTags = [...tagToItems.entries()]
      .filter(([, itemIds]) => itemIds.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, maxTagLinks);

    const addedPairs = new Set<string>();
    for (const [, itemIds] of sortedTags) {
      for (let i = 0; i < itemIds.length; i++) {
        for (let j = i + 1; j < itemIds.length; j++) {
          const pairKey = itemIds[i] < itemIds[j]
            ? `${itemIds[i]}-${itemIds[j]}`
            : `${itemIds[j]}-${itemIds[i]}`;
          if (!addedPairs.has(pairKey)) {
            addedPairs.add(pairKey);
            links.push({
              id: `t-${linkCounter++}`,
              source: itemIds[i],
              target: itemIds[j],
              linkType: 'tag',
            });
          }
        }
      }
    }
  }

  return { nodes, links };
}

export const graphRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Space-level graph
  fastify.get<{ Params: { spaceId: string }; Querystring: { linkTypes?: string } }>(
    '/spaces/:spaceId/graph',
    async (request, reply) => {
      const { spaceId } = request.params;
      const linkTypes = parseLinkTypes(request.query.linkTypes);

      // Check membership
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId,
          },
        },
      });

      if (!membership) {
        // Check community-based access
        const space = await fastify.prisma.space.findUnique({
          where: { id: spaceId },
          select: { communityId: true },
        });

        if (space?.communityId) {
          const communityMembership = await fastify.prisma.communityMembership.findUnique({
            where: {
              userId_communityId: {
                userId: request.user.userId,
                communityId: space.communityId,
              },
            },
          });
          if (!communityMembership) {
            return reply.forbidden('Access denied');
          }
        } else {
          return reply.forbidden('Access denied');
        }
      }

      const items = await fastify.prisma.item.findMany({
        where: { spaceId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          parentId: true,
          space: { select: { name: true } },
          tags: { select: { tagId: true } },
        },
      });

      return buildGraph(fastify.prisma, items, linkTypes);
    }
  );

  // Community-level graph
  fastify.get<{ Params: { communityId: string }; Querystring: { linkTypes?: string } }>(
    '/communities/:communityId/graph',
    async (request, reply) => {
      const { communityId } = request.params;
      const linkTypes = parseLinkTypes(request.query.linkTypes);

      // Check community membership
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId,
          },
        },
      });

      if (!membership) {
        return reply.forbidden('Access denied');
      }

      const items = await fastify.prisma.item.findMany({
        where: {
          space: {
            communityId,
            type: 'GROUP',
          },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          parentId: true,
          space: { select: { name: true } },
          tags: { select: { tagId: true } },
        },
      });

      return buildGraph(fastify.prisma, items, linkTypes);
    }
  );

  // Global graph (all communities the user belongs to, excluding PERSONAL)
  fastify.get<{ Querystring: { linkTypes?: string } }>(
    '/graph/global',
    async (request) => {
      const linkTypes = parseLinkTypes(request.query.linkTypes);

      // Get all communities the user belongs to
      const communityMemberships = await fastify.prisma.communityMembership.findMany({
        where: { userId: request.user.userId },
        select: { communityId: true },
      });

      const communityIds = communityMemberships.map(m => m.communityId);

      const items = await fastify.prisma.item.findMany({
        where: {
          space: {
            communityId: { in: communityIds },
            type: 'GROUP',
          },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          parentId: true,
          space: { select: { name: true } },
          tags: { select: { tagId: true } },
        },
      });

      return buildGraph(fastify.prisma, items, linkTypes);
    }
  );
};
