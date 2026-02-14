import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CommunityRole } from '@spok/shared';

const updateCommunitySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const communitiesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // List user's communities
  fastify.get('/', async (request) => {
    const memberships = await fastify.prisma.communityMembership.findMany({
      where: { userId: request.user.userId },
      include: {
        community: {
          include: {
            _count: {
              select: { memberships: true, spaces: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.community,
      role: m.role,
      memberCount: m.community._count.memberships,
      spaceCount: m.community._count.spaces,
    }));
  });

  // List public communities the user has NOT joined
  fastify.get('/public', async (request) => {
    const myMemberships = await fastify.prisma.communityMembership.findMany({
      where: { userId: request.user.userId },
      select: { communityId: true },
    });
    const myIds = myMemberships.map((m) => m.communityId);

    const communities = await fastify.prisma.community.findMany({
      where: {
        isPublic: true,
        id: { notIn: myIds },
      },
      include: {
        _count: {
          select: { memberships: true, spaces: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return communities.map((c) => ({
      ...c,
      memberCount: c._count.memberships,
      spaceCount: c._count.spaces,
    }));
  });

  // Get community by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
      include: {
        community: {
          include: {
            _count: {
              select: { memberships: true, spaces: true },
            },
          },
        },
      },
    });

    if (membership) {
      return {
        ...membership.community,
        role: membership.role,
        memberCount: membership.community._count.memberships,
        spaceCount: membership.community._count.spaces,
      };
    }

    // Non-member: allow access if community is public
    const community = await fastify.prisma.community.findUnique({
      where: { id: request.params.id },
      include: {
        _count: {
          select: { memberships: true, spaces: true },
        },
      },
    });

    if (!community || !community.isPublic) {
      return reply.notFound('Community not found or access denied');
    }

    return {
      ...community,
      role: null,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
    };
  });

  // Update community
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateCommunitySchema> }>(
    '/:id',
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership) {
        return reply.notFound('Community not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      const body = updateCommunitySchema.parse(request.body);

      // Only OWNER can change visibility
      if (body.isPublic !== undefined && membership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can change community visibility');
      }

      const community = await fastify.prisma.community.update({
        where: { id: request.params.id },
        data: body,
      });

      return community;
    }
  );

  // Delete community
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!membership) {
      return reply.notFound('Community not found');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Only the owner can delete a community');
    }

    await fastify.prisma.community.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Join a public community
  fastify.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    const community = await fastify.prisma.community.findUnique({
      where: { id: request.params.id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    if (!community.isPublic) {
      return reply.forbidden('This community is private. You need an invitation to join.');
    }

    // Check if already a member
    const existing = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (existing) {
      return reply.conflict('Already a member of this community');
    }

    await fastify.prisma.communityMembership.create({
      data: {
        userId: request.user.userId,
        communityId: request.params.id,
        role: 'MEMBER',
      },
    });

    return { success: true };
  });

  // Get community members
  fastify.get<{ Params: { id: string } }>('/:id/members', async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!membership) {
      return reply.notFound('Community not found');
    }

    const members = await fastify.prisma.communityMembership.findMany({
      where: { communityId: request.params.id },
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

  // Invite member to community
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof inviteSchema> }>(
    '/:id/invite',
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership) {
        return reply.notFound('Community not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      const body = inviteSchema.parse(request.body);

      const invitedUser = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!invitedUser) {
        return reply.notFound('User not found');
      }

      const existingMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: invitedUser.id,
            communityId: request.params.id,
          },
        },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member');
      }

      const newMembership = await fastify.prisma.communityMembership.create({
        data: {
          userId: invitedUser.id,
          communityId: request.params.id,
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

  // Remove member from community
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership) {
        return reply.notFound('Community not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      const memberToRemove = await fastify.prisma.communityMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToRemove || memberToRemove.communityId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      // Cannot remove the owner
      if (memberToRemove.role === 'OWNER') {
        return reply.forbidden('Cannot remove the community owner');
      }

      // Admins cannot remove other admins (only owner can)
      if (memberToRemove.role === 'ADMIN' && membership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can remove admins');
      }

      await fastify.prisma.communityMembership.delete({
        where: { id: request.params.memberId },
      });

      return { success: true };
    }
  );

  // Update member role
  fastify.patch<{ Params: { id: string; memberId: string }; Body: { role: CommunityRole } }>(
    '/:id/members/:memberId',
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership) {
        return reply.notFound('Community not found');
      }

      // Only owner can change roles
      if (membership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can change member roles');
      }

      const memberToUpdate = await fastify.prisma.communityMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToUpdate || memberToUpdate.communityId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      // Cannot change owner's role
      if (memberToUpdate.role === 'OWNER') {
        return reply.forbidden('Cannot change the owner\'s role');
      }

      // Cannot promote to owner
      if (request.body.role === 'OWNER') {
        return reply.forbidden('Cannot promote to owner');
      }

      const updated = await fastify.prisma.communityMembership.update({
        where: { id: request.params.memberId },
        data: { role: request.body.role },
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

      return {
        id: updated.id,
        userId: updated.userId,
        email: updated.user.email,
        name: updated.user.name,
        role: updated.role,
        joinedAt: updated.joinedAt,
      };
    }
  );
};
