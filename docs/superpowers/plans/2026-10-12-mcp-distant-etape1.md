# MCP distant SPOK — Étape 1 (jetons personnels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à des utilisateurs tiers de brancher leur Claude sur SPOK via `https://api.spok.space/mcp`, authentifiés par un jeton personnel, avec des écritures garanties conformes aux conventions SPOK.

**Architecture:** Les outils MCP sont extraits dans un paquet `@spok/mcp-core` qui dépend d'une interface `SpokClient` (get/post/patch/delete). Le MCP local (`apps/mcp`, stdio, profil `admin`) l'alimente avec un client HTTP ; l'API Fastify expose `POST /mcp` (Streamable HTTP, sans état) et l'alimente avec un client `fastify.inject` qui rejoue le jeton de l'appelant sur les routes REST existantes — toutes les permissions actuelles s'appliquent sans réécriture. La conformité est assurée dans `mcp-core` : instructions serveur, outil `get_space_conventions`, validation stricte (statut, type, dates, parent) et conversion Markdown → HTML.

**Tech Stack:** Fastify 4, Prisma (db push, pas de migrations), `@modelcontextprotocol/sdk` 1.29 (`StreamableHTTPServerTransport`), zod 3, `marked` 14, Vitest 4, React + TanStack Query.

**Spec:** conception validée en chat le 2026-10-12 (pas de fichier spec — préférence utilisateur). Rappel en tête de chaque section ci-dessous quand nécessaire.

## Global Constraints

- Tout fichier créé ou modifié reçoit un commentaire de tête `/* ... */` (raison d'être, params clés, règles d'usage) — non négociable (CLAUDE.md projet).
- Côté distant (`/mcp`), **jamais** d'en-tête `X-Admin-Mode` ; `request.isAdminMode` est forcé à `false` pour toute requête authentifiée par jeton.
- Format du jeton : préfixe `spok_pat_` + 32 octets aléatoires en base64url. Stocké **haché SHA-256** uniquement ; affiché en clair une seule fois à la création.
- Portées : `read` (GET/HEAD uniquement) et `write`. Un jeton ne peut ni gérer les jetons (`/user/tokens`) ni accéder à `/admin/*`.
- Outils exposés en profil `public` : list_spaces, get_space, get_space_conventions, search_items, list_items, get_item, create_item, update_item, delete_item, create_space, list_communities, get_community, list_relations, create_relation, update_relation, delete_relation, list_contributions, create_contribution, update_contribution, list_tags, list_notifications, mark_notification_read. En portée `read`, seuls les outils de lecture sont enregistrés.
- Pas de `git add -A`. **Aucun commit** pendant l'exécution : le commit se fait uniquement sur demande explicite de Thomas (« commit et push » = prod).
- Vérifications lourdes (suite TNR complète, `pnpm typecheck` des paquets) : une seule passe à la fin (Task 10), jamais en intermédiaire. Pendant le dev : uniquement le fichier de test de la tâche et le typecheck du paquet touché.
- Messages d'erreur renvoyés au modèle : en français, actionnables (« valeurs acceptées : … »).

## Review Focus

1. Jeton `read` utilisé directement sur l'API REST (hors `/mcp`) pour un `POST` → doit répondre 403, pas écrire. Test : Task 2.
2. Date sans heure (`2026-10-15`) envoyée par Claude → normalisée en ISO complet, pas de 400 Zod incompréhensible. Test : Task 4.
3. Statut donné par son libellé (« En cours ») au lieu de son id → mappé sur `in_progress` ; statut inconnu → erreur listant les ids et libellés. Test : Task 4.
4. Markdown contenant du HTML brut (`<script>`) ou un lien `javascript:` → échappé / neutralisé dans la description stockée. Test : Task 3.
5. Utilisateur désactivé (`disabledAt` non null) avec un jeton encore actif → 401. Test : Task 2.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `packages/database/prisma/schema.prisma` | + modèle `PersonalAccessToken`, relation sur `User` |
| `apps/api/src/utils/personalTokens.ts` | génération, hachage, résolution d'un jeton |
| `apps/api/src/plugins/jwt.ts` | `authenticate`/`optionalAuthenticate` acceptent un jeton personnel |
| `apps/api/src/routes/personal-tokens.ts` | `/user/tokens` : liste, création, révocation |
| `apps/api/src/utils/requestContext.ts` | AsyncLocalStorage `{ via: 'mcp', tokenId, tokenName }` |
| `apps/api/src/utils/audit.ts` | ajoute `changes.source` si contexte MCP |
| `packages/mcp-core/**` | outils MCP partagés, conventions, validation, Markdown, instructions |
| `apps/api/src/mcp/injectClient.ts` | `SpokClient` basé sur `fastify.inject` |
| `apps/api/src/mcp/internal.ts` | secret interne (exemption rate-limit des sous-requêtes) |
| `apps/api/src/routes/mcp.ts` | `POST /mcp` Streamable HTTP sans état |
| `apps/mcp/src/index.ts`, `apps/mcp/src/client.ts` | MCP local réduit à un lanceur `createSpokMcpServer({ profile: 'admin' })` |
| `apps/web/src/components/PersonalTokensSection.tsx` | UI « Accès Claude » |
| `apps/web/src/components/UserProfileModal.tsx`, `apps/web/src/lib/api.ts` | intégration UI + client |
| `docker/Dockerfile.api`, `package.json` racine | build de `@spok/mcp-core` |

---

### Task 0: Consultation de la doc SPOK (obligation CLAUDE.md)

- [ ] **Step 1:** `mcp__spok__search_items` avec `q: "MCP"` puis `q: "jeton"`. Lire les items trouvés (`get_item`).
- [ ] **Step 2:** Si aucun item ne documente le MCP → le signaler à Thomas en une ligne et continuer (la conception validée en chat fait foi). Si un item contredit la conception → stop, signaler la divergence.

---

### Task 1: Modèle `PersonalAccessToken`

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (modèle `User` l.21-64, ajout après `CalendarFeed` l.606)
- Modify: `apps/api/src/test/helpers.ts:66` (MockPrisma)

**Interfaces:**
- Produces: `prisma.personalAccessToken` avec champs `id, userId, name, tokenHash (unique), tokenPrefix, scope ('read'|'write'), lastUsedAt, expiresAt, revokedAt, createdAt`.

- [ ] **Step 1: Ajouter le modèle**

Dans `User`, après `liveSessionInvitesBy` :
```prisma
  personalAccessTokens        PersonalAccessToken[]
```
Après `model CalendarFeed { ... }` :
```prisma
// Jeton personnel d'accès API (MCP distant, 2026-10-12). Seul le hash SHA-256 est stocké ;
// tokenPrefix (12 premiers caractères) sert à l'affichage. scope : 'read' (GET/HEAD) ou 'write'.
// Révocation = revokedAt non null (jamais de suppression physique : traçabilité audit).
model PersonalAccessToken {
  id          String    @id @default(cuid())
  userId      String
  name        String
  tokenHash   String    @unique
  tokenPrefix String
  scope       String    @default("write")
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("personal_access_tokens")
}
```

- [ ] **Step 2: MockPrisma** — dans `createMockPrisma()` après `calendarFeed: mockModel(),` :
```ts
    personalAccessToken: mockModel(),
```

- [ ] **Step 3: Générer et pousser en local**

Run: `pnpm db:generate` puis `pnpm db:push`
Expected: « Your database is now in sync with your Prisma schema ». (En prod, `docker/start-api.sh` exécute `prisma db push` au démarrage — aucune action manuelle.)

---

### Task 2: Authentification par jeton personnel

**Files:**
- Create: `apps/api/src/utils/personalTokens.ts`
- Modify: `apps/api/src/plugins/jwt.ts`
- Test: `apps/api/src/plugins/jwt-pat.test.ts`

**Interfaces:**
- Produces:
  - `PAT_PREFIX = 'spok_pat_'`
  - `generatePersonalToken(): { token: string; tokenHash: string; tokenPrefix: string }`
  - `hashPersonalToken(token: string): string`
  - `resolvePersonalToken(prisma, token): Promise<{ id; name; scope: 'read'|'write'; userId; email } | null>`
  - Sur `FastifyRequest` : `authVia: 'jwt' | 'pat' | undefined`, `personalToken?: { id: string; name: string; scope: 'read' | 'write' }`

- [ ] **Step 1: Écrire le test qui échoue** — `apps/api/src/plugins/jwt-pat.test.ts`

```ts
/*
 * TNR de l'authentification par jeton personnel (spok_pat_…) dans authenticate/optionalAuthenticate :
 * jeton valide → request.user, révoqué/expiré/utilisateur désactivé → 401, portée read → 403 sur écriture,
 * mode admin toujours désactivé pour un jeton.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from './jwt.js'
import { generatePersonalToken } from '../utils/personalTokens.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  app.get('/probe', { preHandler: [app.authenticate] }, async (req) => ({
    userId: req.user.userId, via: req.authVia, admin: req.isAdminMode, scope: req.personalToken?.scope ?? null,
  }))
  app.post('/probe', { preHandler: [app.authenticate] }, async () => ({ ok: true }))
  app.get('/optional', { preHandler: [app.optionalAuthenticate] }, async (req) => ({ userId: req.user?.userId ?? null }))
  await app.ready()
  return { app, prisma }
}

function tokenRow(tokenHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'pat-1', name: 'Claude perso', tokenHash, scope: 'write', userId: 'u1',
    revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
    user: { id: 'u1', email: 'u1@test.com', disabledAt: null },
    ...overrides,
  }
}

describe('Jeton personnel', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string
  let tokenHash: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    ;({ token, tokenHash } = generatePersonalToken())
  })

  it('authentifie un jeton valide, sans mode admin même si l\'en-tête est envoyé', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash))
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}`, 'x-admin-mode': 'true' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: 'u1', via: 'pat', admin: false, scope: 'write' })
    expect(prisma.personalAccessToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash } }))
  })

  it('refuse un jeton révoqué', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { revokedAt: new Date() }))
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse un jeton expiré', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { expiresAt: new Date(Date.now() - 1000) }))
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse le jeton d\'un utilisateur désactivé', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { user: { id: 'u1', email: 'u1@test.com', disabledAt: new Date() } }))
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('refuse un jeton inconnu', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(401)
  })

  it('portée read : GET autorisé, POST refusé en 403', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(tokenRow(tokenHash, { scope: 'read' }))
    const get = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(get.statusCode).toBe(200)
    const post = await app.inject({ method: 'POST', url: '/probe', headers: { authorization: `Bearer ${token}` } })
    expect(post.statusCode).toBe(403)
  })

  it('optionalAuthenticate : jeton invalide → anonyme, pas d\'erreur', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/optional', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: null })
  })

  it('un JWT classique continue de fonctionner (authVia = jwt)', async () => {
    const jwt = app.jwt.sign({ userId: 'u2', email: 'u2@test.com' })
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${jwt}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().via).toBe('jwt')
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `pnpm --filter @spok/api exec vitest run src/plugins/jwt-pat.test.ts`
Expected: FAIL — « Cannot find module '../utils/personalTokens.js' ».

- [ ] **Step 3: Créer `apps/api/src/utils/personalTokens.ts`**

```ts
/*
 * Jetons personnels d'accès API (spok_pat_…) — utilisés par les clients MCP distants.
 * generatePersonalToken : le jeton en clair n'existe qu'à la création (renvoyé une fois au client) ;
 * seul son hash SHA-256 est stocké. resolvePersonalToken : null si inconnu, révoqué, expiré ou
 * utilisateur désactivé. Ne JAMAIS loguer un jeton en clair.
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
    include: { user: { select: { id: true, email: true, disabledAt: true } } },
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
  }
}
```

- [ ] **Step 4: Modifier `apps/api/src/plugins/jwt.ts`**

Commentaire de tête remplacé par :
```ts
/*
 * Plugin JWT : décorateurs authenticate (401 sans token), optionalAuthenticate (request.user
 * undefined pour un anonyme — toujours garder request.user?.userId) et authenticateAdmin.
 * Jetons personnels (spok_pat_…, MCP distant) : acceptés par authenticate/optionalAuthenticate,
 * jamais par authenticateAdmin (jwtVerify échoue sur un PAT). Un PAT force isAdminMode=false ;
 * portée 'read' → 403 sur toute méthode autre que GET/HEAD. request.authVia indique la source.
 */
```
Imports et déclarations :
```ts
import { isPersonalToken, resolvePersonalToken, type PersonalTokenScope } from '../utils/personalTokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    isAdminMode: boolean;
    authVia?: 'jwt' | 'pat';
    personalToken?: { id: string; name: string; scope: PersonalTokenScope };
  }
  // ... (FastifyInstance inchangé)
}
```
Avant `fastify.decorate('authenticate', …)`, ajouter :
```ts
  function bearerOf(request: FastifyRequest): string | undefined {
    const h = request.headers.authorization;
    return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
  }

  /** 'ok' : request.user posé ; 'invalid' : PAT présent mais refusé ; 'none' : pas un PAT. */
  async function tryPersonalToken(request: FastifyRequest): Promise<'ok' | 'invalid' | 'none'> {
    const bearer = bearerOf(request);
    if (!isPersonalToken(bearer)) return 'none';
    const resolved = await resolvePersonalToken((fastify as any).prisma, bearer);
    if (!resolved) return 'invalid';
    request.user = { userId: resolved.userId, email: resolved.email };
    request.isAdminMode = false;
    request.authVia = 'pat';
    request.personalToken = { id: resolved.id, name: resolved.name, scope: resolved.scope };
    return 'ok';
  }

  const READ_METHODS = new Set(['GET', 'HEAD']);
```
Remplacer les deux décorateurs :
```ts
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const pat = await tryPersonalToken(request);
    if (pat === 'invalid') return reply.unauthorized('Invalid or expired token');
    if (pat === 'ok') {
      if (request.personalToken!.scope === 'read' && !READ_METHODS.has(request.method)) {
        return reply.forbidden('Jeton en lecture seule');
      }
      return;
    }
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
      request.authVia = 'jwt';
    } catch (err) {
      reply.unauthorized('Invalid or expired token');
    }
  });

  fastify.decorate('optionalAuthenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const pat = await tryPersonalToken(request);
    if (pat === 'ok') {
      if (request.personalToken!.scope === 'read' && !READ_METHODS.has(request.method)) {
        return reply.forbidden('Jeton en lecture seule');
      }
      return;
    }
    if (pat === 'invalid') {
      request.isAdminMode = false;
      return;
    }
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
      request.authVia = 'jwt';
    } catch {
      // No token or invalid token — continue as anonymous (request.user stays undefined)
      request.isAdminMode = false;
    }
  });
```

- [ ] **Step 5: Lancer le test**

Run: `pnpm --filter @spok/api exec vitest run src/plugins/jwt-pat.test.ts`
Expected: PASS (8 tests).

---

### Task 3: Routes `/user/tokens`

**Files:**
- Create: `apps/api/src/routes/personal-tokens.ts`
- Modify: `apps/api/src/index.ts` (import + `await app.register(personalTokensRoutes, { prefix: '/user' });` après `calendarFeedsRoutes`, l.315)
- Test: `apps/api/src/routes/personal-tokens.test.ts`

**Interfaces:**
- Consumes: `generatePersonalToken()` (Task 2), `request.authVia` (Task 2)
- Produces:
  - `GET /user/tokens` → `Array<{ id, name, tokenPrefix, scope, lastUsedAt, expiresAt, revokedAt, createdAt }>` (jamais `tokenHash`)
  - `POST /user/tokens` body `{ name: string (1-60), scope: 'read'|'write', expiresInDays?: 30|90|365|null }` → 201 `{ ...ligne, token: string }`
  - `DELETE /user/tokens/:id` → 204 (pose `revokedAt`)

- [ ] **Step 1: Test qui échoue** — `apps/api/src/routes/personal-tokens.test.ts`

```ts
/*
 * TNR de /user/tokens : création (jeton en clair renvoyé une seule fois, hash stocké), liste sans hash,
 * révocation scopée au propriétaire, refus de toute gestion de jetons authentifiée par un jeton.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { personalTokensRoutes } from './personal-tokens.js'
import { generatePersonalToken, hashPersonalToken } from '../utils/personalTokens.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(personalTokensRoutes, { prefix: '/user' })
  await app.ready()
  return { app, prisma }
}

describe('Personal tokens routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let jwt: string

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
    jwt = getTestToken(app)
  })

  it('crée un jeton : renvoie le clair une fois, stocke uniquement le hash', async () => {
    prisma.personalAccessToken.create.mockImplementation(async ({ data }: any) => ({ id: 'pat-1', createdAt: new Date(), lastUsedAt: null, revokedAt: null, ...data }))
    const res = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: 'Claude perso', scope: 'write', expiresInDays: 90 } })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toMatch(/^spok_pat_/)
    expect(body.tokenHash).toBeUndefined()
    const data = prisma.personalAccessToken.create.mock.calls[0][0].data
    expect(data.tokenHash).toBe(hashPersonalToken(body.token))
    expect(data.userId).toBe(USER_ID)
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now() + 89 * 86400_000)
  })

  it('refuse un nom vide ou une portée inconnue', async () => {
    const r1 = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: '', scope: 'write' } })
    expect(r1.statusCode).toBe(400)
    const r2 = await app.inject({ method: 'POST', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` }, payload: { name: 'x', scope: 'admin' } })
    expect(r2.statusCode).toBe(400)
  })

  it('liste les jetons de l\'utilisateur sans exposer le hash', async () => {
    await app.inject({ method: 'GET', url: '/user/tokens', headers: { authorization: `Bearer ${jwt}` } })
    const args = prisma.personalAccessToken.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: USER_ID })
    expect(args.select.tokenHash).toBeUndefined()
  })

  it('révoque uniquement un jeton de l\'utilisateur', async () => {
    prisma.personalAccessToken.findFirst.mockResolvedValue(null)
    const r404 = await app.inject({ method: 'DELETE', url: '/user/tokens/other', headers: { authorization: `Bearer ${jwt}` } })
    expect(r404.statusCode).toBe(404)
    expect(prisma.personalAccessToken.findFirst).toHaveBeenCalledWith({ where: { id: 'other', userId: USER_ID } })

    prisma.personalAccessToken.findFirst.mockResolvedValue({ id: 'pat-1', userId: USER_ID })
    prisma.personalAccessToken.update.mockResolvedValue({})
    const r204 = await app.inject({ method: 'DELETE', url: '/user/tokens/pat-1', headers: { authorization: `Bearer ${jwt}` } })
    expect(r204.statusCode).toBe(204)
    expect(prisma.personalAccessToken.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date)
  })

  it('un jeton personnel ne peut pas gérer les jetons', async () => {
    const { token, tokenHash } = generatePersonalToken()
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat-1', name: 'x', tokenHash, scope: 'write', revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
      user: { id: USER_ID, email: 'test@test.com', disabledAt: null },
    })
    const res = await app.inject({ method: 'GET', url: '/user/tokens', headers: { authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(403)
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @spok/api exec vitest run src/routes/personal-tokens.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Créer `apps/api/src/routes/personal-tokens.ts`**

```ts
/*
 * /user/tokens — gestion des jetons personnels (accès MCP distant) de l'utilisateur courant.
 * Création : le jeton en clair n'est renvoyé qu'une fois. Révocation logique (revokedAt).
 * Gestion réservée à une session web (JWT) : un jeton personnel ne peut ni lister ni créer ni
 * révoquer de jetons (403) — sinon un jeton fuité permettrait de s'en créer d'autres.
 */
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generatePersonalToken } from '../utils/personalTokens.js'

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(['read', 'write']),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable().optional(),
})

const PUBLIC_FIELDS = {
  id: true, name: true, tokenPrefix: true, scope: true,
  lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
} as const

export const personalTokensRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.authVia === 'pat') return reply.forbidden('Gestion des jetons impossible avec un jeton personnel')
  })

  fastify.get('/tokens', async (request) => {
    return fastify.prisma.personalAccessToken.findMany({
      where: { userId: request.user.userId },
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
    })
  })

  fastify.post('/tokens', async (request, reply) => {
    const parsed = createTokenSchema.safeParse(request.body)
    if (!parsed.success) return reply.badRequest('Nom (1-60 caractères) et portée read|write requis')
    const { name, scope, expiresInDays } = parsed.data
    const { token, tokenHash, tokenPrefix } = generatePersonalToken()
    const row = await fastify.prisma.personalAccessToken.create({
      data: {
        userId: request.user.userId,
        name,
        scope,
        tokenHash,
        tokenPrefix,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000) : null,
      },
    })
    const { tokenHash: _omit, ...publicRow } = row as any
    return reply.status(201).send({ ...publicRow, token })
  })

  fastify.delete<{ Params: { id: string } }>('/tokens/:id', async (request, reply) => {
    const existing = await fastify.prisma.personalAccessToken.findFirst({
      where: { id: request.params.id, userId: request.user.userId },
    })
    if (!existing) return reply.notFound('Jeton introuvable')
    await fastify.prisma.personalAccessToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    })
    return reply.status(204).send()
  })
}
```

- [ ] **Step 4: Enregistrer dans `apps/api/src/index.ts`** — import `import { personalTokensRoutes } from './routes/personal-tokens.js';` à côté de `calendarFeedsRoutes`, puis `await app.register(personalTokensRoutes, { prefix: '/user' });` juste après la ligne `calendarFeedsRoutes`. Ajouter au commentaire de tête : ` * /user/tokens : jetons personnels (MCP distant) ; /mcp : serveur MCP Streamable HTTP (cf. routes/mcp.ts).`

- [ ] **Step 5: Lancer le test**

Run: `pnpm --filter @spok/api exec vitest run src/routes/personal-tokens.test.ts`
Expected: PASS (5 tests).

---

### Task 4: Paquet `@spok/mcp-core` — conventions, validation, Markdown, dates

**Files:**
- Create: `packages/mcp-core/package.json`, `packages/mcp-core/tsconfig.json`, `packages/mcp-core/vitest.config.ts`
- Create: `packages/mcp-core/src/client.ts`, `src/errors.ts`, `src/markdown.ts`, `src/dates.ts`, `src/conventions.ts`
- Test: `packages/mcp-core/src/markdown.test.ts`, `src/conventions.test.ts`
- Modify: `package.json` racine (`build:packages`)

**Interfaces:**
- Produces:
  - `interface SpokClient { get(path: string): Promise<any>; post(path: string, body: unknown): Promise<any>; patch(path: string, body: unknown): Promise<any>; delete(path: string): Promise<any> }`
  - `class SpokApiError extends Error { status: number; body: string }`
  - `class ConventionError extends Error {}` (message destiné au modèle)
  - `markdownToHtml(md: string): string`
  - `normalizeDate(value: string, field: string): string` (ISO complet, lève `ConventionError`)
  - `interface SpaceConventions { statuses: { id: string; label: string }[]; types: { id: string; label: string }[]; tags: { id: string; name: string }[] }`
  - `fetchConventions(client: SpokClient, spaceId: string): Promise<SpaceConventions>`
  - `resolveStatus(input: string, conv: SpaceConventions): string` (id ou libellé → id ; lève `ConventionError`)
  - `assertTypeAllowed(type: string, conv: SpaceConventions): void`
  - `assertDateOrder(start?: string, end?: string): void`

- [ ] **Step 1: Squelette du paquet**

`packages/mcp-core/package.json` :
```json
{
  "name": "@spok/mcp-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "marked": "^14.1.4",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "rimraf": "^5.0.5",
    "typescript": "^5.3.0",
    "vitest": "^4.1.4"
  }
}
```
`packages/mcp-core/tsconfig.json` — copier `packages/shared/tsconfig.json` et ajouter `"exclude": ["src/**/*.test.ts", "dist"]`.
`packages/mcp-core/vitest.config.ts` :
```ts
/* Config Vitest de @spok/mcp-core : tests unitaires purs (pas de DB, pas d'API). */
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
```
Racine `package.json` : `"build:packages": "pnpm --filter @spok/shared --filter @spok/database --filter @spok/mcp-core build"`.

Run: `pnpm install`
Expected: lockfile mis à jour, `marked` installé.

- [ ] **Step 2: `src/client.ts` et `src/errors.ts`**

```ts
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
```
```ts
/*
 * Erreurs remontées au modèle par les outils MCP. ConventionError : donnée non conforme aux
 * conventions SPOK (message actionnable, en français, listant les valeurs acceptées).
 * SpokApiError : réponse non 2xx de l'API (status + corps brut).
 */
export class ConventionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConventionError'
  }
}

export class SpokApiError extends Error {
  constructor(public status: number, public body: string, path: string) {
    super(`SPOK API ${status} sur ${path}: ${body}`)
    this.name = 'SpokApiError'
  }
}
```

- [ ] **Step 3: Tests qui échouent** — `src/markdown.test.ts`

```ts
/* TNR de markdownToHtml : rendu Markdown → HTML compatible éditeur SPOK, neutralisation HTML brut et liens dangereux. */
import { describe, it, expect } from 'vitest'
import { markdownToHtml } from './markdown.js'

describe('markdownToHtml', () => {
  it('rend titres, listes, gras et liens', () => {
    const html = markdownToHtml('## Titre\n\n- un\n- **deux**\n\n[site](https://spok.space)')
    expect(html).toContain('<h2>Titre</h2>')
    expect(html).toContain('<li>un</li>')
    expect(html).toContain('<strong>deux</strong>')
    expect(html).toContain('<a href="https://spok.space">site</a>')
  })

  it('échappe le HTML brut', () => {
    const html = markdownToHtml('avant <script>alert(1)</script> après')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('neutralise un lien javascript:', () => {
    const html = markdownToHtml('[clic](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('clic')
  })

  it('texte vide → chaîne vide', () => {
    expect(markdownToHtml('   ')).toBe('')
  })
})
```

`src/conventions.test.ts` :
```ts
/* TNR des conventions SPOK : résolution de statut (id/libellé), types masqués, dates, ordre des dates. */
import { describe, it, expect, vi } from 'vitest'
import { fetchConventions, resolveStatus, assertTypeAllowed, assertDateOrder } from './conventions.js'
import { normalizeDate } from './dates.js'
import { ConventionError } from './errors.js'
import type { SpokClient } from './client.js'

const conv = {
  statuses: [{ id: 'todo', label: 'À faire' }, { id: 'in_progress', label: 'En cours' }],
  types: [{ id: 'TASK', label: 'Tâche' }, { id: 'NOTE', label: 'Note' }],
  tags: [],
}

describe('resolveStatus', () => {
  it('accepte un id exact', () => expect(resolveStatus('todo', conv)).toBe('todo'))
  it('mappe un libellé (casse et espaces ignorés)', () => expect(resolveStatus('  en COURS ', conv)).toBe('in_progress'))
  it('refuse un statut inconnu en listant les valeurs', () => {
    expect(() => resolveStatus('wip', conv)).toThrow(ConventionError)
    expect(() => resolveStatus('wip', conv)).toThrow(/todo \(À faire\).*in_progress \(En cours\)/)
  })
})

describe('assertTypeAllowed', () => {
  it('accepte un type visible', () => expect(() => assertTypeAllowed('TASK', conv)).not.toThrow())
  it('refuse un type masqué dans cette communauté', () => expect(() => assertTypeAllowed('BUG', conv)).toThrow(/TASK \(Tâche\)/))
})

describe('normalizeDate', () => {
  it('complète une date sans heure', () => expect(normalizeDate('2026-10-15', 'dueDate')).toBe('2026-10-15T00:00:00.000Z'))
  it('garde un ISO complet', () => expect(normalizeDate('2026-10-15T09:30:00+02:00', 'dueDate')).toBe('2026-10-15T07:30:00.000Z'))
  it('refuse une date illisible', () => expect(() => normalizeDate('15/10/2026', 'dueDate')).toThrow(/dueDate.*AAAA-MM-JJ/))
})

describe('assertDateOrder', () => {
  it('refuse une fin avant le début', () => expect(() => assertDateOrder('2026-10-15T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toThrow(ConventionError))
  it('tolère une seule borne', () => expect(() => assertDateOrder(undefined, '2026-10-01T00:00:00.000Z')).not.toThrow())
})

describe('fetchConventions', () => {
  it('ne garde que les statuts et types visibles, triés par ordre', async () => {
    const client: SpokClient = {
      get: vi.fn(async (path: string) => {
        if (path.endsWith('/referentiels')) return { referentiels: {
          statuses: [
            { id: 'done', label: 'Terminé', order: 2, visible: true },
            { id: 'todo', label: 'À faire', order: 1, visible: true },
            { id: 'late', label: 'En retard', order: 3, visible: false },
          ],
          typeLabels: {
            TASK: { label: 'Tâche', order: 1, visible: true },
            BUG: { label: 'Bug', order: 2, visible: false },
          },
        } }
        if (path.startsWith('/spaces/s1')) return { id: 's1', communityId: 'c1' }
        if (path.startsWith('/tags')) return [{ id: 't1', name: 'urgent' }]
        throw new Error(path)
      }),
      post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    }
    const res = await fetchConventions(client, 's1')
    expect(res.statuses.map((s) => s.id)).toEqual(['todo', 'done'])
    expect(res.types).toEqual([{ id: 'TASK', label: 'Tâche' }])
    expect(res.tags).toEqual([{ id: 't1', name: 'urgent' }])
  })
})
```

Run: `pnpm --filter @spok/mcp-core test`
Expected: FAIL — modules introuvables.

- [ ] **Step 4: `src/markdown.ts`**

```ts
/*
 * Conversion Markdown → HTML pour les champs riches SPOK (description d'item, contributions), qui sont
 * stockés en HTML et édités par RichTextEditor (Tiptap, getHTML). Le HTML brut du Markdown est échappé
 * et seuls les liens http(s)/mailto sont conservés : le contenu vient d'un modèle tiers, non de confiance.
 */
import { Marked } from 'marked'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SAFE_HREF = /^(https?:|mailto:)/i

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens)
      if (!href || !SAFE_HREF.test(href)) return label
      return `<a href="${escapeHtml(href)}">${label}</a>`
    },
  },
})

export function markdownToHtml(md: string): string {
  if (!md.trim()) return ''
  return (marked.parse(md, { async: false }) as string).trim()
}
```

- [ ] **Step 5: `src/dates.ts`**

```ts
/*
 * Normalisation des dates fournies par un modèle vers l'ISO 8601 complet exigé par l'API
 * (z.string().datetime()). Accepte AAAA-MM-JJ (minuit UTC) ou un ISO avec heure/fuseau.
 */
import { ConventionError } from './errors.js'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_WITH_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function normalizeDate(value: string, field: string): string {
  const v = value.trim()
  if (DATE_ONLY.test(v)) {
    const d = new Date(`${v}T00:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (ISO_WITH_TIME.test(v)) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  throw new ConventionError(`${field} : date invalide « ${value} ». Format attendu : AAAA-MM-JJ ou ISO 8601 (ex. 2026-10-15T09:00:00Z).`)
}
```

- [ ] **Step 6: `src/conventions.ts`**

```ts
/*
 * Conventions d'un espace SPOK, résolues depuis les référentiels de sa communauté
 * (GET /spaces/:id/referentiels) : statuts et types visibles, tags existants. Fonctions de validation
 * utilisées par create_item/update_item : chaque refus lève ConventionError avec les valeurs acceptées.
 */
import type { SpokClient } from './client.js'
import { ConventionError } from './errors.js'

export interface SpaceConventions {
  statuses: { id: string; label: string }[]
  types: { id: string; label: string }[]
  tags: { id: string; name: string }[]
}

export async function fetchConventions(client: SpokClient, spaceId: string): Promise<SpaceConventions> {
  const [refRes, space] = await Promise.all([
    client.get(`/spaces/${spaceId}/referentiels`),
    client.get(`/spaces/${spaceId}`),
  ])
  const ref = refRes.referentiels ?? refRes
  const statuses = [...(ref.statuses ?? [])]
    .filter((s: any) => s.visible !== false)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => ({ id: s.id, label: s.label }))
  const types = Object.entries(ref.typeLabels ?? {})
    .filter(([, t]: [string, any]) => t.visible !== false)
    .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([id, t]: [string, any]) => ({ id, label: t.label }))
  const tagsRes = space?.communityId ? await client.get(`/tags?communityId=${space.communityId}`) : []
  const tagList = Array.isArray(tagsRes) ? tagsRes : (tagsRes.data ?? [])
  return { statuses, types, tags: tagList.map((t: any) => ({ id: t.id, name: t.name })) }
}

function list(values: { id: string; label: string }[]): string {
  return values.map((v) => `${v.id} (${v.label})`).join(', ')
}

export function resolveStatus(input: string, conv: SpaceConventions): string {
  const raw = input.trim()
  const byId = conv.statuses.find((s) => s.id === raw)
  if (byId) return byId.id
  const norm = raw.toLowerCase()
  const byLabel = conv.statuses.find((s) => s.label.trim().toLowerCase() === norm)
  if (byLabel) return byLabel.id
  throw new ConventionError(`Statut « ${input} » inconnu dans cet espace. Valeurs acceptées : ${list(conv.statuses)}.`)
}

export function assertTypeAllowed(type: string, conv: SpaceConventions): void {
  if (!conv.types.some((t) => t.id === type)) {
    throw new ConventionError(`Type « ${type} » non utilisé dans cet espace. Types acceptés : ${list(conv.types)}.`)
  }
}

export function assertDateOrder(start?: string, end?: string): void {
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw new ConventionError(`endDate (${end.slice(0, 10)}) est antérieure à startDate (${start.slice(0, 10)}).`)
  }
}
```

Note : le test `fetchConventions` mocke `/spaces/s1` (sans suffixe) — `client.get('/spaces/s1')` matche `path.startsWith('/spaces/s1')` après le test du suffixe `/referentiels`. OK.

- [ ] **Step 7: Lancer les tests**

Run: `pnpm --filter @spok/mcp-core test`
Expected: PASS (markdown 4, conventions 11).

---

### Task 5: `@spok/mcp-core` — instructions serveur et outils

**Files:**
- Create: `packages/mcp-core/src/instructions.ts`, `src/format.ts`, `src/tools.ts`, `src/index.ts`
- Test: `packages/mcp-core/src/tools.test.ts`

**Interfaces:**
- Consumes: tout Task 4.
- Produces:
  - `SPOK_INSTRUCTIONS: string`
  - `type ToolProfile = 'admin' | 'public' | 'public-read'`
  - `createSpokMcpServer(opts: { client: SpokClient; profile: ToolProfile }): McpServer`
  - export de `SpokApiError`, `ConventionError`, `SpokClient`, `markdownToHtml`

- [ ] **Step 1: `src/instructions.ts`**

```ts
/*
 * Instructions serveur MCP envoyées à chaque client à l'initialisation : modèle de données SPOK et
 * règles d'écriture. Source unique — toute nouvelle convention métier exposée aux modèles s'ajoute ici.
 */
export const SPOK_INSTRUCTIONS = `SPOK structure, relie et planifie des informations.

## Modèle
- Communauté → Espaces (arborescence) → Items.
- Un item a un type : PROJECT (ensemble de travail avec dates), TASK (action à faire, statut + échéance),
  MEETING (réunion datée), NOTE (texte libre), DOCUMENT (texte long structuré), LINK (url obligatoire),
  PERIOD (plage de dates sans action, ex. vacances, sprint), BUG (anomalie à corriger), IMAGE, DIAGRAM, CONFIG.
  Les types réellement utilisés et leurs libellés dépendent de la communauté : voir get_space_conventions.
- Hiérarchie (parentId) : décomposition. Un PROJECT contient des TASK ; une TASK peut contenir des sous-TASK.
  Le parent doit être dans le même espace.
- Relations (create_relation), entre items qui ne sont pas parent/enfant :
  blocks = la source empêche la cible de démarrer ; implements = la source réalise/permet la cible ;
  drives = la source pilote la cible (décaler la source décale la cible) ; relates = simple lien.

## Règles d'écriture (obligatoires)
1. Avant toute création ou modification dans un espace, appelle get_space_conventions(spaceId) une fois
   et utilise exclusivement les statuts et types qu'il renvoie.
2. Les descriptions et contributions s'écrivent en Markdown (titres, listes, liens) — pas de HTML.
3. Dates : AAAA-MM-JJ ou ISO 8601. startDate ≤ endDate. dueDate = échéance d'une tâche.
4. Priorité : 1 (basse) à 4 (critique), à omettre si non pertinente.
5. Titres courts et explicites (pas de phrase entière) ; le détail va dans la description.
6. Avant de créer, cherche un doublon (search_items) ; préfère update_item à la création d'un quasi-doublon.
7. Si un outil renvoie une erreur de convention, corrige la valeur avec la liste fournie et réessaie.
8. Ne supprime rien sans confirmation explicite de l'utilisateur.`
```

- [ ] **Step 2: `src/format.ts`** — déplacer depuis `apps/mcp/src/index.ts` (l.924-941) `extractText`, et factoriser la ligne d'item répétée 3 fois :

```ts
/*
 * Mise en forme texte des réponses d'outils MCP (lignes d'items, extraction de texte depuis HTML ou
 * Tiptap JSON). Purement présentationnel — aucune règle métier ici.
 */
export function extractText(description: any): string {
  if (!description) return ''
  if (typeof description === 'string') {
    let parsed: any
    try { parsed = JSON.parse(description) } catch { /* not JSON — treat as HTML */ }
    if (parsed) {
      description = parsed
    } else {
      return description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  if (typeof description !== 'object') return ''
  function collectText(node: any): string {
    if (node.type === 'text') return node.text ?? ''
    return (node.content ?? []).map(collectText).join(' ')
  }
  return (description.content ?? []).map(collectText).join('\n').trim()
}

export function formatItemLine(item: any, opts: { excerpt?: number; withSpace?: boolean; withParent?: boolean } = {}): string {
  const parts = [`[${item.id}] [${item.type}] ${item.title}`]
  if (opts.withSpace && item.space?.name) parts.push(`espace: ${item.space.name}`)
  if (item.status) parts.push(`statut: ${item.status}`)
  if (item.priority) parts.push(`priorité: ${item.priority}`)
  if (item.startDate) parts.push(`début: ${item.startDate.slice(0, 10)}`)
  if (item.endDate) parts.push(`fin: ${item.endDate.slice(0, 10)}`)
  if (item.dueDate) parts.push(`échéance: ${item.dueDate.slice(0, 10)}`)
  if (item.url) parts.push(`url: ${item.url}`)
  if (opts.withParent && item.parentId) parts.push(`parent: ${item.parentId}`)
  const max = opts.excerpt ?? 120
  const text = extractText(item.content ?? item.description)
  if (text) parts.push(`→ ${text.slice(0, max)}${text.length > max ? '…' : ''}`)
  return parts.join(' | ')
}
```

- [ ] **Step 3: Test qui échoue** — `src/tools.test.ts`

```ts
/*
 * TNR des outils MCP SPOK via un client mémoire : sélection des outils par profil, validation des
 * conventions avant écriture (statut, type, dates, parent), conversion Markdown, erreurs renvoyées
 * en isError au lieu de faire planter le serveur.
 */
import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createSpokMcpServer, type ToolProfile } from './index.js'
import { SpokApiError } from './errors.js'
import type { SpokClient } from './client.js'

function fakeClient(): SpokClient & { post: any; patch: any; get: any } {
  return {
    get: vi.fn(async (path: string) => {
      if (path === '/spaces/s1/referentiels') return { referentiels: {
        statuses: [{ id: 'todo', label: 'À faire', order: 0, visible: true }, { id: 'in_progress', label: 'En cours', order: 1, visible: true }],
        typeLabels: { TASK: { label: 'Tâche', order: 0, visible: true }, PROJECT: { label: 'Projet', order: 1, visible: true } },
      } }
      if (path === '/spaces/s1') return { id: 's1', name: 'Espace', communityId: 'c1' }
      if (path.startsWith('/tags')) return []
      if (path === '/spaces/s1/items/p1') return { id: 'p1', spaceId: 's1', type: 'PROJECT', title: 'P' }
      if (path === '/spaces/s1/items/autre') throw new SpokApiError(404, 'not found', path)
      throw new Error(`GET inattendu ${path}`)
    }),
    post: vi.fn(async (_p: string, body: any) => ({ id: 'new', ...body })),
    patch: vi.fn(async (_p: string, body: any) => ({ id: 'i1', title: 'x', ...body })),
    delete: vi.fn(async () => ({})),
  }
}

async function connect(profile: ToolProfile, client = fakeClient()) {
  const server = createSpokMcpServer({ client, profile })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const mcp = new Client({ name: 'test', version: '0' })
  await Promise.all([server.connect(a), mcp.connect(b)])
  return { mcp, client }
}

const text = (r: any) => r.content.map((c: any) => c.text).join('\n')

describe('profils', () => {
  it('public : pas d\'outils d\'administration', async () => {
    const { mcp } = await connect('public')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('create_item')
    expect(names).toContain('get_space_conventions')
    for (const n of ['list_users', 'update_user', 'delete_user', 'delete_space', 'delete_community', 'add_space_member', 'create_community']) {
      expect(names).not.toContain(n)
    }
  })

  it('public-read : aucun outil d\'écriture', async () => {
    const { mcp } = await connect('public-read')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('get_item')
    for (const n of ['create_item', 'update_item', 'delete_item', 'create_relation', 'create_contribution', 'create_space']) {
      expect(names).not.toContain(n)
    }
  })

  it('admin : conserve les outils d\'administration', async () => {
    const { mcp } = await connect('admin')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('list_users')
  })

  it('les instructions serveur sont transmises', async () => {
    const { mcp } = await connect('public')
    expect(mcp.getInstructions()).toContain('get_space_conventions')
  })
})

describe('create_item', () => {
  it('mappe le statut libellé, normalise les dates, convertit le Markdown', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: {
      spaceId: 's1', type: 'TASK', title: 'Rédiger', status: 'En cours', parentId: 'p1',
      startDate: '2026-10-12', endDate: '2026-10-15', description: '- point **un**',
    } })
    expect(r.isError).toBeFalsy()
    const body = client.post.mock.calls[0][1]
    expect(body.status).toBe('in_progress')
    expect(body.startDate).toBe('2026-10-12T00:00:00.000Z')
    expect(body.description).toContain('<strong>un</strong>')
  })

  it('statut inconnu → isError avec la liste, aucun POST', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', status: 'wip' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/todo \(À faire\)/)
    expect(client.post).not.toHaveBeenCalled()
  })

  it('type masqué → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'BUG', title: 'x' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/TASK \(Tâche\)/)
  })

  it('fin avant début → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', startDate: '2026-10-15', endDate: '2026-10-01' } })
    expect(r.isError).toBe(true)
  })

  it('parent hors de l\'espace → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', parentId: 'autre' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/parent/i)
  })
})

describe('update_item', () => {
  it('valide le statut avant PATCH', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'update_item', arguments: { spaceId: 's1', itemId: 'i1', status: 'à faire' } })
    expect(r.isError).toBeFalsy()
    expect(client.patch.mock.calls[0][1].status).toBe('todo')
  })
})

describe('create_contribution', () => {
  it('envoie une chaîne HTML (le schéma API attend z.string)', async () => {
    const { mcp, client } = await connect('public')
    await mcp.callTool({ name: 'create_contribution', arguments: { spaceId: 's1', itemId: 'i1', content: 'Bonjour **toi**' } })
    const body = client.post.mock.calls[0][1]
    expect(typeof body.content).toBe('string')
    expect(body.content).toContain('<strong>toi</strong>')
  })
})

describe('erreurs API', () => {
  it('une 404 API devient isError lisible', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'get_item', arguments: { spaceId: 's1', itemId: 'autre' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/404/)
  })
})
```

Run: `pnpm --filter @spok/mcp-core test -- tools`
Expected: FAIL — `./index.js` introuvable.

- [ ] **Step 4: `src/tools.ts`**

Structure : une fonction `registerTools(server, client, profile)`. Chaque outil est déclaré avec un niveau `'read' | 'write' | 'admin'` ; un helper `define(level, name, description, schema, handler)` l'enregistre seulement si le profil le permet, et enveloppe le handler dans `safe()`.

```ts
/*
 * Déclaration des outils MCP SPOK, filtrés par profil :
 *  - 'admin'       : MCP local de Thomas (stdio) — tout, y compris utilisateurs/membres/suppressions d'espaces.
 *  - 'public'      : MCP distant, jeton portée write — lecture + écriture de contenu, aucune administration.
 *  - 'public-read' : MCP distant, jeton portée read — lecture seule.
 * Toute écriture d'item passe par les conventions de l'espace (conventions.ts) ; les erreurs (ConventionError,
 * SpokApiError) sont renvoyées au modèle en isError, jamais levées. Ajouter un outil = choisir son niveau.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z, type ZodRawShape } from 'zod'
import type { SpokClient } from './client.js'
import { ConventionError, SpokApiError } from './errors.js'
import { fetchConventions, resolveStatus, assertTypeAllowed, assertDateOrder, type SpaceConventions } from './conventions.js'
import { normalizeDate } from './dates.js'
import { markdownToHtml } from './markdown.js'
import { extractText, formatItemLine } from './format.js'

export type ToolProfile = 'admin' | 'public' | 'public-read'
type Level = 'read' | 'write' | 'admin'

const ALLOWED: Record<ToolProfile, Level[]> = {
  admin: ['read', 'write', 'admin'],
  public: ['read', 'write'],
  'public-read': ['read'],
}

const ITEM_TYPES = ['UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const
/** Miroir de RELATION_TYPES @spok/shared hors `parent` (l'API refuse tout autre type). */
const RELATION_TYPE_VALUES = ['blocks', 'implements', 'drives', 'relates'] as const

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] })

function safe<A>(handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args)
    } catch (err) {
      if (err instanceof ConventionError) return { content: [{ type: 'text', text: `Donnée non conforme : ${err.message}` }], isError: true }
      if (err instanceof SpokApiError) return { content: [{ type: 'text', text: `Erreur SPOK ${err.status} : ${err.body}` }], isError: true }
      return { content: [{ type: 'text', text: `Erreur : ${(err as Error).message}` }], isError: true }
    }
  }
}

/** Champs d'item communs à create/update, validés et normalisés selon les conventions de l'espace. */
async function prepareItemFields(
  client: SpokClient,
  spaceId: string,
  input: { type?: string; status?: string | null; parentId?: string | null; startDate?: string | null; endDate?: string | null; dueDate?: string | null; description?: string | null },
  conventionsCache: Map<string, SpaceConventions>,
): Promise<Record<string, unknown>> {
  let conv = conventionsCache.get(spaceId)
  if (!conv) {
    conv = await fetchConventions(client, spaceId)
    conventionsCache.set(spaceId, conv)
  }
  const out: Record<string, unknown> = {}
  if (input.type) {
    assertTypeAllowed(input.type, conv)
    out.type = input.type
  }
  if (input.status) out.status = resolveStatus(input.status, conv)
  else if (input.status === null) out.status = null
  for (const f of ['startDate', 'endDate', 'dueDate'] as const) {
    const v = input[f]
    if (v) out[f] = normalizeDate(v, f)
    else if (v === null) out[f] = null
  }
  assertDateOrder(out.startDate as string | undefined, out.endDate as string | undefined)
  if (input.parentId) {
    try {
      await client.get(`/spaces/${spaceId}/items/${input.parentId}`)
    } catch (err) {
      if (err instanceof SpokApiError && err.status === 404) {
        throw new ConventionError(`parentId « ${input.parentId} » introuvable dans l'espace ${spaceId}. Le parent doit appartenir au même espace.`)
      }
      throw err
    }
    out.parentId = input.parentId
  } else if (input.parentId === null) out.parentId = null
  if (input.description !== undefined && input.description !== null) out.description = markdownToHtml(input.description)
  else if (input.description === null) out.description = null
  return out
}

export function registerTools(server: McpServer, client: SpokClient, profile: ToolProfile): void {
  const allowed = new Set(ALLOWED[profile])
  // Cache par connexion : les conventions d'un espace ne changent pas pendant une session MCP.
  const conventionsCache = new Map<string, SpaceConventions>()

  function define<S extends ZodRawShape>(level: Level, name: string, description: string, shape: S, handler: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<ToolResult>) {
    if (!allowed.has(level)) return
    server.tool(name, description, shape, safe(handler) as any)
  }

  // ─── Lecture ──────────────────────────────────────────────────────────────
  // Reprendre À L'IDENTIQUE les handlers existants de apps/mcp/src/index.ts pour :
  //   list_spaces (l.22-47), get_space (l.51-100, lignes via formatItemLine(item, { excerpt: 200, withParent: true })),
  //   search_items (l.104-145, formatItemLine(item, { withSpace: true })), list_items (l.193-231,
  //   formatItemLine(item, { withParent: true })), get_item (l.235-264), list_communities (l.383-399),
  //   get_community (l.403-429), list_relations (l.858-870), list_contributions (l.559-574),
  //   get_contribution (l.578-589), list_tags (l.642-653), get_tag (l.657-665),
  //   list_notifications (l.813-826)
  // en remplaçant `server.tool(` par `define('read', ` et `api.` par `client.`.

  define('read', 'get_space_conventions',
    'Statuts, types et tags autorisés dans un espace. À appeler avant toute création/modification d\'item dans cet espace.',
    { spaceId: z.string().describe('ID de l\'espace') },
    async ({ spaceId }) => {
      const conv = await fetchConventions(client, spaceId)
      conventionsCache.set(spaceId, conv)
      return ok([
        `Statuts (utiliser l'id) : ${conv.statuses.map((s) => `${s.id} = ${s.label}`).join(' ; ')}`,
        `Types (utiliser l'id) : ${conv.types.map((t) => `${t.id} = ${t.label}`).join(' ; ')}`,
        `Tags existants : ${conv.tags.length ? conv.tags.map((t) => `${t.name} [${t.id}]`).join(', ') : 'aucun'}`,
      ].join('\n'))
    })

  // ─── Écriture ─────────────────────────────────────────────────────────────
  define('write', 'create_item',
    'Crée un item dans un espace. Statut et type doivent appartenir aux conventions de l\'espace (get_space_conventions). Description en Markdown.',
    {
      spaceId: z.string().describe('ID de l\'espace cible'),
      type: z.enum(ITEM_TYPES).describe('Type d\'item (id renvoyé par get_space_conventions)'),
      title: z.string().min(1).describe('Titre court'),
      description: z.string().optional().describe('Description en Markdown'),
      status: z.string().optional().describe('Id (ou libellé) d\'un statut de l\'espace'),
      priority: z.number().int().min(1).max(4).optional().describe('1 basse … 4 critique'),
      parentId: z.string().optional().describe('ID d\'un item parent du même espace'),
      startDate: z.string().optional().describe('AAAA-MM-JJ ou ISO 8601'),
      endDate: z.string().optional().describe('AAAA-MM-JJ ou ISO 8601, ≥ startDate'),
      dueDate: z.string().optional().describe('Échéance, AAAA-MM-JJ ou ISO 8601'),
      url: z.string().url().optional().describe('URL (obligatoire pour LINK)'),
    },
    async ({ spaceId, title, priority, url, ...rest }) => {
      const body: Record<string, unknown> = { title, ...(await prepareItemFields(client, spaceId, rest, conventionsCache)) }
      if (priority) body.priority = priority
      if (url) body.url = url
      if (rest.type === 'LINK' && !url) throw new ConventionError('Un item LINK exige une url.')
      const item = await client.post(`/spaces/${spaceId}/items`, body)
      return ok(`Item créé : [${item.id}] [${item.type}] ${item.title}`)
    })

  define('write', 'update_item',
    'Met à jour un item. Mêmes règles que create_item ; null efface un champ.',
    {
      spaceId: z.string(),
      itemId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional().describe('Markdown ; null efface'),
      status: z.string().nullable().optional(),
      priority: z.number().int().min(1).max(4).nullable().optional(),
      type: z.enum(ITEM_TYPES).optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      url: z.string().url().nullable().optional(),
      parentId: z.string().nullable().optional().describe('null = racine'),
    },
    async ({ spaceId, itemId, title, priority, url, ...rest }) => {
      const body: Record<string, unknown> = await prepareItemFields(client, spaceId, rest, conventionsCache)
      if (title !== undefined) body.title = title
      if (priority !== undefined) body.priority = priority
      if (url !== undefined) body.url = url
      const item = await client.patch(`/spaces/${spaceId}/items/${itemId}`, body)
      return ok(`Item mis à jour : [${item.id}] ${item.title}`)
    })

  // Reprendre de apps/mcp/src/index.ts, avec define('write', …) et client. :
  //   delete_item (l.301-316), create_relation (l.874-890), update_relation (l.894-908),
  //   delete_relation (l.912-920), mark_notification_read (l.830-842).
  // create_space (l.320-344) : define('write', …) — l'API refuse déjà si l'utilisateur n'est pas membre.

  define('write', 'create_contribution',
    'Ajoute une contribution (commentaire) à un item. Contenu en Markdown.',
    { spaceId: z.string(), itemId: z.string(), content: z.string().min(1).describe('Markdown') },
    async ({ spaceId, itemId, content }) => {
      const c = await client.post(`/spaces/${spaceId}/items/${itemId}/contributions`, { content: markdownToHtml(content) })
      return ok(`Contribution créée : [${c.id}]`)
    })

  define('write', 'update_contribution',
    'Met à jour une contribution. Contenu en Markdown.',
    { spaceId: z.string(), itemId: z.string(), contributionId: z.string(), content: z.string().min(1) },
    async ({ spaceId, itemId, contributionId, content }) => {
      const c = await client.patch(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`, { content: markdownToHtml(content) })
      return ok(`Contribution mise à jour : [${c.id}]`)
    })

  // ─── Administration (profil admin uniquement) ─────────────────────────────
  // Reprendre de apps/mcp/src/index.ts avec define('admin', …) :
  //   update_space (l.348-363), delete_space (l.367-379), create_community (l.433-450),
  //   update_community (l.454-469), delete_community (l.473-485), list_users, get_user, update_user,
  //   delete_user (l.489-555), delete_contribution (l.630-638), create_tag, update_tag, delete_tag (l.669-705),
  //   list_space_members, add_space_member, update_space_member, remove_space_member (l.709-765),
  //   list_community_members, add_community_member, remove_community_member (l.769-809),
  //   delete_notification (l.846-854).
}
```

Note d'exécution : les blocs « Reprendre » sont des déplacements mécaniques du code existant (lignes citées de `apps/mcp/src/index.ts` au 2026-10-12) — ne modifier que `server.tool(`→`define(level, `, `api.`→`client.`, et les lignes d'items → `formatItemLine`. Le test « profils » vérifie la répartition.

- [ ] **Step 5: `src/index.ts`**

```ts
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
```

- [ ] **Step 6: Lancer les tests + typecheck du paquet**

Run: `pnpm --filter @spok/mcp-core test` puis `pnpm --filter @spok/mcp-core typecheck`
Expected: PASS (tous), typecheck sans erreur.

---

### Task 6: MCP local branché sur `@spok/mcp-core`

**Files:**
- Modify: `apps/mcp/src/index.ts` (remplacé intégralement), `apps/mcp/src/client.ts:81-84`, `apps/mcp/package.json`

**Interfaces:**
- Consumes: `createSpokMcpServer`, `SpokApiError` (Task 5).

- [ ] **Step 1:** `apps/mcp/package.json` — ajouter `"@spok/mcp-core": "workspace:*"` en dépendance. Run: `pnpm install`.

- [ ] **Step 2:** `apps/mcp/src/client.ts` — remplacer le `throw new Error(...)` (l.81-84) par :
```ts
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SpokApiError(res.status, body, path);
  }
```
avec `import { SpokApiError, type SpokClient } from '@spok/mcp-core';` et typer l'export : `export const api: SpokClient = { … }`. Ajouter au commentaire de tête : « Implémente SpokClient de @spok/mcp-core ; les erreurs non 2xx lèvent SpokApiError. »

- [ ] **Step 3:** `apps/mcp/src/index.ts` remplacé par :
```ts
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
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @spok/mcp-core build` puis `pnpm --filter @spok/mcp typecheck` puis `pnpm --filter @spok/mcp build`
Expected: aucune erreur. (Vérification fonctionnelle après redémarrage de Claude : `mcp__spok__get_space_conventions` doit apparaître — à signaler à Thomas en fin de plan.)

---

### Task 7: Contexte de requête et traçabilité d'audit

**Files:**
- Create: `apps/api/src/utils/requestContext.ts`
- Modify: `apps/api/src/utils/audit.ts`
- Test: `apps/api/src/utils/audit-source.test.ts`

**Interfaces:**
- Produces:
  - `interface McpRequestContext { via: 'mcp'; tokenId: string; tokenName: string }`
  - `runWithRequestContext<T>(ctx: McpRequestContext, fn: () => Promise<T>): Promise<T>`
  - `getRequestContext(): McpRequestContext | undefined`
  - `createAuditLog` ajoute `changes.source = { via, tokenId, tokenName }` quand un contexte est actif.

- [ ] **Step 1: Test qui échoue** — `apps/api/src/utils/audit-source.test.ts`

```ts
/* TNR : createAuditLog marque l'origine MCP (jeton) quand un contexte de requête est actif, y compris à travers fastify.inject. */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { createMockPrisma } from '../test/helpers.js'
import { createAuditLog } from './audit.js'
import { runWithRequestContext } from './requestContext.js'

const base = { action: 'CREATE' as const, entity: 'Item' as const, entityId: 'i1', userId: 'u1', spaceId: 's1', changes: { after: { id: 'i1' } } }

describe('audit source MCP', () => {
  it('sans contexte : changes inchangés', async () => {
    const prisma = createMockPrisma()
    await createAuditLog(prisma as any, base)
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toEqual({ after: { id: 'i1' } })
  })

  it('avec contexte : ajoute source', async () => {
    const prisma = createMockPrisma()
    await runWithRequestContext({ via: 'mcp', tokenId: 'pat-1', tokenName: 'Claude perso' }, () => createAuditLog(prisma as any, base))
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.source).toEqual({ via: 'mcp', tokenId: 'pat-1', tokenName: 'Claude perso' })
  })

  it('le contexte traverse fastify.inject', async () => {
    const prisma = createMockPrisma()
    const app = Fastify({ logger: false })
    app.post('/x', async () => { await createAuditLog(prisma as any, base); return {} })
    await app.ready()
    await runWithRequestContext({ via: 'mcp', tokenId: 'pat-1', tokenName: 'n' }, () => app.inject({ method: 'POST', url: '/x' }))
    expect(prisma.auditLog.create.mock.calls[0][0].data.changes.source?.via).toBe('mcp')
  })
})
```

Run: `pnpm --filter @spok/api exec vitest run src/utils/audit-source.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 2: `apps/api/src/utils/requestContext.ts`**

```ts
/*
 * Contexte asynchrone d'une requête MCP distante (AsyncLocalStorage) : porté par routes/mcp.ts autour du
 * traitement d'un message, il traverse les sous-requêtes fastify.inject et permet à createAuditLog de
 * marquer l'origine (jeton). Ne rien y stocker de secret (le jeton en clair n'y est jamais).
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
```

- [ ] **Step 3: `apps/api/src/utils/audit.ts`** — commentaire de tête : `/* Création des entrées AuditLog + sérialiseurs par entité (item, espace, communauté, relation). Écriture issue du MCP distant : changes.source = { via: 'mcp', tokenId, tokenName } (cf. utils/requestContext.ts). */`. Import `import { getRequestContext } from './requestContext.js';`. Dans `createAuditLog`, remplacer `changes: data.changes as any,` par :
```ts
      changes: (() => {
        const ctx = getRequestContext();
        return (ctx ? { ...data.changes, source: { via: ctx.via, tokenId: ctx.tokenId, tokenName: ctx.tokenName } } : data.changes) as any;
      })(),
```

- [ ] **Step 4: Lancer le test**

Run: `pnpm --filter @spok/api exec vitest run src/utils/audit-source.test.ts`
Expected: PASS (3). Si le 3e échoue (contexte perdu dans inject) → **stop**, signaler à Thomas : repli prévu = passer le contexte via un en-tête interne signé.

---

### Task 8: Route `POST /mcp` dans l'API

**Files:**
- Create: `apps/api/src/mcp/internal.ts`, `apps/api/src/mcp/injectClient.ts`, `apps/api/src/routes/mcp.ts`
- Modify: `apps/api/src/index.ts` (rate-limit `allowList`, enregistrement route), `apps/api/package.json`
- Test: `apps/api/src/routes/mcp.test.ts`

**Interfaces:**
- Consumes: `createSpokMcpServer`, `SpokApiError`, `SpokClient` (Task 5) ; `request.authVia`, `request.personalToken` (Task 2) ; `runWithRequestContext` (Task 7).
- Produces:
  - `INTERNAL_REQUEST_HEADER = 'x-spok-internal'`, `INTERNAL_REQUEST_SECRET: string`, `isInternalRequest(headers): boolean`
  - `createInjectClient(app: FastifyInstance, authorization: string): SpokClient`
  - `mcpRoutes: FastifyPluginAsync` — `POST /mcp` (JSON-RPC MCP), `GET|DELETE /mcp` → 405.

- [ ] **Step 1:** `apps/api/package.json` — ajouter `"@modelcontextprotocol/sdk": "^1.29.0"` et `"@spok/mcp-core": "workspace:*"`. Run: `pnpm install`.

- [ ] **Step 2: Test qui échoue** — `apps/api/src/routes/mcp.test.ts`

```ts
/*
 * TNR de POST /mcp : refus sans jeton personnel (JWT web refusé), initialize + tools/list selon la portée,
 * appel d'outil rejoué sur les routes REST via inject avec le jeton de l'appelant, sans mode admin.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { mcpRoutes } from './mcp.js'
import { generatePersonalToken } from '../utils/personalTokens.js'

const HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  // Route REST factice pour observer les sous-requêtes des outils
  app.get('/communities', { preHandler: [app.authenticate] }, async (req) => [
    { id: 'c1', name: `vue par ${req.user.userId} admin=${req.isAdminMode}` },
  ])
  await app.register(mcpRoutes)
  await app.ready()
  return { app, prisma }
}

function rpc(method: string, params: unknown = {}, id = 1) {
  return { jsonrpc: '2.0', id, method, params }
}

const INIT = rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } })

describe('POST /mcp', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  function withScope(scope: 'read' | 'write') {
    const g = generatePersonalToken()
    token = g.token
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat-1', name: 'Claude perso', tokenHash: g.tokenHash, scope, revokedAt: null, expiresAt: null, lastUsedAt: new Date(),
      user: { id: 'u1', email: 'u1@test.com', disabledAt: null },
    })
  }

  beforeEach(async () => {
    ;({ app, prisma } = await buildApp())
  })

  it('401 sans authentification', async () => {
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: HEADERS, payload: INIT })
    expect(res.statusCode).toBe(401)
  })

  it('403 avec un JWT de session web', async () => {
    const jwt = getTestToken(app)
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${jwt}` }, payload: INIT })
    expect(res.statusCode).toBe(403)
  })

  it('initialize renvoie les instructions SPOK', async () => {
    withScope('write')
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${token}` }, payload: INIT })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.instructions).toContain('get_space_conventions')
  })

  it('portée read : tools/list sans outil d\'écriture', async () => {
    withScope('read')
    const res = await app.inject({ method: 'POST', url: '/mcp', headers: { ...HEADERS, authorization: `Bearer ${token}` }, payload: rpc('tools/list') })
    const names = res.json().result.tools.map((t: any) => t.name)
    expect(names).toContain('get_item')
    expect(names).not.toContain('create_item')
  })

  it('tools/call rejoue la route REST avec l\'identité du jeton, sans mode admin', async () => {
    withScope('write')
    const res = await app.inject({
      method: 'POST', url: '/mcp',
      headers: { ...HEADERS, authorization: `Bearer ${token}`, 'x-admin-mode': 'true' },
      payload: rpc('tools/call', { name: 'list_communities', arguments: {} }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.content[0].text).toContain('vue par u1 admin=false')
  })

  it('GET /mcp → 405', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp' })
    expect(res.statusCode).toBe(405)
  })
})
```

Run: `pnpm --filter @spok/api exec vitest run src/routes/mcp.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: `apps/api/src/mcp/internal.ts`**

```ts
/*
 * Marqueur des sous-requêtes internes émises par le MCP distant (fastify.inject). Secret aléatoire par
 * process, jamais exposé : sert uniquement à exempter ces sous-requêtes du rate-limit global par IP
 * (elles viennent toutes de 127.0.0.1 et épuiseraient le quota commun). Le rate-limit s'applique à /mcp.
 */
import { randomBytes } from 'crypto'

export const INTERNAL_REQUEST_HEADER = 'x-spok-internal'
export const INTERNAL_REQUEST_SECRET = randomBytes(24).toString('hex')

export function isInternalRequest(headers: Record<string, unknown>): boolean {
  return headers[INTERNAL_REQUEST_HEADER] === INTERNAL_REQUEST_SECRET
}
```

- [ ] **Step 4: `apps/api/src/mcp/injectClient.ts`**

```ts
/*
 * SpokClient du MCP distant : rejoue chaque appel d'outil sur les routes REST de l'API via fastify.inject,
 * avec l'en-tête Authorization de l'appelant (jeton personnel) — les permissions REST s'appliquent telles
 * quelles. N'envoie JAMAIS X-Admin-Mode. Réponse non 2xx → SpokApiError (message renvoyé au modèle).
 */
import type { FastifyInstance } from 'fastify'
import { SpokApiError, type SpokClient } from '@spok/mcp-core'
import { INTERNAL_REQUEST_HEADER, INTERNAL_REQUEST_SECRET } from './internal.js'

export function createInjectClient(app: FastifyInstance, authorization: string): SpokClient {
  async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    const res = await app.inject({
      method,
      url: path,
      headers: {
        authorization,
        [INTERNAL_REQUEST_HEADER]: INTERNAL_REQUEST_SECRET,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    })
    if (res.statusCode < 200 || res.statusCode >= 300) throw new SpokApiError(res.statusCode, res.body, path)
    return res.body ? res.json() : {}
  }
  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
    patch: (path, body) => call('PATCH', path, body),
    delete: (path) => call('DELETE', path),
  }
}
```

- [ ] **Step 5: `apps/api/src/routes/mcp.ts`**

```ts
/*
 * POST /mcp — serveur MCP distant (Streamable HTTP, mode sans état : un McpServer + transport par requête).
 * Authentification : jeton personnel uniquement (un JWT de session web → 403). Profil d'outils selon la
 * portée du jeton : write → 'public', read → 'public-read'. Les outils appellent les routes REST via
 * createInjectClient avec le jeton de l'appelant ; les écritures sont tracées (runWithRequestContext → audit).
 * GET/DELETE /mcp → 405 (pas de flux SSE serveur ni de session en mode sans état).
 */
import { FastifyPluginAsync } from 'fastify'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createSpokMcpServer } from '@spok/mcp-core'
import { createInjectClient } from '../mcp/injectClient.js'
import { runWithRequestContext } from '../utils/requestContext.js'

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/mcp', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: (req: any) => req.personalToken?.id ?? req.ip } },
  }, async (request, reply) => {
    if (request.authVia !== 'pat' || !request.personalToken) {
      return reply.forbidden('Le MCP distant exige un jeton personnel (Profil → Accès Claude)')
    }
    const pat = request.personalToken
    const client = createInjectClient(fastify, request.headers.authorization!)
    const server = createSpokMcpServer({ client, profile: pat.scope === 'read' ? 'public-read' : 'public' })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })

    reply.hijack()
    reply.raw.on('close', () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
    await server.connect(transport)
    await runWithRequestContext({ via: 'mcp', tokenId: pat.id, tokenName: pat.name }, () =>
      transport.handleRequest(request.raw, reply.raw, request.body),
    )
  })

  const methodNotAllowed = async (_req: any, reply: any) =>
    reply.status(405).header('allow', 'POST').send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
  fastify.get('/mcp', methodNotAllowed)
  fastify.delete('/mcp', methodNotAllowed)
}
```

Note : en mode sans état, la requête `tools/list` sans `initialize` préalable est acceptée par le SDK (pas de validation de session quand `sessionIdGenerator` est `undefined`). Si le test `tools/list` échoue sur « Server not initialized », **stop** et le signaler — ne pas contourner à l'aveugle.

- [ ] **Step 6: `apps/api/src/index.ts`**
  - Imports : `import { mcpRoutes } from './routes/mcp.js';` et `import { isInternalRequest } from './mcp/internal.js';`
  - Rate-limit : `await app.register(rateLimit, { max: 100, timeWindow: '1 minute', allowList: (req) => isInternalRequest(req.headers as Record<string, unknown>) });`
  - Après `await app.register(urlMetaRoutes);` : `await app.register(mcpRoutes);`
  - `availableRoutes` du 404 : ajouter `'/mcp'`.
  - Commentaire de tête : ajouter ` * rate-limit : les sous-requêtes internes du MCP distant (x-spok-internal) en sont exemptées ; /mcp a sa propre limite (120/min/jeton).`

- [ ] **Step 7: Lancer le test**

Run: `pnpm --filter @spok/mcp-core build` puis `pnpm --filter @spok/api exec vitest run src/routes/mcp.test.ts`
Expected: PASS (6).

- [ ] **Step 8: Test de bout en bout local**
  1. `pnpm dev:start` (si non lancé).
  2. Dans le navigateur intégré, `http://localhost:3000`, se connecter avec le compte de test local, créer un jeton (Task 9 nécessaire — sinon créer la ligne via un script Prisma local dans le scratchpad avec `generatePersonalToken()`).
  3. `claude mcp add --transport http spok-local http://localhost:3001/mcp --header "Authorization: Bearer <jeton>"` dans un terminal séparé, puis dans une session Claude : demander « crée une tâche "Test MCP" en cours dans l'espace X ». Vérifier dans l'UI : statut `in_progress`, description HTML correcte ; dans `/admin/audit-logs` : `changes.source.via = mcp`.

---

### Task 9: UI « Accès Claude » dans le profil

**Files:**
- Create: `apps/web/src/components/PersonalTokensSection.tsx`
- Modify: `apps/web/src/lib/api.ts` (après `userApi`, ~l.480), `apps/web/src/components/UserProfileModal.tsx`
- Modify: `apps/web/src/lib/businessRules.ts` (règle de page)

**Interfaces:**
- Consumes: routes `/user/tokens` (Task 3).
- Produces: `personalTokensApi.list() / create(input) / revoke(id)` ; `PersonalTokensSection` (sans props).

- [ ] **Step 1: `apps/web/src/lib/api.ts`** — ajouter :
```ts
export interface PersonalToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: 'read' | 'write';
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Jetons personnels (MCP distant). Le jeton en clair n'est présent que dans la réponse de create. */
export const personalTokensApi = {
  list: () => fetchApi<PersonalToken[]>('/user/tokens'),
  create: (data: { name: string; scope: 'read' | 'write'; expiresInDays: 30 | 90 | 365 | null }) =>
    fetchApi<PersonalToken & { token: string }>('/user/tokens', { method: 'POST', body: JSON.stringify(data) }),
  revoke: (id: string) => fetchApi<void>(`/user/tokens/${id}`, { method: 'DELETE' }),
};
```
Vérifier que `fetchApi` gère une réponse 204 sans corps (lire `apps/web/src/lib/api.ts:199-280`) ; si elle appelle `res.json()` inconditionnellement → le signaler, ne pas modifier `fetchApi` sans accord (zone Auth/Token fragile).

- [ ] **Step 2: `apps/web/src/components/PersonalTokensSection.tsx`**

```tsx
/*
 * Section « Accès Claude (MCP) » de la modale profil : création, liste et révocation des jetons personnels
 * permettant à un Claude externe d'accéder à SPOK via https://api.spok.space/mcp. Le jeton en clair n'est
 * affiché qu'une fois, juste après création, avec la commande de connexion prête à copier.
 * Aucune prop : agit sur l'utilisateur connecté. Ne jamais stocker le jeton en clair (ni store, ni localStorage).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Copy, Check, Trash2 } from 'lucide-react';
import { personalTokensApi, type PersonalToken } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

const MCP_URL = `${(import.meta.env.VITE_API_URL || 'https://api.spok.space').replace(/\/$/, '')}/mcp`;

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
}

export function PersonalTokensSection() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('write');
  const [expires, setExpires] = useState<'30' | '90' | '365' | 'never'>('90');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokens = [] } = useQuery({ queryKey: ['personal-tokens'], queryFn: personalTokensApi.list });

  const createMut = useMutation({
    mutationFn: () => personalTokensApi.create({
      name: name.trim(), scope, expiresInDays: expires === 'never' ? null : (Number(expires) as 30 | 90 | 365),
    }),
    onSuccess: (res) => {
      setCreated(res.token);
      setName('');
      qc.invalidateQueries({ queryKey: ['personal-tokens'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => personalTokensApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tokens'] }),
  });

  const command = created ? `claude mcp add --transport http spok ${MCP_URL} --header "Authorization: Bearer ${created}"` : '';

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = tokens.filter((t: PersonalToken) => !t.revokedAt);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium"><KeyRound className="w-4 h-4" /> Accès Claude (MCP)</h3>
      <p className="text-xs text-muted-foreground">
        Un jeton permet à votre Claude de lire et d'écrire dans SPOK avec vos droits. Ne le partagez pas.
      </p>

      {created && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-xs font-medium">Copiez cette commande maintenant : le jeton ne sera plus affiché.</p>
          <code className="block text-xs break-all">{command}</code>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copier</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>J'ai copié</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Claude portable)" maxLength={60} className="flex-1 min-w-[10rem]" />
        <Select value={scope} onChange={(e) => setScope(e.target.value as 'read' | 'write')}>
          <option value="write">Lecture et écriture</option>
          <option value="read">Lecture seule</option>
        </Select>
        <Select value={expires} onChange={(e) => setExpires(e.target.value as typeof expires)}>
          <option value="30">30 jours</option>
          <option value="90">90 jours</option>
          <option value="365">1 an</option>
          <option value="never">Sans expiration</option>
        </Select>
        <Button size="sm" disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Créer un jeton</Button>
      </div>

      {active.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {active.map((t: PersonalToken) => (
            <li key={t.id} className="flex items-center justify-between py-2 gap-2">
              <div className="min-w-0">
                <div className="truncate">{t.name} <span className="text-xs text-muted-foreground">({t.scope === 'read' ? 'lecture' : 'lecture/écriture'})</span></div>
                <div className="text-xs text-muted-foreground">{t.tokenPrefix}… · utilisé le {formatDate(t.lastUsedAt)} · expire {formatDate(t.expiresAt)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(t.id)} aria-label={`Révoquer ${t.name}`}><Trash2 className="w-4 h-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```
Avant d'écrire : vérifier les props réelles de `Button` (`size`, `variant`), `Input` et `Select` dans `apps/web/src/components/ui/` et adapter les noms de props (ne pas inventer de variantes).

- [ ] **Step 3: `UserProfileModal.tsx`** — importer `PersonalTokensSection` et l'insérer comme section après le bloc changement de mot de passe, uniquement quand la modale affiche le profil de l'utilisateur connecté (`!targetUserId`). Ajouter au commentaire de tête : « , jetons d'accès Claude (PersonalTokensSection, profil propre uniquement) ».

- [ ] **Step 4: `businessRules.ts`** — ajouter dans `PAGE_BUSINESS_RULES` :
```ts
  {
    id: 'personal-token-shown-once',
    page: 'Profil utilisateur',
    trigger: "Création d'un jeton d'accès Claude",
    effect: 'Le jeton en clair est affiché une seule fois ; seule sa forme hachée est stockée. Révocation immédiate, sans suppression.',
    location: 'apps/web/src/components/PersonalTokensSection.tsx, apps/api/src/routes/personal-tokens.ts',
  },
```

- [ ] **Step 5: Vérifier dans le navigateur intégré** (skill `testing-protocol` d'abord) : ouvrir le profil, créer un jeton lecture seule → la commande s'affiche ; « J'ai copié » → masquée ; la ligne apparaît avec le préfixe ; révoquer → disparaît. `read_console_messages` sans erreur. Puis `pnpm --filter @spok/web typecheck`.

---

### Task 10: Build Docker, vérification finale, documentation

**Files:**
- Modify: `docker/Dockerfile.api`
- Modify: `docs/session-journal.md`

- [ ] **Step 1: `docker/Dockerfile.api`**
  - Étape builder, après `COPY packages/shared/package.json ./packages/shared/` : `COPY packages/mcp-core/package.json ./packages/mcp-core/`
  - Après `COPY packages/shared ./packages/shared` : `COPY packages/mcp-core ./packages/mcp-core`
  - Après `RUN pnpm --filter @spok/database build` : `RUN pnpm --filter @spok/mcp-core build`
  - Étape runner, après les deux `COPY` de `packages/shared` :
    ```dockerfile
    COPY --from=builder /app/packages/mcp-core/package.json ./packages/mcp-core/
    COPY --from=builder /app/packages/mcp-core/dist ./packages/mcp-core/dist
    COPY --from=builder /app/packages/mcp-core/node_modules ./packages/mcp-core/node_modules
    ```
  - Ajouter un commentaire en tête du Dockerfile : `# @spok/mcp-core : outils MCP partagés, requis par la route /mcp de l'API.`

- [ ] **Step 2: Build Docker local**

Run: `docker build -f docker/Dockerfile.api -t spok-api-mcp-test .`
Expected: build OK. (Ne pas lancer le conteneur sur un port partagé ; supprimer l'image de test après : `docker rmi spok-api-mcp-test`.)

- [ ] **Step 3: Vérification lourde unique**

Run: `pnpm typecheck` puis `pnpm --filter @spok/api exec vitest run` puis `pnpm --filter @spok/mcp-core test`
Expected: tout vert. Tout échec → stop, rapporter la sortie.

- [ ] **Step 4: Documentation**
  - `docs/session-journal.md` : une ligne par tâche terminée dans la section EN COURS.
  - Doc SPOK : créer/mettre à jour l'item de doc « MCP distant » (skill `spok-doc` pour trouver l'espace), status `to_validate`, avec : URL, création du jeton, portées, liste des outils publics, règles de conformité.
  - Signaler à Thomas : redémarrer Claude pour recharger le MCP local (nouveau `dist/`).

- [ ] **Step 5: Rendre la main** — résumé court des écarts éventuels au plan ; **pas de commit** (attendre « commit et push »). Rappel pour le push : `docs/TODO.md` à mettre à jour avec le hash.

---

## Hors périmètre (étape 2, conçue séparément)

- OAuth 2.1 (découverte, enregistrement dynamique des clients, PKCE, écran de consentement) pour claude.ai et Claude Desktop.
- Outils de tags sur items (`tagIds`) et d'assignation — non demandés.
