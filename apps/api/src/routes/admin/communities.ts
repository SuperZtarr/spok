import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CreateCommunityInput, CommunityDeletePreview } from '@spok/shared';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit, serializeCommunityForAudit } from '../../utils/audit.js';

const createCommunitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  isPublic: z.boolean().optional(),
});

interface ListCommunitiesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface CommunityParams {
  id: string;
}

export const adminCommunitiesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin authentication
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/communities/pending-count - Count communities awaiting public approval
  fastify.get('/pending-count', async () => {
    const count = await fastify.prisma.community.count({ where: { pendingPublic: true } });
    return { count };
  });

  // GET /admin/communities - List all communities with pagination
  fastify.get<{ Querystring: ListCommunitiesQuery }>('/', async (request) => {
    const { search } = request.query;
    const page = Number(request.query.page) || 1;
    const pageSize = Number(request.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [communities, total] = await Promise.all([
      fastify.prisma.community.findMany({
        where,
        include: {
          _count: {
            select: { memberships: true, spaces: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.community.count({ where }),
    ]);

    return {
      data: communities.map((c) => ({
        ...c,
        memberCount: c._count.memberships,
        spaceCount: c._count.spaces,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });

  // GET /admin/communities/:id - Get a single community
  fastify.get<{ Params: CommunityParams }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true, spaces: true },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        spaces: {
          include: {
            _count: {
              select: { memberships: true },
            },
          },
        },
      },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    return {
      ...community,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
      members: community.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      spaces: community.spaces.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        memberCount: s._count.memberships,
      })),
    };
  });

  // POST /admin/communities - Create a new community
  fastify.post<{ Body: z.infer<typeof createCommunitySchema> }>('/', async (request, reply) => {
    const { name, description, ownerEmail, isPublic } = createCommunitySchema.parse(request.body);

    // Determine the owner: specified user or current admin
    let ownerId = request.user.userId;

    if (ownerEmail) {
      const ownerUser = await fastify.prisma.user.findUnique({
        where: { email: ownerEmail },
      });

      if (!ownerUser) {
        return reply.notFound('Owner user not found');
      }

      ownerId = ownerUser.id;
    }

    const community = await fastify.prisma.community.create({
      data: {
        name,
        description,
        isPublic: isPublic ?? false,
        memberships: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: {
        _count: {
          select: { memberships: true, spaces: true },
        },
      },
    });

    return reply.code(201).send({
      ...community,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
    });
  });

  // PATCH /admin/communities/:id - Update a community
  fastify.patch<{ Params: CommunityParams; Body: { name?: string; description?: string; isPublic?: boolean } }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, isPublic } = request.body;

      const community = await fastify.prisma.community.findUnique({
        where: { id },
      });

      if (!community) {
        return reply.notFound('Community not found');
      }

      const updated = await fastify.prisma.community.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isPublic !== undefined && { isPublic }),
        },
        include: {
          _count: {
            select: { memberships: true, spaces: true },
          },
        },
      });

      return {
        ...updated,
        memberCount: updated._count.memberships,
        spaceCount: updated._count.spaces,
      };
    }
  );

  // GET /admin/communities/:id/delete-preview - Preview what will be deleted
  fastify.get<{ Params: CommunityParams }>('/:id/delete-preview', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    const spaces = await fastify.prisma.space.findMany({
      where: { communityId: id },
      select: {
        id: true,
        name: true,
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    const spaceIds = spaces.map(s => s.id);

    const totalItemCount = spaceIds.length > 0
      ? await fastify.prisma.item.count({ where: { spaceId: { in: spaceIds } } })
      : 0;

    const totalMemberCount = await fastify.prisma.communityMembership.count({
      where: { communityId: id },
    });

    const preview: CommunityDeletePreview = {
      spaces: spaces.map(s => ({
        id: s.id,
        name: s.name,
        itemCount: s._count.items,
      })),
      totalItemCount,
      totalMemberCount,
    };

    return preview;
  });

  // DELETE /admin/communities/:id - Delete a community with full audit
  fastify.delete<{ Params: CommunityParams; Querystring: { deleteChildren?: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    const deleteChildren = (request.query as Record<string, string>).deleteChildren === 'true';
    const batchId = crypto.randomUUID();

    const communitySpaces = await fastify.prisma.space.findMany({
      where: { communityId: id },
    });

    if (deleteChildren) {
      for (const space of communitySpaces) {
        // Collect descendant spaces
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

        const descendantIds = await collectDescendantSpaces(space.id);
        const allSpaceIds = [space.id, ...descendantIds];

        // Fetch and audit all items
        const allItems = await fastify.prisma.item.findMany({
          where: { spaceId: { in: allSpaceIds } },
        });

        if (allItems.length > 0) {
          await fastify.prisma.contribution.deleteMany({
            where: { itemId: { in: allItems.map(i => i.id) } },
          });
          await fastify.prisma.itemRelation.deleteMany({
            where: {
              OR: [
                { fromItemId: { in: allItems.map(i => i.id) } },
                { toItemId: { in: allItems.map(i => i.id) } },
              ],
            },
          });
          await fastify.prisma.item.deleteMany({
            where: { spaceId: { in: allSpaceIds } },
          });

          for (const item of allItems) {
            await createAuditLog(fastify.prisma, {
              action: 'DELETE',
              entity: 'Item',
              entityId: item.id,
              userId: request.user.userId,
              spaceId: item.spaceId,
              batchId,
              changes: { before: serializeItemForAudit(item as unknown as Record<string, unknown>) },
            });
          }
        }

        // Delete descendant spaces (leaf-first) + audit
        const reversedDescendants = [...descendantIds].reverse();
        for (const descendantId of reversedDescendants) {
          const descendantSpace = await fastify.prisma.space.findUnique({
            where: { id: descendantId },
          });
          if (descendantSpace) {
            await fastify.prisma.spaceMembership.deleteMany({ where: { spaceId: descendantId } });
            await fastify.prisma.space.delete({ where: { id: descendantId } });
            await createAuditLog(fastify.prisma, {
              action: 'DELETE',
              entity: 'Space',
              entityId: descendantId,
              userId: request.user.userId,
              spaceId: descendantId,
              batchId,
              changes: { before: serializeSpaceForAudit(descendantSpace as unknown as Record<string, unknown>) },
            });
          }
        }

        // Delete the top-level space
        await fastify.prisma.spaceMembership.deleteMany({ where: { spaceId: space.id } });
        await fastify.prisma.space.delete({ where: { id: space.id } });
        await createAuditLog(fastify.prisma, {
          action: 'DELETE',
          entity: 'Space',
          entityId: space.id,
          userId: request.user.userId,
          spaceId: space.id,
          batchId,
          changes: { before: serializeSpaceForAudit(space as unknown as Record<string, unknown>) },
        });
      }
    } else {
      // Orphan spaces (detach from community)
      if (communitySpaces.length > 0) {
        await fastify.prisma.space.updateMany({
          where: { communityId: id },
          data: { communityId: null },
        });
      }
    }

    // Delete community memberships
    await fastify.prisma.communityMembership.deleteMany({
      where: { communityId: id },
    });

    // Audit the community
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Community',
      entityId: id,
      userId: request.user.userId,
      spaceId: null,
      batchId,
      changes: { before: serializeCommunityForAudit(community as unknown as Record<string, unknown>) },
    });

    // Delete the community
    await fastify.prisma.community.delete({
      where: { id },
    });

    return { success: true };
  });

  // POST /admin/communities/:id/members - Add a member (admin bypass)
  fastify.post<{ Params: CommunityParams; Body: { email: string; role: 'OWNER' | 'MEMBER' } }>(
    '/:id/members',
    async (request, reply) => {
      const { id } = request.params;
      const { email, role } = request.body;

      const community = await fastify.prisma.community.findUnique({
        where: { id },
      });

      if (!community) {
        return reply.notFound('Community not found');
      }

      const user = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.notFound('User not found');
      }

      const existingMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: user.id,
            communityId: id,
          },
        },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member');
      }

      // If adding as OWNER, demote current owner to MEMBER
      if (role === 'OWNER') {
        await fastify.prisma.communityMembership.updateMany({
          where: { communityId: id, role: 'OWNER' },
          data: { role: 'MEMBER' },
        });
      }

      const membership = await fastify.prisma.communityMembership.create({
        data: {
          userId: user.id,
          communityId: id,
          role,
        },
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

      return reply.code(201).send({
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        joinedAt: membership.joinedAt,
      });
    }
  );

  // POST /admin/communities/:id/approve-public - Approve pending public request
  fastify.post<{ Params: CommunityParams }>('/:id/approve-public', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({ where: { id } });
    if (!community) return reply.notFound('Community not found');
    if (!community.pendingPublic && !(community as any).pendingVisibility) return reply.badRequest('Community has no pending public request');

    const approvedVisibility = (community as any).pendingVisibility || 'OPEN';
    const updated = await fastify.prisma.community.update({
      where: { id },
      data: { isPublic: true, pendingPublic: false, visibility: approvedVisibility, pendingVisibility: null },
      include: { _count: { select: { memberships: true, spaces: true } } },
    });

    return { ...updated, memberCount: updated._count.memberships, spaceCount: updated._count.spaces };
  });

  // POST /admin/communities/:id/reject-public - Reject pending public request
  fastify.post<{ Params: CommunityParams }>('/:id/reject-public', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({ where: { id } });
    if (!community) return reply.notFound('Community not found');
    if (!community.pendingPublic) return reply.badRequest('Community has no pending public request');

    const updated = await fastify.prisma.community.update({
      where: { id },
      data: { pendingPublic: false },
      include: { _count: { select: { memberships: true, spaces: true } } },
    });

    return { ...updated, memberCount: updated._count.memberships, spaceCount: updated._count.spaces };
  });
};
