import { FastifyPluginAsync } from 'fastify';

interface ListSpacesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: 'PERSONAL' | 'GROUP';
}

interface SpaceParams {
  id: string;
}

interface UpdateSpaceBody {
  name?: string;
  type?: 'PERSONAL' | 'GROUP';
}

interface AddMemberBody {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

interface UpdateMemberBody {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export const adminSpacesRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require admin authentication
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/spaces - List all spaces with pagination and search
  fastify.get<{ Querystring: ListSpacesQuery }>('/', async (request) => {
    const { page = 1, pageSize = 20, search, type } = request.query;
    const skip = (page - 1) * pageSize;

    const where: {
      name?: { contains: string; mode: 'insensitive' };
      type?: 'PERSONAL' | 'GROUP';
    } = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (type) {
      where.type = type;
    }

    const [spaces, total] = await Promise.all([
      fastify.prisma.space.findMany({
        where,
        include: {
          _count: {
            select: { memberships: true, items: true },
          },
          memberships: {
            where: { role: 'OWNER' },
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
            take: 1,
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.space.count({ where }),
    ]);

    return {
      data: spaces.map((space) => ({
        id: space.id,
        name: space.name,
        type: space.type,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        memberCount: space._count.memberships,
        itemCount: space._count.items,
        owner: space.memberships[0]?.user || null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });

  // GET /admin/spaces/:id - Get a single space with details
  fastify.get<{ Params: SpaceParams }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const space = await fastify.prisma.space.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true, items: true },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    return {
      id: space.id,
      name: space.name,
      type: space.type,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      memberCount: space._count.memberships,
      itemCount: space._count.items,
      members: space.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  });

  // PATCH /admin/spaces/:id - Update a space
  fastify.patch<{ Params: SpaceParams; Body: UpdateSpaceBody }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name, type } = request.body;

      const existingSpace = await fastify.prisma.space.findUnique({
        where: { id },
      });

      if (!existingSpace) {
        return reply.notFound('Space not found');
      }

      const updateData: { name?: string; type?: 'PERSONAL' | 'GROUP' } = {};
      if (name) updateData.name = name;
      if (type) updateData.type = type;

      const space = await fastify.prisma.space.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { memberships: true, items: true },
          },
        },
      });

      return {
        id: space.id,
        name: space.name,
        type: space.type,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        memberCount: space._count.memberships,
        itemCount: space._count.items,
      };
    }
  );

  // DELETE /admin/spaces/:id - Delete a space (admin can delete any space)
  fastify.delete<{ Params: SpaceParams }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const space = await fastify.prisma.space.findUnique({
      where: { id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    await fastify.prisma.space.delete({
      where: { id },
    });

    return { success: true };
  });

  // GET /admin/spaces/:id/members - Get space members
  fastify.get<{ Params: SpaceParams }>('/:id/members', async (request, reply) => {
    const { id } = request.params;

    const space = await fastify.prisma.space.findUnique({
      where: { id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    const members = await fastify.prisma.spaceMembership.findMany({
      where: { spaceId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  });

  // POST /admin/spaces/:id/members - Add a member to space
  fastify.post<{ Params: SpaceParams; Body: AddMemberBody }>(
    '/:id/members',
    async (request, reply) => {
      const { id } = request.params;
      const { userId, role } = request.body;

      const space = await fastify.prisma.space.findUnique({
        where: { id },
      });

      if (!space) {
        return reply.notFound('Space not found');
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.notFound('User not found');
      }

      const existingMembership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: { userId, spaceId: id },
        },
      });

      if (existingMembership) {
        return reply.conflict('User is already a member of this space');
      }

      const membership = await fastify.prisma.spaceMembership.create({
        data: {
          userId,
          spaceId: id,
          role,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return reply.code(201).send({
        id: membership.id,
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        joinedAt: membership.joinedAt,
      });
    }
  );

  // PATCH /admin/spaces/:id/members/:memberId - Update member role
  fastify.patch<{
    Params: { id: string; memberId: string };
    Body: UpdateMemberBody;
  }>('/:id/members/:memberId', async (request, reply) => {
    const { id, memberId } = request.params;
    const { role } = request.body;

    const membership = await fastify.prisma.spaceMembership.findFirst({
      where: { id: memberId, spaceId: id },
    });

    if (!membership) {
      return reply.notFound('Membership not found');
    }

    const updated = await fastify.prisma.spaceMembership.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      joinedAt: updated.joinedAt,
    };
  });

  // DELETE /admin/spaces/:id/members/:memberId - Remove member from space
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    async (request, reply) => {
      const { id, memberId } = request.params;

      const membership = await fastify.prisma.spaceMembership.findFirst({
        where: { id: memberId, spaceId: id },
      });

      if (!membership) {
        return reply.notFound('Membership not found');
      }

      await fastify.prisma.spaceMembership.delete({
        where: { id: memberId },
      });

      return { success: true };
    }
  );
};
