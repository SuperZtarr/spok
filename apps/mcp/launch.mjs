// Launcher MCP — charge les credentials depuis le .env racine (gitignoré) avant import.
// AUCUN secret en dur ici : fichier tracké sur repo public (fuite corrigée le 2026-07-11).
// Clés .env requises : SPOK_EMAIL, SPOK_PASSWORD (SPOK_API_URL optionnel, défaut prod).
import { readFileSync, existsSync } from 'fs';

const envPath = 'C:/_dev/spok/.env';
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\r\n]*)["']?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
process.env.SPOK_API_URL = process.env.SPOK_API_URL || 'https://api.spok.space';
if (!process.env.SPOK_EMAIL || !process.env.SPOK_PASSWORD) {
  console.error('SPOK_EMAIL / SPOK_PASSWORD absents du .env racine');
  process.exit(1);
}
await import('file:///C:/_dev/spok/apps/mcp/dist/index.js');
