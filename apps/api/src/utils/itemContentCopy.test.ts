/* TNR de la restauration des contenus d'un élément supprimé (utils/itemContentCopy.ts, 2026-11-21) : recréés avec leur
 * id sur l'élément restauré, auteur disparu → null, sauvegarde absente ou invalide → rien ; fichier perdu (corbeille
 * du stockage échue, 2026-11-26) → contenu non recréé ou aperçu retiré. */
import { describe, it, expect, vi } from 'vitest'
import { restoreItemContents } from './itemContentCopy.js'

describe('restoreItemContents', () => {
  it('recrée les contenus sauvegardés, auteur disparu remis à null', async () => {
    const prisma = { user: { findMany: vi.fn().mockResolvedValue([{ id: 'u1' }]) }, itemContent: { createMany: vi.fn() } }
    const n = await restoreItemContents(prisma, 'i1', [
      { id: 'c1', kind: 'LINK', url: 'https://x.test', name: 'Doc', position: 0, createdById: 'u1' },
      { id: 'c2', kind: 'FILE', url: 'https://r2.test/items/i1/a.pdf', size: 10, position: 1, createdById: 'gone' },
      { kind: 'LINK' },
    ])
    expect(n).toBe(2)
    const data = prisma.itemContent.createMany.mock.calls[0][0].data
    expect(data[0]).toMatchObject({ id: 'c1', itemId: 'i1', kind: 'LINK', createdById: 'u1' })
    expect(data[1]).toMatchObject({ id: 'c2', size: 10, createdById: null })
  })

  it('fichiers perdus (corbeille du stockage échue) : image/fichier non recréé, aperçu retiré (2026-11-26)', async () => {
    const prisma = { user: { findMany: vi.fn().mockResolvedValue([]) }, itemContent: { createMany: vi.fn() } }
    const lost = new Set(['https://r2.test/items/i1/a.pdf', 'https://r2.test/items/i1/p.webp'])
    const n = await restoreItemContents(prisma, 'i1', [
      { id: 'c1', kind: 'FILE', url: 'https://r2.test/items/i1/a.pdf', position: 0 },
      { id: 'c2', kind: 'LINK', url: 'https://x.test', previewUrl: 'https://r2.test/items/i1/p.webp', position: 0 },
      { id: 'c3', kind: 'DIAGRAM', xml: '<x/>', url: 'https://r2.test/items/i1/p.webp', position: 0 },
    ], lost)
    expect(n).toBe(2)
    const data = prisma.itemContent.createMany.mock.calls[0][0].data
    expect(data.map((d: any) => d.id)).toEqual(['c2', 'c3'])
    expect(data[0].previewUrl).toBeNull()
    expect(data[1]).toMatchObject({ xml: '<x/>', url: null })
  })

  it('sauvegarde absente (anciennes suppressions) : rien', async () => {
    const prisma = { user: { findMany: vi.fn() }, itemContent: { createMany: vi.fn() } }
    expect(await restoreItemContents(prisma, 'i1', undefined)).toBe(0)
    expect(prisma.itemContent.createMany).not.toHaveBeenCalled()
  })
})
