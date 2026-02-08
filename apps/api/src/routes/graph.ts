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

interface BuildGraphOptions {
  includeSpaceNodes?: boolean;
  /** Map of spaceId -> communityId for grouping spaces under communities */
  spaceCommunityMap?: Map<string, { communityId: string; communityName: string }>;
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
  options: BuildGraphOptions = {},
  maxTagLinks: number = 10
): Promise<GraphResponse> {
  const { includeSpaceNodes = false, spaceCommunityMap } = options;

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

  // Add structural nodes (space + community) for multi-space views
  if (includeSpaceNodes && linkTypes.has('hierarchy')) {
    // Collect unique spaces
    const spaceMap = new Map<string, string>();
    for (const item of items) {
      if (!spaceMap.has(item.spaceId)) {
        spaceMap.set(item.spaceId, item.space.name);
      }
    }

    // Add community nodes if spaceCommunityMap is provided
    const addedCommunities = new Set<string>();
    if (spaceCommunityMap) {
      for (const [, info] of spaceCommunityMap) {
        if (!addedCommunities.has(info.communityId)) {
          addedCommunities.add(info.communityId);
          const communityNodeId = `community-${info.communityId}`;
          nodes.push({
            id: communityNodeId,
            title: info.communityName,
            type: 'COMMUNITY',
            status: null,
            spaceId: '',
            spaceName: '',
            parentId: null,
            tagIds: [],
          });
          nodeIds.add(communityNodeId);
        }
      }
    }

    // Add space nodes and link them to their community (or leave as root)
    for (const [spaceId, spaceName] of spaceMap) {
      const spaceNodeId = `space-${spaceId}`;
      nodes.push({
        id: spaceNodeId,
        title: spaceName,
        type: 'SPACE',
        status: null,
        spaceId,
        spaceName,
        parentId: null,
        tagIds: [],
      });
      nodeIds.add(spaceNodeId);

      // Link space to its community
      const communityInfo = spaceCommunityMap?.get(spaceId);
      if (communityInfo) {
        links.push({
          id: `h-${linkCounter++}`,
          source: `community-${communityInfo.communityId}`,
          target: spaceNodeId,
          linkType: 'hierarchy',
        });
      }
    }

    // Link root items (no parent or parent not in graph) to their space node
    for (const item of items) {
      if (!item.parentId || !nodeIds.has(item.parentId)) {
        links.push({
          id: `h-${linkCounter++}`,
          source: `space-${item.spaceId}`,
          target: item.id,
          linkType: 'hierarchy',
        });
      }
    }
  }

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

      // Get community name for the spaceCommunityMap
      const community = await fastify.prisma.community.findUnique({
        where: { id: communityId },
        select: { name: true },
      });

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
          space: { select: { name: true, communityId: true } },
          tags: { select: { tagId: true } },
        },
      });

      // Build spaceCommunityMap
      const spaceCommunityMap = new Map<string, { communityId: string; communityName: string }>();
      for (const item of items) {
        if (!spaceCommunityMap.has(item.spaceId) && item.space.communityId) {
          spaceCommunityMap.set(item.spaceId, {
            communityId: item.space.communityId,
            communityName: community?.name || '',
          });
        }
      }

      return buildGraph(fastify.prisma, items, linkTypes, {
        includeSpaceNodes: true,
        spaceCommunityMap,
      });
    }
  );

  // Global graph (all spaces the user can access: direct memberships + community spaces)
  fastify.get<{ Querystring: { linkTypes?: string; communityIds?: string } }>(
    '/graph/global',
    async (request) => {
      const linkTypes = parseLinkTypes(request.query.linkTypes);
      const filterCommunityIds = request.query.communityIds
        ? request.query.communityIds.split(',').map(id => id.trim()).filter(Boolean)
        : null; // null = no filter (show all)

      // 1. Spaces where user is a direct member
      const directMemberships = await fastify.prisma.spaceMembership.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
      });
      const directSpaceIds = directMemberships.map(m => m.spaceId);

      // 2. Community memberships → all GROUP spaces of those communities
      const communityMemberships = await fastify.prisma.communityMembership.findMany({
        where: { userId: request.user.userId },
        select: { communityId: true },
      });
      const allUserCommunityIds = communityMemberships.map(m => m.communityId);

      // Apply community filter if provided
      const activeCommunityIds = filterCommunityIds
        ? allUserCommunityIds.filter(id => filterCommunityIds.includes(id))
        : allUserCommunityIds;

      const communitySpaces = activeCommunityIds.length > 0
        ? await fastify.prisma.space.findMany({
            where: {
              communityId: { in: activeCommunityIds },
              type: 'GROUP',
            },
            select: { id: true },
          })
        : [];
      const communitySpaceIds = communitySpaces.map(s => s.id);

      // When filtering by communities, only include direct spaces that belong to a selected community
      let filteredDirectSpaceIds = directSpaceIds;
      if (filterCommunityIds) {
        const directSpacesWithCommunity = directSpaceIds.length > 0
          ? await fastify.prisma.space.findMany({
              where: { id: { in: directSpaceIds } },
              select: { id: true, communityId: true },
            })
          : [];
        filteredDirectSpaceIds = directSpacesWithCommunity
          .filter(s => !s.communityId || filterCommunityIds.includes(s.communityId))
          .map(s => s.id);
      }

      // Merge all unique space IDs
      const allSpaceIds = [...new Set([...filteredDirectSpaceIds, ...communitySpaceIds])];

      // Get community names for spaceCommunityMap
      const communities = activeCommunityIds.length > 0
        ? await fastify.prisma.community.findMany({
            where: { id: { in: activeCommunityIds } },
            select: { id: true, name: true },
          })
        : [];
      const communityNameMap = new Map(communities.map(c => [c.id, c.name]));

      const items = await fastify.prisma.item.findMany({
        where: {
          spaceId: { in: allSpaceIds },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          parentId: true,
          space: { select: { name: true, communityId: true } },
          tags: { select: { tagId: true } },
        },
      });

      // Build spaceCommunityMap
      const spaceCommunityMap = new Map<string, { communityId: string; communityName: string }>();
      for (const item of items) {
        if (!spaceCommunityMap.has(item.spaceId) && item.space.communityId) {
          spaceCommunityMap.set(item.spaceId, {
            communityId: item.space.communityId,
            communityName: communityNameMap.get(item.space.communityId) || '',
          });
        }
      }

      return buildGraph(fastify.prisma, items, linkTypes, {
        includeSpaceNodes: true,
        spaceCommunityMap,
      });
    }
  );
};
