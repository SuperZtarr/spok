/* Tags utilisables dans un espace (portée : utils/tagScope.ts — globaux, communauté de l'espace, tags de l'espace et
 * de ses ancêtres ; tags d'espace rétablis le 2026-11-12, décision Thomas).
 * - GET : tags visibles ; chaque tag porte scope ('global' | 'community' | 'space'), isGlobalTag / isCommunityTag,
 *   spaceName et inherited (tag d'un espace parent) pour un tag d'espace, et itemCount.
 * - POST (membres, pas les lecteurs) : crée un TAG DE L'ESPACE (proposé aussi dans ses sous-espaces) ; nom unique sans
 *   casse parmi les tags visibles (409). Tags de communauté : /communities/:id/tags ; globaux : /admin/tags.
 * - PATCH / DELETE : tag d'espace → propriétaire de l'espace du tag (propriétaire de communauté et admin en mode admin
 *   compris, via checkSpaceAccess) ; tag de communauté → propriétaire de la communauté ou admin en mode admin ; tag
 *   global → admin en mode admin.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkSpaceAccess } from './items.js';
import { isAdminModeActive, isOwnerOrAdmin } from './communities.js';
import { findTagByName, isGlobalTag, spaceTagScope, tagScopeKind, tagsVisibleWhere } from '../utils/tagScope.js';

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

    const scope = await spaceTagScope(fastify.prisma, request.params.spaceId);
    const tags = await fastify.prisma.tag.findMany({
      where: tagsVisibleWhere(scope),
      include: { _count: { select: { items: true } }, space: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return tags.map(({ _count, space, ...tag }) => ({
      ...tag,
      itemCount: _count.items,
      scope: tagScopeKind(tag),
      isCommunityTag: !!tag.communityId,
      isGlobalTag: isGlobalTag(tag),
      spaceName: space?.name ?? null,
      inherited: !!tag.spaceId && tag.spaceId !== request.params.spaceId,
    }));
  });

  // Create tag (tag de l'espace)
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

      const scope = await spaceTagScope(fastify.prisma, request.params.spaceId);
      if (await findTagByName(fastify.prisma, scope, name)) {
        return reply.conflict('Tag with this name already exists');
      }

      const tag = await fastify.prisma.tag.create({
        data: { name, color: body.color, spaceId: request.params.spaceId },
      });

      return reply.status(201).send(tag);
    }
  );

  /** Tag visible depuis l'espace et droit de le gérer (espace : OWNER de son espace ; communauté : OWNER ; global : admin) */
  async function manageableTag(spaceId: string, tagId: string, userId: string, isAdminMode: boolean) {
    const scope = await spaceTagScope(fastify.prisma, spaceId);
    const tag = await fastify.prisma.tag.findFirst({ where: { id: tagId, ...tagsVisibleWhere(scope) } });
    if (!tag) return { tag: null, allowed: false };
    let allowed: boolean;
    if (tag.spaceId) {
      const access = await checkSpaceAccess(fastify.prisma, userId, tag.spaceId, isAdminMode);
      allowed = access?.role === 'OWNER';
    } else if (tag.communityId) {
      allowed = await isOwnerOrAdmin(fastify.prisma, tag.communityId, userId, isAdminMode);
    } else {
      allowed = await isAdminModeActive(fastify.prisma, userId, isAdminMode);
    }
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
      if (!allowed) return reply.forbidden('Only the owner of the tag scope (space, community) or an admin can update this tag');

      const body = updateTagSchema.parse(request.body);
      const name = body.name?.trim();

      if (name && name.toLowerCase() !== tag.name.toLowerCase()) {
        // Nom unique parmi les tags visibles depuis la portée du tag lui-même
        const tagScope = tag.spaceId
          ? await spaceTagScope(fastify.prisma, tag.spaceId)
          : { communityId: tag.communityId, spaceIds: [] };
        const existing = await findTagByName(fastify.prisma, tagScope, name);
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
    if (!allowed) return reply.forbidden('Only the owner of the tag scope (space, community) or an admin can delete this tag');

    await fastify.prisma.tag.delete({ where: { id: tag.id } });

    return { success: true };
  });
};
