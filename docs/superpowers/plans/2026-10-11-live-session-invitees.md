# Invités de séance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'animateur d'inviter à une séance des membres de la communauté qui n'ont pas accès à l'espace parent : ils voient l'espace de séance (et la fenêtre en direct), jamais l'espace parent.

**Architecture:** Un invité devient **membre direct (MEMBER) de l'espace de séance**, qui est PRIVÉ ; les droits SPOK étant propres à chaque espace (`checkSpaceAccess`), il n'obtient rien sur l'espace parent. Une table `LiveSessionInvite` trace les invitations (liste, retrait, notification). Invitation à la création (`NewSessionDialog`) et ensuite depuis le bandeau (bouton « Invités », animateur). Retrait = suppression de l'invitation **et** de l'adhésion à l'espace de séance.

**Tech Stack:** Prisma (PostgreSQL), Fastify + zod, React + TanStack Query, Vitest (+ Testing Library, mock Prisma `createMockPrisma`).

**Spec:** conception validée en chat le 2026-10-11 (pas de fichier spec — préférence Thomas) ; résumé ci-dessous et doc SPOK « Séances de présentation en direct [LiveSession] » (`cmv27if320005f3dmsfyejatp`).

Décisions validées (Thomas, 2026-10-11) :
- L'invité voit l'**espace de séance** (éléments présentés, fil, commentaires, réorganisation) + fenêtre en direct ; **jamais l'espace parent**.
- Peuvent être invités : **membres de la communauté** de l'espace parent qui n'ont **pas déjà accès** à l'espace parent.
- Les **membres de l'espace parent** gardent leur accès automatique (« Rejoindre » inchangé).
- Invitation **à la création** et **ensuite depuis le bandeau** (tant que la séance n'est pas terminée) ; **seul l'animateur** invite.
- Après la séance, l'invité **garde l'accès** ; le **retirer** (possible même séance terminée) lui retire l'accès.
- Invité = participant : ni préparation complète, ni « Présenter », jamais présentateur.

## Global Constraints

- Vocabulaire affiché : « Invités », « Préparation » (jamais « programme ») ; textes en français.
- Tout fichier créé ou modifié a un commentaire d'en-tête `/* … */` (raison d'être, params clés, règles d'usage) — contrôlé par `node scripts/check-doc-headers.mjs`.
- Schéma : changement **additif** uniquement (nouvelle table) ; local `pnpm db:push` + `pnpm db:generate` + `pnpm build:packages` ; en prod `start-api.sh` fait le `db push`.
- Notification d'invitation : `createNotification(prisma, { userId, type: 'INVITATION', title, message, link })` de `apps/api/src/utils/notifications.ts` (respecte les préférences de l'utilisateur).
- Pendant le dev : typecheck du seul paquet touché + tests ciblés ; suite complète et typecheck 5 paquets seulement avant le commit final.

## Review Focus

1. **Inviter quelqu'un qui a déjà accès à l'espace parent** (membre direct, ou parent OUVERT à la communauté) → refusé (400) et jamais proposé dans la liste — il rejoint déjà normalement. Test : Task 2 (création) + Task 3 (POST).
2. **Inviter deux fois la même personne** (ou une personne déjà membre de l'espace de séance) → idempotent, pas d'erreur, pas de doublon de notification. Test : Task 3.
3. **Ajouter un invité à une séance terminée** → 409 ; **retirer** reste possible. Test : Task 3.
4. **Un non-animateur** (présentateur, invité, participant) appelle les routes d'invités → 403. Test : Task 3.
5. **Invité retiré alors qu'il a l'espace de séance ouvert** : son flux SSE déjà ouvert continue jusqu'à la déconnexion (contrôle d'accès à la connexion seulement) ; au prochain rechargement → 403/404. Comportement accepté, documenté dans l'en-tête de la route (pas de test d'éjection temps réel).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `packages/database/prisma/schema.prisma` | Modèle `LiveSessionInvite` + relations |
| `packages/shared/src/types/liveSession.ts` | Types `LiveInvitee`, `LiveInviteCandidate` |
| `apps/api/src/utils/liveInvites.ts` (nouveau) | Règles d'invitation : candidats, validation, ajout (adhésion + invitation + notification), retrait |
| `apps/api/src/utils/liveInvites.test.ts` (nouveau) | Tests unitaires des règles |
| `apps/api/src/routes/live-sessions.ts` | `invitees` à la création, routes candidats / liste / ajout / retrait, reprise dans la suite |
| `apps/api/src/routes/live-sessions.test.ts` | Tests des routes |
| `apps/web/src/lib/api.ts` | Client : `inviteCandidates`, `invitees`, `invite`, `uninvite`, `create(..., invitees)` |
| `apps/web/src/components/live/InviteePicker.tsx` (nouveau) | Liste filtrable à cocher de membres de la communauté |
| `apps/web/src/components/live/InviteePicker.test.tsx` (nouveau) | Tests du sélecteur |
| `apps/web/src/components/live/NewSessionDialog.tsx` | Section « Invités » |
| `apps/web/src/components/live/ParentSessionsButton.tsx` | Transmet `invitees` à la création |
| `apps/web/src/components/live/InviteesPanel.tsx` (nouveau) | Panneau du bandeau : invités actuels (Retirer) + ajout |
| `apps/web/src/components/live/LiveSessionBar.tsx` | Bouton « Invités » (animateur) |

---

### Task 1: Schéma et types partagés

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (après `model LiveSessionAgendaItem`, + relations dans `LiveSession` et `User`)
- Modify: `packages/shared/src/types/liveSession.ts`

**Interfaces:**
- Produces: table `live_session_invites` (Prisma `liveSessionInvite`), types `LiveInvitee`, `LiveInviteCandidate`.

- [ ] **Step 1: Ajouter le modèle**

```prisma
// Invitation à une séance d'un membre de la communauté SANS accès à l'espace parent : il devient membre
// de l'espace de séance (PRIVÉ) uniquement. Retirer l'invitation retire aussi cette adhésion.
model LiveSessionInvite {
  id          String   @id @default(cuid())
  sessionId   String
  userId      String
  invitedById String
  createdAt   DateTime @default(now())

  session   LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user      User        @relation("LiveSessionInvitee", fields: [userId], references: [id], onDelete: Cascade)
  invitedBy User        @relation("LiveSessionInviter", fields: [invitedById], references: [id], onDelete: Cascade)

  @@unique([sessionId, userId])
  @@map("live_session_invites")
}
```

Dans `model LiveSession`, ajouter `invites LiveSessionInvite[]` ; dans `model User`, ajouter :

```prisma
  liveSessionInvites   LiveSessionInvite[] @relation("LiveSessionInvitee")
  liveSessionInvitesBy LiveSessionInvite[] @relation("LiveSessionInviter")
```

- [ ] **Step 2: Types partagés** (fin de `liveSession.ts`)

```ts
/** Invité d'une séance (membre de la communauté sans accès à l'espace parent). */
export interface LiveInvitee { userId: string; user: LiveUser; invitedAt: string }

/** Membre de la communauté pouvant être invité (aucun accès à l'espace parent). */
export interface LiveInviteCandidate { userId: string; name: string; email: string }
```

- [ ] **Step 3: Appliquer en local**

Run: `pnpm db:push && pnpm db:generate && pnpm build:packages`
Expected: « Your database is now in sync », build OK.

- [ ] **Step 4: Commit** — `git add packages/database/prisma/schema.prisma packages/shared/src/types/liveSession.ts` puis `git commit -m "feat: séances live - modèle des invités"`.

---

### Task 2: Règles d'invitation (API, utilitaire testé)

**Files:**
- Create: `apps/api/src/utils/liveInvites.ts`
- Test: `apps/api/src/utils/liveInvites.test.ts`

**Interfaces:**
- Consumes: `checkSpaceAccess(prisma, userId, spaceId)` (`routes/items.ts`), `createNotification` (`utils/notifications.ts`).
- Produces:
  - `listInviteCandidates(prisma, parentSpaceId: string, excludeUserIds: string[]): Promise<LiveInviteCandidate[]>`
  - `assertInvitable(prisma, parentSpaceId: string, userIds: string[]): Promise<string | null>` — message d'erreur ou null
  - `addInvitees(prisma, session: { id, spaceId, parentSpaceId, hostId }, userIds: string[], invitedById: string, sessionName: string): Promise<string[]>` — ids réellement ajoutés (nouveaux)
  - `removeInvitee(prisma, session: { id, spaceId }, userId: string): Promise<boolean>`
  - `listInvitees(prisma, sessionId: string): Promise<LiveInvitee[]>`

- [ ] **Step 1: Tests**

```ts
/* Tests des règles d'invitation de séance : candidats (communauté sans accès au parent), validation,
 * ajout idempotent (adhésion espace de séance + invitation + notification), retrait. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrisma, MockPrisma } from '../test/helpers.js'

vi.mock('../routes/items.js', () => ({ checkSpaceAccess: vi.fn() }))
vi.mock('./notifications.js', () => ({ createNotification: vi.fn(async () => {}) }))
import { checkSpaceAccess } from '../routes/items.js'
import { createNotification } from './notifications.js'
import { listInviteCandidates, assertInvitable, addInvitees, removeInvitee } from './liveInvites.js'

const session = { id: 'ls-1', spaceId: 'sess-space', parentSpaceId: 'parent', hostId: 'host' }

describe('liveInvites', () => {
  let prisma: MockPrisma
  beforeEach(() => {
    prisma = createMockPrisma()
    vi.mocked(checkSpaceAccess).mockReset()
    vi.mocked(createNotification).mockClear()
    prisma.space.findUnique.mockResolvedValue({ id: 'parent', communityId: 'c1' })
  })

  it('candidats : membres de la communauté sans accès au parent, hors exclus', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([
      { userId: 'a', user: { id: 'a', name: 'Alice', email: 'a@x' } },
      { userId: 'b', user: { id: 'b', name: 'Bob', email: 'b@x' } },
      { userId: 'host', user: { id: 'host', name: 'Hôte', email: 'h@x' } },
    ])
    vi.mocked(checkSpaceAccess).mockImplementation(async (_p, uid) => (uid === 'b' ? ({ role: 'MEMBER' } as any) : null))
    expect(await listInviteCandidates(prisma as any, 'parent', ['host'])).toEqual([{ userId: 'a', name: 'Alice', email: 'a@x' }])
  })

  it('validation : refuse un non-membre de la communauté', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([])
    expect(await assertInvitable(prisma as any, 'parent', ['z'])).toMatch(/communauté/)
  })

  it('validation : refuse quelqu\'un qui a déjà accès à l\'espace parent', async () => {
    prisma.communityMembership.findMany.mockResolvedValue([{ userId: 'b' }])
    vi.mocked(checkSpaceAccess).mockResolvedValue({ role: 'MEMBER' } as any)
    expect(await assertInvitable(prisma as any, 'parent', ['b'])).toMatch(/déjà accès/)
  })

  it('ajout : adhésion MEMBER à l\'espace de séance + invitation + notification, idempotent', async () => {
    prisma.liveSessionInvite.findUnique.mockImplementation(async (args: any) => (args.where.sessionId_userId.userId === 'old' ? { id: 'x' } : null))
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    const added = await addInvitees(prisma as any, session, ['a', 'old', 'a'], 'host', '2026-10-11')
    expect(added).toEqual(['a'])
    expect(prisma.spaceMembership.create).toHaveBeenCalledWith({ data: { userId: 'a', spaceId: 'sess-space', role: 'MEMBER' } })
    expect(prisma.liveSessionInvite.create).toHaveBeenCalledWith({ data: { sessionId: 'ls-1', userId: 'a', invitedById: 'host' } })
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createNotification).mock.calls[0][1]).toMatchObject({ userId: 'a', type: 'INVITATION', link: '/spaces/sess-space' })
  })

  it('retrait : supprime invitation et adhésion à l\'espace de séance', async () => {
    prisma.liveSessionInvite.findUnique.mockResolvedValue({ id: 'inv' })
    expect(await removeInvitee(prisma as any, session, 'a')).toBe(true)
    expect(prisma.liveSessionInvite.delete).toHaveBeenCalledWith({ where: { id: 'inv' } })
    expect(prisma.spaceMembership.deleteMany).toHaveBeenCalledWith({ where: { userId: 'a', spaceId: 'sess-space' } })
  })

  it('retrait d\'un non-invité : false, rien supprimé', async () => {
    prisma.liveSessionInvite.findUnique.mockResolvedValue(null)
    expect(await removeInvitee(prisma as any, session, 'a')).toBe(false)
    expect(prisma.spaceMembership.deleteMany).not.toHaveBeenCalled()
  })
})
```

Si `createMockPrisma` ne connaît pas `liveSessionInvite`, l'ajouter dans `apps/api/src/test/helpers.ts` : `liveSessionInvite: mockModel(),` (à côté de `liveSessionAgendaItem`).

- [ ] **Step 2: Lancer — échec attendu** — `npx vitest run --project api apps/api/src/utils/liveInvites.test.ts` → FAIL (module absent).

- [ ] **Step 3: Implémenter**

```ts
/*
 * Règles d'invitation aux séances live (invités = membres de la communauté SANS accès à l'espace parent).
 * Un invité devient membre MEMBER de l'espace de séance (PRIVÉ) — les droits étant propres à chaque espace,
 * il n'obtient rien sur l'espace parent. Retrait = suppression de l'invitation ET de cette adhésion.
 * Limite assumée : un flux SSE déjà ouvert n'est pas coupé au retrait (contrôle à la connexion seulement).
 * Utilisé par routes/live-sessions.ts (création, /:id/invitees, /invite-candidates, suite).
 */
import type { LiveInviteCandidate, LiveInvitee } from '@spok/shared';
import { checkSpaceAccess } from '../routes/items.js';
import { createNotification } from './notifications.js';

const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;

async function communityOf(prisma: any, parentSpaceId: string): Promise<string | null> {
  const parent = await prisma.space.findUnique({ where: { id: parentSpaceId }, select: { communityId: true } });
  return parent?.communityId ?? null;
}

export async function listInviteCandidates(prisma: any, parentSpaceId: string, excludeUserIds: string[]): Promise<LiveInviteCandidate[]> {
  const communityId = await communityOf(prisma, parentSpaceId);
  if (!communityId) return [];
  const members = (await prisma.communityMembership.findMany({
    where: { communityId }, include: { user: { select: { id: true, name: true, email: true } } },
  })) ?? [];
  const exclude = new Set(excludeUserIds);
  const result: LiveInviteCandidate[] = [];
  for (const m of members) {
    if (exclude.has(m.userId)) continue;
    if (await checkSpaceAccess(prisma, m.userId, parentSpaceId)) continue;
    result.push({ userId: m.userId, name: m.user?.name ?? '', email: m.user?.email ?? '' });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function assertInvitable(prisma: any, parentSpaceId: string, userIds: string[]): Promise<string | null> {
  const communityId = await communityOf(prisma, parentSpaceId);
  if (!communityId) return 'Espace sans communauté';
  const members = (await prisma.communityMembership.findMany({ where: { communityId, userId: { in: userIds } }, select: { userId: true } })) ?? [];
  const inCommunity = new Set(members.map((m: any) => m.userId));
  for (const id of userIds) {
    if (!inCommunity.has(id)) return 'Seuls des membres de la communauté peuvent être invités';
    if (await checkSpaceAccess(prisma, id, parentSpaceId)) return 'Cette personne a déjà accès à l\'espace : elle peut rejoindre la séance sans invitation';
  }
  return null;
}

export async function addInvitees(
  prisma: any, session: { id: string; spaceId: string }, userIds: string[], invitedById: string, sessionName: string,
): Promise<string[]> {
  const added: string[] = [];
  for (const userId of [...new Set(userIds)]) {
    const existing = await prisma.liveSessionInvite.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
    if (existing) continue;
    const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: session.spaceId } } });
    if (!m) await prisma.spaceMembership.create({ data: { userId, spaceId: session.spaceId, role: 'MEMBER' } });
    await prisma.liveSessionInvite.create({ data: { sessionId: session.id, userId, invitedById } });
    await createNotification(prisma, {
      userId, type: 'INVITATION',
      title: `Invitation à la séance « ${sessionName} »`,
      message: 'Vous êtes invité à une séance de présentation.',
      link: `/spaces/${session.spaceId}`,
    });
    added.push(userId);
  }
  return added;
}

export async function removeInvitee(prisma: any, session: { id: string; spaceId: string }, userId: string): Promise<boolean> {
  const invite = await prisma.liveSessionInvite.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
  if (!invite) return false;
  await prisma.liveSessionInvite.delete({ where: { id: invite.id } });
  await prisma.spaceMembership.deleteMany({ where: { userId, spaceId: session.spaceId } });
  return true;
}

export async function listInvitees(prisma: any, sessionId: string): Promise<LiveInvitee[]> {
  const rows = (await prisma.liveSessionInvite.findMany({
    where: { sessionId }, include: { user: { select: USER_SELECT } }, orderBy: { createdAt: 'asc' },
  })) ?? [];
  return rows.map((r: any) => ({ userId: r.userId, user: r.user, invitedAt: new Date(r.createdAt).toISOString() }));
}
```

- [ ] **Step 4: Lancer — vert attendu** — même commande → 6 passed.

- [ ] **Step 5: Commit** — `git add apps/api/src/utils/liveInvites.ts apps/api/src/utils/liveInvites.test.ts apps/api/src/test/helpers.ts` + `git commit -m "feat: séances live - règles d'invitation"`.

---

### Task 3: Routes API (création, candidats, liste, ajout, retrait, suite)

**Files:**
- Modify: `apps/api/src/routes/live-sessions.ts`
- Test: `apps/api/src/routes/live-sessions.test.ts`

**Interfaces:**
- Consumes: Task 2 (`listInviteCandidates`, `assertInvitable`, `addInvitees`, `removeInvitee`, `listInvitees`).
- Produces (HTTP) :
  - `POST /live-sessions` : champ facultatif `invitees: string[]` (max 200).
  - `GET /live-sessions/invite-candidates?parentSpaceId=` → `LiveInviteCandidate[]` (OWNER de la communauté ou animateur d'une séance de ce parent ; sinon 403).
  - `GET /live-sessions/:id/invitees` → `LiveInvitee[]` (animateur).
  - `POST /live-sessions/:id/invitees` body `{ userIds: string[] }` → `LiveInvitee[]` (animateur, séance non terminée).
  - `DELETE /live-sessions/:id/invitees/:userId` → `LiveInvitee[]` (animateur, toute séance).

- [ ] **Step 1: Tests** — ajouter dans `live-sessions.test.ts` (même fichier, mock `../utils/liveInvites.js` pour isoler les routes) :

```ts
// En haut du fichier, avec les autres vi.mock :
const invites = vi.hoisted(() => ({
  listInviteCandidates: vi.fn(async () => [{ userId: 'a', name: 'Alice', email: 'a@x' }]),
  assertInvitable: vi.fn(async () => null),
  addInvitees: vi.fn(async (_p: any, _s: any, ids: string[]) => ids),
  removeInvitee: vi.fn(async () => true),
  listInvitees: vi.fn(async () => []),
}))
vi.mock('../utils/liveInvites.js', () => invites)
```

```ts
  describe('invités', () => {
    beforeEach(() => { Object.values(invites).forEach((f: any) => f.mockClear()) })

    it('création avec invités : validés puis ajoutés à la nouvelle séance', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      prisma.space.create.mockResolvedValue({ id: 'sess-space', name: '2026-10-11' })
      prisma.liveSession.create.mockResolvedValue({ ...session, status: 'PREPARED' })
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED', roles: [], entries: [] })
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', invitees: ['a'] } })
      expect(res.statusCode).toBe(201)
      expect(invites.assertInvitable).toHaveBeenCalledWith(expect.anything(), 'parent', ['a'])
      expect(invites.addInvitees.mock.calls[0][2]).toEqual(['a'])
    })

    it('création refusée si un invité n\'est pas invitable, rien créé', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      invites.assertInvitable.mockResolvedValueOnce('Cette personne a déjà accès à l\'espace')
      const res = await app.inject({ method: 'POST', url: '/live-sessions', headers: auth(), payload: { parentSpaceId: 'parent', invitees: ['b'] } })
      expect(res.statusCode).toBe(400)
      expect(prisma.space.create).not.toHaveBeenCalled()
    })

    it('candidats : réservé à un OWNER de la communauté (403 sinon)', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
      prisma.liveSession.findFirst.mockResolvedValue(null)
      const res = await app.inject({ method: 'GET', url: '/live-sessions/invite-candidates?parentSpaceId=parent', headers: auth() })
      expect(res.statusCode).toBe(403)
    })

    it('candidats : OWNER → liste sans l\'utilisateur courant', async () => {
      prisma.communityMembership.findUnique.mockResolvedValue({ role: 'OWNER' })
      const res = await app.inject({ method: 'GET', url: '/live-sessions/invite-candidates?parentSpaceId=parent', headers: auth() })
      expect(res.statusCode).toBe(200)
      expect(invites.listInviteCandidates).toHaveBeenCalledWith(expect.anything(), 'parent', [USER])
    })

    it('ajout : réservé à l\'animateur', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'quelquun-d-autre' })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a'] } })
      expect(res.statusCode).toBe(403)
    })

    it('ajout refusé sur une séance terminée (409), retrait autorisé', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'ENDED', space: { name: 'S' } })
      const add = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a'] } })
      expect(add.statusCode).toBe(409)
      const del = await app.inject({ method: 'DELETE', url: '/live-sessions/ls-1/invitees/a', headers: auth() })
      expect(del.statusCode).toBe(200)
      expect(invites.removeInvitee).toHaveBeenCalled()
    })

    it('ajout : invités validés puis ajoutés, renvoie la liste', async () => {
      prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'LIVE', space: { name: 'S' } })
      const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/invitees', headers: auth(), payload: { userIds: ['a', 'a'] } })
      expect(res.statusCode).toBe(200)
      expect(invites.addInvitees.mock.calls[0][2]).toEqual(['a', 'a']) // dédoublonnage dans addInvitees (Task 2)
      expect(invites.listInvitees).toHaveBeenCalledWith(expect.anything(), 'ls-1')
    })
  })
```

- [ ] **Step 2: Lancer — échec attendu** — `npx vitest run --project api apps/api/src/routes/live-sessions.test.ts` → FAIL sur les tests « invités ».

- [ ] **Step 3: Implémenter**

Import : `import { addInvitees, assertInvitable, listInviteCandidates, listInvitees, removeInvitee } from '../utils/liveInvites.js';`

`createSchema` : ajouter `invitees: z.array(z.string()).max(200).optional(),` et `const inviteesSchema = z.object({ userIds: z.array(z.string()).min(1).max(200) });`

Dans `POST /` — après la validation de la préparation initiale, AVANT `uniqueName` :

```ts
    const inviteeIds = [...new Set(body.invitees ?? [])].filter((id) => id !== userId);
    if (inviteeIds.length > 0) {
      const invalid = await assertInvitable(prisma, parent.id, inviteeIds);
      if (invalid) return reply.badRequest(invalid);
    }
```

et après la création de la préparation initiale :

```ts
    if (inviteeIds.length > 0) await addInvitees(prisma, s, inviteeIds, userId, name);
```

Nouvelles routes (placer `/invite-candidates` AVANT les routes `/:id/...` pour éviter toute ambiguïté) :

```ts
  /** Animateur de la séance ; sinon répond 404/403 et retourne null. */
  async function sessionForHost(reply: FastifyReply, id: string, userId: string) {
    const s = await prisma.liveSession.findUnique({ where: { id }, include: { space: { select: { name: true } } } });
    if (!s) { reply.notFound('Séance introuvable'); return null; }
    if (s.hostId !== userId) { reply.forbidden('Réservé à l\'animateur'); return null; }
    return s;
  }

  // Membres de la communauté invitables (sans accès à l'espace parent) — OWNER de la communauté ou animateur
  fastify.get<{ Querystring: { parentSpaceId?: string } }>('/invite-candidates', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { parentSpaceId } = request.query;
    if (!parentSpaceId) return reply.badRequest('parentSpaceId requis');
    const parent = await prisma.space.findUnique({ where: { id: parentSpaceId } });
    if (!parent?.communityId) return reply.notFound('Espace introuvable');
    const cm = await prisma.communityMembership.findUnique({ where: { userId_communityId: { userId, communityId: parent.communityId } } });
    const isHost = await prisma.liveSession.findFirst({ where: { parentSpaceId, hostId: userId }, select: { id: true } });
    if (cm?.role !== 'OWNER' && !isHost) return reply.forbidden('Réservé à l\'animateur');
    return listInviteCandidates(prisma, parentSpaceId, [userId]);
  });

  fastify.get<{ Params: { id: string } }>('/:id/invitees', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await sessionForHost(reply, request.params.id, request.user.userId);
    if (!s) return reply;
    return listInvitees(prisma, s.id);
  });

  fastify.post<{ Params: { id: string } }>('/:id/invitees', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await sessionForHost(reply, request.params.id, userId);
    if (!s) return reply;
    if (s.status === 'ENDED') return reply.conflict('Séance terminée : plus d\'invitation possible');
    const { userIds } = inviteesSchema.parse(request.body);
    const ids = userIds.filter((id) => id !== s.hostId);
    const invalid = await assertInvitable(prisma, s.parentSpaceId, [...new Set(ids)]);
    if (invalid) return reply.badRequest(invalid);
    await addInvitees(prisma, s, ids, userId, s.space?.name ?? '');
    return listInvitees(prisma, s.id);
  });

  // Retirer un invité (même séance terminée) : retire aussi son accès à l'espace de séance
  fastify.delete<{ Params: { id: string; userId: string } }>('/:id/invitees/:userId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await sessionForHost(reply, request.params.id, request.user.userId);
    if (!s) return reply;
    await removeInvitee(prisma, s, request.params.userId);
    return listInvitees(prisma, s.id);
  });
```

Suite (`POST /:id/suite`) — après la reprise des présentateurs, reprendre les invités toujours invitables :

```ts
    const prevInvites = (await prisma.liveSessionInvite.findMany({ where: { sessionId: prev.id }, select: { userId: true } })) ?? [];
    const keep: string[] = [];
    for (const { userId: id } of prevInvites) if (!(await assertInvitable(prisma, prev.parentSpaceId, [id]))) keep.push(id);
    if (keep.length > 0) await addInvitees(prisma, next, keep, userId, name);
```

(`next` = séance créée, `name` = nom de la suite — reprendre les noms de variables exacts de la route.)

En-tête du fichier : ajouter une ligne « - Invités (/:id/invitees, /invite-candidates, champ invitees à la création) : membres de la communauté sans accès à l'espace parent, membres de l'espace de séance seulement (utils/liveInvites) ; animateur seul ; repris dans la suite. »

- [ ] **Step 4: Lancer — vert attendu** — même commande ; puis `pnpm --filter @spok/api exec tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit** — `git add apps/api/src/routes/live-sessions.ts apps/api/src/routes/live-sessions.test.ts` + `git commit -m "feat: séances live - routes des invités"`.

---

### Task 4: Web — sélecteur d'invités et fenêtre de création

**Files:**
- Modify: `apps/web/src/lib/api.ts` (objet `liveSessionsApi`)
- Create: `apps/web/src/components/live/InviteePicker.tsx`
- Test: `apps/web/src/components/live/InviteePicker.test.tsx`
- Modify: `apps/web/src/components/live/NewSessionDialog.tsx`, `apps/web/src/components/live/ParentSessionsButton.tsx`

**Interfaces:**
- Consumes: routes de Task 3, types `LiveInviteCandidate`, `LiveInvitee` (`@spok/shared`).
- Produces:
  - `liveSessionsApi.create(parentSpaceId, name?, agenda?, invitees?: string[])`
  - `liveSessionsApi.inviteCandidates(parentSpaceId: string): Promise<LiveInviteCandidate[]>`
  - `liveSessionsApi.invitees(id: string): Promise<LiveInvitee[]>`
  - `liveSessionsApi.invite(id: string, userIds: string[]): Promise<LiveInvitee[]>`
  - `liveSessionsApi.uninvite(id: string, userId: string): Promise<LiveInvitee[]>`
  - `<InviteePicker candidates={LiveInviteCandidate[]} selected={string[]} onChange={(ids: string[]) => void} />`
  - `NewSessionDialog` : `onCreate(agenda, invitees: string[])`

- [ ] **Step 1: Client API**

```ts
  /** Crée une séance préparée ; agenda = préparation initiale ; invitees = membres de la communauté sans accès au parent. */
  create: (parentSpaceId: string, name?: string, agenda?: Array<{ sourceItemId: string; includeChildren?: boolean }>, invitees?: string[]) =>
    fetchApi<LiveSessionState>('/live-sessions', { method: 'POST', body: JSON.stringify({ parentSpaceId, name, agenda, invitees }) }),
  inviteCandidates: (parentSpaceId: string) =>
    fetchApi<LiveInviteCandidate[]>(`/live-sessions/invite-candidates?parentSpaceId=${encodeURIComponent(parentSpaceId)}`),
  invitees: (id: string) => fetchApi<LiveInvitee[]>(`/live-sessions/${id}/invitees`),
  invite: (id: string, userIds: string[]) =>
    fetchApi<LiveInvitee[]>(`/live-sessions/${id}/invitees`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  uninvite: (id: string, userId: string) =>
    fetchApi<LiveInvitee[]>(`/live-sessions/${id}/invitees/${userId}`, { method: 'DELETE' }),
```

(ajouter `LiveInviteCandidate, LiveInvitee` à l'import de `@spok/shared` en tête de `api.ts`.)

- [ ] **Step 2: Tests du sélecteur**

```tsx
/* Tests de InviteePicker : filtre par nom/e-mail, cocher/décocher, message si personne n'est invitable. */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { InviteePicker } from './InviteePicker'

const candidates = [
  { userId: 'a', name: 'Alice Martin', email: 'alice@x.fr' },
  { userId: 'b', name: 'Bruno', email: 'bruno@y.fr' },
]

describe('InviteePicker', () => {
  it('filtre par nom ou e-mail', () => {
    const { getByPlaceholderText, queryByText } = render(<InviteePicker candidates={candidates} selected={[]} onChange={() => {}} />)
    fireEvent.change(getByPlaceholderText('Rechercher un membre de la communauté'), { target: { value: 'y.fr' } })
    expect(queryByText('Alice Martin')).toBeNull()
    expect(queryByText('Bruno')).not.toBeNull()
  })

  it('cocher ajoute, décocher retire', () => {
    const onChange = vi.fn()
    const { getByLabelText, rerender } = render(<InviteePicker candidates={candidates} selected={[]} onChange={onChange} />)
    fireEvent.click(getByLabelText('Alice Martin'))
    expect(onChange).toHaveBeenLastCalledWith(['a'])
    rerender(<InviteePicker candidates={candidates} selected={['a']} onChange={onChange} />)
    fireEvent.click(getByLabelText('Alice Martin'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('personne à inviter : message explicite', () => {
    const { getByText } = render(<InviteePicker candidates={[]} selected={[]} onChange={() => {}} />)
    getByText(/Tous les membres de la communauté ont déjà accès/)
  })
})
```

- [ ] **Step 3: Lancer — échec attendu** — `npx vitest run --project web apps/web/src/components/live/InviteePicker.test.tsx` → FAIL.

- [ ] **Step 4: Implémenter `InviteePicker.tsx`**

```tsx
/*
 * InviteePicker — liste filtrable à cocher de membres de la communauté invitables à une séance
 * (déjà filtrés côté API : aucun accès à l'espace parent). Composant contrôlé : selected / onChange(ids).
 * Utilisé par NewSessionDialog (création) et InviteesPanel (bandeau). Ne fait aucun appel réseau.
 */
import { useState } from 'react';
import type { LiveInviteCandidate } from '@spok/shared';

export function InviteePicker({ candidates, selected, onChange }: {
  candidates: LiveInviteCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  if (candidates.length === 0) {
    return <p className="text-xs text-muted-foreground">Tous les membres de la communauté ont déjà accès à l'espace : ils peuvent rejoindre la séance sans invitation.</p>;
  }
  const q = query.trim().toLowerCase();
  const shown = q ? candidates.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : candidates;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div>
      <input
        className="w-full mb-2 h-8 px-2 rounded border border-input bg-background text-sm"
        placeholder="Rechercher un membre de la communauté"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="max-h-40 overflow-auto divide-y divide-border border border-border rounded-md">
        {shown.map((c) => (
          <li key={c.userId} className="px-3 py-1.5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" aria-label={c.name} checked={selected.includes(c.userId)} onChange={() => toggle(c.userId)} />
              <span className="truncate">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground truncate">{c.email}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Section « Invités » dans `NewSessionDialog`** — charger `useQuery({ queryKey: ['live-invite-candidates', spaceId], queryFn: () => liveSessionsApi.inviteCandidates(spaceId) })`, état `const [invitees, setInvitees] = useState<string[]>([])`, afficher sous la liste des éléments :

```tsx
      <h3 className="text-sm font-medium mt-4 mb-1">Invités</h3>
      <p className="text-xs text-muted-foreground mb-2">Membres de la communauté sans accès à cet espace : ils verront la séance, pas l'espace.</p>
      <InviteePicker candidates={candidateData ?? []} selected={invitees} onChange={setInvitees} />
```

et passer `onCreate(toAgendaPayload(choices, selection), invitees)`. Signature : `onCreate: (agenda: AgendaPayload, invitees: string[]) => void`. Mettre à jour l'en-tête du fichier et `NewSessionDialog.test.tsx` (mock `liveSessionsApi.inviteCandidates` → `[]` ; les attentes deviennent `toHaveBeenCalledWith([...], [])`). Ajouter `liveSessionsApi` au `vi.mock('../../lib/api', …)` du test.

- [ ] **Step 6: `ParentSessionsButton`** — `create(agenda, invitees)` → `liveSessionsApi.create(spaceId, todayLocal(), agenda, invitees)` ; `onCreate={(agenda, invitees) => { void create(agenda, invitees); }}`.

- [ ] **Step 7: Lancer** — `npx vitest run --project web apps/web/src/components/live` → tout vert ; `pnpm --filter @spok/web exec tsc --noEmit` → exit 0.

- [ ] **Step 8: Commit** — fichiers de la tâche + `git commit -m "feat: séances live - invités à la création de la séance"`.

---

### Task 5: Web — bouton « Invités » du bandeau

**Files:**
- Create: `apps/web/src/components/live/InviteesPanel.tsx`
- Modify: `apps/web/src/components/live/LiveSessionBar.tsx`

**Interfaces:**
- Consumes: `liveSessionsApi.invitees / invite / uninvite / inviteCandidates`, `InviteePicker`.
- Produces: `<InviteesPanel sessionId={string} parentSpaceId={string} ended={boolean} />`

- [ ] **Step 1: Implémenter `InviteesPanel.tsx`**

```tsx
/*
 * InviteesPanel — panneau du bandeau de séance (bouton « Invités », animateur seul) : invités actuels avec
 * « Retirer » (possible même séance terminée — retire l'accès à l'espace de séance) et, tant que la séance
 * n'est pas terminée, ajout via InviteePicker. Invités = membres de la communauté sans accès à l'espace parent.
 * Props : sessionId, parentSpaceId (candidats), ended (masque l'ajout).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { liveSessionsApi } from '../../lib/api';
import { InviteePicker } from './InviteePicker';

export function InviteesPanel({ sessionId, parentSpaceId, ended }: { sessionId: string; parentSpaceId: string; ended: boolean }) {
  const queryClient = useQueryClient();
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: invitees = [] } = useQuery({ queryKey: ['live-invitees', sessionId], queryFn: () => liveSessionsApi.invitees(sessionId) });
  const { data: candidates = [] } = useQuery({
    queryKey: ['live-invite-candidates', parentSpaceId],
    queryFn: () => liveSessionsApi.inviteCandidates(parentSpaceId),
    enabled: !ended,
  });
  const invitedIds = new Set(invitees.map((i) => i.userId));
  const refresh = (list: typeof invitees) => {
    queryClient.setQueryData(['live-invitees', sessionId], list);
    queryClient.invalidateQueries({ queryKey: ['live-invite-candidates', parentSpaceId] });
  };
  const run = async (fn: () => Promise<typeof invitees>) => {
    setError(null);
    try { refresh(await fn()); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible'); }
  };

  return (
    <div className="w-80 text-sm">
      <h3 className="font-medium mb-1">Invités</h3>
      {invitees.length === 0 && <p className="text-xs text-muted-foreground mb-2">Aucun invité.</p>}
      <ul className="mb-3 divide-y divide-border">
        {invitees.map((i) => (
          <li key={i.userId} className="flex items-center gap-2 py-1">
            <span className="flex-1 truncate">{i.user.name}</span>
            <button className="text-xs hover:underline text-red-600" onClick={() => run(() => liveSessionsApi.uninvite(sessionId, i.userId))}>Retirer</button>
          </li>
        ))}
      </ul>
      {!ended && (
        <>
          <InviteePicker candidates={candidates.filter((c) => !invitedIds.has(c.userId))} selected={toAdd} onChange={setToAdd} />
          <button
            className="mt-2 w-full rounded bg-orange-500 px-2 py-1 text-white disabled:opacity-50"
            disabled={toAdd.length === 0}
            onClick={() => run(async () => { const list = await liveSessionsApi.invite(sessionId, toAdd); setToAdd([]); return list; })}
          >
            Inviter {toAdd.length > 0 ? `(${toAdd.length})` : ''}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Bouton dans `LiveSessionBar`** — à côté de « Présentateurs », visible si `state.myRole === 'HOST'` (toutes séances) : `<button className="hover:underline" onClick={() => toggle('invitees')}>Invités</button>` ; dans le rendu des panneaux, `open === 'invitees'` → `<InviteesPanel sessionId={state.session.id} parentSpaceId={state.session.parentSpaceId} ended={state.session.status === 'ENDED'} />` dans le même conteneur popover que le panneau « Présentateurs » (reprendre ses classes). Ajouter `'invitees'` au type de l'état `open`. Mettre à jour l'en-tête (« Invités » (animateur)).

- [ ] **Step 3: Vérifier** — `pnpm --filter @spok/web exec tsc --noEmit` → 0 ; `npx vitest run --project web apps/web/src/components/live` → vert.

- [ ] **Step 4: Commit** — `git add apps/web/src/components/live/InviteesPanel.tsx apps/web/src/components/live/LiveSessionBar.tsx` + `git commit -m "feat: séances live - gestion des invités depuis le bandeau"`.

---

### Task 6: Vérification réelle, documentation

**Files:**
- Modify: `apps/web/src/lib/businessRules.ts` (nouvelle règle `live-session-invitees`), `docs/session-journal.md`, `docs/TODO.md`
- SPOK : item `cmv27if320005f3dmsfyejatp` (remplacer la note [À REVOIR] par la règle des invités)

- [ ] **Step 1: Vérification navigateur (local)** — compte `admin@spok.app` (OWNER de « Un JDR ») : espace parent PRIVÉ ; s'assurer que `alice@spok.app` est membre de la communauté mais pas de l'espace parent (sinon l'ajouter à la communauté via l'admin local) ; « Nouvelle séance » → Alice proposée dans « Invités » → créer. Puis, connecté en Alice (fenêtre de navigation privée ou déconnexion/reconnexion) : notification présente, séance listée dans « séances en cours », l'espace de séance s'ouvre, l'espace parent → 403/« introuvable ». Retirer Alice depuis le bandeau → l'espace de séance n'est plus accessible pour elle.

- [ ] **Step 2: Règle de gestion**

```ts
  {
    id: 'live-session-invitees',
    page: 'Séances live (Préparer la séance, bandeau « Invités »)',
    trigger: "L'animateur invite des membres de la communauté",
    effect: "Seuls des membres de la communauté SANS accès à l'espace parent peuvent être invités (les autres rejoignent déjà). L'invité devient membre de l'espace de séance seulement : il voit la séance (éléments présentés, fil, commentaires, réorganisation) et la fenêtre en direct, jamais l'espace parent ; il est participant (ni préparation complète, ni présentation). Notification à l'invitation. Invitation à la création ou depuis le bandeau tant que la séance n'est pas terminée ; retrait possible à tout moment (retire l'accès). Les invités sont repris dans la suite s'ils restent invitables",
    location: 'apps/api/src/utils/liveInvites.ts, apps/api/src/routes/live-sessions.ts, apps/web/src/components/live/InviteesPanel.tsx',
  },
```

- [ ] **Step 3: Doc SPOK, journal, TODO** — mettre à jour l'item LiveSession (section Accès : « membres de l'espace parent + invités ») ; journal EN COURS ; TODO.

- [ ] **Step 4: Contrôles finaux** — `node scripts/check-doc-headers.mjs` → OK ; typecheck 5 paquets + suite complète en tâche de fond juste avant le commit de mise en production (sur demande de Thomas).
