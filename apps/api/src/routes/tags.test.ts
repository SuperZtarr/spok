/* TNR des tags d'espace : CRUD, validation couleur, droits par rôle. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { tagsRoutes } from './tags.js'

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'

function mockMembership(role = 'MEMBER') {
  return { id: 'mem-1', userId: USER_ID, spaceId: SPACE_ID, role, joinedAt: new Date() }
}

async function buildTagsApp() {
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
    await instance.register(tagsRoutes, { prefix: '/:spaceId/tags' })
  }, { prefix: '/spaces' })

  await app.ready()
  return { app, prisma }
}

describe('Tags routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildTagsApp()
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

  // ─── LIST TAGS ────────────────────────────────────────────────

  describe('GET /spaces/:spaceId/tags', () => {
    it('should list tags with item counts', async () => {
      allowAccess()
      prisma.tag.findMany.mockResolvedValue([
        { id: 'tag-1', name: 'urgent', color: '#ff0000', spaceId: SPACE_ID, _count: { items: 3 } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].itemCount).toBe(3)
    })

    it('should return 404 when no access', async () => {
      denyAccess()

      const res = await app.inject({
        method: 'GET',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ─── CREATE TAG ───────────────────────────────────────────────

  describe('POST /spaces/:spaceId/tags', () => {
    it('should create a tag', async () => {
      allowAccess()
      prisma.tag.findUnique.mockResolvedValue(null) // no duplicate
      prisma.tag.create.mockResolvedValue({ id: 'tag-new', name: 'feature', color: '#00ff00', spaceId: SPACE_ID })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'feature', color: '#00ff00' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().name).toBe('feature')
    })

    it('should reject duplicate tag name', async () => {
      allowAccess()
      prisma.tag.findUnique.mockResolvedValue({ id: 'existing', name: 'feature', spaceId: SPACE_ID })

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'feature' },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should reject creation by VIEWER', async () => {
      allowAccess('VIEWER')

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'nope' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should reject invalid color format', async () => {
      allowAccess()

      const res = await app.inject({
        method: 'POST',
        url: `/spaces/${SPACE_ID}/tags`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'tag', color: 'red' },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ─── UPDATE TAG ───────────────────────────────────────────────

  describe('PATCH /spaces/:spaceId/tags/:id', () => {
    it('should update tag name', async () => {
      allowAccess()
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'old', spaceId: SPACE_ID })
      prisma.tag.findUnique.mockResolvedValue(null) // no name conflict
      prisma.tag.update.mockResolvedValue({ id: 'tag-1', name: 'new', spaceId: SPACE_ID })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/tags/tag-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'new' },
      })

      expect(res.statusCode).toBe(200)
    })

    it('should reject duplicate name on update', async () => {
      allowAccess()
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'old', spaceId: SPACE_ID })
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-2', name: 'taken', spaceId: SPACE_ID })

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/tags/tag-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'taken' },
      })

      expect(res.statusCode).toBe(409)
    })

    it('should return 404 for non-existent tag', async () => {
      allowAccess()
      prisma.tag.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/tags/non-existent`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'ghost' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should reject update by VIEWER', async () => {
      allowAccess('VIEWER')

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/tags/tag-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'nope' },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── DELETE TAG ───────────────────────────────────────────────

  describe('DELETE /spaces/:spaceId/tags/:id', () => {
    it('should delete tag as OWNER', async () => {
      allowAccess('OWNER')
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'doomed', spaceId: SPACE_ID })
      prisma.tag.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/tags/tag-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject delete by MEMBER', async () => {
      allowAccess('MEMBER')

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/tags/tag-1`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 for non-existent tag', async () => {
      allowAccess('OWNER')
      prisma.tag.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: `/spaces/${SPACE_ID}/tags/non-existent`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
