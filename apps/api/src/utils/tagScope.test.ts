/* TNR de la portée des tags (2026-11-11) : visibles = communauté + globaux, recherche par nom (global d'abord),
   report des tags vers un autre espace (gardé, repris par nom, créé dans la communauté cible, abandonné sans communauté). */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { findTagByName, mapTagsToSpace, tagMapping, tagsVisibleWhere } from './tagScope.js'

const t = (id: string, name: string, communityId: string | null = null, spaceId: string | null = null) =>
  ({ id, name, color: null, communityId, spaceId })

describe('tagScope', () => {
  it('tagsVisibleWhere : communauté + globaux, ou globaux seuls', () => {
    expect(tagsVisibleWhere('c1')).toEqual({ OR: [{ communityId: 'c1' }, { communityId: null, spaceId: null }] })
    expect(tagsVisibleWhere(null)).toEqual({ communityId: null, spaceId: null })
  })

  it('findTagByName : le global passe avant celui de la communauté', async () => {
    const prisma = createMockPrisma()
    prisma.tag.findMany.mockResolvedValue([t('c', 'Bug', 'c1'), t('g', 'bug')])
    expect((await findTagByName(prisma as any, 'c1', ' bug '))?.id).toBe('g')
    expect(prisma.tag.findMany.mock.calls[0][0].where.name).toEqual({ equals: 'bug', mode: 'insensitive' })
  })

  it('mapTagsToSpace : global et même communauté gardés, autre communauté reprise par nom ou créée', async () => {
    const prisma = createMockPrisma()
    prisma.space.findUnique.mockResolvedValue({ communityId: 'c2' })
    prisma.tag.findMany
      .mockResolvedValueOnce([t('x2', 'ux', 'c2')]) // « ux » existe dans c2
      .mockResolvedValueOnce([]) // « perf » n'existe pas
    prisma.tag.create.mockResolvedValue({ id: 'new' })

    const ids = await mapTagsToSpace(prisma as any, [t('g', 'bug'), t('k', 'k', 'c2'), t('x1', 'ux', 'c1'), t('p1', 'perf', 'c1')], 'target')

    expect(ids).toEqual(['g', 'k', 'x2', 'new'])
    expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'perf', color: null, communityId: 'c2' }, select: { id: true } })
  })

  it('mapTagsToSpace : cible sans communauté → seuls les globaux (ou un global de même nom)', async () => {
    const prisma = createMockPrisma()
    prisma.space.findUnique.mockResolvedValue({ communityId: null })
    prisma.tag.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([t('g2', 'ux')])

    const ids = await mapTagsToSpace(prisma as any, [t('g', 'bug'), t('p', 'perf', 'c1'), t('u', 'ux', 'c1')], 'target')

    expect(ids).toEqual(['g', 'g2'])
    expect(prisma.tag.create).not.toHaveBeenCalled()
  })

  it('tagMapping : table id source → id cible, tag abandonné absent', async () => {
    const prisma = createMockPrisma()
    prisma.space.findUnique.mockResolvedValue({ communityId: null })
    prisma.tag.findMany.mockResolvedValue([])
    const map = await tagMapping(prisma as any, [t('g', 'bug'), t('g', 'bug'), t('p', 'perf', 'c1')], 'target')
    expect([...map.entries()]).toEqual([['g', 'g']])
  })
})
