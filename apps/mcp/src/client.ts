// Client HTTP du MCP SPOK : login SPOK_EMAIL/SPOK_PASSWORD puis appels REST sur SPOK_API_URL.
// Source des credentials : launch.mjs (charge le .env racine) — le .env local apps/mcp/.env n'est
// qu'un repli et ne doit JAMAIS écraser une variable déjà définie (sinon une copie périmée du mot
// de passe masque le .env racine : 401 constaté de 09/2026, après la rotation du 2026-07-11).
// Expiration : le token d'accès dure 15 min (JWT_EXPIRES_IN). Les routes en optionalAuthenticate
// (espaces, items, recherche) ne renvoient PAS 401 avec un token expiré : elles répondent comme à
// un anonyme (communautés publiques seules, 404 sur un espace privé). On se reconnecte donc AVANT
// l'échéance lue dans le champ `exp` du JWT ; le retry sur 401 reste en filet pour les routes strictes.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envContent = readFileSync(join(__dir, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
} catch { /* .env optionnel */ }

const API_URL = process.env.SPOK_API_URL ?? 'http://localhost:3001';
const EMAIL = process.env.SPOK_EMAIL ?? '';
const PASSWORD = process.env.SPOK_PASSWORD ?? '';

let token = '';
let tokenExpiresAt = 0; // ms epoch, lu dans le JWT

// Marge avant échéance : on renouvelle 60 s avant l'expiration réelle.
const EXPIRY_MARGIN_MS = 60_000;

function readJwtExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0; // illisible → reconnexion à chaque requête plutôt qu'un token périmé silencieux
  }
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('SPOK_EMAIL et SPOK_PASSWORD sont requis dans les variables d\'env.');
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SPOK login échoué (${res.status}): ${body}`);
  }
  const data = await res.json() as any;
  token = data.tokens.accessToken;
  tokenExpiresAt = readJwtExpiry(token);
}

async function req(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  if (!token || Date.now() >= tokenExpiresAt - EXPIRY_MARGIN_MS) await login();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Admin-Mode': 'true',
      ...options.headers,
    },
  });

  // Token expiré → re-login une fois
  if (res.status === 401 && retry) {
    await login();
    return req(path, options, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SPOK API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<any>;
}

export const api = {
  get: (path: string) => req(path),
  post: (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) => req(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => req(path, { method: 'DELETE' }),
};
