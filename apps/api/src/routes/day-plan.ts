/*
 * /user/day-plan — l'engagement du jour de la page Ma journée.
 * POST (upsert idempotent : re-poster le même item le même jour ne duplique pas),
 * DELETE, PATCH (position et/ou placement time-blocking : plannedStart ISO ou null
 * pour dé-placer — null efface aussi la durée —, plannedDuration 15–720 min).
 * Scope utilisateur strict ; l'item ajouté doit appartenir à un espace accessible
 * (membership direct ou via communauté). Le placement ne touche JAMAIS les dates de l'item.
 */
import { FastifyPluginAsync } from 'fastify'

export const dayPlanRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post<{ Body: { date?: string; itemId?: string; source?: string; plannedStart?: string; plannedDuration?: number } }>(
    '/day-plan',
    async (request, reply) => {
      const { date, itemId, source, plannedStart, plannedDuration } = request.body ?? {}
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !itemId || !['auto', 'manual'].includes(source ?? '')) {
        return reply.status(400).send({ error: 'date (YYYY-MM-DD), itemId et source (auto|manual) requis' })
      }
      // Placement optionnel dès la création (drop direct d'une suggestion sur la grille)
      let placement: { plannedStart: Date; plannedDuration: number } | undefined
      if (plannedStart !== undefined) {
        const start = new Date(plannedStart)
        const duration = plannedDuration ?? 30
        if (isNaN(start.getTime()) || typeof duration !== 'number' || duration < 15 || duration > 720) {
          return reply.status(400).send({ error: 'plannedStart ISO et plannedDuration 15–720 requis' })
        }
        placement = { plannedStart: start, plannedDuration: duration }
      }
      const userId = request.user.userId

      const item = await fastify.prisma.item.findUnique({ where: { id: itemId }, select: { id: true, spaceId: true } })
      if (!item) return reply.status(404).send({ error: 'Item introuvable' })

      // Accès : membre direct de l'espace, ou membre de la communauté de l'espace
      const membership = await fastify.prisma.spaceMembership.findUnique({
        where: { userId_spaceId: { userId, spaceId: item.spaceId } },
      })
      if (!membership) {
        const space = await fastify.prisma.space.findUnique({ where: { id: item.spaceId }, select: { communityId: true } })
        const communityMembership = space?.communityId
          ? await fastify.prisma.communityMembership.findUnique({
              where: { userId_communityId: { userId, communityId: space.communityId } },
            })
          : null
        if (!communityMembership) return reply.status(403).send({ error: 'Forbidden' })
      }

      const max = await fastify.prisma.dayPlanEntry.aggregate({
        where: { userId, date: new Date(date) },
        _max: { position: true },
      })
      const entry = await fastify.prisma.dayPlanEntry.upsert({
        where: { userId_date_itemId: { userId, date: new Date(date), itemId } },
        create: { userId, date: new Date(date), itemId, source, position: (max._max.position ?? -1) + 1, ...placement },
        update: { ...placement },
      })
      return reply.status(201).send(entry)
    }
  )

  fastify.delete<{ Params: { id: string } }>('/day-plan/:id', async (request, reply) => {
    const entry = await fastify.prisma.dayPlanEntry.findUnique({ where: { id: request.params.id } })
    if (!entry) return reply.status(404).send({ error: 'Entrée introuvable' })
    if (entry.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
    await fastify.prisma.dayPlanEntry.delete({ where: { id: entry.id } })
    return reply.status(204).send()
  })

  fastify.patch<{ Params: { id: string }; Body: { position?: number; plannedStart?: string | null; plannedDuration?: number } }>(
    '/day-plan/:id',
    async (request, reply) => {
      const { position, plannedStart, plannedDuration } = request.body ?? {}
      const data: Record<string, unknown> = {}

      if (position !== undefined) {
        if (typeof position !== 'number' || position < 0) {
          return reply.status(400).send({ error: 'position >= 0 requise' })
        }
        data.position = position
      }
      if (plannedStart !== undefined) {
        if (plannedStart === null) {
          data.plannedStart = null
          data.plannedDuration = null
        } else {
          const start = new Date(plannedStart)
          if (isNaN(start.getTime())) return reply.status(400).send({ error: 'plannedStart ISO ou null requis' })
          data.plannedStart = start
        }
      }
      if (plannedDuration !== undefined && data.plannedDuration !== null) {
        if (typeof plannedDuration !== 'number' || plannedDuration < 15 || plannedDuration > 720) {
          return reply.status(400).send({ error: 'plannedDuration entre 15 et 720 minutes' })
        }
        data.plannedDuration = plannedDuration
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Aucun champ à modifier' })
      }

      const entry = await fastify.prisma.dayPlanEntry.findUnique({ where: { id: request.params.id } })
      if (!entry) return reply.status(404).send({ error: 'Entrée introuvable' })
      if (entry.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
      return fastify.prisma.dayPlanEntry.update({ where: { id: entry.id }, data })
    }
  )
}
