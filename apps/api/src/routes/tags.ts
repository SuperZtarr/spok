import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

export const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to check space access
  async function checkSpaceAccess(userId: string, spaceId: string) {
    return fastify.prisma.spaceMembership.findUnique({
      where: {
        userId_spaceId: { userId, spaceId },
      },
    });
  }

  // List tags
  fastify.get<{ Params: { spaceId: string } }>('/', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    const tags = await fastify.prisma.tag.findMany({
      where: { spaceId: request.params.spaceId },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag: any) => ({
      ...tag,
      itemCount: tag._count.items,
    }));
  });

  // Create tag
  fastify.post<{ Params: { spaceId: string }; Body: z.infer<typeof createTagSchema> }>(
    '/',
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
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
    async (request, reply) => {
      const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
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
  fastify.delete<{ Params: { spaceId: string; id: string } }>('/:id', async (request, reply) => {
    const membership = await checkSpaceAccess(request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.forbidden('Only owners and admins can delete tags');
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
