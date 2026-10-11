/*
 * TNR du client interne du MCP distant : refus des chemins piégés (.., %2e, //, \) avant tout inject,
 * plafond de sous-requêtes par jeton et par minute (429), en-têtes internes transmis.
 */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { SpokApiError } from '@spok/mcp-core'
import { createInjectClient } from './injectClient.js'
import { INTERNAL_TOKEN_ID_HEADER } from './internal.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  const seen: string[] = []
  app.get('/*', async (req) => { seen.push(req.url); return { tokenId: req.headers[INTERNAL_TOKEN_ID_HEADER] } })
  await app.ready()
  return { app, seen }
}

describe('createInjectClient', () => {
  it('transmet l\'identité du jeton en en-tête interne', async () => {
    const { app } = await buildApp()
    const client = createInjectClient(app, 'Bearer x', { id: 'pat-a', name: 'n' })
    expect(await client.get('/spaces/s1')).toEqual({ tokenId: 'pat-a' })
  })

  it.each(['/spaces/s1/items/../../communities/c1', '/spaces/%2e%2e/x', '/spaces/%2E%2E/x', '//evil', '/spaces\\..\\x'])(
    'refuse le chemin piégé %s sans appeler la route',
    async (path) => {
      const { app, seen } = await buildApp()
      const client = createInjectClient(app, 'Bearer x', { id: 'pat-b', name: 'n' })
      await expect(client.get(path)).rejects.toBeInstanceOf(SpokApiError)
      expect(seen).toEqual([])
    },
  )

  it('plafonne les sous-requêtes par jeton et par minute (429)', async () => {
    const { app, seen } = await buildApp()
    const client = createInjectClient(app, 'Bearer x', { id: 'pat-c', name: 'n' }, { maxPerMinute: 3 })
    for (let i = 0; i < 3; i++) await client.get('/spaces/s1')
    await expect(client.get('/spaces/s1')).rejects.toMatchObject({ status: 429 })
    expect(seen).toHaveLength(3)
    // Un autre jeton n'est pas affecté
    const other = createInjectClient(app, 'Bearer y', { id: 'pat-d', name: 'n' }, { maxPerMinute: 3 })
    await expect(other.get('/spaces/s1')).resolves.toBeTruthy()
  })
})
