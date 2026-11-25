/*
 * TNR du type Question (2026-11-08) : statuts réservés (statusForType — Réunion et Article compris depuis 2026-11-19,
 * correspondance par catégorie —, statusesForType, withDefaultStatuses),
 * routes …/question (lecture sans vote pour un lecteur, options à identifiant stable, issue, vote figé après décision,
 * issue d'une copie de séance réservée à l'animateur et reportée sur la question d'origine, réponse liée à un élément :
 * accès vérifié à l'enregistrement, élément montré seulement au lecteur qui peut le lire).
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
    // Ordre du registre (2026-11-21) : Ouverte, Reportée, Tranchée, Arbitrée, Sans conclusion
    expect(statusesForType(DEFAULT_STATUSES, 'QUESTION').map((s) => s.id)).toEqual([
      QUESTION_STATUS.OPEN, QUESTION_STATUS.POSTPONED, QUESTION_STATUS.DECIDED, QUESTION_STATUS.ARBITRATED, QUESTION_STATUS.NO_CONCLUSION,
    ])
    expect(statusesForType(DEFAULT_STATUSES, 'TASK').some((s) => s.id.startsWith('question_'))).toBe(false)
    expect(statusesForType(DEFAULT_STATUSES, null).some((s) => s.types?.length)).toBe(false)
  })

  it('statusForType normalise création et changement de type', () => {
    expect(statusForType('QUESTION', null)).toBe(QUESTION_STATUS.OPEN)
    expect(statusForType('QUESTION', 'done')).toBe(QUESTION_STATUS.OPEN)
    expect(statusForType('QUESTION', QUESTION_STATUS.DECIDED)).toBe(QUESTION_STATUS.DECIDED)
    // Statut d'un autre type : même catégorie parmi les statuts ordinaires (Tranchée = terminé → Terminé, 2026-11-19)
    expect(statusForType('TASK', QUESTION_STATUS.DECIDED)).toBe('done')
    expect(statusForType('TASK', 'todo')).toBe('todo')
    // Réunion et article (2026-11-19) : premier statut à la création, correspondance par catégorie au changement de type
    expect(statusForType('MEETING', null)).toBe('meeting_to_organize')
    expect(statusForType('MEETING', 'done')).toBe('meeting_minutes_sent')
    expect(statusForType('MEETING', 'cancelled')).toBe('meeting_cancelled')
    expect(statusForType('ARTICLE', 'to_validate')).toBe('article_to_validate')
    expect(statusForType('ARTICLE', 'late')).toBe('article_draft')
    expect(statusForType('TASK', 'meeting_minutes_sent')).toBe('done')
    expect(statusForType('MEETING', 'meeting_held')).toBe('meeting_held')
    expect(statusForType('QUESTION', 'meeting_minutes_sent')).toBe(QUESTION_STATUS.OPEN)
    // Période (2026-11-25) : statuts ordinaires, comme une tâche
    expect(statusForType('PERIOD', 'in_progress')).toBe('in_progress')
    expect(statusForType('PERIOD', 'meeting_minutes_sent')).toBe('done')
    expect(statusAllowedForType('todo', 'PERIOD')).toBe(true)
    expect(statusesForType(DEFAULT_STATUSES, 'PERIOD').some((s) => s.id === 'todo')).toBe(true)
    // Statut propre à une communauté (inconnu des défauts) : conservé
    expect(statusForType('TASK', 'review')).toBe('review')
    expect(statusAllowedForType('review', 'QUESTION')).toBe(false)
  })

  it('référentiel personnalisé : issues ajoutées, réservation rétablie, libellé gardé', () => {
    const custom = [{ id: 'todo', label: 'À faire', color: 'c', borderColor: 'b', order: 0, visible: true },
      { id: QUESTION_STATUS.DECIDED, label: 'Décidée', color: 'c', borderColor: 'b', order: 1, visible: true }]
    const out = withDefaultStatuses(custom)
    expect(out.find((s) => s.id === QUESTION_STATUS.DECIDED)).toMatchObject({ label: 'Décidée', types: ['QUESTION'] })
    expect(out.filter((s) => s.types?.includes('QUESTION'))).toHaveLength(5)
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
    expect(body).toMatchObject({ voterCount: 3, leadingOptionIds: ['o1'], unanimousOptionIds: [], canVote: false, canDecide: false, myOptionIds: [] })
  })

  it('unanimité : au moins 2 votants, tous sur la même option', async () => {
    prisma.questionOption.findMany.mockResolvedValue([{ id: 'o1', label: 'Oui', position: 0 }, { id: 'o2', label: 'Non', position: 1 }])
    const v = (userId: string) => ({ optionId: 'o1', userId, user: { id: userId, name: userId } })
    prisma.questionVote.findMany.mockResolvedValue([v('a'), v('b')])
    const get = () => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/q1/question`, headers: auth() })
    expect((await get()).json().unanimousOptionIds).toEqual(['o1'])
    prisma.questionVote.findMany.mockResolvedValue([v('a')])
    expect((await get()).json().unanimousOptionIds).toEqual([])
  })

  it('options : identifiant gardé pour une option corrigée, absente retirée', async () => {
    prisma.questionOption.findMany.mockResolvedValueOnce([{ id: 'o1' }, { id: 'o2' }])
    const res = await put('options', { options: [{ id: 'o2', label: 'Non merci' }, { label: 'Peut-être' }] })
    expect(res.statusCode).toBe(200)
    expect(prisma.questionOption.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['o1'] } } })
    expect(prisma.questionOption.update).toHaveBeenCalledWith({ where: { id: 'o2' }, data: { label: 'Non merci', position: 0, refItemId: null } })
    expect(prisma.questionOption.create).toHaveBeenCalledWith({ data: { itemId: 'q1', label: 'Peut-être', position: 1, refItemId: null } })
  })

  describe('réponse liée à un élément (2026-11-12)', () => {
    const membership = { id: 'm', userId: USER, spaceId: SPACE, role: 'MEMBER', joinedAt: new Date() }
    beforeEach(() => {
      // Accès à SPACE seulement
      prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
        (JSON.stringify(where).includes(SPACE) ? membership : null))
      prisma.item.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'ref-ok') return { id: 'ref-ok', spaceId: SPACE }
        if (where.id === 'ref-other') return { id: 'ref-other', spaceId: 'space-2' }
        return where.id === 'q1' ? Q : null
      })
    })

    it('lien enregistré vers un élément accessible ; lien gardé quand il n’est pas renvoyé', async () => {
      prisma.questionOption.findMany.mockResolvedValueOnce([{ id: 'o1', refItemId: 'ref-other' }])
      const res = await put('options', { options: [{ id: 'o1', label: 'A' }, { label: 'B', refItemId: 'ref-ok' }] })
      expect(res.statusCode).toBe(200)
      expect(prisma.questionOption.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { label: 'A', position: 0, refItemId: 'ref-other' } })
      expect(prisma.questionOption.create).toHaveBeenCalledWith({ data: { itemId: 'q1', label: 'B', position: 1, refItemId: 'ref-ok' } })
    })

    it('lien refusé vers un élément inaccessible, inconnu, ou la question elle-même', async () => {
      expect((await put('options', { options: [{ label: 'B', refItemId: 'ref-other' }] })).statusCode).toBe(400)
      expect((await put('options', { options: [{ label: 'B', refItemId: 'nope' }] })).statusCode).toBe(400)
      expect((await put('options', { options: [{ label: 'B', refItemId: 'q1' }] })).statusCode).toBe(400)
      expect(prisma.questionOption.create).not.toHaveBeenCalled()
    })

    it('vue : élément lié montré seulement si le lecteur peut lire son espace', async () => {
      prisma.questionOption.findMany.mockResolvedValue([
        { id: 'o1', label: 'A', position: 0, refItemId: 'ref-ok' },
        { id: 'o2', label: 'B', position: 1, refItemId: 'ref-other' },
      ])
      prisma.item.findMany.mockResolvedValue([
        { id: 'ref-ok', title: 'Fournisseur A', type: 'PROJECT', spaceId: SPACE },
        { id: 'ref-other', title: 'Secret', type: 'TASK', spaceId: 'space-2' },
      ])
      const body = (await app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/q1/question`, headers: auth() })).json()
      expect(body.options[0]).toMatchObject({ refItemId: 'ref-ok', refItem: { id: 'ref-ok', title: 'Fournisseur A', type: 'PROJECT', spaceId: SPACE } })
      expect(body.options[1]).toMatchObject({ refItemId: 'ref-other', refItem: null })
    })
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

  it('tranchée = réponse en tête des votes ; arbitrée = toute réponse ou réponse écrite (2026-11-21)', async () => {
    expect((await put('outcome', { status: QUESTION_STATUS.DECIDED })).statusCode).toBe(400)
    prisma.questionOption.findFirst.mockResolvedValue({ id: 'o1' })
    prisma.question.upsert.mockResolvedValue({})
    // Réponse écrite : arbitrage seulement
    expect((await put('outcome', { status: QUESTION_STATUS.DECIDED, answerText: 'autre' })).statusCode).toBe(400)
    // o1 pas en tête (o2 a plus de votes) : Tranchée refusée, Arbitrée acceptée
    prisma.questionVote.findMany.mockResolvedValue([{ optionId: 'o2' }, { optionId: 'o2' }, { optionId: 'o1' }])
    expect((await put('outcome', { status: QUESTION_STATUS.DECIDED, chosenOptionId: 'o1' })).statusCode).toBe(400)
    expect((await put('outcome', { status: QUESTION_STATUS.ARBITRATED, chosenOptionId: 'o1' })).statusCode).toBe(200)
    expect((await put('outcome', { status: QUESTION_STATUS.ARBITRATED, answerText: 'autre' })).statusCode).toBe(200)
    prisma.questionVote.findMany.mockResolvedValue([{ optionId: 'o1' }])
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
