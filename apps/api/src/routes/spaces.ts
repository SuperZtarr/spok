import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Role } from '@spok/shared';
import { itemsRoutes } from './items.js';
import { tagsRoutes } from './tags.js';

const createSpaceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERSONAL', 'GROUP']),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
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

  // List user's spaces
  fastify.get('/', async (request) => {
    const memberships = await fastify.prisma.spaceMembership.findMany({
      where: { userId: request.user.userId },
      include: {
        space: {
          include: {
            _count: {
              select: { memberships: true, items: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.space,
      role: m.role,
      memberCount: m.space._count.memberships,
      itemCount: m.space._count.items,
    }));
  });

  // Create space
  fastify.post<{ Body: z.infer<typeof createSpaceSchema> }>('/', async (request, reply) => {
    const body = createSpaceSchema.parse(request.body);

    const space = await fastify.prisma.space.create({
      data: {
        name: body.name,
        type: body.type,
        memberships: {
          create: {
            userId: request.user.userId,
            role: 'OWNER',
          },
        },
      },
    });

    return reply.status(201).send({ ...space, role: 'OWNER' as Role });
  });

  // Get space by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
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
          },
        },
      },
    });

    if (!membership) {
      return reply.notFound('Space not found or access denied');
    }

    return {
      ...membership.space,
      role: membership.role,
      memberCount: membership.space._count.memberships,
      itemCount: membership.space._count.items,
    };
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
      });

      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (!['OWNER', 'ADMIN'].includes(membership.role)) {
        return reply.forbidden('Insufficient permissions');
      }

      const body = updateSpaceSchema.parse(request.body);

      const space = await fastify.prisma.space.update({
        where: { id: request.params.id },
        data: body,
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

  // Get space members
  fastify.get<{ Params: { id: string } }>('/:id/members', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (!membership) {
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
