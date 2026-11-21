/* TNR des données sécurisées qui suivent un élément (utils/itemSecrets.ts, 2026-11-20) : duplication (re-chiffrée
 * avec le nouvel id, auteur gardé, « moi seul » hors de l'espace d'origine, rien sans clé), fusion, déplacement
 * inter-espaces. Valeur témoin seulement. */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encryptSecret, decryptSecret } from './secretCrypto.js'
import { copyItemSecrets, moveItemSecrets, privatizeItemSecrets, restoreItemSecrets, redactAuditChanges } from './itemSecrets.js'

const WITNESS = 'TEMOIN-NE-PAS-FUIR-42'
const saved = process.env.SECRETS_ENCRYPTION_KEY

function mockPrisma(rows: any[]) {
  return { itemSecret: { findMany: vi.fn().mockResolvedValue(rows), create: vi.fn().mockResolvedValue({ id: 'x' }), updateMany: vi.fn() } }
}
const src = (over: Record<string, unknown> = {}) => ({
  id: 's1', itemId: 'a', label: 'Accès', visibility: 'SPACE', position: 2, createdById: 'author',
  valueEnc: encryptSecret(WITNESS, 's1'), loginEnc: null, ...over,
})

describe('itemSecrets', () => {
  beforeEach(() => { process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64') })
  afterAll(() => { process.env.SECRETS_ENCRYPTION_KEY = saved })

  it('duplication même espace : visibilité et auteur gardés, chiffré lié au nouvel id', async () => {
    const prisma = mockPrisma([src()])
    expect(await copyItemSecrets(prisma, 'a', 'b', { sameSpace: true })).toBe(1)
    const data = prisma.itemSecret.create.mock.calls[0][0].data
    expect(data).toMatchObject({ itemId: 'b', label: 'Accès', visibility: 'SPACE', createdById: 'author', loginEnc: null })
    expect(data.id).not.toBe('s1')
    expect(decryptSecret(data.valueEnc, data.id)).toBe(WITNESS)
    expect(JSON.stringify(data)).not.toContain(WITNESS)
  })

  it('duplication vers un autre espace : « moi seul »', async () => {
    const prisma = mockPrisma([src()])
    await copyItemSecrets(prisma, 'a', 'b', { sameSpace: false })
    expect(prisma.itemSecret.create.mock.calls[0][0].data.visibility).toBe('PRIVATE')
  })

  it('clé absente ou donnée illisible : rien recopié, sans erreur', async () => {
    const prisma = mockPrisma([src({ valueEnc: 'v1:a:b:c' })])
    expect(await copyItemSecrets(prisma, 'a', 'b', { sameSpace: true })).toBe(0)
    const rows = [src()]
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(await copyItemSecrets(mockPrisma(rows), 'a', 'b', { sameSpace: true })).toBe(0)
  })

  it('fusion : rattache à l\'élément gardé', async () => {
    const prisma = mockPrisma([])
    await moveItemSecrets(prisma, ['a', 'c'], 'b')
    expect(prisma.itemSecret.updateMany).toHaveBeenCalledWith({ where: { itemId: { in: ['a', 'c'] } }, data: { itemId: 'b' } })
  })

  it('déplacement inter-espaces : « membres de l\'espace » → « moi seul »', async () => {
    const prisma = mockPrisma([])
    await privatizeItemSecrets(prisma, ['a'])
    expect(prisma.itemSecret.updateMany).toHaveBeenCalledWith({ where: { itemId: { in: ['a'] }, visibility: 'SPACE' }, data: { visibility: 'PRIVATE' } })
  })
})

describe('sauvegarde et restauration (2026-11-21)', () => {
  beforeEach(() => { process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64') })
  afterAll(() => { process.env.SECRETS_ENCRYPTION_KEY = saved })

  it('la donnée recréée avec son id se déchiffre ; auteur disparu → non recréée', async () => {
    const backups = [src(), src({ id: 's2', createdById: 'gone', valueEnc: encryptSecret(WITNESS, 's2') })]
    const prisma = { user: { findMany: vi.fn().mockResolvedValue([{ id: 'author' }]) }, itemSecret: { createMany: vi.fn() } }
    expect(await restoreItemSecrets(prisma, 'a2', backups)).toBe(1)
    const row = prisma.itemSecret.createMany.mock.calls[0][0].data[0]
    expect(row).toMatchObject({ id: 's1', itemId: 'a2', createdById: 'author', visibility: 'SPACE' })
    expect(decryptSecret(row.valueEnc, row.id)).toBe(WITNESS)
  })

  it('journal renvoyé : chiffrés retirés, libellés seulement si admin', () => {
    const changes = {
      before: { id: 'a', secrets: [src()] },
      after: { contentChange: { op: 'add', kind: 'SECRET', name: 'Accès' }, secretRead: { secretId: 's1', label: 'Accès' } },
    }
    const admin = JSON.stringify(redactAuditChanges(changes, { keepLabels: true }))
    expect(admin).not.toContain('v1:')
    expect(admin).toContain('Accès')
    const member = JSON.stringify(redactAuditChanges(changes, { keepLabels: false }))
    expect(member).not.toContain('v1:')
    expect(member).not.toContain('Accès')
  })
})
