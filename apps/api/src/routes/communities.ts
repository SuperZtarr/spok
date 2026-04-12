import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { CommunityRole, CommunityDeletePreview } from '@spok/shared';
import { isR2Configured, processAvatar, processCover, uploadEntityImage, deleteFileFromR2 } from '../utils/r2.js';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit, serializeCommunityForAudit } from '../utils/audit.js';
import { createNotification, sendInvitationEmail } from '../utils/notifications.js';
import { wrapEmailTemplate } from '../utils/emailTemplate.js';
import { createInvitation as createInvitationHelper, autoJoinCommunitySpaces } from './invitations.js';
import { communityReferentielsRoutes } from './community-referentiels.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createCommunitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  isPublic: z.boolean().optional(), // @deprecated — kept for backward compat
  visibility: z.enum(['OPEN', 'READONLY', 'PRIVATE']).optional(),
});

const updateCommunitySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(), // @deprecated — kept for backward compat
  visibility: z.enum(['OPEN', 'READONLY', 'PRIVATE']).optional(),
  coverPosition: z.number().int().min(0).max(100).optional(),
  coverPositionX: z.number().int().min(0).max(100).optional(),
  coverZoom: z.number().int().min(100).max(300).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'MEMBER']),
  message: z.string().optional(),
});

async function isAdminModeActive(prisma: PrismaClient, userId: string, isAdminMode: boolean): Promise<boolean> {
  if (!isAdminMode) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
  return user?.globalRole === 'ADMIN';
}

export const communitiesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register referentiels sub-routes
  await fastify.register(async function (optInstance) {
    optInstance.addHook('preHandler', optInstance.optionalAuthenticate);
    await optInstance.register(communityReferentielsRoutes, { prefix: '/:communityId/referentiels' });
  });

  // Create a new community
  fastify.post<{ Body: z.infer<typeof createCommunitySchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createCommunitySchema.parse(request.body);

    // Determine requested visibility (support both old isPublic and new visibility field)
    const requestedVisibility = body.visibility || (body.isPublic ? 'OPEN' : 'PRIVATE');
    const wantsPublic = requestedVisibility !== 'PRIVATE';

    const community = await fastify.prisma.community.create({
      data: {
        name: body.name,
        description: body.description,
        visibility: 'PRIVATE',
        pendingVisibility: wantsPublic ? requestedVisibility : null,
        isPublic: false,
        pendingPublic: wantsPublic,
        memberships: {
          create: {
            userId: request.user.userId,
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

    // Notify admins if pending public approval
    if (wantsPublic) {
      const admins = await fastify.prisma.user.findMany({
        where: { globalRole: 'ADMIN' },
        select: { id: true },
      });
      const creator = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { name: true },
      });
      for (const admin of admins) {
        await createNotification(fastify.prisma, {
          userId: admin.id,
          type: 'INVITATION',
          title: 'Demande de publication',
          message: `${creator?.name || 'Un utilisateur'} demande à rendre la communauté "${body.name}" publique.`,
          link: '/admin',
        });
      }
    }

    return reply.status(201).send({
      ...community,
      role: 'OWNER' as CommunityRole,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
    });
  });

  // List communities — authenticated: user's + public; anonymous: public only
  fastify.get('/', { preHandler: [fastify.optionalAuthenticate] }, async (request) => {
    if (!request.user?.userId) {
      // Anonymous: return public communities
      const publicCommunities = await fastify.prisma.community.findMany({
        where: { isPublic: true },
        include: { _count: { select: { memberships: true, spaces: true } } },
        orderBy: { name: 'asc' },
      });
      return publicCommunities.map(c => ({
        ...c,
        role: null,
        order: 0,
        memberCount: c._count.memberships,
        spaceCount: c._count.spaces,
      }));
    }

    // Authenticated: user's communities (sorted by user order)
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
      orderBy: { order: 'asc' },
    });

    const userCommunities = memberships.map((m) => ({
      ...m.community,
      role: m.role,
      order: m.order,
      memberCount: m.community._count.memberships,
      spaceCount: m.community._count.spaces,
    }));

    // Also include public communities the user hasn't joined
    const myIds = new Set(memberships.map(m => m.communityId));
    const publicCommunities = await fastify.prisma.community.findMany({
      where: { isPublic: true, id: { notIn: Array.from(myIds) } },
      include: { _count: { select: { memberships: true, spaces: true } } },
      orderBy: { name: 'asc' },
    });

    const publicMapped = publicCommunities.map(c => ({
      ...c,
      role: null as string | null,
      order: 999,
      memberCount: c._count.memberships,
      spaceCount: c._count.spaces,
    }));

    // Pending invitations for this user (by email)
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { email: true, globalRole: true } });
    const pendingInvitations = await fastify.prisma.invitation.findMany({
      where: { email: currentUser!.email, status: 'PENDING', communityId: { not: null } },
      include: { community: { include: { _count: { select: { memberships: true, spaces: true } } } } },
    });
    const invitedIds = new Set(pendingInvitations.map(i => i.communityId!));
    const invitedMapped = pendingInvitations
      .filter(i => i.community && !myIds.has(i.communityId!))
      .map(i => ({
        ...i.community!,
        role: 'INVITED' as string | null,
        order: 998,
        memberCount: i.community!._count.memberships,
        spaceCount: i.community!._count.spaces,
      }));

    // Admin: all remaining communities (not member, not public non-member, not invited)
    // Only when admin mode is explicitly activated (X-Admin-Mode header)
    let adminMapped: typeof publicMapped = [];
    if (currentUser?.globalRole === 'ADMIN' && request.isAdminMode) {
      const excludeIds = [...Array.from(myIds), ...publicCommunities.map(c => c.id), ...Array.from(invitedIds)];
      const otherCommunities = await fastify.prisma.community.findMany({
        where: { id: { notIn: excludeIds } },
        include: { _count: { select: { memberships: true, spaces: true } } },
        orderBy: { name: 'asc' },
      });
      adminMapped = otherCommunities.map(c => ({
        ...c,
        role: 'ADMIN_VIEW' as string | null,
        order: 1000,
        memberCount: c._count.memberships,
        spaceCount: c._count.spaces,
      }));
    }

    return [...userCommunities, ...invitedMapped, ...publicMapped, ...adminMapped];
  });

  // Reorder user's communities
  fastify.put<{ Body: { communityIds: string[] } }>('/reorder', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { communityIds } = request.body;
    if (!Array.isArray(communityIds)) return reply.badRequest('communityIds must be an array');

    const updates = communityIds.map((communityId, index) =>
      fastify.prisma.communityMembership.updateMany({
        where: { userId: request.user.userId, communityId },
        data: { order: index },
      })
    );
    await fastify.prisma.$transaction(updates);

    return { success: true };
  });

  // List public communities (authenticated: exclude joined; anonymous: all public)
  fastify.get('/public', { preHandler: [fastify.optionalAuthenticate] }, async (request) => {
    let myIds: string[] = [];
    if (request.user?.userId) {
      const myMemberships = await fastify.prisma.communityMembership.findMany({
        where: { userId: request.user.userId },
        select: { communityId: true },
      });
      myIds = myMemberships.map((m) => m.communityId);
    }

    const communities = await fastify.prisma.community.findMany({
      where: {
        isPublic: true,
        visibility: { not: 'PRIVATE' },
        ...(myIds.length > 0 ? { id: { notIn: myIds } } : {}),
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

  // Get community by ID (authenticated: full access if member; anonymous: public only)
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    // If authenticated, check membership
    if (request.user?.userId) {
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
    }

    // Non-member or anonymous: allow access if community is public
    const community = await fastify.prisma.community.findUnique({
      where: { id: request.params.id },
      include: {
        _count: {
          select: { memberships: true, spaces: true },
        },
      },
    });

    if (!community) {
      return reply.notFound('Community not found or access denied');
    }

    // Admin mode: full access to any community regardless of visibility
    const currentUser = request.user?.userId
      ? await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } })
      : null;

    if (community.visibility === 'PRIVATE' && !(currentUser?.globalRole === 'ADMIN' && request.isAdminMode)) {
      return reply.notFound('Community not found or access denied');
    }

    return {
      ...community,
      role: (currentUser?.globalRole === 'ADMIN' && request.isAdminMode) ? 'ADMIN_VIEW' : null,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
    };
  });

  // Update community
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateCommunitySchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const adminBypass = await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode);

      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership && !adminBypass) {
        return reply.notFound('Community not found');
      }

      if (!adminBypass && membership?.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const body = updateCommunitySchema.parse(request.body);

      // Sync isPublic from visibility for backward compat
      const updateData: Record<string, unknown> = {};
      if (body.name) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.visibility) {
        updateData.visibility = body.visibility;
        updateData.isPublic = body.visibility !== 'PRIVATE';
      } else if (body.isPublic !== undefined) {
        updateData.isPublic = body.isPublic;
        updateData.visibility = body.isPublic ? 'OPEN' : 'PRIVATE';
      }
      if (body.coverPosition !== undefined) updateData.coverPosition = body.coverPosition;
      if (body.coverPositionX !== undefined) updateData.coverPositionX = body.coverPositionX;
      if (body.coverZoom !== undefined) updateData.coverZoom = body.coverZoom;

      const community = await fastify.prisma.community.update({
        where: { id: request.params.id },
        data: updateData,
      });

      return community;
    }
  );

  // Delete preview — list spaces and items that will be affected
  fastify.get<{ Params: { id: string } }>('/:id/delete-preview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const adminBypass = await isAdminModeActive(fastify.prisma, request.user.userId, request.isAdminMode);

    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!adminBypass && (!membership || membership.role !== 'OWNER')) {
      return reply.forbidden('Only the owner can delete a community');
    }

    // Get all spaces in this community with item counts
    const spaces = await fastify.prisma.space.findMany({
      where: { communityId: request.params.id },
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
      where: { communityId: request.params.id },
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

  // Delete community
  fastify.delete<{ Params: { id: string }; Querystring: { deleteChildren?: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const community = await fastify.prisma.community.findUnique({
      where: { id: request.params.id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return reply.forbidden('Only the owner can delete a community');
    }

    const deleteChildren = request.query.deleteChildren === 'true';
    const batchId = crypto.randomUUID();

    // Get all spaces in this community
    const communitySpaces = await fastify.prisma.space.findMany({
      where: { communityId: request.params.id },
    });

    if (deleteChildren) {
      // Delete all spaces and their items with full audit

      for (const space of communitySpaces) {
        // Collect descendant spaces of this space
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

        // Delete the top-level space itself
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
          where: { communityId: request.params.id },
          data: { communityId: null },
        });
      }
    }

    // Delete community memberships
    await fastify.prisma.communityMembership.deleteMany({
      where: { communityId: request.params.id },
    });

    // Audit the community itself
    await createAuditLog(fastify.prisma, {
      action: 'DELETE',
      entity: 'Community',
      entityId: request.params.id,
      userId: request.user.userId,
      spaceId: null,
      batchId,
      changes: { before: serializeCommunityForAudit(community as unknown as Record<string, unknown>) },
    });

    // Delete the community
    await fastify.prisma.community.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });

  // Join a public community
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const community = await fastify.prisma.community.findUnique({
      where: { id: request.params.id },
    });

    if (!community) {
      return reply.notFound('Community not found');
    }

    if (community.visibility === 'PRIVATE') {
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

    // Auto-join spaces with defaultRole
    await autoJoinCommunitySpaces(fastify.prisma as unknown as PrismaClient, request.user.userId, request.params.id);

    return { success: true };
  });

  // Leave a community (cascade: also removes space memberships)
  fastify.post<{ Params: { id: string } }>('/:id/leave', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!membership) {
      return reply.notFound('Not a member of this community');
    }

    if (membership.role === 'OWNER') {
      return reply.forbidden('The owner cannot leave the community');
    }

    // Find all spaces in this community
    const communitySpaces = await fastify.prisma.space.findMany({
      where: { communityId: request.params.id },
      select: { id: true },
    });

    const spaceIds = communitySpaces.map((s) => s.id);

    // Remove space memberships in this community's spaces
    if (spaceIds.length > 0) {
      await fastify.prisma.spaceMembership.deleteMany({
        where: {
          userId: request.user.userId,
          spaceId: { in: spaceIds },
        },
      });
    }

    // Remove community membership
    await fastify.prisma.communityMembership.delete({
      where: { id: membership.id },
    });

    return { success: true };
  });

  // Get community members
  fastify.get<{ Params: { id: string } }>('/:id/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    // Admin mode: bypass membership check
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } });
    const isAdminBypass = currentUser?.globalRole === 'ADMIN' && request.isAdminMode;

    if (!membership && !isAdminBypass) {
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

  // List users not yet members of this community
  fastify.get<{ Params: { id: string } }>('/:id/available-users', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return reply.forbidden('Only owners can view available users');
    }

    const existingMemberIds = await fastify.prisma.communityMembership.findMany({
      where: { communityId: request.params.id },
      select: { userId: true },
    });

    const memberIds = existingMemberIds.map(m => m.userId);

    const users = await fastify.prisma.user.findMany({
      where: {
        id: { notIn: memberIds },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return users;
  });

  // Add member directly to community
  fastify.post<{ Params: { id: string }; Body: { userId: string; role: string } }>(
    '/:id/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Only owners can add members');
      }

      const { userId, role } = request.body;
      if (!['OWNER', 'MEMBER'].includes(role)) {
        return reply.badRequest('Invalid role');
      }

      const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.notFound('User not found');

      const existing = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId, communityId: request.params.id } },
      });
      if (existing) return reply.conflict('User is already a member');

      const newMembership = await fastify.prisma.communityMembership.create({
        data: {
          userId,
          communityId: request.params.id,
          role: role as any,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      return {
        id: newMembership.id,
        userId: newMembership.userId,
        email: newMembership.user.email,
        name: newMembership.user.name,
        role: newMembership.role,
        joinedAt: newMembership.joinedAt,
      };
    },
  );

  // Invite member to community (creates an Invitation, not a direct membership)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof inviteSchema> }>(
    '/:id/invite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const mem = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
        include: { community: { select: { name: true } } },
      });

      if (!mem) {
        return reply.notFound('Community not found');
      }

      if (mem.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const body = inviteSchema.parse(request.body);

      // Check if user is already a member
      const invitedUser = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (invitedUser) {
        const existingMembership = await fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId: invitedUser.id, communityId: request.params.id } },
        });
        if (existingMembership) {
          return reply.conflict('User is already a member');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await fastify.prisma.invitation.findFirst({
        where: { email: body.email, communityId: request.params.id, status: 'PENDING' },
      });
      if (existingInvitation) {
        return reply.conflict('An invitation is already pending for this email');
      }

      const invitation = await createInvitationHelper(fastify.prisma as unknown as PrismaClient, {
        email: body.email,
        role: body.role,
        message: body.message,
        communityId: request.params.id,
        invitedById: request.user.userId,
      });

      // Notify invited user
      const inviterName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';

      if (invitedUser) {
        await createNotification(fastify.prisma, {
          userId: invitedUser.id,
          type: 'INVITATION',
          title: `${inviterName} vous invite à rejoindre la communauté « ${mem.community.name} »`,
          link: `/invitations`,
          metadata: { actorId: request.user.userId, actorName: inviterName, communityName: mem.community.name, invitationId: invitation.id },
        });
      }

      // Send invitation email
      await sendInvitationEmail({
        to: body.email,
        inviterName,
        targetName: mem.community.name,
        targetType: 'communauté',
        token: invitation.token,
        message: body.message,
        role: body.role,
      });

      return reply.status(201).send(invitation);
    }
  );

  // List pending invitations for a community
  fastify.get<{ Params: { id: string } }>(
    '/:id/invitations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const mem = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: request.user.userId, communityId: request.params.id } },
      });
      if (!mem || mem.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const invitations = await fastify.prisma.invitation.findMany({
        where: { communityId: request.params.id },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invitations;
    }
  );

  // Remove member from community
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    { preHandler: [fastify.authenticate] },
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

      if (membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const memberToRemove = await fastify.prisma.communityMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToRemove || memberToRemove.communityId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      // Cannot remove an owner
      if (memberToRemove.role === 'OWNER') {
        return reply.forbidden('Cannot remove a community owner');
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
    { preHandler: [fastify.authenticate] },
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

      // If demoting an owner, ensure at least one owner remains
      if (memberToUpdate.role === 'OWNER' && request.body.role !== 'OWNER') {
        const ownerCount = await fastify.prisma.communityMembership.count({
          where: { communityId: request.params.id, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return reply.forbidden('Cannot demote the last owner');
        }
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

  // Transfer community ownership
  fastify.post<{ Params: { id: string }; Body: { targetMemberId: string } }>(
    '/:id/transfer-ownership',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const ownership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!ownership || ownership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can transfer ownership');
      }

      const targetMember = await fastify.prisma.communityMembership.findUnique({
        where: { id: request.body.targetMemberId },
      });

      if (!targetMember || targetMember.communityId !== request.params.id) {
        return reply.notFound('Target member not found');
      }

      if (targetMember.userId === request.user.userId) {
        return reply.badRequest('Cannot transfer ownership to yourself');
      }

      // Transaction: demote current owner to MEMBER, promote target to OWNER
      await fastify.prisma.$transaction([
        fastify.prisma.communityMembership.update({
          where: { id: ownership.id },
          data: { role: 'MEMBER' },
        }),
        fastify.prisma.communityMembership.update({
          where: { id: targetMember.id },
          data: { role: 'OWNER' },
        }),
      ]);

      return { success: true };
    }
  );

  // Upload community avatar
  fastify.post<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
      include: { community: true },
    });

    if (!membership || membership.role !== 'OWNER') {
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
      if (membership.community.avatarUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.community.avatarUrl);
      }
      avatarUrl = await uploadEntityImage(processed, `communities/${request.params.id}/avatar`);
    } else {
      avatarUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const community = await fastify.prisma.community.update({
      where: { id: request.params.id },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return { avatarUrl: community.avatarUrl };
  });

  // Delete community avatar
  fastify.delete<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
      include: { community: true },
    });

    if (!membership || membership.role !== 'OWNER') {
      return reply.forbidden('Permissions insuffisantes');
    }

    if (membership.community.avatarUrl?.startsWith('http')) {
      await deleteFileFromR2(membership.community.avatarUrl);
    }

    await fastify.prisma.community.update({
      where: { id: request.params.id },
      data: { avatarUrl: null },
    });

    return { success: true };
  });

  // Upload community cover
  fastify.post<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
      include: { community: true },
    });

    if (!membership || membership.role !== 'OWNER') {
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
      if (membership.community.coverUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.community.coverUrl);
      }
      coverUrl = await uploadEntityImage(processed, `communities/${request.params.id}/cover`);
    } else {
      coverUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const community = await fastify.prisma.community.update({
      where: { id: request.params.id },
      data: { coverUrl, coverPosition: 50, coverPositionX: 50, coverZoom: 100 },
      select: { coverUrl: true, coverPosition: true, coverPositionX: true, coverZoom: true },
    });

    return { coverUrl: community.coverUrl, coverPosition: community.coverPosition, coverPositionX: community.coverPositionX, coverZoom: community.coverZoom };
  });

  // Delete community cover
  fastify.delete<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: request.user.userId,
          communityId: request.params.id,
        },
      },
      include: { community: true },
    });

    if (!membership || membership.role !== 'OWNER') {
      return reply.forbidden('Permissions insuffisantes');
    }

    if (membership.community.coverUrl?.startsWith('http')) {
      await deleteFileFromR2(membership.community.coverUrl);
    }

    await fastify.prisma.community.update({
      where: { id: request.params.id },
      data: { coverUrl: null },
    });

    return { success: true };
  });

  // ==================== Community Tags ====================

  // GET /communities/:id/tags — list community-level tags
  fastify.get<{ Params: { id: string } }>('/:id/tags', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const community = await fastify.prisma.community.findUnique({ where: { id: request.params.id } });
    if (!community) return reply.notFound('Community not found');

    // Check membership (or non-private visibility)
    if (community.visibility === 'PRIVATE') {
      if (!request.user?.userId) return reply.unauthorized('Authentication required');
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: request.user.userId, communityId: request.params.id } },
      });
      if (!membership) return reply.forbidden('Not a member of this community');
    }

    const tags = await fastify.prisma.tag.findMany({
      where: { communityId: request.params.id },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag) => ({ ...tag, itemCount: tag._count.items }));
  });

  // POST /communities/:id/tags — create community tag (OWNER/ADMIN only)
  fastify.post<{ Params: { id: string }; Body: { name: string; color?: string } }>(
    '/:id/tags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: request.user.userId, communityId: request.params.id } },
      });
      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Only owners and admins can manage community tags');
      }

      const { name, color } = request.body;
      if (!name || name.trim().length === 0) return reply.badRequest('Tag name is required');

      const existing = await fastify.prisma.tag.findUnique({
        where: { communityId_name: { communityId: request.params.id, name: name.trim() } },
      });
      if (existing) return reply.conflict('Tag with this name already exists');

      const tag = await fastify.prisma.tag.create({
        data: { name: name.trim(), color, communityId: request.params.id },
      });

      return reply.status(201).send(tag);
    }
  );

  // PATCH /communities/:id/tags/:tagId — update community tag
  fastify.patch<{ Params: { id: string; tagId: string }; Body: { name?: string; color?: string | null } }>(
    '/:id/tags/:tagId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: request.user.userId, communityId: request.params.id } },
      });
      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Only owners and admins can manage community tags');
      }

      const tag = await fastify.prisma.tag.findFirst({
        where: { id: request.params.tagId, communityId: request.params.id },
      });
      if (!tag) return reply.notFound('Tag not found');

      const { name, color } = request.body;
      if (name && name !== tag.name) {
        const existing = await fastify.prisma.tag.findUnique({
          where: { communityId_name: { communityId: request.params.id, name } },
        });
        if (existing) return reply.conflict('Tag with this name already exists');
      }

      const updated = await fastify.prisma.tag.update({
        where: { id: request.params.tagId },
        data: { ...(name && { name }), ...(color !== undefined && { color }) },
      });

      return updated;
    }
  );

  // DELETE /communities/:id/tags/:tagId — delete community tag
  fastify.delete<{ Params: { id: string; tagId: string } }>(
    '/:id/tags/:tagId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: request.user.userId, communityId: request.params.id } },
      });
      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Only owners and admins can manage community tags');
      }

      const tag = await fastify.prisma.tag.findFirst({
        where: { id: request.params.tagId, communityId: request.params.id },
      });
      if (!tag) return reply.notFound('Tag not found');

      await fastify.prisma.tag.delete({ where: { id: request.params.tagId } });
      return { success: true };
    }
  );

  // ==================== Send Email to Members ====================

  const sendEmailSchema = z.object({
    subject: z.string().min(1),
    html: z.string().min(1),
    recipientIds: z.array(z.string()).min(1),
  });

  // Helper: send emails via Resend and track recipients
  async function sendEmailsToUsers(
    prisma: typeof fastify.prisma,
    emailRecord: { id: string; subject: string; html: string },
    userIds: string[],
    communityName?: string,
  ) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });

    if (users.length === 0) return { sent: 0, failed: 0 };

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await resend.emails.send({
          from: 'SPOK <notifications@spok.space>',
          to: user.email,
          subject: communityName ? `[SPOK · ${communityName}] ${emailRecord.subject}` : emailRecord.subject,
          html: wrapEmailTemplate(emailRecord.html),
        });
        await prisma.communityEmailRecipient.upsert({
          where: { emailId_userId: { emailId: emailRecord.id, userId: user.id } },
          create: { emailId: emailRecord.id, userId: user.id },
          update: { sentAt: new Date() },
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }

  // POST /communities/:id/send-email — send email to community members
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof sendEmailSchema> }>(
    '/:id/send-email',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!process.env.RESEND_API_KEY) {
        return reply.serviceUnavailable('Email service is not configured');
      }

      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const body = sendEmailSchema.parse(request.body);

      // Verify recipients are community members
      const members = await fastify.prisma.communityMembership.findMany({
        where: {
          communityId: request.params.id,
          userId: { in: body.recipientIds },
        },
        select: { userId: true },
      });

      const validUserIds = members.map((m) => m.userId);
      if (validUserIds.length === 0) {
        return reply.badRequest('No valid recipients found among community members');
      }

      const community = await fastify.prisma.community.findUnique({
        where: { id: request.params.id },
        select: { name: true },
      });

      // Persist the email
      const emailRecord = await fastify.prisma.communityEmail.create({
        data: {
          communityId: request.params.id,
          subject: body.subject,
          html: body.html,
          sentById: request.user.userId,
        },
      });

      const result = await sendEmailsToUsers(fastify.prisma, emailRecord, validUserIds, community?.name);
      return result;
    }
  );

  // GET /communities/:id/emails — list sent emails
  fastify.get<{ Params: { id: string } }>(
    '/:id/emails',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const emails = await fastify.prisma.communityEmail.findMany({
        where: { communityId: request.params.id },
        include: {
          sentBy: { select: { id: true, name: true, email: true } },
          _count: { select: { recipients: true } },
        },
        orderBy: { sentAt: 'desc' },
      });

      return emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        sentAt: e.sentAt,
        sentBy: e.sentBy,
        recipientCount: e._count.recipients,
      }));
    }
  );

  // GET /communities/:id/emails/:emailId — get email detail
  fastify.get<{ Params: { id: string; emailId: string } }>(
    '/:id/emails/:emailId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const email = await fastify.prisma.communityEmail.findUnique({
        where: { id: request.params.emailId, communityId: request.params.id },
        include: {
          sentBy: { select: { id: true, name: true, email: true } },
          recipients: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { sentAt: 'asc' },
          },
        },
      });

      if (!email) return reply.notFound('Email not found');

      return {
        id: email.id,
        subject: email.subject,
        html: email.html,
        sentAt: email.sentAt,
        sentBy: email.sentBy,
        recipientCount: email.recipients.length,
        recipients: email.recipients.map((r) => ({
          userId: r.user.id,
          name: r.user.name,
          email: r.user.email,
          sentAt: r.sentAt,
        })),
      };
    }
  );

  // POST /communities/:id/emails/:emailId/resend — resend to new members
  fastify.post<{ Params: { id: string; emailId: string }; Body: { recipientIds: string[] } }>(
    '/:id/emails/:emailId/resend',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!process.env.RESEND_API_KEY) {
        return reply.serviceUnavailable('Email service is not configured');
      }

      const membership = await fastify.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId: request.user.userId,
            communityId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const [email, community] = await Promise.all([
        fastify.prisma.communityEmail.findUnique({
          where: { id: request.params.emailId, communityId: request.params.id },
        }),
        fastify.prisma.community.findUnique({
          where: { id: request.params.id },
          select: { name: true },
        }),
      ]);

      if (!email) return reply.notFound('Email not found');

      const { recipientIds } = request.body;

      // Filter: only community members
      const members = await fastify.prisma.communityMembership.findMany({
        where: {
          communityId: request.params.id,
          userId: { in: recipientIds },
        },
        select: { userId: true },
      });

      const validUserIds = members.map((m) => m.userId);
      if (validUserIds.length === 0) {
        return reply.badRequest('No valid recipients found among community members');
      }

      const result = await sendEmailsToUsers(fastify.prisma, email, validUserIds, community?.name);
      return result;
    }
  );
};
