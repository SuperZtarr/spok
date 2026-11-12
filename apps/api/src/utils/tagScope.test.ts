/* TNR de la portée des tags (global / communauté / espace hérité, 2026-11-12) : filtre des tags visibles, ancêtres
   d'un espace, priorité par nom (global, communauté, espace le plus proche), tags hors de portée, report vers un autre
   espace (gardé, repris par nom, recréé en tag de l'espace cible), remappage des tags devenus invisibles. */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import {
  communityScope, findTagByName, invisibleTagIds, isTagVisible, mapTagsToSpace, remapOutOfScopeItemTags,
  spaceTagScope, tagMapping, tagsVisibleWhere,
} from './tagScope.js'

const t = (id: string, name: string, communityId: string | null = null, spaceId: string | null = null) =>
  ({ id, name, color: null, communityId, spaceId })

/** Arbre : child → parent → root, tous dans c1 ; other (c2) sans parent */
const TREE: Record<string, { communityId: string | null; parentId: string | null }> = {
  child: { communityId: 'c1', parentId: 'parent' },
  parent: { communityId: 'c1', parentId: 'root' },
  root: { communityId: 'c1', parentId: null },
  other: { communityId: 'c2', parentId: null },
  lonely: { communityId: null, parentId: null },
}
function treePrisma() {
  const prisma = createMockPrisma()
  prisma.space.findUnique.mockImplementation(async ({ where }: any) => TREE[where.id] ?? null)
  return prisma
}

describe('tagScope', () => {
  it('spaceTagScope : communauté de l\'espace et chaîne de ses ancêtres', async () => {
    expect(await spaceTagScope(treePrisma() as any, 'child')).toEqual({ communityId: 'c1', spaceIds: ['child', 'parent', 'root'] })
    expect(await spaceTagScope(treePrisma() as any, 'lonely')).toEqual({ communityId: null, spaceIds: ['lonely'] })
  })

  it('tagsVisibleWhere : globaux + communauté + espaces ; globaux seuls sans rien', () => {
    expect(tagsVisibleWhere({ communityId: 'c1', spaceIds: ['a', 'b'] })).toEqual({
      OR: [{ communityId: null, spaceId: null }, { communityId: 'c1' }, { spaceId: { in: ['a', 'b'] } }],
    })
    expect(tagsVisibleWhere(communityScope(null))).toEqual({ communityId: null, spaceId: null })
  })

  it('isTagVisible : tag d\'un ancêtre visible, d\'un espace frère ou d\'une autre communauté non', () => {
    const scope = { communityId: 'c1', spaceIds: ['child', 'parent'] }
    expect(isTagVisible(t('g', 'g'), scope)).toBe(true)
    expect(isTagVisible(t('c', 'c', 'c1'), scope)).toBe(true)
    expect(isTagVisible(t('p', 'p', null, 'parent'), scope)).toBe(true)
    expect(isTagVisible(t('s', 's', null, 'sibling'), scope)).toBe(false)
    expect(isTagVisible(t('x', 'x', 'c2'), scope)).toBe(false)
  })

  it('findTagByName : global, puis communauté, puis espace le plus proche', async () => {
    const prisma = createMockPrisma()
    const scope = { communityId: 'c1', spaceIds: ['child', 'parent'] }
    prisma.tag.findMany.mockResolvedValue([t('p', 'Bug', null, 'parent'), t('k', 'bug', null, 'child'), t('c', 'Bug', 'c1'), t('g', 'bug')])
    expect((await findTagByName(prisma as any, scope, ' bug '))?.id).toBe('g')
    expect(prisma.tag.findMany.mock.calls[0][0].where.name).toEqual({ equals: 'bug', mode: 'insensitive' })

    prisma.tag.findMany.mockResolvedValue([t('p', 'Bug', null, 'parent'), t('k', 'bug', null, 'child')])
    expect((await findTagByName(prisma as any, scope, 'bug'))?.id).toBe('k')
  })

  it('invisibleTagIds : ids inconnus ou hors de portée', async () => {
    const prisma = treePrisma()
    prisma.tag.findMany.mockResolvedValue([{ id: 'ok' }])
    expect(await invisibleTagIds(prisma as any, 'child', ['ok', 'ko', 'ok'])).toEqual(['ko'])
    expect(await invisibleTagIds(prisma as any, 'child', [])).toEqual([])
  })

  it('mapTagsToSpace : visible gardé, sinon repris par nom, sinon recréé en tag de l\'espace cible', async () => {
    const prisma = treePrisma()
    prisma.tag.findMany
      .mockResolvedValueOnce([t('x2', 'ux', 'c1')]) // « ux » existe dans c1
      .mockResolvedValueOnce([]) // « perf » n'existe pas
    prisma.tag.create.mockResolvedValue({ id: 'new' })

    const ids = await mapTagsToSpace(prisma as any,
      [t('g', 'bug'), t('k', 'k', 'c1'), t('p', 'p', null, 'parent'), t('x1', 'ux', 'c2'), t('p1', 'perf', null, 'other')], 'child')

    expect(ids).toEqual(['g', 'k', 'p', 'x2', 'new'])
    expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'perf', color: null, spaceId: 'child' }, select: { id: true } })
  })

  it('mapTagsToSpace : cible sans communauté → tag de communauté recréé en tag d\'espace', async () => {
    const prisma = treePrisma()
    prisma.tag.findMany.mockResolvedValue([])
    prisma.tag.create.mockResolvedValue({ id: 'new' })
    expect(await mapTagsToSpace(prisma as any, [t('g', 'bug'), t('u', 'ux', 'c1')], 'lonely')).toEqual(['g', 'new'])
    expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'ux', color: null, spaceId: 'lonely' }, select: { id: true } })
  })

  it('tagMapping : table id source → id cible, sans double', async () => {
    const prisma = treePrisma()
    const map = await tagMapping(prisma as any, [t('g', 'bug'), t('g', 'bug'), t('c', 'c', 'c1')], 'child')
    expect([...map.entries()]).toEqual([['g', 'g'], ['c', 'c']])
  })

  it('remapOutOfScopeItemTags : tag d\'une autre communauté remplacé par le tag de même nom visible', async () => {
    const prisma = treePrisma()
    prisma.itemTag.findMany.mockResolvedValue([{ itemId: 'i1', tag: t('x', 'mdp', 'c2') }])
    prisma.tag.findMany.mockResolvedValue([t('m', 'mdp', 'c1')])

    const done = await remapOutOfScopeItemTags(prisma as any, ['child'])

    expect(prisma.itemTag.findMany.mock.calls[0][0].where).toEqual({
      item: { spaceId: 'child' },
      NOT: [{ tag: { OR: [{ communityId: null, spaceId: null }, { communityId: 'c1' }, { spaceId: { in: ['child', 'parent', 'root'] } }] } }],
    })
    expect(prisma.itemTag.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'i1', tagId: 'x' } })
    expect(prisma.itemTag.createMany).toHaveBeenCalledWith({ data: [{ itemId: 'i1', tagId: 'm' }], skipDuplicates: true })
    expect(done).toEqual([{ itemId: 'i1', spaceId: 'child', fromId: 'x', fromName: 'mdp', toId: 'm' }])
  })

  it('remapOutOfScopeItemTags sans apply : bilan seulement', async () => {
    const prisma = treePrisma()
    prisma.itemTag.findMany.mockResolvedValue([{ itemId: 'i1', tag: t('x', 'mdp', 'c2') }])
    prisma.tag.findMany.mockResolvedValue([])
    const done = await remapOutOfScopeItemTags(prisma as any, ['child'], false)
    expect(done).toEqual([{ itemId: 'i1', spaceId: 'child', fromId: 'x', fromName: 'mdp', toId: '' }])
    expect(prisma.itemTag.deleteMany).not.toHaveBeenCalled()
    expect(prisma.tag.create).not.toHaveBeenCalled()
  })
})
