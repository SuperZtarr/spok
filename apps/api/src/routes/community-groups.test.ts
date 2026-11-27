/*
 * TNR de /community-groups : groupes personnels de communautés (liste, création, renommage, ordre, suppression,
 * rangement). Vérifie surtout que l'on ne touche jamais aux groupes d'un autre utilisateur et qu'une communauté
 * privée non visible ne peut pas être rangée.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { communityGroupsRoutes } from './community-groups.js'

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
  await app.register(communityGroupsRoutes, { prefix: '/community-groups' })
  await app.ready()
  return { app, prisma }
}

const group = (overrides: Record<string, unknown> = {}) => ({
  id: 'g1', userId: USER_ID, name: 'Pro', order: 0, createdAt: new Date(), ...overrides,
})

describe('Community groups routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let auth: { authorization: string }

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    auth = { authorization: `Bearer ${getTestToken(app, { userId: USER_ID, email: 'test@test.com' })}` }
  })

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/community-groups' })
    expect(res.statusCode).toBe(401)
  })

  it('lists only the current user groups with their community ids', async () => {
    prisma.communityGroup.findMany.mockResolvedValue([{ ...group(), assignments: [{ communityId: 'c1' }] }])
    const res = await app.inject({ method: 'GET', url: '/community-groups', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([{ id: 'g1', name: 'Pro', order: 0, communityIds: ['c1'] }])
    expect(prisma.communityGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID } }))
  })

  it('creates a group after the last one', async () => {
    prisma.communityGroup.findFirst.mockResolvedValue({ order: 2 })
    prisma.communityGroup.create.mockResolvedValue(group({ order: 3 }))
    const res = await app.inject({ method: 'POST', url: '/community-groups', headers: auth, payload: { name: '  Pro ' } })
    expect(res.statusCode).toBe(201)
    expect(prisma.communityGroup.create).toHaveBeenCalledWith({ data: { userId: USER_ID, name: 'Pro', order: 3 } })
  })

  it('rejects an empty name', async () => {
    const res = await app.inject({ method: 'POST', url: '/community-groups', headers: auth, payload: { name: '  ' } })
    expect(res.statusCode).toBe(400)
  })

  it('refuses to rename or delete a group of another user', async () => {
    prisma.communityGroup.findUnique.mockResolvedValue(group({ userId: 'someone-else' }))
    const patch = await app.inject({ method: 'PATCH', url: '/community-groups/g1', headers: auth, payload: { name: 'X' } })
    const del = await app.inject({ method: 'DELETE', url: '/community-groups/g1', headers: auth })
    expect(patch.statusCode).toBe(404)
    expect(del.statusCode).toBe(404)
    expect(prisma.communityGroup.update).not.toHaveBeenCalled()
    expect(prisma.communityGroup.delete).not.toHaveBeenCalled()
  })

  it('deletes an own group', async () => {
    prisma.communityGroup.findUnique.mockResolvedValue(group())
    prisma.communityGroup.delete.mockResolvedValue(group())
    const res = await app.inject({ method: 'DELETE', url: '/community-groups/g1', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(prisma.communityGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } })
  })

  it('reorders only when every id is an own group', async () => {
    prisma.communityGroup.findMany.mockResolvedValue([{ id: 'g1' }])
    const res = await app.inject({ method: 'PUT', url: '/community-groups/order', headers: auth, payload: { ids: ['g1', 'g2'] } })
    expect(res.statusCode).toBe(404)
    expect(prisma.communityGroup.update).not.toHaveBeenCalled()
  })

  it('reorders own groups by position', async () => {
    prisma.communityGroup.findMany.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }])
    const res = await app.inject({ method: 'PUT', url: '/community-groups/order', headers: auth, payload: { ids: ['g2', 'g1'] } })
    expect(res.statusCode).toBe(200)
    expect(prisma.communityGroup.update).toHaveBeenCalledWith({ where: { id: 'g2' }, data: { order: 0 } })
    expect(prisma.communityGroup.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { order: 1 } })
  })

  it('unassigns a community with groupId null', async () => {
    const res = await app.inject({ method: 'PUT', url: '/community-groups/assign', headers: auth, payload: { communityId: 'c1', groupId: null } })
    expect(res.statusCode).toBe(200)
    expect(prisma.communityGroupAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID, communityId: 'c1' } })
  })

  it('assigns a visible public community to an own group', async () => {
    prisma.communityGroup.findUnique.mockResolvedValue(group())
    prisma.community.findUnique.mockResolvedValue({ visibility: 'OPEN' })
    const res = await app.inject({ method: 'PUT', url: '/community-groups/assign', headers: auth, payload: { communityId: 'c1', groupId: 'g1' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.communityGroupAssignment.upsert).toHaveBeenCalledWith({
      where: { userId_communityId: { userId: USER_ID, communityId: 'c1' } },
      create: { userId: USER_ID, communityId: 'c1', groupId: 'g1' },
      update: { groupId: 'g1' },
    })
  })

  it('refuses to assign a private community the user cannot see', async () => {
    prisma.communityGroup.findUnique.mockResolvedValue(group())
    prisma.community.findUnique.mockResolvedValue({ visibility: 'PRIVATE' })
    prisma.communityMembership.findUnique.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ email: 'test@test.com', globalRole: 'USER' })
    prisma.invitation.findFirst.mockResolvedValue(null)
    const res = await app.inject({ method: 'PUT', url: '/community-groups/assign', headers: auth, payload: { communityId: 'c1', groupId: 'g1' } })
    expect(res.statusCode).toBe(404)
    expect(prisma.communityGroupAssignment.upsert).not.toHaveBeenCalled()
  })

  it('refuses to assign into a group of another user', async () => {
    prisma.communityGroup.findUnique.mockResolvedValue(group({ userId: 'someone-else' }))
    const res = await app.inject({ method: 'PUT', url: '/community-groups/assign', headers: auth, payload: { communityId: 'c1', groupId: 'g1' } })
    expect(res.statusCode).toBe(404)
    expect(prisma.communityGroupAssignment.upsert).not.toHaveBeenCalled()
  })
})
