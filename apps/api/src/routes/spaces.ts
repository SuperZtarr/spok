import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Role } from '@spok/shared';
import { itemsRoutes } from './items.js';
import { tagsRoutes } from './tags.js';
import { referentielsRoutes } from './referentiels.js';
import { auditLogsRoutes } from './auditLogs.js';

const createSpaceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERSONAL', 'GROUP']),
  communityId: z.string().optional(),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  communityId: z.string().nullable().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const spacesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Register nested routes
  await fastify.register(itemsRoutes, { prefix: '/:spaceId/items' });
  await fastify.register(tagsRoutes, { prefix: '/:spaceId/tags' });
  await fastify.register(referentielsRoutes, { prefix: '/:spaceId/referentiels' });
  await fastify.register(auditLogsRoutes, { prefix: '/:spaceId/audit-logs' });

  // List user's spaces (including visible community spaces)
  fastify.get<{ Querystring: { communityId?: string } }>('/', async (request) => {
    const { communityId } = request.query;

    // Build filter based on communityId parameter
    let spaceFilter: { communityId?: string | null } = {};

    if (communityId === 'none') {
      spaceFilter = { communityId: null };
    } else if (communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId,
          },
        },
      });

      if (!communityMembership) {
        return [];
      }

      spaceFilter = { communityId };
    }

    // 1. Get spaces where user is a member
    const memberships = await fastify.prisma.spaceMembership.findMany({
      where: {
        userId: request.user.userId,
        space: spaceFilter,
      },
      include: {
        space: {
          include: {
            _count: {
              select: { memberships: true, items: true },
            },
            community: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { space: { name: 'asc' } },
    });

    const memberSpaces = memberships.map((m) => ({
      ...m.space,
      role: m.role as Role,
      memberCount: m.space._count.memberships,
      itemCount: m.space._count.items,
      isMember: true,
    }));

    // 2. Get community spaces the user can see but hasn't joined
    const userCommunities = await fastify.prisma.communityMembership.findMany({
      where: { userId: request.user.userId },
      select: { communityId: true },
    });

    const communityIds = userCommunities.map(c => c.communityId);
    const memberSpaceIds = new Set(memberSpaces.map(s => s.id));

    if (communityIds.length > 0) {
      const communitySpaceFilter: Record<string, unknown> = {
        communityId: communityId && communityId !== 'none'
          ? communityId
          : { in: communityIds },
        type: 'GROUP',
        id: { notIn: Array.from(memberSpaceIds) },
      };

      const visibleSpaces = await fastify.prisma.space.findMany({
        where: communitySpaceFilter,
        include: {
          _count: {
            select: { memberships: true, items: true },
          },
          community: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const nonMemberSpaces = visibleSpaces.map((s) => ({
        ...s,
        role: 'VIEWER' as Role,
        memberCount: s._count.memberships,
        itemCount: s._count.items,
        isMember: false,
      }));

      return [...memberSpaces, ...nonMemberSpaces];
    }

    return memberSpaces;
  });

  // Create space
  fastify.post<{ Body: z.infer<typeof createSpaceSchema> }>('/', async (request, reply) => {
    const body = createSpaceSchema.parse(request.body);

    // Only GROUP spaces can be associated with a community
    if (body.communityId && body.type === 'PERSONAL') {
      return reply.badRequest('Personal spaces cannot be associated with a community');
    }

    // Verify user is member of the community if specified
    if (body.communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: body.communityId,
          },
        },
      });

      if (!communityMembership) {
        return reply.forbidden('You are not a member of this community');
      }
    }

    const space = await fastify.prisma.space.create({
      data: {
        name: body.name,
        type: body.type,
        communityId: body.communityId,
        memberships: {
          create: {
            userId: request.user.userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return reply.status(201).send({ ...space, role: 'OWNER' as Role });
  });

  // Get space by ID (direct membership OR community membership)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // 1. Try direct membership
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: {
        space: {
          include: {
            _count: {
              select: { memberships: true, items: true },
            },
            community: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (membership) {
      return {
        ...membership.space,
        role: membership.role,
        memberCount: membership.space._count.memberships,
        itemCount: membership.space._count.items,
      };
    }

    // 2. Try community membership → VIEWER access
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
      include: {
        _count: { select: { memberships: true, items: true } },
        community: { select: { id: true, name: true } },
      },
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

      if (communityMembership) {
        return {
          ...space,
          role: 'VIEWER' as Role,
          memberCount: space._count.memberships,
          itemCount: space._count.items,
        };
      }
    }

    return reply.notFound('Space not found or access denied');
  });

  // Update space
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateSpaceSchema> }>(
    '/:id',
    async (request, reply) => {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
        include: { space: true },
      });

      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      const body = updateSpaceSchema.parse(request.body);

      // Cannot assign community to personal space
      if (body.communityId && membership.space.type === 'PERSONAL') {
        return reply.badRequest('Les espaces personnels ne peuvent pas être rattachés à une communauté');
      }

      // Verify user is member of the target community
      if (body.communityId) {
        const communityMembership = await fastify.prisma.communityMembership.findUnique({
          where: {
            userId_communityId: {
              userId: request.user.userId,
              communityId: body.communityId,
            },
          },
        });

        if (!communityMembership) {
          return reply.forbidden('Vous devez être membre de la communauté pour y rattacher un espace');
        }
      }

      const space = await fastify.prisma.space.update({
        where: { id: request.params.id },
        data: {
          name: body.name,
          communityId: body.communityId,
        },
        include: {
          community: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return space;
    }
  );

  // Delete space
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Only the owner can delete a space');
    }

    if (membership.space.type === 'PERSONAL') {
      return reply.forbidden('Cannot delete personal space');
    }

    await fastify.prisma.space.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Join a community space
  fastify.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    // Check the space exists and belongs to a community
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    if (!space.communityId) {
      return reply.forbidden('Can only join community spaces');
    }

    // Verify user is member of the community
    const communityMembership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: space.communityId,
        },
      },
    });

    if (!communityMembership) {
      return reply.forbidden('You must be a member of the community');
    }

    // Check not already a member
    const existing = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (existing) {
      return reply.conflict('Already a member of this space');
    }

    await fastify.prisma.spaceMembership.create({
      data: {
        userId: request.user.userId,
        spaceId: request.params.id,
        role: 'MEMBER',
      },
    });

    return { success: true };
  });

  // Get space members
  fastify.get<{ Params: { id: string } }>('/:id/members', async (request, reply) => {
    // Check direct membership
    let hasAccess = !!(await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    }));

    // Fallback: community membership
    if (!hasAccess) {
      const space = await fastify.prisma.space.findUnique({
        where: { id: request.params.id },
        select: { communityId: true },
      });
      if (space?.communityId) {
        hasAccess = !!(await fastify.prisma.communityMembership.findUnique({
          where: {
            userId_communityId: {
              userId: request.user.userId,
              communityId: space.communityId,
            },
          },
        }));
      }
    }

    if (!hasAccess) {
      return reply.notFound('Space not found');
    }

    const members = await fastify.prisma.spaceMembership.findMany({
      where: { spaceId: request.params.id },
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

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  });

  // Invite member to space
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof inviteSchema> }>(
    '/:id/invite',
    async (request, reply) => {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
        include: { space: true },
      });

      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      if (membership.space.type === 'PERSONAL') {
        return reply.forbidden('Cannot invite members to personal space');
      }

      const body = inviteSchema.parse(request.body);

      const invitedUser = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!invitedUser) {
        return reply.notFound('User not found');
      }

      const existingMembership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: invitedUser.id,
            spaceId: request.params.id,
          },
        },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member');
      }

      const newMembership = await fastify.prisma.spaceMembership.create({
        data: {
          userId: invitedUser.id,
          spaceId: request.params.id,
          role: body.role,
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

      return reply.status(201).send({
        id: newMembership.id,
        userId: newMembership.userId,
        email: newMembership.user.email,
        name: newMembership.user.name,
        role: newMembership.role,
        joinedAt: newMembership.joinedAt,
      });
    }
  );
};
