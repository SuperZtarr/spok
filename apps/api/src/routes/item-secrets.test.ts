/*
 * TNR des données sécurisées (routes/item-secrets.ts, 2026-11-20) : stockage chiffré, liste sans valeur, droits de
 * lecture (auteur, membres si SPACE, mode admin sans lecture, lecteur exclu, MCP refusé), journal sans valeur,
 * plafond, clé absente, élément verrouillé. Valeur témoin seulement — jamais de vrai secret.
 * Rôles pilotés par spaceMembership.findUnique ; mode admin = en-tête x-admin-mode + user.globalRole ADMIN.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { ITEM_SECRETS_MAX } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import { encryptSecret } from '../utils/secretCrypto.js'
import { createAuditLog } from '../utils/audit.js'
import { generatePersonalToken } from '../utils/personalTokens.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))
const ctx = vi.hoisted(() => ({ via: undefined as undefined | 'mcp' }))
vi.mock('../utils/requestContext.js', () => ({
  getRequestContext: () => (ctx.via ? { via: ctx.via, tokenId: 't', tokenName: 'n' } : undefined),
  runWithRequestContext: (_c: unknown, fn: () => unknown) => fn(),
}))

const WITNESS = 'TEMOIN-NE-PAS-FUIR-42'
const LOGIN = 'TEMOIN-LOGIN-43'
const SPACE = 'space-1'
const USER = 'test-user-id'
const ITEM = { id: 'i1', type: 'UNDEFINED', spaceId: SPACE, createdById: 'other', lockedAt: null }
const BASE = `/spaces/${SPACE}/items/i1/secrets`
const savedKey = process.env.SECRETS_ENCRYPTION_KEY

/** Ligne telle que la base la rendrait (valeur et identifiant chiffrés avec l'id comme AAD) */
function row(over: Record<string, unknown> = {}) {
  const id = (over.id as string) ?? 's1'
  return {
    id, itemId: 'i1', label: 'Accès test', visibility: 'PRIVATE', position: 0, createdById: USER,
    revealCount: 0, lastRevealedAt: null, createdAt: new Date(), updatedAt: new Date(), createdBy: { name: 'Moi' },
    loginEnc: encryptSecret(LOGIN, id), valueEnc: encryptSecret(WITNESS, id),
    ...over,
  }
}
/** Ce que renvoie le select de liste (sans valueEnc) */
const listed = (r: any) => { const { valueEnc: _v, ...rest } = r; return rest }

describe('Routes données sécurisées', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = (admin = false) => ({ authorization: `Bearer ${getTestToken(app)}`, ...(admin ? { 'x-admin-mode': 'true' } : {}) })
  const as = (role: string | null) => prisma.spaceMembership.findUnique.mockResolvedValue(
    role ? { id: 'm', userId: USER, spaceId: SPACE, role, joinedAt: new Date() } : null)
  const auditDump = () => JSON.stringify((createAuditLog as any).mock.calls)

  beforeEach(async () => {
    vi.clearAllMocks()
    ctx.via = undefined
    process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    ;({ app, prisma } = await buildItemsTestApp())
    as('MEMBER')
    prisma.item.findFirst.mockResolvedValue(ITEM)
    prisma.item.update.mockResolvedValue(ITEM)
    prisma.itemSecret.count.mockResolvedValue(0)
    prisma.itemSecret.aggregate.mockResolvedValue({ _max: { position: null } })
    prisma.itemSecret.create.mockImplementation(async ({ data }: any) => ({ ...row({ id: data.id }), ...data, createdBy: { name: 'Moi' } }))
    prisma.itemSecret.update.mockImplementation(async ({ where, data }: any) => listed({ ...row({ id: where.id }), ...data }))
  })
  afterAll(() => { process.env.SECRETS_ENCRYPTION_KEY = savedKey })

  it('stocke chiffré : la valeur et l\'identifiant n\'atteignent jamais la base en clair', async () => {
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'Accès test', login: LOGIN, value: WITNESS } })
    expect(res.statusCode).toBe(201)
    const sent = JSON.stringify(prisma.itemSecret.create.mock.calls)
    expect(sent).not.toContain(WITNESS)
    expect(sent).not.toContain(LOGIN)
    expect(prisma.itemSecret.create.mock.calls[0][0].data.visibility).toBe('PRIVATE')
    expect(res.body).not.toContain(WITNESS)
    expect(res.body).not.toContain('v1:')
    expect(res.json().hasLogin).toBe(true)
  })

  it('liste sans valeur ni chiffré, select sans valueEnc', async () => {
    prisma.itemSecret.findMany.mockResolvedValue([listed(row())])
    const res = await app.inject({ method: 'GET', url: BASE, headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain(WITNESS)
    expect(res.body).not.toContain(LOGIN)
    expect(res.body).not.toContain('v1:')
    expect(res.body).not.toContain('valueEnc')
    expect(res.body).not.toContain('loginEnc')
    expect(prisma.itemSecret.findMany.mock.calls[0][0].select.valueEnc).toBeUndefined()
    expect(res.json()[0]).toMatchObject({ label: 'Accès test', hasLogin: true, canReveal: true, canEdit: true })
  })

  it('donnée « moi seul » d\'un autre : absente de la liste, révélation 404', async () => {
    prisma.itemSecret.findMany.mockResolvedValue([listed(row({ createdById: 'other' }))])
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth() })
    expect(list.json()).toEqual([])
    prisma.itemSecret.findFirst.mockResolvedValue(row({ createdById: 'other' }))
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(404)
    expect(rev.body).not.toContain(WITNESS)
  })

  it('donnée « membres de l\'espace » d\'un autre : révélée à un membre', async () => {
    prisma.itemSecret.findFirst.mockResolvedValue(row({ createdById: 'other', visibility: 'SPACE' }))
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(200)
    expect(rev.json()).toEqual({ login: LOGIN, value: WITNESS })
  })

  it('lecteur (VIEWER) : liste vide, aucune révélation', async () => {
    as('VIEWER')
    prisma.itemSecret.findMany.mockResolvedValue([listed(row({ createdById: 'other', visibility: 'SPACE' }))])
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth() })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual([])
    prisma.itemSecret.findFirst.mockResolvedValue(row({ createdById: 'other', visibility: 'SPACE' }))
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(404)
    expect(rev.body).not.toContain(WITNESS)
    const add = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'a', value: WITNESS } })
    expect(add.statusCode).toBe(403)
  })

  it('mode admin non auteur : voit le libellé, révélation 403, suppression permise', async () => {
    as(null)
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'ADMIN' })
    prisma.space.findUnique.mockResolvedValue(null)
    prisma.itemSecret.findMany.mockResolvedValue([listed(row({ createdById: 'other' }))])
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth(true) })
    expect(list.json()[0]).toMatchObject({ label: 'Accès test', canReveal: false, canEdit: false, canDelete: true })
    prisma.itemSecret.findFirst.mockResolvedValue(row({ createdById: 'other', visibility: 'SPACE' }))
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth(true) })
    expect(rev.statusCode).toBe(403)
    expect(rev.body).not.toContain(WITNESS)
    prisma.itemSecret.findFirst.mockResolvedValue(listed(row({ createdById: 'other' })))
    const del = await app.inject({ method: 'DELETE', url: `${BASE}/s1`, headers: auth(true) })
    expect(del.statusCode).toBe(204)
  })

  it('jeton MCP : révélation refusée', async () => {
    ctx.via = 'mcp'
    prisma.itemSecret.findFirst.mockResolvedValue(row())
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(403)
    expect(rev.body).not.toContain(WITNESS)
  })

  it('rôle MEMBER implicite (espace OPEN, communauté publique) : ni liste ni révélation des données « membres »', async () => {
    // Non-membre, espace OPEN d'une communauté publique : checkSpaceAccess rend MEMBER (rôle implicite)
    as(null)
    prisma.space.findUnique.mockResolvedValue({ communityId: 'c1', visibility: 'OPEN', parentId: null, community: { visibility: 'OPEN' } })
    prisma.communityMembership.findUnique.mockResolvedValue(null)
    prisma.itemSecret.findMany.mockResolvedValue([listed(row({ createdById: 'other', visibility: 'SPACE' }))])
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth() })
    expect(list.json()).toEqual([])
    prisma.itemSecret.findFirst.mockResolvedValue(row({ createdById: 'other', visibility: 'SPACE' }))
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(404)
    expect(rev.body).not.toContain(WITNESS)
  })

  it('jeton personnel (PAT) : révélation refusée, même pour l\'auteur', async () => {
    const { token, tokenHash } = generatePersonalToken()
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat-1', name: 'Claude perso', tokenHash, scope: 'write', userId: USER, revokedAt: null, expiresAt: null,
      lastUsedAt: new Date(), user: { id: USER, email: 'u@test.com', disabledAt: null, globalRole: 'USER', mcpAccessGrantedAt: new Date() },
    })
    prisma.itemSecret.findFirst.mockResolvedValue(row())
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: { authorization: `Bearer ${token}` } })
    expect(rev.statusCode).toBe(403)
    expect(rev.body).not.toContain(WITNESS)
  })

  it('auteur : révélation no-store, compteur incrémenté, journal READ sans valeur', async () => {
    prisma.itemSecret.findFirst.mockResolvedValue(row())
    const rev = await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })
    expect(rev.statusCode).toBe(200)
    expect(rev.headers['cache-control']).toBe('no-store')
    expect(prisma.itemSecret.update.mock.calls[0][0].data.revealCount).toEqual({ increment: 1 })
    expect((createAuditLog as any).mock.calls.at(-1)[1]).toMatchObject({ action: 'READ', entityId: 'i1' })
    expect(auditDump()).not.toContain(WITNESS)
    expect(auditDump()).not.toContain(LOGIN)
  })

  it('journal des écritures sans valeur', async () => {
    await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'Accès test', login: LOGIN, value: WITNESS } })
    prisma.itemSecret.findFirst.mockResolvedValue(listed(row()))
    await app.inject({ method: 'PATCH', url: `${BASE}/s1`, headers: auth(), payload: { value: WITNESS + 'b', visibility: 'SPACE' } })
    expect(auditDump()).not.toContain(WITNESS)
    expect(auditDump()).not.toContain(LOGIN)
    expect((createAuditLog as any).mock.calls.at(-1)[1].changes.after.contentChange).toMatchObject({ op: 'update', kind: 'SECRET', valueChanged: true, visibility: 'SPACE' })
    expect(JSON.stringify(prisma.itemSecret.update.mock.calls)).not.toContain(WITNESS)
  })

  it('déplacement vers un autre espace : auteur seul, « moi seul », aucune valeur exposée', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'i2', spaceId: 'space-2', lockedAt: null })
    prisma.itemSecret.findFirst.mockResolvedValue(listed(row({ visibility: 'SPACE' })))
    const res = await app.inject({ method: 'POST', url: `${BASE}/s1/move`, headers: auth(), payload: { targetItemId: 'i2' } })
    expect(res.statusCode).toBe(200)
    const data = prisma.itemSecret.update.mock.calls[0][0].data
    expect(data).toMatchObject({ itemId: 'i2', visibility: 'PRIVATE' })
    expect(data.valueEnc).toBeUndefined()
    expect(res.body).not.toContain(WITNESS)
    expect(res.body).not.toContain('v1:')
    expect(auditDump()).not.toContain(WITNESS)
    expect(auditDump()).toContain('movedToId')
    prisma.itemSecret.findFirst.mockResolvedValue(listed(row({ createdById: 'other', visibility: 'SPACE' })))
    const other = await app.inject({ method: 'POST', url: `${BASE}/s1/move`, headers: auth(), payload: { targetItemId: 'i2' } })
    expect(other.statusCode).toBe(403)
  })

  it('modification par un non-auteur : 403', async () => {
    prisma.itemSecret.findFirst.mockResolvedValue(listed(row({ createdById: 'other', visibility: 'SPACE' })))
    const res = await app.inject({ method: 'PATCH', url: `${BASE}/s1`, headers: auth(), payload: { label: 'x' } })
    expect(res.statusCode).toBe(403)
  })

  it(`au-delà de ${ITEM_SECRETS_MAX} données : 409`, async () => {
    prisma.itemSecret.count.mockResolvedValue(ITEM_SECRETS_MAX)
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'a', value: WITNESS } })
    expect(res.statusCode).toBe(409)
    expect(prisma.itemSecret.create).not.toHaveBeenCalled()
  })

  it('clé absente : 503 en écriture et révélation, liste lisible', async () => {
    delete process.env.SECRETS_ENCRYPTION_KEY
    prisma.itemSecret.findMany.mockResolvedValue([])
    expect((await app.inject({ method: 'GET', url: BASE, headers: auth() })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'a', value: WITNESS } })).statusCode).toBe(503)
    prisma.itemSecret.findFirst.mockResolvedValue({ id: 's1', label: 'a', createdById: USER, visibility: 'PRIVATE', loginEnc: null, valueEnc: 'v1:x:y:z' })
    expect((await app.inject({ method: 'POST', url: `${BASE}/s1/reveal`, headers: auth() })).statusCode).toBe(503)
    expect(prisma.itemSecret.create).not.toHaveBeenCalled()
  })

  it('élément verrouillé : création refusée', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, lockedAt: new Date() })
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label: 'a', value: WITNESS } })
    expect(res.statusCode).toBe(403)
  })

  it('libellé vide ou trop long : 400 sans écho de la valeur', async () => {
    for (const label of ['', 'x'.repeat(121)]) {
      const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { label, value: WITNESS } })
      expect(res.statusCode).toBe(400)
      expect(res.body).not.toContain(WITNESS)
    }
  })
})
