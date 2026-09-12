/*
 * TNR de POST /spaces/:spaceId/items/from-template : cree toute l'arborescence d'un modele
 * en une fois, controle d'acces identique a la creation d'item classique.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemsRoutes } from './items.js'

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
  await app.register(async function (opt) {
    opt.addHook('preHandler', opt.optionalAuthenticate)
    await opt.register(itemsRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

describe('POST /spaces/:spaceId/items/from-template', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('creates the root item and its children from the template structure', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      structure: { title: 'Réunion', type: 'MEETING', children: [{ title: 'Rédiger l\'ODJ', type: 'TASK', children: [] }] },
    })
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe('item-1')
    expect(res.json().title).toBe('Réunion')
    expect(prisma.item.create).toHaveBeenCalledTimes(2)
  })

  it('inserts under parentId when provided', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      structure: { title: 'Réunion', type: 'MEETING', children: [] },
    })
    prisma.item.create.mockResolvedValue({ id: 'item-1', title: 'Réunion', type: 'MEETING', parentId: 'parent-1' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1', parentId: 'parent-1' },
    })

    expect(res.statusCode).toBe(201)
    expect(prisma.item.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: 'parent-1' }) })
    )
  })

  it('returns 404 for an unknown template', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'unknown' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('forbids viewers from creating items from a template', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'VIEWER' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1' },
    })

    expect(res.statusCode).toBe(403)
  })
})
