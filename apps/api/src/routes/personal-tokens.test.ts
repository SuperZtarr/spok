/*
 * TNR de /user/tokens : création (jeton en clair renvoyé une seule fois, hash stocké), liste sans hash,
 * révocation scopée au propriétaire, refus de toute gestion de jetons authentifiée par un jeton.
 * /user/mcp-access : création de jeton refusée sans accès accordé, demande notifiée aux admins une seule fois.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { personalTokensRoutes } from './personal-tokens.js'
import { generatePersonalToken, hashPersonalToken } from '../utils/personalTokens.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(personalTokensRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

function userRow(overrides: Record<string, unknown> = {}) {
  return { id: USER_ID, name: 'Test', email: 'test@test.com', globalRole: 'USER', mcpAccessGrantedAt: null, mcpAccessRequestedAt: null, ...overrides }
}

describe('Personal tokens routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let jwt: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    jwt = getTestToken(app)
    prisma.user.findUnique.mockResolvedValue(userRow({ mcpAccessGrantedAt: new Date() }))
  })

  it('crée un jeton : renvoie le clair une fois, stocke uniquement le hash', async () => {
    prisma.personalAccessToken.create.mockImplementation(async ({ data }: any) => ({ id: 'pat-1', createdAt: new Date(), lastUsedAt: null, revokedAt: null, ...data }))
    const res = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: 'Claude perso', scope: 'write', expiresInDays: 90 } })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toMatch(/^spok_pat_/)
    expect(body.tokenHash).toBeUndefined()
    const data = prisma.personalAccessToken.create.mock.calls[0][0].data
    expect(data.tokenHash).toBe(hashPersonalToken(body.token))
    expect(data.userId).toBe(USER_ID)
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now() + 89 * 86400_000)
  })

  it('refuse un nom vide ou une portée inconnue', async () => {
    const r1 = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: '', scope: 'write' } })
    expect(r1.statusCode).toBe(400)
    const r2 = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: 'x', scope: 'admin' } })
    expect(r2.statusCode).toBe(400)
  })

  it('liste les jetons de l\'utilisateur sans exposer le hash', async () => {
    await app.inject({ method: 'GET', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` } })
    const args = prisma.personalAccessToken.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: USER_ID })
    expect(args.select.tokenHash).toBeUndefined()
  })

  it('révoque uniquement un jeton de l\'utilisateur', async () => {
    prisma.personalAccessToken.findFirst.mockResolvedValue(null)
    const r404 = await app.inject({ method: 'DELETE', url: '/user/tokens/other', headers: { authorization: `Bearer ${jwt}` } })
    expect(r404.statusCode).toBe(404)
    expect(prisma.personalAccessToken.findFirst).toHaveBeenCalledWith({ where: { id: 'other', userId: USER_ID } })

    prisma.personalAccessToken.findFirst.mockResolvedValue({ id: 'pat-1', userId: USER_ID })
    prisma.personalAccessToken.update.mockResolvedValue({})
    const r204 = await app.inject({ method: 'DELETE', url: '/user/tokens/pat-1', headers: { authorization: `Bearer ${jwt}` } })
    expect(r204.statusCode).toBe(204)
    expect(prisma.personalAccessToken.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date)
  })

  it('un jeton personnel ne peut pas gérer les jetons', async () => {
    const { token, tokenHash } = generatePersonalToken()
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat-1', name: 'x', tokenHash, scope: 'write', revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
      user: { id: USER_ID, email: 'test@test.com', disabledAt: null, globalRole: 'USER', mcpAccessGrantedAt: new Date() },
    })
    const res = await app.inject({ method: 'GET', url: '/user/tokens', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(403)
  })

  it("création de jeton refusée tant que l'admin n'a pas accordé l'accès MCP", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow())
    const res = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: 'x', scope: 'read' } })
    expect(res.statusCode).toBe(403)
    expect(prisma.personalAccessToken.create).not.toHaveBeenCalled()
  })

  it("GET /mcp-access : état de l'accès (admin global toujours accordé)", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow())
    const r1 = await app.inject({ method: 'GET', url: '/user/mcp-access', headers: { authorization: `Bearer ${jwt}` } })
    expect(r1.json()).toMatchObject({ granted: false, requestedAt: null, viaAdminRole: false })
    prisma.user.findUnique.mockResolvedValue(userRow({ globalRole: 'ADMIN' }))
    const r2 = await app.inject({ method: 'GET', url: '/user/mcp-access', headers: { authorization: `Bearer ${jwt}` } })
    expect(r2.json()).toMatchObject({ granted: true, viaAdminRole: true })
  })

  it("demande d'accès : enregistrée et notifiée aux admins actifs, sans doublon si déjà en attente", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow())
    prisma.user.update.mockResolvedValue({})
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
    prisma.notification.create.mockResolvedValue({})
    const res = await app.inject({ method: 'POST', url: '/user/mcp-access/request', headers: { authorization: `Bearer ${jwt}` } })
    expect(res.statusCode).toBe(200)
    expect(prisma.user.update.mock.calls[0][0].data.mcpAccessRequestedAt).toBeInstanceOf(Date)
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ globalRole: 'ADMIN', disabledAt: null })
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
    expect(prisma.notification.create.mock.calls[0][0].data.type).toBe('MCP_ACCESS_REQUEST')

    prisma.user.findUnique.mockResolvedValue(userRow({ mcpAccessRequestedAt: new Date() }))
    await app.inject({ method: 'POST', url: '/user/mcp-access/request', headers: { authorization: `Bearer ${jwt}` } })
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it("demande d'accès refusée si l'accès est déjà accordé", async () => {
    const res = await app.inject({ method: 'POST', url: '/user/mcp-access/request', headers: { authorization: `Bearer ${jwt}` } })
    expect(res.statusCode).toBe(400)
  })
})
