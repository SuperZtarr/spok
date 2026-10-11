/*
 * Serveur MCP SPOK local (stdio) de Thomas : profil 'admin' de @spok/mcp-core (tous les outils,
 * mode admin via client.ts). S'authentifie avec SPOK_EMAIL/SPOK_PASSWORD (fournis par launch.mjs via .env).
 * Les outils vivent dans packages/mcp-core — ne pas en redéclarer ici.
 * Après modification : `pnpm build:packages` + `pnpm --filter @spok/mcp build`, puis redémarrer Claude.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSpokMcpServer } from '@spok/mcp-core';
import { api } from './client.js';

const server = createSpokMcpServer({ client: api, profile: 'admin' });
await server.connect(new StdioServerTransport());
