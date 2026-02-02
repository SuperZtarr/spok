import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import type { CreateUserInput, UpdateUserInput, AdminUser } from '@spok/shared';

interface ListUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface UserParams {
  id: string;
}

export const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin authentication
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/users - List all users with pagination and search
  fastify.get<{ Querystring: ListUsersQuery }>('/', async (request) => {
    const { page = 1, pageSize = 20, search } = request.query;
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

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
        _count: {
          select: { memberships: true },
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
};
