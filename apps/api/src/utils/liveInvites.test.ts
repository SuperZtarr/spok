/* Tests des règles d'invitation de séance : candidats (communauté sans accès au parent), validation,
 * ajout idempotent (adhésion espace de séance + invitation + notification), retrait. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'

vi.mock('../routes/items.js', () => ({ checkSpaceAccess: vi.fn() }))
vi.mock('./notifications.js', () => ({ createNotification: vi.fn(async () => {}) }))
import { checkSpaceAccess } from '../routes/items.js'
import { createNotification } from './notifications.js'
import { listInviteCandidates, assertInvitable, addInvitees, removeInvitee } from './liveInvites.js'

const session = { id: 'ls-1', spaceId: 'sess-space', parentSpaceId: 'parent', hostId: 'host' }

describe('liveInvites', () => {
  let prisma: MockPrisma
  beforeEach(() => {
    prisma = createMockPrisma()
    vi.mocked(checkSpaceAccess).mockReset()
    vi.mocked(createNotification).mockClear()
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1' })
  })

  it('candidats : membres de la communauté sans accès au parent, hors exclus', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([
      { userId: 'a', user: { id: 'a', name: 'Alice', email: 'a@x' } },
      { userId: 'b', user: { id: 'b', name: 'Bob', email: 'b@x' } },
      { userId: 'host', user: { id: 'host', name: 'Hôte', email: 'h@x' } },
    ])
    vi.mocked(checkSpaceAccess).mockImplementation(async (_p, uid) => (uid === 'b' ? ({ role: 'MEMBER' } as any) : null))
    expect(await listInviteCandidates(prisma as any, 'parent', ['host'])).toEqual([{ userId: 'a', name: 'Alice', email: 'a@x' }])
  })

  it('validation : refuse un non-membre de la communauté', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([])
    expect(await assertInvitable(prisma as any, 'parent', ['z'])).toMatch(/communauté/)
  })

  it('validation : refuse quelqu\'un qui a déjà accès à l\'espace parent', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([{ userId: 'b' }])
    vi.mocked(checkSpaceAccess).mockResolvedValue({ role: 'MEMBER' } as any)
    expect(await assertInvitable(prisma as any, 'parent', ['b'])).toMatch(/déjà accès/)
  })

  it('ajout : adhésion MEMBER à l\'espace de séance + invitation + notification, idempotent', async () => {
    prisma.liveSessionInvite.findUnique.mockImplementation(async (args: any) => (args.where.sessionId_userId.userId === 'old' ? { id: 'x' } : null))
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    const added = await addInvitees(prisma as any, session, ['a', 'old', 'a'], 'host', '2026-10-11')
    expect(added).toEqual(['a'])
    expect(prisma.spaceMembership.create).toHaveBeenCalledWith({ data: { userId: 'a', spaceId: 'sess-space', role: 'MEMBER' } })
    expect(prisma.liveSessionInvite.create).toHaveBeenCalledWith({ data: { sessionId: 'ls-1', userId: 'a', invitedById: 'host' } })
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createNotification).mock.calls[0][1]).toMatchObject({ userId: 'a', type: 'INVITATION', link: '/spaces/sess-space' })
  })

  it('retrait : supprime invitation et adhésion à l\'espace de séance', async () => {
    prisma.liveSessionInvite.findUnique.mockResolvedValue({ id: 'inv' })
    expect(await removeInvitee(prisma as any, session, 'a')).toBe(true)
    expect(prisma.liveSessionInvite.delete).toHaveBeenCalledWith({ where: { id: 'inv' } })
    expect(prisma.spaceMembership.deleteMany).toHaveBeenCalledWith({ where: { userId: 'a', spaceId: 'sess-space' } })
  })

  it('retrait d\'un non-invité : false, rien supprimé', async () => {
    prisma.liveSessionInvite.findUnique.mockResolvedValue(null)
    expect(await removeInvitee(prisma as any, session, 'a')).toBe(false)
    expect(prisma.spaceMembership.deleteMany).not.toHaveBeenCalled()
  })
})
