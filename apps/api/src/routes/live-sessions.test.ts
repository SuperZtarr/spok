/* TNR des routes /live-sessions : création (PREPARED, OWNER communauté), accès (membres du parent), démarrage,
 * préparation (ajout/retrait/ordre), affichage (direct ou depuis la préparation), révélation des sous-items, fin. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'

vi.mock('../utils/sessionCopy.js', () => ({
  SessionCopyError: class extends Error { code = 'NOT_FOUND' },
  copyItemToSession: vi.fn(async () => ({ item: { id: 'copy-1', title: 'Budget', tags: [] }, children: [], reused: false })),
  revealChildInSession: vi.fn(async () => ({ id: 'copy-c1', title: 'Ligne', parentId: 'copy-1', tags: [] })),
  cloneSessionCopies: vi.fn(async () => 0),
}))

const invites = vi.hoisted(() => ({
  listInviteCandidates: vi.fn(async () => [{ userId: 'a', name: 'Alice', email: 'a@x' }]),
  assertInvitable: vi.fn(async () => null as string | null),
  addInvitees: vi.fn(async (_p: any, _s: any, ids: string[]) => ids),
  removeInvitee: vi.fn(async () => true),
  listInvitees: vi.fn(async () => []),
}))
vi.mock('../utils/liveInvites.js', () => invites)

import { liveSessionsRoutes } from './live-sessions.js'

const USER = 'test-user-id'
const session = { id: 'ls-1', spaceId: 'sess-space', parentSpaceId: 'parent', hostId: USER, status: 'LIVE',
  controllerId: null, currentEntryId: null, startedAt: new Date(), endedAt: null,
  space: { name: '2026-10-10' } }

async function build() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  app.setErrorHandler((error, _r, reply) => reply.status((error as any).statusCode ?? 500).send({ message: error.message }))
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(liveSessionsRoutes, { prefix: '/live-sessions' })
  await app.ready()
  return { app, prisma }
}

describe('/live-sessions', () => {
  let app: FastifyInstance; let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  beforeEach(async () => {
    ({ app, prisma } = await build())
    prisma.user.findUnique.mockResolvedValue({ id: USER, name: 'Thomas', avatarUrl: null, globalRole: 'USER' })
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', name: 'Comité', type: 'GROUP', communityId: 'c1', parentId: null, visibility: null })
  })

  it('création refusée si pas OWNER de la communauté', async () => {
    prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(403)
  })

  it('création refusée hors communauté', async () => {
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', type: 'PERSONAL', communityId: null })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(400)
  })

  it('création par OWNER : sous-espace PRIVATE daté + rôle HOST', async () => {
    prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
    prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-10' })
    prisma.liveSession.create.mockResolvedValue(session)
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, roles: [{ userId: USER, role: 'HOST', user: { id: USER, name: 'Thomas', avatarUrl: null } }], entries: [] })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(201)
    const data = prisma.space.create.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'GROUP', parentId: 'parent', communityId: 'c1', visibility: 'PRIVATE' })
    expect(data.name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(prisma.liveSession.create.mock.calls[0][0].data.roles.create).toEqual({ userId: USER, role: 'HOST' })
    expect(prisma.liveSession.create.mock.calls[0][0].data.status ?? 'PREPARED').toBe('PREPARED')
    expect(res.json().myRole).toBe('HOST')
    expect(prisma.liveSessionAgendaItem.createMany).not.toHaveBeenCalled()
  })

  describe('création avec préparation initiale (éléments de l\'espace parent)', () => {
    beforeEach(() => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-11' })
      prisma.liveSession.create.mockResolvedValue({ ...session, status: 'PREPARED' })
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED', roles: [{ userId: USER, role: 'HOST', user: { id: USER, name: 'Thomas', avatarUrl: null } }], entries: [] })
      // Accès à l'espace parent (membre direct) : requis pour une préparation initiale
      prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER, spaceId: 'parent', role: 'OWNER' })
    })

    it("remplit la préparation dans l'ordre demandé, sous-éléments juste après leur parent", async () => {
      prisma.item.findMany.mockImplementation(async (args: any) => {
        if (args.where.id) return [{ id: 'B', title: 'Bilan' }, { id: 'A', title: 'Accueil' }]
        return [{ id: 'A2', title: 'A deux', parentId: 'A' }, { id: 'A1', title: 'A un', parentId: 'A' }].sort(() => 0)
      })
      const res = await app.inject({
        method: 'POST', url: '/live-sessions', headers: auth(),
        payload: { parentSpaceId: 'parent', agenda: [{ sourceItemId: 'A', includeChildren: true }, { sourceItemId: 'B' }] },
      })
      expect(res.statusCode).toBe(201)
      // Seuls les éléments de l'espace parent sont recherchés
      expect(prisma.item.findMany.mock.calls[0][0].where).toMatchObject({ id: { in: ['A', 'B'] }, spaceId: 'parent' })
      const rows = prisma.liveSessionAgendaItem.createMany.mock.calls[0][0].data
      expect(rows.map((r: any) => [r.sourceItemId, r.position])).toEqual([['A', 0], ['A2', 1], ['A1', 2], ['B', 3]])
      expect(rows[0]).toMatchObject({ sessionId: 'ls-1', presenterId: USER, sourceSpaceId: 'parent', title: 'Accueil' })
    })

    it("refuse un élément qui n'appartient pas à l'espace parent, sans rien créer", async () => {
      prisma.item.findMany.mockResolvedValue([{ id: 'A', title: 'Accueil' }])
      const res = await app.inject({
        method: 'POST', url: '/live-sessions', headers: auth(),
        payload: { parentSpaceId: 'parent', agenda: [{ sourceItemId: 'A' }, { sourceItemId: 'ailleurs' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(prisma.space.create).not.toHaveBeenCalled()
      expect(prisma.liveSessionAgendaItem.createMany).not.toHaveBeenCalled()
    })

    // Règle 2026-10-12 : le propriétaire de la communauté est OWNER dans tous ses espaces, privés compris
    it("autorise une préparation initiale à un OWNER de communauté non membre de l'espace parent (privé)", async () => {
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue({ id: 'parent', name: 'Comité', type: 'GROUP', communityId: 'c1', parentId: null, visibility: 'PRIVATE', community: { visibility: 'PRIVATE', isPublic: false } })
      prisma.item.findMany.mockResolvedValue([{ id: 'A', title: 'Secret' }])
      const res = await app.inject({
        method: 'POST', url: '/live-sessions', headers: auth(),
        payload: { parentSpaceId: 'parent', agenda: [{ sourceItemId: 'A' }] },
      })
      expect(res.statusCode).toBe(201)
      expect(prisma.item.findMany).toHaveBeenCalled()
    })

    it('liste vide : séance créée sans préparation', async () => {
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', agenda: [] } })
      expect(res.statusCode).toBe(201)
      expect(prisma.liveSessionAgendaItem.createMany).not.toHaveBeenCalled()
    })
  })

  it('join refusé à un non-membre du parent', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', community: { visibility: 'PRIVATE', isPublic: false } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/join', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('join par un membre du parent : membership MEMBER dans l\'espace de séance + entrée JOIN', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other', roles: [], entries: [] })
    prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
      where.userId_spaceId.spaceId === 'parent' ? { role: 'MEMBER' } : null)
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e1', kind: 'JOIN', createdAt: new Date(), userId: USER, itemId: null, itemTitle: null, user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/join', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.spaceMembership.create).toHaveBeenCalledWith({ data: { userId: USER, spaceId: 'sess-space', role: 'MEMBER' } })
  })

  it('display refusé à un simple participant', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(403)
  })

  it('display refusé si le présentateur n\'a pas accès à la source', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'src', communityId: null })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(404)
  })

  it('display : entrée DISPLAY + currentEntryId = dernier affichage', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e2', kind: 'DISPLAY', createdAt: new Date(), userId: USER, itemId: 'copy-1', itemTitle: 'Budget', user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSession.update).toHaveBeenCalledWith({ where: { id: 'ls-1' }, data: { currentEntryId: 'e2' } })
  })

  it('display sur séance ENDED → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'ENDED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(409)
  })

  it('end réservé au host', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/end', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('presenters : refuse un utilisateur non membre du parent', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', community: { visibility: 'PRIVATE', isPublic: false } })
    const res = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/presenters', headers: auth(), payload: { userIds: ['stranger'] } })
    expect(res.statusCode).toBe(400)
  })

  it('by-space : 200 null quand l\'espace n\'est pas une séance', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/plain-space', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toBeNull()
  })

  it('by-space : refusé à qui n\'est pas membre de l\'espace de séance', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('start : réservé au host, PREPARED → LIVE', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/start', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSession.update.mock.calls[0][0].data.status).toBe('LIVE')
  })

  it('start sur séance déjà LIVE → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/start', headers: auth() })
    expect(res.statusCode).toBe(409)
  })

  it("agenda : ajout en PREPARED par le host, espace source résolu depuis l'item", async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.liveSessionAgendaItem.aggregate.mockResolvedValue({ _max: { position: 2 } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSessionAgendaItem.create.mock.calls[0][0].data).toMatchObject({ sourceItemId: 'i1', sourceSpaceId: 'src', title: 'Budget', position: 3, presenterId: USER })
  })

  it("agenda : item d'un espace inaccessible → 404, rien créé", async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'secret', title: 'X' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'secret', communityId: null })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(404)
    expect(prisma.liveSessionAgendaItem.create).not.toHaveBeenCalled()
  })

  it('order : un presenter ne déplace pas les lignes des autres', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.liveSessionAgendaItem.findMany.mockResolvedValue([
      { id: 'a', presenterId: 'other', position: 0 }, { id: 'b', presenterId: USER, position: 1 }, { id: 'c', presenterId: USER, position: 2 },
    ])
    const bad = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['b', 'a', 'c'] } })
    expect(bad.statusCode).toBe(403)
    const ok = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['a', 'c', 'b'] } })
    expect(ok.statusCode).toBe(200)
  })

  it('order : ids incomplets → 400', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.liveSessionAgendaItem.findMany.mockResolvedValue([{ id: 'a', presenterId: USER, position: 0 }, { id: 'b', presenterId: USER, position: 1 }])
    const res = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['a'] } })
    expect(res.statusCode).toBe(400)
  })

  it("delete agenda : refusé sur la ligne d'un autre pour un presenter", async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.liveSessionAgendaItem.findFirst.mockResolvedValue({ id: 'a', presenterId: 'other', sessionId: 'ls-1' })
    const res = await app.inject({ method: 'DELETE', url: '/live-sessions/ls-1/agenda/a', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('display depuis la préparation : marque presentedAt', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.liveSessionAgendaItem.findFirst.mockResolvedValue({ id: 'a', sessionId: 'ls-1', sourceItemId: 'i1', sourceSpaceId: 'src' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e3', kind: 'DISPLAY', createdAt: new Date(), userId: USER, itemId: 'copy-1', itemTitle: 'Budget', user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { agendaItemId: 'a' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSessionAgendaItem.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a' }, data: { presentedAt: expect.any(Date) } }))
  })

  it('display sur séance PREPARED → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(409)
  })

  describe('révélation des sous-items', () => {
    const current = { ...session, currentEntryId: 'e2' }
    beforeEach(() => {
      prisma.liveSession.findUnique.mockResolvedValue(current)
      prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
      prisma.liveSessionEntry.findUnique.mockResolvedValue({ id: 'e2', itemId: 'copy-1' })
      prisma.item.findFirst.mockResolvedValue({ id: 'copy-1', spaceId: 'sess-space', sourceItemId: 'src-1', sourceSpaceId: 'src' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    })

    it("reveal et pending-children réservés à l'animateur (présentateur → 403)", async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...current, hostId: 'other' })
      prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
      const reveal = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/reveal', headers: auth(), payload: { sourceItemId: 'c1' } })
      expect(reveal.statusCode).toBe(403)
      const pending = await app.inject({ method: 'GET', url: '/live-sessions/ls-1/pending-children', headers: auth() })
      expect(pending.statusCode).toBe(403)
    })

    it('reveal par un participant → 403', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...current, hostId: 'other' })
      prisma.liveSessionRole.findUnique.mockResolvedValue(null)
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/reveal', headers: auth(), payload: { sourceItemId: 'c1' } })
      expect(res.statusCode).toBe(403)
    })

    it("reveal d'un item qui n'est pas enfant de l'élément courant → 400", async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'x', parentId: 'other', spaceId: 'src' })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/reveal', headers: auth(), payload: { sourceItemId: 'x' } })
      expect(res.statusCode).toBe(400)
    })

    it('reveal : copie sous la copie courante', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'c1', parentId: 'src-1', spaceId: 'src' })
      const { revealChildInSession } = await import('../utils/sessionCopy.js')
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/reveal', headers: auth(), payload: { sourceItemId: 'c1' } })
      expect(res.statusCode).toBe(200)
      expect(revealChildInSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ parentCopyId: 'copy-1', sourceChildId: 'c1' }))
    })

    it('pending-children exclut les enfants déjà révélés', async () => {
      prisma.item.findMany.mockImplementation(async ({ where }: any) => {
        if (where.parentId === 'copy-1') return [{ sourceItemId: 'c1' }]
        if (where.parentId === 'src-1') return [{ id: 'c1', title: 'Un' }, { id: 'c2', title: 'Deux' }]
        return []
      })
      const res = await app.inject({ method: 'GET', url: '/live-sessions/ls-1/pending-children', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([{ sourceItemId: 'c2', title: 'Deux' }])
    })
  })

  describe('préparation avec sous-éléments', () => {
    beforeEach(() => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
      prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
      prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    })

    it('source-children : nombre de sous-éléments directs', async () => {
      prisma.item.count.mockResolvedValue(3)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/ls-1/source-children?sourceItemId=i1', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ count: 3 })
      expect(prisma.item.count).toHaveBeenCalledWith({ where: { parentId: 'i1', spaceId: 'src' } })
    })

    it('source-children : refusé à un participant', async () => {
      prisma.liveSessionRole.findUnique.mockResolvedValue(null)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/ls-1/source-children?sourceItemId=i1', headers: auth() })
      expect(res.statusCode).toBe(403)
    })

    it('agenda includeChildren : élément puis sous-éléments, positions consécutives', async () => {
      prisma.liveSessionAgendaItem.aggregate.mockResolvedValue({ _max: { position: 0 } })
      prisma.item.findMany.mockResolvedValue([{ id: 'k1', title: 'Un' }, { id: 'k2', title: '' }])
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1', includeChildren: true } })
      expect(res.statusCode).toBe(200)
      const rows = prisma.liveSessionAgendaItem.create.mock.calls.map((c: any[]) => c[0].data)
      expect(rows.map((r: any) => [r.sourceItemId, r.position, r.title])).toEqual([['i1', 1, 'Budget'], ['k1', 2, 'Un'], ['k2', 3, 'Sans titre']])
      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { parentId: 'i1', spaceId: 'src' }, orderBy: { position: 'asc' } }))
    })

    it('agenda sans includeChildren : élément seul', async () => {
      prisma.liveSessionAgendaItem.aggregate.mockResolvedValue({ _max: { position: null } })
      await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1' } })
      expect(prisma.liveSessionAgendaItem.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('une seule séance en cours par espace', () => {
    beforeEach(() => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-10' })
      prisma.liveSession.create.mockResolvedValue(session)
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, roles: [], entries: [] })
    })

    it('création refusée (409) si une séance est préparée ou en direct', async () => {
      prisma.liveSession.findFirst.mockResolvedValue({ id: 'ls-0', spaceId: 'sp-0', status: 'LIVE' })
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', name: '2026-10-10' } })
      expect(res.statusCode).toBe(409)
      expect(prisma.space.create).not.toHaveBeenCalled()
      expect(prisma.liveSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { parentSpaceId: 'parent', status: { in: ['PREPARED', 'LIVE'] } } }))
    })

    it('nom déjà pris le même jour → suffixe (2), (3)…', async () => {
      prisma.liveSession.findFirst.mockResolvedValue(null)
      prisma.liveSession.findMany.mockResolvedValue([{ space: { name: '2026-10-10' } }, { space: { name: '2026-10-10 (2)' } }])
      await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', name: '2026-10-10' } })
      expect(prisma.space.create.mock.calls[0][0].data.name).toBe('2026-10-10 (3)')
    })

    it('nom libre → inchangé', async () => {
      prisma.liveSession.findFirst.mockResolvedValue(null)
      prisma.liveSession.findMany.mockResolvedValue([{ space: { name: '2026-10-09' } }])
      await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', name: '2026-10-10' } })
      expect(prisma.space.create.mock.calls[0][0].data.name).toBe('2026-10-10')
    })
  })

  describe('suite de séance', () => {
    const ended = { ...session, status: 'ENDED', endedAt: new Date() }
    beforeEach(() => {
      prisma.liveSession.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'ls-1') return ended
        if (where.previousSessionId === 'ls-1') return null
        return { ...session, id: 'ls-2', spaceId: 'sp-2', status: 'PREPARED', roles: [], entries: [] }
      })
      prisma.liveSession.findFirst.mockResolvedValue(null)
      prisma.liveSession.findMany.mockResolvedValue([{ space: { name: '2026-10-10' } }])
      prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', type: 'GROUP' })
      prisma.space.create.mockResolvedValue({ id: 'sp-2', name: '2026-10-10 (2)' })
      prisma.liveSession.create.mockResolvedValue({ id: 'ls-2', spaceId: 'sp-2' })
      prisma.liveSessionRole.findMany.mockResolvedValue([{ userId: USER, role: 'HOST' }, { userId: 'pres-1', role: 'PRESENTER' }])
      prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
        (where.userId_spaceId.spaceId === 'parent' ? { role: 'MEMBER' } : null))
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue([
        { id: 'a1', presenterId: USER, sourceItemId: 'i1', sourceSpaceId: 'src', title: 'Fait', position: 0, presentedAt: new Date() },
        { id: 'a2', presenterId: 'pres-1', sourceItemId: 'i2', sourceSpaceId: 'src', title: 'Reste', position: 1, presentedAt: null },
      ])
    })

    it('suite : réservée au host', async () => {
      prisma.liveSession.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'ls-1' ? { ...ended, hostId: 'other' } : null))
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: { name: '2026-10-10' } })
      expect(res.statusCode).toBe(403)
    })

    it("suite : seulement d'une séance terminée", async () => {
      prisma.liveSession.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'ls-1' ? session : null))
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: {} })
      expect(res.statusCode).toBe(409)
    })

    it('suite : refusée si une séance est en cours dans l’espace', async () => {
      prisma.liveSession.findFirst.mockResolvedValue({ id: 'ls-9' })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: {} })
      expect(res.statusCode).toBe(409)
    })

    it('suite : refusée si la séance a déjà une suite', async () => {
      prisma.liveSession.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'ls-1') return ended
        if (where.previousSessionId === 'ls-1') return { id: 'ls-x' }
        return null
      })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: {} })
      expect(res.statusCode).toBe(409)
    })

    it('suite : nouvelle séance PREPARED liée, présentateurs + préparation non présentée repris, copies recopiées', async () => {
      const { cloneSessionCopies } = await import('../utils/sessionCopy.js')
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: { name: '2026-10-10' } })
      expect(res.statusCode).toBe(201)
      expect(prisma.space.create.mock.calls[0][0].data).toMatchObject({ name: '2026-10-10 (2)', parentId: 'parent', visibility: 'PRIVATE' })
      expect(prisma.liveSession.create.mock.calls[0][0].data).toMatchObject({ previousSessionId: 'ls-1', parentSpaceId: 'parent', hostId: USER })
      expect(prisma.liveSessionRole.createMany).toHaveBeenCalledWith({ data: [{ sessionId: 'ls-2', userId: 'pres-1', role: 'PRESENTER' }] })
      const agenda = prisma.liveSessionAgendaItem.createMany.mock.calls[0][0].data
      expect(agenda).toEqual([{ sessionId: 'ls-2', presenterId: 'pres-1', sourceItemId: 'i2', sourceSpaceId: 'src', title: 'Reste', position: 0 }])
      expect(cloneSessionCopies).toHaveBeenCalledWith(expect.anything(), { fromSpaceId: 'sess-space', toSpaceId: 'sp-2' })
      expect(prisma.spaceMembership.create).toHaveBeenCalledWith({ data: { userId: 'pres-1', spaceId: 'sp-2', role: 'MEMBER' } })
    })

    it('suite : invités repris s\'ils restent invitables', async () => {
      Object.values(invites).forEach((fn: any) => fn.mockClear())
      prisma.liveSessionInvite.findMany.mockResolvedValue([{ userId: 'inv-ok' }, { userId: 'inv-ko' }])
      invites.assertInvitable.mockImplementation(async (_p: any, _s: string, ids: string[]) => (ids[0] === 'inv-ko' ? 'a déjà accès' : null))
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: { name: '2026-10-10' } })
      expect(res.statusCode).toBe(201)
      expect(invites.addInvitees).toHaveBeenCalledTimes(1)
      expect(invites.addInvitees.mock.calls[0][1]).toMatchObject({ id: 'ls-2' })
      expect(invites.addInvitees.mock.calls[0][2]).toEqual(['inv-ok'])
      invites.assertInvitable.mockImplementation(async () => null)
    })
  })

  describe('confidentialité et périmètre', () => {
    const rows = [
      { id: 'a1', presenterId: USER, sourceItemId: 'i1', sourceSpaceId: 'src', title: 'Déjà vu', position: 0, presentedAt: new Date(), presenter: { id: USER, name: 'T' } },
      { id: 'a2', presenterId: USER, sourceItemId: 'i2', sourceSpaceId: 'src', title: 'Secret', position: 1, presentedAt: null, presenter: { id: USER, name: 'T' } },
    ]

    it('participant : la préparation ne contient que les éléments déjà présentés', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other', roles: [], entries: [] })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue(rows)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(res.json().agenda.map((a: any) => a.title)).toEqual(['Déjà vu'])
    })

    it('animateur : préparation complète', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, roles: [{ userId: USER, role: 'HOST', user: { id: USER, name: 'T' } }], entries: [] })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue(rows)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
      expect(res.json().agenda).toHaveLength(2)
    })

    // Vignettes (2026-10-12) : URL d'un fichier de l'espace source → animateur/présentateurs seulement
    const sourceItems = async ({ where }: any) => (where?.id?.in
      ? [{ id: 'i1', type: 'IMAGE', url: 'https://cdn/i1.webp' }, { id: 'i2', type: 'DIAGRAM', url: 'https://cdn/i2.png' }]
      : [])

    it('animateur : vignette de l\'image ou du schéma source', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, roles: [{ userId: USER, role: 'HOST', user: { id: USER, name: 'T' } }], entries: [] })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue(rows)
      prisma.item.findMany.mockImplementation(sourceItems)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
      expect(res.json().agenda.map((a: any) => a.thumbnailUrl)).toEqual(['https://cdn/i1.webp', 'https://cdn/i2.png'])
    })

    it('participant : jamais de vignette (pas d\'URL de fichier source)', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other', roles: [], entries: [] })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue(rows)
      prisma.item.findMany.mockImplementation(sourceItems)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
      expect(res.json().agenda).toEqual([expect.objectContaining({ title: 'Déjà vu', thumbnailUrl: null })])
    })

    it("sous-éléments de l'élément courant limités à l'espace de séance", async () => {
      const entry = { id: 'e1', kind: 'DISPLAY', createdAt: new Date(), userId: USER, itemId: 'copy-1', itemTitle: 'X', user: { id: USER, name: 'T' } }
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, currentEntryId: 'e1', roles: [], entries: [entry] })
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.item.findFirst.mockResolvedValue({ id: 'copy-1', title: 'X', tags: [] })
      await app.inject({ method: 'GET', url: '/live-sessions/by-space/sess-space', headers: auth() })
      const childQuery = prisma.item.findMany.mock.calls.map((c: any[]) => c[0]?.where).find((w: any) => w?.parentId === 'copy-1')
      expect(childQuery).toMatchObject({ parentId: 'copy-1', spaceId: 'sess-space' })
    })

    it("suite : un présentateur qui n'est plus membre du parent n'est pas repris", async () => {
      prisma.liveSession.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'ls-1') return { ...session, status: 'ENDED' }
        if (where.previousSessionId) return null
        return { ...session, id: 'ls-2', spaceId: 'sp-2', status: 'PREPARED', roles: [], entries: [] }
      })
      prisma.liveSession.findFirst.mockResolvedValue(null)
      prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', type: 'GROUP', community: { visibility: 'PRIVATE', isPublic: false } })
      prisma.space.create.mockResolvedValue({ id: 'sp-2', name: 'x' })
      prisma.liveSession.create.mockResolvedValue({ id: 'ls-2', spaceId: 'sp-2' })
      prisma.liveSessionRole.findMany.mockResolvedValue([{ userId: 'gone', role: 'PRESENTER' }])
      prisma.spaceMembership.findUnique.mockResolvedValue(null)
      prisma.liveSessionAgendaItem.findMany.mockResolvedValue([])
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/suite', headers: auth(), payload: {} })
      expect(res.statusCode).toBe(201)
      expect(prisma.liveSessionRole.createMany).not.toHaveBeenCalled()
    })
  })

  describe('invités', () => {
    beforeEach(() => { Object.values(invites).forEach((fn: any) => fn.mockClear()) })

    it('création avec invités : validés puis ajoutés à la nouvelle séance', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-11' })
      prisma.liveSession.create.mockResolvedValue({ ...session, status: 'PREPARED' })
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED', roles: [], entries: [] })
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', invitees: ['a'] } })
      expect(res.statusCode).toBe(201)
      expect(invites.assertInvitable).toHaveBeenCalledWith(expect.anything(), 'parent', ['a'])
      expect(invites.addInvitees.mock.calls[0][2]).toEqual(['a'])
    })

    it('création refusée si un invité n\'est pas invitable, rien créé', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      invites.assertInvitable.mockResolvedValueOnce('Cette personne a déjà accès à l\'espace')
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', invitees: ['b'] } })
      expect(res.statusCode).toBe(400)
      expect(prisma.space.create).not.toHaveBeenCalled()
    })

    it('candidats : réservé à un OWNER de la communauté (403 sinon)', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.liveSession.findFirst.mockResolvedValue(null)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/invite-candidates?parentSpaceId=parent', headers: auth() })
      expect(res.statusCode).toBe(403)
    })

    it('candidats : OWNER → liste sans l\'utilisateur courant', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      const res = await app.inject({ method: 'GET', url: '/live-sessions/invite-candidates?parentSpaceId=parent', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(invites.listInviteCandidates).toHaveBeenCalledWith(expect.anything(), 'parent', [USER])
    })

    it('ajout : réservé à l\'animateur', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'quelquun-d-autre' })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a'] } })
      expect(res.statusCode).toBe(403)
    })

    it('ajout refusé sur une séance terminée (409), retrait autorisé', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'ENDED', space: { name: 'S' } })
      const add = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a'] } })
      expect(add.statusCode).toBe(409)
      const del = await app.inject({ method: 'DELETE', url: '/live-sessions/ls-1/invitees/a', headers: auth() })
      expect(del.statusCode).toBe(200)
      expect(invites.removeInvitee).toHaveBeenCalled()
    })

    it('ajout : invités validés puis ajoutés, renvoie la liste', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'LIVE', space: { name: 'S' } })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a', 'a'] } })
      expect(res.statusCode).toBe(200)
      expect(invites.addInvitees.mock.calls[0][2]).toEqual(['a', 'a']) // dédoublonnage dans addInvitees (Task 2)
      expect(invites.listInvitees).toHaveBeenCalledWith(expect.anything(), 'ls-1')
    })
  })

  describe('GET /live-sessions/ongoing', () => {
    const row = (id: string, status: string, parentSpaceId: string) => ({
      id, spaceId: `sp-${id}`, parentSpaceId, status, hostId: 'h',
      space: { name: `Séance ${id}`, memberships: [] }, parentSpace: { name: `Parent ${id}` }, roles: [],
    })

    it('ne renvoie que les séances en cours où je suis membre du parent ou de la séance', async () => {
      prisma.liveSession.findMany.mockResolvedValue([
        row('a', 'LIVE', 'p-ok'),
        { ...row('b', 'PREPARED', 'p-ko'), space: { name: 'Séance b', memberships: [{ id: 'm' }] }, roles: [{ role: 'PRESENTER' }] },
        row('c', 'PREPARED', 'p-ko'),
      ])
      prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
        (where.userId_spaceId.spaceId === 'p-ok' ? { role: 'MEMBER' } : null))
      prisma.space.findUnique.mockResolvedValue({ id: 'p-ko', communityId: 'c1', community: { visibility: 'PRIVATE', isPublic: false } })
      const res = await app.inject({ method: 'GET', url: '/live-sessions/ongoing', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(prisma.liveSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { in: ['PREPARED', 'LIVE'] } } }))
      expect(res.json()).toEqual([
        { id: 'a', spaceId: 'sp-a', spaceName: 'Séance a', parentSpaceName: 'Parent a', status: 'LIVE', isMember: false, myRole: 'PARTICIPANT' },
        { id: 'b', spaceId: 'sp-b', spaceName: 'Séance b', parentSpaceName: 'Parent b', status: 'PREPARED', isMember: true, myRole: 'PRESENTER' },
      ])
    })

    it('séances en direct en premier', async () => {
      prisma.liveSession.findMany.mockResolvedValue([row('a', 'PREPARED', 'p'), row('b', 'LIVE', 'p')])
      prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      const res = await app.inject({ method: 'GET', url: '/live-sessions/ongoing', headers: auth() })
      expect(res.json().map((s: any) => s.id)).toEqual(['b', 'a'])
    })
  })
})
