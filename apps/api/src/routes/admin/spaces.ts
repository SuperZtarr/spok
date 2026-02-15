import { FastifyPluginAsync } from 'fastify';
import type { SpaceDeletePreview } from '@spok/shared';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit } from '../../utils/audit.js';

interface ListSpacesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: 'PERSONAL' | 'GROUP';
  anomaly?: string;
}

interface SpaceParams {
  id: string;
}

interface UpdateSpaceBody {
  name?: string;
  type?: 'PERSONAL' | 'GROUP';
  communityId?: string | null;
  parentId?: string | null;
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
    const { search, type, anomaly } = request.query;
    const page = Number(request.query.page) || 1;
    const pageSize = Number(request.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (type) {
      where.type = type;
    }

    // Anomaly filters for coherence tests
    if (anomaly === 'no-owner') {
      where.memberships = { none: { role: 'OWNER' } };
    } else if (anomaly === 'no-community') {
      where.type = 'GROUP';
      where.communityId = null;
    } else if (anomaly === 'multi-member-personal') {
      // Get IDs of personal spaces with > 1 member via raw SQL
      const rows = await fastify.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT s.id FROM spaces s
        WHERE s.type = 'PERSONAL'
          AND (SELECT COUNT(*) FROM space_memberships sm WHERE sm."spaceId" = s.id) > 1
      `;
      where.id = { in: rows.map(r => r.id) };
    }

    const [spaces, total] = await Promise.all([
      fastify.prisma.space.findMany({
        where,
        include: {
          _count: {
            select: { memberships: true, items: true, children: true },
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
          community: {
            select: { id: true, name: true },
          },
          parent: {
            select: { id: true, name: true },
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
        communityId: space.communityId,
        community: space.community,
        parentId: space.parentId,
        parent: space.parent,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        memberCount: space._count.memberships,
        itemCount: space._count.items,
        childCount: space._count.children,
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
          select: { memberships: true, items: true, children: true },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        community: {
          select: { id: true, name: true },
        },
        parent: {
          select: { id: true, name: true },
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
      communityId: space.communityId,
      community: space.community,
      parentId: space.parentId,
      parent: space.parent,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      memberCount: space._count.memberships,
      itemCount: space._count.items,
      childCount: space._count.children,
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
      const { name, type, communityId } = request.body;

      const existingSpace = await fastify.prisma.space.findUnique({
        where: { id },
      });

      if (!existingSpace) {
        return reply.notFound('Space not found');
      }

      // Validate communityId if provided
      if (communityId) {
        const community = await fastify.prisma.community.findUnique({
          where: { id: communityId },
        });
        if (!community) {
          return reply.notFound('Community not found');
        }
      }

      // Personal spaces cannot have a community
      const finalType = type || existingSpace.type;
      if (finalType === 'PERSONAL' && communityId) {
        return reply.badRequest('Personal spaces cannot be associated with a community');
      }

      const { parentId } = request.body;
      const updateData: { name?: string; type?: 'PERSONAL' | 'GROUP'; communityId?: string | null; parentId?: string | null } = {};
      if (name) updateData.name = name;
      if (type) updateData.type = type;
      if (communityId !== undefined) updateData.communityId = communityId;
      if (parentId !== undefined) updateData.parentId = parentId;

      const space = await fastify.prisma.space.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { memberships: true, items: true, children: true },
          },
          community: {
            select: { id: true, name: true },
          },
          parent: {
            select: { id: true, name: true },
          },
        },
      });

      return {
        id: space.id,
        name: space.name,
        type: space.type,
        communityId: space.communityId,
        community: space.community,
        parentId: space.parentId,
        parent: space.parent,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        memberCount: space._count.memberships,
        itemCount: space._count.items,
        childCount: space._count.children,
      };
    }
  );

  // GET /admin/spaces/:id/delete-preview - Preview what will be deleted
  fastify.get<{ Params: SpaceParams }>('/:id/delete-preview', async (request, reply) => {
    const { id } = request.params;

    const space = await fastify.prisma.space.findUnique({
      where: { id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

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

    const descendantIds = await collectDescendantSpaces(id);

    const childSpaces = await fastify.prisma.space.findMany({
      where: { id: { in: descendantIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    const directItemCount = await fastify.prisma.item.count({
      where: { spaceId: id },
    });

    const allSpaceIds = [id, ...descendantIds];
    const totalItemCount = await fastify.prisma.item.count({
      where: { spaceId: { in: allSpaceIds } },
    });

    const totalContributionCount = await fastify.prisma.contribution.count({
      where: { item: { spaceId: { in: allSpaceIds } } },
    });

    const preview: SpaceDeletePreview = {
      childSpaces: childSpaces.map(s => ({
        id: s.id,
        name: s.name,
        itemCount: s._count.items,
      })),
      directItemCount,
      totalItemCount,
      totalContributionCount,
    };

    return preview;
  });

  // DELETE /admin/spaces/:id - Delete a space with full audit (admin can delete any space)
  fastify.delete<{ Params: SpaceParams; Querystring: { deleteChildren?: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const space = await fastify.prisma.space.findUnique({
      where: { id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    const deleteChildren = (request.query as Record<string, string>).deleteChildren === 'true';
    const batchId = crypto.randomUUID();

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

    const descendantSpaceIds = await collectDescendantSpaces(id);

    if (deleteChildren) {
      const allSpaceIds = [...descendantSpaceIds, id];
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

      const reversedDescendants = [...descendantSpaceIds].reverse();
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
    } else {
      if (descendantSpaceIds.length > 0) {
        await fastify.prisma.space.updateMany({
          where: { parentId: id },
          data: { parentId: null },
        });
      }

      const spaceItems = await fastify.prisma.item.findMany({
        where: { spaceId: id },
      });

      if (spaceItems.length > 0) {
        await fastify.prisma.contribution.deleteMany({
          where: { itemId: { in: spaceItems.map(i => i.id) } },
        });
        await fastify.prisma.itemRelation.deleteMany({
          where: {
            OR: [
              { fromItemId: { in: spaceItems.map(i => i.id) } },
              { toItemId: { in: spaceItems.map(i => i.id) } },
            ],
          },
        });
        await fastify.prisma.item.deleteMany({
          where: { spaceId: id },
        });

        for (const item of spaceItems) {
          await createAuditLog(fastify.prisma, {
            action: 'DELETE',
            entity: 'Item',
            entityId: item.id,
            userId: request.user.userId,
            spaceId: id,
            batchId,
            changes: { before: serializeItemForAudit(item as unknown as Record<string, unknown>) },
          });
        }
      }
    }

    await fastify.prisma.spaceMembership.deleteMany({ where: { spaceId: id } });

    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Space',
      entityId: id,
      userId: request.user.userId,
      spaceId: id,
      batchId,
      changes: { before: serializeSpaceForAudit(space as unknown as Record<string, unknown>) },
    });

    await fastify.prisma.space.delete({ where: { id } });

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
