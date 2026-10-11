/*
 * SpokClient du MCP distant : rejoue chaque appel d'outil sur les routes REST de l'API via fastify.inject,
 * avec l'en-tête Authorization de l'appelant (jeton personnel) — les permissions REST s'appliquent telles
 * quelles. N'envoie JAMAIS X-Admin-Mode. Ajoute les en-têtes internes (secret + identité du jeton) pour
 * l'exemption de rate-limit global et la traçabilité d'audit. Réponse non 2xx → SpokApiError (renvoyée au modèle).
 * Défenses (les sous-requêtes sont exemptées du rate-limit par IP) :
 *  - chemin piégé (.., %2e, //, \) refusé avant tout inject — doublon volontaire de zId() côté mcp-core ;
 *  - plafond de sous-requêtes par jeton et par minute (maxPerMinute, défaut 600, cf. tokenRateLimit.ts) → 429.
 */
import type { FastifyInstance } from 'fastify'
import { SpokApiError, type SpokClient } from '@spok/mcp-core'
import { INTERNAL_REQUEST_HEADER, INTERNAL_REQUEST_SECRET, INTERNAL_TOKEN_ID_HEADER, INTERNAL_TOKEN_NAME_HEADER } from './internal.js'
import { consumeTokenRate, MCP_SUBREQUESTS_PER_MINUTE_PER_TOKEN } from './tokenRateLimit.js'

const UNSAFE_PATH = /\.\.|%2e|\/\/|\\/i

export function createInjectClient(
  app: FastifyInstance,
  authorization: string,
  token: { id: string; name: string },
  opts: { maxPerMinute?: number } = {},
): SpokClient {
  const max = opts.maxPerMinute ?? MCP_SUBREQUESTS_PER_MINUTE_PER_TOKEN

  async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    const pathname = path.split('?')[0]
    if (!path.startsWith('/') || UNSAFE_PATH.test(pathname)) {
      throw new SpokApiError(400, 'Chemin refusé (identifiant invalide)', path)
    }
    if (!consumeTokenRate(`sub:${token.id}`, max)) {
      throw new SpokApiError(429, `Trop d'appels : limite de ${max} opérations par minute pour ce jeton. Réessayez dans une minute.`, path)
    }
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
