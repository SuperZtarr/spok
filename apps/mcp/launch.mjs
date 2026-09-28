// Launcher MCP — charge les credentials depuis le .env racine (gitignoré) avant import.
// AUCUN secret en dur ici : fichier tracké sur repo public (fuite corrigée le 2026-07-11).
// Clés .env requises : SPOK_EMAIL, SPOK_PASSWORD (SPOK_API_URL optionnel, défaut prod).
// Valeurs lues brutes (tout après le 1er « = ») : un mot de passe avec " ou ' est supporté — l'écrire
// sans guillemets autour dans le .env.
import { readFileSync, existsSync } from 'fs';

const envPath = 'C:/_dev/spok/.env';
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    // Valeur brute après le premier « = » ; on ne retire que des guillemets ENTOURANT toute la valeur
    // (même caractère au début et à la fin). Un mot de passe contenant " ou ' reste intact
    // (l'ancien motif [^"']* le tronquait au premier guillemet → 401).
    let value = m[2].trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}
process.env.SPOK_API_URL = process.env.SPOK_API_URL || 'https://api.spok.space';
if (!process.env.SPOK_EMAIL || !process.env.SPOK_PASSWORD) {
  console.error('SPOK_EMAIL / SPOK_PASSWORD absents du .env racine');
  process.exit(1);
}
await import('file:///C:/_dev/spok/apps/mcp/dist/index.js');
