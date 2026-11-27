/* Droits des routes de l'export brut (routes/raw-export.ts) : export refusé sans accès, e-mails seulement pour un OWNER,
   import sous un espace = écriture sur le parent, à la racine = membre de la communauté, fichier invalide → 400 lisible,
   aperçu par défaut (rien d'écrit sans dryRun: false). La logique d'export/import est testée dans utils/rawExport.test.ts. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, type MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'

vi.mock('../utils/r2.js', () => ({
  isR2Configured: vi.fn(() => false), isR2Url: vi.fn(() => false), copyR2Object: vi.fn(), storageUrlForKey: vi.fn((k: string) => k),
}))

import { rawExportRoutes } from './raw-export.js'

const minimal = JSON.stringify({ format: 'spok-raw-export', version: 1, spaces: [{ id: 'a', parentId: null, name: 'A' }] })

describe('routes raw-export', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let auth: { authorization: string }

  beforeEach(async () => {
    app = Fastify({ logger: false })
    prisma = createMockPrisma()
    await app.register(sensible)
    app.decorate('prisma', prisma as any)
    await app.register(jwtPlugin)
    await app.register(rawExportRoutes, { prefix: '/spaces' })
    await app.ready()
    auth = { authorization: `Bearer ${getTestToken(app)}` }
    prisma.space.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([])
    prisma.user.findMany.mockResolvedValue([])
    prisma.tag.findMany.mockResolvedValue([])
  })

  it('export refusé sans accès à l\'espace', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/spaces/s1/raw-export', headers: auth })
    expect(res.statusCode).toBe(404)
  })

  it('export XML pour un membre, sans e-mails', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.space.findMany.mockImplementation(async ({ where }: any) => (where.id ? [{ id: 's1', parentId: null, name: 'S', position: 0 }] : []))
    prisma.item.findMany.mockResolvedValue([{
      id: 'i1', spaceId: 's1', type: 'TASK', title: 'T', position: 0, createdAt: new Date(), updatedAt: new Date(), createdById: 'u1',
      tags: [], externalRefs: [], contents: [], question: null, questionOptions: [], articleBlocks: [], processLanes: [], processNodes: [],
    }])
    prisma.itemRelation.findMany.mockResolvedValue([])
    prisma.contribution.findMany.mockResolvedValue([])
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Alice', email: 'alice@x.fr' }])
    const res = await app.inject({ method: 'GET', url: '/spaces/s1/raw-export?format=xml', headers: auth })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/xml')
    expect(res.body).toContain('<spokExport>')
    expect(res.body).not.toContain('alice@x.fr')
  })

  it('import sous un espace : refusé à un lecteur', async () => {
    prisma.space.findUnique.mockResolvedValue({ type: 'GROUP', communityId: 'com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'VIEWER' })
    const res = await app.inject({
      method: 'POST', url: '/spaces/raw-import', headers: auth,
      payload: { format: 'json', content: minimal, parentSpaceId: 'p1' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('import à la racine : refusé hors de la communauté', async () => {
    prisma.community.findUnique.mockResolvedValue({ id: 'com' })
    prisma.communityMembership.findUnique.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'USER' })
    const res = await app.inject({
      method: 'POST', url: '/spaces/raw-import', headers: auth,
      payload: { format: 'json', content: minimal, communityId: 'com' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('import : aperçu par défaut, fichier invalide → 400 lisible', async () => {
    prisma.community.findUnique.mockResolvedValue({ id: 'com' })
    prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    const preview = await app.inject({
      method: 'POST', url: '/spaces/raw-import', headers: auth,
      payload: { format: 'json', content: minimal, communityId: 'com' },
    })
    expect(preview.statusCode).toBe(200)
    expect(preview.json()).toMatchObject({ dryRun: true, rootSpaceName: 'A', rootSpaceId: null })
    expect(prisma.$transaction).not.toHaveBeenCalled()

    const bad = await app.inject({
      method: 'POST', url: '/spaces/raw-import', headers: auth,
      payload: { format: 'json', content: '{"x":1}', communityId: 'com' },
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().message).toMatch(/Données brutes/)
  })

  it('import : une seule destination', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/raw-import', headers: auth,
      payload: { format: 'json', content: minimal, communityId: 'com', parentSpaceId: 'p1' },
    })
    expect(res.statusCode).toBe(400)
  })
})
