/*
 * GET /user/review-queue : items à faire remonter dans la section « À réviser » de /today
 * (spec 2026-07-19-horizons-revue-design) — deux groupes distincts, jamais fusionnés :
 * - toTriage : sans échéance ni horizon assigné (bac à trier), les plus anciens en premier
 * - overdue : horizon manuel assigné mais grâce dépassée (isOverdueForReview) — jamais LATER
 * Périmètre : mêmes espaces accessibles que /user/agenda et /user/tasks.
 */
import { FastifyPluginAsync } from 'fastify'
import { isOverdueForReview } from '@spok/shared'
import { accessibleSpaceIds } from './agenda.js'

const CLOSED_STATUSES = ['done', 'cancelled']

export const reviewQueueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/review-queue', async (request) => {
    const spaceIds = await accessibleSpaceIds(fastify, request.user.userId)
    if (spaceIds.length === 0) {
      return { toTriage: [], overdue: [] }
    }

    const items = await fastify.prisma.item.findMany({
      where: {
        spaceId: { in: spaceIds },
        dueDate: null,
        status: { notIn: CLOSED_STATUSES },
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
