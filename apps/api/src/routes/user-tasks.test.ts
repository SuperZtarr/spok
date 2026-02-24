import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { userTasksRoutes } from './user-tasks.js'

const USER_ID = 'test-user-id'

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Task 1',
    type: 'TASK',
    status: 'todo',
    priority: 2,
    dueDate: null,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    spaceId: 'space-1',
    createdById: USER_ID,
    parentId: null,
    description: null,
    space: { id: 'space-1', name: 'Space 1' },
    createdBy: { id: USER_ID, name: 'Test User' },
    parent: null,
    tags: [],
    ...overrides,
  }
}

async function buildUserTasksApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(userTasksRoutes, { prefix: '/user' })

  await app.ready()
  return { app, prisma }
}

describe('User Tasks routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildUserTasksApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  describe('GET /user/tasks', () => {
    it('should return tasks for admin (all spaces)', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([mockTask()])
      prisma.item.count.mockResolvedValue(1)

      const res = await app.inject({
        method: 'GET', url: '/user/tasks',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(1)
      expect(body.data[0].spaceName).toBe('Space 1')
    })

    it('should filter by accessible spaces for regular user', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 's1' }])
      prisma.communityMembership.findMany.mockResolvedValue([])
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.spaceId).toEqual({ in: ['s1'] })
    })

    it('should include community spaces for regular user', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
      prisma.space.findMany.mockResolvedValue([{ id: 's-com' }])
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.spaceId.in).toContain('s-com')
    })

    it('should return empty for user with no accessible spaces', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
      prisma.spaceMembership.findMany.mockResolvedValue([])
      prisma.communityMembership.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET', url: '/user/tasks',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(0)
      expect(res.json().total).toBe(0)
    })

    it('should default to type=TASK when no type filter', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.type).toBe('TASK')
    })

    it('should support multi-value type filter', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?type=TASK,PROJECT',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.type).toEqual({ in: ['TASK', 'PROJECT'] })
    })

    it('should support status filter with none (null)', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?status=none,todo',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      // Should use OR: [{ status: null }, { status: { in: ['todo'] } }]
      expect(where.OR).toBeDefined()
      expect(where.OR).toEqual([
        { status: null },
        { status: { in: ['todo'] } },
      ])
    })

    it('should support priority filter', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?priority=1,2',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.priority).toEqual({ in: [1, 2] })
    })

    it('should support noDueDate filter', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?noDueDate=true',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.dueDate).toBeNull()
    })

    it('should support due date range filter', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?dueDateFrom=2025-01-01&dueDateTo=2025-12-31',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.dueDate.gte).toEqual(new Date('2025-01-01'))
      expect(where.dueDate.lte).toEqual(new Date('2025-12-31'))
    })

    it('should support text search', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?search=important',
        headers: { authorization: `Bearer ${token}` },
      })

      const where = prisma.item.findMany.mock.calls[0][0].where
      expect(where.OR).toBeDefined()
      // Should search title and description
      expect(where.OR.some((c: any) => c.title?.contains === 'important')).toBe(true)
      expect(where.OR.some((c: any) => c.description?.contains === 'important')).toBe(true)
    })

    it('should support sort by spaceName', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(0)

      await app.inject({
        method: 'GET', url: '/user/tasks?sortBy=spaceName&sortDir=asc',
        headers: { authorization: `Bearer ${token}` },
      })

      const orderBy = prisma.item.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ space: { name: 'asc' } })
    })

    it('should support pagination', async () => {
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
      prisma.item.findMany.mockResolvedValue([])
      prisma.item.count.mockResolvedValue(50)

      const res = await app.inject({
        method: 'GET', url: '/user/tasks?page=3&pageSize=10',
        headers: { authorization: `Bearer ${token}` },
      })

      const args = prisma.item.findMany.mock.calls[0][0]
      expect(args.skip).toBe(20) // (3-1) * 10
      expect(args.take).toBe(10)

      const body = res.json()
      expect(body.page).toBe(3)
      expect(body.pageSize).toBe(10)
      expect(body.totalPages).toBe(5)
    })

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/user/tasks' })
      expect(res.statusCode).toBe(401)
    })
  })
})
