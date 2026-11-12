/* TNR de GET …/items/:id/history (règle item-history-members) : lecteur de l'espace autorisé, non-membre refusé,
 * élément d'un autre espace refusé, entrées sans ligne utile sautées, mention MCP, curseur de page.
 * Rôles pilotés par l'adhésion simulée (spaceMembership.findUnique) que lit checkSpaceAccess. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

vi.mock('../utils/referentiels.js', async (orig) => ({
  ...(await orig<object>()),
  statusesOfSpace: vi.fn().mockResolvedValue([{ id: 'todo', label: 'À faire' }, { id: 'done', label: 'Terminé' }]),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const at = (iso: string) => new Date(iso)

describe('Historique d\'un élément', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const get = (qs = '') => app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/i1/history${qs}`, headers: { authorization: `Bearer ${getTestToken(app)}` } })

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role: 'VIEWER', joinedAt: new Date() })
    prisma.item.findFirst.mockResolvedValue({ id: 'i1' })
    prisma.item.findMany.mockResolvedValue([])
    prisma.user.findMany.mockResolvedValue([])
    prisma.space.findMany.mockResolvedValue([])
  })

  it('lecteur : lignes libellées, entrée de position seule sautée, mention MCP', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a3', action: 'UPDATE', entity: 'Item', entityId: 'i1', createdAt: at('2026-11-12T10:00:00Z'), user: { id: 'u', name: 'Ana' },
        changes: { before: { status: 'todo' }, after: { status: 'done' }, source: { via: 'mcp' } } },
      { id: 'a2', action: 'UPDATE', entity: 'Item', entityId: 'i1', createdAt: at('2026-11-11T10:00:00Z'), user: { id: 'u', name: 'Ana' },
        changes: { before: { position: 1 }, after: { position: 2 } } },
      { id: 'a1', action: 'CREATE', entity: 'Item', entityId: 'i1', createdAt: at('2026-11-10T10:00:00Z'), user: { id: 'u', name: 'Ana' }, changes: { after: {} } },
    ])
    const res = await get()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.entries.map((e: any) => e.id)).toEqual(['a3', 'a1'])
    expect(body.entries[0]).toMatchObject({ viaMcp: true, lines: [{ label: 'Statut', before: 'À faire', after: 'Terminé' }] })
    expect(body.entries[0]).not.toHaveProperty('changes')
    expect(body.nextCursor).toBeNull()
  })

  it('non-membre : 404', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: SPACE, visibility: 'PRIVATE', communityId: null, parentId: null })
    const res = await get()
    expect(res.statusCode).toBe(404)
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('élément hors de l\'espace : 404', async () => {
    prisma.item.findFirst.mockResolvedValue(null)
    expect((await get()).statusCode).toBe(404)
  })

  it('page pleine : curseur rendu, before relu', async () => {
    const logs = Array.from({ length: 60 }, (_, i) => ({
      id: `a${i}`, action: 'CREATE', entity: 'Item', entityId: 'i1', changes: { after: {} },
      createdAt: new Date(Date.UTC(2026, 10, 12, 0, 59 - i)), user: null,
    }))
    prisma.auditLog.findMany.mockResolvedValue(logs)
    const body = (await get('?before=2026-11-13T00:00:00.000Z')).json()
    expect(body.entries).toHaveLength(30)
    expect(body.nextCursor).toBe(logs[29].createdAt.toISOString())
    expect(prisma.auditLog.findMany.mock.calls[0][0].where.createdAt).toEqual({ lt: new Date('2026-11-13T00:00:00.000Z') })
  })
})
