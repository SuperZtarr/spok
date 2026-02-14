import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CreateCommunityInput } from '@spok/shared';

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

  // DELETE /admin/communities/:id - Delete a community
  fastify.delete<{ Params: CommunityParams }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const community = await fastify.prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    // Delete community (cascade will handle memberships)
    // Spaces will have communityId set to null (onDelete: SetNull)
    await fastify.prisma.community.delete({
      where: { id },
    });

    return { success: true };
  });

  // POST /admin/communities/:id/members - Add a member (admin bypass)
  fastify.post<{ Params: CommunityParams; Body: { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' } }>(
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

      // If adding as OWNER, demote current owner to ADMIN
      if (role === 'OWNER') {
        await fastify.prisma.communityMembership.updateMany({
          where: { communityId: id, role: 'OWNER' },
          data: { role: 'ADMIN' },
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
};
