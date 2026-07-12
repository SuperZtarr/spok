/*
 * TNR de /communities/:communityId/referentiels : lecture publique (optionalAuthenticate),
 * édition/reset réservés au OWNER de la communauté, comptage d'usage d'un statut.
 * Registration identique à la prod : wrapper optionalAuthenticate posé par communities.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { communityReferentielsRoutes } from './community-referentiels.js'

const COM_ID = 'com-1'
const USER_ID = 'test-user-id'

const customReferentiels = {
  statuses: [{ id: 'custom', label: 'Custom', color: '#000', borderColor: '#111', order: 0, visible: true }],
  typeLabels: {},
}

function mockOwnerMembership() {
  return { id: 'mem-1', userId: USER_ID, communityId: COM_ID, role: 'OWNER' }
}

async function buildApp() {
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

  // Comme communities.ts : optionalAuthenticate posé par le parent
  await app.register(async (instance) => {
    instance.addHook('preHandler', instance.optionalAuthenticate)
    await instance.register(communityReferentielsRoutes, { prefix: '/:communityId/referentiels' })
  }, { prefix: '/communities' })

  await app.ready()
  return { app, prisma }
}

describe('Community referentiels routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app; prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  describe(`GET /communities/${COM_ID}/referentiels`, () => {
    it('accessible sans authentification (optionalAuthenticate)', async () => {
      prisma.community.findUnique.mockResolvedValue({ referentiels: null })
      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels` })
      expect(res.statusCode).toBe(200)
      expect(res.json().isDefault).toBe(true)
      expect(res.json().referentiels.statuses).toBeDefined()
    })

    it('renvoie les référentiels personnalisés quand configurés', async () => {
      prisma.community.findUnique.mockResolvedValue({ referentiels: customReferentiels })
      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels` })
      expect(res.statusCode).toBe(200)
      expect(res.json().isDefault).toBe(false)
      expect(res.json().referentiels.statuses[0].id).toBe('custom')
    })

    it('404 si communauté introuvable', async () => {
      prisma.community.findUnique.mockResolvedValue(null)
      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels` })
      expect(res.statusCode).toBe(404)
    })
  })

  describe(`PUT /communities/${COM_ID}/referentiels`, () => {
    it('401 sans authentification', async () => {
      const res = await app.inject({ method: 'PUT', url: `/communities/${COM_ID}/referentiels`, payload: { statuses: customReferentiels.statuses } })
      expect(res.statusCode).toBe(401)
    })

    it('403 si authentifié mais pas OWNER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ id: 'mem-1', userId: USER_ID, communityId: COM_ID, role: 'MEMBER' })
      const res = await app.inject({
        method: 'PUT', url: `/communities/${COM_ID}/referentiels`, headers: { authorization: `Bearer ${token}` },
        payload: { statuses: customReferentiels.statuses },
      })
      expect(res.statusCode).toBe(403)
    })

    it('403 si aucune adhésion à la communauté', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(null)
      const res = await app.inject({
        method: 'PUT', url: `/communities/${COM_ID}/referentiels`, headers: { authorization: `Bearer ${token}` },
        payload: { statuses: customReferentiels.statuses },
      })
      expect(res.statusCode).toBe(403)
    })

    it("le OWNER peut modifier les statuts — les typeLabels non fournis gardent l'existant", async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockOwnerMembership())
      prisma.community.findUnique.mockResolvedValue({ referentiels: customReferentiels })
      prisma.community.update.mockResolvedValue({})

      const newStatuses = [{ id: 'urgent', label: 'Urgent', color: '#f00', borderColor: '#f00', order: 0, visible: true }]
      const res = await app.inject({
        method: 'PUT', url: `/communities/${COM_ID}/referentiels`, headers: { authorization: `Bearer ${token}` },
        payload: { statuses: newStatuses },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.isDefault).toBe(false)
      expect(body.referentiels.statuses).toEqual(newStatuses)
      expect(body.referentiels.typeLabels).toEqual(customReferentiels.typeLabels) // conservé
      expect(prisma.community.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: COM_ID },
        data: expect.objectContaining({ referentiels: expect.objectContaining({ statuses: newStatuses }) }),
      }))
    })

    it('400 sur un statut invalide (champ manquant)', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockOwnerMembership())
      const res = await app.inject({
        method: 'PUT', url: `/communities/${COM_ID}/referentiels`, headers: { authorization: `Bearer ${token}` },
        payload: { statuses: [{ id: 'x' }] },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe(`POST /communities/${COM_ID}/referentiels/reset`, () => {
    it('403 si pas OWNER', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      const res = await app.inject({ method: 'POST', url: `/communities/${COM_ID}/referentiels/reset`, headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(403)
    })

    it('le OWNER peut réinitialiser — referentiels remis à null, défauts renvoyés', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue(mockOwnerMembership())
      prisma.community.update.mockResolvedValue({})
      const res = await app.inject({ method: 'POST', url: `/communities/${COM_ID}/referentiels/reset`, headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(200)
      expect(res.json().isDefault).toBe(true)
      expect(prisma.community.update).toHaveBeenCalledWith({ where: { id: COM_ID }, data: { referentiels: null } })
    })
  })

  describe(`GET /communities/${COM_ID}/referentiels/check-status-usage/:statusId`, () => {
    it("compte les items utilisant le statut sur les espaces de la communauté", async () => {
      prisma.community.findUnique.mockResolvedValue({ spaces: [{ id: 'space-1' }, { id: 'space-2' }] })
      prisma.item.count.mockResolvedValue(3)

      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels/check-status-usage/todo` })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ statusId: 'todo', itemCount: 3, isUsed: true })
      expect(prisma.item.count).toHaveBeenCalledWith({ where: { spaceId: { in: ['space-1', 'space-2'] }, status: 'todo' } })
    })

    it("statusId='undefined' compte les items sans statut (status: null)", async () => {
      prisma.community.findUnique.mockResolvedValue({ spaces: [{ id: 'space-1' }] })
      prisma.item.count.mockResolvedValue(0)

      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels/check-status-usage/undefined` })
      expect(res.statusCode).toBe(200)
      expect(res.json().isUsed).toBe(false)
      expect(prisma.item.count).toHaveBeenCalledWith({ where: { spaceId: { in: ['space-1'] }, status: null } })
    })

    it('404 si communauté introuvable', async () => {
      prisma.community.findUnique.mockResolvedValue(null)
      const res = await app.inject({ method: 'GET', url: `/communities/${COM_ID}/referentiels/check-status-usage/todo` })
      expect(res.statusCode).toBe(404)
    })
  })
})
