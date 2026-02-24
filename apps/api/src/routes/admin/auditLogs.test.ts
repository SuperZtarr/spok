import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminAuditLogsRoutes } from './auditLogs.js'

const ADMIN_ID = 'admin-user-id'

function mockAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    action: 'DELETE',
    entity: 'Item',
    entityId: 'item-1',
    spaceId: 'space-1',
    userId: ADMIN_ID,
    batchId: null,
    changes: { before: { id: 'item-1', type: 'NOTE', title: 'Deleted', createdById: ADMIN_ID } },
    createdAt: new Date(),
    user: { id: ADMIN_ID, name: 'Admin', email: 'admin@test.com' },
    space: { id: 'space-1', name: 'Space 1' },
    ...overrides,
  }
}

async function buildAdminAuditApp() {
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
  await app.register(fp(async (f) => { f.decorate('prisma', prisma as any) }, { name: 'prisma' }))
  await app.register(jwtPlugin)
  await app.register(adminAuthPlugin)
  await app.register(adminAuditLogsRoutes, { prefix: '/admin/audit-logs' })

  await app.ready()
  return { app, prisma }
}

describe('Admin AuditLogs routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildAdminAuditApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: ADMIN_ID, email: 'admin@test.com' })
  })

  function allowAdmin() {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  }

  // ─── LIST AUDIT LOGS ──────────────────────────────────

  describe('GET /admin/audit-logs', () => {
    it('should list audit logs with pagination', async () => {
      allowAdmin()
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLog()])
      prisma.auditLog.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/admin/audit-logs',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it('should filter by entity and action', async () => {
      allowAdmin()
      prisma.auditLog.findMany.mockResolvedValue([])
      prisma.auditLog.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/admin/audit-logs?entity=Item&action=DELETE',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.auditLog.findMany.mock.calls[0][0].where
      expect(where.entity).toBe('Item')
      expect(where.action).toBe('DELETE')
    })

    it('should filter by communityId (cross-space)', async () => {
      allowAdmin()
      prisma.space.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
      prisma.auditLog.findMany.mockResolvedValue([])
      prisma.auditLog.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/admin/audit-logs?communityId=c1',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.auditLog.findMany.mock.calls[0][0].where
      expect(where.OR).toBeDefined()
    })
  })

  // ─── STATS ────────────────────────────────────────────

  describe('GET /admin/audit-logs/stats', () => {
    it('should return audit stats', async () => {
      allowAdmin()
      prisma.auditLog.count.mockResolvedValue(100)
      prisma.auditLog.groupBy
        .mockResolvedValueOnce([{ entity: 'Item', _count: 80 }])   // entityCounts
        .mockResolvedValueOnce([{ action: 'UPDATE', _count: 50 }]) // actionCounts
        .mockResolvedValueOnce([])                                   // batchCount
      prisma.auditLog.findMany.mockResolvedValue([]) // recentLogs

      const res = await app.inject({
        method: 'GET', url: '/admin/audit-logs/stats',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.totalCount).toBe(100)
      expect(body.entityBreakdown).toHaveLength(1)
    })
  })

  // ─── RESTORE SINGLE ───────────────────────────────────

  describe('POST /admin/audit-logs/:id/restore', () => {
    it('should restore a deleted Item', async () => {
      allowAdmin()
      prisma.auditLog.findUnique.mockResolvedValue(mockAuditLog({
        action: 'DELETE', entity: 'Item', entityId: 'item-1', spaceId: 'space-1',
        changes: {
          before: { id: 'item-1', type: 'NOTE', title: 'Deleted', createdById: ADMIN_ID, position: 0 },
        },
      }))
      prisma.item.findUnique
        .mockResolvedValueOnce(null)   // item doesn't exist
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1' }) // space exists
      prisma.user.findUnique.mockResolvedValueOnce({ id: ADMIN_ID }) // creator exists
      prisma.item.create.mockResolvedValue({ id: 'item-1', title: 'Deleted' })
      prisma.auditLog.create.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/log-1/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      expect(res.json().entity).toBe('Item')
    })

    it('should restore a deleted Space', async () => {
      allowAdmin()
      prisma.auditLog.findUnique.mockResolvedValue(mockAuditLog({
        action: 'DELETE', entity: 'Space', entityId: 'space-1',
        changes: {
          before: { id: 'space-1', name: 'Old Space', type: 'GROUP', parentId: null, communityId: null, avatarUrl: null, coverUrl: null },
        },
      }))
      prisma.space.findUnique.mockResolvedValue(null) // space doesn't exist
      prisma.space.create.mockResolvedValue({ id: 'space-1', name: 'Old Space' })
      prisma.spaceMembership.create.mockResolvedValue({})
      prisma.auditLog.create.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/log-1/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().entity).toBe('Space')
    })

    it('should return 404 for non-existent log', async () => {
      allowAdmin()
      prisma.auditLog.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/nope/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should reject non-DELETE log', async () => {
      allowAdmin()
      prisma.auditLog.findUnique.mockResolvedValue(mockAuditLog({
        action: 'UPDATE', changes: { before: {}, after: {} },
      }))

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/log-1/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })

    it('should return 409 if item already exists', async () => {
      allowAdmin()
      prisma.auditLog.findUnique.mockResolvedValue(mockAuditLog({
        action: 'DELETE', entity: 'Item', entityId: 'item-1',
        changes: { before: { id: 'item-1', type: 'NOTE', title: 'Still here', createdById: ADMIN_ID } },
      }))
      prisma.item.findUnique.mockResolvedValue({ id: 'item-1' }) // already exists

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/log-1/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
    })
  })

  // ─── BATCH RESTORE ────────────────────────────────────

  describe('POST /admin/audit-logs/batch/:batchId/restore', () => {
    it('should restore all logs of a batch', async () => {
      allowAdmin()
      prisma.auditLog.findMany.mockResolvedValue([
        mockAuditLog({
          id: 'log-1', entity: 'Item', entityId: 'item-1', batchId: 'batch-1',
          action: 'DELETE',
          changes: { before: { id: 'item-1', type: 'NOTE', title: 'A', createdById: ADMIN_ID, position: 0 } },
        }),
      ])
      prisma.item.findUnique.mockResolvedValue(null) // doesn't exist
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1' })
      prisma.user.findUnique.mockResolvedValueOnce({ id: ADMIN_ID })
      prisma.item.create.mockResolvedValue({ id: 'item-1' })
      prisma.auditLog.create.mockResolvedValue({})

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/batch/batch-1/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.summary.restored).toBe(1)
    })

    it('should return 404 for empty batch', async () => {
      allowAdmin()
      prisma.auditLog.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'POST', url: '/admin/audit-logs/batch/nope/restore',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── PURGE ────────────────────────────────────────────

  describe('DELETE /admin/audit-logs/purge', () => {
    it('should purge old audit logs', async () => {
      allowAdmin()
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 50 })

      const res = await app.inject({
        method: 'DELETE', url: '/admin/audit-logs/purge?olderThanDays=90',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().purged).toBe(50)
    })
  })
})
