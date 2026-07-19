# Horizons temporels + revue de rattrapage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la charge cognitive de Thomas en classant les items sans échéance par horizon temporel (Maintenant/Aujourd'hui/Semaine/Mois/Plus tard), avec une revue de rattrapage qui assigne l'horizon aux items non triés et re-signale ceux dont l'horizon a été dépassé — sans jamais forcer un « Plus tard » à remonter (c'est un horizon de repos).

**Architecture:** Deux nouveaux champs Prisma (`manualHorizon`, `horizonSetAt`) + un module de fonctions pures partagé (`effectiveHorizon`, `isOverdueForReview`) consommé identiquement par l'API et le web. Un nouvel endpoint `GET /user/review-queue` réutilise la résolution d'accès déjà écrite pour `/user/agenda`. Deux surfaces UI : `/tasks` se regroupe par horizon (composant `HorizonGroup` réutilisable), `/today` gagne une section « À réviser ».

**Tech Stack:** Fastify + Prisma (API), React + TanStack Query (web), Vitest (tests), TypeScript partagé (`@spok/shared`).

**Spec:** `docs/superpowers/specs/2026-07-19-horizons-revue-design.md`

**⚠️ Règles projet qui priment sur le template :**
- **Aucun commit sans demande explicite de Thomas** — les étapes « Commit » sont des points *proposés*, à n'exécuter que sur son ordre.
- Vérifications lourdes (TNR complet, typecheck 5 paquets) : uniquement au moment du déploiement. Pendant le dev : le fichier de test de la fonctionnalité en cours + le typecheck du seul paquet touché.
- Tout fichier créé/modifié reçoit un commentaire d'en-tête (raison d'être, params clés, règles d'usage).
- `packages/shared` n'a pas de projet Vitest dédié — les tests des fonctions pures de `horizon.ts` vivent dans `apps/api/src/utils/` (projet `api`, environnement `node`), qui importe `@spok/shared` comme n'importe quel autre consommateur. C'est un choix pragmatique pour ce plan, pas un précédent à généraliser sans réflexion.
- `/tasks` récupère TOUS les items filtrés en un seul appel (`pageSize=2000`, déjà le maximum accepté par l'API) puis groupe et plafonne l'affichage **côté client** — pas de pagination serveur par groupe d'horizon (trop complexe pour le volume réel de Thomas, quelques centaines d'items).

---

## File Structure

- **Modify:** `packages/database/prisma/schema.prisma` — enum `HorizonBucket`, champs `Item.manualHorizon`/`Item.horizonSetAt`
- **Create:** `packages/shared/src/utils/horizon.ts` — `HorizonBucket`, `effectiveHorizon()`, `isOverdueForReview()`, `HORIZON_LABELS`
- **Modify:** `packages/shared/src/index.ts` — export du nouveau module
- **Modify:** `packages/shared/src/types/item.ts` — `Item.manualHorizon`/`horizonSetAt`, `UpdateItemInput.manualHorizon`
- **Create:** `apps/api/src/utils/horizon.test.ts` — tests des fonctions pures
- **Modify:** `apps/api/src/routes/items.ts` — `updateItemSchema` + auto-set `horizonSetAt`
- **Modify:** `apps/api/src/routes/items.test.ts` — tests du nouveau comportement PATCH
- **Modify:** `apps/api/src/routes/agenda.ts` — exporter `accessibleSpaceIds`
- **Modify:** `apps/api/src/routes/user-tasks.ts` — sélectionner `manualHorizon`/`horizonSetAt`
- **Create:** `apps/api/src/routes/review-queue.ts` — `GET /user/review-queue`
- **Create:** `apps/api/src/routes/review-queue.test.ts`
- **Modify:** `apps/api/src/index.ts` — enregistrer `reviewQueueRoutes`
- **Modify:** `apps/web/src/lib/api.ts` — `GlobalTask.manualHorizon`/`horizonSetAt`, `reviewQueueApi`
- **Create:** `apps/web/src/components/HorizonGroup.tsx` — section repliable + plafond 20/« voir tout »
- **Modify:** `apps/web/src/pages/GlobalTasksPage.tsx` — regroupement par horizon
- **Create:** `apps/web/src/components/today/ReviewQueueSection.tsx` — section « À réviser »
- **Modify:** `apps/web/src/pages/TodayPage.tsx` — intégration de la section

---

### Task 1 : Schéma Prisma + types partagés

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/shared/src/types/item.ts`

- [ ] **Step 1.1 : Ajouter l'enum et les champs au schéma**

Dans `packages/database/prisma/schema.prisma`, ajouter après l'enum `SpaceVisibility` (ou tout autre enum existant, à la suite des enums du fichier) :

```prisma
// Horizon temporel manuel d'un item sans échéance — dérive automatiquement de dueDate
// quand elle existe (voir packages/shared/src/utils/horizon.ts). null = bac à trier.
enum HorizonBucket {
  NOW    // Maintenant
  TODAY  // Aujourd'hui
  WEEK   // Cette semaine
  MONTH  // Ce mois
  LATER  // Plus tard — horizon de repos, ne remonte jamais automatiquement en revue
}
```

Puis, dans `model Item`, ajouter juste après le champ `endDate` :

```prisma
  manualHorizon HorizonBucket?
  horizonSetAt  DateTime?
```

- [ ] **Step 1.2 : Régénérer le client Prisma et pousser le schéma en dev**

Run: `pnpm db:generate`
Expected: `✔ Generated Prisma Client`

Run: `pnpm db:push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 1.3 : Mettre à jour les types partagés**

Dans `packages/shared/src/types/item.ts`, ajouter l'import et les champs :

```ts
import type { HorizonBucket } from '../utils/horizon.js';
```

Dans `export interface Item { ... }`, ajouter après `endDate` :

```ts
  manualHorizon?: HorizonBucket | null;
  horizonSetAt?: string | null;
```

Dans `export interface UpdateItemInput { ... }`, ajouter après `endDate` :

```ts
  manualHorizon?: HorizonBucket | null;
```

Ce fichier référence `../utils/horizon.js`, créé à la Task 2 — le typecheck de cette étape échouera tant que la Task 2 n'est pas faite ; c'est attendu, les deux tasks sont séquentielles.

- [ ] **Step 1.4 : Commit proposé** *(uniquement sur demande explicite de Thomas)*

```bash
git add packages/database/prisma/schema.prisma packages/shared/src/types/item.ts
git commit -m "feat: champs manualHorizon/horizonSetAt sur Item"
```

---

### Task 2 : Fonctions pures d'horizon (TDD)

**Files:**
- Create: `packages/shared/src/utils/horizon.ts`
- Create: `apps/api/src/utils/horizon.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 2.1 : Écrire les tests (rouges)**

```ts
/*
 * Tests des fonctions pures d'horizon temporel (packages/shared/src/utils/horizon.ts) :
 * dérivation depuis dueDate, grâce avant remontée en revue par horizon manuel.
 * Vit ici (projet vitest "api") faute de projet vitest dédié à packages/shared.
 */
import { describe, it, expect } from 'vitest'
import { effectiveHorizon, isOverdueForReview } from '@spok/shared'

const NOW = new Date('2026-07-19T12:00:00.000Z') // dimanche

describe('effectiveHorizon', () => {
  it('retourne NOW pour une échéance en retard', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-10T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('NOW')
  })

  it('retourne NOW pour une échéance aujourd\'hui', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-19T18:00:00.000Z', manualHorizon: null }, NOW)).toBe('NOW')
  })

  it('retourne WEEK pour une échéance cette semaine', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-22T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('WEEK')
  })

  it('retourne MONTH pour une échéance ce mois-ci', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-30T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('MONTH')
  })

  it('retourne LATER pour une échéance au-delà du mois', () => {
    expect(effectiveHorizon({ dueDate: '2026-09-01T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('LATER')
  })

  it('sans échéance, retourne manualHorizon tel quel', () => {
    expect(effectiveHorizon({ dueDate: null, manualHorizon: 'WEEK' }, NOW)).toBe('WEEK')
  })

  it('sans échéance ni manualHorizon, retourne null (bac à trier)', () => {
    expect(effectiveHorizon({ dueDate: null, manualHorizon: null }, NOW)).toBeNull()
  })

  it('dueDate prime toujours sur manualHorizon', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-10T00:00:00.000Z', manualHorizon: 'LATER' }, NOW)).toBe('NOW')
  })
})

describe('isOverdueForReview', () => {
  it('faux si l\'item a une échéance (toujours à jour par recalcul)', () => {
    expect(isOverdueForReview({ dueDate: '2026-01-01T00:00:00.000Z', manualHorizon: null, horizonSetAt: null }, NOW)).toBe(false)
  })

  it('faux si aucun horizon manuel assigné (bac à trier)', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: null, horizonSetAt: null }, NOW)).toBe(false)
  })

  it('LATER ne remonte jamais, même très ancien', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'LATER', horizonSetAt: '2025-01-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('NOW dépasse la grâce d\'1 jour', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: '2026-07-17T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('NOW dans la grâce d\'1 jour', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: '2026-07-19T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('WEEK dépasse la grâce de 10 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'WEEK', horizonSetAt: '2026-07-05T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('WEEK dans la grâce de 10 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'WEEK', horizonSetAt: '2026-07-12T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('MONTH dépasse la grâce de 35 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'MONTH', horizonSetAt: '2026-06-01T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('MONTH dans la grâce de 35 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'MONTH', horizonSetAt: '2026-07-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('faux si horizonSetAt absent (ne devrait pas arriver mais ne doit pas planter)', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: null }, NOW)).toBe(false)
  })
})
```

- [ ] **Step 2.2 : Vérifier que les tests échouent**

Run: `pnpm --filter @spok/web exec vitest run --project api src/utils/horizon.test.ts`

Note : la commande référence le projet `api` du `vitest.config.ts` racine mais s'invoque depuis n'importe quel workspace car la config est à la racine — utiliser plutôt, depuis la racine :

Run: `pnpm exec vitest run apps/api/src/utils/horizon.test.ts`
Expected: FAIL — `Cannot find module '@spok/shared'` ou `effectiveHorizon is not a function` (le module n'existe pas encore / n'exporte rien)

- [ ] **Step 2.3 : Implémenter les fonctions pures**

```ts
/*
 * Horizon temporel effectif d'un item (spec 2026-07-19-horizons-revue-design) :
 * - avec dueDate → dérivé automatiquement de la date, jamais stocké (recalcul à chaque lecture)
 * - sans dueDate → manualHorizon tel quel (null = bac à trier)
 * isOverdueForReview : grâce par horizon depuis horizonSetAt avant remontée en revue —
 * uniquement pour les items SANS dueDate (ceux avec échéance sont toujours "à jour" par
 * recalcul). LATER ne remonte jamais : c'est un horizon de repos, pas d'attente.
 */
export type HorizonBucket = 'NOW' | 'TODAY' | 'WEEK' | 'MONTH' | 'LATER'

export const HORIZON_LABELS: Record<HorizonBucket, string> = {
  NOW: 'Maintenant',
  TODAY: "Aujourd'hui",
  WEEK: 'Cette semaine',
  MONTH: 'Ce mois',
  LATER: 'Plus tard',
}

/** Ordre d'affichage du plus urgent au plus lointain. */
export const HORIZON_ORDER: HorizonBucket[] = ['NOW', 'TODAY', 'WEEK', 'MONTH', 'LATER']

interface HorizonInput {
  dueDate?: string | Date | null
  manualHorizon?: HorizonBucket | null
}

export function effectiveHorizon(item: HorizonInput, now: Date = new Date()): HorizonBucket | null {
  if (item.dueDate) {
    const due = new Date(item.dueDate)
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday)
    endOfToday.setHours(23, 59, 59, 999)
    if (due <= endOfToday) return 'NOW'

    const endOfWeek = new Date(startOfToday)
    endOfWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)
    if (due <= endOfWeek) return 'WEEK'

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    if (due <= endOfMonth) return 'MONTH'

    return 'LATER'
  }
  return item.manualHorizon ?? null
}

const GRACE_DAYS: Partial<Record<HorizonBucket, number>> = {
  NOW: 1,
  TODAY: 1,
  WEEK: 10,
  MONTH: 35,
  // LATER volontairement absent : jamais de grâce, jamais de remontée automatique
}

interface OverdueInput extends HorizonInput {
  horizonSetAt?: string | Date | null
}

export function isOverdueForReview(item: OverdueInput, now: Date = new Date()): boolean {
  if (item.dueDate) return false
  if (!item.manualHorizon || !item.horizonSetAt) return false
  const graceDays = GRACE_DAYS[item.manualHorizon]
  if (graceDays === undefined) return false // LATER
  const deadline = new Date(item.horizonSetAt)
  deadline.setDate(deadline.getDate() + graceDays)
  return now > deadline
}
```

- [ ] **Step 2.4 : Exporter le module**

Dans `packages/shared/src/index.ts`, ajouter :

```ts
export * from './utils/horizon.js';
```

- [ ] **Step 2.5 : Builder le package shared (le test importe `@spok/shared` compilé)**

Run: `pnpm --filter @spok/shared build`
Expected: `Done` sans erreur

- [ ] **Step 2.6 : Vérifier que les tests passent**

Run: `pnpm exec vitest run apps/api/src/utils/horizon.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 2.7 : Typecheck shared + api**

Run: `pnpm --filter @spok/shared exec tsc --noEmit`
Run: `pnpm --filter @spok/api exec tsc --noEmit`
Expected: 0 erreur sur les deux

- [ ] **Step 2.8 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add packages/shared/src/utils/horizon.ts packages/shared/src/index.ts apps/api/src/utils/horizon.test.ts
git commit -m "feat: fonctions pures d'horizon temporel (effectiveHorizon, isOverdueForReview)"
```

---

### Task 3 : API — PATCH item accepte manualHorizon (TDD)

**Files:**
- Modify: `apps/api/src/routes/items.ts:37-53` (updateItemSchema), `apps/api/src/routes/items.ts:510-532` (handler)
- Modify: `apps/api/src/routes/items.test.ts`

- [ ] **Step 3.1 : Écrire le test (rouge)**

Ajouter dans `apps/api/src/routes/items.test.ts`, dans le `describe('PATCH /spaces/:spaceId/items/:id', ...)` existant, après le test `'should update item fields'` :

```ts
    it('should set horizonSetAt when manualHorizon changes', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem({ manualHorizon: null, horizonSetAt: null }))
      prisma.item.update.mockResolvedValue(mockItem({ manualHorizon: 'WEEK' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { manualHorizon: 'WEEK' },
      })

      expect(res.statusCode).toBe(200)
      const updateCall = prisma.item.update.mock.calls[0][0]
      expect(updateCall.data.manualHorizon).toBe('WEEK')
      expect(updateCall.data.horizonSetAt).toBeInstanceOf(Date)
    })

    it('should not touch horizonSetAt when manualHorizon is not in the payload', async () => {
      allowSpaceAccess()
      prisma.item.findFirst.mockResolvedValue(mockItem())
      prisma.item.update.mockResolvedValue(mockItem({ title: 'Updated' }))

      const res = await app.inject({
        method: 'PATCH',
        url: `/spaces/${SPACE_ID}/items/item-1`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated' },
      })

      expect(res.statusCode).toBe(200)
      const updateCall = prisma.item.update.mock.calls[0][0]
      expect(updateCall.data.horizonSetAt).toBeUndefined()
    })
```

- [ ] **Step 3.2 : Vérifier que les tests échouent**

Run: `pnpm exec vitest run apps/api/src/routes/items.test.ts -t "manualHorizon"`
Expected: FAIL — `updateItemSchema.parse` rejette le champ `manualHorizon` inconnu (zod, mode strict par défaut sur les champs non déclarés n'est pas strict ici, donc il serait probablement silencieusement ignoré : le test échoue plutôt sur `updateCall.data.manualHorizon` étant `undefined`)

- [ ] **Step 3.3 : Ajouter le champ au schéma zod**

Dans `apps/api/src/routes/items.ts`, dans `updateItemSchema` (ligne ~37), ajouter après `endDate` :

```ts
  manualHorizon: z.enum(['NOW', 'TODAY', 'WEEK', 'MONTH', 'LATER']).nullable().optional(),
```

- [ ] **Step 3.4 : Auto-set horizonSetAt dans le handler**

Dans `apps/api/src/routes/items.ts`, juste avant l'appel `fastify.prisma.item.update` (ligne ~510), à côté du calcul existant `autoEndDate`, ajouter :

```ts
      // Auto-set horizonSetAt à chaque changement de manualHorizon — jamais fourni par le
      // client, c'est lui qui mesure le dépassement de grâce (isOverdueForReview), pas updatedAt.
      const autoHorizonSetAt = updateData.manualHorizon !== undefined ? new Date() : undefined;
```

Puis dans l'objet `data` de `fastify.prisma.item.update` (ligne ~517), ajouter la ligne :

```ts
          horizonSetAt: autoHorizonSetAt,
```

Le bloc `data` complet devient :

```ts
        data: {
          ...updateData,
          updatedById: request.user.userId,
          dueDate: updateData.dueDate === null ? null : updateData.dueDate ? new Date(updateData.dueDate) : undefined,
          startDate: updateData.startDate === null ? null : updateData.startDate ? new Date(updateData.startDate) : undefined,
          endDate: updateData.endDate === null ? null : updateData.endDate ? new Date(updateData.endDate) : (autoEndDate || undefined),
          horizonSetAt: autoHorizonSetAt,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        } as any,
```

- [ ] **Step 3.5 : Vérifier que les tests passent**

Run: `pnpm exec vitest run apps/api/src/routes/items.test.ts`
Expected: PASS (tous les tests du fichier, y compris les 2 nouveaux)

- [ ] **Step 3.6 : Typecheck api**

Run: `pnpm --filter @spok/api exec tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3.7 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/api/src/routes/items.ts apps/api/src/routes/items.test.ts
git commit -m "feat: PATCH item accepte manualHorizon, horizonSetAt auto-géré"
```

---

### Task 4 : API — endpoint GET /user/review-queue (TDD)

**Files:**
- Modify: `apps/api/src/routes/agenda.ts:21-33` (exporter `accessibleSpaceIds`)
- Create: `apps/api/src/routes/review-queue.ts`
- Create: `apps/api/src/routes/review-queue.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 4.1 : Exporter accessibleSpaceIds depuis agenda.ts**

Dans `apps/api/src/routes/agenda.ts` ligne 21, changer :

```ts
async function accessibleSpaceIds(fastify: FastifyInstance, userId: string): Promise<string[]> {
```

en :

```ts
export async function accessibleSpaceIds(fastify: FastifyInstance, userId: string): Promise<string[]> {
```

- [ ] **Step 4.2 : Écrire les tests (rouges)**

```ts
/*
 * Tests de GET /user/review-queue : bac à trier + items en horizon dépassé,
 * périmètre restreint aux espaces accessibles de l'utilisateur.
 */
import { describe, it, expect, vi } from 'vitest'
import { buildItemsTestApp, getTestToken, MockPrisma } from '../test/helpers.js'

const USER_ID = 'test-user-id'
const SPACE_ID = 'space-1'

function mockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'Item',
    type: 'TASK',
    status: null,
    priority: null,
    dueDate: null,
    manualHorizon: null,
    horizonSetAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    spaceId: SPACE_ID,
    space: { id: SPACE_ID, name: 'Espace test' },
    ...overrides,
  }
}

describe('GET /user/review-queue', () => {
  it('retourne les items sans échéance ni horizon dans toTriage', async () => {
    const { app, prisma } = buildItemsTestApp()
    const token = getTestToken(USER_ID)
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([mockItem()])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.toTriage).toHaveLength(1)
    expect(body.overdue).toHaveLength(0)
  })

  it('sépare le bac à trier des items en horizon dépassé', async () => {
    const { app, prisma } = buildItemsTestApp()
    const token = getTestToken(USER_ID)
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([
      mockItem({ id: 'a', manualHorizon: null, horizonSetAt: null }),
      mockItem({ id: 'b', manualHorizon: 'WEEK', horizonSetAt: new Date('2026-01-01T00:00:00.000Z') }),
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    const body = res.json()
    expect(body.toTriage.map((i: { id: string }) => i.id)).toEqual(['a'])
    expect(body.overdue.map((i: { id: string }) => i.id)).toEqual(['b'])
  })

  it('exclut les items done/cancelled', async () => {
    const { app, prisma } = buildItemsTestApp()
    const token = getTestToken(USER_ID)
    prisma.spaceMembership.findMany.mockResolvedValue([{ spaceId: SPACE_ID }])
    prisma.communityMembership.findMany.mockResolvedValue([])
    prisma.item.findMany.mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    const where = prisma.item.findMany.mock.calls[0][0].where
    expect(where.status).toEqual({ notIn: ['done', 'cancelled'] })
  })

  it('retourne vide si aucun espace accessible', async () => {
    const { app, prisma } = buildItemsTestApp()
    const token = getTestToken(USER_ID)
    prisma.spaceMembership.findMany.mockResolvedValue([])
    prisma.communityMembership.findMany.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/user/review-queue',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.toTriage).toEqual([])
    expect(body.overdue).toEqual([])
    expect(prisma.item.findMany).not.toHaveBeenCalled()
  })

  it('retourne 401 sans token', async () => {
    const { app } = buildItemsTestApp()
    const res = await app.inject({ method: 'GET', url: '/user/review-queue' })
    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 4.3 : Vérifier que les tests échouent**

Run: `pnpm exec vitest run apps/api/src/routes/review-queue.test.ts`
Expected: FAIL — route `/user/review-queue` introuvable (404) ou fichier introuvable

- [ ] **Step 4.4 : Implémenter la route**

```ts
/*
 * GET /user/review-queue : items à faire remonter dans la section « À réviser » de /today
 * (spec 2026-07-19-horizons-revue-design) — deux groupes distincts, jamais fusionnés :
 * - toTriage : sans échéance ni horizon assigné (bac à trier), les plus anciens en premier
 * - overdue : horizon manuel assigné mais grâce dépassée (isOverdueForReview) — jamais LATER
 * Périmètre : mêmes espaces accessibles que /user/agenda et /user/tasks.
 */
import { FastifyPluginAsync } from 'fastify'
import { isOverdueForReview } from '@spok/shared'
import { accessibleSpaceIds } from './agenda.js'

const CLOSED_STATUSES = ['done', 'cancelled']

export const reviewQueueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/review-queue', async (request) => {
    const spaceIds = await accessibleSpaceIds(fastify, request.user.userId)
    if (spaceIds.length === 0) {
      return { toTriage: [], overdue: [] }
    }

    const items = await fastify.prisma.item.findMany({
      where: {
        spaceId: { in: spaceIds },
        dueDate: null,
        status: { notIn: CLOSED_STATUSES },
      },
      select: {
        id: true, title: true, type: true, status: true, priority: true,
        manualHorizon: true, horizonSetAt: true, createdAt: true,
        spaceId: true, space: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const toTriage = items.filter((i) => !i.manualHorizon)
    const overdue = items.filter((i) => i.manualHorizon && isOverdueForReview(i))

    return { toTriage, overdue }
  })
}
```

- [ ] **Step 4.5 : Enregistrer la route**

Dans `apps/api/src/index.ts`, ajouter l'import à côté des autres routes `/user` (ligne ~49) :

```ts
import { reviewQueueRoutes } from './routes/review-queue.js';
```

Puis l'enregistrement à côté des autres (ligne ~304) :

```ts
  await app.register(reviewQueueRoutes, { prefix: '/user' });
```

- [ ] **Step 4.6 : Vérifier que les tests passent**

Run: `pnpm exec vitest run apps/api/src/routes/review-queue.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4.7 : Typecheck api**

Run: `pnpm --filter @spok/api exec tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 4.8 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/api/src/routes/agenda.ts apps/api/src/routes/review-queue.ts apps/api/src/routes/review-queue.test.ts apps/api/src/index.ts
git commit -m "feat: endpoint GET /user/review-queue (bac a trier + horizons depasses)"
```

---

### Task 5 : API user-tasks + client web (types et appels)

**Files:**
- Modify: `apps/api/src/routes/user-tasks.ts:240-262` (select)
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 5.1 : Sélectionner les nouveaux champs dans /user/tasks**

Dans `apps/api/src/routes/user-tasks.ts`, dans le `select` de `fastify.prisma.item.findMany` (ligne ~240), ajouter après `endDate: true,` :

```ts
          manualHorizon: true,
          horizonSetAt: true,
```

- [ ] **Step 5.2 : Typecheck + test existant (non-régression)**

Run: `pnpm --filter @spok/api exec tsc --noEmit`
Expected: 0 erreur

Run: `pnpm exec vitest run apps/api/src/routes/user-tasks.test.ts`
Expected: PASS (aucun test cassé — le select ajoute des champs, ne change aucun comportement de filtrage)

- [ ] **Step 5.3 : Étendre GlobalTask et ajouter reviewQueueApi côté web**

Dans `apps/web/src/lib/api.ts`, importer le type partagé en tête de fichier (chercher les imports depuis `@spok/shared` existants et ajouter à la liste) :

```ts
import type { HorizonBucket } from '@spok/shared';
```

Dans `export interface GlobalTask { ... }` (ligne ~440), ajouter après `endDate: string | null;` :

```ts
  manualHorizon: HorizonBucket | null;
  horizonSetAt: string | null;
```

Puis, à la suite des exports `agendaApi` (chercher `export const agendaApi`), ajouter un nouvel export :

```ts
export interface ReviewQueueItem {
  id: string; title: string; type: string; status: string | null; priority: number | null;
  manualHorizon: HorizonBucket | null; horizonSetAt: string | null; createdAt: string;
  spaceId: string; space: { id: string; name: string };
}
export interface ReviewQueueResponse { toTriage: ReviewQueueItem[]; overdue: ReviewQueueItem[] }

export const reviewQueueApi = {
  get: () => fetchApi<ReviewQueueResponse>('/user/review-queue'),
};
```

- [ ] **Step 5.4 : Typecheck web**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 5.5 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/api/src/routes/user-tasks.ts apps/web/src/lib/api.ts
git commit -m "feat: expose manualHorizon/horizonSetAt cote client, reviewQueueApi"
```

---

### Task 6 : Composant HorizonGroup (web)

**Files:**
- Create: `apps/web/src/components/HorizonGroup.tsx`

- [ ] **Step 6.1 : Implémenter le composant**

```tsx
/*
 * Section repliable pour un groupe d'items classés par horizon temporel (Maintenant,
 * Aujourd'hui, Semaine, Mois, Plus tard, À trier) — utilisé par GlobalTasksPage.
 * Affiche au plus `initialLimit` items, avec un bouton « Voir tout (N) » pour étendre
 * (plafond purement client, pas de pagination serveur par groupe — cf. plan chantier 1).
 * `renderItem` reste la responsabilité du consommateur : ce composant ne connaît rien
 * du rendu d'une ligne, seulement le pliage/dépliage et le plafond.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const DEFAULT_LIMIT = 20;

export function HorizonGroup<T>({ title, items, renderItem, initialLimit = DEFAULT_LIMIT, defaultCollapsed = false }: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  initialLimit?: number;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, initialLimit);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-4 sm:px-6 py-2 text-left text-xs font-semibold text-foreground uppercase tracking-wider hover:bg-muted/30"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
        <span>{title}</span>
        <span className="ml-auto text-muted-foreground font-normal normal-case">{items.length}</span>
      </button>
      {!collapsed && (
        <>
          {visible.map((item, i) => <div key={i}>{renderItem(item)}</div>)}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full px-4 sm:px-6 py-2 text-xs text-primary hover:bg-muted/30 text-left"
            >
              Voir tout ({hiddenCount} de plus)
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2 : Typecheck web**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur (composant non encore consommé, mais doit compiler seul)

- [ ] **Step 6.3 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/components/HorizonGroup.tsx
git commit -m "feat: composant HorizonGroup (section repliable + plafond client)"
```

---

### Task 7 : GlobalTasksPage regroupée par horizon

**Files:**
- Modify: `apps/web/src/pages/GlobalTasksPage.tsx`

- [ ] **Step 7.1 : Importer les dépendances**

En tête de `apps/web/src/pages/GlobalTasksPage.tsx`, ajouter :

```ts
import { effectiveHorizon, HORIZON_LABELS, HORIZON_ORDER } from '@spok/shared';
import { HorizonGroup } from '../components/HorizonGroup';
```

- [ ] **Step 7.2 : Forcer pageSize=2000 (un seul aller-retour, groupage client)**

Dans `useGlobalTaskFilters({ defaultMyTasks: true })` (ligne ~67), passer aussi `pageSize` :

```ts
  const internalFilters = useGlobalTaskFilters({ defaultMyTasks: true, pageSize: 2000 });
```

- [ ] **Step 7.3 : Extraire le rendu d'une ligne en fonction réutilisable**

Juste avant le `return (` du composant, ajouter une fonction qui construit le JSX d'une ligne desktop (reprend exactement le contenu existant du `.map()` desktop, ligne ~186-274, en le transformant en fonction paramétrée par `task`) :

```ts
  const renderDesktopRow = (task: GlobalTask) => (
    <div
      key={task.id}
      className="grid grid-cols-[1fr_10rem_7rem_6rem_7rem_7rem] items-center gap-2 px-6 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={() => setEditingTask({ itemId: task.id, spaceId: task.spaceId })}
    >
      <div className="flex items-center gap-2 min-w-0">
        <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {(filters.selectedTypes.length !== 1) && (
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            typeOptions.find((t) => t.id === task.type)?.color || 'bg-gray-100 text-gray-600'
          }`}>
            {TYPE_LABELS[task.type] || task.type}
          </span>
        )}
        <span className="truncate font-medium text-sm">{task.title}</span>
        {task.parent && (
          <span className="text-xs text-muted-foreground truncate flex-shrink-0">← {task.parent.title}</span>
        )}
      </div>
      <div>
        <button
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-full"
          onClick={(e) => { e.stopPropagation(); navigate(`/spaces/${task.spaceId}`); }}
          title={task.spaceName}
        >
          <FolderKanban className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{task.spaceName}</span>
        </button>
      </div>
      <div>
        {task.status ? (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR_MAP[task.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL_MAP[task.status] || task.status}
          </span>
        ) : <span className="text-xs text-muted-foreground/50">-</span>}
      </div>
      <div>
        {task.priority ? (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${PRIORITY_LABELS[task.priority]?.color || 'bg-gray-100 text-gray-600'}`}>
            {PRIORITY_LABELS[task.priority]?.label || `P${task.priority}`}
          </span>
        ) : <span className="text-xs text-muted-foreground/50">-</span>}
      </div>
      <div>
        {task.dueDate ? (
          <span className={`inline-flex items-center gap-1 text-xs ${
            isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled' ? 'text-red-600 font-medium' : 'text-muted-foreground'
          }`}>
            {isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled' && <AlertCircle className="w-3 h-3" />}
            {formatDate(task.dueDate)}
          </span>
        ) : <span className="text-xs text-muted-foreground/50">-</span>}
      </div>
      <div className="text-xs text-muted-foreground">{formatDate(task.createdAt)}</div>
    </div>
  );
```

- [ ] **Step 7.4 : Grouper les tâches par horizon**

Juste après `const tasks = tasksData?.data || [];` (ligne ~90), ajouter :

```ts
  const horizonGroups = HORIZON_ORDER.map((h) => ({
    horizon: h,
    label: HORIZON_LABELS[h],
    items: tasks.filter((t) => effectiveHorizon(t) === h),
  })).concat([{
    horizon: null as never,
    label: 'À trier',
    items: tasks.filter((t) => effectiveHorizon(t) === null),
  }]);
```

- [ ] **Step 7.5 : Remplacer le rendu plat par le regroupement**

Remplacer le bloc `{/* Desktop table rows */}` et son `.map()` (ligne ~184-275) par :

```tsx
            <div className="hidden md:block">
              {horizonGroups.map((g) => (
                <HorizonGroup key={g.label} title={g.label} items={g.items} renderItem={renderDesktopRow} />
              ))}
            </div>
```

Laisser la liste mobile (`{/* Mobile card list */}`) inchangée pour cette étape — le regroupement mobile n'est pas demandé dans la spec, seul le tableau desktop l'était implicitement (la liste mobile reste triée à plat, cohérent avec le fait qu'elle est déjà compacte).

- [ ] **Step 7.6 : Retirer la pagination serveur devenue inutile**

Le bloc `{/* Pagination */}` (ligne ~344 et suivantes) devient obsolète puisque `pageSize=2000` récupère tout en un appel — le supprimer entièrement (de `{totalPages > 1 && (` jusqu'à la fermeture `)}` correspondante).

- [ ] **Step 7.7 : Vérification manuelle**

Lancer `pnpm dev:start` si le dev n'est pas déjà actif, ouvrir `/tasks` dans le navigateur, vérifier que les sections Maintenant/Aujourd'hui/Semaine/Mois/Plus tard/À trier apparaissent avec leurs compteurs, que les filtres existants s'appliquent toujours, et qu'un groupe de plus de 20 items affiche bien « Voir tout ».

- [ ] **Step 7.8 : Typecheck web**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 7.9 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/pages/GlobalTasksPage.tsx
git commit -m "feat: /tasks regroupe par horizon temporel au lieu d'une liste plate paginee"
```

---

### Task 8 : Section « À réviser » dans /today

**Files:**
- Create: `apps/web/src/components/today/ReviewQueueSection.tsx`
- Modify: `apps/web/src/pages/TodayPage.tsx`

- [ ] **Step 8.1 : Implémenter le composant**

```tsx
/*
 * Section « À réviser » de /today (spec 2026-07-19-horizons-revue-design) : bac à trier
 * + items en horizon dépassé, jamais fusionnés (deux groupes distincts). 4 actions inline
 * par ligne : Fait, Plus d'actualité, Reporter à un horizon (select), Planifier (premier
 * créneau libre, même mécanisme que DayPlanList.onPlace).
 * Repliée par défaut si vide, dépliable sinon — le badge affiche le total des deux groupes.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Ban, CalendarClock, ClipboardList } from 'lucide-react';
import { HORIZON_LABELS, HORIZON_ORDER, type HorizonBucket } from '@spok/shared';
import type { ReviewQueueItem } from '@/lib/api';

export function ReviewQueueSection({ toTriage, overdue, onDone, onDismiss, onSetHorizon, onPlanNow }: {
  toTriage: ReviewQueueItem[];
  overdue: ReviewQueueItem[];
  onDone: (item: ReviewQueueItem) => void;
  onDismiss: (item: ReviewQueueItem) => void;
  onSetHorizon: (item: ReviewQueueItem, horizon: HorizonBucket) => void;
  onPlanNow: (item: ReviewQueueItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = toTriage.length + overdue.length;
  if (total === 0) return null;

  const row = (item: ReviewQueueItem) => (
    <div key={item.id} className="group flex items-center gap-2 px-2 py-1.5 text-sm border-b border-border/30">
      <span className="truncate min-w-0 flex-1">{item.title}</span>
      <select
        className="text-xs border border-input rounded px-1 py-0.5 bg-background opacity-0 group-hover:opacity-100 focus:opacity-100"
        value=""
        onChange={(e) => { if (e.target.value) onSetHorizon(item, e.target.value as HorizonBucket); }}
      >
        <option value="" disabled>Reporter à…</option>
        {HORIZON_ORDER.map((h) => <option key={h} value={h}>{HORIZON_LABELS[h]}</option>)}
      </select>
      <button onClick={() => onPlanNow(item)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Planifier dans un créneau">
        <CalendarClock className="w-4 h-4" />
      </button>
      <button onClick={() => onDone(item)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Fait">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => onDismiss(item)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Plus d'actualité">
        <Ban className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="mb-3 border border-border rounded-lg overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted/30 hover:bg-muted/50">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <ClipboardList className="w-4 h-4" />
        À réviser
        <span className="ml-auto text-xs text-muted-foreground">{total}</span>
      </button>
      {!collapsed && (
        <div>
          {toTriage.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] text-muted-foreground uppercase tracking-wider">Bac à trier ({toTriage.length})</div>
              {toTriage.map(row)}
            </>
          )}
          {overdue.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] text-muted-foreground uppercase tracking-wider">Horizon dépassé ({overdue.length})</div>
              {overdue.map(row)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2 : Intégrer dans TodayPage**

Dans `apps/web/src/pages/TodayPage.tsx`, `useQuery`/`useQueryClient` sont déjà importés (ligne 11 du fichier actuel). Étendre l'import existant depuis `@/lib/api` (ligne 19) :

```ts
import { itemsApi, reviewQueueApi, type AgendaFilters, type DayPlanEntryDto, type DayPlanItemDto, type ReviewQueueItem } from '@/lib/api';
```

Et ajouter une nouvelle ligne d'import :

```ts
import { ReviewQueueSection } from '@/components/today/ReviewQueueSection';
```

Ajouter la requête et les handlers juste après la définition de `busy` (après la ligne ~68) :

```ts
  const { data: reviewData } = useQuery({
    queryKey: ['review-queue'],
    queryFn: reviewQueueApi.get,
  });
  const invalidateReviewQueue = () => queryClient.invalidateQueries({ queryKey: ['review-queue'] });

  const handleReviewDone = async (item: ReviewQueueItem) => {
    await itemsApi.update(item.spaceId, item.id, { status: 'done' });
    invalidateReviewQueue();
  };
  const handleReviewDismiss = async (item: ReviewQueueItem) => {
    await itemsApi.update(item.spaceId, item.id, { status: 'cancelled' });
    invalidateReviewQueue();
  };
  const handleReviewSetHorizon = async (item: ReviewQueueItem, horizon: string) => {
    await itemsApi.update(item.spaceId, item.id, { manualHorizon: horizon as never });
    invalidateReviewQueue();
  };
  const handleReviewPlanNow = async (item: ReviewQueueItem) => {
    const dayStart = new Date(`${date}T07:00:00`);
    const dayEnd = new Date(`${date}T23:59:00`);
    const slot = findFreeSlot(busy, 30, new Date(), dayStart, dayEnd);
    if (!slot) return;
    await addToPlan.mutateAsync({ itemId: item.id, source: 'manual', plannedStart: slot.toISOString(), plannedDuration: 30 });
    invalidateReviewQueue();
  };
```

Puis insérer le composant juste avant `{(data?.feedErrors?.length ?? 0) > 0 && (` (dans le bloc `<div className="min-w-0">`, ligne ~152) :

```tsx
              <ReviewQueueSection
                toTriage={reviewData?.toTriage ?? []}
                overdue={reviewData?.overdue ?? []}
                onDone={handleReviewDone}
                onDismiss={handleReviewDismiss}
                onSetHorizon={handleReviewSetHorizon}
                onPlanNow={handleReviewPlanNow}
              />
```

- [ ] **Step 8.3 : Mettre à jour le commentaire d'en-tête de TodayPage**

Ajouter une ligne dans le commentaire d'en-tête existant, après la description de la grille :

```
 * Section « À réviser » (spec 2026-07-19) : bac à trier + horizons dépassés, cf. ReviewQueueSection.
```

- [ ] **Step 8.4 : Vérification manuelle**

Ouvrir `/today` dans le navigateur, vérifier que la section « À réviser » apparaît si des items sans échéance/horizon existent, que les 4 actions par ligne fonctionnent (Fait retire la ligne, Reporter à un horizon aussi, Planifier ajoute l'item à la liste du jour placé sur la grille).

- [ ] **Step 8.5 : Typecheck web**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 8.6 : Commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/components/today/ReviewQueueSection.tsx apps/web/src/pages/TodayPage.tsx
git commit -m "feat: section A reviser dans /today (bac a trier + horizons depasses)"
```

---

### Task 9 : Vérification globale et documentation

- [ ] **Step 9.1 : Suite de tests complète (réservée à cette étape, pas avant)**

Run: `pnpm exec vitest run`
Expected: tous les tests passent, y compris les nouveaux (horizon.test.ts, review-queue.test.ts, items.test.ts étendu)

- [ ] **Step 9.2 : Typecheck des 5 paquets**

Run: `pnpm typecheck`
Expected: 0 erreur

- [ ] **Step 9.3 : Contrôle des en-têtes de documentation**

Run: `node scripts/check-doc-headers.mjs`
Expected: `✅ Documentation OK`

- [ ] **Step 9.4 : Mettre à jour docs/TODO.md**

Ajouter une ligne dans la section pertinente (UX & formulaires ou Evolutions), format cohérent avec les entrées existantes :

```
- [x] Horizons temporels + revue de rattrapage (chantier 1) : champs manualHorizon/horizonSetAt, /tasks regroupé par horizon, section « À réviser » dans /today (bac à trier + horizons dépassés, jamais LATER) — spec docs/superpowers/specs/2026-07-19 — YYYY-MM-DD (hash à compléter après commit)
```

- [ ] **Step 9.5 : Mettre à jour docs/session-journal.md**

Ajouter une entrée en tête de la section EN COURS résumant l'implémentation et son état de vérification, à la manière des entrées précédentes du journal.

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : section 1 (modèle) → Task 1 ; section 2 (dérivation) → Task 2 ; section 3 (grâce par horizon) → Task 2 ; section 4 (file de revue + actions) → Tasks 3-4 ; section 5 (UI /today et /tasks) → Tasks 7-8. Rien d'oublié.
- **Placeholders** : aucun — chaque étape de code contient le code complet, aucune référence à une fonction non définie dans une task antérieure.
- **Cohérence des types** : `HorizonBucket`/`effectiveHorizon`/`isOverdueForReview`/`HORIZON_LABELS`/`HORIZON_ORDER` définis Task 2, réutilisés identiquement Tasks 3, 4, 7, 8 sans renommage. `ReviewQueueItem`/`ReviewQueueResponse`/`reviewQueueApi` définis Task 5, consommés Task 8 sans changement de forme.
- **Risque assumé** : Step 8.2 suppose `queryClient` déjà défini dans `TodayPage.tsx` (c'est le cas, ligne ~60 du fichier actuel) — le commentaire inline avertit explicitement de vérifier avant d'ajouter un import dupliqué.
