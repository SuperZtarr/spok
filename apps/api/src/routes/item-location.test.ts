/* TNR de GET /items/:id/location (règle item-share-link) : lecteur de l'espace → spaceId ; élément absent ou espace
 * illisible → même 404 (rien n'est dévoilé) ; visiteur anonyme sur un espace lisible accepté.
 * checkSpaceAccess est simulé : on teste la route, pas les règles d'accès (couvertes par leurs propres tests). */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { jwtPlugin } from '../plugins/jwt.js'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'

const checkSpaceAccess = vi.fn()
vi.mock('./items.js', () => ({ checkSpaceAccess: (...args: unknown[]) => checkSpaceAccess(...args) }))

const { itemLocationRoutes } = await import('./item-location.js')

describe('Espace d\'un élément par son identifiant', () => {
  let app: FastifyInstance
  let prisma: MockPrisma

  beforeEach(async () => {
    checkSpaceAccess.mockReset()
    app = Fastify({ logger: false })
    prisma = createMockPrisma()
    await app.register(sensible)
    app.decorate('prisma', prisma as any)
    await app.register(jwtPlugin)
    await app.register(itemLocationRoutes, { prefix: '/items' })
    await app.ready()
  })

  const get = (auth = true) => app.inject({
    method: 'GET', url: '/items/i1/location',
    headers: auth ? { authorization: `Bearer ${getTestToken(app)}` } : {},
  })

  it('lecteur de l\'espace : renvoie seulement spaceId', async () => {
    prisma.item.findUnique.mockResolvedValue({ spaceId: 's1' })
    checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ spaceId: 's1' })
    expect(checkSpaceAccess.mock.calls[0][1]).toBe('test-user-id')
    expect(checkSpaceAccess.mock.calls[0][2]).toBe('s1')
  })

  it('espace illisible : 404, comme un élément absent', async () => {
    prisma.item.findUnique.mockResolvedValue({ spaceId: 's1' })
    checkSpaceAccess.mockResolvedValue(null)
    const denied = await get()
    prisma.item.findUnique.mockResolvedValue(null)
    const missing = await get()
    expect(denied.statusCode).toBe(404)
    expect(missing.statusCode).toBe(404)
    expect(denied.json().message).toBe(missing.json().message)
  })

  it('visiteur anonyme sur un espace lisible : accepté', async () => {
    prisma.item.findUnique.mockResolvedValue({ spaceId: 's1' })
    checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
    const res = await get(false)
    expect(res.statusCode).toBe(200)
    expect(checkSpaceAccess.mock.calls[0][1]).toBeUndefined()
  })
})
