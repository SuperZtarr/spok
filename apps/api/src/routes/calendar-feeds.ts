/*
 * CRUD des abonnements ICS (page Ma journée) — /user/calendar-feeds.
 * Strictement scopé à l'utilisateur courant. L'URL d'un feed est un secret
 * utilisateur : validée http(s), jamais loguée, renvoyée uniquement à son propriétaire.
 */
import { FastifyPluginAsync } from 'fastify'

function isValidFeedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const calendarFeedsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/calendar-feeds', async (request) => {
    return fastify.prisma.calendarFeed.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'asc' },
    })
  })

  fastify.post<{ Body: { name?: string; url?: string; color?: string } }>(
    '/calendar-feeds',
    async (request, reply) => {
      const { name, url, color } = request.body ?? {}
      if (!name?.trim() || !url || !isValidFeedUrl(url)) {
        return reply.status(400).send({ error: 'Nom requis et URL http(s) valide requise' })
      }
      const feed = await fastify.prisma.calendarFeed.create({
        data: { userId: request.user.userId, name: name.trim(), url, color: color || '#3b82f6' },
      })
      return reply.status(201).send(feed)
    }
  )

  fastify.patch<{ Params: { id: string }; Body: { name?: string; url?: string; color?: string; enabled?: boolean } }>(
    '/calendar-feeds/:id',
    async (request, reply) => {
      const existing = await fastify.prisma.calendarFeed.findUnique({ where: { id: request.params.id } })
      if (!existing) return reply.status(404).send({ error: 'Feed introuvable' })
      if (existing.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
      const { name, url, color, enabled } = request.body ?? {}
      if (url !== undefined && !isValidFeedUrl(url)) {
        return reply.status(400).send({ error: 'URL http(s) valide requise' })
      }
      return fastify.prisma.calendarFeed.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(url !== undefined ? { url, lastError: null } : {}),
          ...(color !== undefined ? { color } : {}),
          ...(enabled !== undefined ? { enabled } : {}),
        },
      })
    }
  )

  fastify.delete<{ Params: { id: string } }>('/calendar-feeds/:id', async (request, reply) => {
    const existing = await fastify.prisma.calendarFeed.findUnique({ where: { id: request.params.id } })
    if (!existing) return reply.status(404).send({ error: 'Feed introuvable' })
    if (existing.userId !== request.user.userId) return reply.status(403).send({ error: 'Forbidden' })
    await fastify.prisma.calendarFeed.delete({ where: { id: existing.id } })
    return reply.status(204).send()
  })
}
