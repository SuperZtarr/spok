/*
 * Marqueur des sous-requêtes internes émises par le MCP distant (fastify.inject). Secret aléatoire par
 * process, jamais exposé. Sert à : exempter ces sous-requêtes du rate-limit global par IP (elles viennent
 * toutes de 127.0.0.1 et épuiseraient le quota commun) ; transporter l'identité du jeton jusqu'au contexte
 * d'audit (plugins/requestContext.ts). Les en-têtes de contexte ne sont crus que si le secret est présent.
 */
import { randomBytes } from 'crypto'

export const INTERNAL_REQUEST_HEADER = 'x-spok-internal'
export const INTERNAL_TOKEN_ID_HEADER = 'x-spok-mcp-token-id'
export const INTERNAL_TOKEN_NAME_HEADER = 'x-spok-mcp-token-name'
export const INTERNAL_REQUEST_SECRET = randomBytes(24).toString('hex')

export function isInternalRequest(headers: Record<string, unknown>): boolean {
  return headers[INTERNAL_REQUEST_HEADER] === INTERNAL_REQUEST_SECRET
}
