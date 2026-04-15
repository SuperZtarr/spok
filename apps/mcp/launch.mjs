// Launcher MCP — set env vars avant import (indépendant du shell/Claude)
process.env.SPOK_API_URL = 'https://api.spok.space';
process.env.SPOK_EMAIL = 'superztarr@gmail.com';
process.env.SPOK_PASSWORD = '1234azerQSDFwxcv';
await import('file:///C:/_dev/spok/apps/mcp/dist/index.js');
