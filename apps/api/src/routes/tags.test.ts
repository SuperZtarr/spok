/* TNR des tags d'un espace (portée communauté + global, 2026-11-11) : liste, création dans la communauté, refus sans
   communauté, doublon contre communauté et global, droits de gestion (propriétaire de communauté / admin). */
import { describe, it, expect, beforeEach } from 'vitest'
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

  const inject = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload && { payload }) })

  // ─── LIST TAGS ────────────────────────────────────────────────

  describe('GET /spaces/:spaceId/tags', () => {
    it('tags de la communauté + globaux, portée indiquée', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
      prisma.tag.findMany.mockResolvedValue([
        { id: 'tag-1', name: 'urgent', color: '#ff0000', communityId: 'com-1', spaceId: null, _count: { items: 3 } },
        { id: 'tag-2', name: 'bug', color: null, communityId: null, spaceId: null, _count: { items: 1 } },
      ])

      const res = await inject('GET', `/spaces/${SPACE_ID}/tags`)

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body[0]).toMatchObject({ itemCount: 3, isCommunityTag: true, isGlobalTag: false })
      expect(body[1]).toMatchObject({ itemCount: 1, isCommunityTag: false, isGlobalTag: true })
      expect(prisma.tag.findMany.mock.calls[0][0].where).toEqual({ OR: [{ communityId: 'com-1' }, { communityId: null, spaceId: null }] })
    })

    it('espace sans communauté : globaux seulement', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: null })
      prisma.tag.findMany.mockResolvedValue([])

      await inject('GET', `/spaces/${SPACE_ID}/tags`)

      expect(prisma.tag.findMany.mock.calls[0][0].where).toEqual({ communityId: null, spaceId: null })
    })

    it('should return 404 when no access', async () => {
      denyAccess()
      const res = await inject('GET', `/spaces/${SPACE_ID}/tags`)
      expect(res.statusCode).toBe(404)
    })
  })

  // ─── CREATE TAG ───────────────────────────────────────────────

  describe('POST /spaces/:spaceId/tags', () => {
    it('tag créé dans la communauté de l\'espace', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
      prisma.tag.findMany.mockResolvedValue([]) // pas de doublon
      prisma.tag.create.mockResolvedValue({ id: 'tag-new', name: 'bug', communityId: 'com-1' })

      const res = await inject('POST', `/spaces/${SPACE_ID}/tags`, { name: ' bug ', color: '#00ff00' })

      expect(res.statusCode).toBe(201)
      expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'bug', color: '#00ff00', communityId: 'com-1' } })
    })

    it('espace sans communauté : création refusée (400)', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: null })

      const res = await inject('POST', `/spaces/${SPACE_ID}/tags`, { name: 'perso' })

      expect(res.statusCode).toBe(400)
      expect(prisma.tag.create).not.toHaveBeenCalled()
    })

    it('nom déjà pris en global ou dans la communauté : 409', async () => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
      prisma.tag.findMany.mockResolvedValue([{ id: 'g', name: 'Bug', communityId: null, spaceId: null }])

      const res = await inject('POST', `/spaces/${SPACE_ID}/tags`, { name: 'bug' })

      expect(res.statusCode).toBe(409)
      expect(prisma.tag.findMany.mock.calls[0][0].where).toMatchObject({ name: { equals: 'bug', mode: 'insensitive' } })
    })

    it('should reject creation by VIEWER', async () => {
      allowAccess('VIEWER')
      const res = await inject('POST', `/spaces/${SPACE_ID}/tags`, { name: 'nope' })
      expect(res.statusCode).toBe(403)
    })

    it('should reject invalid color format', async () => {
      allowAccess()
      const res = await inject('POST', `/spaces/${SPACE_ID}/tags`, { name: 'tag', color: 'red' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ─── UPDATE / DELETE ──────────────────────────────────────────

  describe('PATCH / DELETE /spaces/:spaceId/tags/:id', () => {
    beforeEach(() => {
      allowAccess()
      prisma.space.findUnique.mockResolvedValue({ communityId: 'com-1' })
    })

    it('tag de communauté : renommé par le propriétaire de la communauté', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'old', communityId: 'com-1', spaceId: null })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.tag.findMany.mockResolvedValue([])
      prisma.tag.update.mockResolvedValue({ id: 'tag-1', name: 'new' })

      const res = await inject('PATCH', `/spaces/${SPACE_ID}/tags/tag-1`, { name: 'new' })

      expect(res.statusCode).toBe(200)
      expect(prisma.tag.update).toHaveBeenCalledWith({ where: { id: 'tag-1' }, data: { name: 'new' } })
    })

    it('tag de communauté : refusé à un simple membre de la communauté', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'old', communityId: 'com-1', spaceId: null })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })

      expect((await inject('PATCH', `/spaces/${SPACE_ID}/tags/tag-1`, { name: 'new' })).statusCode).toBe(403)
      expect((await inject('DELETE', `/spaces/${SPACE_ID}/tags/tag-1`)).statusCode).toBe(403)
      expect(prisma.tag.delete).not.toHaveBeenCalled()
    })

    it('tag global : refusé hors mode admin', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 'g', name: 'bug', communityId: null, spaceId: null })

      expect((await inject('DELETE', `/spaces/${SPACE_ID}/tags/g`)).statusCode).toBe(403)
    })

    it('nom déjà pris : 409', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'old', communityId: 'com-1', spaceId: null })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.tag.findMany.mockResolvedValue([{ id: 'tag-2', name: 'taken', communityId: 'com-1', spaceId: null }])

      expect((await inject('PATCH', `/spaces/${SPACE_ID}/tags/tag-1`, { name: 'taken' })).statusCode).toBe(409)
    })

    it('suppression par le propriétaire de la communauté', async () => {
      prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1', name: 'doomed', communityId: 'com-1', spaceId: null })
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.tag.delete.mockResolvedValue({})

      const res = await inject('DELETE', `/spaces/${SPACE_ID}/tags/tag-1`)

      expect(res.statusCode).toBe(200)
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } })
    })

    it('tag absent ou hors de portée : 404', async () => {
      prisma.tag.findFirst.mockResolvedValue(null)
      expect((await inject('PATCH', `/spaces/${SPACE_ID}/tags/x`, { name: 'ghost' })).statusCode).toBe(404)
      expect((await inject('DELETE', `/spaces/${SPACE_ID}/tags/x`)).statusCode).toBe(404)
    })
  })
})
