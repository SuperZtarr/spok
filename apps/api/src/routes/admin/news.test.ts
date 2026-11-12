/*
 * TNR de la publication des nouveautés : GET /news/overrides (public), PUT /admin/news/overrides (validation, lignes sans
 * effet non stockées, accès admin seul).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminNewsRoutes, publicNewsRoutes } from './news.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  app.setErrorHandler((error, _request, reply) => {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })
  await app.register(sensible)
  await app.register(fp(async (f) => { f.decorate('prisma', prisma as any) }, { name: 'prisma' }))
  await app.register(jwtPlugin)
  await app.register(adminAuthPlugin)
  await app.register(adminNewsRoutes, { prefix: '/admin/news' })
  await app.register(publicNewsRoutes, { prefix: '/news' })
  await app.ready()
  return { app, prisma }
}

describe('Publication des nouveautés', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    token = getTestToken(app, { userId: 'admin-id', email: 'admin@test.com' })
  })
  const asAdmin = () => prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  const put = (overrides: unknown[]) => app.inject({ method: 'PUT', url: '/admin/news/overrides', headers: { authorization: `Bearer ${token}` }, payload: { overrides } })

  it('GET /news/overrides (public) : surcharges stockées, liste vide sinon', async () => {
    prisma.appConfig.findUnique.mockResolvedValueOnce({ key: 'news_overrides', value: [{ id: 'a', hidden: true }] })
    expect((await app.inject({ method: 'GET', url: '/news/overrides' })).json()).toEqual([{ id: 'a', hidden: true }])
    prisma.appConfig.findUnique.mockResolvedValueOnce(null)
    expect((await app.inject({ method: 'GET', url: '/news/overrides' })).json()).toEqual([])
  })

  it('PUT : ne garde que les lignes avec effet', async () => {
    asAdmin()
    prisma.appConfig.upsert.mockResolvedValue({})
    const res = await put([
      { id: 'masquee', hidden: true },
      { id: 'datee', hidden: false, date: '2026-12-01' },
      { id: 'sans-effet', hidden: false },
    ])
    expect(res.statusCode).toBe(200)
    expect((res.json() as any).overrides).toEqual([{ id: 'masquee', hidden: true }, { id: 'datee', date: '2026-12-01' }])
    expect(prisma.appConfig.upsert).toHaveBeenCalledOnce()
  })

  it('PUT : date mal formée → 400, rien écrit', async () => {
    asAdmin()
    const res = await put([{ id: 'a', date: '01/12/2026' }])
    expect(res.statusCode).toBe(400)
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled()
  })

  it('PUT : réservé aux admins (403, rien écrit)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
    const res = await put([{ id: 'a', hidden: true }])
    expect(res.statusCode).toBe(403)
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled()
  })
})
