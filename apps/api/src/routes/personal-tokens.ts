/*
 * /user/tokens — gestion des jetons personnels (accès MCP distant) de l'utilisateur courant.
 * Création : le jeton en clair n'est renvoyé qu'une fois. Révocation logique (revokedAt).
 * Gestion réservée à une session web (JWT) : un jeton personnel ne peut ni lister ni créer ni
 * révoquer de jetons (403) — sinon un jeton fuité permettrait de s'en créer d'autres.
 */
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generatePersonalToken } from '../utils/personalTokens.js'

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(['read', 'write']),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable().optional(),
})

const PUBLIC_FIELDS = {
  id: true, name: true, tokenPrefix: true, scope: true,
  lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
} as const

export const personalTokensRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.authVia === 'pat') reply.forbidden('Gestion des jetons impossible avec un jeton personnel')
  })

  fastify.get('/tokens', async (request) => {
    return fastify.prisma.personalAccessToken.findMany({
      where: { userId: request.user.userId },
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
    })
  })

  fastify.post('/tokens', async (request, reply) => {
    const parsed = createTokenSchema.safeParse(request.body)
    if (!parsed.success) return reply.badRequest('Nom (1-60 caractères) et portée read|write requis')
    const { name, scope, expiresInDays } = parsed.data
    const { token, tokenHash, tokenPrefix } = generatePersonalToken()
    const row = await fastify.prisma.personalAccessToken.create({
      data: {
        userId: request.user.userId,
        name,
        scope,
        tokenHash,
        tokenPrefix,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000) : null,
      },
    })
    const { tokenHash: _omit, ...publicRow } = row as any
    return reply.status(201).send({ ...publicRow, token })
  })

  fastify.delete<{ Params: { id: string } }>('/tokens/:id', async (request, reply) => {
    const existing = await fastify.prisma.personalAccessToken.findFirst({
      where: { id: request.params.id, userId: request.user.userId },
    })
    if (!existing) return reply.notFound('Jeton introuvable')
    await fastify.prisma.personalAccessToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    })
    return reply.status(204).send()
  })
}
