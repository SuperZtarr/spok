/* Export brut réimportable (utils/rawExport.ts) : aller-retour export → fichier (JSON et XML) → import.
   Vérifie : nouveaux identifiants partout, hiérarchie et relations remappées, références hors fichier abandonnées et
   comptées, personnes rapprochées par e-mail (sinon auteur = importateur, assigné en saisie libre), tags créés sur la
   racine importée, fichiers du stockage recopiés (contenus et images des descriptions), aperçu sans écriture,
   fichiers refusés avec un message lisible. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma, type MockPrisma } from '../test/helpers.js'

vi.mock('./r2.js', () => ({
  isR2Configured: vi.fn(() => true),
  isR2Url: vi.fn((u: string | null) => !!u && u.startsWith('https://r2/')),
  copyR2Object: vi.fn(async (u: string, newItemId: string) => `https://r2/items/${newItemId}/${u.split('/').pop()}`),
  storageUrlForKey: vi.fn((k: string) => `https://r2/${k}`),
}))
vi.mock('./storageTrash.js', () => ({
  storageKeysInText: vi.fn((t: string | null) => [...(t ?? '').matchAll(/https:\/\/r2\/(items\/[^\s")]+)/g)].map((m) => m[1])),
}))

import { buildRawExport, serializeRawExport, parseRawDocument, importRawDocument, readableSpaceTree, RawImportError } from './rawExport.js'

const d = new Date('2026-11-01T10:00:00Z')
const baseItem = {
  description: null, content: null, url: null, status: null, priority: null, position: 0, dueDate: null, startDate: null,
  endDate: null, manualHorizon: null, horizonSetAt: null, createdAt: d, updatedAt: d, assignedToId: null, assignedToName: null,
  parentId: null, tags: [], externalRefs: [], contents: [], question: null, questionOptions: [], articleBlocks: [],
  processLanes: [], processNodes: [],
}

function seedExport(prisma: MockPrisma) {
  prisma.space.findMany.mockResolvedValue([
    { id: 's1', parentId: 'outside', name: 'Racine', description: null, visibility: 'PRIVATE', defaultView: 'list', position: 4 },
    { id: 's2', parentId: 's1', name: 'Sous-espace', description: 'd', visibility: null, defaultView: null, position: 0 },
  ])
  prisma.item.findMany.mockResolvedValue([
    {
      ...baseItem, id: 'i1', spaceId: 's1', type: 'PROJECT', title: 'Projet', createdById: 'u1',
      description: 'Voir ![img](https://r2/items/i1/photo.png)',
      tags: [{ tagId: 't1' }], externalRefs: [{ value: 'Jira : P-1' }],
      contents: [
        { kind: 'IMAGE', url: 'https://r2/items/i1/a.png', name: 'a.png', mimeType: 'image/png', size: 10, xml: null, previewUrl: null, excerpt: null, value: null, position: 0 },
        { kind: 'LINK', url: 'https://ailleurs.fr', name: null, mimeType: null, size: null, xml: null, previewUrl: null, excerpt: null, value: null, position: 1 },
      ],
      articleBlocks: [{ itemId: 'i2', position: 0, width: 'full', align: 'center', beside: false }, { itemId: 'hors', position: 1, width: 'full', align: 'center', beside: false }],
    },
    { ...baseItem, id: 'i2', spaceId: 's2', parentId: 'i1', type: 'TASK', title: 'Tâche\r\navec retour', createdById: 'u2', assignedToId: 'u2', status: 'todo', priority: 3 },
    {
      ...baseItem, id: 'i3', spaceId: 's2', type: 'QUESTION', title: 'Question ?', createdById: 'u1',
      question: { multiple: true, chosenOptionId: 'o1', answerText: null, note: 'n', decidedById: 'u1', decidedAt: d },
      questionOptions: [{ id: 'o1', label: 'Oui', position: 0, refItemId: 'i1' }, { id: 'o2', label: 'Non', position: 1, refItemId: 'hors' }],
    },
  ])
  prisma.itemRelation.findMany.mockResolvedValue([{ fromItemId: 'i2', toItemId: 'i3', type: 'blocks', label: null }])
  prisma.contribution.findMany.mockResolvedValue([
    { id: 'c1', itemId: 'i1', parentId: null, authorId: 'u2', content: 'Premier', reactionType: null, createdAt: d },
    { id: 'c2', itemId: 'i1', parentId: 'c1', authorId: 'u1', content: 'Réponse', reactionType: 'pertinent', createdAt: d },
  ])
  prisma.tag.findMany.mockResolvedValue([{ id: 't1', name: 'urgent', color: '#f00' }])
  prisma.user.findMany.mockResolvedValue([
    { id: 'u1', name: 'Alice', email: 'alice@x.fr' },
    { id: 'u2', name: 'Bob', email: 'bob@x.fr' },
  ])
}

describe('rawExport', () => {
  let prisma: MockPrisma
  beforeEach(() => { prisma = createMockPrisma() })

  it('readableSpaceTree saute un sous-espace illisible et sa descendance', async () => {
    prisma.space.findMany.mockImplementation(async ({ where }: any) => (
      where.parentId === 'r' ? [{ id: 'ok' }, { id: 'prive' }] : where.parentId === 'prive' ? [{ id: 'sous-prive' }] : []))
    const ids = await readableSpaceTree(prisma, 'r', async (id) => id !== 'prive')
    expect(ids).toEqual(['r', 'ok'])
  })

  it('export : racine sans parent, références hors export retirées, e-mails selon le droit', async () => {
    seedExport(prisma)
    const doc = await buildRawExport(prisma, ['s1', 's2'], { includeEmails: false })
    expect(doc.spaces[0]).toMatchObject({ id: 's1', parentId: null })
    expect(doc.users.every((u) => u.email === null)).toBe(true)
    const i1 = doc.items.find((i) => i.id === 'i1')!
    expect(i1.article!.blocks.map((b) => b.itemId)).toEqual(['i2'])
    expect(doc.items.find((i) => i.id === 'i3')!.question!.options.map((o) => o.refItemId)).toEqual(['i1', null])
  })

  for (const format of ['json', 'xml'] as const) {
    it(`aller-retour ${format} : import en copie remappée`, async () => {
      seedExport(prisma)
      const doc = await buildRawExport(prisma, ['s1', 's2'], { includeEmails: true })
      const parsed = parseRawDocument(serializeRawExport(doc, format), format)
      expect(parsed.items.find((i) => i.id === 'i2')!.title).toBe('Tâche\r\navec retour')

      // Import : seule Alice existe dans la base cible ; aucun tag visible
      prisma = createMockPrisma()
      prisma.user.findMany.mockResolvedValue([{ id: 'U-ALICE', email: 'Alice@x.fr' }])
      prisma.tag.findMany.mockResolvedValue([])
      prisma.space.aggregate.mockResolvedValue({ _max: { position: 2 } })
      const report = await importRawDocument(prisma, parsed, { userId: 'ME', communityId: 'com', parentSpaceId: null, dryRun: false })

      const spaces = prisma.space.create.mock.calls.map((c: any) => c[0].data)
      expect(spaces).toHaveLength(2)
      const [root, child] = spaces
      expect(root).toMatchObject({ name: 'Racine', parentId: null, communityId: 'com', position: 3, visibility: 'PRIVATE', type: 'GROUP' })
      expect(root.memberships.create).toEqual({ userId: 'ME', role: 'OWNER' })
      expect(child.parentId).toBe(root.id)
      expect(root.id).not.toBe('s1')
      expect(report.rootSpaceId).toBe(root.id)

      const items = prisma.item.createMany.mock.calls.flatMap((c: any) => c[0].data)
      const byTitle = (t: string) => items.find((i: any) => i.title === t)
      expect(items.map((i: any) => i.id)).not.toContain('i1')
      expect(byTitle('Projet')).toMatchObject({ spaceId: root.id, createdById: 'U-ALICE' })
      expect(byTitle('Projet').description).toMatch(new RegExp(`https://r2/items/${byTitle('Projet').id}/photo.png`))
      // Bob inconnu : auteur = importateur, assigné conservé en saisie libre
      expect(byTitle('Tâche\r\navec retour')).toMatchObject({
        parentId: byTitle('Projet').id, spaceId: child.id, createdById: 'ME', assignedToId: null, assignedToName: 'Bob', priority: 3,
      })
      expect(report.unmatchedUsers).toEqual(['Bob'])

      const contents = prisma.itemContent.createMany.mock.calls[0][0].data
      expect(contents[0].url).toBe(`https://r2/items/${byTitle('Projet').id}/a.png`)
      expect(contents[1].url).toBe('https://ailleurs.fr')
      expect(report.copiedFiles).toBe(2)

      expect(prisma.tag.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ name: 'urgent', spaceId: root.id })])
      expect(prisma.itemRelation.createMany.mock.calls[0][0].data).toEqual([
        { fromItemId: byTitle('Tâche\r\navec retour').id, toItemId: byTitle('Question ?').id, type: 'blocks', label: null },
      ])
      const opts = prisma.questionOption.createMany.mock.calls[0][0].data
      expect(opts[0].refItemId).toBe(byTitle('Projet').id)
      expect(prisma.question.create.mock.calls[0][0].data.chosenOptionId).toBe(opts[0].id)
      expect(prisma.articleBlock.createMany.mock.calls[0][0].data).toHaveLength(1)

      // Contributions : la réponse est créée après son parent, remappée
      const contribLevels = prisma.contribution.createMany.mock.calls.map((c: any) => c[0].data)
      expect(contribLevels).toHaveLength(2)
      expect(contribLevels[1][0].parentId).toBe(contribLevels[0][0].id)
      expect(report.created).toMatchObject({ spaces: 2, items: 3, relations: 1, contributions: 2, tags: 1, contents: 2 })
    })
  }

  it('aperçu : rien n\'est écrit ni copié', async () => {
    seedExport(prisma)
    const doc = parseRawDocument(serializeRawExport(await buildRawExport(prisma, ['s1', 's2'], { includeEmails: true }), 'json'), 'json')
    prisma = createMockPrisma()
    prisma.user.findMany.mockResolvedValue([])
    prisma.tag.findMany.mockResolvedValue([])
    const { copyR2Object } = await import('./r2.js')
    vi.mocked(copyR2Object).mockClear()
    const report = await importRawDocument(prisma, doc, { userId: 'ME', communityId: 'com', parentSpaceId: null, dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(report.rootSpaceId).toBeNull()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(copyR2Object).not.toHaveBeenCalled()
    expect(report.unmatchedUsers).toEqual(['Alice', 'Bob'])
  })

  it('personnes rapprochées parmi les membres de la destination seulement', async () => {
    seedExport(prisma)
    const doc = parseRawDocument(serializeRawExport(await buildRawExport(prisma, ['s1', 's2'], { includeEmails: true }), 'json'), 'json')
    for (const [target, expected] of [
      [{ communityId: 'com', parentSpaceId: null }, { communityMemberships: { some: { communityId: 'com' } } }],
      [{ communityId: null, parentSpaceId: 'p1' }, { memberships: { some: { spaceId: 'p1' } } }],
    ] as const) {
      prisma = createMockPrisma()
      prisma.user.findMany.mockResolvedValue([])
      prisma.tag.findMany.mockResolvedValue([])
      prisma.space.findUnique.mockResolvedValue(null)
      await importRawDocument(prisma, doc, { userId: 'ME', ...target, dryRun: true })
      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject(expected)
    }
  })

  it('refuse un fichier qui n\'est pas un export SPOK, illisible ou incohérent', () => {
    expect(() => parseRawDocument('{"a":1}', 'json')).toThrow(RawImportError)
    expect(() => parseRawDocument('pas du json', 'json')).toThrow(/illisible/)
    const twoRoots = { format: 'spok-raw-export', version: 1, spaces: [{ id: 'a', parentId: null, name: 'A' }, { id: 'b', parentId: null, name: 'B' }] }
    expect(() => parseRawDocument(JSON.stringify(twoRoots), 'json')).toThrow(/un seul espace racine/)
    expect(() => parseRawDocument(JSON.stringify({ ...twoRoots, version: 99 }), 'json')).toThrow(/plus récente/)
  })

  it('accepte un fichier minimal écrit par un autre outil', () => {
    const doc = parseRawDocument(JSON.stringify({
      format: 'spok-raw-export', version: 1,
      spaces: [{ id: 'a', parentId: null, name: 'A' }],
      items: [{ id: 'x', spaceId: 'a', title: 'Note' }],
    }), 'json')
    expect(doc.items[0]).toMatchObject({ type: 'UNDEFINED', tagIds: [], contents: [] })
  })
})
