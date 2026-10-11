/*
 * POST /mcp — serveur MCP distant (Streamable HTTP, mode sans état : un McpServer + transport par requête).
 * Authentification : jeton personnel uniquement (un JWT de session web → 403). Profil d'outils selon la
 * portée du jeton : write → 'public', read → 'public-read'. Les outils appellent les routes REST via
 * createInjectClient avec le jeton de l'appelant ; les écritures sont tracées (plugins/requestContext → audit).
 * Découvrabilité : 401/403/405 renvoient la marche à suivre (WWW-Authenticate + lien vers spok.space/llms.txt).
 * Débit : un seul message JSON-RPC par requête (lots refusés), 120 requêtes/min par jeton (clé = hash de
 * l'en-tête Authorization, calculée avant authentification), sous-requêtes plafonnées dans injectClient.
 * GET/DELETE /mcp → 405 (pas de flux SSE serveur ni de session en mode sans état).
 */
import { createHash } from 'crypto'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createSpokMcpServer } from '@spok/mcp-core'
import { createInjectClient } from '../mcp/injectClient.js'

const HELP_URL = 'https://spok.space/llms.txt'
const CONNECT_HINT =
  'Créez un jeton personnel sur https://spok.space (Profil → Accès Claude (MCP)), puis connectez Claude Code avec : ' +
  'claude mcp add --transport http spok https://api.spok.space/mcp --header "Authorization: Bearer <jeton>"'

/** Clé de rate-limit : hash de l'en-tête Authorization (request.personalToken n'existe pas encore à onRequest). */
function rateLimitKey(req: FastifyRequest): string {
  const auth = req.headers.authorization
  return auth ? `mcp:${createHash('sha256').update(auth).digest('hex').slice(0, 32)}` : `mcp-ip:${req.ip}`
}

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  // Gestionnaire d'erreurs encapsulé dans ce plugin : réponses d'authentification explicites pour un modèle.
  fastify.setErrorHandler((error, request, reply) => {
    const status = typeof (error as any).statusCode === 'number' ? (error as any).statusCode : 500
    if (status === 401) {
      const hasBearer = request.headers.authorization?.startsWith('Bearer ')
      return reply
        .status(401)
        .header('www-authenticate', hasBearer
          ? 'Bearer realm="spok", error="invalid_token", error_description="Jeton invalide, revoque ou expire"'
          : 'Bearer realm="spok"')
        .send({
          statusCode: 401,
          error: 'Unauthorized',
          message: hasBearer
            ? `Jeton personnel invalide, révoqué ou expiré. ${CONNECT_HINT}`
            : `Jeton personnel requis. ${CONNECT_HINT}`,
          help: HELP_URL,
        })
    }
    if (status === 403) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message, help: HELP_URL })
    }
    request.log.error(error)
    return reply.status(status).send({ statusCode: status, error: error.name || 'Error', message: status < 500 ? error.message : 'Une erreur interne est survenue' })
  })

  fastify.post('/mcp', {
    preHandler: [fastify.authenticate],
    config: {
      // Le protocole MCP est toujours en POST : un jeton 'read' doit pouvoir l'appeler (outils limités à la lecture).
      allowReadOnlyToken: true,
      rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: rateLimitKey },
    },
  }, async (request, reply) => {
    if (request.authVia !== 'pat' || !request.personalToken) {
      reply.forbidden(`Le MCP distant exige un jeton personnel, pas une session web. ${CONNECT_HINT}`)
      return
    }
    // Un lot JSON-RPC multiplierait les appels d'outils sous une seule requête comptée par le rate-limit.
    if (Array.isArray(request.body)) {
      reply.status(400).send({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Les lots JSON-RPC (tableaux) ne sont pas acceptés : un seul message par requête.' },
        id: null,
      })
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
    reply.status(405).header('allow', 'POST').send({
      jsonrpc: '2.0',
      error: { code: -32000, message: `Serveur MCP SPOK : utilisez POST (protocole MCP Streamable HTTP). ${CONNECT_HINT}`, data: { help: HELP_URL } },
      id: null,
    })
  fastify.get('/mcp', methodNotAllowed)
  fastify.delete('/mcp', methodNotAllowed)
}
