/* Tags d'un espace : liste (tags de l'espace + de sa communauté), création, modification et suppression.
 * Création (2026-11-11) : dans la communauté de l'espace s'il en a une (tags partagés, comme utils/classificationTag.ts),
 * sinon dans l'espace ; nom unique sans casse dans l'espace et sa communauté. Modification / suppression : tags propres
 * à l'espace seulement — les tags de communauté se gèrent par /communities/:id/tags (OWNER/ADMIN). */
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
    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, request.params.spaceId, request.isAdminMode);
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
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot create tags');
      }

      const body = createTagSchema.parse(request.body);
      const name = body.name.trim();
      if (!name) return reply.badRequest('Tag name is required');

      // Espace d'une communauté : le tag est créé dans la communauté (partagé par tous ses espaces, même règle que
      // ensureTag) ; sinon dans l'espace. Doublon (sans casse) refusé dans l'espace comme dans sa communauté.
      const space = await fastify.prisma.space.findUnique({
        where: { id: request.params.spaceId },
        select: { communityId: true },
      });
      const communityId = space?.communityId ?? null;

      const existing = await fastify.prisma.tag.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          OR: [{ spaceId: request.params.spaceId }, ...(communityId ? [{ communityId }] : [])],
        },
        select: { id: true },
      });

      if (existing) {
        return reply.conflict('Tag with this name already exists');
      }

      const tag = await fastify.prisma.tag.create({
        data: {
          name,
          color: body.color,
          ...(communityId ? { communityId } : { spaceId: request.params.spaceId }),
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
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
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
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
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
