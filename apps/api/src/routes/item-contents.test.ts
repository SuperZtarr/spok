/*
 * TNR des contenus d'un élément (contenus multiples, lot 1, 2026-11-08) : routes …/contents (droits membres,
 * lecteur et copie verrouillée refusés, ajout lien/schéma, url http(s) seulement, plafond, envoi contrôlé par
 * validateUpload, ordre par sorte, suppression qui garde un fichier encore utilisé) et renvoi avec l'élément
 * (détail complet, liste sans xml), aperçu PNG d'un schéma (previewOf, lot 2), aperçu d'un fichier (extrait, effacé
 * avec le fichier — 2026-11-11). Stockage R2 simulé (utils/r2.js) ; rôles pilotés par spaceMembership.findUnique.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ITEM_CONTENTS_MAX, sortItemContents } from '@spok/shared'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

vi.mock('../utils/audit.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  createAuditLogs: vi.fn().mockResolvedValue(undefined),
  serializeItemForAudit: vi.fn((item: any) => ({ id: item?.id })),
}))

const r2 = vi.hoisted(() => ({
  deleteFileFromR2: vi.fn().mockResolvedValue(undefined),
  uploadFileToR2: vi.fn().mockResolvedValue('https://r2.test/items/i1/doc.pdf'),
  uploadImageToR2: vi.fn().mockResolvedValue('https://r2.test/items/i1/img.webp'),
}))
vi.mock('../utils/r2.js', () => ({
  isR2Configured: () => true,
  isR2Url: (u: string | null | undefined) => !!u && u.startsWith('https://r2.test/'),
  isItemStorageUrl: (u: string | null | undefined, id: string) => !!u && u.startsWith(`https://r2.test/items/${id}/`),
  processImage: vi.fn(async (b: Buffer) => b),
  uploadImageToR2: r2.uploadImageToR2,
  uploadFileToR2: r2.uploadFileToR2,
  deleteFileFromR2: r2.deleteFileFromR2,
  deleteImageFromR2: vi.fn(),
}))

const SPACE = 'space-1'
const USER = 'test-user-id'
const ITEM = { id: 'i1', type: 'NOTE', spaceId: SPACE, createdById: 'other', assignedToId: null, lockedAt: null, url: null }
const BASE = `/spaces/${SPACE}/items/i1/contents`

/** Corps multipart minimal : un seul champ fichier */
function multipart(fileName: string, mime: string, body: string) {
  const boundary = '----spoktest'
  const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
    + `Content-Type: ${mime}\r\n\r\n${body}\r\n--${boundary}--\r\n`
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

describe('Routes contenus', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  const as = (role: string) => prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role, joinedAt: new Date() })

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ app, prisma } = await buildItemsTestApp())
    as('MEMBER')
    prisma.item.findFirst.mockResolvedValue(ITEM)
    prisma.item.update.mockResolvedValue(ITEM)
    prisma.itemContent.count.mockResolvedValue(0)
    prisma.itemContent.aggregate.mockResolvedValue({ _max: { position: 1 } })
    prisma.itemContent.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }))
  })

  it('un membre ajoute un lien, placé en fin de sa sorte, et l\'élément est marqué modifié', async () => {
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'LINK', url: 'https://exemple.fr', name: 'Exemple' } })
    expect(res.statusCode).toBe(201)
    expect(prisma.itemContent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ itemId: 'i1', kind: 'LINK', url: 'https://exemple.fr', position: 2, createdById: USER, xml: null }) })
    expect(prisma.item.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: expect.objectContaining({ updatedById: USER }) })
  })

  it('un schéma porte son xml', async () => {
    prisma.itemContent.aggregate.mockResolvedValue({ _max: { position: null } })
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'DIAGRAM', xml: '<mxfile/>' } })
    expect(res.statusCode).toBe(201)
    expect(prisma.itemContent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'DIAGRAM', xml: '<mxfile/>', position: 0, url: null }) })
  })

  it('refuse une adresse hors http(s) et une sorte FILE sans envoi', async () => {
    const bad = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'LINK', url: 'javascript:alert(1)' } })
    expect(bad.statusCode).toBe(400)
    const file = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'FILE', url: 'https://x.fr/a.pdf' } })
    expect(file.statusCode).toBe(400)
    expect(prisma.itemContent.create).not.toHaveBeenCalled()
  })

  it('lecteur refusé, copie de séance verrouillée refusée', async () => {
    as('VIEWER')
    const viewer = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'LINK', url: 'https://x.fr' } })
    expect(viewer.statusCode).toBe(403)
    as('OWNER')
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, lockedAt: new Date() })
    const locked = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'LINK', url: 'https://x.fr' } })
    expect(locked.statusCode).toBe(403)
    expect(prisma.itemContent.create).not.toHaveBeenCalled()
  })

  it('plafond de contenus par élément', async () => {
    prisma.itemContent.count.mockResolvedValue(ITEM_CONTENTS_MAX)
    const res = await app.inject({ method: 'POST', url: BASE, headers: auth(), payload: { kind: 'LINK', url: 'https://x.fr' } })
    expect(res.statusCode).toBe(400)
  })

  it('envoi d\'un fichier : enregistre nom, type et taille', async () => {
    const mp = multipart('rapport.pdf', 'application/pdf', 'PDFDATA')
    const res = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=file`, headers: { ...auth(), ...mp.headers }, payload: mp.payload })
    expect(res.statusCode).toBe(201)
    expect(r2.uploadFileToR2).toHaveBeenCalled()
    expect(prisma.itemContent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      kind: 'FILE', url: 'https://r2.test/items/i1/doc.pdf', name: 'rapport.pdf', mimeType: 'application/pdf', size: 7 }) })
  })

  it('envoi d\'un fichier : aperçu calculé (extrait d\'un texte), jamais bloquant sur un fichier illisible', async () => {
    const txt = multipart('notes.txt', 'text/plain', 'Ordre du jour\nBudget')
    const res = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=file`, headers: { ...auth(), ...txt.headers }, payload: txt.payload })
    expect(res.statusCode).toBe(201)
    expect(prisma.itemContent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ excerpt: 'Ordre du jour Budget', previewUrl: null }) })

    // 'PDFDATA' n'est pas un PDF : enregistré sans aperçu, sans erreur
    const pdf = multipart('casse.pdf', 'application/pdf', 'PDFDATA')
    const broken = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=file`, headers: { ...auth(), ...pdf.headers }, payload: pdf.payload })
    expect(broken.statusCode).toBe(201)
    expect(prisma.itemContent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ excerpt: null, previewUrl: null }) })
  })

  it('suppression d\'un fichier : son aperçu est effacé aussi', async () => {
    prisma.itemContent.findFirst.mockResolvedValue({
      id: 'c1', itemId: 'i1', kind: 'FILE', url: 'https://r2.test/items/i1/a.pdf', previewUrl: 'https://r2.test/items/i1/p.webp',
    })
    prisma.item.count.mockResolvedValue(0)
    await app.inject({ method: 'DELETE', url: `${BASE}/c1`, headers: auth() })
    expect(r2.deleteFileFromR2).toHaveBeenCalledWith('https://r2.test/items/i1/a.pdf')
    expect(r2.deleteFileFromR2).toHaveBeenCalledWith('https://r2.test/items/i1/p.webp')
    expect(prisma.itemContent.count).toHaveBeenCalledWith({ where: { OR: [{ url: 'https://r2.test/items/i1/p.webp' }, { previewUrl: 'https://r2.test/items/i1/p.webp' }] } })
  })

  it('aperçu d\'un schéma (previewOf) : remplace l\'url du schéma sans créer de contenu', async () => {
    prisma.itemContent.findFirst.mockResolvedValue({ id: 'd1', itemId: 'i1', kind: 'DIAGRAM', url: null })
    prisma.itemContent.update.mockResolvedValue({ id: 'd1', url: 'https://r2.test/items/i1/img.webp' })
    const png = multipart('diagram.png', 'image/png', 'PNG')
    const res = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=image&previewOf=d1`, headers: { ...auth(), ...png.headers }, payload: png.payload })
    expect(res.statusCode).toBe(200)
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { url: 'https://r2.test/items/i1/img.webp' } })
    expect(prisma.itemContent.create).not.toHaveBeenCalled()
    prisma.itemContent.findFirst.mockResolvedValue(null)
    const missing = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=image&previewOf=zz`, headers: { ...auth(), ...png.headers }, payload: png.payload })
    expect(missing.statusCode).toBe(404)
  })

  it('envoi refusé par validateUpload (exécutable, image hors formats)', async () => {
    const exe = multipart('virus.exe', 'application/octet-stream', 'MZ')
    const r1 = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=file`, headers: { ...auth(), ...exe.headers }, payload: exe.payload })
    expect(r1.statusCode).toBe(400)
    const txt = multipart('note.txt', 'text/plain', 'x')
    const r2res = await app.inject({ method: 'POST', url: `${BASE}/upload?kind=image`, headers: { ...auth(), ...txt.headers }, payload: txt.payload })
    expect(r2res.statusCode).toBe(400)
    expect(prisma.itemContent.create).not.toHaveBeenCalled()
  })

  it('xml refusé sur un contenu qui n\'est pas un schéma', async () => {
    prisma.itemContent.findFirst.mockResolvedValue({ id: 'c1', itemId: 'i1', kind: 'LINK', url: 'https://x.fr' })
    const res = await app.inject({ method: 'PATCH', url: `${BASE}/c1`, headers: auth(), payload: { xml: '<x/>' } })
    expect(res.statusCode).toBe(400)
    prisma.itemContent.update.mockResolvedValue({ id: 'c1' })
    const ok = await app.inject({ method: 'PATCH', url: `${BASE}/c1`, headers: auth(), payload: { name: 'Nouveau nom' } })
    expect(ok.statusCode).toBe(200)
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'Nouveau nom' } })
  })

  it('suppression : garde le fichier encore utilisé par Item.url, l\'efface sinon', async () => {
    const content = { id: 'c1', itemId: 'i1', kind: 'IMAGE', url: 'https://r2.test/items/i1/a.webp' }
    prisma.itemContent.findFirst.mockResolvedValue(content)
    prisma.item.count.mockResolvedValue(1)
    const kept = await app.inject({ method: 'DELETE', url: `${BASE}/c1`, headers: auth() })
    expect(kept.statusCode).toBe(204)
    expect(prisma.itemContent.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
    expect(r2.deleteFileFromR2).not.toHaveBeenCalled()

    prisma.item.count.mockResolvedValue(0)
    await app.inject({ method: 'DELETE', url: `${BASE}/c1`, headers: auth() })
    expect(r2.deleteFileFromR2).toHaveBeenCalledWith(content.url)
  })

  it('suppression : n\'efface jamais un objet du stockage hors du dossier de l\'élément (adresse saisie)', async () => {
    prisma.item.count.mockResolvedValue(0)
    for (const url of ['https://r2.test/items/autre/a.webp', 'https://r2.test/avatars/u1.webp']) {
      prisma.itemContent.findFirst.mockResolvedValue({ id: 'c1', itemId: 'i1', kind: 'IMAGE', url })
      const res = await app.inject({ method: 'DELETE', url: `${BASE}/c1`, headers: auth() })
      expect(res.statusCode).toBe(204)
    }
    expect(r2.deleteFileFromR2).not.toHaveBeenCalled()
  })

  it('ordre : tous les contenus d\'une même sorte, sinon refus', async () => {
    prisma.itemContent.findMany.mockResolvedValue([
      { id: 'a', kind: 'IMAGE' }, { id: 'b', kind: 'IMAGE' }, { id: 'l', kind: 'LINK' },
    ])
    const mixed = await app.inject({ method: 'PUT', url: `${BASE}/order`, headers: auth(), payload: { ids: ['a', 'l'] } })
    expect(mixed.statusCode).toBe(400)
    const partial = await app.inject({ method: 'PUT', url: `${BASE}/order`, headers: auth(), payload: { ids: ['b'] } })
    expect(partial.statusCode).toBe(400)
    const ok = await app.inject({ method: 'PUT', url: `${BASE}/order`, headers: auth(), payload: { ids: ['b', 'a'] } })
    expect(ok.statusCode).toBe(200)
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 0 } })
    expect(prisma.itemContent.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { position: 1 } })
  })
})

describe('Contenus renvoyés avec l\'élément', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })

  beforeEach(async () => {
    ;({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ id: 'm', userId: USER, spaceId: SPACE, role: 'MEMBER', joinedAt: new Date() })
  })

  it('le détail demande les contenus complets, la liste sans xml', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...ITEM, tags: [], children: [], contributions: [], reactions: [], relationsFrom: [], relationsTo: [], contents: [] })
    await app.inject({ method: 'GET', url: `/spaces/${SPACE}/items/i1`, headers: auth() })
    const detail = prisma.item.findFirst.mock.calls.find((c: any[]) => c[0]?.include?.contents)?.[0]
    expect(detail.include.contents).toEqual({ orderBy: expect.any(Array) })

    prisma.item.count.mockResolvedValue(0)
    await app.inject({ method: 'GET', url: `/spaces/${SPACE}/items`, headers: auth() })
    const list = prisma.item.findMany.mock.calls.find((c: any[]) => c[0]?.include?.contents)?.[0]
    expect(list.include.contents.select.xml).toBeUndefined()
    expect(list.include.contents.select.url).toBe(true)
  })

  it('sortItemContents : ordre fixe Images, Fichiers, Liens, Schémas puis position', () => {
    const c = (id: string, kind: any, position: number) => ({ id, kind, position, createdAt: '2026-11-08' })
    const sorted = sortItemContents([c('d', 'DIAGRAM', 0), c('l2', 'LINK', 1), c('i', 'IMAGE', 0), c('l1', 'LINK', 0), c('f', 'FILE', 0)])
    expect(sorted.map((x) => x.id)).toEqual(['i', 'f', 'l1', 'l2', 'd'])
  })
})
