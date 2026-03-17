import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

export const tagsRoutes: FastifyPluginAsync = async (fastify) => {

  // List tags
  fastify.get<{ Params: { spaceId: string } }>('/', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    // Get the space's communityId to include community-level tags
    const space = await fastify.prisma.space.findUnique({
      where: { id: request.params.spaceId },
      select: { communityId: true },
    });

    const tags = await fastify.prisma.tag.findMany({
      where: {
        OR: [
          { spaceId: request.params.spaceId },
          ...(space?.communityId ? [{ communityId: space.communityId }] : []),
        ],
      },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag) => ({
      ...tag,
      itemCount: tag._count.items,
      isCommunityTag: !!tag.communityId,
    }));
  });

  // Create tag
  fastify.post<{ Params: { spaceId: string }; Body: z.infer<typeof createTagSchema> }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot create tags');
      }

      const body = createTagSchema.parse(request.body);

      // Check if tag name already exists in space
      const existing = await fastify.prisma.tag.findUnique({
        where: {
          spaceId_name: {
            spaceId: request.params.spaceId,
            name: body.name,
          },
        },
      });

      if (existing) {
        return reply.conflict('Tag with this name already exists');
      }

      const tag = await fastify.prisma.tag.create({
        data: {
          name: body.name,
          color: body.color,
          spaceId: request.params.spaceId,
        },
      });

      return reply.status(201).send(tag);
    }
  );

  // Update tag
  fastify.patch<{ Params: { spaceId: string; id: string }; Body: z.infer<typeof updateTagSchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot update tags');
      }

      const tag = await fastify.prisma.tag.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!tag) {
        return reply.notFound('Tag not found');
      }

      const body = updateTagSchema.parse(request.body);

      // Check name uniqueness if changing name
      if (body.name && body.name !== tag.name) {
        const existing = await fastify.prisma.tag.findUnique({
          where: {
            spaceId_name: {
              spaceId: request.params.spaceId,
              name: body.name,
            },
          },
        });

        if (existing) {
          return reply.conflict('Tag with this name already exists');
        }
      }

      const updated = await fastify.prisma.tag.update({
        where: { id: request.params.id },
        data: body,
      });

      return updated;
    }
  );

  // Delete tag
  fastify.delete<{ Params: { spaceId: string; id: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Only owners can delete tags');
    }

    const tag = await fastify.prisma.tag.findFirst({
      where: {
        id: request.params.id,
        spaceId: request.params.spaceId,
      },
    });

    if (!tag) {
      return reply.notFound('Tag not found');
    }

    await fastify.prisma.tag.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });
};
