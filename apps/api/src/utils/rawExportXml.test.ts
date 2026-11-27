/* Aller-retour XML du document d'export brut (utils/rawExportXml.ts) : le XML relu redonne exactement le JSON écrit —
   types (nombres, booléens, null), listes vides, textes à caractères spéciaux, JSON libre (legacyContent). */
import { describe, it, expect } from 'vitest'
import { rawExportToXml, rawExportFromXml } from './rawExportXml.js'

const doc = {
  format: 'spok-raw-export',
  version: 1,
  source: { spaceId: 's1', spaceName: 'Projet <A> & "B"' },
  spaces: [{ id: 's1', parentId: null, name: 'Racine', description: '', visibility: null, defaultView: 'list', position: 0 }],
  users: [],
  items: [{
    id: 'i1', title: '  espaces  ', description: 'Ligne 1\nLigne 2\r\nLigne 3 — é ✓ 🙂', priority: 3, position: 0,
    legacyContent: { 'clé libre': [1, 'a', null], ok: true },
    tagIds: ['t1', 't2'], externalRefs: [], question: null,
    article: { blocks: [{ itemId: 'i2', position: 1, width: 'full', align: 'center', beside: false }] },
    process: { lanes: [], nodes: [{ itemId: 'i2', x: 10.5, y: -3, laneId: null }] },
  }],
  relations: [],
  empty: {},
}

describe('rawExportXml', () => {
  it('aller-retour sans perte', () => {
    const xml = rawExportToXml(doc)
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(rawExportFromXml(xml)).toEqual(doc)
  })

  it('retire les caractères interdits en XML', () => {
    const back = rawExportFromXml(rawExportToXml({ t: 'a\u0001b\u0007c\td' })) as { t: string }
    expect(back.t).toBe('abc\td')
  })

  it('refuse un XML sans la bonne racine', () => {
    expect(() => rawExportFromXml('<autre><a>1</a></autre>')).toThrow()
  })
})
