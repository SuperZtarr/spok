/* Tests de copyItemToSession / revealChildInSession / cloneSessionCopies : copie verrouillée sans sous-items (révélés
 * un par un), réutilisation, images, recopie des éléments présentés vers la séance « suite ». */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'

vi.mock('./r2.js', () => ({
  isR2Configured: () => true,
  isR2Url: (u: string | null) => !!u && u.startsWith('https://cdn.test/'),
  copyR2Object: vi.fn(async (_url: string, id: string) => `https://cdn.test/items/${id}/copy.webp`),
}))

import { copyItemToSession, revealChildInSession, cloneSessionCopies } from './sessionCopy.js'

const source = {
  id: 'src-1', spaceId: 'src-space', type: 'NOTE', title: 'Budget', status: 'todo', priority: null,
  description: '<p>x</p><img src="https://cdn.test/items/src-1/a.webp">', content: null,
  url: 'https://cdn.test/items/src-1/main.webp', dueDate: null, startDate: null, endDate: null,
  position: 3, updatedAt: new Date('2026-10-10T09:00:00Z'), tags: [],
}

describe('copyItemToSession', () => {
  let prisma: MockPrisma
  beforeEach(() => {
    prisma = createMockPrisma()
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'src-1' ? source : null)
    prisma.item.findMany.mockImplementation(async ({ where }: any) =>
      where.parentId === 'src-1' ? [{ ...source, id: 'child-1', title: 'Ligne', url: null, description: null, position: 0 }] : [])
    let n = 0
    prisma.item.create.mockImplementation(async ({ data }: any) => ({ id: `copy-${++n}`, ...data, tags: [] }))
    prisma.item.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data, tags: [] }))
  })

  it("copie la source seule (sous-items non révélés), verrouillée, avec trace d'origine", async () => {
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(false)
    const created = prisma.item.create.mock.calls.map((c: any[]) => c[0].data)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ spaceId: 'sess', sourceItemId: 'src-1', sourceSpaceId: 'src-space', parentId: null })
    expect(created[0].lockedAt).toBeInstanceOf(Date)
  })

  it("se range sous la copie de son parent d'origine déjà présenté", async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'src-2') return { ...source, id: 'src-2', parentId: 'src-1', url: null, description: null }
      if (where.sourceItemId === 'src-1') return { id: 'copy-parent' }
      return null
    })
    await copyItemToSession(prisma as any, { sourceItemId: 'src-2', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(prisma.item.create.mock.calls[0][0].data.parentId).toBe('copy-parent')
  })

  it("revealChildInSession copie l'enfant sous la copie parente, verrouillé", async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'child-1' ? { ...source, id: 'child-1', title: 'Ligne', url: null, description: null, parentId: 'src-1' } : null)
    const child = await revealChildInSession(prisma as any, { parentCopyId: 'copy-p', sourceChildId: 'child-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    const data = prisma.item.create.mock.calls[0][0].data
    expect(data).toMatchObject({ parentId: 'copy-p', sourceItemId: 'child-1', spaceId: 'sess' })
    expect(data.lockedAt).toBeInstanceOf(Date)
    expect(child.id).toBe('copy-1')
  })

  it("revealChildInSession réutilise la copie existante si l'enfant est inchangé", async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'child-1') return { ...source, id: 'child-1', parentId: 'src-1' }
      if (where.parentId === 'copy-p' && where.sourceItemId === 'child-1') return { id: 'copy-c', lockedAt: new Date('2026-10-10T09:30:00Z'), tags: [] }
      return null
    })
    const child = await revealChildInSession(prisma as any, { parentCopyId: 'copy-p', sourceChildId: 'child-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(child.id).toBe('copy-c')
    expect(prisma.item.create).not.toHaveBeenCalled()
  })

  it("item déjà dans l'espace de séance : réaffiché tel quel, pas de copie", async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'copy-9' ? { id: 'copy-9', spaceId: 'sess', title: 'Copie', lockedAt: new Date(), tags: [] } : null)
    prisma.item.findMany.mockResolvedValue([])
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'copy-9', sourceSpaceId: 'sess', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(true)
    expect(res.item.id).toBe('copy-9')
    expect(prisma.item.create).not.toHaveBeenCalled()
  })

  it('duplique les images R2 (url + description)', async () => {
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.item.url).toMatch(/^https:\/\/cdn\.test\/items\/copy-1\//)
    expect(res.item.description).not.toContain('items/src-1/')
  })

  it('réutilise la dernière copie si la source n\'a pas changé', async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.sourceItemId === 'src-1') return { id: 'copy-old', lockedAt: new Date('2026-10-10T09:30:00Z'), tags: [] }
      return where.id === 'src-1' ? source : null
    })
    prisma.item.findMany.mockResolvedValue([])
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(true)
    expect(res.item.id).toBe('copy-old')
    expect(prisma.item.create).not.toHaveBeenCalled()
  })

  it('source introuvable → erreur NOT_FOUND', async () => {
    await expect(copyItemToSession(prisma as any, { sourceItemId: 'nope', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('cloneSessionCopies', () => {
  let prisma: MockPrisma
  const presentedAt = new Date('2026-10-03T10:00:00Z')
  beforeEach(() => {
    prisma = createMockPrisma()
    let n = 0
    prisma.item.create.mockImplementation(async ({ data }: any) => ({ id: `new-${++n}`, ...data, tags: [] }))
    prisma.item.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data, tags: [] }))
  })

  it("recopie les copies verrouillées (hiérarchie entre copies, date et origine conservées), pas l'organisation", async () => {
    prisma.item.findMany.mockResolvedValue([
      { id: 'c-child', parentId: 'c-parent', lockedAt: presentedAt, sourceItemId: 's-child', sourceSpaceId: 'src', createdById: 'p1', type: 'NOTE', title: 'Enfant', description: null, url: null, position: 0, tags: [] },
      { id: 'c-parent', parentId: 'theme-1', lockedAt: presentedAt, sourceItemId: 's-parent', sourceSpaceId: 'src', createdById: 'p1', type: 'NOTE', title: 'Parent', description: null, url: null, position: 1, tags: [] },
    ])
    const count = await cloneSessionCopies(prisma as any, { fromSpaceId: 'old', toSpaceId: 'new' })
    expect(count).toBe(2)
    expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { spaceId: 'old', lockedAt: { not: null } } }))
    const created = prisma.item.create.mock.calls.map((c: any[]) => c[0].data)
    const parent = created.find((d: any) => d.title === 'Parent')
    const child = created.find((d: any) => d.title === 'Enfant')
    expect(parent).toMatchObject({ spaceId: 'new', parentId: null, lockedAt: presentedAt, sourceItemId: 's-parent', sourceSpaceId: 'src', createdById: 'p1' })
    expect(child.parentId).toBe('new-1')
  })
})
