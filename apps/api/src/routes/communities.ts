import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CommunityRole, CommunityDeletePreview } from '@spok/shared';
import { isR2Configured, processAvatar, processCover, uploadEntityImage, deleteFileFromR2 } from '../utils/r2.js';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit, serializeCommunityForAudit } from '../utils/audit.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createCommunitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

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
  // Create a new community
  fastify.post<{ Body: z.infer<typeof createCommunitySchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createCommunitySchema.parse(request.body);

    const community = await fastify.prisma.community.create({
      data: {
        name: body.name,
        description: body.description,
        isPublic: body.isPublic ?? false,
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

    return reply.status(201).send({
      ...community,
      role: 'OWNER' as CommunityRole,
      memberCount: community._count.memberships,
      spaceCount: community._count.spaces,
    });
  });

  // List user's communities
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
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

  // Delete preview — list spaces and items that will be affected
  fastify.get<{ Params: { id: string } }>('/:id/delete-preview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
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
      if (membership.community.coverUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.community.coverUrl);
      }
      coverUrl = await uploadEntityImage(processed, `communities/${request.params.id}/cover`);
    } else {
      coverUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const community = await fastify.prisma.community.update({
      where: { id: request.params.id },
      data: { coverUrl },
      select: { coverUrl: true },
    });

    return { coverUrl: community.coverUrl };
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

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
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
};
