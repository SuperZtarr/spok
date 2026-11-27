/* Couverture du modèle Prisma `Item` par l'export brut réimportable (registre shared rawExport.ts) : chaque champ du
   modèle est porté par le document (RAW_EXPORT_ITEM_SOURCES) ou exclu avec sa raison (RAW_EXPORT_EXCLUDED_ITEM_FIELDS).
   Un champ ajouté au modèle fait échouer ce test : décider s'il voyage d'une base à l'autre. Les données sécurisées
   restent exclues. Lit schema.prisma directement. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { RAW_EXPORT_ITEM_SOURCES, RAW_EXPORT_EXCLUDED_ITEM_FIELDS } from '@spok/shared'

function itemModelFields(): string[] {
  const schemaPath = fileURLToPath(new URL('../../../../packages/database/prisma/schema.prisma', import.meta.url))
  const body = readFileSync(schemaPath, 'utf8').match(/^model Item \{([\s\S]*?)^\}/m)?.[1]
  if (!body) throw new Error('model Item introuvable dans schema.prisma')
  return body.split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/)[0])
}

describe('export brut / modèle Item', () => {
  const fields = itemModelFields()
  const exported = new Set(Object.keys(RAW_EXPORT_ITEM_SOURCES))
  const excluded = new Set(Object.keys(RAW_EXPORT_EXCLUDED_ITEM_FIELDS))

  it('chaque champ du modèle est exporté ou exclu volontairement', () => {
    expect(fields.filter((f) => !exported.has(f) && !excluded.has(f)), 'à ajouter à RAW_EXPORT_ITEM_SOURCES ou RAW_EXPORT_EXCLUDED_ITEM_FIELDS').toEqual([])
  })

  it('aucune entrée ne désigne un champ inexistant, aucun champ n\'est à la fois exporté et exclu', () => {
    const known = new Set(fields)
    expect([...exported, ...excluded].filter((f) => !known.has(f))).toEqual([])
    expect([...exported].filter((f) => excluded.has(f))).toEqual([])
  })

  it('les données sécurisées restent exclues', () => {
    expect(exported.has('secrets')).toBe(false)
    expect(excluded.has('secrets')).toBe(true)
  })
})
