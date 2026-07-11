/*
 * Tests de la route GET /spaces/:spaceId/referentiels.
 * Depuis la centralisation des référentiels au niveau communauté, cette route est en lecture
 * seule : elle résout les référentiels de la communauté parente ou renvoie les défauts.
 * L'édition se fait via /communities/:communityId/referentiels (community-referentiels.ts).
 * La route s'appuie sur optionalAuthenticate posé par le parent (comme spaces.ts) — reproduit ici.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { referentielsRoutes } from './referentiels.js'

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'
const COM_ID = 'com-1'

function mockMembership(role = 'MEMBER') {
  return { id: 'mem-1', userId: USER_ID, spaceId: SPACE_ID, role, joinedAt: new Date() }
}

const customReferentiels = {
  statuses: [{ id: 'custom', label: 'Custom', color: '#000', borderColor: '#111', order: 0, visible: true }],
  typeLabels: {},
}

async function buildRefApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400, error: 'Validation Error',
        message: `Données invalides: ${details[0]}`, details, code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)

  // Comme spaces.ts : optionalAuthenticate posé par le parent
  await app.register(async (instance) => {
    instance.addHook('preHandler', instance.optionalAuthenticate)
    await instance.register(referentielsRoutes, { prefix: '/:spaceId/referentiels' })
  }, { prefix: '/spaces' })

  await app.ready()
  return { app, prisma }
}

describe('Referentiels routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildRefApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app)
  })

  function allowAccess(role = 'MEMBER') {
    prisma.spaceMembership.findUnique.mockResolvedValue(mockMembership(role))
  }

  describe('GET /spaces/:spaceId/referentiels', () => {
    it('should return default referentiels when space has no community', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: null })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.isDefault).toBe(true)
      expect(body.referentiels).toBeDefined()
      expect(body.referentiels.statuses).toBeDefined()
    })

    it('should return community referentiels when configured', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: COM_ID })
      prisma.community.findUnique.mockResolvedValue({ referentiels: customReferentiels })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.isDefault).toBe(false)
      expect(body.referentiels.statuses[0].id).toBe('custom')
    })

    it('should fall back to defaults when community referentiels are invalid', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: COM_ID })
      prisma.community.findUnique.mockResolvedValue({ referentiels: null })

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().isDefault).toBe(true)
    })

    it('should return 404 when no access', async () => {
      // Pas de membership, pas admin, espace inconnu → checkSpaceAccess null
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.space.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
