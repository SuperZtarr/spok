/*
 * TNR des surcharges de menu : GET /admin/menu (défaut du code + valeur effective), PUT /admin/menu/overrides
 * (validation des clés, section admin interdite, seules les différences avec le code sont stockées), accès admin seul.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import sensible from '@fastify/sensible'
import { MENU_REGISTRY } from '@spok/shared'
import { createMockPrisma, getTestToken, MockPrisma } from '../../test/helpers.js'
import { jwtPlugin } from '../../plugins/jwt.js'
import { adminAuthPlugin } from '../../plugins/adminAuth.js'
import { adminMenuRoutes, publicMenuRoutes } from './menu.js'

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
  await app.register(adminMenuRoutes, { prefix: '/admin/menu' })
  await app.register(publicMenuRoutes, { prefix: '/menu' })
  await app.ready()
  return { app, prisma }
}

const view = MENU_REGISTRY.find((i) => i.viewMode === 'burndown')!
const adminEntry = MENU_REGISTRY.find((i) => i.section === 'admin')!

describe('Surcharges de menu', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    token = getTestToken(app, { userId: 'admin-id', email: 'admin@test.com' })
  })
  const asAdmin = () => prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'ADMIN' })
  const put = (overrides: unknown[]) => app.inject({ method: 'PUT', url: '/admin/menu/overrides', headers: { authorization: `Bearer ${token}` }, payload: { overrides } })

  it('GET /admin/menu : défaut du code et valeur effective, sans la section admin', async () => {
    asAdmin()
    prisma.appConfig.findUnique.mockResolvedValue({ key: 'menu_overrides', value: [{ key: view.key, visible: true, access: 'user' }] })
    const res = await app.inject({ method: 'GET', url: '/admin/menu', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    const items = res.json() as any[]
    expect(items.some((i) => i.section === 'admin')).toBe(false)
    const b = items.find((i) => i.key === view.key)
    expect(b).toMatchObject({ defaultAccess: view.access, access: 'user', overridden: true })
  })

  it('PUT : ne garde que les différences avec le code', async () => {
    asAdmin()
    prisma.appConfig.upsert.mockResolvedValue({})
    const res = await put([
      { key: view.key, visible: view.visible, access: view.access }, // identique au code → non stocké
      { key: view.key === 'list' ? 'kanban' : 'list', visible: false, access: 'public' },
    ])
    expect(res.statusCode).toBe(200)
    expect((res.json() as any).overrides).toHaveLength(1)
    expect(prisma.appConfig.upsert).toHaveBeenCalledOnce()
  })

  it('PUT : clé inconnue → 400, rien écrit', async () => {
    asAdmin()
    const res = await put([{ key: 'nexiste-pas', visible: true, access: 'user' }])
    expect(res.statusCode).toBe(400)
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled()
  })

  it('PUT : entrée d\'administration → 400, rien écrit', async () => {
    asAdmin()
    const res = await put([{ key: adminEntry.key, visible: false, access: 'admin' }])
    expect(res.statusCode).toBe(400)
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled()
  })

  it('PUT : réservé aux admins (403, rien écrit)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ globalRole: 'USER' })
    const res = await put([{ key: view.key, visible: true, access: 'user' }])
    expect(res.statusCode).toBe(403)
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled()
  })

  it('GET /menu (public) : surcharge appliquée', async () => {
    prisma.appConfig.findUnique.mockResolvedValue({ key: 'menu_overrides', value: [{ key: view.key, visible: false, access: 'user' }] })
    const res = await app.inject({ method: 'GET', url: '/menu' })
    expect((res.json() as any[]).find((i) => i.key === view.key)).toMatchObject({ visible: false, access: 'user' })
  })
})
