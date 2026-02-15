import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Role, SpaceDeletePreview } from '@spok/shared';
import { itemsRoutes } from './items.js';
import { tagsRoutes } from './tags.js';
import { referentielsRoutes } from './referentiels.js';
import { auditLogsRoutes } from './auditLogs.js';
import { isR2Configured, processAvatar, processCover, uploadEntityImage, deleteFileFromR2 } from '../utils/r2.js';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit } from '../utils/audit.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createSpaceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERSONAL', 'GROUP']),
  communityId: z.string().optional(),
  parentId: z.string().optional(),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  communityId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
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
  fastify.get<{ Querystring: { communityId?: string; parentId?: string } }>('/', async (request) => {
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
                avatarUrl: true,
              },
            },
            parent: {
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
          parent: {
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

    // PERSONAL spaces cannot be nested or have communities
    if (body.type === 'PERSONAL') {
      if (body.communityId) {
        return reply.badRequest('Personal spaces cannot be associated with a community');
      }
      if (body.parentId) {
        return reply.badRequest('Les espaces personnels ne peuvent pas être imbriqués');
      }
    }

    let communityId = body.communityId;

    // If parentId is specified, validate parent and inherit communityId
    if (body.parentId) {
      const parentSpace = await fastify.prisma.space.findUnique({
        where: { id: body.parentId },
      });

      if (!parentSpace) {
        return reply.notFound('Espace parent introuvable');
      }

      if (parentSpace.type !== 'GROUP') {
        return reply.badRequest('Seuls les espaces de groupe peuvent avoir des sous-espaces');
      }

      // Inherit communityId from parent (ignore what was passed)
      communityId = parentSpace.communityId || undefined;
    }

    // Verify user is member of the community if specified
    if (communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId,
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
        communityId,
        parentId: body.parentId,
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
        parent: {
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
            parent: {
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
        parent: { select: { id: true, name: true } },
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

      // Cannot nest personal spaces
      if (body.parentId && membership.space.type === 'PERSONAL') {
        return reply.badRequest('Les espaces personnels ne peuvent pas être imbriqués');
      }

      // Validate parentId if provided
      let communityIdOverride: string | null | undefined = body.communityId;
      if (body.parentId !== undefined) {
        if (body.parentId !== null) {
          // Cannot set self as parent
          if (body.parentId === request.params.id) {
            return reply.badRequest('Un espace ne peut pas être son propre parent');
          }

          const parentSpace = await fastify.prisma.space.findUnique({
            where: { id: body.parentId },
          });

          if (!parentSpace) {
            return reply.notFound('Espace parent introuvable');
          }

          if (parentSpace.type !== 'GROUP') {
            return reply.badRequest('Seuls les espaces de groupe peuvent avoir des sous-espaces');
          }

          // Check circular reference: walk up the chain
          let currentParentId: string | null = parentSpace.parentId;
          while (currentParentId) {
            if (currentParentId === request.params.id) {
              return reply.badRequest('Référence circulaire détectée');
            }
            const ancestor = await fastify.prisma.space.findUnique({
              where: { id: currentParentId },
              select: { parentId: true },
            });
            currentParentId = ancestor?.parentId || null;
          }

          // Inherit communityId from parent
          communityIdOverride = parentSpace.communityId;
        }
      }

      // Verify user is member of the target community
      if (communityIdOverride) {
        const communityMembership = await fastify.prisma.communityMembership.findUnique({
          where: {
            userId_communityId: {
              userId: request.user.userId,
              communityId: communityIdOverride,
            },
          },
        });

        if (!communityMembership) {
          return reply.forbidden('Vous devez être membre de la communauté pour y rattacher un espace');
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.parentId !== undefined) updateData.parentId = body.parentId;
      if (communityIdOverride !== undefined) updateData.communityId = communityIdOverride;

      const space = await fastify.prisma.space.update({
        where: { id: request.params.id },
        data: updateData,
        include: {
          community: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: {
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

  // Delete preview — list children that will be affected
  fastify.get<{ Params: { id: string } }>('/:id/delete-preview', async (request, reply) => {
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    // Check permission: space OWNER or community OWNER/ADMIN
    const spaceMembership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    let canDelete = spaceMembership?.role === 'OWNER';

    if (!canDelete && space.communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: space.communityId,
          },
        },
      });
      if (communityMembership && ['OWNER', 'ADMIN'].includes(communityMembership.role)) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return reply.forbidden('Insufficient permissions');
    }

    // Collect all descendant spaces recursively
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

    const descendantIds = await collectDescendantSpaces(request.params.id);

    // Get child spaces with item counts
    const childSpaces = await fastify.prisma.space.findMany({
      where: { id: { in: descendantIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Count direct items
    const directItemCount = await fastify.prisma.item.count({
      where: { spaceId: request.params.id },
    });

    // Count total items across all spaces (current + descendants)
    const allSpaceIds = [request.params.id, ...descendantIds];
    const totalItemCount = await fastify.prisma.item.count({
      where: { spaceId: { in: allSpaceIds } },
    });

    // Count total contributions
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

  // Delete space
  fastify.delete<{ Params: { id: string }; Querystring: { deleteChildren?: string } }>('/:id', async (request, reply) => {
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
    });

    if (!space) {
      return reply.notFound('Space not found');
    }

    // Check space membership
    const spaceMembership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    let canDelete = false;

    // Space OWNER can always delete (including personal spaces)
    if (spaceMembership?.role === 'OWNER') {
      canDelete = true;
    }

    // Community OWNER or ADMIN can delete community spaces
    if (!canDelete && space.communityId) {
      const communityMembership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: space.communityId,
          },
        },
      });

      if (communityMembership && ['OWNER', 'ADMIN'].includes(communityMembership.role)) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return reply.forbidden('Insufficient permissions to delete this space');
    }

    const deleteChildren = request.query.deleteChildren === 'true';
    const batchId = crypto.randomUUID();

    // Collect all descendant spaces recursively
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

    const descendantSpaceIds = await collectDescendantSpaces(request.params.id);

    if (deleteChildren) {
      // Delete all children: items + sub-spaces with full audit

      // 1. Audit + delete items from all descendant spaces + current space
      const allSpaceIds = [...descendantSpaceIds, request.params.id];
      const allItems = await fastify.prisma.item.findMany({
        where: { spaceId: { in: allSpaceIds } },
      });

      if (allItems.length > 0) {
        // Delete contributions first (FK constraint)
        await fastify.prisma.contribution.deleteMany({
          where: { itemId: { in: allItems.map(i => i.id) } },
        });
        // Delete relations
        await fastify.prisma.itemRelation.deleteMany({
          where: {
            OR: [
              { fromItemId: { in: allItems.map(i => i.id) } },
              { toItemId: { in: allItems.map(i => i.id) } },
            ],
          },
        });
        // Delete items
        await fastify.prisma.item.deleteMany({
          where: { spaceId: { in: allSpaceIds } },
        });

        // Audit each item
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

      // 2. Audit + delete descendant spaces (leaf-first)
      // Reverse to delete leaves first
      const reversedDescendants = [...descendantSpaceIds].reverse();
      for (const descendantId of reversedDescendants) {
        const descendantSpace = await fastify.prisma.space.findUnique({
          where: { id: descendantId },
        });
        if (descendantSpace) {
          // Delete memberships
          await fastify.prisma.spaceMembership.deleteMany({
            where: { spaceId: descendantId },
          });
          // Delete the space
          await fastify.prisma.space.delete({
            where: { id: descendantId },
          });
          // Audit
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
      // Orphan sub-spaces (set parentId to null)
      if (descendantSpaceIds.length > 0) {
        // Only direct children need orphaning (not grandchildren — they keep their parent)
        await fastify.prisma.space.updateMany({
          where: { parentId: request.params.id },
          data: { parentId: null },
        });
      }

      // Audit + delete items from current space only
      const spaceItems = await fastify.prisma.item.findMany({
        where: { spaceId: request.params.id },
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
          where: { spaceId: request.params.id },
        });

        for (const item of spaceItems) {
          await createAuditLog(fastify.prisma, {
            action: 'DELETE',
            entity: 'Item',
            entityId: item.id,
            userId: request.user.userId,
            spaceId: request.params.id,
            batchId,
            changes: { before: serializeItemForAudit(item as unknown as Record<string, unknown>) },
          });
        }
      }
    }

    // 3. Delete memberships of current space
    await fastify.prisma.spaceMembership.deleteMany({
      where: { spaceId: request.params.id },
    });

    // 4. Audit the space itself
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Space',
      entityId: request.params.id,
      userId: request.user.userId,
      spaceId: request.params.id,
      batchId,
      changes: { before: serializeSpaceForAudit(space as unknown as Record<string, unknown>) },
    });

    // 5. Delete the space
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

  // Leave a space
  fastify.post<{ Params: { id: string } }>('/:id/leave', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (!membership) {
      return reply.notFound('Not a member of this space');
    }

    if (membership.role === 'OWNER') {
      return reply.forbidden('The owner cannot leave the space');
    }

    await fastify.prisma.spaceMembership.delete({
      where: { id: membership.id },
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

  // Upload space avatar
  fastify.post<{ Params: { id: string } }>('/:id/avatar', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.forbidden('Permissions insuffisantes');
    }

    const file = await request.file();
    if (!file) return reply.badRequest('Aucun fichier envoyé');
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      return reply.badRequest('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) {
      return reply.badRequest('Fichier trop volumineux (max 5 Mo)');
    }

    const processed = await processAvatar(buffer);
    let avatarUrl: string;

    if (isR2Configured()) {
      // Delete old avatar from R2 if exists
      if (membership.space.avatarUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.space.avatarUrl);
      }
      avatarUrl = await uploadEntityImage(processed, `spaces/${request.params.id}/avatar`);
    } else {
      avatarUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const space = await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return { avatarUrl: space.avatarUrl };
  });

  // Delete space avatar
  fastify.delete<{ Params: { id: string } }>('/:id/avatar', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.forbidden('Permissions insuffisantes');
    }

    if (membership.space.avatarUrl?.startsWith('http')) {
      await deleteFileFromR2(membership.space.avatarUrl);
    }

    await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { avatarUrl: null },
    });

    return { success: true };
  });

  // Upload space cover
  fastify.post<{ Params: { id: string } }>('/:id/cover', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.forbidden('Permissions insuffisantes');
    }

    const file = await request.file();
    if (!file) return reply.badRequest('Aucun fichier envoyé');
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      return reply.badRequest('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) {
      return reply.badRequest('Fichier trop volumineux (max 5 Mo)');
    }

    const processed = await processCover(buffer);
    let coverUrl: string;

    if (isR2Configured()) {
      if (membership.space.coverUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.space.coverUrl);
      }
      coverUrl = await uploadEntityImage(processed, `spaces/${request.params.id}/cover`);
    } else {
      coverUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const space = await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { coverUrl },
      select: { coverUrl: true },
    });

    return { coverUrl: space.coverUrl };
  });

  // Delete space cover
  fastify.delete<{ Params: { id: string } }>('/:id/cover', async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.forbidden('Permissions insuffisantes');
    }

    if (membership.space.coverUrl?.startsWith('http')) {
      await deleteFileFromR2(membership.space.coverUrl);
    }

    await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { coverUrl: null },
    });

    return { success: true };
  });
};
