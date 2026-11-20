/* TNR du chiffrement des données sécurisées (utils/secretCrypto.ts, 2026-11-20) : aller-retour, chiffré opaque et
 * aléatoire, AAD liée à la ligne, altération détectée, clé absente ou invalide refusée. Valeur témoin seulement. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { isSecretsConfigured, encryptSecret, decryptSecret } from './secretCrypto.js'

const WITNESS = 'TEMOIN-NE-PAS-FUIR-42'

describe('secretCrypto', () => {
  const saved = process.env.SECRETS_ENCRYPTION_KEY
  beforeEach(() => { process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64') })
  afterEach(() => { process.env.SECRETS_ENCRYPTION_KEY = saved })

  it('aller-retour rend la valeur', () => {
    expect(decryptSecret(encryptSecret(WITNESS, 'id-1'), 'id-1')).toBe(WITNESS)
  })

  it('le chiffré ne contient pas la valeur et diffère à chaque fois', () => {
    const a = encryptSecret(WITNESS, 'id-1')
    const b = encryptSecret(WITNESS, 'id-1')
    expect(a).not.toContain(WITNESS)
    expect(a).not.toBe(b)
    expect(a.startsWith('v1:')).toBe(true)
  })

  it('une autre AAD (autre ligne) ne déchiffre pas', () => {
    expect(() => decryptSecret(encryptSecret(WITNESS, 'id-1'), 'id-2')).toThrow('Donnée sécurisée illisible')
  })

  it('un chiffré altéré est refusé', () => {
    const parts = encryptSecret(WITNESS, 'id-1').split(':')
    const data = Buffer.from(parts[3], 'base64'); data[0] ^= 1
    parts[3] = data.toString('base64')
    expect(() => decryptSecret(parts.join(':'), 'id-1')).toThrow('Donnée sécurisée illisible')
  })

  it('clé absente ou de mauvaise taille : non configuré, chiffrement refusé', () => {
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(isSecretsConfigured()).toBe(false)
    expect(() => encryptSecret(WITNESS, 'id-1')).toThrow()
    process.env.SECRETS_ENCRYPTION_KEY = randomBytes(16).toString('base64')
    expect(isSecretsConfigured()).toBe(false)
  })

  it('l\'erreur ne révèle ni la valeur ni la clé', () => {
    const k = process.env.SECRETS_ENCRYPTION_KEY!
    try { decryptSecret(encryptSecret(WITNESS, 'a'), 'b') } catch (e: any) {
      expect(String(e.message)).not.toContain(WITNESS)
      expect(String(e.message)).not.toContain(k)
    }
  })
})
