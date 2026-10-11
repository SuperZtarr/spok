/*
 * POST /mcp — serveur MCP distant (Streamable HTTP, mode sans état : un McpServer + transport par requête).
 * Authentification : jeton personnel uniquement (un JWT de session web → 403). Profil d'outils selon la
 * portée du jeton : write → 'public', read → 'public-read'. Les outils appellent les routes REST via
 * createInjectClient avec le jeton de l'appelant ; les écritures sont tracées (plugins/requestContext → audit).
 * GET/DELETE /mcp → 405 (pas de flux SSE serveur ni de session en mode sans état).
 */
import { FastifyPluginAsync, FastifyReply } from 'fastify'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createSpokMcpServer } from '@spok/mcp-core'
import { createInjectClient } from '../mcp/injectClient.js'

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/mcp', {
    preHandler: [fastify.authenticate],
    config: {
      // Le protocole MCP est toujours en POST : un jeton 'read' doit pouvoir l'appeler (outils limités à la lecture).
      allowReadOnlyToken: true,
      rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: (req: any) => req.personalToken?.id ?? req.ip },
    },
  }, async (request, reply) => {
    if (request.authVia !== 'pat' || !request.personalToken) {
      reply.forbidden('Le MCP distant exige un jeton personnel (Profil → Accès Claude)')
      return
    }
    const pat = request.personalToken
    const client = createInjectClient(fastify, request.headers.authorization!, { id: pat.id, name: pat.name })
    const server = createSpokMcpServer({ client, profile: pat.scope === 'read' ? 'public-read' : 'public' })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })

    reply.hijack()
    reply.raw.on('close', () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
    await server.connect(transport)
    await transport.handleRequest(request.raw, reply.raw, request.body)
  })

  const methodNotAllowed = async (_req: unknown, reply: FastifyReply) =>
    reply.status(405).header('allow', 'POST').send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
  fastify.get('/mcp', methodNotAllowed)
  fastify.delete('/mcp', methodNotAllowed)
}
