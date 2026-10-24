/*
 * TNR des routes d'article (type ARTICLE, 2026-10-23) : lecture (blocs résolus avec les droits de l'auteur de la
 * référence, lecteur sans accès à la source) et composition (ajout, texte, réglages, ordre, retrait).
 * checkSpaceAccess / filterReadableSpaceIds / getEffectiveVisibilities sont simulés pour piloter chaque cas de droits.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

const access = vi.hoisted(() => ({
  checkSpaceAccess: vi.fn(),
  filterReadableSpaceIds: vi.fn(),
  getEffectiveVisibilities: vi.fn(),
}))
vi.mock('../utils/articleAccess.js', () => access)
vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const ARTICLE = { id: 'art', type: 'ARTICLE', spaceId: SPACE, createdById: USER, assignedToId: null, lockedAt: null }
const ref = (id: string, spaceId: string, title: string) => ({
  id, type: 'NOTE', title, description: `<p>${title}</p>`, url: null, spaceId, createdById: 'other', assignedToId: null, lockedAt: null,
})
const block = (id: string, position: number, item: ReturnType<typeof ref>, addedById: string | null = USER) => ({
  id, articleId: 'art', itemId: item.id, position, width: 'full', align: 'center', addedById, item,
})
// readable[userId ?? 'anon'] = espaces lisibles
let readable: Record<string, string[]> = {}

describe('Article — lecture', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp({ optionalAuth: true }))
    readable = { [USER]: [SPACE, 'priv'] }
    access.checkSpaceAccess.mockReset().mockResolvedValue({ role: 'OWNER' })
    access.filterReadableSpaceIds.mockReset().mockImplementation(async (_p: unknown, userId: string | undefined, ids: string[]) =>
      ids.filter((id) => (readable[userId ?? 'anon'] ?? []).includes(id)))
    prisma.item.findFirst.mockResolvedValue(ARTICLE)
  })

  const read = (headers = auth()) => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/art/article`, headers })

  it('returns blocks in order with content', async () => {
    prisma.articleBlock.findMany.mockResolvedValue([block('b1', 0, ref('n1', SPACE, 'Intro')), block('b2', 1, ref('n2', SPACE, 'Suite'))])
    const res = await read()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.blocks.map((b: any) => b.item.title)).toEqual(['Intro', 'Suite'])
    expect(body.blocks[0]).toMatchObject({ available: true, item: { canOpen: true, spaceId: SPACE } })
    expect(body.canEditArticle).toBe(true)
  })

  it('unavailable block leaks nothing', async () => {
    prisma.articleBlock.findMany.mockResolvedValue([block('b1', 0, ref('s1', 'priv', 'Titre secret'), 'adder-x')])
    const res = await read()
    expect(res.json().blocks[0]).toMatchObject({ available: false, item: null })
    expect(res.body).not.toContain('Titre secret')
  })

  it('anonymous reader sees content without source access', async () => {
    access.checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
    prisma.articleBlock.findMany.mockResolvedValue([block('b1', 0, ref('s1', 'priv', 'Schéma privé'))])
    const res = await read({} as never)
    expect(res.statusCode).toBe(200)
    const b = res.json().blocks[0]
    expect(b.item).toMatchObject({ title: 'Schéma privé', canOpen: false, canEdit: false, spaceId: null })
    expect(res.json().canEditArticle).toBe(false)
  })

  it('envoie statut (avec libellé), priorité et dates d’un bloc', async () => {
    const task = { ...ref('t1', SPACE, 'Tâche'), type: 'TASK', status: 'todo', priority: 3, startDate: null, endDate: null, dueDate: new Date('2026-11-12T00:00:00Z') }
    prisma.articleBlock.findMany.mockResolvedValue([block('b1', 0, task as never)])
    prisma.space.findMany.mockResolvedValue([{ id: SPACE, community: { referentiels: { statuses: [{ id: 'todo', label: 'À lancer' }] } } }])
    const b = (await read()).json().blocks[0]
    expect(b.item).toMatchObject({ status: 'todo', statusLabel: 'À lancer', priority: 3, dueDate: '2026-11-12T00:00:00.000Z', startDate: null, endDate: null })
  })

  it('statut undefined ou espace sans communauté → libellés par défaut ou null', async () => {
    const t = (id: string, status: string) => ({ ...ref(id, SPACE, id), type: 'TASK', status, priority: null, startDate: null, endDate: null, dueDate: null })
    prisma.articleBlock.findMany.mockResolvedValue([block('b1', 0, t('u', 'undefined') as never), block('b2', 1, t('d', 'done') as never)])
    prisma.space.findMany.mockResolvedValue([{ id: SPACE, community: null }])
    const [u, d] = (await read()).json().blocks
    expect(u.item).toMatchObject({ status: null, statusLabel: null })
    expect(d.item).toMatchObject({ status: 'done', statusLabel: 'Terminé' })
  })

  it('404 for non-article item', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...ARTICLE, type: 'NOTE' })
    expect((await read()).statusCode).toBe(404)
  })
})

describe('Article — composition', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const url = (path: string) => `/spaces/${SPACE}/items/art/article${path}`
  const note = ref('n1', SPACE, 'Note')
  const vis = (entries: Record<string, [string, string, string]>) =>
    new Map(Object.entries(entries).map(([id, [visibility, communityId, communityVisibility]]) => [id, { visibility, communityId, communityVisibility }]))

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    readable = { [USER]: [SPACE, 'priv'] }
    access.checkSpaceAccess.mockReset().mockResolvedValue({ role: 'OWNER' })
    access.filterReadableSpaceIds.mockReset().mockImplementation(async (_p: unknown, userId: string | undefined, ids: string[]) =>
      ids.filter((id) => (readable[userId ?? 'anon'] ?? []).includes(id)))
    access.getEffectiveVisibilities.mockReset().mockResolvedValue(vis({ [SPACE]: ['OPEN', 'c1', 'OPEN'], priv: ['PRIVATE', 'c1', 'OPEN'] }))
    prisma.item.findFirst.mockResolvedValue(ARTICLE)
    prisma.item.findUnique.mockImplementation(async ({ where }: any) => ({
      n1: note, s1: ref('s1', 'priv', 'Privé'), other: { ...ARTICLE, id: 'other' }, art: ARTICLE,
    } as Record<string, unknown>)[where.id] ?? null)
    prisma.articleBlock.findUnique.mockResolvedValue(null)
    prisma.articleBlock.count.mockResolvedValue(2)
    prisma.articleBlock.create.mockImplementation(async ({ data }: any) => ({ id: 'new', width: 'full', align: 'center', ...data, item: note }))
  })

  const add = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: url('/blocks'), headers: auth(), payload })

  it('adds a reference at the end', async () => {
    const res = await add({ itemId: 'n1' })
    expect(res.statusCode).toBe(201)
    expect(prisma.articleBlock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ articleId: 'art', itemId: 'n1', position: 2, addedById: USER }),
    }))
    expect(res.json()).toMatchObject({ available: true, item: { title: 'Note' } })
  })

  it('rejects article references', async () => {
    expect((await add({ itemId: 'other' })).statusCode).toBe(400)
    expect((await add({ itemId: 'art' })).statusCode).toBe(400)
    expect(prisma.articleBlock.create).not.toHaveBeenCalled()
  })

  it('rejects duplicate reference', async () => {
    prisma.articleBlock.findUnique.mockResolvedValue({ id: 'b1' })
    const res = await add({ itemId: 'n1' })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('DUPLICATE_REFERENCE')
  })

  it('asks confirmation when less visible', async () => {
    prisma.articleBlock.create.mockImplementation(async ({ data }: any) => ({ id: 'new', width: 'full', align: 'center', ...data, item: ref('s1', 'priv', 'Privé') }))
    const first = await add({ itemId: 's1' })
    expect(first.statusCode).toBe(409)
    expect(first.json().code).toBe('LESS_VISIBLE')
    expect(prisma.articleBlock.create).not.toHaveBeenCalled()
    expect((await add({ itemId: 's1', confirmLessVisible: true })).statusCode).toBe(201)
  })

  it('refuses unreadable item', async () => {
    readable = { [USER]: [SPACE] }
    expect((await add({ itemId: 's1', confirmLessVisible: true })).statusCode).toBe(403)
    expect(prisma.articleBlock.create).not.toHaveBeenCalled()
  })

  it("member cannot edit someone else's article", async () => {
    access.checkSpaceAccess.mockResolvedValue({ role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue({ ...ARTICLE, createdById: 'other' })
    expect((await add({ itemId: 'n1' })).statusCode).toBe(403)
    expect(prisma.articleBlock.create).not.toHaveBeenCalled()
  })

  it('add text creates a note in the article space', async () => {
    prisma.item.create.mockResolvedValue({ ...note, id: 'txt' })
    const res = await app.inject({ method: 'POST', url: url('/texts'), headers: auth(), payload: {} })
    expect(res.statusCode).toBe(201)
    expect(prisma.item.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'NOTE', spaceId: SPACE, createdById: USER }),
    }))
    expect(prisma.articleBlock.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ itemId: 'txt' }) }))
  })

  it('reorder requires all blocks', async () => {
    prisma.articleBlock.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }])
    const res = await app.inject({ method: 'PUT', url: url('/order'), headers: auth(), payload: { blockIds: ['b2'] } })
    expect(res.statusCode).toBe(400)
    expect(prisma.articleBlock.update).not.toHaveBeenCalled()
  })

  it('delete keeps the referenced item', async () => {
    prisma.articleBlock.findFirst.mockResolvedValue({ id: 'b1', articleId: 'art', itemId: 'n1' })
    const res = await app.inject({ method: 'DELETE', url: url('/blocks/b1'), headers: auth() })
    expect(res.statusCode).toBe(204)
    expect(prisma.articleBlock.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
    expect(prisma.item.delete).not.toHaveBeenCalled()
  })
})
