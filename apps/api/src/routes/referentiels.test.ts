import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { referentielsRoutes } from './referentiels.js'

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'

function mockMembership(role = 'MEMBER') {
  return { id: 'mem-1', userId: USER_ID, spaceId: SPACE_ID, role, joinedAt: new Date() }
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

  // referentiels has its own addHook('preHandler', authenticate)
  await app.register(async (instance) => {
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

  function denyAccess() {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue(null)
  }

  // ─── GET REFERENTIELS ─────────────────────────────────────────

  describe('GET /spaces/:spaceId/referentiels', () => {
    it('should return default referentiels when no custom config', async () => {
      allowAccess()
      prisma.spaceModule.findUnique.mockResolvedValue(null)

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

    it('should return custom referentiels when configured', async () => {
      allowAccess()
      const customConfig = {
        statuses: [{ id: 'custom', label: 'Custom', color: '#000', borderColor: '#111', order: 0, visible: true }],
        typeLabels: {},
      }
      prisma.spaceModule.findUnique.mockResolvedValue({
        id: 'mod-1',
        spaceId: SPACE_ID,
        moduleKey: 'referentiels',
        config: customConfig,
        enabled: true,
      })

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

    it('should return 404 when no access', async () => {
      denyAccess()

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── PUT REFERENTIELS ─────────────────────────────────────────

  describe('PUT /spaces/:spaceId/referentiels', () => {
    it('should update referentiels as OWNER', async () => {
      allowAccess('OWNER')
      prisma.spaceModule.findUnique.mockResolvedValue(null) // no existing
      const upserted = {
        config: {
          statuses: [{ id: 's1', label: 'New', color: '#f00', borderColor: '#f00', order: 0, visible: true }],
          typeLabels: {},
        },
      }
      prisma.spaceModule.upsert.mockResolvedValue(upserted)

      const res = await app.inject({
        method: 'PUT',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          statuses: [{ id: 's1', label: 'New', color: '#f00', borderColor: '#f00', order: 0, visible: true }],
        },
      })

      expect(res.statusCode).toBe(200)
      expect(prisma.spaceModule.upsert).toHaveBeenCalledOnce()
    })

    it('should reject update by VIEWER', async () => {
      allowAccess('VIEWER')

      const res = await app.inject({
        method: 'PUT',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
        payload: { statuses: [] },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject update by MEMBER', async () => {
      allowAccess('MEMBER')

      const res = await app.inject({
        method: 'PUT',
        url: `/spaces/${SPACE_ID}/referentiels`,
        headers: { authorization: `Bearer ${token}` },
        payload: { statuses: [] },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── RESET REFERENTIELS ───────────────────────────────────────

  describe('POST /spaces/:spaceId/referentiels/reset', () => {
    it('should reset to defaults as ADMIN', async () => {
      allowAccess('ADMIN')
      prisma.spaceModule.deleteMany.mockResolvedValue({ count: 1 })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/referentiels/reset`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().isDefault).toBe(true)
    })

    it('should reject reset by VIEWER', async () => {
      allowAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/referentiels/reset`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── CHECK STATUS USAGE ───────────────────────────────────────

  describe('GET /spaces/:spaceId/referentiels/check-status-usage/:statusId', () => {
    it('should return usage count for a status', async () => {
      allowAccess()
      prisma.item.count.mockResolvedValue(5)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels/check-status-usage/in_progress`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.itemCount).toBe(5)
      expect(body.isUsed).toBe(true)
    })

    it('should return 0 for unused status', async () => {
      allowAccess()
      prisma.item.count.mockResolvedValue(0)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/referentiels/check-status-usage/unused`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().isUsed).toBe(false)
    })
  })
})
