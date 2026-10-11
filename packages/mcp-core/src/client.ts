/*
 * Contrat d'accès à l'API SPOK pour les outils MCP. Deux implémentations : client HTTP (apps/mcp,
 * stdio local) et client fastify.inject (apps/api, /mcp distant). Les chemins sont ceux de l'API REST
 * (ex. `/spaces/:id/items`). Toute réponse non 2xx DOIT lever SpokApiError.
 */
export interface SpokClient {
  get(path: string): Promise<any>
  post(path: string, body: unknown): Promise<any>
  patch(path: string, body: unknown): Promise<any>
  delete(path: string): Promise<any>
}
