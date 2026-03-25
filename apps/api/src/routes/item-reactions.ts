import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';

const reactionSchema = z.object({
  reactionType: z.string().min(1).max(50),
  content: z.string().optional(),
});

/** Compute reaction summary for an item or contribution */
async function getReactionSummary(
  prisma: any,
  userId: string,
  filter: { itemId?: string; contributionId?: string }
) {
  const reactions = await prisma.reaction.findMany({
    where: filter,
    select: { reactionType: true, userId: true },
  });

  const counts = new Map<string, { count: number; userReacted: boolean }>();
  for (const r of reactions) {
    const entry = counts.get(r.reactionType) || { count: 0, userReacted: false };
    entry.count++;
    if (r.userId === userId) entry.userReacted = true;
    counts.set(r.reactionType, entry);
  }

  return Array.from(counts.entries()).map(([type, { count, userReacted }]) => ({
    type,
    count,
    userReacted,
  }));
}

export const itemReactionRoutes: FastifyPluginAsync = async (fastify) => {
  // React to an item (create or replace)
  fastify.post<{ Params: { spaceId: string; id: string }; Body: { reactionType: string } }>(
    '/:id/reactions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) return reply.notFound('Space not found');

      const body = reactionSchema.parse(request.body);

      // Upsert: delete existing reaction for this user+item, then create new
      await fastify.prisma.reaction.deleteMany({
        where: {
          userId: request.user.userId,
          itemId: request.params.id,
        },
      });

      const reaction = await fastify.prisma.reaction.create({
        data: {
          reactionType: body.reactionType,
          userId: request.user.userId,
          itemId: request.params.id,
        },
      });

      // Create linked contribution if content provided
      let contribution = null;
      if (body.content && body.content.trim()) {
        contribution = await fastify.prisma.contribution.create({
          data: {
            content: body.content.trim(),
            reactionType: body.reactionType,
            itemId: request.params.id,
            authorId: request.user.userId,
          },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        });
      }

      const summary = await getReactionSummary(fastify.prisma, request.user.userId, { itemId: request.params.id });

      return { reaction, summary, contribution };
    }
  );

  // Remove reaction from an item
  fastify.delete<{ Params: { spaceId: string; id: string } }>(
    '/:id/reactions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) return reply.notFound('Space not found');

      await fastify.prisma.reaction.deleteMany({
        where: {
          userId: request.user.userId,
          itemId: request.params.id,
        },
      });

      const summary = await getReactionSummary(fastify.prisma, request.user.userId, { itemId: request.params.id });

      return { summary };
    }
  );

  // React to a contribution
  fastify.post<{ Params: { spaceId: string; id: string; contributionId: string }; Body: { reactionType: string; content?: string } }>(
    '/:id/contributions/:contributionId/reactions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) return reply.notFound('Space not found');

      const body = reactionSchema.parse(request.body);

      await fastify.prisma.reaction.deleteMany({
        where: {
          userId: request.user.userId,
          contributionId: request.params.contributionId,
        },
      });

      const reaction = await fastify.prisma.reaction.create({
        data: {
          reactionType: body.reactionType,
          userId: request.user.userId,
          contributionId: request.params.contributionId,
        },
      });

      // Create linked contribution if content provided
      let contribution = null;
      if (body.content && body.content.trim()) {
        contribution = await fastify.prisma.contribution.create({
          data: {
            content: body.content.trim(),
            reactionType: body.reactionType,
            itemId: request.params.id,
            authorId: request.user.userId,
            parentId: request.params.contributionId,
          },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        });
      }

      const summary = await getReactionSummary(fastify.prisma, request.user.userId, { contributionId: request.params.contributionId });

      return { reaction, summary, contribution };
    }
  );

  // Remove reaction from a contribution
  fastify.delete<{ Params: { spaceId: string; id: string; contributionId: string } }>(
    '/:id/contributions/:contributionId/reactions',
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) return reply.notFound('Space not found');

      await fastify.prisma.reaction.deleteMany({
        where: {
          userId: request.user.userId,
          contributionId: request.params.contributionId,
        },
      });

      const summary = await getReactionSummary(fastify.prisma, request.user.userId, { contributionId: request.params.contributionId });

      return { summary };
    }
  );
};

export { getReactionSummary };
