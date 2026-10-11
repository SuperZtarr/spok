/*
 * Contexte asynchrone d'une sous-requête MCP distante (AsyncLocalStorage) : posé par plugins/requestContext.ts
 * sur chaque sous-requête interne, il permet à createAuditLog de marquer l'origine (jeton).
 * fastify.inject NE propage PAS ce contexte depuis l'appelant : ne pas compter sur un run() autour d'inject.
 * Ne rien y stocker de secret (le jeton en clair n'y est jamais).
 */
import { AsyncLocalStorage } from 'async_hooks'

export interface McpRequestContext {
  via: 'mcp'
  tokenId: string
  tokenName: string
}

const storage = new AsyncLocalStorage<McpRequestContext>()

export function runWithRequestContext<T>(ctx: McpRequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

export function getRequestContext(): McpRequestContext | undefined {
  return storage.getStore()
}
