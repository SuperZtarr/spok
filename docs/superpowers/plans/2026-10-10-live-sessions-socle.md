# Séances de présentation en direct — Étape 1 « Socle » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (exécution inline, défaut de Thomas) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un propriétaire de communauté ouvre une séance (sous-espace daté d'un espace de communauté) ; les présentateurs affichent des items venant de n'importe lequel de leurs espaces ; chaque item affiché est copié et verrouillé dans l'espace de séance ; les participants (membres de l'espace parent) suivent en direct dans une fenêtre flottante et réorganisent/commentent librement l'espace de séance.

**Architecture:** 3 tables Prisma (`LiveSession`, `LiveSessionRole`, `LiveSessionEntry`) + 3 champs sur `Item` (`lockedAt`, `sourceItemId`, `sourceSpaceId`). Diffusion par SSE (`GET /live-sessions/:id/stream`) branchée sur un hub en mémoire (`utils/liveHub.ts`, une seule instance API sur Railway) ; toutes les écritures passent par des routes REST classiques. Le verrou est appliqué côté API par un helper unique (`utils/itemLock.ts`) appelé dans chaque route d'écriture d'items. Côté web : un client SSE basé sur `fetch` (pour envoyer le header `Authorization` et réutiliser le refresh token), un hook `useLiveSession`, et des composants `components/live/*` montés par `SpacePage` via portail — aucune modification de `Layout.tsx`.

**Tech Stack:** Fastify 4, Prisma (prod : `prisma db push` au démarrage), `@aws-sdk/client-s3` (R2), React 18, TanStack Query, Tailwind. Tests Vitest (`npx vitest run <fichier>` depuis la racine), `createMockPrisma` côté API, Testing Library côté web.

**Spec:** pas de fichier spec (préférence Thomas) — conception validée en conversation le 2026-10-10, résumée dans « Décisions de conception » ci-dessous.

## Décisions de conception (source de vérité de ce plan)

1. Une séance = un **espace dédié**, sous-espace d'un espace de communauté, nommé par défaut par la date (`YYYY-MM-DD`), visibilité `PRIVATE`.
2. **Création** : uniquement un `OWNER` de la communauté de l'espace parent. Pas de séance hors communauté.
3. **Accès** : uniquement les membres (rôle effectif `OWNER` ou `MEMBER` via `checkSpaceAccess`) de l'espace parent. Rejoindre = devenir `MEMBER` de l'espace de séance (accès conservé après la séance).
4. **Rôles** : `HOST` (créateur, `OWNER` de l'espace de séance), `PRESENTER` (désignés par le host parmi les membres de l'espace parent), participants (tous les autres membres).
5. **Affichage libre** : tout présentateur/host affiche à tout moment, le dernier l'emporte, « présenté par … » affiché. Champ `controllerId` présent mais toujours `null` (passage de main = plus tard).
6. **Copie à l'affichage** : l'item source + ses sous-items directs sont copiés dans l'espace de séance avec `lockedAt`, `sourceItemId`, `sourceSpaceId` ; images R2 (`item.url` et `<img src>` de la description) dupliquées. Droits vérifiés avec ceux du présentateur sur l'espace source. Réaffichage : si la source n'a pas changé depuis la dernière copie (`source.updatedAt <= copie.lockedAt`), on réaffiche la copie existante ; sinon nouvelle copie.
7. **Verrou** (API) : sur un item `lockedAt != null`, seuls `parentId` et `tagIds` sont modifiables (par tout membre) ; déplacement/réordonnancement et relations libres ; commentaires libres ; suppression réservée à l'`OWNER` de l'espace ; split/upload/convert/merge/décalage de dates/déplacement vers un autre espace refusés.
8. **Journal** : `LiveSessionEntry` (`DISPLAY` / `JOIN`), indépendant de l'organisation de l'espace ; fil chronologique consultable.
9. **Vue participant** : espace de séance en fond + fenêtre « en direct » flottante (déplaçable, redimensionnable, réductible, plein écran, position mémorisée). Desktop uniquement.
10. **Hors étape 1** : programme préparé, compte-rendu, tri « présenté le » dans les vues (étape 2) ; invités, votes, réactions, questions, mobile, passage de main.

## Global Constraints

- Commentaire d'en-tête `/* ... */` sur **chaque** fichier créé ou modifié (raison d'être, params clés, règles d'usage) — non négociable (CLAUDE.md).
- **Jamais de commit/push sans demande explicite de Thomas.** Les étapes « Commit » ne s'exécutent que si Thomas a dit « commit » ; sinon on les saute et on continue.
- Jamais `git add -A` : toujours lister les fichiers.
- Après toute modification de `packages/*` : `pnpm db:generate` (si schéma) puis `pnpm build:packages`, puis redémarrer le dev.
- Schéma : `pnpm db:push` en local (pas de migration — la prod fait `prisma db push` au démarrage). Uniquement des ajouts (colonnes nullables, nouvelles tables) : aucune perte de données.
- Tests pendant le dev : uniquement le fichier de test de la tâche (`npx vitest run <fichier>`) + typecheck du seul paquet touché (`pnpm --filter @spok/api typecheck` ou `pnpm --filter @spok/web typecheck`). Suite complète + typecheck 5 paquets : une seule fois, au moment du déploiement.
- Zones fragiles : ne pas toucher `Layout.tsx` / `GlobalNavBar.tsx` ; `lib/api.ts` : uniquement **ajouter** des exports, ne rien changer à `fetchApi`/refresh. Lire le skill `spok-menu` avant de toucher `SpaceToolbar.tsx`.
- Nouveaux modèles Prisma → les ajouter à `createMockPrisma()` (`apps/api/src/test/helpers.ts`), sinon 500 en test.
- Textes UI en français.
- Ne jamais appeler `api.spok.space`.

## Review Focus

1. **Participant non membre de l'espace source** : il ne doit jamais pouvoir lire l'item source — il ne reçoit que la copie. Test : `GET /spaces/:sourceSpaceId/items/:id` reste 404 pour lui (couvert par `checkSpaceAccess` existant) ; le test Task 5 vérifie que `display` refuse un présentateur sans accès à la source (404).
2. **Contournement du verrou par un champ inattendu** (`propagateToChildren` d'un parent non verrouillé vers des enfants verrouillés, PATCH avec `status` seul, MCP) : le statut d'une copie ne doit jamais changer. Tests Task 2 (`propagation ignore les enfants verrouillés`, `PATCH status sur item verrouillé → 403`).
3. **Coupure réseau / mise en veille du portable** : la fenêtre en direct doit se reconnecter seule et resynchroniser l'item courant. Test Task 6 (`reconnecte après fermeture du flux`) + resynchro par `refetch` de l'état complet à chaque (re)connexion.
4. **Deux présentateurs affichent presque en même temps** : tous les participants doivent converger vers le même dernier affichage. Test Task 5 (`currentEntryId = dernier display`) ; l'événement porte l'`entryId`, le client ignore un événement plus ancien que l'état courant (Task 6, `ignore un display plus ancien`).
5. **Séance terminée** : plus aucun affichage possible, la fenêtre en direct indique « Séance terminée ». Test Task 5 (`display sur séance ENDED → 409`).

---

## File Structure

**API (`apps/api/src/`)**
- `utils/itemLock.ts` — règles du verrou (pur, testable).
- `utils/liveHub.ts` — registre en mémoire des abonnés SSE par séance + présence (pur, testable).
- `utils/sessionCopy.ts` — copie verrouillée d'un item + enfants directs vers l'espace de séance (tags, images R2).
- `utils/r2.ts` — ajout `copyR2Object`, `isR2Url`.
- `routes/live-sessions.ts` — toutes les routes `/live-sessions`.
- `routes/items.ts`, `item-uploads.ts`, `item-convert.ts`, `item-merge.ts`, `item-cascade-shift.ts`, `item-move.ts` — appels au verrou.
- `index.ts` — enregistrement `/live-sessions`.
- `test/helpers.ts` — mocks des 3 nouveaux modèles.

**Shared / DB**
- `packages/database/prisma/schema.prisma` — 3 modèles, 3 enums, 3 champs Item.
- `packages/shared/src/types/liveSession.ts` (+ export dans `types/index.ts`), `types/item.ts` (3 champs).

**Web (`apps/web/src/`)**
- `lib/api.ts` — ajout `liveSessionsApi` + export `getValidAccessToken`.
- `lib/liveStream.ts` — client SSE `fetch` + parseur (pur, testable).
- `hooks/useLiveSession.ts` — état séance + abonnement flux + mutations.
- `components/live/LiveWindow.tsx` — fenêtre flottante.
- `components/live/liveWindowGeometry.ts` — calcul/persistance position-taille (pur, testable).
- `components/live/LiveSessionBar.tsx` — bandeau de séance (présence, fil, panneau présentateur, terminer).
- `components/live/SessionTimeline.tsx` — fil chronologique.
- `components/live/PresenterPanel.tsx` — recherche transversale + afficher.
- `components/live/ParentSessionsButton.tsx` — dans l'espace parent : liste des séances, rejoindre, créer.
- `pages/SpacePage.tsx` — montage des composants live + `canEditItem` tient compte du verrou.
- `components/ItemEditModal.tsx` — lecture seule si verrouillé (sauf tags, commentaires), bandeau « Copie de séance ».

---

### Task 1: Schéma Prisma + types partagés

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (model `Item`, `Space`, `User` + fin de fichier)
- Create: `packages/shared/src/types/liveSession.ts`
- Modify: `packages/shared/src/types/index.ts`, `packages/shared/src/types/item.ts:8-36`
- Modify: `apps/api/src/test/helpers.ts` (`createMockPrisma`)

**Interfaces:**
- Produces: modèles Prisma `liveSession`, `liveSessionRole`, `liveSessionEntry` ; champs `Item.lockedAt: DateTime?`, `Item.sourceItemId: String?`, `Item.sourceSpaceId: String?` ; types TS `LiveSession`, `LiveSessionRoleType`, `LiveSessionEntry`, `LiveSessionState`, `LiveEvent`.

- [ ] **Step 1: Ajouter les modèles en fin de `schema.prisma`**

```prisma
// Séance de présentation en direct — liée 1:1 à son espace dédié (sous-espace daté de parentSpaceId).
// controllerId : réservé au futur « passage de main » ; null = affichage libre (seul mode de l'étape 1).
model LiveSession {
  id             String            @id @default(cuid())
  spaceId        String            @unique
  parentSpaceId  String
  hostId         String
  status         LiveSessionStatus @default(LIVE)
  controllerId   String?
  currentEntryId String?
  startedAt      DateTime          @default(now())
  endedAt        DateTime?

  space       Space              @relation("LiveSessionSpace", fields: [spaceId], references: [id], onDelete: Cascade)
  parentSpace Space              @relation("LiveSessionParent", fields: [parentSpaceId], references: [id], onDelete: Cascade)
  host        User               @relation("LiveSessionHost", fields: [hostId], references: [id], onDelete: Cascade)
  roles       LiveSessionRole[]
  entries     LiveSessionEntry[]

  @@index([parentSpaceId])
  @@map("live_sessions")
}

enum LiveSessionStatus {
  LIVE
  ENDED
}

// Rôle explicite dans une séance. Les participants n'ont pas de ligne (membres de l'espace de séance).
model LiveSessionRole {
  id        String              @id @default(cuid())
  sessionId String
  userId    String
  role      LiveSessionRoleType

  session LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User        @relation("LiveSessionRoles", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sessionId, userId])
  @@map("live_session_roles")
}

enum LiveSessionRoleType {
  HOST
  PRESENTER
}

// Journal de séance : chronologie indépendante de l'organisation de l'espace (jamais réécrit).
// itemTitle : titre figé à l'affichage, survit à la suppression de la copie (itemId → null).
model LiveSessionEntry {
  id        String               @id @default(cuid())
  sessionId String
  kind      LiveSessionEntryKind
  userId    String
  itemId    String?
  itemTitle String?
  createdAt DateTime             @default(now())

  session LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User        @relation("LiveSessionEntries", fields: [userId], references: [id], onDelete: Cascade)
  item    Item?       @relation(fields: [itemId], references: [id], onDelete: SetNull)

  @@index([sessionId, createdAt])
  @@map("live_session_entries")
}

enum LiveSessionEntryKind {
  DISPLAY
  JOIN
}
```

- [ ] **Step 2: Champs et relations inverses**

Dans `model Item`, après `horizonSetAt` :
```prisma
  // Copie de séance : lockedAt non null = contenu verrouillé (cf. apps/api/src/utils/itemLock.ts).
  // sourceItemId/sourceSpaceId : simple trace d'origine, pas de FK (la source peut disparaître).
  lockedAt      DateTime?
  sourceItemId  String?
  sourceSpaceId String?
```
et avec les autres relations de `Item` : `liveSessionEntries LiveSessionEntry[]`, et dans les index de `Item` : `@@index([sourceItemId])`.

Dans `model Space` (relations) :
```prisma
  liveSession        LiveSession?  @relation("LiveSessionSpace")
  childLiveSessions  LiveSession[] @relation("LiveSessionParent")
```
Dans `model User` (relations) :
```prisma
  hostedLiveSessions LiveSession[]      @relation("LiveSessionHost")
  liveSessionRoles   LiveSessionRole[]  @relation("LiveSessionRoles")
  liveSessionEntries LiveSessionEntry[] @relation("LiveSessionEntries")
```

- [ ] **Step 3: Types partagés** — créer `packages/shared/src/types/liveSession.ts`

```ts
/*
 * Types des séances de présentation en direct (étape 1 « Socle »).
 * LiveEvent = messages SSE de GET /live-sessions/:id/stream — le client les applique sur LiveSessionState.
 * Ne pas y mettre de données d'espaces sources : un participant ne reçoit que des copies de l'espace de séance.
 */
import type { Item } from './item';

export type LiveSessionStatus = 'LIVE' | 'ENDED';
export type LiveSessionRoleType = 'HOST' | 'PRESENTER';
export type LiveSessionEntryKind = 'DISPLAY' | 'JOIN';

export interface LiveUser { id: string; name: string; avatarUrl?: string | null }

export interface LiveSessionEntry {
  id: string;
  kind: LiveSessionEntryKind;
  createdAt: string;
  user: LiveUser;
  itemId: string | null;
  itemTitle: string | null;
}

export interface LiveSession {
  id: string;
  spaceId: string;
  parentSpaceId: string;
  hostId: string;
  status: LiveSessionStatus;
  controllerId: string | null;
  currentEntryId: string | null;
  startedAt: string;
  endedAt: string | null;
}

/** Item affiché dans la fenêtre en direct : la copie + ses enfants directs copiés. */
export interface LiveDisplayedItem { item: Item; children: Item[] }

export interface LiveSessionState {
  session: LiveSession;
  spaceName: string;
  roles: Array<{ userId: string; role: LiveSessionRoleType; user: LiveUser }>;
  myRole: LiveSessionRoleType | 'PARTICIPANT';
  entries: LiveSessionEntry[];          // chronologique ascendant
  current: (LiveDisplayedItem & { entry: LiveSessionEntry }) | null;
  presence: LiveUser[];
}

export type LiveEvent =
  | { type: 'display'; entry: LiveSessionEntry; displayed: LiveDisplayedItem }
  | { type: 'join'; entry: LiveSessionEntry }
  | { type: 'presence'; presence: LiveUser[] }
  | { type: 'roles'; roles: LiveSessionState['roles'] }
  | { type: 'ended'; endedAt: string };

/** Résumé d'une séance pour la liste de l'espace parent. */
export interface LiveSessionSummary {
  id: string;
  spaceId: string;
  spaceName: string;
  status: LiveSessionStatus;
  startedAt: string;
  isMember: boolean;
}
```

Dans `packages/shared/src/types/index.ts`, ajouter `export * from './liveSession';` (même style que les autres lignes). Dans `types/item.ts`, interface `Item`, après `viewedAt` :
```ts
  /** Copie de séance verrouillée (contenu non modifiable) — cf. apps/api/src/utils/itemLock.ts */
  lockedAt?: string | null;
  sourceItemId?: string | null;
  sourceSpaceId?: string | null;
```
Mettre à jour le commentaire d'en-tête de `item.ts` (une ligne : champs de copie de séance).

- [ ] **Step 4: Mocks de test** — dans `createMockPrisma()` de `apps/api/src/test/helpers.ts`, après `itemTemplate: mockModel(),` :
```ts
    liveSession: mockModel(),
    liveSessionRole: mockModel(),
    liveSessionEntry: mockModel(),
```

- [ ] **Step 5: Appliquer**

Run (racine) : `pnpm db:push && pnpm db:generate && pnpm build:packages`
Expected : « Your database is now in sync », build OK. Puis `npx vitest run apps/api/src/test/smoke.test.ts` → PASS.

- [ ] **Step 6: Commit** (seulement si Thomas l'a demandé)
```bash
git add packages/database/prisma/schema.prisma packages/shared/src/types/liveSession.ts packages/shared/src/types/index.ts packages/shared/src/types/item.ts apps/api/src/test/helpers.ts
git commit -m "feat: schéma séances live (LiveSession, rôles, journal, verrou item)"
```

---

### Task 2: Verrou des copies de séance (API)

**Files:**
- Create: `apps/api/src/utils/itemLock.ts`, `apps/api/src/utils/itemLock.test.ts`
- Modify: `apps/api/src/routes/items.ts` (PATCH `/:id` ~l.487, propagation ~l.612, split ~l.664, DELETE ~l.750)
- Modify: `apps/api/src/routes/item-uploads.ts` (image + document), `item-convert.ts`, `item-merge.ts` (2 routes), `item-cascade-shift.ts`, `item-move.ts` (move vers autre espace ~l.206)
- Test: `apps/api/src/routes/items.test.ts` (nouveau `describe('verrou de séance')`)

**Interfaces:**
- Produces: `isLocked(item): boolean`, `lockedFieldViolations(body): string[]`, `LOCKED_MESSAGE: string`.

- [ ] **Step 1: Test unitaire du helper** — `apps/api/src/utils/itemLock.test.ts`

```ts
/* Tests des règles de verrou des copies de séance (itemLock). */
import { describe, it, expect } from 'vitest'
import { isLocked, lockedFieldViolations } from './itemLock.js'

describe('itemLock', () => {
  it('isLocked suit lockedAt', () => {
    expect(isLocked({ lockedAt: new Date() })).toBe(true)
    expect(isLocked({ lockedAt: null })).toBe(false)
    expect(isLocked(null)).toBe(false)
  })
  it('autorise seulement parentId, tagIds, updatedAt', () => {
    expect(lockedFieldViolations({ parentId: 'p', tagIds: [], updatedAt: '2026-10-10T00:00:00.000Z' })).toEqual([])
    expect(lockedFieldViolations({ status: 'done' })).toEqual(['status'])
    expect(lockedFieldViolations({ title: 'x', parentId: null })).toEqual(['title'])
  })
  it('ignore les clés undefined', () => {
    expect(lockedFieldViolations({ title: undefined, tagIds: ['t'] })).toEqual([])
  })
})
```

- [ ] **Step 2:** Run `npx vitest run apps/api/src/utils/itemLock.test.ts` → FAIL (module introuvable).

- [ ] **Step 3: Implémenter** `apps/api/src/utils/itemLock.ts`

```ts
/*
 * Verrou des copies de séance live : un item avec lockedAt est la trace fidèle de ce qui a été présenté.
 * Seule l'organisation reste libre (parentId, tagIds via PATCH ; move/reorder/relations/commentaires
 * dans leurs routes). Toute route qui écrit le contenu d'un item DOIT appeler isLocked() — y compris
 * les opérations indirectes (propagation de statut, décalage de dates, split, merge, convert, upload).
 */
export const LOCKED_EDITABLE_FIELDS = new Set(['parentId', 'tagIds', 'updatedAt'])

export const LOCKED_MESSAGE = 'Élément de séance verrouillé : son contenu ne peut pas être modifié'

export function isLocked(item: { lockedAt?: Date | string | null } | null | undefined): boolean {
  return !!item?.lockedAt
}

/** Champs du body interdits sur un item verrouillé (vide = modification autorisée). */
export function lockedFieldViolations(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((k) => body[k] !== undefined && !LOCKED_EDITABLE_FIELDS.has(k))
}
```

- [ ] **Step 4:** Run le même test → PASS.

- [ ] **Step 5: Tests de route** — ajouter à `apps/api/src/routes/items.test.ts` (réutiliser `buildItemsTestApp`, `getTestToken` déjà importés dans ce fichier) :

```ts
describe('verrou de séance', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  const token = () => getTestToken(app)
  const lockedItem = {
    id: 'copy-1', spaceId: 'sess-space', type: 'NOTE', title: 'Copie', status: 'todo',
    createdById: 'presenter-id', lockedAt: new Date('2026-10-10T10:00:00Z'), parentId: null,
    updatedAt: new Date('2026-10-10T10:00:00Z'), position: 0,
  }

  beforeEach(async () => {
    ({ app, prisma } = await buildItemsTestApp())
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: 'test-user-id', spaceId: 'sess-space', role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue(lockedItem)
  })

  it('PATCH status sur item verrouillé → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { status: 'done' } })
    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('PATCH parentId sur item verrouillé créé par un autre → autorisé pour un MEMBER', async () => {
    prisma.item.update.mockResolvedValue({ ...lockedItem, parentId: 'theme-1', tags: [] })
    const res = await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { parentId: 'theme-1' } })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE item verrouillé par un MEMBER (même auteur) → 403', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, createdById: 'test-user-id', tags: [] })
    const res = await app.inject({ method: 'DELETE', url: '/spaces/sess-space/items/copy-1',
      headers: { authorization: `Bearer ${token()}` } })
    expect(res.statusCode).toBe(403)
  })

  it('split sur item verrouillé → 403', async () => {
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, description: '<h2>A</h2>' })
    const res = await app.inject({ method: 'POST', url: '/spaces/sess-space/items/copy-1/split',
      headers: { authorization: `Bearer ${token()}` } })
    expect(res.statusCode).toBe(403)
  })

  it('propagation de statut ignore les enfants verrouillés', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: 'test-user-id', spaceId: 'sess-space', role: 'OWNER' })
    prisma.item.findFirst.mockResolvedValue({ ...lockedItem, id: 'theme-1', lockedAt: null })
    prisma.item.update.mockResolvedValue({ ...lockedItem, id: 'theme-1', lockedAt: null, tags: [] })
    await app.inject({ method: 'PATCH', url: '/spaces/sess-space/items/theme-1',
      headers: { authorization: `Bearer ${token()}` }, payload: { status: 'done', propagateToChildren: true } })
    const childQueries = prisma.item.findMany.mock.calls.map((c: any[]) => c[0]?.where).filter((w: any) => w?.parentId)
    expect(childQueries.length).toBeGreaterThan(0)
    for (const where of childQueries) expect(where.lockedAt).toBeNull()
  })
})
```
(Si le fichier n'importe pas encore `beforeEach`/`MockPrisma`/`FastifyInstance`, compléter les imports en tête.)

- [ ] **Step 6:** Run `npx vitest run apps/api/src/routes/items.test.ts` → les 5 nouveaux tests FAIL.

- [ ] **Step 7: Brancher le verrou dans `items.ts`**

Import en tête : `import { isLocked, lockedFieldViolations, LOCKED_MESSAGE } from '../utils/itemLock.js';` et ajouter au commentaire d'en-tête : « Verrou de séance : cf. utils/itemLock.ts (PATCH, DELETE, split, propagation). »

PATCH — remplacer le bloc
```ts
      if (membership.role === 'MEMBER' && existingItem.createdById !== request.user.userId) {
        return reply.forbidden('Members can only edit their own items');
      }
```
par
```ts
      // Copie de séance : seule l'organisation (parent, tags) est modifiable, par tout membre
      if (isLocked(existingItem)) {
        if (lockedFieldViolations(request.body as Record<string, unknown>).length > 0) {
          return reply.forbidden(LOCKED_MESSAGE);
        }
      } else if (membership.role === 'MEMBER' && existingItem.createdById !== request.user.userId) {
        return reply.forbidden('Members can only edit their own items');
      }
```
Propagation (`collectDescendantIds` du PATCH) : `where: { parentId, spaceId: request.params.spaceId, lockedAt: null },`.

Split : après `if (!item) return reply.notFound('Item not found');` ajouter `if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);`.

DELETE : après `if (!item) { return reply.notFound('Item not found'); }` ajouter
```ts
    // Copie de séance : seul le propriétaire de l'espace (animateur) peut la retirer
    if (isLocked(item) && membership.role !== 'OWNER') {
      return reply.forbidden(LOCKED_MESSAGE);
    }
```

- [ ] **Step 8: Brancher dans les autres routes** (même import ; une ligne d'en-tête « refusé sur copie de séance verrouillée (itemLock) » dans chaque fichier) :
  - `item-uploads.ts`, routes `/:id/image` et `/:id/document` : après `if (!item) { return reply.notFound('Item not found'); }` → `if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);`
  - `item-convert.ts` : même garde juste après le chargement de l'item converti.
  - `item-merge.ts` (2 routes) : après chargement des items concernés → `if (items.some(isLocked)) return reply.forbidden(LOCKED_MESSAGE);` (adapter au nom de variable local ; si l'item est chargé seul, `isLocked(item)`).
  - `item-cascade-shift.ts` : filtrer les items à décaler ; si l'item déclencheur est verrouillé → 403 ; ajouter `lockedAt: null` au `where` de la recherche des dépendants décalés.
  - `item-move.ts`, route déplacement vers un autre espace (celle qui teste `targetMembership`, ~l.161) : après le chargement de `items` → `if (items.some(isLocked)) return reply.forbidden(LOCKED_MESSAGE);`. La route `/:id/move` (réorganisation dans l'espace) reste **inchangée**.

- [ ] **Step 9:** Run `npx vitest run apps/api/src/routes/items.test.ts apps/api/src/utils/itemLock.test.ts` → PASS. Puis `pnpm --filter @spok/api typecheck` → 0 erreur.

- [ ] **Step 10: Commit** (si demandé) — `git add` des fichiers listés ci-dessus ; `git commit -m "feat: verrou API des copies de séance"`.

---

### Task 3: Hub temps réel en mémoire

**Files:**
- Create: `apps/api/src/utils/liveHub.ts`, `apps/api/src/utils/liveHub.test.ts`

**Interfaces:**
- Produces: `class LiveHub { subscribe(sessionId: string, user: LiveUser, send: (event: LiveEvent) => void): () => void; broadcast(sessionId: string, event: LiveEvent): void; presence(sessionId: string): LiveUser[] }` et singleton `export const liveHub = new LiveHub()`.

- [ ] **Step 1: Test** — `apps/api/src/utils/liveHub.test.ts`

```ts
/* Tests du hub SSE en mémoire : diffusion par séance, présence dédoublonnée, désabonnement. */
import { describe, it, expect, vi } from 'vitest'
import { LiveHub } from './liveHub.js'

const alice = { id: 'a', name: 'Alice' }
const bob = { id: 'b', name: 'Bob' }

describe('LiveHub', () => {
  it('diffuse uniquement aux abonnés de la séance', () => {
    const hub = new LiveHub()
    const s1 = vi.fn(); const s2 = vi.fn()
    hub.subscribe('S1', alice, s1)
    hub.subscribe('S2', bob, s2)
    hub.broadcast('S1', { type: 'ended', endedAt: 'x' })
    expect(s1).toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
    expect(s2).not.toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
  })

  it('présence dédoublonnée (deux onglets = une personne) et diffusée', () => {
    const hub = new LiveHub()
    const s = vi.fn()
    hub.subscribe('S1', alice, s)
    const off = hub.subscribe('S1', alice, vi.fn())
    hub.subscribe('S1', bob, vi.fn())
    expect(hub.presence('S1').map(u => u.id).sort()).toEqual(['a', 'b'])
    off()
    expect(hub.presence('S1').map(u => u.id).sort()).toEqual(['a', 'b'])
    expect(s).toHaveBeenCalledWith({ type: 'presence', presence: expect.any(Array) })
  })

  it('un abonné qui lève une erreur ne bloque pas les autres et est retiré', () => {
    const hub = new LiveHub()
    const bad = vi.fn(() => { throw new Error('socket closed') })
    const good = vi.fn()
    hub.subscribe('S1', alice, bad)
    hub.subscribe('S1', bob, good)
    hub.broadcast('S1', { type: 'ended', endedAt: 'x' })
    expect(good).toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
    expect(hub.presence('S1').map(u => u.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 2:** Run `npx vitest run apps/api/src/utils/liveHub.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** `apps/api/src/utils/liveHub.ts`

```ts
/*
 * Hub temps réel des séances live : abonnés SSE par séance, diffusion d'événements, présence.
 * En mémoire = valable pour UNE instance d'API (cas Railway actuel). Si l'API passe à plusieurs
 * instances, remplacer broadcast() par un relais PostgreSQL LISTEN/NOTIFY — l'interface ne change pas.
 * Les abonnés qui lèvent une erreur (socket fermée) sont retirés silencieusement.
 */
import type { LiveEvent, LiveUser } from '@spok/shared';

interface Subscriber { user: LiveUser; send: (event: LiveEvent) => void }

export class LiveHub {
  private sessions = new Map<string, Set<Subscriber>>();

  subscribe(sessionId: string, user: LiveUser, send: (event: LiveEvent) => void): () => void {
    const sub: Subscriber = { user, send };
    let set = this.sessions.get(sessionId);
    if (!set) { set = new Set(); this.sessions.set(sessionId, set); }
    set.add(sub);
    this.broadcastPresence(sessionId);
    return () => {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.delete(sub);
      if (current.size === 0) this.sessions.delete(sessionId);
      else this.broadcastPresence(sessionId);
    };
  }

  broadcast(sessionId: string, event: LiveEvent): void {
    const set = this.sessions.get(sessionId);
    if (!set) return;
    const dead: Subscriber[] = [];
    for (const sub of set) {
      try { sub.send(event); } catch { dead.push(sub); }
    }
    if (dead.length > 0) {
      for (const sub of dead) set.delete(sub);
      if (set.size === 0) this.sessions.delete(sessionId);
      else this.broadcastPresence(sessionId);
    }
  }

  presence(sessionId: string): LiveUser[] {
    const set = this.sessions.get(sessionId);
    if (!set) return [];
    const byId = new Map<string, LiveUser>();
    for (const sub of set) byId.set(sub.user.id, sub.user);
    return [...byId.values()];
  }

  private broadcastPresence(sessionId: string): void {
    this.broadcast(sessionId, { type: 'presence', presence: this.presence(sessionId) });
  }
}

export const liveHub = new LiveHub();
```

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** (si demandé) — `git commit -m "feat: hub temps réel des séances live"`.

---

### Task 4: Copie verrouillée vers l'espace de séance (+ images R2)

**Files:**
- Modify: `apps/api/src/utils/r2.ts` (ajout `isR2Url`, `copyR2Object`)
- Create: `apps/api/src/utils/sessionCopy.ts`, `apps/api/src/utils/sessionCopy.test.ts`

**Interfaces:**
- Consumes: `isR2Configured()` de `r2.ts`.
- Produces: `copyItemToSession(prisma, { sourceItemId: string; sourceSpaceId: string; sessionSpaceId: string; userId: string }): Promise<{ item: Item; children: Item[]; reused: boolean }>` (items Prisma avec `tags` aplatis).

- [ ] **Step 1: Ajouts R2** dans `apps/api/src/utils/r2.ts` (import `CopyObjectCommand` dans la ligne d'import existante ; en-tête : « copyR2Object : duplique un objet pour les copies de séance — la copie ne doit jamais partager le fichier de la source »)

```ts
export function isR2Url(url: string | null | undefined): url is string {
  return !!url && !!R2_PUBLIC_URL && url.startsWith(`${R2_PUBLIC_URL}/`);
}

/** Duplique un objet R2 sous items/<newItemId>/… et retourne sa nouvelle URL publique. */
export async function copyR2Object(url: string, newItemId: string): Promise<string> {
  const key = url.slice(R2_PUBLIC_URL!.length + 1).split('?')[0];
  const fileName = key.split('/').pop()!;
  const newKey = `items/${newItemId}/${Date.now()}-${fileName}`;
  await getS3Client().send(new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    CopySource: `${R2_BUCKET_NAME}/${key}`,
    Key: newKey,
  }));
  return `${R2_PUBLIC_URL}/${newKey}`;
}
```

- [ ] **Step 2: Test** — `apps/api/src/utils/sessionCopy.test.ts`

```ts
/* Tests de copyItemToSession : copie verrouillée + enfants directs, réutilisation si source inchangée, images. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'

vi.mock('./r2.js', () => ({
  isR2Configured: () => true,
  isR2Url: (u: string | null) => !!u && u.startsWith('https://cdn.test/'),
  copyR2Object: vi.fn(async (url: string, id: string) => `https://cdn.test/items/${id}/copy.webp`),
}))

import { copyItemToSession } from './sessionCopy.js'

const source = {
  id: 'src-1', spaceId: 'src-space', type: 'NOTE', title: 'Budget', status: 'todo', priority: null,
  description: '<p>x</p><img src="https://cdn.test/items/src-1/a.webp">', content: null,
  url: 'https://cdn.test/items/src-1/main.webp', dueDate: null, startDate: null, endDate: null,
  position: 3, updatedAt: new Date('2026-10-10T09:00:00Z'), tags: [],
}

describe('copyItemToSession', () => {
  let prisma: MockPrisma
  beforeEach(() => {
    prisma = createMockPrisma()
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'src-1' ? source : null)
    prisma.item.findMany.mockImplementation(async ({ where }: any) =>
      where.parentId === 'src-1' ? [{ ...source, id: 'child-1', title: 'Ligne', url: null, description: null, position: 0 }] : [])
    let n = 0
    prisma.item.create.mockImplementation(async ({ data }: any) => ({ id: `copy-${++n}`, ...data, tags: [] }))
    prisma.item.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data, tags: [] }))
  })

  it('copie la source et ses enfants directs, verrouillés, avec trace d\'origine', async () => {
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(false)
    const created = prisma.item.create.mock.calls.map((c: any[]) => c[0].data)
    expect(created).toHaveLength(2)
    for (const d of created) {
      expect(d.spaceId).toBe('sess')
      expect(d.lockedAt).toBeInstanceOf(Date)
      expect(d.sourceSpaceId).toBe('src-space')
    }
    expect(created[0].sourceItemId).toBe('src-1')
    expect(created[1].parentId).toBe(res.item.id)
  })

  it('duplique les images R2 (url + description)', async () => {
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.item.url).toMatch(/^https:\/\/cdn\.test\/items\/copy-1\//)
    expect(res.item.description).not.toContain('items/src-1/')
  })

  it('réutilise la dernière copie si la source n\'a pas changé', async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.sourceItemId === 'src-1') return { id: 'copy-old', lockedAt: new Date('2026-10-10T09:30:00Z'), tags: [] }
      return where.id === 'src-1' ? source : null
    })
    prisma.item.findMany.mockResolvedValue([])
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'src-1', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(true)
    expect(res.item.id).toBe('copy-old')
    expect(prisma.item.create).not.toHaveBeenCalled()
  })

  it('source introuvable → erreur NOT_FOUND', async () => {
    await expect(copyItemToSession(prisma as any, { sourceItemId: 'nope', sourceSpaceId: 'src-space', sessionSpaceId: 'sess', userId: 'u1' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 3:** Run `npx vitest run apps/api/src/utils/sessionCopy.test.ts` → FAIL.

- [ ] **Step 4: Implémenter** `apps/api/src/utils/sessionCopy.ts`

```ts
/*
 * Copie d'un item affiché en séance vers l'espace de séance : l'item + ses enfants DIRECTS, verrouillés
 * (lockedAt), avec trace d'origine (sourceItemId/sourceSpaceId), tags recréés par nom dans l'espace de
 * séance, images R2 dupliquées (une copie ne partage jamais un fichier de la source : supprimer l'un ne
 * casse pas l'autre). Réaffichage : si la source n'a pas changé depuis la dernière copie, on la réutilise.
 * L'appelant a déjà vérifié que l'utilisateur a accès à l'espace source.
 */
import { isR2Configured, isR2Url, copyR2Object } from './r2.js';

export class SessionCopyError extends Error {
  constructor(public code: 'NOT_FOUND', message: string) { super(message); }
}

interface CopyParams { sourceItemId: string; sourceSpaceId: string; sessionSpaceId: string; userId: string }

const R2_IMG_SRC = /(<img[^>]+src=")([^"]+)(")/g;

async function copyImages(item: { url: string | null; description: string | null }, newItemId: string) {
  if (!isR2Configured()) return { url: item.url, description: item.description };
  const url = isR2Url(item.url) ? await copyR2Object(item.url, newItemId) : item.url;
  let description = item.description;
  if (description) {
    const sources = [...description.matchAll(R2_IMG_SRC)].map((m) => m[2]).filter((s) => isR2Url(s));
    for (const src of new Set(sources)) {
      description = description.split(src).join(await copyR2Object(src, newItemId));
    }
  }
  return { url, description };
}

async function sessionTagIds(prisma: any, sessionSpaceId: string, tags: Array<{ tag: { name: string; color: string | null } }>) {
  const ids: string[] = [];
  for (const { tag } of tags) {
    const existing = await prisma.tag.findFirst({ where: { spaceId: sessionSpaceId, name: { equals: tag.name, mode: 'insensitive' } } });
    ids.push(existing ? existing.id : (await prisma.tag.create({ data: { name: tag.name, color: tag.color, spaceId: sessionSpaceId } })).id);
  }
  return ids;
}

async function createLockedCopy(prisma: any, src: any, params: CopyParams, parentId: string | null, lockedAt: Date) {
  const created = await prisma.item.create({
    data: {
      type: src.type, title: src.title, description: src.description, content: src.content ?? undefined,
      url: src.url, status: src.status, priority: src.priority, position: src.position,
      dueDate: src.dueDate, startDate: src.startDate, endDate: src.endDate,
      spaceId: params.sessionSpaceId, createdById: params.userId, parentId,
      lockedAt, sourceItemId: src.id, sourceSpaceId: src.spaceId ?? params.sourceSpaceId,
    },
  });
  const images = await copyImages(src, created.id);
  const tagIds = await sessionTagIds(prisma, params.sessionSpaceId, src.tags ?? []);
  if (tagIds.length > 0) await prisma.itemTag.createMany({ data: tagIds.map((tagId) => ({ itemId: created.id, tagId })) });
  if (images.url === src.url && images.description === src.description) return { ...created, tags: [] };
  return prisma.item.update({ where: { id: created.id }, data: images, include: { tags: { include: { tag: true } } } });
}

const flattenTags = (item: any) => ({ ...item, tags: (item.tags ?? []).map((t: any) => t.tag ?? t) });

export async function copyItemToSession(prisma: any, params: CopyParams) {
  const source = await prisma.item.findFirst({
    where: { id: params.sourceItemId, spaceId: params.sourceSpaceId },
    include: { tags: { include: { tag: true } } },
  });
  if (!source) throw new SessionCopyError('NOT_FOUND', 'Élément source introuvable');

  const previous = await prisma.item.findFirst({
    where: { spaceId: params.sessionSpaceId, sourceItemId: source.id, parentId: undefined },
    orderBy: { lockedAt: 'desc' },
    include: { tags: { include: { tag: true } } },
  });
  if (previous?.lockedAt && source.updatedAt <= previous.lockedAt) {
    const children = await prisma.item.findMany({ where: { parentId: previous.id }, include: { tags: { include: { tag: true } } }, orderBy: { position: 'asc' } });
    return { item: flattenTags(previous), children: children.map(flattenTags), reused: true };
  }

  const lockedAt = new Date();
  const copy = await createLockedCopy(prisma, source, params, null, lockedAt);
  const sourceChildren = await prisma.item.findMany({
    where: { parentId: source.id, spaceId: params.sourceSpaceId },
    include: { tags: { include: { tag: true } } },
    orderBy: { position: 'asc' },
  });
  const children = [];
  for (const child of sourceChildren) children.push(await createLockedCopy(prisma, child, params, copy.id, lockedAt));
  return { item: flattenTags(copy), children: children.map(flattenTags), reused: false };
}
```
Note : la copie d'un enfant porte `sourceItemId` = id de l'enfant source ; la recherche `previous` vise la copie de tête (même `sourceItemId` que l'item affiché). Retirer `parentId: undefined` si Prisma le refuse (c'est un no-op).

- [ ] **Step 5:** Run → PASS. `pnpm --filter @spok/api typecheck` → 0 erreur.
- [ ] **Step 6: Commit** (si demandé) — `git commit -m "feat: copie verrouillée des items affichés en séance"`.

---

### Task 5: Routes `/live-sessions`

**Files:**
- Create: `apps/api/src/routes/live-sessions.ts`, `apps/api/src/routes/live-sessions.test.ts`
- Modify: `apps/api/src/index.ts` (import + `await app.register(liveSessionsRoutes, { prefix: '/live-sessions' });` après `activityRoutes`)

**Interfaces:**
- Consumes: `checkSpaceAccess` (`routes/items.ts`), `liveHub` (Task 3), `copyItemToSession`, `SessionCopyError` (Task 4).
- Produces (REST, toutes `authenticate`) :
  - `POST /live-sessions` body `{ parentSpaceId: string; name?: string }` → `201 LiveSessionState`
  - `GET /live-sessions?parentSpaceId=` → `LiveSessionSummary[]`
  - `GET /live-sessions/by-space/:spaceId` → `LiveSessionState` (404 si l'espace n'est pas une séance)
  - `POST /live-sessions/:id/join` → `LiveSessionState`
  - `PUT /live-sessions/:id/presenters` body `{ userIds: string[] }` → `{ roles }` (host)
  - `POST /live-sessions/:id/display` body `{ sourceSpaceId: string; sourceItemId: string }` → `{ entry, displayed }` (host/presenter)
  - `POST /live-sessions/:id/end` → `{ endedAt }` (host)
  - `GET /live-sessions/:id/stream` → `text/event-stream`

- [ ] **Step 1: Tests** — `apps/api/src/routes/live-sessions.test.ts`

```ts
/* TNR des routes /live-sessions : création (OWNER communauté), accès (membres du parent), affichage, fin. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'

vi.mock('../utils/sessionCopy.js', () => ({
  SessionCopyError: class extends Error { code = 'NOT_FOUND' },
  copyItemToSession: vi.fn(async () => ({ item: { id: 'copy-1', title: 'Budget', tags: [] }, children: [], reused: false })),
}))

import { liveSessionsRoutes } from './live-sessions.js'

const USER = 'test-user-id'
const session = { id: 'ls-1', spaceId: 'sess-space', parentSpaceId: 'parent', hostId: USER, status: 'LIVE',
  controllerId: null, currentEntryId: null, startedAt: new Date(), endedAt: null,
  space: { name: '2026-10-10' } }

async function build() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()
  app.setErrorHandler((error, _r, reply) => reply.status((error as any).statusCode ?? 500).send({ message: error.message }))
  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(liveSessionsRoutes, { prefix: '/live-sessions' })
  await app.ready()
  return { app, prisma }
}

describe('/live-sessions', () => {
  let app: FastifyInstance; let prisma: MockPrisma
  const auth = () => ({ authorization: `Bearer ${getTestToken(app)}` })
  beforeEach(async () => {
    ({ app, prisma } = await build())
    prisma.user.findUnique.mockResolvedValue({ id: USER, name: 'Thomas', avatarUrl: null, globalRole: 'USER' })
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', name: 'Comité', type: 'GROUP', communityId: 'c1', parentId: null, visibility: null })
  })

  it('création refusée si pas OWNER de la communauté', async () => {
    prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(403)
  })

  it('création refusée hors communauté', async () => {
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', type: 'PERSONAL', communityId: null })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(400)
  })

  it('création par OWNER : sous-espace PRIVATE daté + rôle HOST', async () => {
    prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
    prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-10' })
    prisma.liveSession.create.mockResolvedValue(session)
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, roles: [{ userId: USER, role: 'HOST', user: { id: USER, name: 'Thomas', avatarUrl: null } }] })
    const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent' } })
    expect(res.statusCode).toBe(201)
    const data = prisma.space.create.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'GROUP', parentId: 'parent', communityId: 'c1', visibility: 'PRIVATE' })
    expect(data.name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(prisma.liveSession.create.mock.calls[0][0].data.roles.create).toEqual({ userId: USER, role: 'HOST' })
  })

  it('join refusé à un non-membre du parent', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', community: { visibility: 'PRIVATE', isPublic: false } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/join', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('join par un membre du parent : membership MEMBER dans l\'espace de séance + entrée JOIN', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other', roles: [], entries: [] })
    prisma.spaceMembership.findUnique.mockImplementation(async ({ where }: any) =>
      where.userId_spaceId.spaceId === 'parent' ? { role: 'MEMBER' } : null)
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e1', kind: 'JOIN', createdAt: new Date(), userId: USER, itemId: null, itemTitle: null, user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/join', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.spaceMembership.create).toHaveBeenCalledWith({ data: { userId: USER, spaceId: 'sess-space', role: 'MEMBER' } })
  })

  it('display refusé à un simple participant', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue(null)
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(403)
  })

  it('display refusé si le présentateur n\'a pas accès à la source', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'src', communityId: null })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(404)
  })

  it('display : entrée DISPLAY + currentEntryId = dernier affichage', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e2', kind: 'DISPLAY', createdAt: new Date(), userId: USER, itemId: 'copy-1', itemTitle: 'Budget', user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSession.update).toHaveBeenCalledWith({ where: { id: 'ls-1' }, data: { currentEntryId: 'e2' } })
  })

  it('display sur séance ENDED → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'ENDED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceSpaceId: 'src', sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(409)
  })

  it('end réservé au host', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/end', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('presenters : refuse un utilisateur non membre du parent', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1', community: { visibility: 'PRIVATE', isPublic: false } })
    const res = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/presenters', headers: auth(), payload: { userIds: ['stranger'] } })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2:** Run `npx vitest run apps/api/src/routes/live-sessions.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** `apps/api/src/routes/live-sessions.ts`

```ts
/*
 * Routes /live-sessions : séances de présentation en direct (étape 1 « Socle »).
 * - Création : OWNER de la communauté de l'espace parent uniquement → sous-espace PRIVATE daté + rôle HOST.
 * - Accès : membres (OWNER/MEMBER effectif) de l'espace parent ; join = membership MEMBER dans l'espace de séance.
 * - Affichage libre : HOST/PRESENTER, le dernier affichage l'emporte (currentEntryId) ; la copie est vérifiée
 *   avec les droits du présentateur sur l'espace source (copyItemToSession, verrouillée).
 * - Flux SSE /:id/stream : état poussé via liveHub (une instance API). Le client refetch l'état complet
 *   (by-space) à chaque (re)connexion — le flux ne rejoue pas l'historique.
 * Ne jamais envoyer de données d'espace source dans un événement : uniquement des copies.
 */
import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { LiveEvent, LiveSessionEntry, LiveSessionState, LiveUser } from '@spok/shared';
import { checkSpaceAccess } from './items.js';
import { liveHub } from '../utils/liveHub.js';
import { copyItemToSession, SessionCopyError } from '../utils/sessionCopy.js';

const createSchema = z.object({ parentSpaceId: z.string(), name: z.string().min(1).optional() });
const presentersSchema = z.object({ userIds: z.array(z.string()) });
const displaySchema = z.object({ sourceSpaceId: z.string(), sourceItemId: z.string() });

const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;
const HEARTBEAT_MS = 25_000;

const toEntry = (e: any): LiveSessionEntry => ({
  id: e.id, kind: e.kind, createdAt: new Date(e.createdAt).toISOString(),
  user: e.user, itemId: e.itemId ?? null, itemTitle: e.itemTitle ?? null,
});

const flattenTags = (item: any) => ({ ...item, tags: (item.tags ?? []).map((t: any) => t.tag ?? t) });

async function isParentMember(prisma: any, userId: string, parentSpaceId: string) {
  const access = await checkSpaceAccess(prisma, userId, parentSpaceId);
  return !!access && ['OWNER', 'MEMBER', 'ADMIN'].includes(access.role);
}

function localDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const liveSessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma as any;

  async function loadState(sessionId: string, userId: string): Promise<LiveSessionState | null> {
    const s = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        space: { select: { name: true } },
        roles: { include: { user: { select: USER_SELECT } } },
        entries: { include: { user: { select: USER_SELECT } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!s) return null;
    const entries = (s.entries ?? []).map(toEntry);
    const currentEntry = entries.find((e: LiveSessionEntry) => e.id === s.currentEntryId) ?? null;
    let current: LiveSessionState['current'] = null;
    if (currentEntry?.itemId) {
      const item = await prisma.item.findFirst({ where: { id: currentEntry.itemId, spaceId: s.spaceId }, include: { tags: { include: { tag: true } } } });
      if (item) {
        const children = await prisma.item.findMany({ where: { parentId: item.id }, include: { tags: { include: { tag: true } } }, orderBy: { position: 'asc' } });
        current = { entry: currentEntry, item: flattenTags(item), children: children.map(flattenTags) };
      }
    }
    const roles = (s.roles ?? []).map((r: any) => ({ userId: r.userId, role: r.role, user: r.user }));
    const mine = roles.find((r: any) => r.userId === userId);
    return {
      session: {
        id: s.id, spaceId: s.spaceId, parentSpaceId: s.parentSpaceId, hostId: s.hostId, status: s.status,
        controllerId: s.controllerId, currentEntryId: s.currentEntryId,
        startedAt: new Date(s.startedAt).toISOString(), endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
      },
      spaceName: s.space?.name ?? '',
      roles,
      myRole: mine?.role ?? 'PARTICIPANT',
      entries,
      current,
      presence: liveHub.presence(s.id),
    };
  }

  async function sessionMemberOr403(reply: FastifyReply, sessionId: string, userId: string) {
    const s = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!s) { reply.notFound('Séance introuvable'); return null; }
    const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: s.spaceId } } });
    if (!m) { reply.forbidden('Rejoignez la séance depuis son espace parent'); return null; }
    return s;
  }

  // Créer une séance (OWNER de la communauté)
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createSchema.parse(request.body);
    const parent = await prisma.space.findUnique({ where: { id: body.parentSpaceId } });
    if (!parent) return reply.notFound('Espace introuvable');
    if (parent.type !== 'GROUP' || !parent.communityId) return reply.badRequest('Une séance se crée dans un espace de communauté');
    const cm = await prisma.communityMembership.findUnique({ where: { userId_communityId: { userId, communityId: parent.communityId } } });
    if (cm?.role !== 'OWNER') return reply.forbidden('Seul un propriétaire de la communauté peut créer une séance');

    const space = await prisma.space.create({
      data: {
        name: body.name ?? localDate(), type: 'GROUP', communityId: parent.communityId, parentId: parent.id,
        visibility: 'PRIVATE', memberships: { create: { userId, role: 'OWNER' } },
      },
    });
    const s = await prisma.liveSession.create({
      data: { spaceId: space.id, parentSpaceId: parent.id, hostId: userId, roles: { create: { userId, role: 'HOST' } } },
    });
    return reply.status(201).send(await loadState(s.id, userId));
  });

  // Séances d'un espace parent (pour la liste + bouton Rejoindre)
  fastify.get<{ Querystring: { parentSpaceId: string } }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { parentSpaceId } = request.query;
    if (!parentSpaceId) return reply.badRequest('parentSpaceId requis');
    if (!(await isParentMember(prisma, userId, parentSpaceId))) return reply.notFound('Espace introuvable');
    const list = await prisma.liveSession.findMany({
      where: { parentSpaceId },
      include: { space: { select: { name: true, memberships: { where: { userId }, select: { id: true } } } } },
      orderBy: { startedAt: 'desc' },
    });
    return list.map((s: any) => ({
      id: s.id, spaceId: s.spaceId, spaceName: s.space.name, status: s.status,
      startedAt: new Date(s.startedAt).toISOString(), isMember: s.space.memberships.length > 0,
    }));
  });

  // État complet d'une séance à partir de son espace (utilisé par SpacePage)
  fastify.get<{ Params: { spaceId: string } }>('/by-space/:spaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await prisma.liveSession.findUnique({ where: { spaceId: request.params.spaceId } });
    if (!s) return reply.notFound('Pas de séance pour cet espace');
    const ok = await sessionMemberOr403(reply, s.id, request.user.userId);
    if (!ok) return;
    return loadState(s.id, request.user.userId);
  });

  // Rejoindre (membres de l'espace parent)
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await isParentMember(prisma, userId, s.parentSpaceId))) return reply.forbidden('Réservé aux membres de l\'espace');
    const existing = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: s.spaceId } } });
    if (!existing) {
      await prisma.spaceMembership.create({ data: { userId, spaceId: s.spaceId, role: 'MEMBER' } });
      const entry = await prisma.liveSessionEntry.create({
        data: { sessionId: s.id, kind: 'JOIN', userId }, include: { user: { select: USER_SELECT } },
      });
      liveHub.broadcast(s.id, { type: 'join', entry: toEntry(entry) });
    }
    return loadState(s.id, userId);
  });

  // Désigner les présentateurs (host) — remplace la liste
  fastify.put<{ Params: { id: string } }>('/:id/presenters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== userId) return reply.forbidden('Réservé à l\'animateur');
    const { userIds } = presentersSchema.parse(request.body);
    for (const id of userIds) {
      if (!(await isParentMember(prisma, id, s.parentSpaceId))) return reply.badRequest('Un présentateur doit être membre de l\'espace parent');
    }
    await prisma.liveSessionRole.deleteMany({ where: { sessionId: s.id, role: 'PRESENTER' } });
    const ids = userIds.filter((id) => id !== s.hostId);
    if (ids.length > 0) await prisma.liveSessionRole.createMany({ data: ids.map((id) => ({ sessionId: s.id, userId: id, role: 'PRESENTER' })) });
    // Les présentateurs doivent pouvoir ouvrir l'espace de séance
    for (const id of ids) {
      const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId: id, spaceId: s.spaceId } } });
      if (!m) await prisma.spaceMembership.create({ data: { userId: id, spaceId: s.spaceId, role: 'MEMBER' } });
    }
    const state = await loadState(s.id, userId);
    liveHub.broadcast(s.id, { type: 'roles', roles: state!.roles });
    return { roles: state!.roles };
  });

  // Afficher un élément (host/présentateur) — copie verrouillée + diffusion
  fastify.post<{ Params: { id: string } }>('/:id/display', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    const role = await prisma.liveSessionRole.findUnique({ where: { sessionId_userId: { sessionId: s.id, userId } } });
    if (!role) return reply.forbidden('Seuls l\'animateur et les présentateurs peuvent afficher');
    if (s.status !== 'LIVE') return reply.conflict('Séance terminée');
    const body = displaySchema.parse(request.body);
    const access = await checkSpaceAccess(prisma, userId, body.sourceSpaceId);
    if (!access) return reply.notFound('Espace source introuvable');

    let displayed;
    try {
      displayed = await copyItemToSession(prisma, { ...body, sessionSpaceId: s.spaceId, userId });
    } catch (err) {
      if (err instanceof SessionCopyError) return reply.notFound(err.message);
      throw err;
    }
    const entry = await prisma.liveSessionEntry.create({
      data: { sessionId: s.id, kind: 'DISPLAY', userId, itemId: displayed.item.id, itemTitle: displayed.item.title },
      include: { user: { select: USER_SELECT } },
    });
    await prisma.liveSession.update({ where: { id: s.id }, data: { currentEntryId: entry.id } });
    const event: LiveEvent = { type: 'display', entry: toEntry(entry), displayed: { item: displayed.item, children: displayed.children } };
    liveHub.broadcast(s.id, event);
    return { entry: event.entry, displayed: event.displayed };
  });

  // Terminer (host)
  fastify.post<{ Params: { id: string } }>('/:id/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== request.user.userId) return reply.forbidden('Réservé à l\'animateur');
    const endedAt = new Date();
    await prisma.liveSession.update({ where: { id: s.id }, data: { status: 'ENDED', endedAt } });
    liveHub.broadcast(s.id, { type: 'ended', endedAt: endedAt.toISOString() });
    return { endedAt: endedAt.toISOString() };
  });

  // Flux SSE
  fastify.get<{ Params: { id: string } }>('/:id/stream', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await sessionMemberOr403(reply, request.params.id, userId);
    if (!s) return;
    const user: LiveUser = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });

    // hijack : on écrit nous-mêmes ; recopier les headers déjà posés (CORS, helmet)
    reply.hijack();
    const raw = reply.raw;
    for (const [k, v] of Object.entries(reply.getHeaders())) if (v !== undefined) raw.setHeader(k, v as any);
    raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    raw.write(': connected\n\n');

    const send = (event: LiveEvent) => { raw.write(`data: ${JSON.stringify(event)}\n\n`); };
    const unsubscribe = liveHub.subscribe(s.id, user, send);
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), HEARTBEAT_MS);
    request.raw.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
  });
};
```

Dans `index.ts` : `import { liveSessionsRoutes } from './routes/live-sessions.js';` + `await app.register(liveSessionsRoutes, { prefix: '/live-sessions' });` après la ligne `activityRoutes`. Ajouter `'/live-sessions/*'` à `availableRoutes` du 404. Mettre à jour l'en-tête d'`index.ts` (mention « /live-sessions : séances en direct, flux SSE hors rate-limit global »). Exempter le flux du rate-limit global : dans la route stream, ajouter `config: { rateLimit: false }` aux options (`{ preHandler: [...], config: { rateLimit: false } }`).

- [ ] **Step 4:** Run `npx vitest run apps/api/src/routes/live-sessions.test.ts` → PASS. Ajuster les mocks du test, pas la logique, si un mock manque (ex. `prisma.liveSession.findUnique` appelé deux fois dans `loadState` → `mockResolvedValue` couvre).

- [ ] **Step 5: Vérification manuelle du flux** (API locale démarrée) : se connecter dans l'app, récupérer le token dans le localStorage via le navigateur intégré, puis
```bash
curl -N -H "Authorization: Bearer <token>" http://localhost:3001/live-sessions/<id>/stream
```
Expected : `: connected` puis un `data: {"type":"presence",...}` ; un POST display depuis un autre terminal fait apparaître `data: {"type":"display",...}`.

- [ ] **Step 6:** `pnpm --filter @spok/api typecheck` → 0 erreur.
- [ ] **Step 7: Commit** (si demandé) — `git commit -m "feat: routes séances live (création, accès, affichage, flux SSE)"`.

---

### Task 6: Client web — API, flux SSE, hook

**Files:**
- Modify: `apps/web/src/lib/api.ts` (ajouts uniquement, en fin de fichier + un export)
- Create: `apps/web/src/lib/liveStream.ts`, `apps/web/src/lib/liveStream.test.ts`
- Create: `apps/web/src/hooks/useLiveSession.ts`

**Interfaces:**
- Produces:
  - `liveSessionsApi.{create(parentSpaceId), listForParent(parentSpaceId), getBySpace(spaceId), join(id), setPresenters(id, userIds), display(id, sourceSpaceId, sourceItemId), end(id)}`
  - `getValidAccessToken(): Promise<string | null>` (api.ts)
  - `parseSseChunk(buffer: string): { events: LiveEvent[]; rest: string }`, `openLiveStream(sessionId, handlers: { onEvent(e: LiveEvent): void; onOpen(): void }): () => void`
  - `useLiveSession(spaceId: string | undefined): { state: LiveSessionState | undefined; isLiveSpace: boolean; display(sourceSpaceId, sourceItemId): Promise<void>; end(): Promise<void>; setPresenters(userIds): Promise<void> }` — queryKey `['live-session', spaceId]`.

- [ ] **Step 1: Exports dans `api.ts`** (ne rien modifier d'existant ; en-tête : ajouter « liveSessionsApi + getValidAccessToken (utilisé par lib/liveStream.ts) »)

```ts
/** Token d'accès valide (refresh proactif si expiré) — pour les flux hors fetchApi (SSE). */
export async function getValidAccessToken(): Promise<string | null> {
  const token = useAuthStore.getState().accessToken;
  if (token && !isTokenExpired(30)) return token;
  if (!refreshPromise) refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null; });
  const ok = await refreshPromise;
  return ok ? useAuthStore.getState().accessToken : null;
}

export const liveSessionsApi = {
  create: (parentSpaceId: string) =>
    fetchApi<LiveSessionState>('/live-sessions', { method: 'POST', body: JSON.stringify({ parentSpaceId }) }),
  listForParent: (parentSpaceId: string) =>
    fetchApi<LiveSessionSummary[]>(`/live-sessions?parentSpaceId=${encodeURIComponent(parentSpaceId)}`),
  getBySpace: (spaceId: string) => fetchApi<LiveSessionState>(`/live-sessions/by-space/${spaceId}`),
  join: (id: string) => fetchApi<LiveSessionState>(`/live-sessions/${id}/join`, { method: 'POST' }),
  setPresenters: (id: string, userIds: string[]) =>
    fetchApi<{ roles: LiveSessionState['roles'] }>(`/live-sessions/${id}/presenters`, { method: 'PUT', body: JSON.stringify({ userIds }) }),
  display: (id: string, sourceSpaceId: string, sourceItemId: string) =>
    fetchApi<{ entry: LiveSessionEntry; displayed: LiveDisplayedItem }>(`/live-sessions/${id}/display`, { method: 'POST', body: JSON.stringify({ sourceSpaceId, sourceItemId }) }),
  end: (id: string) => fetchApi<{ endedAt: string }>(`/live-sessions/${id}/end`, { method: 'POST' }),
};
export { API_URL as LIVE_API_URL };
```
Ajouter `LiveSessionState, LiveSessionSummary, LiveSessionEntry, LiveDisplayedItem` à l'import de types `@spok/shared`. Vérifier le nom réel de l'import du store auth dans `api.ts` (`useAuthStore`) et de la variable `API_URL` ; s'ils diffèrent, adapter.

- [ ] **Step 2: Test du parseur et de la reconnexion** — `apps/web/src/lib/liveStream.test.ts`

```ts
/* Tests du client SSE des séances : découpage des messages, commentaires ignorés, reconnexion. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseSseChunk, openLiveStream } from './liveStream'

vi.mock('./api', () => ({ getValidAccessToken: vi.fn(async () => 'tok'), LIVE_API_URL: '/api' }))

describe('parseSseChunk', () => {
  it('extrait les événements complets et garde le reste', () => {
    const { events, rest } = parseSseChunk(': ping\n\ndata: {"type":"ended","endedAt":"x"}\n\ndata: {"type":"pre')
    expect(events).toEqual([{ type: 'ended', endedAt: 'x' }])
    expect(rest).toBe('data: {"type":"pre')
  })
  it('ignore un message JSON invalide', () => {
    expect(parseSseChunk('data: {oops\n\n').events).toEqual([])
  })
})

describe('openLiveStream', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('reconnecte après fermeture du flux et rappelle onOpen', async () => {
    const encoder = new TextEncoder()
    const makeBody = () => new ReadableStream({ start(c) { c.enqueue(encoder.encode(': connected\n\n')); c.close() } })
    const fetchMock = vi.fn(async () => new Response(makeBody(), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const onOpen = vi.fn()
    const stop = openLiveStream('ls-1', { onEvent: vi.fn(), onOpen })
    await vi.advanceTimersByTimeAsync(0)
    expect(onOpen).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(onOpen.mock.calls.length).toBeGreaterThanOrEqual(2)
    stop()
  })
})
```

- [ ] **Step 3:** Run `npx vitest run apps/web/src/lib/liveStream.test.ts` → FAIL.

- [ ] **Step 4: Implémenter** `apps/web/src/lib/liveStream.ts`

```ts
/*
 * Client SSE des séances live, basé sur fetch (EventSource ne permet pas d'envoyer le header
 * Authorization ni de rafraîchir le token). Reconnexion automatique avec backoff (1 s → 15 s max) ;
 * onOpen est appelé à chaque (re)connexion : l'appelant doit alors refetch l'état complet, le flux
 * ne rejouant pas les événements manqués. Retourne une fonction d'arrêt.
 */
import type { LiveEvent } from '@spok/shared';
import { getValidAccessToken, LIVE_API_URL } from './api';

export function parseSseChunk(buffer: string): { events: LiveEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: LiveEvent[] = [];
  for (const part of parts) {
    const data = part.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch { /* message corrompu : ignoré */ }
  }
  return { events, rest };
}

export function openLiveStream(sessionId: string, handlers: { onEvent: (e: LiveEvent) => void; onOpen: () => void }): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let delay = 1000;

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const token = await getValidAccessToken();
        const res = await fetch(`${LIVE_API_URL}/live-sessions/${sessionId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (res.ok && res.body) {
          delay = 1000;
          handlers.onOpen();
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const parsed = parseSseChunk(buffer + decoder.decode(value, { stream: true }));
            buffer = parsed.rest;
            parsed.events.forEach(handlers.onEvent);
          }
        }
      } catch { /* coupure réseau ou abort */ }
      if (stopped) return;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 15000);
    }
  };
  run();
  return () => { stopped = true; controller?.abort(); };
}
```

- [ ] **Step 5:** Run → PASS.

- [ ] **Step 6: Hook** `apps/web/src/hooks/useLiveSession.ts`

```ts
/*
 * useLiveSession(spaceId) : état d'une séance live à partir de son espace + abonnement au flux SSE.
 * queryKey ['live-session', spaceId] ; 404 = l'espace n'est pas une séance (isLiveSpace false, pas de retry).
 * Les événements sont appliqués sur le cache ; à chaque (re)connexion l'état complet est refetch.
 * Un display plus ancien que le courant (entry.createdAt) est ignoré — convergence si deux présentateurs.
 * Invalide ['items', spaceId] à chaque display : la nouvelle copie apparaît dans les vues de l'espace.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveEvent, LiveSessionState } from '@spok/shared';
import { liveSessionsApi } from '../lib/api';
import { openLiveStream } from '../lib/liveStream';

export function applyLiveEvent(state: LiveSessionState, event: LiveEvent): LiveSessionState {
  switch (event.type) {
    case 'display': {
      if (state.current && state.current.entry.createdAt > event.entry.createdAt) {
        return { ...state, entries: [...state.entries, event.entry].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
      }
      return {
        ...state,
        session: { ...state.session, currentEntryId: event.entry.id },
        entries: [...state.entries.filter((e) => e.id !== event.entry.id), event.entry],
        current: { entry: event.entry, ...event.displayed },
      };
    }
    case 'join': return { ...state, entries: [...state.entries, event.entry] };
    case 'presence': return { ...state, presence: event.presence };
    case 'roles': return { ...state, roles: event.roles };
    case 'ended': return { ...state, session: { ...state.session, status: 'ENDED', endedAt: event.endedAt } };
  }
}

export function useLiveSession(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['live-session', spaceId];
  const { data: state, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => liveSessionsApi.getBySpace(spaceId!),
    enabled: !!spaceId,
    retry: false,
    staleTime: Infinity,
  });
  const sessionId = state?.session.id;

  useEffect(() => {
    if (!sessionId) return;
    let first = true;
    return openLiveStream(sessionId, {
      onOpen: () => { if (!first) refetch(); first = false; },
      onEvent: (event) => {
        queryClient.setQueryData<LiveSessionState>(key, (prev) => (prev ? applyLiveEvent(prev, event) : prev));
        if (event.type === 'display') queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return {
    state,
    isLiveSpace: !!state && !isError,
    display: async (sourceSpaceId: string, sourceItemId: string) => { await liveSessionsApi.display(sessionId!, sourceSpaceId, sourceItemId); },
    end: async () => { await liveSessionsApi.end(sessionId!); },
    setPresenters: async (userIds: string[]) => { await liveSessionsApi.setPresenters(sessionId!, userIds); },
  };
}
```

Ajouter dans `liveStream.test.ts` (ou un `useLiveSession.test.ts`) le test de convergence :
```ts
import { applyLiveEvent } from '../hooks/useLiveSession'
it('ignore un display plus ancien que le courant', () => {
  const user = { id: 'u', name: 'U' }
  const newer = { id: 'e2', kind: 'DISPLAY' as const, createdAt: '2026-10-10T10:00:02Z', user, itemId: 'c2', itemTitle: 'B' }
  const older = { ...newer, id: 'e1', createdAt: '2026-10-10T10:00:01Z', itemId: 'c1', itemTitle: 'A' }
  const state: any = { session: { currentEntryId: 'e2' }, entries: [newer], current: { entry: newer, item: { id: 'c2' }, children: [] } }
  const next = applyLiveEvent(state, { type: 'display', entry: older, displayed: { item: { id: 'c1' } as any, children: [] } })
  expect(next.current!.entry.id).toBe('e2')
  expect(next.entries.map((e) => e.id)).toEqual(['e1', 'e2'])
})
```

- [ ] **Step 7:** Run `npx vitest run apps/web/src/lib/liveStream.test.ts` → PASS ; `pnpm --filter @spok/web typecheck` → 0 erreur.
- [ ] **Step 8: Commit** (si demandé) — `git commit -m "feat: client temps réel des séances live (SSE + hook)"`.

---

### Task 7: Fenêtre « en direct » flottante

**Files:**
- Create: `apps/web/src/components/live/liveWindowGeometry.ts`, `apps/web/src/components/live/liveWindowGeometry.test.ts`
- Create: `apps/web/src/components/live/LiveWindow.tsx`

**Interfaces:**
- Consumes: `LiveSessionState` (Task 1).
- Produces: `<LiveWindow state={LiveSessionState} onOpenItem={(itemId: string) => void} />` ; `loadGeometry(): Geometry`, `saveGeometry(g)`, `clampGeometry(g, viewport): Geometry`, `type Geometry = { x; y; width; height; mode: 'normal' | 'minimized' | 'maximized' }`.

- [ ] **Step 1: Test** — `liveWindowGeometry.test.ts`

```ts
/* Tests de la géométrie de la fenêtre en direct : bornage dans l'écran, persistance tolérante. */
import { describe, it, expect, beforeEach } from 'vitest'
import { clampGeometry, loadGeometry, saveGeometry, DEFAULT_GEOMETRY } from './liveWindowGeometry'

describe('liveWindowGeometry', () => {
  beforeEach(() => localStorage.clear())
  it('ramène la fenêtre dans l\'écran', () => {
    const g = clampGeometry({ x: 5000, y: -50, width: 3000, height: 200, mode: 'normal' }, { width: 1440, height: 900 })
    expect(g.width).toBeLessThanOrEqual(1440)
    expect(g.x + g.width).toBeLessThanOrEqual(1440)
    expect(g.y).toBeGreaterThanOrEqual(0)
  })
  it('impose une taille minimale', () => {
    const g = clampGeometry({ x: 0, y: 0, width: 10, height: 10, mode: 'normal' }, { width: 1440, height: 900 })
    expect(g.width).toBeGreaterThanOrEqual(280)
    expect(g.height).toBeGreaterThanOrEqual(180)
  })
  it('persiste et relit ; valeur corrompue → défaut', () => {
    saveGeometry({ ...DEFAULT_GEOMETRY, x: 42 })
    expect(loadGeometry().x).toBe(42)
    localStorage.setItem('spok.liveWindow', '{oops')
    expect(loadGeometry()).toEqual(DEFAULT_GEOMETRY)
  })
})
```

- [ ] **Step 2:** Run `npx vitest run apps/web/src/components/live/liveWindowGeometry.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** `liveWindowGeometry.ts`

```ts
/*
 * Géométrie de la fenêtre « en direct » (position, taille, mode) : bornage dans l'écran et
 * persistance par navigateur (localStorage, tolérant aux erreurs — confort, pas une donnée).
 */
export type Geometry = { x: number; y: number; width: number; height: number; mode: 'normal' | 'minimized' | 'maximized' };

const KEY = 'spok.liveWindow';
const MIN_W = 280;
const MIN_H = 180;
export const DEFAULT_GEOMETRY: Geometry = { x: 24, y: 96, width: 480, height: 360, mode: 'normal' };

export function clampGeometry(g: Geometry, viewport: { width: number; height: number }): Geometry {
  const width = Math.min(Math.max(g.width, MIN_W), viewport.width);
  const height = Math.min(Math.max(g.height, MIN_H), viewport.height);
  const x = Math.min(Math.max(g.x, 0), viewport.width - width);
  const y = Math.min(Math.max(g.y, 0), viewport.height - height);
  return { ...g, x, y, width, height };
}

export function loadGeometry(): Geometry {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_GEOMETRY;
    const g = JSON.parse(raw);
    return typeof g?.x === 'number' && typeof g?.width === 'number' ? { ...DEFAULT_GEOMETRY, ...g } : DEFAULT_GEOMETRY;
  } catch { return DEFAULT_GEOMETRY; }
}

export function saveGeometry(g: Geometry): void {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* stockage indisponible */ }
}
```

- [ ] **Step 4:** Run → PASS.

- [ ] **Step 5: Composant** `LiveWindow.tsx`

```tsx
/*
 * LiveWindow — fenêtre flottante « en direct » d'une séance : affiche la copie actuellement présentée
 * (titre, « présenté par », description, sous-items) et suit le direct en permanence.
 * Déplaçable (barre de titre), redimensionnable (poignée bas-droite), réductible en vignette, plein écran.
 * Géométrie mémorisée (liveWindowGeometry). Rendue en portail sur document.body (z-40, sous les modales
 * z-50) : ne jamais l'insérer dans Layout.tsx. Un clic sur le contenu ouvre la copie (onOpenItem).
 * Desktop uniquement (pas d'adaptation mobile à l'étape 1).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Maximize2, Minimize2, Radio } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import { clampGeometry, loadGeometry, saveGeometry, type Geometry } from './liveWindowGeometry';

interface Props { state: LiveSessionState; onOpenItem: (itemId: string) => void }

export function LiveWindow({ state, onOpenItem }: Props) {
  const [geo, setGeo] = useState<Geometry>(() => clampGeometry(loadGeometry(), { width: window.innerWidth, height: window.innerHeight }));
  const [flash, setFlash] = useState(false);
  const drag = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; origin: Geometry } | null>(null);
  const currentId = state.current?.entry.id;

  useEffect(() => { saveGeometry(geo); }, [geo]);
  useEffect(() => {
    if (!currentId) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1500);
    return () => clearTimeout(t);
  }, [currentId]);

  const onPointerDown = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (geo.mode === 'maximized') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, startY: e.clientY, origin: geo };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX; const dy = e.clientY - d.startY;
    const next = d.kind === 'move'
      ? { ...d.origin, x: d.origin.x + dx, y: d.origin.y + dy }
      : { ...d.origin, width: d.origin.width + dx, height: d.origin.height + dy };
    setGeo(clampGeometry(next, { width: window.innerWidth, height: window.innerHeight }));
  };
  const onPointerUp = () => { drag.current = null; };

  const ended = state.session.status === 'ENDED';
  const current = state.current;
  const style: React.CSSProperties = geo.mode === 'maximized'
    ? { inset: 16 }
    : geo.mode === 'minimized'
      ? { left: geo.x, top: geo.y, width: 280 }
      : { left: geo.x, top: geo.y, width: geo.width, height: geo.height };

  return createPortal(
    <div
      data-testid="live-window"
      className={`fixed z-40 flex flex-col rounded-lg border bg-background shadow-2xl ${flash ? 'ring-2 ring-orange-500' : 'border-border'}`}
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-move select-none" onPointerDown={onPointerDown('move')}>
        <Radio className={`h-4 w-4 ${ended ? 'text-muted-foreground' : 'text-red-500'}`} />
        <span className="text-sm font-medium truncate flex-1">
          {ended ? 'Séance terminée' : current ? current.item.title || 'Sans titre' : 'En attente du premier élément'}
        </span>
        <button aria-label="Réduire" className="p-1 hover:bg-muted rounded" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setGeo((g) => ({ ...g, mode: g.mode === 'minimized' ? 'normal' : 'minimized' }))}>
          <Minus className="h-4 w-4" />
        </button>
        <button aria-label={geo.mode === 'maximized' ? 'Restaurer' : 'Plein écran'} className="p-1 hover:bg-muted rounded" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setGeo((g) => ({ ...g, mode: g.mode === 'maximized' ? 'normal' : 'maximized' }))}>
          {geo.mode === 'maximized' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      {geo.mode !== 'minimized' && (
        <div className="flex-1 overflow-auto p-4 cursor-pointer" onClick={() => current && onOpenItem(current.item.id)}>
          {current && (
            <>
              <p className="text-xs text-muted-foreground mb-2">Présenté par {current.entry.user.name}</p>
              {current.item.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: current.item.description }} />
              )}
              {current.item.url && current.item.type === 'IMAGE' && <img src={current.item.url} alt="" className="mt-3 max-w-full rounded" />}
              {current.children.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm list-disc pl-5">
                  {current.children.map((c) => <li key={c.id}>{c.title || 'Sans titre'}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {geo.mode === 'normal' && (
        <div aria-label="Redimensionner" className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize" onPointerDown={onPointerDown('resize')} />
      )}
    </div>,
    document.body,
  );
}
```
(Le rendu `dangerouslySetInnerHTML` reprend le motif existant de `ThreadView.tsx` pour les descriptions TipTap.)

- [ ] **Step 6:** `pnpm --filter @spok/web typecheck` → 0 erreur.
- [ ] **Step 7: Commit** (si demandé) — `git commit -m "feat: fenêtre flottante en direct des séances"`.

---

### Task 8: Bandeau de séance, fil chronologique, panneau présentateur, entrée depuis l'espace parent

**Files:**
- Create: `apps/web/src/components/live/SessionTimeline.tsx`, `PresenterPanel.tsx`, `LiveSessionBar.tsx`, `ParentSessionsButton.tsx`
- Modify: `apps/web/src/pages/SpaceToolbar.tsx` (montage de `ParentSessionsButton`) — **lire le skill `spok-menu` avant**

**Interfaces:**
- Consumes: `useLiveSession` (Task 6), `searchApi.search(q, page, pageSize)` (existant, `lib/api.ts:1228`), `liveSessionsApi`.
- Produces:
  - `<SessionTimeline entries={LiveSessionEntry[]} onOpenItem={(id) => void} />`
  - `<PresenterPanel sessionSpaceId={string} onDisplay={(sourceSpaceId, sourceItemId) => Promise<void>} />`
  - `<LiveSessionBar state={LiveSessionState} live={ReturnType<typeof useLiveSession>} members={SpaceMember[]} onOpenItem={(id) => void} />`
  - `<ParentSessionsButton spaceId={string} canCreate={boolean} />`

- [ ] **Step 1: `SessionTimeline.tsx`**

```tsx
/*
 * SessionTimeline — fil chronologique d'une séance (journal LiveSessionEntry) : heure, présentateur,
 * élément affiché (cliquable → ouvre la copie), arrivées des participants. Indépendant de l'organisation
 * de l'espace : ne jamais le dériver des positions d'items. Copie supprimée → titre figé, non cliquable.
 */
import type { LiveSessionEntry } from '@spok/shared';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function SessionTimeline({ entries, onOpenItem }: { entries: LiveSessionEntry[]; onOpenItem: (id: string) => void }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground p-3">Rien n'a encore été présenté.</p>;
  return (
    <ol className="divide-y divide-border text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3 px-3 py-2">
          <span className="text-muted-foreground tabular-nums">{time(e.createdAt)}</span>
          {e.kind === 'JOIN' ? (
            <span className="text-muted-foreground">{e.user.name} a rejoint</span>
          ) : (
            <span className="flex-1 min-w-0">
              {e.itemId ? (
                <button className="font-medium hover:underline truncate" onClick={() => onOpenItem(e.itemId!)}>{e.itemTitle || 'Sans titre'}</button>
              ) : (
                <span className="font-medium text-muted-foreground">{e.itemTitle || 'Sans titre'} (retiré)</span>
              )}
              <span className="text-muted-foreground"> — {e.user.name}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: `PresenterPanel.tsx`** — recherche transversale (espaces du présentateur) + « Afficher »

```tsx
/*
 * PresenterPanel — panneau des présentateurs : recherche dans tous les espaces accessibles (searchApi,
 * borné aux memberships de l'utilisateur côté API) puis « Afficher » → copie verrouillée + diffusion.
 * Les résultats issus de l'espace de séance lui-même sont exclus (on n'affiche pas une copie de copie).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

export function PresenterPanel({ sessionSpaceId, onDisplay }: { sessionSpaceId: string; onDisplay: (sourceSpaceId: string, sourceItemId: string) => Promise<void> }) {
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(q, 300);
  const { data } = useQuery({
    queryKey: ['live-presenter-search', debounced],
    queryFn: () => searchApi.search(debounced, 1, 20),
    enabled: debounced.trim().length >= 2,
  });
  const items = (data?.items ?? []).filter((i: any) => i.spaceId !== sessionSpaceId);

  return (
    <div className="p-3 space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élément dans vos espaces…"
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="max-h-72 overflow-auto divide-y divide-border text-sm">
        {items.map((i: any) => (
          <li key={i.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 min-w-0 truncate">{i.title || 'Sans titre'} <span className="text-muted-foreground">· {i.space?.name}</span></span>
            <button disabled={busyId === i.id} className="rounded bg-orange-500 px-2 py-0.5 text-white text-xs disabled:opacity-50"
              onClick={async () => {
                setBusyId(i.id); setError(null);
                try { await onDisplay(i.spaceId, i.id); } catch (e: any) { setError(e?.message ?? 'Affichage impossible'); }
                finally { setBusyId(null); }
              }}>Afficher</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
Avant d'écrire : lire la forme réelle de la réponse de `searchApi.search` (`lib/api.ts:1228` + `routes/search.ts` l.279) et adapter `data?.items`, `i.space?.name`, `i.spaceId` aux vrais noms de champs. Créer `components/live/useDebouncedValue.ts` (en-tête une ligne) s'il n'existe pas déjà un hook équivalent (`Grep "useDebounce" apps/web/src` d'abord — réutiliser s'il existe) :
```ts
/* useDebouncedValue — valeur retardée (recherche au fil de la frappe). */
import { useEffect, useState } from 'react';
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
```

- [ ] **Step 3: `LiveSessionBar.tsx`** — bandeau en haut de l'espace de séance

```tsx
/*
 * LiveSessionBar — bandeau d'un espace de séance : statut (en direct / terminée), présence, boutons
 * « Fil » (SessionTimeline), « Présenter » (PresenterPanel, host/présentateurs), « Présentateurs »
 * (host : choix parmi les membres) et « Terminer » (host). Panneaux en popover simples, pas de modale.
 */
import { useState } from 'react';
import type { LiveSessionState, SpaceMember } from '@spok/shared';
import { SessionTimeline } from './SessionTimeline';
import { PresenterPanel } from './PresenterPanel';
import type { useLiveSession } from '../../hooks/useLiveSession';

type Panel = 'timeline' | 'present' | 'presenters' | null;

export function LiveSessionBar({ state, live, members, onOpenItem }: {
  state: LiveSessionState; live: ReturnType<typeof useLiveSession>; members: SpaceMember[]; onOpenItem: (id: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const isHost = state.myRole === 'HOST';
  const canPresent = state.myRole !== 'PARTICIPANT' && state.session.status === 'LIVE';
  const presenterIds = new Set(state.roles.filter((r) => r.role === 'PRESENTER').map((r) => r.userId));
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="relative flex items-center gap-3 border-b border-border px-4 py-2 text-sm">
      <span className={`font-medium ${state.session.status === 'LIVE' ? 'text-red-600' : 'text-muted-foreground'}`}>
        {state.session.status === 'LIVE' ? '● Séance en direct' : 'Séance terminée'}
      </span>
      <span className="text-muted-foreground">{state.presence.length} connecté(s)</span>
      <div className="flex-1" />
      <button className="hover:underline" onClick={() => toggle('timeline')}>Fil</button>
      {canPresent && <button className="hover:underline" onClick={() => toggle('present')}>Présenter</button>}
      {isHost && state.session.status === 'LIVE' && <button className="hover:underline" onClick={() => toggle('presenters')}>Présentateurs</button>}
      {isHost && state.session.status === 'LIVE' && (
        <button className="text-red-600 hover:underline" onClick={() => { if (confirm('Terminer la séance ?')) live.end(); }}>Terminer</button>
      )}
      {panel && (
        <div className="absolute right-4 top-full z-30 mt-1 w-96 rounded-lg border border-border bg-background shadow-xl">
          {panel === 'timeline' && <SessionTimeline entries={state.entries} onOpenItem={(id) => { setPanel(null); onOpenItem(id); }} />}
          {panel === 'present' && <PresenterPanel sessionSpaceId={state.session.spaceId} onDisplay={live.display} />}
          {panel === 'presenters' && (
            <ul className="max-h-72 overflow-auto p-2">
              {members.filter((m) => m.userId !== state.session.hostId).map((m) => (
                <li key={m.userId}>
                  <label className="flex items-center gap-2 px-2 py-1">
                    <input type="checkbox" checked={presenterIds.has(m.userId)} onChange={(e) => {
                      const next = new Set(presenterIds);
                      if (e.target.checked) next.add(m.userId); else next.delete(m.userId);
                      live.setPresenters([...next]);
                    }} />
                    {m.user?.name ?? m.userId}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```
`members` : liste des membres de l'**espace parent** (`spacesApi.getMembers(state.session.parentSpaceId)`), pour pouvoir désigner quelqu'un qui n'a pas encore rejoint. Vérifier les noms réels de `SpaceMember` (`userId`, `user.name`) dans `packages/shared/src/types/space.ts` et adapter. Remplacer `confirm()` par `ConfirmModal` (composant existant) si `ConfirmModal` s'utilise simplement — sinon garder `confirm`.

- [ ] **Step 4: `ParentSessionsButton.tsx`** — dans un espace de communauté : liste des séances, Rejoindre, Nouvelle séance

```tsx
/*
 * ParentSessionsButton — bouton « Séances » de la barre d'outils d'un espace de communauté.
 * Liste les séances de l'espace (en direct d'abord), « Rejoindre » (devient membre de l'espace de séance
 * puis y navigue) ; « Nouvelle séance » visible seulement pour un OWNER de la communauté (canCreate).
 * N'apparaît pas dans un espace de séance lui-même ni hors communauté (géré par l'appelant).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { liveSessionsApi } from '../../lib/api';

export function ParentSessionsButton({ spaceId, canCreate }: { spaceId: string; canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useQuery({
    queryKey: ['live-sessions', spaceId],
    queryFn: () => liveSessionsApi.listForParent(spaceId),
    enabled: open,
  });
  const go = async (id: string, sessionSpaceId: string, isMember: boolean) => {
    if (!isMember) await liveSessionsApi.join(id);
    queryClient.invalidateQueries({ queryKey: ['spaces'] });
    navigate(`/spaces/${sessionSpaceId}`);
  };
  const create = async () => {
    const state = await liveSessionsApi.create(spaceId);
    queryClient.invalidateQueries({ queryKey: ['spaces'] });
    navigate(`/spaces/${state.session.spaceId}`);
  };

  return (
    <div className="relative">
      <button className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-muted" onClick={() => setOpen((o) => !o)}>
        <Radio className="h-4 w-4" /> Séances
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-background p-2 shadow-xl text-sm">
          {canCreate && <button className="w-full rounded bg-orange-500 px-2 py-1 text-white mb-2" onClick={create}>Nouvelle séance</button>}
          {sessions.length === 0 && <p className="text-muted-foreground px-1">Aucune séance.</p>}
          <ul className="divide-y divide-border">
            {[...sessions].sort((a, b) => (a.status === b.status ? 0 : a.status === 'LIVE' ? -1 : 1)).map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 truncate">{s.spaceName}{s.status === 'LIVE' && <span className="text-red-600"> ● direct</span>}</span>
                <button className="hover:underline" onClick={() => go(s.id, s.spaceId, s.isMember)}>{s.isMember ? 'Ouvrir' : 'Rejoindre'}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Montage dans `SpaceToolbar.tsx`** (après lecture du skill `spok-menu`) : afficher `<ParentSessionsButton spaceId={space.id} canCreate={isCommunityOwner} />` quand `space.communityId` est défini **et** que l'espace n'est pas une séance (`!isLiveSpace`, passé en prop depuis `SpacePage`). `isCommunityOwner` : réutiliser l'info de rôle communauté déjà disponible dans `SpacePage`/`SpaceToolbar` (chercher `community` + `role` / `OWNER` dans ces fichiers) ; si absente, `useQuery(['community', communityId])` via `communitiesApi` existant. Mettre à jour l'en-tête de `SpaceToolbar.tsx`.

- [ ] **Step 6:** `pnpm --filter @spok/web typecheck` → 0 erreur.
- [ ] **Step 7: Commit** (si demandé) — `git commit -m "feat: bandeau, fil et panneau présentateur des séances live"`.

---

### Task 9: Intégration SpacePage + modale d'édition (verrou côté UI)

**Files:**
- Modify: `apps/web/src/pages/SpacePage.tsx` (~l.150 `canEditItem`, rendu principal)
- Modify: `apps/web/src/components/ItemEditModal.tsx` (~l.279-286 + en-tête + bandeau)

**Interfaces:**
- Consumes: `useLiveSession`, `LiveWindow`, `LiveSessionBar` ; `setEditingItemId` existant de `SpacePage`.

- [ ] **Step 1: `SpacePage.tsx`**

Imports :
```ts
import { useLiveSession } from '../hooks/useLiveSession';
import { LiveWindow } from '../components/live/LiveWindow';
import { LiveSessionBar } from '../components/live/LiveSessionBar';
```
Après la définition de `space` : `const live = useLiveSession(spaceId);` et la requête des membres du parent :
```ts
  const { data: parentMembers = [] } = useQuery({
    queryKey: ['space-members', live.state?.session.parentSpaceId],
    queryFn: () => spacesApi.getMembers(live.state!.session.parentSpaceId),
    enabled: live.state?.myRole === 'HOST',
  });
```
`canEditItem` : 
```ts
  const canEditItem = useCallback((item: { createdById?: string; lockedAt?: string | null }) => {
    if (!canEdit) return false;
    if (item.lockedAt) return false; // copie de séance : contenu verrouillé (organisation via DnD/tags reste possible)
    if (space?.role === 'OWNER') return true;
    return item.createdById === user?.id;
  }, [canEdit, space?.role, user?.id]);
```
Rendu : juste au-dessus de la barre d'outils de vue (là où `SpaceToolbar` est rendu), ajouter
```tsx
{live.isLiveSpace && live.state && (
  <LiveSessionBar state={live.state} live={live} members={parentMembers} onOpenItem={setEditingItemId} />
)}
```
et en fin de JSX du composant (à côté des modales) :
```tsx
{live.isLiveSpace && live.state && <LiveWindow state={live.state} onOpenItem={setEditingItemId} />}
```
Passer `isLiveSpace={live.isLiveSpace}` à `SpaceToolbar` (Task 8 Step 5). Mettre à jour l'en-tête de `SpacePage.tsx` (une ligne : « espace de séance : LiveSessionBar + LiveWindow (useLiveSession) ; copies verrouillées non éditables »). Vérifier que le DnD des vues reste actif sur les copies : il dépend de `canEdit` (pas de `canEditItem`) — sinon le signaler avant de continuer.

- [ ] **Step 2: `ItemEditModal.tsx`**

Remplacer
```ts
  const canEdit = canEditProp && !visitorPreview && (isNewItem || isSpaceOwner || isItemAuthor || isItemAssignee);
```
par
```ts
  // Copie de séance verrouillée : lecture seule (commentaires et tags restent possibles) — cf. itemLock.ts côté API
  const isLockedCopy = !!item?.lockedAt;
  const canEdit = canEditProp && !visitorPreview && !isLockedCopy && (isNewItem || isSpaceOwner || isItemAuthor || isItemAssignee);
  const canEditTags = canEditProp && !visitorPreview && (canEdit || isLockedCopy);
```
Le sélecteur de tags utilise `canEditTags` au lieu de `canEdit` (repérer le bloc Tags dans le JSX — `Grep "Tags" ItemEditModal.tsx`). À l'enregistrement d'une copie verrouillée, n'envoyer que `tagIds` (+ `updatedAt`) : dans la fonction de sauvegarde, si `isLockedCopy`, construire le payload `{ tagIds, updatedAt }` uniquement (sinon l'API renvoie 403).

Bandeau en haut du corps de la modale quand `isLockedCopy` :
```tsx
{isLockedCopy && (
  <div className="mb-3 rounded border border-orange-300 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 text-xs">
    Copie de séance — présentée le {new Date(item!.lockedAt!).toLocaleString('fr-FR')}. Contenu verrouillé ; commentaires et tags possibles.
  </div>
)}
```
Ajouter au commentaire d'en-tête : « Copie de séance (lockedAt) : lecture seule sauf tags + contributions, bandeau d'origine. »

- [ ] **Step 3:** `pnpm --filter @spok/web typecheck` → 0 erreur.

- [ ] **Step 4: Vérification dans le navigateur intégré** (invoquer le skill `testing-protocol` d'abord ; dev lancé via `pnpm dev:start` si besoin) :
  1. Avec un compte OWNER de communauté : espace de communauté → « Séances » → « Nouvelle séance » → arrivée dans l'espace daté, bandeau « ● Séance en direct », fenêtre « En attente du premier élément ».
  2. « Présenter » → rechercher un item d'un autre espace → « Afficher » : la fenêtre affiche l'item, « Présenté par … », la copie apparaît dans la vue liste.
  3. Ouvrir la copie : bandeau orange, champs non éditables, commentaire possible, tag ajoutable.
  4. Glisser la copie sous un nouvel item créé dans l'espace : OK. Fil : l'entrée reste, cliquable.
  5. Second compte (membre de l'espace parent) dans un autre onglet : « Rejoindre » → voit la fenêtre suivre les affichages suivants sans rechargement ; présence = 2.
  6. Déplacer/redimensionner/réduire la fenêtre, recharger : géométrie conservée.
  7. « Terminer » : la fenêtre des deux comptes passe à « Séance terminée », « Présenter » disparaît.
  Contrôler `read_console_messages` (aucune erreur) et `preview_logs` de l'API. Capture d'écran finale comme preuve.

- [ ] **Step 5: Commit** (si demandé) — `git commit -m "feat: intégration des séances live dans l'espace (fenêtre en direct, verrou UI)"`.

---

### Task 10: Documentation et continuité

**Files:**
- Modify: `docs/ARCHITECTURE.md` (sections Hooks, API routes : `/live-sessions`, `useLiveSession`, queryKey `['live-session', spaceId]`, verrou `itemLock`)
- Modify: `apps/web/src/lib/businessRules.ts` (règles : création réservée OWNER communauté ; accès = membres de l'espace parent ; copie verrouillée sauf organisation ; suppression copie = OWNER espace ; réaffichage sans changement = même copie)
- Modify: `docs/TODO.md` (section « Séances de présentation live » : remplacer les 8 questions par les décisions + étapes 2 et hors périmètre)
- Modify: `docs/session-journal.md`
- SPOK : créer/mettre à jour l'item de doc « Séances de présentation en direct » (skill `spok-doc` pour l'emplacement), statut `to_validate`.

- [ ] **Step 1:** Mettre à jour les 4 fichiers (lire `businessRules.ts` d'abord pour suivre son format).
- [ ] **Step 2:** Doc SPOK via le skill `spok-doc` (MCP `mcp__spok__*`, jamais d'appel direct à l'API).
- [ ] **Step 3: Commit** (si demandé) — `git commit -m "docs: séances live étape 1 (architecture, règles, TODO)"`.

---

## Hors plan (rappel pour l'étape 2)

- Programme préparé par présentateur + déroulé ordonné par l'animateur.
- Compte-rendu généré à la clôture (item non verrouillé).
- Tri « présenté le » dans les vues de l'espace de séance (le fil chronologique couvre le besoin à l'étape 1).
