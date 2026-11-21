/* TNR de la restauration des contenus d'un élément supprimé (utils/itemContentCopy.ts, 2026-11-21) : recréés avec leur
 * id sur l'élément restauré, auteur disparu → null, sauvegarde absente ou invalide → rien. */
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

  it('sauvegarde absente (anciennes suppressions) : rien', async () => {
    const prisma = { user: { findMany: vi.fn() }, itemContent: { createMany: vi.fn() } }
    expect(await restoreItemContents(prisma, 'i1', undefined)).toBe(0)
    expect(prisma.itemContent.createMany).not.toHaveBeenCalled()
  })
})
