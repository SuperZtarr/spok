/*
 * TNR du type Question (2026-11-08) : statuts réservés (statusForType, statusesForType, withDefaultStatuses),
 * routes …/question (lecture sans vote pour un lecteur, options à identifiant stable, issue, vote figé après décision,
 * issue d'une copie de séance réservée à l'animateur et reportée sur la question d'origine).
 * Les rôles sont pilotés par l'adhésion simulée (spaceMembership.findUnique) que lit checkSpaceAccess.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { DEFAULT_STATUSES, QUESTION_STATUS, statusAllowedForType, statusesForType, withDefaultStatuses } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'
import { statusForType } from '../utils/question.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const Q = { id: 'q1', type: 'QUESTION', spaceId: SPACE, status: QUESTION_STATUS.OPEN, createdById: USER, assignedToId: null, lockedAt: null, sourceItemId: null }

describe('Statuts réservés', () => {
  it('une question ne propose que ses 4 issues, les autres types jamais', () => {
    expect(statusesForType(DEFAULT_STATUSES, 'QUESTION').map((s) => s.id)).toEqual(Object.values(QUESTION_STATUS))
    expect(statusesForType(DEFAULT_STATUSES, 'TASK').some((s) => s.id.startsWith('question_'))).toBe(false)
    expect(statusesForType(DEFAULT_STATUSES, null).some((s) => s.types?.length)).toBe(false)
  })

  it('statusForType normalise création et changement de type', () => {
    expect(statusForType('QUESTION', null)).toBe(QUESTION_STATUS.OPEN)
    expect(statusForType('QUESTION', 'done')).toBe(QUESTION_STATUS.OPEN)
    expect(statusForType('QUESTION', QUESTION_STATUS.DECIDED)).toBe(QUESTION_STATUS.DECIDED)
    expect(statusForType('TASK', QUESTION_STATUS.DECIDED)).toBeNull()
    expect(statusForType('TASK', 'todo')).toBe('todo')
    // Statut propre à une communauté (inconnu des défauts) : conservé
    expect(statusForType('TASK', 'review')).toBe('review')
    expect(statusAllowedForType('review', 'QUESTION')).toBe(false)
  })

  it('référentiel personnalisé : issues ajoutées, réservation rétablie, libellé gardé', () => {
    const custom = [{ id: 'todo', label: 'À faire', color: 'c', borderColor: 'b', order: 0, visible: true },
      { id: QUESTION_STATUS.DECIDED, label: 'Décidée', color: 'c', borderColor: 'b', order: 1, visible: true }]
    const out = withDefaultStatuses(custom)
    expect(out.find((s) => s.id === QUESTION_STATUS.DECIDED)).toMatchObject({ label: 'Décidée', types: ['QUESTION'] })
    expect(out.filter((s) => s.types?.includes('QUESTION'))).toHaveLength(4)
  })
})

describe('Routes question', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const as = (role: string) => prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role, joinedAt: new Date() })
  const put = (path: string, payload: unknown) =>
    app.inject({ method: 'PUT', url: `/spaces/${SPACE}/items/q1/question/${path}`, headers: auth(), payload: payload as any })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp({ optionalAuth: true }))
    as('MEMBER')
    prisma.item.findFirst.mockResolvedValue(Q)
    prisma.item.findUnique.mockResolvedValue(Q)
    prisma.item.update.mockImplementation(async ({ data }: any) => ({ ...Q, ...data }))
    prisma.question.findUnique.mockResolvedValue({ itemId: 'q1', multiple: false })
    prisma.questionOption.findMany.mockResolvedValue([])
    prisma.questionVote.findMany.mockResolvedValue([])
    prisma.liveSession.findUnique.mockResolvedValue(null)
  })

  it('lecteur sans droit d’écriture :décompte nominatif, pas de vote, option majoritaire', async () => {
    as('VIEWER')
    prisma.questionOption.findMany.mockResolvedValue([{ id: 'o1', label: 'Oui', position: 0 }, { id: 'o2', label: 'Non', position: 1 }])
    prisma.questionVote.findMany.mockResolvedValue([
      { optionId: 'o1', userId: 'a', user: { id: 'a', name: 'Ana' } },
      { optionId: 'o1', userId: 'b', user: { id: 'b', name: 'Ben' } },
      { optionId: 'o2', userId: 'c', user: { id: 'c', name: 'Cid' } },
    ])
    const res = await app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/q1/question`, headers: auth() })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.options[0].voters.map((v: any) => v.name)).toEqual(['Ana', 'Ben'])
    expect(body).toMatchObject({ voterCount: 3, leadingOptionIds: ['o1'], canVote: false, canDecide: false, myOptionIds: [] })
  })

  it('options : identifiant gardé pour une option corrigée, absente retirée', async () => {
    prisma.questionOption.findMany.mockResolvedValueOnce([{ id: 'o1' }, { id: 'o2' }])
    const res = await put('options', { options: [{ id: 'o2', label: 'Non merci' }, { label: 'Peut-être' }] })
    expect(res.statusCode).toBe(200)
    expect(prisma.questionOption.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['o1'] } } })
    expect(prisma.questionOption.update).toHaveBeenCalledWith({ where: { id: 'o2' }, data: { label: 'Non merci', position: 0 } })
    expect(prisma.questionOption.create).toHaveBeenCalledWith({ data: { itemId: 'q1', label: 'Peut-être', position: 1 } })
  })

  it('options refusées sur une copie de séance', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...Q, lockedAt: new Date() })
    expect((await put('options', { options: [] })).statusCode).toBe(403)
  })

  it('vote : remplace le vote, refuse plusieurs options en choix unique', async () => {
    prisma.questionOption.findMany.mockResolvedValue([{ id: 'o1' }])
    expect((await put('vote', { optionIds: ['o1'] })).statusCode).toBe(200)
    expect(prisma.questionVote.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'q1', userId: USER } })
    expect(prisma.questionVote.createMany).toHaveBeenCalledWith({ data: [{ itemId: 'q1', optionId: 'o1', userId: USER }] })
    expect((await put('vote', { optionIds: ['o1', 'o2'] })).statusCode).toBe(400)
  })

  it('vote figé dès que la question n\'est plus ouverte', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...Q, status: QUESTION_STATUS.NO_CONCLUSION })
    expect((await put('vote', { optionIds: [] })).statusCode).toBe(409)
  })

  it('un lecteur (VIEWER) ne vote pas', async () => {
    as('VIEWER')
    expect((await put('vote', { optionIds: [] })).statusCode).toBe(403)
  })

  it('tranchée exige une option retenue ou une réponse écrite', async () => {
    expect((await put('outcome', { status: QUESTION_STATUS.DECIDED })).statusCode).toBe(400)
    prisma.questionOption.findFirst.mockResolvedValue({ id: 'o1' })
    prisma.question.upsert.mockResolvedValue({})
    const res = await put('outcome', { status: QUESTION_STATUS.DECIDED, chosenOptionId: 'o1', note: 'à confirmer' })
    expect(res.statusCode).toBe(200)
    expect(prisma.item.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: QUESTION_STATUS.DECIDED }) }))
    expect(prisma.question.update).toHaveBeenCalledWith({ where: { itemId: 'q1' }, data: { chosenOptionId: 'o1', answerText: null, note: 'à confirmer' } })
  })

  it('copie de séance : seul l\'animateur note l\'issue, reportée sur la question d\'origine', async () => {
    const copy = { ...Q, lockedAt: new Date(), sourceItemId: 'src', createdById: 'other' }
    const source = { ...Q, id: 'src', spaceId: 'origin', createdById: USER }
    prisma.item.findFirst.mockResolvedValue(copy)
    prisma.liveSession.findUnique.mockResolvedValue({ id: 'sess', hostId: 'someone-else' })
    expect((await put('outcome', { status: QUESTION_STATUS.POSTPONED })).statusCode).toBe(403)

    prisma.liveSession.findUnique.mockResolvedValue({ id: 'sess', hostId: USER })
    prisma.item.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'src' ? source : copy))
    prisma.question.upsert.mockResolvedValue({})
    const res = await put('outcome', { status: QUESTION_STATUS.POSTPONED, note: 'prochaine réunion' })
    expect(res.statusCode).toBe(200)
    const updatedIds = prisma.item.update.mock.calls.map((c: any) => c[0].where.id)
    expect(updatedIds).toEqual(expect.arrayContaining(['q1', 'src']))
  })
})
