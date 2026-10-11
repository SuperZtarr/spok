/*
 * TNR de l'authentification par jeton personnel (spok_pat_…) dans authenticate/optionalAuthenticate :
 * jeton valide → request.user, révoqué/expiré/utilisateur désactivé → 401, portée read → 403 sur écriture,
 * mode admin toujours désactivé pour un jeton.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from './jwt.js'
import { generatePersonalToken } from '../utils/personalTokens.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  app.get('/spaces/probe', { preHandler: [app.authenticate] }, async (req) => ({
    userId: req.user.userId, via: req.authVia, admin: req.isAdminMode, scope: req.personalToken?.scope ?? null,
  }))
  app.post('/spaces/probe', { preHandler: [app.authenticate] }, async () => ({ ok: true }))
  app.get('/search/optional', { preHandler: [app.optionalAuthenticate] }, async (req) => ({ userId: req.user?.userId ?? null }))
  app.get('/spaces/s1', { preHandler: [app.authenticate] }, async () => ({ ok: true }))
  app.patch('/user/profile', { preHandler: [app.authenticate] }, async () => ({ changed: true }))
  await app.ready()
  return { app, prisma }
}

function tokenRow(tokenHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'pat-1', name: 'Claude perso', tokenHash, scope: 'write', userId: 'u1',
    revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
    user: { id: 'u1', email: 'u1@test.com', disabledAt: null },
    ...overrides,
  }
}

describe('Jeton personnel', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string
  let tokenHash: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    ;({ token, tokenHash } = generatePersonalToken())
  })

  it('authentifie un jeton valide, sans mode admin même si l\'en-tête est envoyé', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash))
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: 'u1', via: 'pat', admin: false, scope: 'write' })
    expect(prisma.personalAccessToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash } }))
  })

  it('refuse un jeton révoqué', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { revokedAt: new Date() }))
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse un jeton expiré', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { expiresAt: new Date(Date.now() - 1000) }))
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse le jeton d\'un utilisateur désactivé', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { user: { id: 'u1', email: 'u1@test.com', disabledAt: new Date() } }))
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse un jeton inconnu', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('portée read : GET autorisé, POST refusé en 403', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { scope: 'read' }))
    const get = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(get.statusCode).toBe(200)
    const post = await app.inject({ method: 'POST', url: '/spaces/probe', headers: { authorization: `Bearer ${token}` } })
    expect(post.statusCode).toBe(403)
  })

  it('optionalAuthenticate : jeton invalide → anonyme, pas d\'erreur', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/search/optional', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: null })
  })

  it('un jeton n\'ouvre que les routes du périmètre MCP (pas le compte : email/mot de passe)', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash))
    const ok = await app.inject({ method: 'GET', url: '/spaces/s1', headers: { authorization: `Bearer ${token}` } })
    expect(ok.statusCode).toBe(200)
    const profile = await app.inject({ method: 'PATCH', url: '/user/profile', headers: { authorization: `Bearer ${token}` }, payload: { email: 'x@evil.test' } })
    expect(profile.statusCode).toBe(403)
  })

  it('un JWT classique continue de fonctionner (authVia = jwt)', async () => {
    const jwt = app.jwt.sign({ userId: 'u2', email: 'u2@test.com' })
    const res = await app.inject({ method: 'GET', url: '/spaces/probe', headers: { authorization: `Bearer ${jwt}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().via).toBe('jwt')
  })
})
