import { FastifyPluginAsync } from 'fastify';
import type { SunburstNode } from '@spok/shared';

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

      const spaceInfo = await fastify.prisma.space.findUnique({
        where: { id: spaceId },
        select: { name: true },
      });

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

      const graph = await buildGraph(fastify.prisma, items, linkTypes);

      // Add a central space node and link root items to it
      const spaceNodeId = `space-${spaceId}`;
      graph.nodes.unshift({
        id: spaceNodeId,
        title: spaceInfo?.name || 'Espace',
        type: 'SPACE',
        status: null,
        spaceId,
        spaceName: spaceInfo?.name || '',
        parentId: null,
        tagIds: [],
      });

      if (linkTypes.has('hierarchy')) {
        const nodeIds = new Set(items.map(i => i.id));
        let linkCounter = graph.links.length;
        for (const item of items) {
          if (!item.parentId || !nodeIds.has(item.parentId)) {
            graph.links.push({
              id: `h-${linkCounter++}`,
              source: spaceNodeId,
              target: item.id,
              linkType: 'hierarchy',
            });
          }
        }
      }

      return graph;
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

  // Sunburst hierarchy: Global → Communities → Spaces → Items → Children
  fastify.get<{ Querystring: { communityIds?: string; spaceId?: string } }>(
    '/graph/sunburst',
    async (request, reply) => {
      const filterSpaceId = request.query.spaceId || null;
      const filterCommunityIds = request.query.communityIds
        ? request.query.communityIds.split(',').map(id => id.trim()).filter(Boolean)
        : null;

      // Space-scoped mode: return item hierarchy for a single space
      if (filterSpaceId) {
        // Verify access
        const membership = await fastify.prisma.spaceMembership.findUnique({
          where: { userId_spaceId: { userId: request.user.userId, spaceId: filterSpaceId } },
        });
        if (!membership) {
          const spaceCheck = await fastify.prisma.space.findUnique({
            where: { id: filterSpaceId },
            select: { communityId: true },
          });
          if (spaceCheck?.communityId) {
            const communityMembership = await fastify.prisma.communityMembership.findUnique({
              where: { userId_communityId: { userId: request.user.userId, communityId: spaceCheck.communityId } },
            });
            if (!communityMembership) return reply.code(403).send({ error: 'Access denied' });
          } else {
            return reply.code(403).send({ error: 'Access denied' });
          }
        }

        const spaceInfo = await fastify.prisma.space.findUnique({
          where: { id: filterSpaceId },
          select: { id: true, name: true },
        });

        const items = await fastify.prisma.item.findMany({
          where: { spaceId: filterSpaceId },
          select: {
            id: true, title: true, type: true, status: true, spaceId: true, parentId: true,
            _count: { select: { contributions: true } },
          },
        });

        function buildSpaceItemTree(spaceItems: typeof items, parentId: string | null): SunburstNode[] {
          const children = spaceItems.filter(i => i.parentId === parentId);
          return children.map(item => {
            const subChildren = buildSpaceItemTree(spaceItems, item.id);
            const node: SunburstNode = {
              name: item.title,
              id: item.id,
              nodeType: 'item',
              itemType: item.type,
              status: item.status,
            };
            if (subChildren.length > 0) {
              node.children = subChildren;
            } else {
              node.value = Math.max(1, item._count.contributions);
            }
            return node;
          });
        }

        const itemTree = buildSpaceItemTree(items, null);
        const root: SunburstNode = {
          name: spaceInfo?.name || 'Espace',
          id: filterSpaceId,
          nodeType: 'space',
          children: itemTree.length > 0 ? itemTree : undefined,
          value: itemTree.length === 0 ? 1 : undefined,
        };
        return root;
      }

      // 1. Spaces where user is a direct member
      const directMemberships = await fastify.prisma.spaceMembership.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
      });
      const directSpaceIds = directMemberships.map(m => m.spaceId);

      // 2. Community memberships → all GROUP spaces
      const communityMemberships = await fastify.prisma.communityMembership.findMany({
        where: { userId: request.user.userId },
        select: { communityId: true },
      });
      const allUserCommunityIds = communityMemberships.map(m => m.communityId);

      const activeCommunityIds = filterCommunityIds
        ? allUserCommunityIds.filter(id => filterCommunityIds.includes(id))
        : allUserCommunityIds;

      const communitySpaces = activeCommunityIds.length > 0
        ? await fastify.prisma.space.findMany({
            where: { communityId: { in: activeCommunityIds }, type: 'GROUP' },
            select: { id: true, name: true, communityId: true },
          })
        : [];

      // When filtering by communities, only include direct spaces in selected communities
      let directSpacesInfo: Array<{ id: string; name: string; communityId: string | null }> = [];
      if (directSpaceIds.length > 0) {
        directSpacesInfo = await fastify.prisma.space.findMany({
          where: { id: { in: directSpaceIds } },
          select: { id: true, name: true, communityId: true },
        });
        if (filterCommunityIds) {
          directSpacesInfo = directSpacesInfo.filter(
            s => !s.communityId || filterCommunityIds.includes(s.communityId)
          );
        }
      }

      // Merge all unique spaces
      const allSpacesMap = new Map<string, { id: string; name: string; communityId: string | null }>();
      for (const s of communitySpaces) allSpacesMap.set(s.id, s);
      for (const s of directSpacesInfo) if (!allSpacesMap.has(s.id)) allSpacesMap.set(s.id, s);

      const allSpaceIds = [...allSpacesMap.keys()];

      // Get community names
      const communities = activeCommunityIds.length > 0
        ? await fastify.prisma.community.findMany({
            where: { id: { in: activeCommunityIds } },
            select: { id: true, name: true },
          })
        : [];
      const communityNameMap = new Map(communities.map(c => [c.id, c.name]));

      // Fetch items with contribution count
      const items = await fastify.prisma.item.findMany({
        where: { spaceId: { in: allSpaceIds } },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          spaceId: true,
          parentId: true,
          _count: { select: { contributions: true } },
        },
      });

      // Build item tree per space
      const itemsBySpace = new Map<string, typeof items>();
      for (const item of items) {
        const list = itemsBySpace.get(item.spaceId) || [];
        list.push(item);
        itemsBySpace.set(item.spaceId, list);
      }

      function buildItemTree(spaceItems: typeof items, parentId: string | null): SunburstNode[] {
        const children = spaceItems.filter(i => i.parentId === parentId);
        return children.map(item => {
          const subChildren = buildItemTree(spaceItems, item.id);
          const node: SunburstNode = {
            name: item.title,
            id: item.id,
            nodeType: 'item',
            itemType: item.type,
            status: item.status,
          };
          if (subChildren.length > 0) {
            node.children = subChildren;
          } else {
            node.value = Math.max(1, item._count.contributions);
          }
          return node;
        });
      }

      // Group spaces by community
      const spacesByCommunity = new Map<string, Array<{ id: string; name: string }>>();
      const personalSpaces: Array<{ id: string; name: string }> = [];

      for (const [, space] of allSpacesMap) {
        if (space.communityId && communityNameMap.has(space.communityId)) {
          const list = spacesByCommunity.get(space.communityId) || [];
          list.push({ id: space.id, name: space.name });
          spacesByCommunity.set(space.communityId, list);
        } else {
          personalSpaces.push({ id: space.id, name: space.name });
        }
      }

      const communityNodes: SunburstNode[] = [];

      // Community nodes
      for (const [communityId, spaces] of spacesByCommunity) {
        const spaceNodes: SunburstNode[] = spaces.map(space => {
          const spaceItems = itemsBySpace.get(space.id) || [];
          const itemTree = buildItemTree(spaceItems, null);
          return {
            name: space.name,
            id: space.id,
            nodeType: 'space' as const,
            children: itemTree.length > 0 ? itemTree : undefined,
            value: itemTree.length === 0 ? 1 : undefined,
          };
        });

        communityNodes.push({
          name: communityNameMap.get(communityId) || 'Communauté',
          id: communityId,
          nodeType: 'community',
          children: spaceNodes.length > 0 ? spaceNodes : undefined,
          value: spaceNodes.length === 0 ? 1 : undefined,
        });
      }

      // Personal/independent spaces node
      if (personalSpaces.length > 0) {
        const spaceNodes: SunburstNode[] = personalSpaces.map(space => {
          const spaceItems = itemsBySpace.get(space.id) || [];
          const itemTree = buildItemTree(spaceItems, null);
          return {
            name: space.name,
            id: space.id,
            nodeType: 'space' as const,
            children: itemTree.length > 0 ? itemTree : undefined,
            value: itemTree.length === 0 ? 1 : undefined,
          };
        });

        communityNodes.push({
          name: 'Personnel',
          id: 'personal',
          nodeType: 'community',
          children: spaceNodes,
        });
      }

      const root: SunburstNode = {
        name: 'SPOK',
        id: 'root',
        nodeType: 'global',
        children: communityNodes,
      };

      return root;
    }
  );
};
