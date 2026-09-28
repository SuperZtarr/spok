/* TNR de /notifications : « Marquer comme non lu » (PATCH /:id/unread), limité au propriétaire. */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { notificationsRoutes } from './notifications.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(notificationsRoutes, { prefix: '/notifications' })
  await app.ready()
  return { app, prisma }
}

describe('Notifications — marquer comme non lu', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('PATCH /:id/unread repasse la notification en non lue', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: USER_ID, read: true })
    prisma.notification.update.mockResolvedValue({ id: 'n1', userId: USER_ID, read: false })
    const res = await app.inject({ method: 'PATCH', url: '/notifications/n1/unread', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'n1' }, data: { read: false } })
  })

  it("PATCH /:id/unread → 404 pour la notification d'un autre utilisateur", async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n2', userId: 'autre', read: true })
    const res = await app.inject({ method: 'PATCH', url: '/notifications/n2/unread', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(404)
    expect(prisma.notification.update).not.toHaveBeenCalled()
  })
})
