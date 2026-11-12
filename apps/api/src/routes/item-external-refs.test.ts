/*
 * TNR des références externes d'un élément (règle item-external-refs, 2026-11-12) : normalisation partagée
 * (« Appli : réf », découpe sur « | », doublons), création et remplacement en bloc par POST/PATCH, limites (400),
 * audit avant/après pour l'historique, refus sur une copie de séance verrouillée, détail en chaînes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { splitExternalRefs, parseExternalRef, formatExternalRefs, cleanExternalRefs } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import { createAuditLog } from '../utils/audit.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const ITEM = { id: 'i1', type: 'TASK', spaceId: SPACE, title: 'T', status: null, createdById: USER, assignedToId: null, assignedToName: null, lockedAt: null, parentId: null, updatedAt: new Date('2026-11-12T10:00:00Z') }

describe('Découpe et mise en forme (shared)', () => {
  it('« Appli1 : Ref1 | appli2 : ref2 » → deux entrées normalisées', () => {
    expect(splitExternalRefs('Appli1:Ref1|  appli2  :  ref2 | ')).toEqual(['Appli1 : Ref1', 'appli2 : ref2'])
    expect(formatExternalRefs(['Appli1 : Ref1', 'appli2 : ref2'])).toBe('Appli1 : Ref1 | appli2 : ref2')
  })
  it('entrée sans application, doublons sans casse retirés', () => {
    expect(parseExternalRef('0000575747')).toEqual({ app: null, ref: '0000575747' })
    expect(parseExternalRef('Jira : PROJ-1')).toEqual({ app: 'Jira', ref: 'PROJ-1' })
    expect(cleanExternalRefs(['Jira : A', 'jira:a', ''])).toEqual(['Jira : A'])
  })
  it('« : » en bout de texte : gardé tel quel, sans application', () => {
    expect(parseExternalRef('Jira:')).toEqual({ app: null, ref: 'Jira:' })
  })
})

describe('Routes : références externes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })

  beforeEach(async () => {
    vi.mocked(createAuditLog).mockClear()
    ;({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role: 'OWNER', joinedAt: new Date() })
    prisma.space.findUnique.mockResolvedValue({ id: SPACE, communityId: null, parentId: null, visibility: 'PRIVATE' })
    prisma.item.findFirst.mockResolvedValue(ITEM)
    prisma.item.findUnique.mockResolvedValue(ITEM)
    prisma.item.create.mockImplementation(async ({ data }: any) => ({ ...ITEM, ...data, tags: [] }))
    prisma.item.update.mockImplementation(async ({ data }: any) => ({ ...ITEM, ...data, tags: [] }))
  })

  it('POST : entrées normalisées créées dans l\'ordre', async () => {
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE}/items`, headers: auth(),
      payload: { type: 'TASK', title: 'x', externalRefs: ['Appli1:Ref1', ' appli2 : ref2 ', 'appli1 : ref1'] } })
    expect(res.statusCode).toBe(201)
    expect(prisma.item.create.mock.calls[0][0].data.externalRefs).toEqual({
      create: [{ value: 'Appli1 : Ref1', position: 0 }, { value: 'appli2 : ref2', position: 1 }],
    })
  })

  it('POST : plus de 20 entrées refusées', async () => {
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE}/items`, headers: auth(),
      payload: { type: 'TASK', title: 'x', externalRefs: Array.from({ length: 21 }, (_, i) => `R${i}`) } })
    expect(res.statusCode).toBe(400)
    expect(prisma.item.create).not.toHaveBeenCalled()
  })

  it('PATCH : remplacement en bloc, audit avant/après', async () => {
    prisma.itemExternalRef.findMany.mockResolvedValue([{ value: 'Old : 1' }])
    const res = await app.inject({ method: 'PATCH', url: `/spaces/${SPACE}/items/i1`, headers: auth(),
      payload: { externalRefs: ['New : 2'] } })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemExternalRef.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'i1' } })
    expect(prisma.item.update.mock.calls[0][0].data.externalRefs).toEqual({ create: [{ value: 'New : 2', position: 0 }] })
    const changes = vi.mocked(createAuditLog).mock.calls.find((c) => c[1].action === 'UPDATE')![1].changes
    expect(changes.before?.externalRefs).toEqual(['Old : 1'])
    expect(changes.after?.externalRefs).toEqual(['New : 2'])
  })

  it('PATCH sans externalRefs : rien n\'est touché', async () => {
    await app.inject({ method: 'PATCH', url: `/spaces/${SPACE}/items/i1`, headers: auth(), payload: { title: 'y' } })
    expect(prisma.itemExternalRef.deleteMany).not.toHaveBeenCalled()
    expect(prisma.item.update.mock.calls[0][0].data.externalRefs).toBeUndefined()
  })

  it('copie de séance verrouillée : refusé', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, lockedAt: new Date() })
    const res = await app.inject({ method: 'PATCH', url: `/spaces/${SPACE}/items/i1`, headers: auth(), payload: { externalRefs: ['A : 1'] } })
    expect(res.statusCode).toBe(403)
  })
})
