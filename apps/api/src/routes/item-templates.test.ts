/*
 * TNR de /item-templates : liste (tri par nom), creation, suppression (createur uniquement).
 * Portee globale — pas de filtre par espace/communaute.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemTemplatesRoutes } from './item-templates.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(itemTemplatesRoutes, { prefix: '/item-templates' })

  await app.ready()
  return { app, prisma }
}

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    name: 'Réunion type',
    description: null,
    structure: { title: 'Réunion', type: 'MEETING', children: [] },
    createdById: USER_ID,
    createdAt: new Date(),
    createdBy: { name: 'Test User' },
    ...overrides,
  }
}

describe('Item templates routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  describe('GET /item-templates', () => {
    it('lists all templates sorted by name', async () => {
      prisma.itemTemplate.findMany.mockResolvedValue([mockTemplate()])

      const res = await app.inject({ method: 'GET', url: '/item-templates', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(1)
      expect(prisma.itemTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } })
      )
    })

    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/item-templates' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /item-templates', () => {
    it('creates a template from a name and a structure tree', async () => {
      prisma.itemTemplate.create.mockResolvedValue(mockTemplate())

      const res = await app.inject({
        method: 'POST', url: '/item-templates',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Réunion type', structure: { title: 'Réunion', type: 'MEETING', children: [] } },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.itemTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Réunion type',
          description: undefined,
          structure: { title: 'Réunion', type: 'MEETING', children: [] },
          createdById: USER_ID,
        },
        include: { createdBy: { select: { name: true } } },
      })
    })

    it('rejects an empty name', async () => {
      const res = await app.inject({
        method: 'POST', url: '/item-templates',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '', structure: { title: 'Réunion', type: 'MEETING', children: [] } },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /item-templates/:id', () => {
    it('deletes when the current user is the creator', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(mockTemplate())
      prisma.itemTemplate.delete.mockResolvedValue(mockTemplate())

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/tpl-1', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(prisma.itemTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } })
    })

    it('forbids deleting a template created by someone else', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(mockTemplate({ createdById: 'someone-else' }))

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/tpl-1', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(403)
      expect(prisma.itemTemplate.delete).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown template', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(null)

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/unknown', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(404)
    })
  })
})
