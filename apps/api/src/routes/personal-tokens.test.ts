/*
 * TNR de /user/tokens : création (jeton en clair renvoyé une seule fois, hash stocké), liste sans hash,
 * révocation scopée au propriétaire, refus de toute gestion de jetons authentifiée par un jeton.
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

describe('Personal tokens routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let jwt: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    jwt = getTestToken(app)
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
      user: { id: USER_ID, email: 'test@test.com', disabledAt: null },
    })
    const res = await app.inject({ method: 'GET', url: '/user/tokens', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(403)
  })
})
