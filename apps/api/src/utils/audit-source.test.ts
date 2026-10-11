/*
 * TNR : createAuditLog marque l'origine MCP (jeton) quand un contexte de requête est actif ; le plugin
 * requestContext pose ce contexte sur les sous-requêtes internes (secret valide) et ignore les en-têtes forgés.
 */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { createMockPrisma } from '../test/helpers.js'
import { createAuditLog } from './audit.js'
import { runWithRequestContext } from './requestContext.js'
import { requestContextPlugin } from '../plugins/requestContext.js'
import { INTERNAL_REQUEST_HEADER, INTERNAL_REQUEST_SECRET, INTERNAL_TOKEN_ID_HEADER, INTERNAL_TOKEN_NAME_HEADER } from '../mcp/internal.js'

const base = { action: 'CREATE' as const, entity: 'Item' as const, entityId: 'i1', userId: 'u1', spaceId: 's1', changes: { after: { id: 'i1' } } }

describe('audit source MCP', () => {
  it('sans contexte : changes inchangés', async () => {
    const prisma = createMockPrisma()
    await createAuditLog(prisma as any, base)
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toEqual({ after: { id: 'i1' } })
  })

  it('avec contexte : ajoute source', async () => {
    const prisma = createMockPrisma()
    await runWithRequestContext({ via: 'mcp', tokenId: 'pat-1', tokenName: 'Claude perso' }, () => createAuditLog(prisma as any, base))
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.source).toEqual({ via: 'mcp', tokenId: 'pat-1', tokenName: 'Claude perso' })
  })

  async function buildApp(prisma: ReturnType<typeof createMockPrisma>) {
    const app = Fastify({ logger: false })
    await app.register(requestContextPlugin)
    app.post('/x', async () => { await createAuditLog(prisma as any, base); return {} })
    await app.ready()
    return app
  }

  it('sous-requête interne (secret valide) : contexte posé jusqu\'à l\'audit', async () => {
    const prisma = createMockPrisma()
    const app = await buildApp(prisma)
    await app.inject({ method: 'POST', url: '/x', headers: {
      [INTERNAL_REQUEST_HEADER]: INTERNAL_REQUEST_SECRET,
      [INTERNAL_TOKEN_ID_HEADER]: 'pat-1',
      [INTERNAL_TOKEN_NAME_HEADER]: encodeURIComponent('Claude portable é'),
    } })
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.source).toEqual({ via: 'mcp', tokenId: 'pat-1', tokenName: 'Claude portable é' })
  })

  it('en-têtes de contexte sans secret valide : ignorés', async () => {
    const prisma = createMockPrisma()
    const app = await buildApp(prisma)
    await app.inject({ method: 'POST', url: '/x', headers: {
      [INTERNAL_REQUEST_HEADER]: 'faux', [INTERNAL_TOKEN_ID_HEADER]: 'pat-1',
    } })
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.source).toBeUndefined()
  })
})
