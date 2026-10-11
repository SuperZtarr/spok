/*
 * SpokClient du MCP distant : rejoue chaque appel d'outil sur les routes REST de l'API via fastify.inject,
 * avec l'en-tête Authorization de l'appelant (jeton personnel) — les permissions REST s'appliquent telles
 * quelles. N'envoie JAMAIS X-Admin-Mode. Ajoute les en-têtes internes (secret + identité du jeton) pour
 * l'exemption de rate-limit et la traçabilité d'audit. Réponse non 2xx → SpokApiError (renvoyée au modèle).
 */
import type { FastifyInstance } from 'fastify'
import { SpokApiError, type SpokClient } from '@spok/mcp-core'
import { INTERNAL_REQUEST_HEADER, INTERNAL_REQUEST_SECRET, INTERNAL_TOKEN_ID_HEADER, INTERNAL_TOKEN_NAME_HEADER } from './internal.js'

export function createInjectClient(
  app: FastifyInstance,
  authorization: string,
  token: { id: string; name: string },
): SpokClient {
  async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    const res = await app.inject({
      method,
      url: path,
      headers: {
        authorization,
        [INTERNAL_REQUEST_HEADER]: INTERNAL_REQUEST_SECRET,
        [INTERNAL_TOKEN_ID_HEADER]: token.id,
        [INTERNAL_TOKEN_NAME_HEADER]: encodeURIComponent(token.name),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    })
    if (res.statusCode < 200 || res.statusCode >= 300) throw new SpokApiError(res.statusCode, res.body, path)
    return res.body ? res.json() : {}
  }
  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
    patch: (path, body) => call('PATCH', path, body),
    delete: (path) => call('DELETE', path),
  }
}
