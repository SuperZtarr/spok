/*
 * TNR du canevas d'un élément Process (routes/item-process.ts, 2026-11-21) : lecture (droits de la personne qui a posé,
 * rien de divulgué d'un élément indisponible, liens limités aux éléments montrés, réponses d'une Question), écritures
 * (contrôles d'une nouvelle place, « moins visible », couloirs, refus sans aucune écriture).
 * Droits simulés par utils/articleAccess.js (comme item-article.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

const access = vi.hoisted(() => ({
  checkSpaceAccess: vi.fn(),
  allReadableSpaceIds: vi.fn(),
  filterReadableSpaceIds: vi.fn(),
  getEffectiveVisibilities: vi.fn(),
}))
vi.mock('../utils/articleAccess.js', () => access)

const SPACE = 'space-1'
const USER = 'test-user-id'
const PROCESS = { id: 'proc', type: 'PROCESS', spaceId: SPACE, lockedAt: null }
const item = (id: string, spaceId: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'UNDEFINED', title: `Titre ${id}`, spaceId, parentId: null, createdById: 'other', assignedToId: null,
  lockedAt: null, status: 'todo', priority: null, dueDate: null, question: null, questionOptions: [], ...extra,
})
const vis = (entries: Record<string, [string, string, string]>) =>
  new Map(Object.entries(entries).map(([id, [visibility, communityId, communityVisibility]]) => [id, { visibility, communityId, communityVisibility }]))

describe('Process — canevas', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  // Espaces lisibles par personne (le lecteur courant = USER)
  let readableBy: Record<string, string[]> = {}
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const url = (path = '') => `/spaces/${SPACE}/items/proc/process${path}`
  const get = () => app.inject({ method: 'GET', url: url(), headers: auth() })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    readableBy = { [USER]: [SPACE, 's2'], adder: [SPACE, 's2'] }
    access.checkSpaceAccess.mockReset().mockResolvedValue({ role: 'MEMBER' })
    access.filterReadableSpaceIds.mockReset().mockImplementation(async (_p: unknown, u: string | undefined, ids: string[]) =>
      ids.filter((id) => (readableBy[u ?? ''] ?? []).includes(id)))
    access.getEffectiveVisibilities.mockReset().mockResolvedValue(vis({ [SPACE]: ['OPEN', 'c1', 'OPEN'], s2: ['OPEN', 'c1', 'OPEN'], priv: ['PRIVATE', 'c1', 'OPEN'] }))
    prisma.item.findFirst.mockResolvedValue(PROCESS)
    prisma.processNode.findMany.mockResolvedValue([])
    prisma.processLane.findMany.mockResolvedValue([])
    prisma.itemRelation.findMany.mockResolvedValue([])
    prisma.space.findMany.mockResolvedValue([])
  })

  describe('lecture', () => {
    it('élément devenu illisible pour la personne qui l’a posé : rien de son contenu n’est envoyé', async () => {
      prisma.processNode.findMany.mockResolvedValue([
        { itemId: 'secret', x: 1, y: 2, laneId: null, addedById: 'adder', item: item('secret', 'priv') },
      ])
      const res = await get()
      expect(res.statusCode).toBe(200)
      expect(res.json().nodes).toEqual([{ itemId: 'secret', x: 1, y: 2, laneId: null, available: false, item: null }])
      expect(res.body).not.toContain('Titre secret')
      expect(res.body).not.toContain('priv')
    })

    it('lecteur sans accès à l’espace source : contenu visible, ni fiche ni espace', async () => {
      readableBy[USER] = [SPACE]
      prisma.processNode.findMany.mockResolvedValue([
        { itemId: 'a', x: 0, y: 0, laneId: null, addedById: 'adder', item: item('a', 's2') },
      ])
      const node = (await get()).json().nodes[0]
      expect(node.available).toBe(true)
      expect(node.item).toMatchObject({ title: 'Titre a', canOpen: false, canEdit: false, spaceId: null })
    })

    it('relations, parent et réponses limités aux éléments montrés ; réponse retenue', async () => {
      prisma.processNode.findMany.mockResolvedValue([
        { itemId: 'q', x: 0, y: 0, laneId: null, addedById: 'adder', item: item('q', SPACE, {
          type: 'QUESTION', status: 'question_decided', parentId: 'absent',
          question: { chosenOptionId: 'o1' },
          questionOptions: [{ id: 'o1', label: 'Oui', refItemId: 'b' }, { id: 'o2', label: 'Non', refItemId: 'hors-canevas' }],
        }) },
        { itemId: 'b', x: 300, y: 0, laneId: null, addedById: 'adder', item: item('b', SPACE, { parentId: 'q' }) },
        { itemId: 'x', x: 0, y: 200, laneId: null, addedById: 'adder', item: item('x', 'priv') },
      ])
      const view = (await get()).json()
      const q = view.nodes.find((n: any) => n.itemId === 'q').item
      expect(q.parentId).toBeNull()
      expect(q.question).toEqual({
        options: [{ id: 'o1', label: 'Oui', refItemId: 'b' }, { id: 'o2', label: 'Non', refItemId: null }],
        chosenOptionId: 'o1', decided: true,
      })
      expect(view.nodes.find((n: any) => n.itemId === 'b').item.parentId).toBe('q')
      expect(prisma.itemRelation.findMany.mock.calls[0][0].where).toEqual({ fromItemId: { in: ['q', 'b'] }, toItemId: { in: ['q', 'b'] } })
    })

    it('droit de modifier : MEMBER oui, VIEWER non, process verrouillé non', async () => {
      expect((await get()).json().canEditProcess).toBe(true)
      access.checkSpaceAccess.mockResolvedValue({ role: 'VIEWER' })
      expect((await get()).json().canEditProcess).toBe(false)
      access.checkSpaceAccess.mockResolvedValue({ role: 'OWNER' })
      prisma.item.findFirst.mockResolvedValue({ ...PROCESS, lockedAt: new Date() })
      expect((await get()).json().canEditProcess).toBe(false)
    })

    it('élément qui n’est pas un Process, ou espace illisible → 404', async () => {
      prisma.item.findFirst.mockResolvedValue({ ...PROCESS, type: 'ARTICLE' })
      expect((await get()).statusCode).toBe(404)
      access.checkSpaceAccess.mockResolvedValue(null)
      expect((await get()).statusCode).toBe(404)
    })
  })

  describe('écritures', () => {
    const put = (itemId: string, payload: Record<string, unknown>) =>
      app.inject({ method: 'PUT', url: url(`/nodes/${itemId}`), headers: auth(), payload })

    beforeEach(() => {
      prisma.processNode.findUnique.mockResolvedValue(null)
      prisma.processLane.findFirst.mockResolvedValue(null)
      prisma.item.findUnique.mockImplementation(async ({ where }: any) => ({ s2el: { id: 's2el', spaceId: 's2' }, privel: { id: 'privel', spaceId: 'priv' } } as any)[where.id] ?? null)
      prisma.processNode.create.mockImplementation(async ({ data }: any) => ({ itemId: data.itemId, x: data.x, y: data.y, laneId: data.laneId ?? null }))
    })

    it('nouvelle place d’un autre espace : posée avec la personne qui l’a posée', async () => {
      const res = await put('s2el', { x: 10, y: 20 })
      expect(res.statusCode).toBe(201)
      expect(prisma.processNode.create.mock.calls[0][0].data).toEqual({ processId: 'proc', itemId: 's2el', x: 10, y: 20, addedById: USER })
    })

    it('élément illisible → 403 ; le process lui-même → 400 ; déjà couloir → 409 IS_LANE ; rien créé', async () => {
      readableBy[USER] = [SPACE]
      expect((await put('s2el', { x: 0, y: 0 })).statusCode).toBe(403)
      expect((await put('proc', { x: 0, y: 0 })).statusCode).toBe(400)
      prisma.processLane.findFirst.mockResolvedValue({ id: 'L1' })
      const lane = await put('s2el', { x: 0, y: 0 })
      expect(lane.statusCode).toBe(409)
      expect(lane.json().code).toBe('IS_LANE')
      expect(prisma.processNode.create).not.toHaveBeenCalled()
    })

    it('moins visible que le process : 409 LESS_VISIBLE, puis posé sur confirmation', async () => {
      readableBy[USER] = [SPACE, 'priv']
      const refused = await put('privel', { x: 0, y: 0 })
      expect(refused.statusCode).toBe(409)
      expect(refused.json().code).toBe('LESS_VISIBLE')
      expect((await put('privel', { x: 0, y: 0, confirmLessVisible: true })).statusCode).toBe(201)
    })

    it('place existante : simple déplacement, sans contrôle d’ajout', async () => {
      readableBy[USER] = []
      prisma.processNode.findUnique.mockResolvedValue({ id: 'row' })
      prisma.processNode.update.mockResolvedValue({ itemId: 'privel', x: 5, y: 6, laneId: null })
      const res = await put('privel', { x: 5, y: 6, laneId: null })
      expect(res.statusCode).toBe(200)
      expect(prisma.processNode.update.mock.calls[0][0]).toMatchObject({ where: { id: 'row' }, data: { x: 5, y: 6, laneId: null } })
    })

    it('couloir d’un autre process → 400', async () => {
      prisma.processLane.findMany.mockResolvedValue([])
      expect((await put('s2el', { x: 0, y: 0, laneId: 'L9' })).statusCode).toBe(400)
    })

    it('enregistrement groupé : places existantes du process seulement', async () => {
      prisma.processLane.findMany.mockResolvedValue([{ id: 'L1' }])
      const res = await app.inject({ method: 'PUT', url: url('/nodes'), headers: auth(), payload: { positions: [{ itemId: 'a', x: 1, y: 2, laneId: 'L1' }] } })
      expect(res.statusCode).toBe(200)
      expect(prisma.processNode.updateMany).toHaveBeenCalledWith({ where: { processId: 'proc', itemId: 'a' }, data: { x: 1, y: 2, laneId: 'L1' } })
      expect(prisma.processNode.create).not.toHaveBeenCalled()
    })

    it('élément posé devenu couloir : sa place disparaît, la personne qui l’a posé est gardée', async () => {
      prisma.processNode.findUnique.mockResolvedValue({ id: 'row', addedById: 'adder' })
      prisma.processLane.aggregate.mockResolvedValue({ _max: { position: 1 } })
      prisma.processLane.create.mockResolvedValue({ id: 'L2', itemId: 's2el', position: 2, x: null, y: null })
      const res = await app.inject({ method: 'POST', url: url('/lanes'), headers: auth(), payload: { itemId: 's2el' } })
      expect(res.statusCode).toBe(201)
      expect(prisma.processNode.delete).toHaveBeenCalledWith({ where: { id: 'row' } })
      expect(prisma.processLane.create.mock.calls[0][0].data).toEqual({ processId: 'proc', itemId: 's2el', position: 2, addedById: 'adder' })
    })

    it('couloirs : ordre, position et retrait limités au process', async () => {
      await app.inject({ method: 'PUT', url: url('/lanes/order'), headers: auth(), payload: { ids: ['L2', 'L1'] } })
      expect(prisma.processLane.updateMany).toHaveBeenCalledWith({ where: { id: 'L2', processId: 'proc' }, data: { position: 0 } })
      await app.inject({ method: 'PUT', url: url('/lanes/layout'), headers: auth(), payload: { lanes: [{ id: 'L1', x: null, y: 3 }] } })
      expect(prisma.processLane.updateMany).toHaveBeenCalledWith({ where: { id: 'L1', processId: 'proc' }, data: { x: null, y: null } })
      await app.inject({ method: 'DELETE', url: url('/lanes/L1'), headers: auth() })
      expect(prisma.processLane.deleteMany).toHaveBeenCalledWith({ where: { id: 'L1', processId: 'proc' } })
    })

    it.each([
      ['VIEWER', { role: 'VIEWER' }, PROCESS],
      ['process verrouillé', { role: 'OWNER' }, { ...PROCESS, lockedAt: new Date() }],
    ])('%s : toute écriture refusée, aucune écriture faite', async (_name, role, proc) => {
      access.checkSpaceAccess.mockResolvedValue(role)
      prisma.item.findFirst.mockResolvedValue(proc)
      const calls = [
        put('s2el', { x: 1, y: 2 }),
        app.inject({ method: 'PUT', url: url('/nodes'), headers: auth(), payload: { positions: [{ itemId: 'a', x: 1, y: 2 }] } }),
        app.inject({ method: 'DELETE', url: url('/nodes/a'), headers: auth() }),
        app.inject({ method: 'POST', url: url('/lanes'), headers: auth(), payload: { itemId: 's2el' } }),
        app.inject({ method: 'DELETE', url: url('/lanes/L1'), headers: auth() }),
      ]
      for (const res of await Promise.all(calls)) expect(res.statusCode).toBe(403)
      expect(prisma.processNode.create).not.toHaveBeenCalled()
      expect(prisma.processNode.updateMany).not.toHaveBeenCalled()
      expect(prisma.processNode.deleteMany).not.toHaveBeenCalled()
      expect(prisma.processLane.create).not.toHaveBeenCalled()
      expect(prisma.processLane.deleteMany).not.toHaveBeenCalled()
    })

    it('sans connexion → 401', async () => {
      const res = await app.inject({ method: 'PUT', url: url('/nodes/a'), payload: { x: 1, y: 2 } })
      expect(res.statusCode).toBe(401)
    })
  })
})
