import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import type { CreateUserInput, UpdateUserInput, AdminUser } from '@spok/shared';

interface ListUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  anomaly?: string;
}

interface UserParams {
  id: string;
}

export const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin authentication
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/users - List all users with pagination and search
  fastify.get<{ Querystring: ListUsersQuery }>('/', async (request) => {
    const { search, anomaly } = request.query;
    const page = Number(request.query.page) || 1;
    const pageSize = Number(request.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (anomaly === 'no-personal-space') {
      where.memberships = { none: { space: { type: 'PERSONAL' } } };
    }

    const [users, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { memberships: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });

  // GET /admin/users/:id - Get a single user
  fastify.get<{ Params: UserParams }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const user = await fastify.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        createdAt: true,
        updatedAt: true,
        notificationPreferences: true,
        _count: {
          select: { memberships: true, communityMemberships: true },
        },
        memberships: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            space: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        communityMemberships: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            community: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return reply.notFound('User not found');
    }

    return user;
  });

  // POST /admin/users - Create a new user
  fastify.post<{ Body: CreateUserInput }>('/', async (request, reply) => {
    const { email, password, name, globalRole = 'USER' } = request.body;

    // Check if email already exists
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.conflict('Email already in use');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with personal space
    const user = await fastify.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        globalRole,
        memberships: {
          create: {
            role: 'OWNER',
            space: {
              create: {
                name: `Espace de ${name}`,
                type: 'PERSONAL',
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { memberships: true },
        },
      },
    });

    return reply.code(201).send(user);
  });

  // PATCH /admin/users/:id - Update a user
  fastify.patch<{ Params: UserParams; Body: UpdateUserInput }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { email, password, name, globalRole } = request.body;

    // Check if user exists
    const existingUser = await fastify.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return reply.notFound('User not found');
    }

    // If changing to non-admin, check if this is the last admin
    if (globalRole && globalRole !== 'ADMIN' && existingUser.globalRole === 'ADMIN') {
      const adminCount = await fastify.prisma.user.count({
        where: { globalRole: 'ADMIN' },
      });

      if (adminCount <= 1) {
        return reply.badRequest('Cannot remove admin role from the last admin');
      }
    }

    // Check email uniqueness if changing
    if (email && email !== existingUser.email) {
      const emailExists = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        return reply.conflict('Email already in use');
      }
    }

    // Prepare update data
    const updateData: {
      email?: string;
      passwordHash?: string;
      name?: string;
      globalRole?: 'USER' | 'ADMIN';
    } = {};

    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (globalRole) updateData.globalRole = globalRole;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await fastify.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { memberships: true },
        },
      },
    });

    return user;
  });

  // DELETE /admin/users/:id - Delete a user
  fastify.delete<{ Params: UserParams }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const currentUserId = request.user.userId;

    // Prevent self-deletion
    if (id === currentUserId) {
      return reply.badRequest('Cannot delete your own account');
    }

    // Check if user exists
    const user = await fastify.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return reply.notFound('User not found');
    }

    // Check if this is the last admin
    if (user.globalRole === 'ADMIN') {
      const adminCount = await fastify.prisma.user.count({
        where: { globalRole: 'ADMIN' },
      });

      if (adminCount <= 1) {
        return reply.badRequest('Cannot delete the last admin');
      }
    }

    // Delete user (cascade will handle memberships, etc.)
    await fastify.prisma.user.delete({
      where: { id },
    });

    return { success: true };
  });

  // PATCH /admin/users/:id/notification-preferences - Update user notification preferences
  fastify.patch<{ Params: UserParams; Body: Record<string, string> }>(
    '/:id/notification-preferences',
    async (request, reply) => {
      const { id } = request.params;

      const user = await fastify.prisma.user.findUnique({ where: { id }, select: { notificationPreferences: true } });
      if (!user) {
        return reply.notFound('User not found');
      }

      const current = (user.notificationPreferences as any) || {};
      const merged = { ...current, ...request.body };

      await fastify.prisma.user.update({
        where: { id },
        data: { notificationPreferences: merged },
      });

      const defaults = { INVITATION: 'all', ASSIGNMENT: 'all', CONTRIBUTION: 'in_app', MENTION: 'all' };
      return { ...defaults, ...merged };
    }
  );

  // POST /admin/users/:id/communities - Add user to a community
  fastify.post<{ Params: UserParams; Body: { communityId: string; role: 'OWNER' | 'MEMBER' } }>(
    '/:id/communities',
    async (request, reply) => {
      const { id } = request.params;
      const { communityId, role } = request.body;

      const user = await fastify.prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.notFound('User not found');
      }

      const community = await fastify.prisma.community.findUnique({ where: { id: communityId } });
      if (!community) {
        return reply.notFound('Community not found');
      }

      const existingMembership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: id, communityId } },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member of this community');
      }

      // If adding as OWNER, demote current owner to MEMBER
      if (role === 'OWNER') {
        await fastify.prisma.communityMembership.updateMany({
          where: { communityId, role: 'OWNER' },
          data: { role: 'MEMBER' },
        });
      }

      const membership = await fastify.prisma.communityMembership.create({
        data: { userId: id, communityId, role },
        include: {
          community: { select: { id: true, name: true } },
        },
      });

      return reply.code(201).send({
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
        community: membership.community,
      });
    }
  );

  // DELETE /admin/users/:id/communities/:communityId - Remove user from a community
  fastify.delete<{ Params: { id: string; communityId: string } }>(
    '/:id/communities/:communityId',
    async (request, reply) => {
      const { id, communityId } = request.params;

      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: id, communityId } },
      });

      if (!membership) {
        return reply.notFound('User is not a member of this community');
      }

      await fastify.prisma.communityMembership.delete({
        where: { id: membership.id },
      });

      return { success: true };
    }
  );

  // POST /admin/users/:id/spaces - Add user to a space
  fastify.post<{ Params: UserParams; Body: { spaceId: string; role: 'OWNER' | 'MEMBER' } }>(
    ':id/spaces',
    async (request, reply) => {
      const { id } = request.params;
      const { spaceId, role } = request.body;

      const user = await fastify.prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.notFound('User not found');
      }

      const space = await fastify.prisma.space.findUnique({ where: { id: spaceId } });
      if (!space) {
        return reply.notFound('Space not found');
      }

      if (space.type === 'PERSONAL') {
        return reply.badRequest('Cannot add members to a personal space');
      }

      const existingMembership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId: id, spaceId } },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member of this space');
      }

      // If adding as OWNER, demote current owner to MEMBER
      if (role === 'OWNER') {
        await fastify.prisma.spaceMembership.updateMany({
          where: { spaceId, role: 'OWNER' },
          data: { role: 'MEMBER' },
        });
      }

      const membership = await fastify.prisma.spaceMembership.create({
        data: {
          userId: id,
          spaceId,
          role,
        },
        include: {
          space: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      return reply.status(201).send({
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
        space: membership.space,
      });
    }
  );

  // DELETE /admin/users/:id/spaces/:spaceId - Remove user from a space
  fastify.delete<{ Params: { id: string; spaceId: string } }>(
    ':id/spaces/:spaceId',
    async (request, reply) => {
      const { id, spaceId } = request.params;

      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId: id, spaceId } },
        include: { space: true },
      });

      if (!membership) {
        return reply.notFound('User is not a member of this space');
      }

      // Cannot remove from personal space
      if (membership.space.type === 'PERSONAL') {
        return reply.badRequest('Cannot remove user from their personal space');
      }

      await fastify.prisma.spaceMembership.delete({
        where: { id: membership.id },
      });

      return { success: true };
    }
  );
};
