/*
 * GET /user/review-queue : items à faire remonter dans la section « À réviser » de /today
 * (spec 2026-07-19-horizons-revue-design) — deux groupes distincts, jamais fusionnés :
 * - toTriage : sans échéance ni horizon assigné (bac à trier), les plus anciens en premier
 * - overdue : horizon manuel assigné mais grâce dépassée (isOverdueForReview) — jamais LATER
 * Périmètre : mêmes espaces LISIBLES que /user/agenda et /user/tasks (readableSpaceIdsForUser — jamais un
 * espace privé de la communauté dont on n'est pas membre).
 * Éléments fermés exclus par catégorie de statut (terminé / annulé, statuts des communautés) — jamais de liste en dur.
 */
import { FastifyPluginAsync } from 'fastify'
import { CLOSED_CATEGORIES, isOverdueForReview, statusIdsIn } from '@spok/shared'
import { statusesOfSpaces } from '../utils/referentiels.js'
import { accessibleSpaceIds } from './agenda.js'


export const reviewQueueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/review-queue', async (request) => {
    const spaceIds = await accessibleSpaceIds(fastify, request.user.userId, request.isAdminMode)
    if (spaceIds.length === 0) {
      return { toTriage: [], overdue: [] }
    }

    const items = await fastify.prisma.item.findMany({
      where: {
        spaceId: { in: spaceIds },
        dueDate: null,
        status: { notIn: statusIdsIn(CLOSED_CATEGORIES, await statusesOfSpaces(fastify.prisma, spaceIds)) },
      },
      select: {
        id: true, title: true, type: true, status: true, priority: true,
        manualHorizon: true, horizonSetAt: true, createdAt: true,
        spaceId: true, space: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const toTriage = items.filter((i) => !i.manualHorizon)
    const overdue = items.filter((i) => i.manualHorizon && isOverdueForReview(i))

    return { toTriage, overdue }
  })
}
