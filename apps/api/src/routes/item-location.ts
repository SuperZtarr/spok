/*
 * GET /items/:id/location — espace d'un élément, connu par son seul identifiant (règle item-share-link, 2026-11-18).
 * Sert le lien court « Copier le lien » de la fiche (https://…/items/<id>) : la page web /items/:itemId demande ici
 * l'espace puis redirige vers l'élément dans son espace (la communauté se retrouve ensuite depuis l'espace).
 * Accès : mêmes règles que la lecture d'un élément (checkSpaceAccess : membre, communauté, espace public, visiteur
 * anonyme compris, mode admin). Élément absent OU espace illisible → 404 identique : la route ne dévoile jamais
 * l'existence d'un élément à qui ne peut pas le lire. Ne renvoie que spaceId, rien du contenu.
 * Enregistrée avec optionalAuthenticate (index.ts, prefix /items).
 */
import { FastifyPluginAsync } from 'fastify';
import { checkSpaceAccess } from './items.js';

export const itemLocationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/:id/location', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const item = await fastify.prisma.item.findUnique({ where: { id: request.params.id }, select: { spaceId: true } });
    if (!item) return reply.notFound('Item not found');
    const access = await checkSpaceAccess(fastify.prisma, request.user?.userId, item.spaceId, request.isAdminMode);
    if (!access) return reply.notFound('Item not found');
    return { spaceId: item.spaceId };
  });
};
