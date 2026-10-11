/*
 * Plugin : pour une sous-requête interne du MCP distant (secret x-spok-internal valide), exécute toute la
 * suite du cycle de la requête dans runWithRequestContext({ via: 'mcp', tokenId, tokenName }) afin que
 * createAuditLog marque l'origine. Hook onRequest en style callback : done() appelé DANS als.run est la seule
 * façon fiable de propager le contexte (fastify.inject ne propage pas AsyncLocalStorage, vérifié 2026-10-12).
 */
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { runWithRequestContext } from '../utils/requestContext.js'
import { INTERNAL_TOKEN_ID_HEADER, INTERNAL_TOKEN_NAME_HEADER, isInternalRequest } from '../mcp/internal.js'

const requestContextPluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', (request, _reply, done) => {
    const headers = request.headers as Record<string, unknown>
    const tokenId = headers[INTERNAL_TOKEN_ID_HEADER]
    if (!isInternalRequest(headers) || typeof tokenId !== 'string') return done()
    const rawName = headers[INTERNAL_TOKEN_NAME_HEADER]
    let tokenName = ''
    try { tokenName = typeof rawName === 'string' ? decodeURIComponent(rawName) : '' } catch { /* nom illisible → vide */ }
    runWithRequestContext({ via: 'mcp', tokenId, tokenName }, async () => done())
  })
}

export const requestContextPlugin = fp(requestContextPluginAsync, { name: 'requestContext' })
