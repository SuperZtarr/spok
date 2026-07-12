/*
 * TNR de /user/calendar-feeds : CRUD scopé à l'utilisateur courant, validation d'URL http(s),
 * refus d'accès aux feeds d'un autre utilisateur.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { calendarFeedsRoutes } from './calendar-feeds.js'

const USER_ID = 'test-user-id'

function mockFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feed-1', userId: USER_ID, name: 'Client', url: 'https://outlook.office365.com/owa/calendar/x/calendar.ics',
    color: '#3b82f6', enabled: true, lastFetchedAt: null, lastError: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(calendarFeedsRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

describe('Calendar feeds routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app; prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it("GET liste les feeds de l'utilisateur courant", async () => {
    prisma.calendarFeed.findMany.mockResolvedValue([mockFeed()])
    const res = await app.inject({ method: 'GET', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(prisma.calendarFeed.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID } }))
  })

  it('POST crée un feed avec une URL http(s) valide', async () => {
    prisma.calendarFeed.create.mockResolvedValue(mockFeed())
    const res = await app.inject({
      method: 'POST', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Client', url: 'https://outlook.office365.com/owa/calendar/x/calendar.ics', color: '#3b82f6' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST rejette une URL non http(s)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/user/calendar-feeds', headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', url: 'file:///etc/passwd' },
    })
    expect(res.statusCode).toBe(400)
  })

  it("PATCH refuse le feed d'un autre utilisateur", async () => {
    prisma.calendarFeed.findUnique.mockResolvedValue(mockFeed({ userId: 'autre' }))
    const res = await app.inject({
      method: 'PATCH', url: '/user/calendar-feeds/feed-1', headers: { authorization: `Bearer ${token}` },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE supprime son propre feed', async () => {
    prisma.calendarFeed.findUnique.mockResolvedValue(mockFeed())
    prisma.calendarFeed.delete.mockResolvedValue(mockFeed())
    const res = await app.inject({ method: 'DELETE', url: '/user/calendar-feeds/feed-1', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(204)
  })
})
