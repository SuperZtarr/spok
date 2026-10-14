/*
 * TNR anti-IDOR (2026-10-14) : les routes d'items contrôlent l'accès à l'espace de l'URL — l'item visé doit
 * donc appartenir à CET espace. Sinon un membre de l'espace A agirait sur un item d'un espace privé B en
 * passant /spaces/A/items/<id de B>. Couvre fusion, absorption des enfants et réactions (item, contribution).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
  serializeRelationForAudit: vi.fn((rel: any) => ({ id: rel?.id })),
  serializeSpaceForAudit: vi.fn((space: any) => ({ id: space?.id })),
  serializeCommunityForAudit: vi.fn((c: any) => ({ id: c?.id })),
}))
vi.mock('../utils/r2.js', () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  processImage: vi.fn(),
  uploadImageToR2: vi.fn(),
  deleteImageFromR2: vi.fn(),
  uploadFileToR2: vi.fn(),
  deleteFileFromR2: vi.fn(),
}))

const SPACE_ID = 'space-1'
const USER_ID = 'test-user-id'
const KEEP = {
  title: 'source', type: 'source', status: 'source', priority: 'source', assignedToId: 'source',
  startDate: 'source', endDate: 'source', dueDate: 'source', url: 'source', description: 'concat',
}

describe('Items — l\'item doit appartenir à l\'espace de l\'URL', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string
  const auth = () => ({ authorization: `Bearer ${token}` })

  beforeEach(async () => {
    const r = await buildItemsTestApp()
    app = r.app
    prisma = r.prisma
    token = getTestToken(app)
    // Membre de l'espace de l'URL
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm1', userId: USER_ID, spaceId: SPACE_ID, role: 'MEMBER' })
    // Les items « foreign-* » vivent dans un autre espace : introuvables quand on filtre sur SPACE_ID
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.spaceId === SPACE_ID && !String(where.id).startsWith('foreign')
        ? { id: where.id, spaceId: SPACE_ID, tags: [], relationsFrom: [], relationsTo: [] }
        : null)
    prisma.contribution.findFirst.mockResolvedValue(null)
  })

  it('fusion : source d\'un autre espace → 404, rien n\'est écrit', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/foreign-1/merge`, headers: auth(),
      payload: { targetItemId: 'mine-1', keep: KEEP },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.item.update).not.toHaveBeenCalled()
    expect(prisma.item.delete).not.toHaveBeenCalled()
  })

  it('fusion : cible d\'un autre espace → 404', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/mine-1/merge`, headers: auth(),
      payload: { targetItemId: 'foreign-2', keep: KEEP },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('absorption : parent d\'un autre espace → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/spaces/${SPACE_ID}/items/foreign-1/absorb-children`, headers: auth() })
    expect(res.statusCode).toBe(404)
    expect(prisma.item.findMany).not.toHaveBeenCalled()
  })

  it('réaction sur un item d\'un autre espace → 404, aucune réaction créée', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/foreign-1/reactions`, headers: auth(), payload: { reactionType: '👍' },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.reaction.create).not.toHaveBeenCalled()
    expect(prisma.reaction.findMany).not.toHaveBeenCalled()
  })

  it('réaction sur une contribution hors de l\'item/espace → 404', async () => {
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/mine-1/contributions/foreign-c/reactions`, headers: auth(), payload: { reactionType: '👍' },
    })
    expect(res.statusCode).toBe(404)
    expect(prisma.reaction.create).not.toHaveBeenCalled()
  })

  it('réaction sur un item de l\'espace → acceptée', async () => {
    prisma.reaction.create.mockResolvedValue({ id: 'r1' })
    const res = await app.inject({
      method: 'POST', url: `/spaces/${SPACE_ID}/items/mine-1/reactions`, headers: auth(), payload: { reactionType: '👍' },
    })
    expect(res.statusCode).toBe(200)
    expect(prisma.reaction.create).toHaveBeenCalled()
  })
})
