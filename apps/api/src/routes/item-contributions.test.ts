/*
 * TNR des contributions (POST/PATCH …/items/:id/contributions) : vote de l'auteur gardé par chaque contribution
 * (règle contribution-vote-kept, 2026-11-12) — enregistré à la création, absent si non fourni, borné à 50 caractères,
 * jamais changé par une modification du texte. Rôles pilotés par l'adhésion simulée (checkSpaceAccess).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))
vi.mock('../utils/notifications.js', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../utils/mentions.js', () => ({ notifyMentionedUsers: vi.fn().mockResolvedValue(undefined) }))

const SPACE = 'space-1'
const USER = 'test-user-id'
const ITEM = { id: 'i1', spaceId: SPACE, title: 'Élément', createdById: USER, assignedToId: null }

describe('Contributions : vote de l\'auteur', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const post = (payload: unknown) =>
    app.inject({ method: 'POST', url: `/spaces/${SPACE}/items/i1/contributions`, headers: auth(), payload: payload as any })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role: 'MEMBER', joinedAt: new Date() })
    prisma.item.findFirst.mockResolvedValue(ITEM)
    prisma.item.update.mockResolvedValue(ITEM)
    prisma.contribution.create.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data, author: { id: USER, name: 'Test' } }))
  })

  it('enregistre le vote qui a ouvert le champ', async () => {
    const res = await post({ content: '<p>Bien vu</p>', reactionType: 'pertinent' })
    expect(res.statusCode).toBe(201)
    expect(prisma.contribution.create.mock.calls[0][0].data.reactionType).toBe('pertinent')
    expect(res.json().reactionType).toBe('pertinent')
  })

  it('sans vote : contribution créée sans reactionType', async () => {
    const res = await post({ content: '<p>Texte</p>' })
    expect(res.statusCode).toBe(201)
    expect(prisma.contribution.create.mock.calls[0][0].data).not.toHaveProperty('reactionType')
  })

  it('vote trop long refusé', async () => {
    const res = await post({ content: '<p>x</p>', reactionType: 'x'.repeat(51) })
    expect(res.statusCode).toBe(400)
    expect(prisma.contribution.create).not.toHaveBeenCalled()
  })

  it('la modification du texte ne touche pas au vote', async () => {
    prisma.contribution.findFirst.mockResolvedValue({ id: 'c1', itemId: 'i1', authorId: USER, content: 'a', reactionType: 'trollage' })
    prisma.contribution.update.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }))
    const res = await app.inject({
      method: 'PATCH', url: `/spaces/${SPACE}/items/i1/contributions/c1`, headers: auth(),
      payload: { content: 'b', reactionType: 'pertinent' },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.contribution.update.mock.calls[0][0].data).toEqual({ content: 'b' })
  })
})
