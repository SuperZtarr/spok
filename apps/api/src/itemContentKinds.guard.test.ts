/* Cohérence du registre des sortes de contenus (2026-11-25) : l'enum Prisma ItemContentKind (valeurs stockées) et le
 * registre ITEM_CONTENT_KIND_DEFS (@spok/shared) portent exactement les mêmes sortes ; les coordonnées en font partie.
 * Lit le schéma Prisma tel quel (pas de client généré nécessaire). */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { ITEM_CONTENT_KIND_DEFS, CONTACT_CONTENT_KINDS, contactHref } from '@spok/shared'

const SCHEMA = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/database/prisma/schema.prisma')

describe('registre des sortes de contenus', () => {
  it('enum Prisma ⇔ registre', () => {
    const block = readFileSync(SCHEMA, 'utf8').match(/enum ItemContentKind \{([^}]*)\}/)![1]
    const values = block.split('\n').map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l))
    expect([...values].sort()).toEqual(ITEM_CONTENT_KIND_DEFS.map((d) => d.id).sort())
  })

  it('les coordonnées sont des sortes compactes du registre', () => {
    for (const k of CONTACT_CONTENT_KINDS) expect(ITEM_CONTENT_KIND_DEFS.find((d) => d.id === k)?.compact).toBe(true)
  })

  it('liens des coordonnées', () => {
    expect(contactHref('PHONE', '+33 (0)1 23-45.67')).toBe('tel:+330123456' + '7')
    expect(contactHref('EMAIL', 'a@b.test')).toBe('mailto:a@b.test')
    expect(contactHref('ADDRESS', '1 rue X\n75000 Paris')).toBe('https://www.openstreetmap.org/search?query=1%20rue%20X%2C%2075000%20Paris')
    expect(contactHref('PHONE', '  ')).toBeNull()
  })
})

describe('recopie du MCP (mcp-core ne dépend pas de @spok/shared)', () => {
  it('format.ts porte le libellé de chaque sorte du registre', () => {
    const src = readFileSync(resolve(dirname(SCHEMA), '../../mcp-core/src/format.ts'), 'utf8')
    for (const d of ITEM_CONTENT_KIND_DEFS) expect(src).toContain(`${d.id}: '${d.singular}'`)
  })
})
