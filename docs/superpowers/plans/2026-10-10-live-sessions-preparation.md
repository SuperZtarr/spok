# Séances live — Étape 2 « Préparation et séance active » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline, défaut de Thomas). Steps use checkbox (`- [ ]`) syntax.

**Goal:** La séance se prépare avant d'être démarrée (programme ordonné d'éléments venant de n'importe quel espace) et la fenêtre en direct suit l'utilisateur partout dans l'application ; on peut ajouter au programme ou présenter un item depuis son menu contextuel ou sa fenêtre d'édition.

**Architecture:** Statut `PREPARED` ajouté avant `LIVE` ; table `LiveSessionAgendaItem` (liens vers des items sources, pas de copie) ; nouvelles routes start/agenda ; `display` accepte un élément du programme ou un item seul (espace résolu côté serveur). Côté web, un store Zustand `useActiveLiveSessionStore` retient la séance active (persistée), un composant `LiveSessionHost` monté dans `App.tsx` ouvre l'unique flux SSE et affiche `LiveWindow` partout ; `SpacePage` ne fait plus que lire le cache.

**Tech Stack:** identique à l'étape 1 (Fastify, Prisma db push, React, TanStack Query, Zustand, Vitest).

**Spec:** conception validée en chat le 2026-10-10 (« oui »), résumée ci-dessous. Étape 1 : `docs/superpowers/plans/2026-10-10-live-sessions-socle.md`.

## Décisions de conception

1. **Cycle de vie** : `PREPARED` (créée par « Nouvelle séance ») → `LIVE` (« Démarrer la séance », animateur) → `ENDED`. Rejoindre est possible en `PREPARED`. Afficher n'est possible qu'en `LIVE`.
2. **Programme** : une liste ordonnée par séance ; chaque ligne = item source + espace source + présentateur qui l'a ajoutée + titre au moment de l'ajout ; aucun contenu copié avant l'affichage. Ajout en `PREPARED` ou `LIVE` par animateur/présentateurs, avec contrôle d'accès à la source.
3. **Ordre** : l'animateur réordonne tout ; un présentateur ne permute que ses propres lignes entre les positions qu'elles occupent (les lignes des autres restent à leur place). Retirer : sa propre ligne, ou n'importe laquelle pour l'animateur.
4. **Afficher depuis le programme** : copie verrouillée (étape 1), ligne marquée `presentedAt`.
5. **Séance active** : la dernière séance dont on a ouvert l'espace (ou rejointe) ; mémorisée dans le navigateur, revalidée par l'API. Fenêtre en direct visible sur toutes les pages tant que la séance est `LIVE` ; boutons « Aller à la séance » et « Quitter le direct ».
6. **Actions sur les items** (si séance active et rôle animateur/présentateur) : « Ajouter au programme » (`PREPARED`/`LIVE`), « Présenter en séance » (`LIVE`), dans le menu contextuel (toutes vues) et la modale d'édition.
7. **Programme visible** : bouton « Programme » du bandeau + onglet compact dans la fenêtre en direct (animateur/présentateurs).
8. **Item déjà dans l'espace de séance** (copie) : l'afficher le réaffiche tel quel, sans nouvelle copie.
9. **Révélation progressive des sous-items (demande Thomas 2026-10-10, « ne pas spoiler »)** : afficher un élément ne copie plus que l'élément lui-même. Ses sous-items directs restent invisibles des participants (ni fenêtre, ni espace de séance). L'animateur/présentateur voit dans la fenêtre la liste des sous-items restants (titres lus à la source, avec ses droits) et les révèle un par un (« Révéler » sur chacun, ou « Suivant » dans l'ordre) ; chaque révélation crée la copie verrouillée du sous-item sous la copie de l'élément et la diffuse. Les participants voient les sous-items révélés s'ajouter.
10. Hors étape : compte-rendu, tri « présenté le », invités, votes, mobile, passage de main.

## Global Constraints

Identiques à l'étape 1 (en-tête de fichier obligatoire, pas de commit sans demande, pas de `git add -A`, `db:push` + `db:generate` + `build:packages` après schéma — **le dev doit être arrêté pour `db:generate`** (preview_stop du serveur `dev`, puis preview_start), tests ciblés seulement, `Layout.tsx`/`GlobalNavBar.tsx` intouchés, `lib/api.ts` : ajouts seulement, textes en français, jamais `api.spok.space`). Nouveau modèle Prisma → `createMockPrisma()`.

## Review Focus

1. **Présentateur qui réordonne en déplaçant la ligne d'un autre** → 403 (test Task 2 `presenter ne déplace pas les lignes des autres`).
2. **Ajout au programme d'un item d'un espace inaccessible** (via menu d'un item partagé, MCP) → 404, aucune ligne créée (test Task 2).
3. **Séance active supprimée ou accès retiré** → le store est vidé, aucune fenêtre fantôme ni boucle de reconnexion (test Task 4 `vide la séance active sur 403/404`).
4. **Deux onglets** : chacun garde sa séance active cohérente au rechargement ; un seul flux par onglet (Task 4 : SpacePage n'ouvre plus de flux).
5. **Séance PREPARED** : « Présenter en séance » absent / refusé (409) ; « Ajouter au programme » disponible (tests Task 2 et Task 5).

---

### Task 1: Schéma — statut PREPARED + programme

**Files:** `packages/database/prisma/schema.prisma`, `packages/shared/src/types/liveSession.ts`, `apps/api/src/test/helpers.ts`

- [ ] **Step 1: Schéma**

`enum LiveSessionStatus { PREPARED LIVE ENDED }` ; `LiveSession.status` → `@default(PREPARED)` ; `LiveSession.startedAt` reste `@default(now())` (= date de création) ; ajouter `liveAt DateTime?` (démarrage effectif) et la relation `agenda LiveSessionAgendaItem[]`. Ajouter `liveSessionAgendaItems LiveSessionAgendaItem[] @relation("LiveSessionAgendaPresenter")` dans `User`. Nouveau modèle :

```prisma
// Ligne du programme d'une séance : lien vers un item source (aucune copie avant l'affichage).
// title : titre au moment de l'ajout (affichable même si la source devient inaccessible ou est supprimée).
model LiveSessionAgendaItem {
  id            String    @id @default(cuid())
  sessionId     String
  presenterId   String
  sourceItemId  String
  sourceSpaceId String
  title         String
  position      Int
  presentedAt   DateTime?
  createdAt     DateTime  @default(now())

  session   LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  presenter User        @relation("LiveSessionAgendaPresenter", fields: [presenterId], references: [id], onDelete: Cascade)

  @@index([sessionId, position])
  @@map("live_session_agenda_items")
}
```
Les séances existantes en base locale restent `LIVE`/`ENDED` (valeurs conservées).

- [ ] **Step 2: Types partagés** (`liveSession.ts`, en-tête mis à jour)

```ts
export type LiveSessionStatus = 'PREPARED' | 'LIVE' | 'ENDED';

export interface LiveAgendaItem {
  id: string;
  presenter: LiveUser;
  sourceItemId: string;
  sourceSpaceId: string;
  sourceSpaceName: string | null;
  title: string;
  position: number;
  presentedAt: string | null;
}
```
`LiveSession` : ajouter `liveAt: string | null`. `LiveSessionState` : ajouter `agenda: LiveAgendaItem[]`. `LiveEvent` : ajouter `| { type: 'agenda'; agenda: LiveAgendaItem[] } | { type: 'started'; liveAt: string }`.

- [ ] **Step 3:** `liveSessionAgendaItem: mockModel(),` dans `createMockPrisma()`.
- [ ] **Step 4:** preview_stop du dev, `pnpm db:push && pnpm db:generate && pnpm build:packages`, preview_start `dev`. Expected : sync OK, generate OK.

---

### Task 2: API — démarrer, programme, affichage étendu

**Files:** `apps/api/src/routes/live-sessions.ts`, `apps/api/src/routes/live-sessions.test.ts`, `apps/api/src/utils/sessionCopy.ts`, `apps/api/src/utils/sessionCopy.test.ts`

**Interfaces (REST, toutes `authenticate`) :**
- `POST /live-sessions/:id/start` (host, `PREPARED` → `LIVE`, `liveAt`) → `{ liveAt }` ; diffuse `started`. Autre statut → 409.
- `POST /live-sessions/:id/agenda` body `{ sourceItemId: string; sourceSpaceId?: string }` (host/presenter, statut ≠ `ENDED`) → `LiveAgendaItem[]` ; diffuse `agenda`.
- `DELETE /live-sessions/:id/agenda/:agendaId` (auteur de la ligne ou host) → `LiveAgendaItem[]` ; diffuse `agenda`.
- `PUT /live-sessions/:id/agenda/order` body `{ ids: string[] }` (host : toute permutation ; presenter : seules ses lignes changent de place) → `LiveAgendaItem[]` ; diffuse `agenda`.
- `POST /live-sessions/:id/display` body `{ agendaItemId: string } | { sourceItemId: string; sourceSpaceId?: string }` — `LIVE` seulement ; avec `agendaItemId` : source prise dans la ligne + `presentedAt` posé + diffusion `agenda`.
- `loadState` renvoie `agenda` (ordonné par `position`, avec `sourceSpaceName`) et `session.liveAt`.

- [ ] **Step 1: Tests** (ajouter au `describe('/live-sessions')` existant ; adapter le mock `session` avec `status: 'LIVE'` déjà présent)

```ts
  it('start : réservé au host, PREPARED → LIVE', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/start', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSession.update.mock.calls[0][0].data.status).toBe('LIVE')
  })

  it('start sur séance déjà LIVE → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/start', headers: auth() })
    expect(res.statusCode).toBe(409)
  })

  it('agenda : ajout en PREPARED par le host, espace source résolu depuis l\'item', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.liveSessionAgendaItem.aggregate.mockResolvedValue({ _max: { position: 2 } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSessionAgendaItem.create.mock.calls[0][0].data).toMatchObject({ sourceItemId: 'i1', sourceSpaceId: 'src', title: 'Budget', position: 3, presenterId: USER })
  })

  it('agenda : item d\'un espace inaccessible → 404, rien créé', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'secret', title: 'X' })
    prisma.spaceMembership.findUnique.mockResolvedValue(null)
    prisma.space.findUnique.mockResolvedValue({ id: 'secret', communityId: null })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/agenda', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(404)
    expect(prisma.liveSessionAgendaItem.create).not.toHaveBeenCalled()
  })

  it('order : un presenter ne déplace pas les lignes des autres', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.liveSessionAgendaItem.findMany.mockResolvedValue([
      { id: 'a', presenterId: 'other', position: 0 }, { id: 'b', presenterId: USER, position: 1 }, { id: 'c', presenterId: USER, position: 2 },
    ])
    const bad = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['b', 'a', 'c'] } })
    expect(bad.statusCode).toBe(403)
    const ok = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['a', 'c', 'b'] } })
    expect(ok.statusCode).toBe(200)
  })

  it('order : ids incomplets → 400', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.liveSessionAgendaItem.findMany.mockResolvedValue([{ id: 'a', presenterId: USER, position: 0 }, { id: 'b', presenterId: USER, position: 1 }])
    const res = await app.inject({ method: 'PUT', url: '/live-sessions/ls-1/agenda/order', headers: auth(), payload: { ids: ['a'] } })
    expect(res.statusCode).toBe(400)
  })

  it('delete agenda : refusé sur la ligne d\'un autre pour un presenter', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, hostId: 'other' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'PRESENTER' })
    prisma.liveSessionAgendaItem.findFirst.mockResolvedValue({ id: 'a', presenterId: 'other', sessionId: 'ls-1' })
    const res = await app.inject({ method: 'DELETE', url: '/live-sessions/ls-1/agenda/a', headers: auth() })
    expect(res.statusCode).toBe(403)
  })

  it('display depuis le programme : marque presentedAt', async () => {
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    prisma.liveSessionAgendaItem.findFirst.mockResolvedValue({ id: 'a', sessionId: 'ls-1', sourceItemId: 'i1', sourceSpaceId: 'src' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ role: 'MEMBER' })
    prisma.liveSessionEntry.create.mockResolvedValue({ id: 'e3', kind: 'DISPLAY', createdAt: new Date(), userId: USER, itemId: 'copy-1', itemTitle: 'Budget', user: { id: USER, name: 'Thomas', avatarUrl: null } })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { agendaItemId: 'a' } })
    expect(res.statusCode).toBe(200)
    expect(prisma.liveSessionAgendaItem.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a' }, data: { presentedAt: expect.any(Date) } }))
  })

  it('display sur séance PREPARED → 409', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'PREPARED' })
    prisma.liveSessionRole.findUnique.mockResolvedValue({ role: 'HOST' })
    const res = await app.inject({ method: 'POST', url: '/live-sessions/ls-1/display', headers: auth(), payload: { sourceItemId: 'i1' } })
    expect(res.statusCode).toBe(409)
  })
```
Mettre à jour le test existant de création : `expect(prisma.liveSession.create.mock.calls[0][0].data.status ?? 'PREPARED').toBe('PREPARED')` (la création ne force plus `LIVE`).

Test `sessionCopy` à ajouter :
```ts
  it('item déjà dans l\'espace de séance : réaffiché tel quel, pas de copie', async () => {
    prisma.item.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'copy-9' ? { id: 'copy-9', spaceId: 'sess', title: 'Copie', lockedAt: new Date(), tags: [] } : null)
    prisma.item.findMany.mockResolvedValue([])
    const res = await copyItemToSession(prisma as any, { sourceItemId: 'copy-9', sourceSpaceId: 'sess', sessionSpaceId: 'sess', userId: 'u1' })
    expect(res.reused).toBe(true)
    expect(res.item.id).toBe('copy-9')
    expect(prisma.item.create).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2:** Run `npx vitest run apps/api/src/routes/live-sessions.test.ts apps/api/src/utils/sessionCopy.test.ts` → nouveaux tests FAIL.

- [ ] **Step 3: `sessionCopy.ts`** — en tête de `copyItemToSession`, après le chargement de `source` :
```ts
  // Élément déjà dans l'espace de séance (copie) : on le réaffiche tel quel
  if (params.sourceSpaceId === params.sessionSpaceId) {
    const children = await prisma.item.findMany({ where: { parentId: source.id }, include: TAGS_INCLUDE, orderBy: { position: 'asc' } });
    return { item: flattenTags(source), children: children.map(flattenTags), reused: true };
  }
```

- [ ] **Step 4: `live-sessions.ts`** — ajouts (en-tête mis à jour : cycle PREPARED/LIVE/ENDED, programme, règles d'ordre) :

```ts
const agendaAddSchema = z.object({ sourceItemId: z.string(), sourceSpaceId: z.string().optional() });
const agendaOrderSchema = z.object({ ids: z.array(z.string()) });
const displaySchema = z.union([
  z.object({ agendaItemId: z.string() }),
  z.object({ sourceItemId: z.string(), sourceSpaceId: z.string().optional() }),
]);

/** Résout l'espace d'un item source et vérifie l'accès de l'utilisateur ; null = introuvable/inaccessible. */
async function resolveSource(prisma: any, userId: string, sourceItemId: string, sourceSpaceId?: string) {
  const item = await prisma.item.findUnique({ where: { id: sourceItemId }, select: { id: true, spaceId: true, title: true } });
  if (!item || (sourceSpaceId && item.spaceId !== sourceSpaceId)) return null;
  const access = await checkSpaceAccess(prisma, userId, item.spaceId);
  return access ? item : null;
}

/** Programme ordonné avec nom d'espace source (null si l'espace n'existe plus). */
async function loadAgenda(prisma: any, sessionId: string): Promise<LiveAgendaItem[]> {
  const rows = await prisma.liveSessionAgendaItem.findMany({
    where: { sessionId }, orderBy: { position: 'asc' }, include: { presenter: { select: USER_SELECT } },
  });
  const spaceIds = [...new Set(rows.map((r: any) => r.sourceSpaceId))];
  const spaces = spaceIds.length ? await prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(spaces.map((s: any) => [s.id, s.name]));
  return rows.map((r: any) => ({
    id: r.id, presenter: r.presenter, sourceItemId: r.sourceItemId, sourceSpaceId: r.sourceSpaceId,
    sourceSpaceName: names.get(r.sourceSpaceId) ?? null, title: r.title, position: r.position,
    presentedAt: r.presentedAt ? new Date(r.presentedAt).toISOString() : null,
  }));
}
```
`loadState` : ajouter `agenda: await loadAgenda(prisma, s.id)` et `liveAt` dans `session`.

Helper rôle : `async function roleOf(sessionId, userId)` → `prisma.liveSessionRole.findUnique({ where: { sessionId_userId: { sessionId, userId } } })`.

Routes :
```ts
  fastify.post<{ Params: { id: string } }>('/:id/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== request.user.userId) return reply.forbidden('Réservé à l\'animateur');
    if (s.status !== 'PREPARED') return reply.conflict('Séance déjà démarrée ou terminée');
    const liveAt = new Date();
    await prisma.liveSession.update({ where: { id: s.id }, data: { status: 'LIVE', liveAt } });
    liveHub.broadcast(s.id, { type: 'started', liveAt: liveAt.toISOString() });
    return { liveAt: liveAt.toISOString() };
  });

  fastify.post<{ Params: { id: string } }>('/:id/agenda', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await roleOf(s.id, userId))) return reply.forbidden('Seuls l\'animateur et les présentateurs préparent le programme');
    if (s.status === 'ENDED') return reply.conflict('Séance terminée');
    const body = agendaAddSchema.parse(request.body);
    const src = await resolveSource(prisma, userId, body.sourceItemId, body.sourceSpaceId);
    if (!src) return reply.notFound('Élément introuvable');
    const max = await prisma.liveSessionAgendaItem.aggregate({ where: { sessionId: s.id }, _max: { position: true } });
    await prisma.liveSessionAgendaItem.create({
      data: { sessionId: s.id, presenterId: userId, sourceItemId: src.id, sourceSpaceId: src.spaceId, title: src.title || 'Sans titre', position: (max._max.position ?? -1) + 1 },
    });
    const agenda = await loadAgenda(prisma, s.id);
    liveHub.broadcast(s.id, { type: 'agenda', agenda });
    return agenda;
  });

  fastify.delete<{ Params: { id: string; agendaId: string } }>('/:id/agenda/:agendaId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    const row = await prisma.liveSessionAgendaItem.findFirst({ where: { id: request.params.agendaId, sessionId: s.id } });
    if (!row) return reply.notFound('Ligne introuvable');
    if (s.hostId !== userId && row.presenterId !== userId) return reply.forbidden('Vous ne pouvez retirer que vos propres éléments');
    await prisma.liveSessionAgendaItem.delete({ where: { id: row.id } });
    const agenda = await loadAgenda(prisma, s.id);
    liveHub.broadcast(s.id, { type: 'agenda', agenda });
    return agenda;
  });

  fastify.put<{ Params: { id: string } }>('/:id/agenda/order', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await roleOf(s.id, userId))) return reply.forbidden('Réservé à l\'animateur et aux présentateurs');
    const { ids } = agendaOrderSchema.parse(request.body);
    const rows = await prisma.liveSessionAgendaItem.findMany({ where: { sessionId: s.id }, orderBy: { position: 'asc' } });
    if (ids.length !== rows.length || new Set(ids).size !== ids.length || !rows.every((r: any) => ids.includes(r.id))) {
      return reply.badRequest('La liste doit contenir toutes les lignes du programme, une seule fois');
    }
    if (s.hostId !== userId) {
      // Présentateur : les lignes des autres gardent leur position
      const moved = rows.some((r: any, i: number) => r.presenterId !== userId && ids[i] !== r.id);
      if (moved) return reply.forbidden('Vous ne pouvez déplacer que vos propres éléments');
    }
    await prisma.$transaction(ids.map((id, position) => prisma.liveSessionAgendaItem.update({ where: { id }, data: { position } })));
    const agenda = await loadAgenda(prisma, s.id);
    liveHub.broadcast(s.id, { type: 'agenda', agenda });
    return agenda;
  });
```
`display` : remplacer la lecture du body et la copie par
```ts
    const body = displaySchema.parse(request.body);
    let agendaRow: any = null;
    let sourceItemId: string; let sourceSpaceId: string | undefined;
    if ('agendaItemId' in body) {
      agendaRow = await prisma.liveSessionAgendaItem.findFirst({ where: { id: body.agendaItemId, sessionId: s.id } });
      if (!agendaRow) return reply.notFound('Ligne de programme introuvable');
      ({ sourceItemId, sourceSpaceId } = agendaRow);
    } else {
      ({ sourceItemId, sourceSpaceId } = body);
    }
    const src = await resolveSource(prisma, userId, sourceItemId, sourceSpaceId);
    if (!src) return reply.notFound('Élément source introuvable');
    // … copyItemToSession({ sourceItemId: src.id, sourceSpaceId: src.spaceId, sessionSpaceId: s.spaceId, userId }) inchangé …
    // après la diffusion du display :
    if (agendaRow) {
      await prisma.liveSessionAgendaItem.update({ where: { id: agendaRow.id }, data: { presentedAt: new Date() } });
      liveHub.broadcast(s.id, { type: 'agenda', agenda: await loadAgenda(prisma, s.id) });
    }
```
Le contrôle de statut de `display` devient `if (s.status !== 'LIVE') return reply.conflict(s.status === 'PREPARED' ? 'Séance pas encore démarrée' : 'Séance terminée');`. Les tests existants de `display` (`sourceSpaceId: 'src'`) : ajouter `prisma.item.findUnique.mockResolvedValue({ id: 'i1', spaceId: 'src', title: 'Budget' })` dans leur arrange.

- [ ] **Step 5:** Run les deux fichiers de test → PASS. `pnpm --filter @spok/api typecheck` → 0 erreur.

---

### Task 2b: API — révélation progressive des sous-items

**Files:** `apps/api/src/utils/sessionCopy.ts` (+test), `apps/api/src/routes/live-sessions.ts` (+test), `packages/shared/src/types/liveSession.ts`

**Interfaces:**
- `copyItemToSession(prisma, params)` ne copie plus les enfants : `children` = copies déjà révélées (enfants existants de la copie). Nouvelle fonction `revealChildInSession(prisma, { parentCopyId, sourceChildId, sourceSpaceId, sessionSpaceId, userId })` → copie verrouillée de l'enfant sous `parentCopyId` (réutilise une copie existante du même enfant sous ce parent si la source n'a pas changé).
- `GET /live-sessions/:id/pending-children` (host/presenter) → `Array<{ sourceItemId: string; title: string }>` : enfants directs de la source de l'élément courant non encore révélés, dans l'ordre `position` (droits du demandeur vérifiés sur l'espace source).
- `POST /live-sessions/:id/reveal` body `{ sourceItemId: string }` (host/presenter, `LIVE`) — l'enfant doit être un enfant direct de la source de l'élément courant, sinon 400 → crée la copie, diffuse `{ type: 'reveal'; parentItemId: string; child: Item }`.
- Types : `LiveEvent` += `{ type: 'reveal'; parentItemId: string; child: Item }` ; `LiveSessionState.current.children` = sous-items révélés uniquement.

- [ ] **Step 1: Tests** — `sessionCopy.test.ts` : « affiche sans copier les enfants » (1 seul `create`) ; « revealChildInSession copie l'enfant sous la copie parente, verrouillé » ; « réutilise la copie de l'enfant si inchangé ». `live-sessions.test.ts` : « reveal d'un item qui n'est pas enfant de l'élément courant → 400 » ; « reveal par un participant → 403 » ; « reveal : diffusion + copie sous la copie courante » ; « pending-children exclut les enfants déjà révélés ».
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter : dans `copyItemToSession`, supprimer la boucle de copie des enfants ; `children` = `prisma.item.findMany({ where: { parentId: copy.id } })` (vide pour une nouvelle copie). `revealChildInSession` réutilise `createLockedCopy(prisma, child, params, parentCopyId, new Date())`. Dans les routes : élément courant = entrée `currentEntryId` → copie (`item.sourceItemId` = source) ; enfants révélés = copies sous la copie courante (`sourceItemId` connus) ; `pending` = enfants source (`parentId: source.id`, triés `position`) dont l'id n'est pas dans les révélés.
- [ ] **Step 4:** Run → PASS ; API typecheck.

Côté web (Task 4, LiveWindow) : pour host/présentateurs, sous l'élément courant, section « À révéler » (requête `['live-pending', sessionId, currentEntryId]` vers `pending-children`, invalidée à chaque `display`/`reveal`) avec « Révéler » par ligne et « Révéler le suivant » ; `applyLiveEvent` gère `reveal` (ajoute `child` à `current.children` si `current.item.id === parentItemId`) + test dans `useLiveSession.test.ts`.

---

### Task 3: Client web — API, événements, store de séance active

**Files:** `apps/web/src/lib/api.ts` (ajouts), `apps/web/src/hooks/useLiveSession.ts`, `apps/web/src/hooks/useLiveSession.test.ts`, Create `apps/web/src/stores/activeLiveSession.ts`, `apps/web/src/stores/activeLiveSession.test.ts`

**Interfaces:**
- `liveSessionsApi.start(id)`, `.addToAgenda(id, sourceItemId, sourceSpaceId?)`, `.removeFromAgenda(id, agendaId)`, `.reorderAgenda(id, ids)`, `.display(id, body: { agendaItemId } | { sourceItemId, sourceSpaceId? })` (signature de `display` changée : objet).
- `applyLiveEvent` gère `agenda` et `started`.
- `useLiveSession(spaceId, { stream?: boolean })` — `stream` défaut `false` ; expose en plus `start()`, `addToAgenda(sourceItemId, sourceSpaceId?)`, `removeFromAgenda(agendaId)`, `reorderAgenda(ids)`, `displayAgenda(agendaItemId)`, `displayItem(sourceItemId, sourceSpaceId?)`.
- Store :
```ts
interface ActiveLiveSessionState {
  spaceId: string | null;                         // persisté (localStorage 'spok.activeLiveSession')
  info: { sessionId: string; status: LiveSessionStatus; myRole: LiveSessionRoleType | 'PARTICIPANT'; spaceName: string } | null; // non persisté, synchronisé par LiveSessionHost
  setActive: (spaceId: string) => void;
  setInfo: (info: ActiveLiveSessionState['info']) => void;
  clear: () => void;
}
export const useActiveLiveSessionStore: UseBoundStore<…>;
export const canPresent = (info) => !!info && info.myRole !== 'PARTICIPANT';
```

- [ ] **Step 1: Tests**
  - `useLiveSession.test.ts` : `applyLiveEvent` — `agenda` remplace la liste ; `started` passe `status` à `LIVE` et pose `liveAt`.
  - `activeLiveSession.test.ts` : `setActive` persiste `spaceId` (relu après recréation via `localStorage`) ; `clear` vide `spaceId` et `info` ; `canPresent` faux pour PARTICIPANT/null, vrai pour HOST/PRESENTER.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implémenter** — store avec `zustand/middleware` `persist` + `partialize: (s) => ({ spaceId: s.spaceId })`, nom `spok.activeLiveSession` ; en-tête : « séance active de l'onglet/navigateur — écrivains : SpacePage (setActive à l'ouverture d'un espace de séance), ParentSessionsButton (création/rejoindre), LiveSessionHost (setInfo, clear sur 403/404 ou Quitter) ». `applyLiveEvent` :
```ts
    case 'agenda': return { ...state, agenda: event.agenda };
    case 'started': return { ...state, session: { ...state.session, status: 'LIVE', liveAt: event.liveAt } };
```
`useLiveSession` : l'effet SSE ne s'exécute que si `options.stream` ; les mutations appellent l'API puis, pour `start`/`end`, `refetch()` ; les mutations de programme posent le résultat (`LiveAgendaItem[]`) dans le cache (`setQueryData` → `{ ...prev, agenda }`).
- [ ] **Step 4:** Run → PASS ; web typecheck.

---

### Task 4: Hôte global de la séance active + fenêtre partout

**Files:** Create `apps/web/src/components/live/LiveSessionHost.tsx`, `apps/web/src/components/live/AgendaPanel.tsx` ; Modify `LiveWindow.tsx`, `App.tsx`, `pages/SpacePage.tsx`, `components/live/ParentSessionsButton.tsx`, `components/live/LiveSessionBar.tsx`

**Interfaces:**
- `<LiveSessionHost />` (aucune prop) monté dans `App.tsx` juste après `<DevPageName />`, rendu seulement si `isAuthenticated`.
- `<AgendaPanel state live compact? onOpenItem? />` — liste du programme : titre, espace source, présentateur, « présenté HH:MM » ; boutons ↑/↓ (masqués si le déplacement est interdit selon la règle de Task 2), Retirer (sa ligne ou host), Afficher (LIVE + host/presenter).
- `LiveWindow` props : `{ state, onOpenItem, onGoToSession, onLeave, live? }` — onglets « Direct » / « Programme » / « Rechercher » quand `canPresent`.

- [ ] **Step 1: `LiveSessionHost.tsx`**

```tsx
/*
 * LiveSessionHost — hôte global de la séance active (monté une fois dans App.tsx) : ouvre l'UNIQUE flux SSE
 * de l'onglet (useLiveSession(spaceId, { stream: true })), synchronise useActiveLiveSessionStore.info et
 * affiche LiveWindow sur toutes les pages tant que la séance est LIVE. Vide la séance active si l'API répond
 * 403/404 (séance supprimée, accès retiré) ou sur « Quitter le direct ». Ne jamais monter un 2e flux ailleurs.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { useLiveSession } from '../../hooks/useLiveSession';
import { LiveWindow } from './LiveWindow';

export function LiveSessionHost() {
  const { spaceId, setInfo, clear } = useActiveLiveSessionStore();
  const live = useLiveSession(spaceId ?? undefined, { stream: true });
  const navigate = useNavigate();
  const state = live.state;

  useEffect(() => {
    if (spaceId && live.isError) clear();
  }, [spaceId, live.isError, clear]);

  useEffect(() => {
    setInfo(state ? { sessionId: state.session.id, status: state.session.status, myRole: state.myRole, spaceName: state.spaceName } : null);
  }, [state?.session.id, state?.session.status, state?.myRole, state?.spaceName, setInfo]);

  if (!spaceId || !state || state.session.status !== 'LIVE') return null;
  return (
    <LiveWindow
      state={state}
      live={live}
      onOpenItem={(itemId) => navigate(`/spaces/${spaceId}?item=${itemId}`)}
      onGoToSession={() => navigate(`/spaces/${spaceId}`)}
      onLeave={clear}
    />
  );
}
```
(`useLiveSession` doit exposer `isError`.)

- [ ] **Step 2: Test** `LiveSessionHost` — `apps/web/src/components/live/LiveSessionHost.test.tsx` : avec `liveSessionsApi.getBySpace` mocké rejetant (`ApiError` 403), le store est vidé (`spaceId` null) ; avec un état `LIVE`, `data-testid="live-window"` est rendu ; avec `PREPARED`, il ne l'est pas. (Wrapper `QueryClientProvider` + `MemoryRouter` ; `openLiveStream` mocké en no-op.) Run → FAIL puis PASS après Step 1.

- [ ] **Step 3: `App.tsx`** — import `LiveSessionHost` + `useAuthStore` déjà importé ; après `<DevPageName />` : `{isAuthenticated && <LiveSessionHost />}` (lire `isAuthenticated` via `useAuthStore` dans ce composant). En-tête d'`App.tsx` : une ligne sur l'hôte de séance active.

- [ ] **Step 4: `SpacePage.tsx`** — `useLiveSession(spaceId)` (sans flux) ; effet : `if (live.isLiveSpace) setActive(spaceId)` ; supprimer le rendu de `LiveWindow` (désormais dans l'hôte) ; `LiveSessionBar` reçoit l'état depuis le cache partagé (même queryKey que l'hôte, qui diffuse les événements). En-tête mis à jour.

- [ ] **Step 5: `ParentSessionsButton.tsx`** — après création ou « Rejoindre » : `setActive(sessionSpaceId)` avant `navigate`. Libellé de statut : `PREPARED` → « préparée », `LIVE` → « ● direct ». En-tête mis à jour.

- [ ] **Step 6: `LiveSessionBar.tsx`** — statut `PREPARED` : « Séance préparée » + bouton **Démarrer la séance** (host) ; bouton **Programme** (tous les statuts sauf ENDED pour le panneau éditable ; ENDED : lecture seule) ouvrant `AgendaPanel` ; **Présenter** utilise `live.displayItem`. En-tête mis à jour.

- [ ] **Step 7: `AgendaPanel.tsx`** — règle de déplacement côté client identique à l'API :
```ts
/** Un déplacement de i vers j est permis si host, ou si les deux lignes appartiennent à l'utilisateur. */
export const canSwap = (agenda: LiveAgendaItem[], i: number, j: number, userId: string, isHost: boolean) =>
  j >= 0 && j < agenda.length && (isHost || (agenda[i].presenter.id === userId && agenda[j].presenter.id === userId));
```
↑/↓ = échange avec la ligne voisine **de l'utilisateur** pour un présentateur (chercher la ligne précédente/suivante dont il est l'auteur), voisine directe pour l'animateur ; puis `live.reorderAgenda(newIds)`. Test `AgendaPanel.test.ts` sur `canSwap` et sur le calcul du voisin (fonction pure `nextOwnIndex(agenda, i, dir, userId)`).

- [ ] **Step 8: `LiveWindow.tsx`** — barre de titre : bouton « Aller à la séance » (icône `LogIn`) et « Quitter le direct » (icône `X`) ; si `canPresent(info)` : onglets Direct | Programme (`AgendaPanel compact`) | Rechercher (`PresenterPanel` avec `onDisplay={(sp, it) => live.displayItem(it, sp)}`). En-tête mis à jour.

- [ ] **Step 9:** tests ciblés + web typecheck.

---

### Task 5: Actions « Ajouter au programme » / « Présenter en séance » sur les items

**Files:** Create `apps/web/src/lib/liveItemActions.ts`, `apps/web/src/lib/liveItemActions.test.ts` ; Modify `apps/web/src/lib/itemMenuGroups.ts`, `apps/web/src/components/ItemEditModal.tsx`

**Interfaces:**
- `buildLiveItemActions(itemId: string, info: ActiveInfo | null, spaceId: string | null): ItemAction[]` — vide si pas de séance active ou PARTICIPANT ; « Ajouter au programme » si `PREPARED|LIVE` ; « Présenter en séance » si `LIVE`. Les `onClick` appellent `liveSessionsApi.addToAgenda(info.sessionId, itemId)` / `.display(info.sessionId, { sourceItemId: itemId })`, puis `queryClient.setQueryData(['live-session', spaceId], …)` (agenda) ; erreurs → `toast`/`alert` existant du projet (chercher le système de notification d'erreur utilisé par `itemMenuGroups`/vues ; à défaut `window.alert`).

- [ ] **Step 1: Test** `liveItemActions.test.ts` : aucune action sans séance / pour PARTICIPANT / pour ENDED ; une action en PREPARED (`live-add-agenda`) ; deux en LIVE (`live-add-agenda`, `live-present`).
- [ ] **Step 2:** Run → FAIL ; implémenter (en-tête) ; Run → PASS.
- [ ] **Step 3: `itemMenuGroups.ts`** — à la fin de `buildItemMenuGroups`, hors des gardes `canEdit` (présenter un élément ne demande que la lecture, l'API vérifie l'accès) :
```ts
  const { info, spaceId: liveSpaceId } = useActiveLiveSessionStore.getState();
  const liveActions = buildLiveItemActions(itemId, info, liveSpaceId);
  …
    ...(liveActions.length > 0 ? [{ label: 'Séance', actions: liveActions }] : []),
```
(lecture `getState()` : fonction non-hook, appelée au rendu du menu). En-tête : une ligne sur la section « Séance ».
- [ ] **Step 4: `ItemEditModal.tsx`** — dans le pied, après « Fermer », pour un item existant : boutons issus de `buildLiveItemActions(itemId, info, liveSpaceId)` (lecture via `useActiveLiveSessionStore` hook) rendus en `Button variant="bordered"`. En-tête mis à jour.
- [ ] **Step 5:** tests ciblés + web typecheck.

---

### Task 6: Documentation

- [ ] `docs/ARCHITECTURE.md` (store `useActiveLiveSessionStore`, `LiveSessionHost` dans App.tsx, un seul flux par onglet), `businessRules.ts` (cycle préparée/en direct, règles du programme), `docs/TODO.md`, `docs/session-journal.md`, item SPOK `cmv27if320005f3dmsfyejatp` (statut `to_validate`).

---

## Vérification

Typecheck API + web, tests ciblés de chaque tâche, logs du dev sans erreur. Vérification d'interface : par Thomas (skill `testing-protocol`) — créer une séance (préparée), ajouter des éléments au programme depuis d'autres espaces via le menu contextuel, réordonner, démarrer, naviguer ailleurs (fenêtre visible), afficher depuis la fenêtre, terminer.
