/*
 * Routes /community-groups : groupes personnels de communautés (2026-11-27).
 * Chaque utilisateur range les communautés qu'il voit dans ses propres groupes nommés, pour filtrer la sidebar et
 * la liste des communautés quand elles sont trop nombreuses. Données propres à l'utilisateur connecté : aucune route
 * ne lit ni ne modifie les groupes d'un autre, et les groupes n'ont aucun effet sur les droits.
 * - GET    /            : ses groupes (ordre manuel, puis création) avec les ids des communautés rangées
 * - POST   /            : { name } — crée un groupe en dernière position
 * - PATCH  /:id         : { name } — renomme
 * - PUT    /order       : { ids } — réordonne (ids de ses groupes, dans l'ordre voulu)
 * - DELETE /:id         : supprime le groupe ; ses rangements partent en cascade, aucune communauté n'est supprimée
 * - PUT    /assign      : { communityId, groupId|null } — range la communauté (une seule par utilisateur) ou l'en retire
 * Rangement autorisé pour une communauté visible : membre, invitation en attente, non privée, ou admin en mode admin.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isAdminModeActive } from './communities.js';

const nameSchema = z.object({ name: z.string().trim().min(1).max(60) });
const orderSchema = z.object({ ids: z.array(z.string().min(1)).max(200) });
const assignSchema = z.object({ communityId: z.string().min(1), groupId: z.string().min(1).nullable() });

export const communityGroupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /** Groupe appartenant à l'utilisateur, sinon null (404 côté appelant : on ne révèle pas les groupes des autres). */
  async function findOwnGroup(id: string, userId: string) {
    const group = await fastify.prisma.communityGroup.findUnique({ where: { id } });
    return group && group.userId === userId ? group : null;
  }

  fastify.get('/', async (request, reply) => {
    const groups = await fastify.prisma.communityGroup.findMany({
      where: { userId: request.user.userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { assignments: { select: { communityId: true } } },
    });
    return reply.send(groups.map((g) => ({
      id: g.id,
      name: g.name,
      order: g.order,
      communityIds: g.assignments.map((a) => a.communityId),
    })));
  });

  fastify.post('/', async (request, reply) => {
    const { name } = nameSchema.parse(request.body);
    const userId = request.user.userId;
    const last = await fastify.prisma.communityGroup.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const group = await fastify.prisma.communityGroup.create({
      data: { userId, name, order: (last?.order ?? -1) + 1 },
    });
    return reply.status(201).send({ id: group.id, name: group.name, order: group.order, communityIds: [] });
  });

  fastify.put('/order', async (request, reply) => {
    const { ids } = orderSchema.parse(request.body);
    const userId = request.user.userId;
    const own = await fastify.prisma.communityGroup.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
    if (own.length !== new Set(ids).size) return reply.notFound('Group not found');
    await fastify.prisma.$transaction(
      ids.map((id, index) => fastify.prisma.communityGroup.update({ where: { id }, data: { order: index } })),
    );
    return reply.send({ success: true });
  });

  fastify.put('/assign', async (request, reply) => {
    const { communityId, groupId } = assignSchema.parse(request.body);
    const userId = request.user.userId;

    if (groupId === null) {
      await fastify.prisma.communityGroupAssignment.deleteMany({ where: { userId, communityId } });
      return reply.send({ success: true });
    }

    if (!(await findOwnGroup(groupId, userId))) return reply.notFound('Group not found');

    const community = await fastify.prisma.community.findUnique({ where: { id: communityId }, select: { visibility: true } });
    if (!community) return reply.notFound('Community not found');
    if (community.visibility === 'PRIVATE') {
      const membership = await fastify.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId, communityId } },
        select: { id: true },
      });
      let visible = !!membership;
      if (!visible) {
        const user = await fastify.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        const invitation = user && await fastify.prisma.invitation.findFirst({
          where: { email: user.email, status: 'PENDING', communityId },
          select: { id: true },
        });
        visible = !!invitation || await isAdminModeActive(fastify.prisma, userId, request.isAdminMode);
      }
      if (!visible) return reply.notFound('Community not found');
    }

    await fastify.prisma.communityGroupAssignment.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId, groupId },
      update: { groupId },
    });
    return reply.send({ success: true });
  });

  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { name } = nameSchema.parse(request.body);
    if (!(await findOwnGroup(request.params.id, request.user.userId))) return reply.notFound('Group not found');
    const group = await fastify.prisma.communityGroup.update({ where: { id: request.params.id }, data: { name } });
    return reply.send({ id: group.id, name: group.name, order: group.order });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!(await findOwnGroup(request.params.id, request.user.userId))) return reply.notFound('Group not found');
    await fastify.prisma.communityGroup.delete({ where: { id: request.params.id } });
    return reply.send({ success: true });
  });
};
