/*
 * Compteurs de débit du MCP distant, en mémoire (fenêtre fixe d'une minute), clés libres :
 *  - `req:<tokenId>` : requêtes /mcp par jeton, comptées APRÈS authentification (clé = id en base, donc
 *    insensible aux variations d'écriture de l'en-tête Authorization) ;
 *  - `sub:<tokenId>` : sous-requêtes REST internes par jeton (injectClient), exemptées du rate-limit par IP.
 * La limite par IP avant authentification est, elle, portée par @fastify/rate-limit (config de la route).
 * Mono-instance : suffisant tant que l'API tourne sur un seul conteneur Railway.
 */
export const MCP_REQUESTS_PER_MINUTE_PER_TOKEN = 120
export const MCP_REQUESTS_PER_MINUTE_PER_IP = 300
export const MCP_SUBREQUESTS_PER_MINUTE_PER_TOKEN = 600

const WINDOW_MS = 60_000
const usage = new Map<string, { windowStart: number; count: number }>()

/** Consomme une unité pour `key` ; false si la limite `max` est atteinte dans la fenêtre courante. */
export function consumeTokenRate(key: string, max: number): boolean {
  const now = Date.now()
  const u = usage.get(key)
  if (!u || now - u.windowStart >= WINDOW_MS) {
    usage.set(key, { windowStart: now, count: 1 })
    // Purge opportuniste des fenêtres expirées (évite une croissance illimitée de la Map)
    if (usage.size > 1000) for (const [k, v] of usage) if (now - v.windowStart >= WINDOW_MS) usage.delete(k)
    return true
  }
  if (u.count >= max) return false
  u.count++
  return true
}

/** Tests uniquement : remet tous les compteurs à zéro. */
export function resetTokenRateLimits(): void {
  usage.clear()
}
