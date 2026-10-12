/*
 * Jetons personnels d'accès API (spok_pat_…) — utilisés par les clients MCP distants.
 * generatePersonalToken : le jeton en clair n'existe qu'à la création (renvoyé une fois au client) ;
 * seul son hash SHA-256 est stocké. resolvePersonalToken : null si inconnu, révoqué, expiré ou
 * utilisateur désactivé. hasMcpAccess : droit d'utiliser un jeton (accordé par un admin, toujours vrai
 * pour un admin global) — vérifié à chaque requête, retirer le droit coupe donc les jetons existants.
 * Ne JAMAIS loguer un jeton en clair.
 */
import { createHash, randomBytes } from 'crypto'

export const PAT_PREFIX = 'spok_pat_'

/** Intervalle minimal entre deux mises à jour de lastUsedAt (évite une écriture par requête). */
const LAST_USED_THROTTLE_MS = 5 * 60_000

export type PersonalTokenScope = 'read' | 'write'

export interface ResolvedPersonalToken {
  id: string
  name: string
  scope: PersonalTokenScope
  userId: string
  email: string
  /** Faux si l'admin n'a pas (ou plus) accordé l'accès MCP : le jeton est valide mais refusé (403). */
  mcpAllowed: boolean
}

/** Droit d'utiliser le MCP distant : accordé par un admin, ou admin global. */
export function hasMcpAccess(user: { globalRole?: string | null; mcpAccessGrantedAt?: Date | string | null }): boolean {
  return user.globalRole === 'ADMIN' || !!user.mcpAccessGrantedAt
}

export function hashPersonalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generatePersonalToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const token = PAT_PREFIX + randomBytes(32).toString('base64url')
  return { token, tokenHash: hashPersonalToken(token), tokenPrefix: token.slice(0, 12) }
}

export function isPersonalToken(bearer: string | undefined): bearer is string {
  return typeof bearer === 'string' && bearer.startsWith(PAT_PREFIX)
}

export async function resolvePersonalToken(prisma: any, token: string): Promise<ResolvedPersonalToken | null> {
  const row = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashPersonalToken(token) },
    include: { user: { select: { id: true, email: true, disabledAt: true, globalRole: true, mcpAccessGrantedAt: true } } },
  })
  if (!row || row.revokedAt) return null
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null
  if (!row.user || row.user.disabledAt) return null

  if (!row.lastUsedAt || Date.now() - new Date(row.lastUsedAt).getTime() > LAST_USED_THROTTLE_MS) {
    // Non bloquant : un échec d'écriture de lastUsedAt ne doit pas refuser la requête.
    // Promise.resolve : en test, le mock update renvoie undefined (pas une Promise).
    Promise.resolve(prisma.personalAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })).catch(() => {})
  }

  return {
    id: row.id,
    name: row.name,
    scope: row.scope === 'read' ? 'read' : 'write',
    userId: row.user.id,
    email: row.user.email,
    mcpAllowed: hasMcpAccess(row.user),
  }
}
