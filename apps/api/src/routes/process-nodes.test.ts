/*
 * TNR de /spaces/:spaceId/process-nodes (positions des items sur le canevas de la vue Process) :
 * lecture pour tout accès, écriture OWNER/MEMBER, item obligatoirement dans l'espace, validation x/y.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { processNodesRoutes } from './process-nodes.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(processNodesRoutes, { prefix: '/spaces' })

  await app.ready()
  return { app, prisma }
}

function asMember(prisma: MockPrisma, role: 'OWNER' | 'MEMBER' | 'VIEWER') {
  prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm1', userId: USER_ID, spaceId: 's1', role })
}

describe('Process nodes routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let headers: Record<string, string>

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    headers = { authorization: `Bearer ${getTestToken(app, { userId: USER_ID, email: 'test@test.com' })}` }
  })

  it('GET renvoie les positions du space', async () => {
    asMember(prisma, 'VIEWER')
    prisma.processNode.findMany.mockResolvedValue([{ itemId: 'i1', x: 10, y: 20 }])

    const res = await app.inject({ method: 'GET', url: '/spaces/s1/process-nodes', headers })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([{ itemId: 'i1', x: 10, y: 20 }])
    expect(prisma.processNode.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { spaceId: 's1' } }))
  })

  it('GET sans accès → 404', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue(null)

    const res = await app.inject({ method: 'GET', url: '/spaces/s1/process-nodes', headers })

    expect(res.statusCode).toBe(404)
  })

  it('PUT upsert la position', async () => {
    asMember(prisma, 'MEMBER')
    prisma.item.findFirst.mockResolvedValue({ id: 'i1' })
    prisma.processNode.upsert.mockResolvedValue({ itemId: 'i1', x: 1.5, y: -3 })

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes/i1', headers, payload: { x: 1.5, y: -3 } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ itemId: 'i1', x: 1.5, y: -3 })
    expect(prisma.processNode.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { spaceId_itemId: { spaceId: 's1', itemId: 'i1' } },
    }))
  })

  it('PUT par un VIEWER → 403', async () => {
    asMember(prisma, 'VIEWER')

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes/i1', headers, payload: { x: 1, y: 2 } })

    expect(res.statusCode).toBe(403)
    expect(prisma.processNode.upsert).not.toHaveBeenCalled()
  })

  it('PUT sur item d\'un autre espace → 404', async () => {
    asMember(prisma, 'OWNER')
    prisma.item.findFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes/other', headers, payload: { x: 1, y: 2 } })

    expect(res.statusCode).toBe(404)
    expect(prisma.processNode.upsert).not.toHaveBeenCalled()
  })

  it('PUT avec x non numérique → 400', async () => {
    asMember(prisma, 'OWNER')
    prisma.item.findFirst.mockResolvedValue({ id: 'i1' })

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes/i1', headers, payload: { x: 'a', y: 2 } })

    expect(res.statusCode).toBe(400)
    expect(prisma.processNode.upsert).not.toHaveBeenCalled()
  })

  it('PUT groupé enregistre toutes les positions des items de l\'espace', async () => {
    asMember(prisma, 'MEMBER')
    prisma.item.findMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }])
    prisma.processNode.upsert.mockImplementation(async (args: any) => ({ itemId: args.create.itemId, x: args.create.x, y: args.create.y }))

    const res = await app.inject({
      method: 'PUT', url: '/spaces/s1/process-nodes', headers,
      payload: { positions: [{ itemId: 'i1', x: 0, y: 0 }, { itemId: 'i2', x: 260, y: 0 }, { itemId: 'ghost', x: 1, y: 1 }] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([{ itemId: 'i1', x: 0, y: 0 }, { itemId: 'i2', x: 260, y: 0 }])
    expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['i1', 'i2', 'ghost'] }, spaceId: 's1' } }))
    expect(prisma.processNode.upsert).toHaveBeenCalledTimes(2)
  })

  it('PUT groupé par un VIEWER → 403', async () => {
    asMember(prisma, 'VIEWER')

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes', headers, payload: { positions: [{ itemId: 'i1', x: 0, y: 0 }] } })

    expect(res.statusCode).toBe(403)
    expect(prisma.processNode.upsert).not.toHaveBeenCalled()
  })

  it('PUT groupé avec une position invalide → 400', async () => {
    asMember(prisma, 'OWNER')

    const res = await app.inject({ method: 'PUT', url: '/spaces/s1/process-nodes', headers, payload: { positions: [{ itemId: 'i1', x: 'a', y: 0 }] } })

    expect(res.statusCode).toBe(400)
    expect(prisma.processNode.upsert).not.toHaveBeenCalled()
  })

  it('DELETE retire le nœud → 204', async () => {
    asMember(prisma, 'MEMBER')
    prisma.processNode.deleteMany.mockResolvedValue({ count: 1 })

    const res = await app.inject({ method: 'DELETE', url: '/spaces/s1/process-nodes/i1', headers })

    expect(res.statusCode).toBe(204)
    expect(prisma.processNode.deleteMany).toHaveBeenCalledWith({ where: { spaceId: 's1', itemId: 'i1' } })
  })
})
