import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminReferentielsRoutes } from './referentiels.js'

const ADMIN_ID = 'admin-user-id'

async function buildAdminRefApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  await app.register(fp(async (f) => { f.decorate('prisma', prisma as any) }, { name: 'prisma' }))
  await app.register(jwtPlugin)
  await app.register(adminAuthPlugin)
  await app.register(adminReferentielsRoutes, { prefix: '/admin/referentiels' })

  await app.ready()
  return { app, prisma }
}

describe('Admin Referentiels routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAdminRefApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: ADMIN_ID, email: 'admin@test.com' })
  })

  function allowAdmin() {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  }

  describe('GET /admin/referentiels', () => {
    it('should return defaults and customized spaces', async () => {
      allowAdmin()
      prisma.spaceModule.findMany.mockResolvedValue([{
        id: 'mod-1', moduleKey: 'referentiels', enabled: true,
        config: { statuses: [{ id: 's1' }], typeLabels: { NOTE: 'Custom' } },
        space: { id: 'sp1', name: 'Space 1', type: 'GROUP' },
      }])
      prisma.space.count.mockResolvedValue(10)

      const res = await app.inject({
        method: 'GET', url: '/admin/referentiels',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.defaults).toBeDefined()
      expect(body.customizedSpaces).toHaveLength(1)
      expect(body.totalSpaces).toBe(10)
      expect(body.customizedCount).toBe(1)
    })

    it('should return empty customizations when none exist', async () => {
      allowAdmin()
      prisma.spaceModule.findMany.mockResolvedValue([])
      prisma.space.count.mockResolvedValue(5)

      const res = await app.inject({
        method: 'GET', url: '/admin/referentiels',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().customizedSpaces).toHaveLength(0)
    })

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/referentiels' })
      expect(res.statusCode).toBe(401)
    })
  })
})
