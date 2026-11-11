/* Tags utilisables dans un espace (portée : utils/tagScope.ts — tags de sa communauté + tags globaux, plus de tag
 * d'espace depuis 2026-11-11, décision Thomas).
 * - GET : tags de la communauté de l'espace + globaux (espace sans communauté : globaux seulement) ; chaque tag porte
 *   isCommunityTag / isGlobalTag et itemCount.
 * - POST (membres, pas les lecteurs) : crée le tag dans la communauté de l'espace ; nom unique sans casse parmi les
 *   tags de la communauté et les globaux (409). Espace sans communauté : 400 (seuls les tags globaux, créés par un
 *   admin dans /admin/tags, y sont utilisables).
 * - PATCH / DELETE : tag de la communauté → propriétaire de la communauté ou admin en mode admin ; tag global → admin
 *   en mode admin. Même garde que /communities/:id/tags et /admin/tags.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';
import { isAdminModeActive, isOwnerOrAdmin } from './communities.js';
import { findTagByName, isGlobalTag, spaceCommunityId, tagsVisibleWhere } from '../utils/tagScope.js';

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

    const communityId = await spaceCommunityId(fastify.prisma, request.params.spaceId);
    const tags = await fastify.prisma.tag.findMany({
      where: tagsVisibleWhere(communityId),
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });

    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      itemCount: _count.items,
      isCommunityTag: !!tag.communityId,
      isGlobalTag: isGlobalTag(tag),
    }));
  });

  // Create tag (dans la communauté de l'espace)
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

      const communityId = await spaceCommunityId(fastify.prisma, request.params.spaceId);
      if (!communityId) {
        return reply.badRequest('Espace sans communauté : seuls les tags globaux y sont utilisables');
      }

      if (await findTagByName(fastify.prisma, communityId, name)) {
        return reply.conflict('Tag with this name already exists');
      }

      const tag = await fastify.prisma.tag.create({
        data: { name, color: body.color, communityId },
      });

      return reply.status(201).send(tag);
    }
  );

  /** Tag visible depuis l'espace et droit de le gérer (communauté : OWNER ; global : admin en mode admin) */
  async function manageableTag(spaceId: string, tagId: string, userId: string, isAdminMode: boolean) {
    const communityId = await spaceCommunityId(fastify.prisma, spaceId);
    const tag = await fastify.prisma.tag.findFirst({ where: { id: tagId, ...tagsVisibleWhere(communityId) } });
    if (!tag) return { tag: null, allowed: false };
    const allowed = tag.communityId
      ? await isOwnerOrAdmin(fastify.prisma, tag.communityId, userId, isAdminMode)
      : await isAdminModeActive(fastify.prisma, userId, isAdminMode);
    return { tag, allowed };
  }

  // Update tag
  fastify.patch<{ Params: { spaceId: string; id: string }; Body: z.infer<typeof updateTagSchema> }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      const { tag, allowed } = await manageableTag(request.params.spaceId, request.params.id, request.user.userId, request.isAdminMode);
      if (!tag) return reply.notFound('Tag not found');
      if (!allowed) return reply.forbidden('Only community owners (or admins for global tags) can update this tag');

      const body = updateTagSchema.parse(request.body);
      const name = body.name?.trim();

      if (name && name.toLowerCase() !== tag.name.toLowerCase()) {
        const existing = await findTagByName(fastify.prisma, tag.communityId, name);
        if (existing && existing.id !== tag.id) {
          return reply.conflict('Tag with this name already exists');
        }
      }

      const updated = await fastify.prisma.tag.update({
        where: { id: tag.id },
        data: { ...(name && { name }), ...(body.color !== undefined && { color: body.color }) },
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

    const { tag, allowed } = await manageableTag(request.params.spaceId, request.params.id, request.user.userId, request.isAdminMode);
    if (!tag) return reply.notFound('Tag not found');
    if (!allowed) return reply.forbidden('Only community owners (or admins for global tags) can delete this tag');

    await fastify.prisma.tag.delete({ where: { id: tag.id } });

    return { success: true };
  });
};
