import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog } from '../utils/audit.js';
import { createNotification } from '../utils/notifications.js';
import { notifyMentionedUsers } from '../utils/mentions.js';
import { checkSpaceAccess } from './items.js';

const createContributionSchema = z.object({
  content: z.string().min(1),
});

const updateContributionSchema = z.object({
  content: z.string().min(1),
});

export const itemContributionRoutes: FastifyPluginAsync = async (fastify) => {
  // List contributions for an item
  fastify.get<{ Params: { spaceId: string; id: string } }>(
    '/:id/contributions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const item = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!item) {
        return reply.notFound('Item not found');
      }

      const contributions = await fastify.prisma.contribution.findMany({
        where: { itemId: request.params.id },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return contributions;
    }
  );

  // Create a contribution
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof createContributionSchema>;
  }>('/:id/contributions', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role === 'VIEWER') {
      return reply.forbidden('Viewers cannot create contributions');
    }

    const item = await fastify.prisma.item.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
    });

    if (!item) {
      return reply.notFound('Item not found');
    }

    const body = createContributionSchema.parse(request.body);

    const contribution = await fastify.prisma.contribution.create({
      data: {
        content: body.content,
        itemId: request.params.id,
        authorId: request.user.userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(fastify.prisma, {
      action: 'CREATE',
      entity: 'Contribution',
      entityId: contribution.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        after: { content: contribution.content, itemId: contribution.itemId },
      },
    });

    // Notify item creator and assignee (except the contribution author)
    const authorName = contribution.author.name;
    const notifyIds = new Set<string>();
    if (item.createdById !== request.user.userId) notifyIds.add(item.createdById);
    if (item.assignedToId && item.assignedToId !== request.user.userId) notifyIds.add(item.assignedToId);
    for (const targetUserId of notifyIds) {
      await createNotification(fastify.prisma, {
        userId: targetUserId,
        type: 'CONTRIBUTION',
        title: `${authorName} a commenté « ${item.title} »`,
        link: `/spaces/${request.params.spaceId}`,
        metadata: { actorId: request.user.userId, actorName: authorName, itemId: item.id, itemTitle: item.title },
      });
    }

    // Notify @mentioned users
    await notifyMentionedUsers(fastify.prisma, body.content, request.user.userId, authorName, item.id, item.title, request.params.spaceId);

    return reply.status(201).send(contribution);
  });

  // Update a contribution
  fastify.patch<{
    Params: { spaceId: string; id: string; contributionId: string };
    Body: z.infer<typeof updateContributionSchema>;
  }>('/:id/contributions/:contributionId', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const contribution = await fastify.prisma.contribution.findFirst({
      where: {
        id: request.params.contributionId,
        itemId: request.params.id,
      },
    });

    if (!contribution) {
      return reply.notFound('Contribution not found');
    }

    // Only author, space admins, or owners can update
    const canUpdate =
      contribution.authorId === request.user.userId ||
      ['OWNER', 'ADMIN'].includes(membership.role);

    if (!canUpdate) {
      return reply.forbidden('You cannot update this contribution');
    }

    const body = updateContributionSchema.parse(request.body);
    const beforeContent = contribution.content;

    const updated = await fastify.prisma.contribution.update({
      where: { id: request.params.contributionId },
      data: { content: body.content },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(fastify.prisma, {
      action: 'UPDATE',
      entity: 'Contribution',
      entityId: updated.id,
      userId: request.user.userId,
      spaceId: request.params.spaceId,
      changes: {
        before: { content: beforeContent },
        after: { content: updated.content },
      },
    });

    return updated;
  });

  // Delete a contribution
  fastify.delete<{ Params: { spaceId: string; id: string; contributionId: string } }>(
    '/:id/contributions/:contributionId',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const contribution = await fastify.prisma.contribution.findFirst({
        where: {
          id: request.params.contributionId,
          itemId: request.params.id,
        },
      });

      if (!contribution) {
        return reply.notFound('Contribution not found');
      }

      // Only author, space admins, or owners can delete
      const canDelete =
        contribution.authorId === request.user.userId ||
        ['OWNER', 'ADMIN'].includes(membership.role);

      if (!canDelete) {
        return reply.forbidden('You cannot delete this contribution');
      }

      await fastify.prisma.contribution.delete({
        where: { id: request.params.contributionId },
      });

      // Audit log
      await createAuditLog(fastify.prisma, {
        action: 'DELETE',
        entity: 'Contribution',
        entityId: contribution.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: {
          before: { content: contribution.content, itemId: contribution.itemId },
        },
      });

      return { success: true };
    }
  );
};
