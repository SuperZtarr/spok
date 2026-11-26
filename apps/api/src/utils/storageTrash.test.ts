/*
 * Tests de la corbeille du stockage (utils/storageTrash.ts + primitives de r2.ts), en stockage LOCAL de dev réel
 * (apps/api/.local-uploads, nettoyé en fin de test) et base simulée en mémoire : mise à la corbeille d'un fichier
 * inutilisé (adresse coupée, délai de grâce), fichier encore utilisé gardé, hors périmètre ignoré, restauration,
 * purge des échus puis fichier perdu, images de description, orphelins (envoi récent exclu).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { STORAGE_TRASH_GRACE_DAYS } from '@spok/shared'
import { uploadImageToR2, storageKeyFromUrl, storageObjectExists, storageUrlForKey, LOCAL_UPLOADS_DIR } from './r2.js'
import {
  trashUnusedFiles, restoreTrashedFiles, purgeExpiredTrash, purgeTrashEntries, storageKeysInText, itemFileUrls,
  findOrphans, trashOrphans,
} from './storageTrash.js'

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const
const saved: Record<string, string | undefined> = {}
const DAY = 24 * 3600_000

/** Base simulée : ce qui « utilise » un fichier (adresses de contenus, descriptions) + table storage_trash */
function fakePrisma(used: { urls?: string[]; descriptions?: string[] } = {}) {
  const trash: any[] = []
  const has = (s: string | undefined, key: string) => !!s && s.includes(key)
  return {
    trash,
    used,
    itemContent: {
      count: async ({ where }: any) => (used.urls ?? []).filter((u) => has(u, where.OR[0].url.contains)).length,
      findMany: async () => (used.urls ?? []).map((url) => ({ url, previewUrl: null })),
    },
    item: {
      count: async ({ where }: any) => (used.descriptions ?? []).filter((d) => has(d, where.OR[1].description.contains)).length,
      findMany: async ({ where }: any) => where?.id ? [] : (used.descriptions ?? []).map((description) => ({ url: null, description })),
    },
    contribution: { count: async () => 0, findMany: async () => [] },
    storageTrash: {
      create: async ({ data }: any) => { const row = { id: `t${trash.length + 1}`, ...data }; trash.push(row); return row },
      findFirst: async ({ where }: any) => trash.filter((t) => t.key === where.key).at(-1) ?? null,
      findMany: async ({ where }: any) => trash.filter((t) =>
        where?.purgeAfter ? t.purgeAfter <= where.purgeAfter.lte : where?.id ? where.id.in.includes(t.id) : true),
      delete: async ({ where }: any) => { trash.splice(trash.findIndex((t) => t.id === where.id), 1) },
    },
  }
}

beforeEach(() => {
  for (const k of [...R2_KEYS, 'NODE_ENV']) saved[k] = process.env[k]
  for (const k of R2_KEYS) delete process.env[k]
  process.env.NODE_ENV = 'development'
})
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
})
afterAll(async () => {
  await rm(path.join(LOCAL_UPLOADS_DIR, 'items', 'test-trash-1'), { recursive: true, force: true })
  await rm(path.join(LOCAL_UPLOADS_DIR, 'items', 'test-trash-2'), { recursive: true, force: true })
  await rm(path.join(LOCAL_UPLOADS_DIR, 'trash'), { recursive: true, force: true })
})

describe('corbeille du stockage', () => {
  it('fichier inutilisé : adresse coupée, gardé le délai de grâce, puis remis en place par la restauration', async () => {
    const url = await uploadImageToR2(Buffer.from('a'), 'test-trash-1')
    const key = storageKeyFromUrl(url)!
    const prisma = fakePrisma()
    const before = Date.now()

    expect(await trashUnusedFiles(prisma, [{ urls: [url], reason: 'ITEM_DELETED', itemId: 'test-trash-1', itemTitle: 'Photo' }])).toBe(1)
    expect(await storageObjectExists(key)).toBe(false)
    expect(prisma.trash).toHaveLength(1)
    const row = prisma.trash[0]
    expect(row).toMatchObject({ key, reason: 'ITEM_DELETED', itemId: 'test-trash-1', itemTitle: 'Photo', size: 1 })
    expect(row.trashKey.startsWith('trash/')).toBe(true)
    expect(row.trashKey.endsWith(key)).toBe(true)
    expect(row.purgeAfter.getTime() - before).toBeGreaterThanOrEqual(STORAGE_TRASH_GRACE_DAYS * DAY - 1000)
    expect(await storageObjectExists(row.trashKey)).toBe(true)

    const lost = await restoreTrashedFiles(prisma, [url])
    expect(lost.size).toBe(0)
    expect(await storageObjectExists(key)).toBe(true)
    expect(prisma.trash).toHaveLength(0)
  })

  it('fichier encore utilisé (autre contenu ou description) : rien ne bouge', async () => {
    const url = await uploadImageToR2(Buffer.from('b'), 'test-trash-1')
    const key = storageKeyFromUrl(url)!
    expect(await trashUnusedFiles(fakePrisma({ urls: [url] }), [{ urls: [url], reason: 'CONTENT_REMOVED' }])).toBe(0)
    expect(await trashUnusedFiles(fakePrisma({ descriptions: [`<img src="${url}">`] }), [{ urls: [url], reason: 'MERGE' }])).toBe(0)
    expect(await storageObjectExists(key)).toBe(true)
  })

  it('hors périmètre : adresse externe, avatar, clé avec remontée — ignorés', async () => {
    const prisma = fakePrisma()
    const urls = ['https://exemple.org/a.png', storageUrlForKey('avatars/u1.webp'), storageUrlForKey('items/../avatars/u1.webp'), null]
    expect(await trashUnusedFiles(prisma, [{ urls, reason: 'ITEM_DELETED' }])).toBe(0)
    expect(prisma.trash).toHaveLength(0)
  })

  it('délai passé : la purge efface, la restauration déclare le fichier perdu', async () => {
    const url = await uploadImageToR2(Buffer.from('c'), 'test-trash-2')
    const prisma = fakePrisma()
    await trashUnusedFiles(prisma, [{ urls: [url], reason: 'SPACE_DELETED' }])
    const trashKey = prisma.trash[0].trashKey
    expect(await purgeExpiredTrash(prisma, undefined, new Date())).toBe(0) // pas encore échu
    expect(await purgeExpiredTrash(prisma, undefined, new Date(Date.now() + (STORAGE_TRASH_GRACE_DAYS + 1) * DAY))).toBe(1)
    expect(await storageObjectExists(trashKey)).toBe(false)
    expect(prisma.trash).toHaveLength(0)
    const lost = await restoreTrashedFiles(prisma, [url, 'https://exemple.org/externe.png'])
    expect([...lost]).toEqual([url])
  })

  it('« Effacer maintenant » : entrées choisies effacées sans attendre', async () => {
    const url = await uploadImageToR2(Buffer.from('d'), 'test-trash-2')
    const prisma = fakePrisma()
    await trashUnusedFiles(prisma, [{ urls: [url], reason: 'CONTENT_REMOVED' }])
    expect(await purgeTrashEntries(prisma, [prisma.trash[0].id])).toBe(1)
    expect(prisma.trash).toHaveLength(0)
  })

  it('images de description : clés extraites, candidates comme les contenus', () => {
    const a = storageUrlForKey('items/x/1.webp')
    const html = `<p>texte</p><img src="${a}"><img src='https://ailleurs.org/items/y.png'>`
    expect(storageKeysInText(html)).toEqual(['items/x/1.webp'])
    expect(itemFileUrls([{ url: null, description: html }], [{ url: 'u1', previewUrl: 'p1' }])).toEqual([a, 'u1', 'p1'])
  })

  it('orphelins : fichier inutilisé listé (envoi récent exclu), puis mis à la corbeille après re-contrôle', async () => {
    const orphan = await uploadImageToR2(Buffer.from('e'), 'test-trash-1')
    const usedUrl = await uploadImageToR2(Buffer.from('f'), 'test-trash-2')
    const prisma = fakePrisma({ urls: [usedUrl] })
    // Envoyé à l'instant : jamais pris pour un orphelin
    expect((await findOrphans(prisma)).some((o) => o.key === storageKeyFromUrl(orphan))).toBe(false)
    const later = new Date(Date.now() + 2 * 3600_000)
    const found = (await findOrphans(prisma, later)).filter((o) => o.key.startsWith('items/test-trash-'))
    expect(found.map((o) => o.key)).toContain(storageKeyFromUrl(orphan))
    expect(found.map((o) => o.key)).not.toContain(storageKeyFromUrl(usedUrl))
    expect(await trashOrphans(prisma, [storageKeyFromUrl(orphan)!, storageKeyFromUrl(usedUrl)!])).toBe(1)
    expect(prisma.trash.at(-1)).toMatchObject({ reason: 'ORPHAN_SWEEP', itemId: 'test-trash-1' })
  })
})
