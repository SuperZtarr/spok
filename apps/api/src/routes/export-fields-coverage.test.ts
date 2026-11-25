/* Cohérence du registre des champs exportables (shared EXPORT_FIELD_REGISTRY) avec le modèle Prisma `Item` (bug SPOK
   cmwt3o7tn01ly7icc055vvaiw, 2026-11-25) : chaque champ du modèle est soit lu par une entrée du registre (`sources`),
   soit exclu volontairement avec sa raison (EXPORT_EXCLUDED_ITEM_FIELDS) — jamais oublié. Les données sécurisées
   (`secrets`) doivent rester exclues. Lit schema.prisma directement : un champ ajouté au modèle fait échouer ce test. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { EXPORT_FIELD_REGISTRY, EXPORT_EXCLUDED_ITEM_FIELDS } from '@spok/shared'

function itemModelFields(): string[] {
  const schemaPath = fileURLToPath(new URL('../../../../packages/database/prisma/schema.prisma', import.meta.url))
  const schema = readFileSync(schemaPath, 'utf8')
  const body = schema.match(/^model Item \{([\s\S]*?)^\}/m)?.[1]
  if (!body) throw new Error('model Item introuvable dans schema.prisma')
  return body.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//') && !line.startsWith('@@'))
    .map(line => line.split(/\s+/)[0])
}

describe('registre des champs exportables / modèle Item', () => {
  const fields = itemModelFields()
  const exported = new Set<string>(EXPORT_FIELD_REGISTRY.flatMap(f => [...f.sources]))
  const excluded = new Set(Object.keys(EXPORT_EXCLUDED_ITEM_FIELDS))

  it('chaque champ du modèle est exporté ou exclu volontairement', () => {
    const missing = fields.filter(f => !exported.has(f) && !excluded.has(f))
    expect(missing, 'champ à ajouter au registre ou à EXPORT_EXCLUDED_ITEM_FIELDS').toEqual([])
  })

  it('aucune source ni exclusion ne désigne un champ inexistant', () => {
    const known = new Set(fields)
    expect([...exported, ...excluded].filter(f => !known.has(f))).toEqual([])
  })

  it('un champ n\'est pas à la fois exporté et exclu', () => {
    expect([...exported].filter(f => excluded.has(f))).toEqual([])
  })

  it('les données sécurisées restent exclues', () => {
    expect(exported.has('secrets')).toBe(false)
    expect(excluded.has('secrets')).toBe(true)
  })
})
