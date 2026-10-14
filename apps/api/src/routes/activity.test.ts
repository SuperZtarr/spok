/*
 * TNR de /activity : « Marquer comme non lu » (ItemView.markedUnread) — pose via POST /items/:id/unread,
 * effacement par POST /items/:id/view, inclusion dans le feed hors fenêtre 60 j / auteur / espace perso.
 * Accès : le feed ne porte que sur les espaces lisibles (filterReadableSpaceIds, mocké ici — sa règle est
 * testée avec items/graph) ; un espace privé de la communauté non lisible n'est jamais interrogé.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { activityRoutes, PERSONAL_GROUP_ID } from './activity.js'

const USER_ID = 'test-user-id'

// Règle d'accès contrôlée par le test : espaces lisibles = READABLE
let READABLE = new Set<string>()
vi.mock('./items.js', () => ({
  filterReadableSpaceIds: vi.fn(async (_p: unknown, _u: unknown, ids: string[]) => ids.filter((id) => READABLE.has(id))),
}))

/** Dernier appel item.findMany = requête du feed (le premier, éventuel, résout les espaces des items marqués). */
const feedWhere = (prisma: MockPrisma) => prisma.item.findMany.mock.calls.at(-1)![0].where

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(activityRoutes, { prefix: '/activity' })
  await app.ready()
  return { app, prisma }
}

describe('Activity routes — marquer comme non lu', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const r = await buildApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('POST /items/:id/unread pose la marque (upsert markedUnread: true)', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'item-1' })
    prisma.itemView.upsert.mockResolvedValue({})
    const res = await app.inject({ method: 'POST', url: '/activity/items/item-1/unread', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(204)
    const arg = prisma.itemView.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ userId_itemId: { userId: USER_ID, itemId: 'item-1' } })
    expect(arg.create.markedUnread).toBe(true)
    expect(arg.update).toEqual({ markedUnread: true })
  })

  it('POST /items/:id/unread → 404 si item introuvable', async () => {
    prisma.item.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'POST', url: '/activity/items/nope/unread', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(404)
    expect(prisma.itemView.upsert).not.toHaveBeenCalled()
  })

  it('POST /items/:id/view efface la marque', async () => {
    prisma.itemView.upsert.mockResolvedValue({})
    const res = await app.inject({ method: 'POST', url: '/activity/items/item-1/view', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(204)
    expect(prisma.itemView.upsert.mock.calls[0][0].update.markedUnread).toBe(false)
  })

  it('GET / inclut un item marqué non lu d\'un espace perso, ancien et modifié par soi', async () => {
    READABLE = new Set(['sp-perso'])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.itemView.findMany.mockResolvedValue([{ itemId: 'perso-1' }])
    const old = new Date('2025-01-01T00:00:00Z')
    prisma.item.findMany.mockResolvedValue([{
      id: 'perso-1', title: 'À revoir', type: 'NOTE', status: null, spaceId: 'sp-perso',
      updatedAt: old, createdAt: old,
      space: { id: 'sp-perso', name: 'Mon espace', parentId: null, communityId: null, avatarUrl: null, coverUrl: null, community: null },
      updatedBy: { id: USER_ID, name: 'Moi', avatarUrl: null },
      views: [{ viewedAt: new Date(), markedUnread: true }],
      contributions: [],
    }])
    const res = await app.inject({ method: 'GET', url: '/activity', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.groups[0].community.id).toBe(PERSONAL_GROUP_ID)
    expect(body.groups[0].spaces[0].items[0].id).toBe('perso-1')
    // la requête inclut bien les ids marqués
    const where = feedWhere(prisma)
    expect(JSON.stringify(where)).toContain('perso-1')
  })

  it('GET / : un espace privé de la communauté non lisible n\'est jamais interrogé', async () => {
    READABLE = new Set(['sp-open'])
    prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
    prisma.itemView.findMany.mockResolvedValue([])
    prisma.space.findMany.mockResolvedValue([{ id: 'sp-open' }, { id: 'sp-private' }])
    prisma.item.findMany.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/activity', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(feedWhere(prisma).OR[0].spaceId).toEqual({ in: ['sp-open'] })
    expect(JSON.stringify(feedWhere(prisma))).not.toContain('sp-private')
  })

  it('GET / : un espace privé dont on est membre direct reste dans le feed', async () => {
    READABLE = new Set(['sp-open', 'sp-private'])
    prisma.communityMembership.findMany.mockResolvedValue([{ communityId: 'com-1' }])
    prisma.itemView.findMany.mockResolvedValue([])
    prisma.space.findMany.mockResolvedValue([{ id: 'sp-open' }, { id: 'sp-private' }])
    prisma.item.findMany.mockResolvedValue([])
    await app.inject({ method: 'GET', url: '/activity', headers: { authorization: `Bearer ${token}` } })
    expect(feedWhere(prisma).OR[0].spaceId).toEqual({ in: ['sp-open', 'sp-private'] })
  })

  it('GET / : un item marqué non lu dans un espace devenu inaccessible est exclu', async () => {
    READABLE = new Set()
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.itemView.findMany.mockResolvedValue([{ itemId: 'gone-1' }])
    prisma.item.findMany.mockResolvedValue([{ spaceId: 'sp-closed' }])
    await app.inject({ method: 'GET', url: '/activity', headers: { authorization: `Bearer ${token}` } })
    expect(feedWhere(prisma).OR[1]).toEqual({ id: { in: ['gone-1'] }, spaceId: { in: [] } })
  })

  it('GET / sans communauté ni marque → vide, sans requête items', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.itemView.findMany.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/activity', headers: { authorization: `Bearer ${token}` } })
    expect(res.json()).toEqual({ groups: [], total: 0 })
    expect(prisma.item.findMany).not.toHaveBeenCalled()
  })
})
