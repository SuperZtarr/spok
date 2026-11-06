/* TNR des relations : création + détection de cycle
 * pour drives ("Entraîne", spec 2026-09-13), refus des types hors RELATION_TYPES (2026-09-28).
 * GET /:id/links : tout lien vers un espace illisible est retiré (parent, enfants, relations), sauf en mode admin. */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemRelationsRoutes } from './item-relations.js'

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
    opt.addHook('preHandler', opt.authenticate)
    await opt.register(itemRelationsRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockItem(id: string, spaceId = 'space-1') {
  return { id, spaceId, title: `Item ${id}` }
}

describe('POST /spaces/:spaceId/items/:id/relations', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemRelation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rel-1', ...data }))
  })

  it('crée une relation blocks (régression de base)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'blocks' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('crée une relation drives sans relation existante (pas de cycle)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis B : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('rejette une relation drives vers soi-même', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('rejette une relation drives qui créerait un cycle (A drives B drives C, tentative C drives A)', async () => {
    // Création : C (fromItemId=C, params.id='C') drives A (toItemId='A')
    // BFS depuis toItemId='A' : A->B->C — C est atteignable depuis A -> cycle
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'C' }]) // frontier [B]
      .mockResolvedValueOnce([])                   // frontier [C]

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/C/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('autorise une relation drives qui ne crée pas de cycle (D n\'a pas de sortant)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('B'))
      .mockResolvedValueOnce(mockItem('D'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis D : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/B/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'D', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })
})

describe('GET /spaces/:spaceId/items/:id/links (vue Loupe)', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  const linked = (id: string, spaceId = 'space-1') => ({
    id, title: `Item ${id}`, type: 'TASK', status: null, spaceId, space: { name: `Espace ${spaceId}` },
    url: null, priority: 2, dueDate: null, startDate: null, endDate: null, assignedToName: 'Sans compte', assignedTo: null, _count: { children: 3 },
  })
  const get = (id = 'A') => app.inject({ method: 'GET', url: `/spaces/space-1/items/${id}/links`, headers: { authorization: `Bearer ${token}` } })

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.space.findMany.mockResolvedValue([])
  })

  it('renvoie parent, enfants et relations avec le nom de leur espace', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }, { spaceId: 'space-2' }])
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: '<p>Texte</p>', parent: linked('P'), children: [linked('C')],
      relationsFrom: [{ type: 'blocks', label: 'motif', toItem: linked('X', 'space-2') }],
      relationsTo: [{ type: 'relates', label: null, fromItem: linked('Y') }],
    })

    const res = await get()

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.item).toMatchObject({ id: 'A', description: '<p>Texte</p>', spaceName: 'Espace space-1' })
    expect(body.links.map((l: any) => [l.kind, l.direction, l.item.id])).toEqual([
      ['parent', undefined, 'P'], ['child', undefined, 'C'], ['relation', 'from', 'X'], ['relation', 'to', 'Y'],
    ])
    expect(body.links[2]).toMatchObject({ relationType: 'blocks', relationLabel: 'motif', item: { spaceId: 'space-2', spaceName: 'Espace space-2' } })
  })

  it('renvoie les champs des vignettes : assigné avec compte prioritaire, nombre d\'enfants', async () => {
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: null, parent: { ...linked('P'), assignedTo: { name: 'Avec compte' } }, children: [], relationsFrom: [], relationsTo: [],
    })
    const body = (await get()).json()
    expect(body.item).toMatchObject({ priority: 2, assigneeName: 'Sans compte', childCount: 3 })
    expect(body.links[0].item.assigneeName).toBe('Avec compte')
  })

  it('retire les relations vers un espace illisible, dans les deux sens', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }])
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: null, parent: null, children: [],
      relationsFrom: [{ type: 'blocks', label: null, toItem: linked('SECRET1', 'space-3') }, { type: 'relates', label: null, toItem: linked('B') }],
      relationsTo: [{ type: 'drives', label: null, fromItem: linked('SECRET2', 'space-3') }],
    })

    const res = await get()

    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('SECRET')
    expect(res.json().links.map((l: any) => l.item.id)).toEqual(['B'])
  })

  it('retire un parent et un enfant situés dans un espace illisible', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-1' }])
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: null, parent: linked('SECRET-P', 'space-3'), children: [linked('SECRET-C', 'space-3'), linked('C')],
      relationsFrom: [], relationsTo: [],
    })

    const res = await get()

    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('SECRET')
    expect(res.json().links.map((l: any) => [l.kind, l.item.id])).toEqual([['child', 'C']])
  })

  it('garde parent et enfants de l\'espace courant, et ceux d\'un autre espace lisible', async () => {
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: 'space-2' }])
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: null, parent: linked('P'), children: [linked('C'), linked('D', 'space-2')],
      relationsFrom: [], relationsTo: [],
    })

    const res = await get()

    expect(res.json().links.map((l: any) => l.item.id)).toEqual(['P', 'C', 'D'])
  })

  it('mode admin : parent et enfants d\'un espace privé restent visibles', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
    prisma.item.findFirst.mockResolvedValue({
      ...linked('A'), description: null, parent: linked('P', 'space-3'), children: [linked('C', 'space-3')],
      relationsFrom: [], relationsTo: [],
    })

    const res = await app.inject({
      method: 'GET', url: '/spaces/space-1/items/A/links',
      headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
    })

    expect(res.json().links.map((l: any) => l.item.id)).toEqual(['P', 'C'])
  })

  it('404 si l\'item n\'est pas dans cet espace', async () => {
    prisma.item.findFirst.mockResolvedValue(null)
    expect((await get('Z')).statusCode).toBe(404)
  })

  it('404 sans accès à l\'espace, sans lire l\'item', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue(null)
    expect((await get()).statusCode).toBe(404)
    expect(prisma.item.findFirst).not.toHaveBeenCalled()
  })
})

describe('Types de relation acceptés (RELATION_TYPES uniquement, 2026-09-28)', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
  })

  it.each(['depends', 'tests', 'duplicates', 'n-importe-quoi'])('POST refuse le type hors liste %s (400)', async (type) => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type },
    })
    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('PATCH refuse un type hors liste (400)', async () => {
    prisma.itemRelation.findFirst.mockResolvedValue({ id: 'rel-1', fromItemId: 'A', toItemId: 'B', type: 'blocks', label: null })
    const res = await app.inject({
      method: 'PATCH', url: '/spaces/space-1/items/A/relations/rel-1',
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'depends' },
    })
    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.update).not.toHaveBeenCalled()
  })
})
