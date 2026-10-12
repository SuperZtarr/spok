/*
 * TNR de POST /mcp : refus sans jeton personnel (JWT web refusé), initialize + tools/list selon la portée,
 * appel d'outil rejoué sur les routes REST via inject avec le jeton de l'appelant, sans mode admin,
 * limites de débit : par IP avant authentification (faux jetons en rafale), par jeton après (en-têtes variés).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { mcpRoutes } from './mcp.js'
import { generatePersonalToken } from '../utils/personalTokens.js'
import { resetTokenRateLimits, MCP_REQUESTS_PER_MINUTE_PER_TOKEN, MCP_REQUESTS_PER_MINUTE_PER_IP } from '../mcp/tokenRateLimit.js'

const HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  await app.register(rateLimit, { global: false })
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  // Le faux socket de fastify.inject n'a pas destroySoon, que @hono/node-server (transport du SDK MCP)
  // appelle 500 ms après la réponse pour drainer la requête. Un vrai socket l'a : correctif propre aux tests.
  app.addHook('onRequest', (req, _reply, done) => {
    const socket = req.raw.socket as any
    if (socket && typeof socket.destroySoon !== 'function') socket.destroySoon = () => socket.destroy?.()
    done()
  })
  // Route REST factice pour observer les sous-requêtes des outils
  app.get('/communities', { preHandler: [app.authenticate] }, async (req) => [
    { id: 'c1', name: `vue par ${req.user.userId} admin=${req.isAdminMode}` },
  ])
  await app.register(mcpRoutes)
  await app.ready()
  return { app, prisma }
}

function rpc(method: string, params: unknown = {}, id = 1) {
  return { jsonrpc: '2.0', id, method, params }
}

const INIT = rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } })

// Laisse expirer les minuteurs de drain de @hono/node-server (500 ms) pour que leurs erreurs éventuelles
// remontent ici et non au hasard de la durée de la suite (CI rouge du 2026-10-12 sur 414dabd).
afterAll(() => new Promise((r) => setTimeout(r, 700)))

describe('POST /mcp', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  function withScope(scope: 'read' | 'write') {
    const g = generatePersonalToken()
    token = g.token
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat-1', name: 'Claude perso', tokenHash: g.tokenHash, scope, revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
      user: { id: 'u1', email: 'u1@test.com', disabledAt: null, globalRole: 'USER', mcpAccessGrantedAt: new Date() },
    })
  }

  beforeEach(async () => {
    resetTokenRateLimits()
    ;({ app, prisma } = await buildApp())
  })

  it('401 sans authentification : WWW-Authenticate + marche à suivre', async () => {
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: HEADERS, payload: INIT })
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toMatch(/^Bearer realm="spok"/)
    expect(res.json().message).toMatch(/Accès Claude/)
    expect(res.json().help).toBe('https://spok.space/llms.txt')
  })

  it('401 explicite avec un jeton personnel invalide', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${generatePersonalToken().token}` }, payload: INIT })
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toMatch(/error="invalid_token"/)
    expect(res.json().message).toMatch(/révoqué|expiré|invalide/)
  })

  it('403 avec un JWT de session web, avec la marche à suivre', async () => {
    const jwt = getTestToken(app)
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${jwt}` }, payload: INIT })
    expect(res.statusCode).toBe(403)
    expect(res.json().help).toBe('https://spok.space/llms.txt')
  })

  it('refuse un lot JSON-RPC (tableau) : un seul message par requête', async () => {
    withScope('write')
    const res = await app.inject({
      method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${token}` },
      payload: [rpc('tools/list', {}, 1), rpc('tools/list', {}, 2)],
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toMatch(/lot/i)
  })

  it('initialize renvoie les instructions SPOK', async () => {
    withScope('write')
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${token}` }, payload: INIT })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.instructions).toContain('get_space_conventions')
  })

  it('portée read : tools/list sans outil d\'écriture', async () => {
    withScope('read')
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${token}` }, payload: rpc('tools/list') })
    const names = res.json().result.tools.map((t: any) => t.name)
    expect(names).toContain('get_item')
    expect(names).not.toContain('create_item')
  })

  it('tools/call rejoue la route REST avec l\'identité du jeton, sans mode admin', async () => {
    withScope('write')
    const res = await app.inject({
      method: 'POST', url: '/mcp',
      headers: { ...HEADERS, authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
      payload: rpc('tools/call', { name: 'list_communities', arguments: {} }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.content[0].text).toContain('vue par u1 admin=false')
  })

  it('limite par jeton : varier l\x27écriture de l\x27en-tête ne crée pas de nouveau compteur', async () => {
    withScope('write')
    const variants = [`Bearer ${token}`, `Bearer  ${token}`, `Bearer ${token} `]
    for (let i = 0; i < MCP_REQUESTS_PER_MINUTE_PER_TOKEN; i++) {
      const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: variants[i % 3] }, payload: rpc('tools/list') })
      expect(res.statusCode).toBe(200)
    }
    const over = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: variants[1] }, payload: rpc('tools/list') })
    expect(over.statusCode).toBe(429)
  })

  it('limite par IP avant authentification : faux jetons en rafale → 429', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    let last = 0
    for (let i = 0; i <= MCP_REQUESTS_PER_MINUTE_PER_IP; i++) {
      const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer spok_pat_faux${i}` }, payload: INIT })
      last = res.statusCode
    }
    expect(last).toBe(429)
  })

  it('GET /mcp → 405 avec les instructions de connexion', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp' })
    expect(res.statusCode).toBe(405)
    expect(res.json().error.message).toMatch(/claude mcp add/)
  })
})
