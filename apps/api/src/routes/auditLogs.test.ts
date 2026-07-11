/* TNR du journal d'audit d'espace : accès par rôle, filtres, pagination. */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { auditLogsRoutes } from './auditLogs.js'

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'

function mockMembership(role = 'MEMBER') {
  return { id: 'mem-1', userId: USER_ID, spaceId: SPACE_ID, role, joinedAt: new Date() }
}

function mockAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    action: 'UPDATE',
    entity: 'Item',
    entityId: 'item-1',
    spaceId: SPACE_ID,
    userId: USER_ID,
    batchId: null,
    changes: { before: { title: 'Old' }, after: { title: 'New' } },
    createdAt: new Date(),
    user: { id: USER_ID, name: 'Test', email: 'test@test.com' },
    ...overrides,
  }
}

async function buildAuditApp() {
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

  await app.register(async (instance) => {
    instance.addHook('preHandler', instance.authenticate)
    await instance.register(auditLogsRoutes, { prefix: '/:spaceId/audit-logs' })
  }, { prefix: '/spaces' })

  await app.ready()
  return { app, prisma }
}

describe('AuditLogs routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAuditApp()
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

  // ─── LIST AUDIT LOGS ──────────────────────────────────────────

  describe('GET /spaces/:spaceId/audit-logs', () => {
    it('should list audit logs with pagination', async () => {
      allowAccess()
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLog()])
      prisma.auditLog.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/audit-logs`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(1)
      expect(body.page).toBe(1)
    })

    it('should filter by entity and action', async () => {
      allowAccess()
      prisma.auditLog.findMany.mockResolvedValue([])
      prisma.auditLog.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/audit-logs?entity=Item&action=DELETE`,
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.auditLog.findMany.mock.calls[0][0].where
      expect(where.entity).toBe('Item')
      expect(where.action).toBe('DELETE')
    })

    it('should return 404 when no access', async () => {
      denyAccess()

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/audit-logs`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── GET SINGLE LOG ───────────────────────────────────────────

  describe('GET /spaces/:spaceId/audit-logs/:id', () => {
    it('should return a single audit log', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(mockAuditLog())

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe('log-1')
    })

    it('should return 404 for non-existent log', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/audit-logs/non-existent`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── RESTORE FROM LOG ─────────────────────────────────────────

  describe('POST /spaces/:spaceId/audit-logs/:id/restore', () => {
    it('should restore an UPDATE action', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(mockAuditLog({
        action: 'UPDATE',
        changes: { before: { title: 'Old Title' }, after: { title: 'New Title' } },
      }))
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1', title: 'New Title' })
      prisma.item.update.mockResolvedValue({ id: 'item-1', title: 'Old Title' })
      prisma.auditLog.create.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should restore a DELETE action (recreate item)', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(mockAuditLog({
        action: 'DELETE',
        changes: {
          before: {
            id: 'item-1', type: 'NOTE', title: 'Deleted',
            description: null, content: null, url: null,
            status: null, priority: null, position: 0,
            dueDate: null, createdById: USER_ID, parentId: null,
          },
        },
      }))
      prisma.item.findUnique.mockResolvedValue(null) // item doesn't exist
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID }) // creator exists
      prisma.item.create.mockResolvedValue({ id: 'item-1', title: 'Deleted' })
      prisma.auditLog.create.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject restore of CREATE action', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(mockAuditLog({ action: 'CREATE' }))

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should reject restore by VIEWER', async () => {
      allowAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent log', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/non-existent/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should conflict if deleted item already exists', async () => {
      allowAccess()
      prisma.auditLog.findFirst.mockResolvedValue(mockAuditLog({
        action: 'DELETE',
        changes: { before: { id: 'item-1', type: 'NOTE', title: 'Still here' } },
      }))
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1' }) // already exists

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/audit-logs/log-1/restore`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
    })
  })
})
