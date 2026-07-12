/*
 * GET /user/agenda — la page Ma journée en une passe : événements (feeds ICS + items MEETING
 * des espaces accessibles), plan du jour (DayPlanEntry), suggestions calculées
 * (retard → échéance du jour → in_progress → priorité, plafond 10, moins le plan).
 * from/to = bornes de la journée calculées PAR LE CLIENT dans son fuseau — le serveur
 * ne fait aucune conversion de fuseau. date (YYYY-MM-DD) = clé du plan.
 * Filtres optionnels (mêmes formats multi-valeurs que /user/tasks : spaceId, status,
 * priority, search) — ils restreignent UNIQUEMENT les suggestions, jamais events/plan.
 * Un feed en erreur est signalé (feedErrors + lastError) mais ne bloque jamais la réponse.
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { IcsFeedSource } from '../utils/calendar-source.js'

const SUGGESTION_CAP = 10
const CLOSED_STATUSES = ['done', 'cancelled']

async function accessibleSpaceIds(fastify: FastifyInstance, userId: string): Promise<string[]> {
  const direct = await fastify.prisma.spaceMembership.findMany({ where: { userId }, select: { spaceId: true } })
  const communities = await fastify.prisma.communityMembership.findMany({ where: { userId }, select: { communityId: true } })
  let communitySpaceIds: string[] = []
  if (communities.length > 0) {
    const spaces = await fastify.prisma.space.findMany({
      where: { communityId: { in: communities.map((c) => c.communityId) } },
      select: { id: true },
    })
    communitySpaceIds = spaces.map((s) => s.id)
  }
  return [...new Set([...direct.map((m) => m.spaceId), ...communitySpaceIds])]
}

export const agendaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get<{ Querystring: { date?: string; from?: string; to?: string; spaceId?: string; status?: string; priority?: string; search?: string } }>(
    '/agenda',
    async (request, reply) => {
      const { date, from: fromStr, to: toStr, spaceId: spaceIdFilter, status: statusFilter, priority: priorityFilter, search } = request.query
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ error: 'date=YYYY-MM-DD requis' })
      }
      const from = fromStr ? new Date(fromStr) : new Date(NaN)
      const to = toStr ? new Date(toStr) : new Date(NaN)
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
        return reply.status(400).send({ error: 'from/to ISO requis, from < to' })
      }
      const userId = request.user.userId

      // 1. Événements des feeds ICS actifs — erreurs non bloquantes
      const feeds = await fastify.prisma.calendarFeed.findMany({ where: { userId, enabled: true } })
      type AgendaEventOut = {
        id: string; title: string; start: string; end: string | null; allDay: boolean;
        location?: string;
        source: { kind: 'feed'; feedId: string; name: string; color: string } | { kind: 'spok'; spaceId: string; spaceName: string };
      }
      const events: AgendaEventOut[] = []
      const feedErrors: { feedId: string; name: string }[] = []
      await Promise.all(
        feeds.map(async (feed) => {
          try {
            const feedEvents = await new IcsFeedSource(feed.id, feed.url).fetchEvents(from, to)
            for (const ev of feedEvents) {
              events.push({ ...ev, source: { kind: 'feed', feedId: feed.id, name: feed.name, color: feed.color } })
            }
            await fastify.prisma.calendarFeed.update({
              where: { id: feed.id },
              data: { lastFetchedAt: new Date(), lastError: null },
            })
          } catch (err) {
            feedErrors.push({ feedId: feed.id, name: feed.name })
            await fastify.prisma.calendarFeed
              .update({
                where: { id: feed.id },
                data: { lastError: err instanceof Error ? err.message : 'Erreur inconnue' },
              })
              .catch(() => {}) // jamais bloquant
          }
        })
      )

      const spaceIds = await accessibleSpaceIds(fastify, userId)

      // 2. Items MEETING SPOK chevauchant la fenêtre
      if (spaceIds.length > 0) {
        const meetings = await fastify.prisma.item.findMany({
          where: {
            type: 'MEETING',
            spaceId: { in: spaceIds },
            OR: [
              { startDate: { lt: to }, endDate: { gt: from } },
              { startDate: { gte: from, lt: to }, endDate: null },
              { startDate: null, dueDate: { gte: from, lt: to } },
            ],
          },
          select: {
            id: true, title: true, startDate: true, endDate: true, dueDate: true, spaceId: true,
            space: { select: { id: true, name: true } },
          },
        })
        for (const m of meetings) {
          const start = m.startDate ?? m.dueDate
          if (!start) continue
          events.push({
            id: m.id,
            title: m.title,
            start: start.toISOString(),
            end: m.endDate ? m.endDate.toISOString() : null,
            allDay: false,
            source: { kind: 'spok', spaceId: m.spaceId, spaceName: m.space.name },
          })
        }
      }
      events.sort((a, b) => a.start.localeCompare(b.start))

      // 3. Plan du jour
      const plan = await fastify.prisma.dayPlanEntry.findMany({
        where: { userId, date: new Date(date) },
        include: {
          item: {
            select: {
              id: true, title: true, type: true, status: true, priority: true, dueDate: true,
              spaceId: true, space: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { position: 'asc' },
      })
      const plannedItemIds = new Set(plan.map((p) => p.itemId))

      // 4. Suggestions — mes TASK ouvertes : en retard, du jour, en cours ou prioritaires
      type Candidate = { id: string; dueDate: Date | null; status: string | null; priority: number | null }
      let suggestions: Candidate[] = []
      // Filtres utilisateur (barre de filtre globale) — contraintes ADDITIONNELLES sur les suggestions
      let suggestionSpaceIds = spaceIds
      if (spaceIdFilter) {
        const wanted = new Set(spaceIdFilter.split(',').filter(Boolean))
        suggestionSpaceIds = spaceIds.filter((id) => wanted.has(id))
      }
      const extraAnd: Record<string, unknown>[] = []
      if (statusFilter) {
        const statuses = statusFilter.split(',').filter(Boolean)
        if (statuses.length > 0) extraAnd.push({ status: { in: statuses } })
      }
      if (priorityFilter) {
        const priorities = priorityFilter.split(',').map((p) => parseInt(p, 10)).filter((p) => p >= 1 && p <= 4)
        if (priorities.length > 0) extraAnd.push({ priority: { in: priorities } })
      }
      if (search) {
        extraAnd.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        })
      }
      if (suggestionSpaceIds.length > 0) {
        const candidates = await fastify.prisma.item.findMany({
          where: {
            type: 'TASK',
            spaceId: { in: suggestionSpaceIds },
            AND: [
              { OR: [{ assignedToId: userId }, { assignedToId: null, createdById: userId }] },
              { OR: [{ status: null }, { status: { notIn: CLOSED_STATUSES } }] },
              { OR: [{ dueDate: { lt: to } }, { status: 'in_progress' }, { priority: { gte: 3 } }] },
              ...extraAnd,
            ],
          },
          select: {
            id: true, title: true, status: true, priority: true, dueDate: true,
            spaceId: true, space: { select: { id: true, name: true } },
          },
          take: 100,
        })
        const rank = (c: Candidate): number => {
          if (c.dueDate && c.dueDate < from) return 0 // en retard
          if (c.dueDate && c.dueDate < to) return 1 // échéance du jour
          if (c.status === 'in_progress') return 2 // en cours
          return 3 // priorité haute
        }
        suggestions = (candidates as Candidate[])
          .filter((c) => !plannedItemIds.has(c.id))
          .sort((a, b) => rank(a) - rank(b) || (b.priority ?? 0) - (a.priority ?? 0))
          .slice(0, SUGGESTION_CAP)
      }

      return { events, feedErrors, plan, suggestions }
    }
  )
}
