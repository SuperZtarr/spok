import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Role, SpaceDeletePreview } from '@spok/shared';
import { SPACE_TEMPLATES } from '@spok/shared';
import type { SpaceTemplateItem } from '@spok/shared';
import { itemsRoutes } from './items.js';
import { tagsRoutes } from './tags.js';
import { referentielsRoutes } from './referentiels.js';
import { auditLogsRoutes } from './auditLogs.js';
import { isR2Configured, processAvatar, processCover, uploadEntityImage, deleteFileFromR2 } from '../utils/r2.js';
import { wrapEmailTemplate } from '../utils/emailTemplate.js';
import { createAuditLog, serializeItemForAudit, serializeSpaceForAudit } from '../utils/audit.js';
import { createNotification, sendInvitationEmail } from '../utils/notifications.js';
import { createInvitation as createInvitationHelper } from './invitations.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'GROUP']),
  communityId: z.string().optional(),
  parentId: z.string().optional(),
  templateId: z.string().optional(),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  communityId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  defaultRole: z.enum(['MEMBER']).nullable().optional(),
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

export const spacesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register nested routes — optional auth (each file adds authenticate on write routes)
  await fastify.register(async function (optInstance) {
    optInstance.addHook('preHandler', optInstance.optionalAuthenticate);
    await optInstance.register(itemsRoutes, { prefix: '/:spaceId/items' });
    await optInstance.register(tagsRoutes, { prefix: '/:spaceId/tags' });
    await optInstance.register(referentielsRoutes, { prefix: '/:spaceId/referentiels' });
    await optInstance.register(auditLogsRoutes, { prefix: '/:spaceId/audit-logs' });
  });

  // List spaces (authenticated: all accessible; anonymous: public community spaces only)
  fastify.get<{ Querystring: { communityId?: string; parentId?: string } }>('/', { preHandler: [fastify.optionalAuthenticate] }, async (request) => {
    const { communityId } = request.query;
    const userId = request.user?.userId;

    // Anonymous visitor: only non-PRIVATE community spaces
    if (!userId) {
      // No communityId: return all spaces from public communities
      if (!communityId || communityId === 'none') {
        const spaces = await fastify.prisma.space.findMany({
          where: {
            type: 'GROUP',
            community: { isPublic: true, visibility: { not: 'PRIVATE' } },
            OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }],
          },
          include: {
            _count: { select: { memberships: true, items: true } },
            community: { select: { id: true, name: true, avatarUrl: true } },
            parent: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
        });

        return spaces.map((s) => ({
          ...s,
          role: ((s as any).visibility === 'READONLY' ? 'VIEWER' : 'MEMBER') as Role,
          memberCount: s._count.memberships,
          itemCount: s._count.items,
          isMember: false,
        }));
      }

      const community = await fastify.prisma.community.findUnique({
        where: { id: communityId },
        select: { visibility: true, isPublic: true },
      });
      if (!community || community.visibility === 'PRIVATE' || !community.isPublic) return [];

      const spaces = await fastify.prisma.space.findMany({
        where: { communityId, type: 'GROUP', OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }] },
        include: {
          _count: { select: { memberships: true, items: true } },
          community: { select: { id: true, name: true, avatarUrl: true } },
          parent: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });

      return spaces.map((s) => ({
        ...s,
        role: ((s as any).visibility === 'READONLY' ? 'VIEWER' : 'MEMBER') as Role,
        memberCount: s._count.memberships,
        itemCount: s._count.items,
        isMember: false,
      }));
    }

    // Build filter based on communityId parameter
    let spaceFilter: { communityId?: string | null } = {};
    let isPublicCommunity = false;
    let hasCommunityMembership = false;

    if (communityId === 'none') {
      spaceFilter = { communityId: null };
    } else if (communityId) {
      const [communityMembership, community, currentUser] = await Promise.all([
        fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId: request.user.userId, communityId } },
        }),
        fastify.prisma.community.findUnique({
          where: { id: communityId },
          select: { isPublic: true, visibility: true },
        }),
        fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } }),
      ]);

      const isAdminBypass = currentUser?.globalRole === 'ADMIN' && request.isAdminMode;
      isPublicCommunity = !!(community?.isPublic || community?.visibility !== 'PRIVATE');
      hasCommunityMembership = !!communityMembership;

      if (!communityMembership && !isAdminBypass && !isPublicCommunity) {
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
            memberships: {
              where: { role: 'OWNER' },
              include: { user: { select: { id: true, name: true } } },
              take: 1,
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
      owner: (m.space as any).memberships?.[0]?.user || null,
    }));

    // 2. Get community spaces the user can see but hasn't joined
    const userCommunities = await fastify.prisma.communityMembership.findMany({
      where: { userId: request.user.userId },
      select: { communityId: true },
    });

    const communityIds = userCommunities.map(c => c.communityId);
    const memberSpaceIds = new Set(memberSpaces.map(s => s.id));

    // If a specific public community is requested but user is not a member, include it anyway
    const effectiveCommunityIds = communityId && communityId !== 'none' && isPublicCommunity && !hasCommunityMembership
      ? [communityId]
      : communityIds;

    if (effectiveCommunityIds.length > 0) {
      const communitySpaceFilter: Record<string, unknown> = {
        communityId: communityId && communityId !== 'none'
          ? communityId
          : { in: effectiveCommunityIds },
        type: 'GROUP',
        id: { notIn: Array.from(memberSpaceIds) },
        OR: [{ visibility: null }, { visibility: { not: 'PRIVATE' } }],
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
          memberships: {
            where: { role: 'OWNER' },
            include: { user: { select: { id: true, name: true } } },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      });

      const nonMemberSpaces = visibleSpaces.map((s) => ({
        ...s,
        role: ((s as any).visibility === 'READONLY' ? 'VIEWER' : 'MEMBER') as Role,
        memberCount: s._count.memberships,
        itemCount: s._count.items,
        isMember: false,
        owner: (s as any).memberships?.[0]?.user || null,
      }));

      return [...memberSpaces, ...nonMemberSpaces];
    }

    return memberSpaces;
  });

  // Create space
  fastify.post<{ Body: z.infer<typeof createSpaceSchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

    // Verify user is member of the community if specified (bypass for admin mode)
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
        const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { globalRole: true } });
        const isAdminBypass = currentUser?.globalRole === 'ADMIN' && request.isAdminMode;
        if (!isAdminBypass) {
          return reply.forbidden('You are not a member of this community');
        }
      }
    }

    const space = await fastify.prisma.space.create({
      data: {
        name: body.name,
        description: body.description,
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

    // Apply template if specified
    const template = body.templateId ? SPACE_TEMPLATES.find(t => t.id === body.templateId) : null;
    if (template && template.id !== 'blank') {
      // Apply custom statuses via referentiels module
      if (template.statuses) {
        const referentielsConfig = {
          statuses: template.statuses,
          typeLabels: (await import('@spok/shared')).DEFAULT_TYPE_LABELS,
        };
        await fastify.prisma.spaceModule.create({
          data: {
            spaceId: space.id,
            moduleKey: 'referentiels',
            config: JSON.parse(JSON.stringify(referentielsConfig)),
            enabled: true,
          },
        });
      }

      // Create template items
      if (template.items && template.items.length > 0) {
        const createItems = async (items: SpaceTemplateItem[], parentId: string | null) => {
          for (let i = 0; i < items.length; i++) {
            const tplItem = items[i];
            const item = await fastify.prisma.item.create({
              data: {
                title: tplItem.title,
                type: tplItem.type,
                spaceId: space.id,
                createdById: request.user.userId,
                parentId,
                position: i,
              },
            });
            if (tplItem.children && tplItem.children.length > 0) {
              await createItems(tplItem.children, item.id);
            }
          }
        };
        await createItems(template.items, null);
      }
    }

    return reply.status(201).send({ ...space, role: 'OWNER' as Role });
  });

  // Get space by ID (direct membership, community membership, or public community)
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const userId = request.user?.userId;

    // 1. If authenticated, try direct membership
    if (userId) {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId,
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
    }

    // 2. Try community membership or public community → VIEWER access
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
      include: {
        _count: { select: { memberships: true, items: true } },
        community: { select: { id: true, name: true, isPublic: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    if (space?.communityId) {
      // Authenticated user: check community membership
      if (userId) {
        const communityMembership = await fastify.prisma.communityMembership.findUnique({
          where: {
            userId_communityId: {
              userId,
              communityId: space.communityId,
            },
          },
        });

        if (communityMembership) {
          return {
            ...space,
            role: 'MEMBER' as Role,
            memberCount: space._count.memberships,
            itemCount: space._count.items,
          };
        }
      }

      // Public community: allow anonymous and non-member authenticated users
      if (space.community?.isPublic) {
        return {
          ...space,
          role: 'MEMBER' as Role,
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
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      // Check if user is global admin
      const currentUser = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { globalRole: true },
      });
      const isGlobalAdmin = currentUser?.globalRole === 'ADMIN';

      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
        include: { space: true },
      });

      // Global admin can bypass membership check
      let space = membership?.space;
      if (!membership && !isGlobalAdmin) {
        return reply.notFound('Space not found');
      }

      if (!isGlobalAdmin && membership!.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      // If global admin without membership, load space directly
      if (!space) {
        space = await fastify.prisma.space.findUnique({
          where: { id: request.params.id },
        });
        if (!space) {
          return reply.notFound('Space not found');
        }
      }

      const body = updateSpaceSchema.parse(request.body);

      // Cannot assign community to personal space
      if (body.communityId && space.type === 'PERSONAL') {
        return reply.badRequest('Les espaces personnels ne peuvent pas être rattachés à une communauté');
      }

      // Cannot nest personal spaces
      if (body.parentId && space.type === 'PERSONAL') {
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

      // Verify user is member of the target community (skip for global admin)
      if (communityIdOverride && !isGlobalAdmin) {
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

      // If communityId changes and parentId wasn't explicitly set,
      // detach from parent if parent is in a different community
      if (communityIdOverride !== undefined && body.parentId === undefined && space.parentId) {
        const currentParent = await fastify.prisma.space.findUnique({
          where: { id: space.parentId },
          select: { communityId: true },
        });
        if (currentParent && currentParent.communityId !== communityIdOverride) {
          body.parentId = null;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.parentId !== undefined) updateData.parentId = body.parentId;
      if (communityIdOverride !== undefined) updateData.communityId = communityIdOverride;
      if (body.defaultRole !== undefined) updateData.defaultRole = body.defaultRole;
      if (body.coverPosition !== undefined) updateData.coverPosition = body.coverPosition;
      if (body.coverPositionX !== undefined) updateData.coverPositionX = body.coverPositionX;
      if (body.coverZoom !== undefined) updateData.coverZoom = body.coverZoom;

      const updatedSpace = await fastify.prisma.space.update({
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

      return updatedSpace;
    }
  );

  // Delete preview — list children that will be affected
  fastify.get<{ Params: { id: string } }>('/:id/delete-preview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
      if (communityMembership && communityMembership.role === 'OWNER') {
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
  fastify.delete<{ Params: { id: string }; Querystring: { deleteChildren?: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

      if (communityMembership && communityMembership.role === 'OWNER') {
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
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.post<{ Params: { id: string } }>('/:id/leave', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.get<{ Params: { id: string } }>('/:id/members', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    let hasAccess = false;

    if (request.user?.userId) {
      // Check direct membership
      hasAccess = !!(await fastify.prisma.spaceMembership.findUnique({
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
    }

    // Anonymous: allow access to public spaces
    if (!hasAccess) {
      const space = await fastify.prisma.space.findUnique({
        where: { id: request.params.id },
        select: { visibility: true, community: { select: { isPublic: true } } },
      });
      if (space && space.community?.isPublic && space.visibility !== 'PRIVATE') {
        hasAccess = true;
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

  // List users not yet members of this space (community members only)
  fastify.get<{ Params: { id: string } }>('/:id/available-users', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return reply.forbidden('Only owners can view available users');
    }

    // Get the space's community
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.id },
      select: { communityId: true },
    });

    const existingMemberIds = await fastify.prisma.spaceMembership.findMany({
      where: { spaceId: request.params.id },
      select: { userId: true },
    });
    const memberIds = existingMemberIds.map(m => m.userId);

    // If space has a community, show community members not in the space
    // Otherwise, show all users not in the space
    let users;
    if (space?.communityId) {
      const communityMembers = await fastify.prisma.communityMembership.findMany({
        where: {
          communityId: space.communityId,
          userId: { notIn: memberIds },
          user: { disabledAt: null },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      });
      users = communityMembers.map(m => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
      }));
    } else {
      users = await fastify.prisma.user.findMany({
        where: { id: { notIn: memberIds }, disabledAt: null },
        select: { id: true, email: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    return users;
  });

  // Add member directly to space
  fastify.post<{ Params: { id: string }; Body: { userId: string; role: string } }>(
    '/:id/members',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const ownerMembership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
      });

      if (!ownerMembership || ownerMembership.role !== 'OWNER') {
        return reply.forbidden('Only owners can add members');
      }

      const { userId, role } = request.body;
      if (!['OWNER', 'MEMBER'].includes(role)) {
        return reply.badRequest('Invalid role');
      }

      // Check user exists
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.notFound('User not found');

      // Check not already member
      const existing = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId: request.params.id } },
      });
      if (existing) return reply.conflict('User is already a member');

      const membership = await fastify.prisma.spaceMembership.create({
        data: {
          userId,
          spaceId: request.params.id,
          role: role as any,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      return {
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        joinedAt: membership.joinedAt,
      };
    },
  );

  // Invite member to space (creates an Invitation, not a direct membership)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof inviteSchema> }>(
    '/:id/invite',
    { preHandler: [fastify.authenticate] },
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

      if (membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      if (membership.space.type === 'PERSONAL') {
        return reply.forbidden('Cannot invite members to personal space');
      }

      const body = inviteSchema.parse(request.body);

      // Check if user is already a member
      const invitedUser = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (invitedUser) {
        const existingMembership = await fastify.prisma.spaceMembership.findUnique({
          where: { userId_spaceId: { userId: invitedUser.id, spaceId: request.params.id } },
        });
        if (existingMembership) {
          return reply.conflict('User is already a member');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await fastify.prisma.invitation.findFirst({
        where: { email: body.email, spaceId: request.params.id, status: 'PENDING' },
      });
      if (existingInvitation) {
        return reply.conflict('An invitation is already pending for this email');
      }

      const invitation = await createInvitationHelper(fastify.prisma, {
        email: body.email,
        role: body.role,
        message: body.message,
        spaceId: request.params.id,
        invitedById: request.user.userId,
      });

      // Notify invited user
      const inviterName = (await fastify.prisma.user.findUnique({ where: { id: request.user.userId }, select: { name: true } }))?.name || 'Quelqu\'un';

      if (invitedUser) {
        await createNotification(fastify.prisma, {
          userId: invitedUser.id,
          type: 'INVITATION',
          title: `${inviterName} vous invite à rejoindre l'espace « ${membership.space.name} »`,
          link: `/invitations`,
          metadata: { actorId: request.user.userId, actorName: inviterName, spaceName: membership.space.name, invitationId: invitation.id },
        });
      }

      // Send invitation email
      await sendInvitationEmail({
        to: body.email,
        inviterName,
        targetName: membership.space.name,
        targetType: 'espace',
        token: invitation.token,
        message: body.message,
        role: body.role,
      });

      return reply.status(201).send(invitation);
    }
  );

  // List pending invitations for a space
  fastify.get<{ Params: { id: string } }>(
    '/:id/invitations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId: request.user.userId, spaceId: request.params.id } },
      });
      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const invitations = await fastify.prisma.invitation.findMany({
        where: { spaceId: request.params.id },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invitations;
    }
  );

  // Remove member from space
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    '/:id/members/:memberId',
    { preHandler: [fastify.authenticate] },
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

      if (membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const memberToRemove = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToRemove || memberToRemove.spaceId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      if (memberToRemove.role === 'OWNER') {
        return reply.forbidden('Cannot remove a space owner');
      }

      await fastify.prisma.spaceMembership.delete({
        where: { id: request.params.memberId },
      });

      return { success: true };
    }
  );

  // Update member role in space
  fastify.patch<{ Params: { id: string; memberId: string }; Body: { role: string } }>(
    '/:id/members/:memberId',
    { preHandler: [fastify.authenticate] },
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

      if (membership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can change member roles');
      }

      const memberToUpdate = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.params.memberId },
      });

      if (!memberToUpdate || memberToUpdate.spaceId !== request.params.id) {
        return reply.notFound('Member not found');
      }

      // If demoting an owner, ensure at least one owner remains
      if (memberToUpdate.role === 'OWNER' && request.body.role !== 'OWNER') {
        const ownerCount = await fastify.prisma.spaceMembership.count({
          where: { spaceId: request.params.id, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return reply.forbidden('Cannot demote the last owner');
        }
      }

      const updated = await fastify.prisma.spaceMembership.update({
        where: { id: request.params.memberId },
        data: { role: request.body.role as any },
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

  // Transfer space ownership
  fastify.post<{ Params: { id: string }; Body: { targetMemberId: string } }>(
    '/:id/transfer-ownership',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const ownership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
      });

      if (!ownership || ownership.role !== 'OWNER') {
        return reply.forbidden('Only the owner can transfer ownership');
      }

      const targetMember = await fastify.prisma.spaceMembership.findUnique({
        where: { id: request.body.targetMemberId },
      });

      if (!targetMember || targetMember.spaceId !== request.params.id) {
        return reply.notFound('Target member not found');
      }

      if (targetMember.userId === request.user.userId) {
        return reply.badRequest('Cannot transfer ownership to yourself');
      }

      // Transaction: demote current owner to MEMBER, promote target to OWNER
      await fastify.prisma.$transaction([
        fastify.prisma.spaceMembership.update({
          where: { id: ownership.id },
          data: { role: 'MEMBER' },
        }),
        fastify.prisma.spaceMembership.update({
          where: { id: targetMember.id },
          data: { role: 'OWNER' },
        }),
      ]);

      return { success: true };
    }
  );

  // Upload space avatar
  fastify.post<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
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
  fastify.delete<{ Params: { id: string } }>('/:id/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || membership.role !== 'OWNER') {
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
  fastify.post<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
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
      if (membership.space.coverUrl?.startsWith('http')) {
        await deleteFileFromR2(membership.space.coverUrl);
      }
      coverUrl = await uploadEntityImage(processed, `spaces/${request.params.id}/cover`);
    } else {
      coverUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    }

    const space = await fastify.prisma.space.update({
      where: { id: request.params.id },
      data: { coverUrl, coverPosition: 50, coverPositionX: 50, coverZoom: 100 },
      select: { coverUrl: true, coverPosition: true, coverPositionX: true, coverZoom: true },
    });

    return { coverUrl: space.coverUrl, coverPosition: space.coverPosition, coverPositionX: space.coverPositionX, coverZoom: space.coverZoom };
  });

  // Delete space cover
  fastify.delete<{ Params: { id: string } }>('/:id/cover', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: {
          userId: request.user.userId,
          spaceId: request.params.id,
        },
      },
      include: { space: true },
    });

    if (!membership || membership.role !== 'OWNER') {
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

  // ==================== Send Email to Members ====================

  const sendEmailSchema = z.object({
    subject: z.string().min(1),
    html: z.string().min(1),
    recipientIds: z.array(z.string()).min(1),
  });

  // POST /spaces/:id/send-email — send email to space members
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof sendEmailSchema> }>(
    '/:id/send-email',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!process.env.RESEND_API_KEY) {
        return reply.serviceUnavailable('Email service is not configured');
      }

      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: {
          userId_spaceId: {
            userId: request.user.userId,
            spaceId: request.params.id,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        return reply.forbidden('Insufficient permissions');
      }

      const body = sendEmailSchema.parse(request.body);

      // Fetch recipients that are members of this space
      const members = await fastify.prisma.spaceMembership.findMany({
        where: {
          spaceId: request.params.id,
          userId: { in: body.recipientIds },
        },
        include: {
          user: { select: { email: true } },
        },
      });

      const emails = members.map((m) => m.user.email);

      if (emails.length === 0) {
        return reply.badRequest('No valid recipients found among space members');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      let sent = 0;
      let failed = 0;

      for (const email of emails) {
        try {
          await resend.emails.send({
            from: 'SPOK <notifications@spok.space>',
            to: email,
            subject: body.subject,
            html: wrapEmailTemplate(body.html),
          });
          sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed };
    }
  );

  // ─── FAVORITES ──────────────────────────────────────────────────

  // List favorite space IDs for the current user
  fastify.get(
    '/favorites',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const favorites = await fastify.prisma.spaceFavorite.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
        orderBy: { createdAt: 'asc' },
      });
      return favorites.map(f => f.spaceId);
    }
  );

  // Add a space to favorites
  fastify.post<{ Params: { id: string } }>(
    '/:id/favorite',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        await fastify.prisma.spaceFavorite.create({
          data: { userId: request.user.userId, spaceId: request.params.id },
        });
      } catch {
        // Already favorited — ignore
      }
      return { success: true };
    }
  );

  // Remove a space from favorites
  fastify.delete<{ Params: { id: string } }>(
    '/:id/favorite',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await fastify.prisma.spaceFavorite.deleteMany({
        where: { userId: request.user.userId, spaceId: request.params.id },
      });
      return { success: true };
    }
  );
};
