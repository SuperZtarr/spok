/*
 * Point d'entrée @spok/mcp-core : fabrique un McpServer SPOK branché sur un SpokClient, avec les
 * instructions serveur et les outils du profil demandé. Utilisé par apps/mcp (stdio, profil admin)
 * et apps/api routes/mcp.ts (HTTP, profils public/public-read). Un serveur par connexion/requête.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SpokClient } from './client.js'
import { SPOK_INSTRUCTIONS } from './instructions.js'
import { registerTools, type ToolProfile } from './tools.js'

export type { SpokClient } from './client.js'
export type { ToolProfile } from './tools.js'
export { SpokApiError, ConventionError } from './errors.js'
export { markdownToHtml } from './markdown.js'
export { SPOK_INSTRUCTIONS } from './instructions.js'

export function createSpokMcpServer(opts: { client: SpokClient; profile: ToolProfile }): McpServer {
  const server = new McpServer({ name: 'spok', version: '0.2.0' }, { instructions: SPOK_INSTRUCTIONS })
  registerTools(server, opts.client, opts.profile)
  return server
}
