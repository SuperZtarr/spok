# Déplacement en cascade des items liés ("Entraîne") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un type de relation `drives` ("Entraîne") entre deux items : quand l'item ancre (source de la relation) voit une de ses dates bouger, l'utilisateur peut choisir de décaler du même nombre de jours tous les items entraînés, en cascade transitive.

**Architecture:** Backend — nouveau type de relation validé côté route (`item-relations.ts`, détection de cycle), nouvel endpoint `POST /spaces/:spaceId/items/:id/cascade-shift` qui revalide et applique le décalage à une liste d'ids confirmée par le client, réutilisant l'utilitaire de décalage calendaire déjà écrit pour `bulk-duplicate` (extrait dans `utils/dateShift.ts`). Frontend — un utilitaire pur (`lib/cascadeShift.ts`) calcule côté client la liste des dépendants affectés (parcours transitif du graphe `drives`), une modale de confirmation partagée, branchée dans `ItemEditModal` (sauvegarde) et `TimelineView` (nouveau drag de déplacement du corps de barre, distinct du resize existant). Le type `drives` est ajouté aux 4 endroits où les types de relation existent déjà : `ItemEditModal`, `PertView`, `TimelineView` (sa propre UI de connexion), `MindMapView`.

**Tech Stack:** Fastify, Zod, Prisma, React, TanStack Query, Vitest.

---

## Fichiers modifiés/créés

| Fichier | Changement |
|---|---|
| `apps/api/src/utils/dateShift.ts` | NEW — `shiftDate`/`shiftItemDates` extraits de `item-bulk.ts` |
| `apps/api/src/routes/item-bulk.ts` | Import depuis `utils/dateShift.ts` au lieu de définir localement |
| `packages/shared/src/constants/index.ts` | `RELATION_TYPES` + `'drives'` |
| `apps/api/src/utils/drivesGraph.ts` | NEW — BFS sur les relations `drives` (cycle + reachability) |
| `apps/api/src/routes/item-relations.ts` | Détection de cycle à la création d'une relation `drives` |
| `apps/api/src/routes/item-cascade-shift.ts` | NEW — `POST /:id/cascade-shift` |
| `apps/api/src/routes/items.ts` | Enregistre `itemCascadeShiftRoutes` |
| `apps/web/src/lib/cascadeShift.ts` | NEW — calcul client des dépendants transitifs |
| `apps/web/src/lib/api.ts` | `itemsApi.cascadeShift` |
| `apps/web/src/components/CascadeShiftConfirmModal.tsx` | NEW — modale de confirmation partagée |
| `apps/web/src/components/ItemEditModal.tsx` | `drives` dans le dropdown/labels + branchement cascade à la sauvegarde |
| `apps/web/src/components/views/PertView.tsx` | `drives` dans `PERT_RELATION_TYPES`/`RELATION_HEX`/marker/`RelationRow` |
| `apps/web/src/components/views/timeline-constants.ts` | `drives` dans `RELATION_TYPES` |
| `apps/web/src/components/views/TimelineView.tsx` | `drives` dans marker/couleur + nouveau drag de déplacement + cascade |
| `apps/web/src/components/views/mindmap-utils.ts` | `drives` dans `RELATION_TYPES` |
| `apps/web/src/pages/useSpaceActions.ts` | `handleCascadeShift` |
| `apps/web/src/pages/SpacePage.tsx` | `onCascadeShift` passé à `TimelineView` |

---

## Task 1 — Extraire l'utilitaire de décalage de dates

**Files:**
- Create: `apps/api/src/utils/dateShift.ts`
- Create: `apps/api/src/utils/dateShift.test.ts`
- Modify: `apps/api/src/routes/item-bulk.ts:1-45`

- [ ] **Étape 1 — Écrire le test (fichier n'existe pas encore, échoue à l'import)**

```typescript
// apps/api/src/utils/dateShift.test.ts
/* TNR de l'utilitaire de décalage calendaire de dates — extrait de item-bulk.ts pour être réutilisé par la cascade "Entraîne". */
import { describe, it, expect } from 'vitest'
import { shiftDate, shiftItemDates } from './dateShift.js'

describe('shiftDate', () => {
  it('day : ajoute des jours simples', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'day', 5).toISOString()).toBe('2026-01-20T00:00:00.000Z')
  })

  it('week : ajoute des semaines', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'week', 2).toISOString()).toBe('2026-01-29T00:00:00.000Z')
  })

  it('month : calendaire, clampe en fin de mois (31 jan +1 mois -> 28 fev, 2026 non bissextile)', () => {
    expect(shiftDate(new Date('2026-01-31T00:00:00.000Z'), 'month', 1).toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it('year : ajoute des années', () => {
    expect(shiftDate(new Date('2026-01-15T00:00:00.000Z'), 'year', 1).toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })
})

describe('shiftItemDates', () => {
  const item = {
    dueDate: new Date('2026-01-15T00:00:00.000Z'),
    startDate: new Date('2026-01-15T09:00:00.000Z'),
    endDate: new Date('2026-01-15T10:00:00.000Z'),
  }

  it('decale les 3 champs quand unit et amount sont fournis', () => {
    const result = shiftItemDates(item, 'day', 5)
    expect(result.dueDate?.toISOString()).toBe('2026-01-20T00:00:00.000Z')
    expect(result.startDate?.toISOString()).toBe('2026-01-20T09:00:00.000Z')
    expect(result.endDate?.toISOString()).toBe('2026-01-20T10:00:00.000Z')
  })

  it('ne touche a rien si amount vaut 0', () => {
    const result = shiftItemDates(item, 'day', 0)
    expect(result).toEqual(item)
  })

  it('ne touche a rien si unit est undefined', () => {
    const result = shiftItemDates(item, undefined, 5)
    expect(result).toEqual(item)
  })

  it('laisse les champs null inchanges', () => {
    const result = shiftItemDates({ dueDate: null, startDate: null, endDate: null }, 'day', 5)
    expect(result).toEqual({ dueDate: null, startDate: null, endDate: null })
  })
})
```

- [ ] **Étape 2 — Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @spok/api test dateShift -- --run`
Expected: FAIL — `Cannot find module './dateShift.js'`

- [ ] **Étape 3 — Créer l'utilitaire (code déplacé tel quel depuis item-bulk.ts)**

```typescript
// apps/api/src/utils/dateShift.ts
/* Décalage calendaire de dates (jour/semaine/mois/année) — utilisé par bulk-duplicate et par la
 * cascade "Entraîne" (item-cascade-shift). +1 mois sur le 31 janvier donne le dernier jour de
 * février (clampé), jamais un débordement type "31 jan + 30 jours" qui roulerait sur début mars. */
export function shiftDate(date: Date, unit: 'day' | 'week' | 'month' | 'year', amount: number): Date {
  const d = new Date(date);
  if (unit === 'day') { d.setDate(d.getDate() + amount); return d; }
  if (unit === 'week') { d.setDate(d.getDate() + amount * 7); return d; }
  const originalDay = d.getDate();
  const targetMonth = unit === 'month' ? d.getMonth() + amount : d.getMonth();
  const targetYear = unit === 'year' ? d.getFullYear() + amount : d.getFullYear();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  d.setFullYear(targetYear, targetMonth, Math.min(originalDay, daysInTargetMonth));
  return d;
}

export function shiftItemDates<T extends { dueDate: Date | null; startDate: Date | null; endDate: Date | null }>(
  item: T,
  unit: 'day' | 'week' | 'month' | 'year' | undefined,
  amount: number
): { dueDate: Date | null; startDate: Date | null; endDate: Date | null } {
  if (!unit || amount === 0) {
    return { dueDate: item.dueDate, startDate: item.startDate, endDate: item.endDate };
  }
  return {
    dueDate: item.dueDate ? shiftDate(item.dueDate, unit, amount) : null,
    startDate: item.startDate ? shiftDate(item.startDate, unit, amount) : null,
    endDate: item.endDate ? shiftDate(item.endDate, unit, amount) : null,
  };
}
```

- [ ] **Étape 4 — Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @spok/api test dateShift -- --run`
Expected: PASS (9 tests)

- [ ] **Étape 5 — Faire pointer item-bulk.ts vers le nouvel utilitaire**

Dans `apps/api/src/routes/item-bulk.ts`, remplacer les lignes 1-30 :
```typescript
/* Opérations en masse sur les items : duplication/déplacement multi-items vers un autre espace. */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';

const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
  iterations: z.number().int().min(1).max(365).default(1),
  offsetUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
});

// Décalage calendaire (pas une approximation en jours fixes) : +1 mois sur le 31 janvier
// donne le dernier jour de février (clampé), jamais un débordement type "31 jan + 30 jours"
// qui roulerait sur début mars (comportement par défaut de Date#setMonth).
function shiftDate(date: Date, unit: 'day' | 'week' | 'month' | 'year', amount: number): Date {
  const d = new Date(date);
  if (unit === 'day') { d.setDate(d.getDate() + amount); return d; }
  if (unit === 'week') { d.setDate(d.getDate() + amount * 7); return d; }
  // month/year : clamper au dernier jour valide du mois cible (setFullYear(y, m, day) atomique
  // évite tout débordement intermédiaire).
  const originalDay = d.getDate();
  const targetMonth = unit === 'month' ? d.getMonth() + amount : d.getMonth();
  const targetYear = unit === 'year' ? d.getFullYear() + amount : d.getFullYear();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  d.setFullYear(targetYear, targetMonth, Math.min(originalDay, daysInTargetMonth));
  return d;
}

function shiftItemDates<T extends { dueDate: Date | null; startDate: Date | null; endDate: Date | null }>(
  item: T,
  unit: 'day' | 'week' | 'month' | 'year' | undefined,
  amount: number
): { dueDate: Date | null; startDate: Date | null; endDate: Date | null } {
  if (!unit || amount === 0) {
    return { dueDate: item.dueDate, startDate: item.startDate, endDate: item.endDate };
  }
  return {
    dueDate: item.dueDate ? shiftDate(item.dueDate, unit, amount) : null,
    startDate: item.startDate ? shiftDate(item.startDate, unit, amount) : null,
    endDate: item.endDate ? shiftDate(item.endDate, unit, amount) : null,
  };
}
```
Par :
```typescript
/* Opérations en masse sur les items : duplication/déplacement multi-items vers un autre espace. */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
import { shiftItemDates } from '../utils/dateShift.js';

const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
  iterations: z.number().int().min(1).max(365).default(1),
  offsetUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
});
```

- [ ] **Étape 6 — Vérifier que les tests existants passent toujours (refactor comportement-préservant)**

Run: `pnpm --filter @spok/api test item-bulk -- --run`
Expected: PASS (7 tests, inchangé)

- [ ] **Étape 7 — Commit**

```bash
git add apps/api/src/utils/dateShift.ts apps/api/src/utils/dateShift.test.ts apps/api/src/routes/item-bulk.ts
git commit -m "refactor: extraire shiftDate/shiftItemDates dans utils/dateShift.ts"
```

---

## Task 2 — Ajouter `drives` à la constante partagée

**Files:**
- Modify: `packages/shared/src/constants/index.ts:23`

- [ ] **Étape 1 — Modifier la constante**

Remplacer :
```typescript
export const RELATION_TYPES = ['blocks', 'relates', 'implements', 'parent'] as const;
```
Par :
```typescript
export const RELATION_TYPES = ['blocks', 'relates', 'implements', 'parent', 'drives'] as const;
```

- [ ] **Étape 2 — Rebuild packages**

```bash
pnpm build:packages
```
Expected: pas d'erreur TypeScript.

- [ ] **Étape 3 — Commit**

```bash
git add packages/shared/src/constants/index.ts
git commit -m "feat: ajouter le type de relation 'drives' (Entraîne) aux constantes partagées"
```

---

## Task 3 — Utilitaire de parcours du graphe `drives`

**Files:**
- Create: `apps/api/src/utils/drivesGraph.ts`
- Create: `apps/api/src/utils/drivesGraph.test.ts`

- [ ] **Étape 1 — Écrire le test**

```typescript
// apps/api/src/utils/drivesGraph.test.ts
/* TNR du parcours BFS des relations 'drives' — sert à la fois la détection de cycle
 * (item-relations.ts) et la revalidation des dépendants confirmés (item-cascade-shift.ts). */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { getDrivesReachableIds } from './drivesGraph.js'

describe('getDrivesReachableIds', () => {
  it('retourne un ensemble vide si aucune relation drives sortante', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany.mockResolvedValueOnce([])

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set())
  })

  it('trouve un dependant direct', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }])
      .mockResolvedValueOnce([])

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B']))
  })

  it('parcourt une chaine transitive A->B->C', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'C' }]) // frontier [B]
      .mockResolvedValueOnce([])                   // frontier [C]

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B', 'C']))
  })

  it('ne boucle pas indefiniment si le graphe contient deja un cycle', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'A' }]) // frontier [B] — pointe deja vers A (deja visite/start, ignore)

    const result = await getDrivesReachableIds(prisma as any, 'A')
    expect(result).toEqual(new Set(['B']))
  })

  it('filtre par type drives via le where de la requete', async () => {
    const prisma = createMockPrisma()
    prisma.itemRelation.findMany.mockResolvedValueOnce([])

    await getDrivesReachableIds(prisma as any, 'A')
    expect(prisma.itemRelation.findMany).toHaveBeenCalledWith({
      where: { type: 'drives', fromItemId: { in: ['A'] } },
      select: { toItemId: true },
    })
  })
})
```

- [ ] **Étape 2 — Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @spok/api test drivesGraph -- --run`
Expected: FAIL — `Cannot find module './drivesGraph.js'`

- [ ] **Étape 3 — Implémenter**

```typescript
// apps/api/src/utils/drivesGraph.ts
/* Parcours en largeur des relations 'drives' ("Entraîne") — utilisé pour détecter un cycle à la
 * création d'un lien (item-relations.ts) et pour revalider les dépendants confirmés côté serveur
 * avant d'appliquer un décalage en cascade (item-cascade-shift.ts). */
import type { PrismaClient } from '@spok/database';

export async function getDrivesReachableIds(prisma: PrismaClient, startId: string): Promise<Set<string>> {
  const visited = new Set<string>();
  let frontier = [startId];

  while (frontier.length > 0) {
    const edges = await prisma.itemRelation.findMany({
      where: { type: 'drives', fromItemId: { in: frontier } },
      select: { toItemId: true },
    });

    const nextFrontier: string[] = [];
    for (const edge of edges) {
      if (!visited.has(edge.toItemId) && edge.toItemId !== startId) {
        visited.add(edge.toItemId);
        nextFrontier.push(edge.toItemId);
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}
```

- [ ] **Étape 4 — Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @spok/api test drivesGraph -- --run`
Expected: PASS (5 tests)

- [ ] **Étape 5 — Commit**

```bash
git add apps/api/src/utils/drivesGraph.ts apps/api/src/utils/drivesGraph.test.ts
git commit -m "feat: BFS des relations drives (détection de cycle + reachability)"
```

---

## Task 4 — Bloquer la création d'une relation `drives` qui créerait un cycle

**Files:**
- Create: `apps/api/src/routes/item-relations.test.ts`
- Modify: `apps/api/src/routes/item-relations.ts:1-67`

- [ ] **Étape 1 — Écrire les tests (fichier n'existe pas encore pour cette route)**

```typescript
// apps/api/src/routes/item-relations.test.ts
/* TNR de POST /spaces/:spaceId/items/:id/relations : création de relation + détection de cycle
 * pour le type 'drives' ("Entraîne", cascade de dates — cf. spec 2026-09-13). */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemRelationsRoutes } from './item-relations.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(async function (opt) {
    opt.addHook('preHandler', opt.authenticate)
    await opt.register(itemRelationsRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockItem(id: string, spaceId = 'space-1') {
  return { id, spaceId, title: `Item ${id}` }
}

describe('POST /spaces/:spaceId/items/:id/relations', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemRelation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rel-1', ...data }))
  })

  it('crée une relation blocks (régression de base)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'blocks' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('crée une relation drives sans relation existante (pas de cycle)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('A'))
      .mockResolvedValueOnce(mockItem('B'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis B : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'B', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('rejette une relation drives vers soi-même', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/A/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('rejette une relation drives qui créerait un cycle (A drives B drives C, tentative C drives A)', async () => {
    // Création : C (fromItemId=C, params.id='C') drives A (toItemId='A')
    // BFS depuis toItemId='A' : A->B->C — C est atteignable depuis A -> cycle
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'B' }]) // frontier [A]
      .mockResolvedValueOnce([{ toItemId: 'C' }]) // frontier [B]
      .mockResolvedValueOnce([])                   // frontier [C]

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/C/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'A', type: 'drives' },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.itemRelation.create).not.toHaveBeenCalled()
  })

  it('autorise une relation drives qui ne crée pas de cycle (D n\'a pas de sortant)', async () => {
    prisma.item.findFirst
      .mockResolvedValueOnce(mockItem('B'))
      .mockResolvedValueOnce(mockItem('D'))
    prisma.itemRelation.findMany.mockResolvedValueOnce([]) // BFS depuis D : rien

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/B/relations',
      headers: { authorization: `Bearer ${token}` },
      payload: { toItemId: 'D', type: 'drives' },
    })

    expect(res.statusCode).toBe(201)
  })
})
```

- [ ] **Étape 2 — Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @spok/api test item-relations -- --run`
Expected: FAIL sur les 3 tests `drives` (aucune vérification de cycle n'existe encore ; les tests `self` et `cycle` reçoivent 201 au lieu de 400, `prisma.itemRelation.findMany` jamais appelé)

- [ ] **Étape 3 — Implémenter la détection de cycle**

Dans `apps/api/src/routes/item-relations.ts`, ajouter l'import et le check juste après le parsing du body :

Remplacer :
```typescript
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeRelationForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
```
Par :
```typescript
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeRelationForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
import { getDrivesReachableIds } from '../utils/drivesGraph.js';
```

Remplacer :
```typescript
    const body = createRelationSchema.parse(request.body);

    // Verify both items exist (fromItem must be in the request space, toItem can be cross-space)
```
Par :
```typescript
    const body = createRelationSchema.parse(request.body);

    // Cascade "Entraîne" : une relation drives A→B doit rester acyclique, sinon décaler A
    // en cascade finirait par redécaler A lui-même via la boucle.
    if (body.type === 'drives') {
      if (body.toItemId === request.params.id) {
        return reply.badRequest("Un item ne peut pas s'entraîner lui-même");
      }
      const reachableFromTarget = await getDrivesReachableIds(fastify.prisma, body.toItemId);
      if (reachableFromTarget.has(request.params.id)) {
        return reply.badRequest('Ce lien créerait une boucle entre les items');
      }
    }

    // Verify both items exist (fromItem must be in the request space, toItem can be cross-space)
```

- [ ] **Étape 4 — Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm --filter @spok/api test item-relations -- --run`
Expected: PASS (5 tests)

- [ ] **Étape 5 — Commit**

```bash
git add apps/api/src/routes/item-relations.ts apps/api/src/routes/item-relations.test.ts
git commit -m "feat: détection de cycle à la création d'une relation drives"
```

---

## Task 5 — Endpoint backend de décalage en cascade

**Files:**
- Create: `apps/api/src/routes/item-cascade-shift.ts`
- Create: `apps/api/src/routes/item-cascade-shift.test.ts`

- [ ] **Étape 1 — Écrire les tests**

```typescript
// apps/api/src/routes/item-cascade-shift.test.ts
/* TNR de POST /spaces/:spaceId/items/:id/cascade-shift : décalage en cascade des dépendants
 * confirmés d'une ancre via la relation 'drives' — revalidation serveur de la reachability. */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemCascadeShiftRoutes } from './item-cascade-shift.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(async function (opt) {
    opt.addHook('preHandler', opt.authenticate)
    await opt.register(itemCascadeShiftRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockDependent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    spaceId: 'space-1',
    dueDate: new Date('2026-01-13T00:00:00.000Z'),
    startDate: null,
    endDate: null,
    ...overrides,
  }
}

describe('POST /spaces/:spaceId/items/:id/cascade-shift', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.item.findFirst.mockResolvedValue({ id: 'anchor-1', spaceId: 'space-1' })
    prisma.item.update.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, spaceId: 'space-1', ...data }))
  })

  it('décale les dépendants confirmés et atteignables via drives', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }]) // BFS frontier [anchor-1]
      .mockResolvedValueOnce([])                       // frontier [dep-1]
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1')])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().shiftedCount).toBe(1)
    const updateCall = prisma.item.update.mock.calls[0][0]
    expect(updateCall.where.id).toBe('dep-1')
    expect(updateCall.data.dueDate.toISOString()).toBe('2026-01-18T00:00:00.000Z')
  })

  it('rejette un dependentId non atteignable via drives depuis l\'ancre', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1', 'not-reachable'] },
    })

    expect(res.statusCode).toBe(400)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('404 si l\'item ancre n\'existe pas dans cet espace', async () => {
    prisma.item.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/missing/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(404)
  })

  it('403 pour un viewer', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'VIEWER' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(403)
  })

  it('403 si un dépendant est dans un espace où l\'utilisateur n\'a pas accès en écriture (relation cross-space)', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1', { spaceId: 'space-2' })])
    prisma.spaceMembership.findUnique.mockImplementation(({ where }: any) => {
      if (where.userId_spaceId.spaceId === 'space-2') return Promise.resolve(null)
      return Promise.resolve({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(res.statusCode).toBe(403)
    expect(prisma.item.update).not.toHaveBeenCalled()
  })

  it('crée un audit log par item décalé', async () => {
    prisma.itemRelation.findMany
      .mockResolvedValueOnce([{ toItemId: 'dep-1' }])
      .mockResolvedValueOnce([])
    prisma.item.findMany.mockResolvedValueOnce([mockDependent('dep-1')])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/anchor-1/cascade-shift',
      headers: { authorization: `Bearer ${token}` },
      payload: { deltaDays: 5, dependentIds: ['dep-1'] },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Étape 2 — Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @spok/api test item-cascade-shift -- --run`
Expected: FAIL — `Cannot find module './item-cascade-shift.js'`

- [ ] **Étape 3 — Implémenter la route**

```typescript
// apps/api/src/routes/item-cascade-shift.ts
/* Décalage en cascade des dates des dépendants d'un item ancre via une relation 'drives'
 * ("Entraîne"). Le client (ItemEditModal, TimelineView) calcule et affiche la liste des
 * dépendants affectés pour confirmation ; cette route revalide côté serveur que chaque id
 * confirmé est bien atteignable depuis l'ancre avant d'appliquer le décalage — ne fait jamais
 * confiance à la liste envoyée par le client seule (TOCTOU entre la prévisualisation et l'envoi). */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import { checkSpaceAccess } from './items.js';
import { shiftItemDates } from '../utils/dateShift.js';
import { getDrivesReachableIds } from '../utils/drivesGraph.js';

const cascadeShiftSchema = z.object({
  deltaDays: z.number().int(),
  dependentIds: z.array(z.string()).min(1),
});

export const itemCascadeShiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { spaceId: string; id: string };
    Body: z.infer<typeof cascadeShiftSchema>;
  }>('/:id/cascade-shift', async (request, reply) => {
    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
    if (!membership) {
      return reply.notFound('Space not found');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
      return reply.forbidden('Viewers cannot shift item dates');
    }

    const body = cascadeShiftSchema.parse(request.body);

    const anchor = await fastify.prisma.item.findFirst({
      where: { id: request.params.id, spaceId: request.params.spaceId },
    });
    if (!anchor) {
      return reply.notFound('Anchor item not found');
    }

    const reachable = await getDrivesReachableIds(fastify.prisma, anchor.id);
    const invalidIds = body.dependentIds.filter((id) => !reachable.has(id));
    if (invalidIds.length > 0) {
      return reply.badRequest(`Éléments non atteignables via une relation "drives" depuis l'ancre : ${invalidIds.join(', ')}`);
    }

    const dependents = await fastify.prisma.item.findMany({
      where: { id: { in: body.dependentIds } },
    });

    // Les relations drives peuvent être cross-space (même règle que la création de relation) —
    // vérifier l'accès en écriture à chaque espace distinct touché, pas seulement celui de l'ancre.
    const dependentSpaceIds = [...new Set(dependents.map((d) => d.spaceId).filter((id): id is string => !!id))];
    for (const depSpaceId of dependentSpaceIds) {
      if (depSpaceId === request.params.spaceId) continue;
      const depMembership = await checkSpaceAccess(fastify.prisma, request.user.userId, depSpaceId);
      if (!depMembership || (depMembership.role !== 'OWNER' && depMembership.role !== 'MEMBER')) {
        return reply.forbidden(`Accès insuffisant à l'espace d'un élément lié (${depSpaceId})`);
      }
    }

    let shiftedCount = 0;
    for (const dep of dependents) {
      const beforeState = serializeItemForAudit(dep);
      const shiftedDates = shiftItemDates(dep, 'day', body.deltaDays);
      const newItem = await fastify.prisma.item.update({
        where: { id: dep.id },
        data: shiftedDates,
      });
      shiftedCount += 1;

      await createAuditLog(fastify.prisma, {
        action: 'UPDATE',
        entity: 'Item',
        entityId: dep.id,
        userId: request.user.userId,
        spaceId: dep.spaceId,
        changes: {
          before: beforeState,
          after: serializeItemForAudit(newItem),
        },
      });
    }

    return { success: true, shiftedCount };
  });
};
```

- [ ] **Étape 4 — Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm --filter @spok/api test item-cascade-shift -- --run`
Expected: PASS (5 tests)

- [ ] **Étape 5 — Commit**

```bash
git add apps/api/src/routes/item-cascade-shift.ts apps/api/src/routes/item-cascade-shift.test.ts
git commit -m "feat: endpoint de décalage en cascade des dépendants drives"
```

---

## Task 6 — Enregistrer la route de décalage en cascade

**Files:**
- Modify: `apps/api/src/routes/items.ts:11-18,148-159`

- [ ] **Étape 1 — Importer et enregistrer**

Chercher l'import de `itemRelationsRoutes` (vers la ligne 13) et ajouter juste après :
```typescript
import { itemRelationsRoutes } from './item-relations.js';
import { itemCascadeShiftRoutes } from './item-cascade-shift.js';
```

Chercher le bloc d'enregistrement (vers la ligne 152) :
```typescript
    await authInstance.register(itemRelationsRoutes);
    await authInstance.register(itemMoveRoutes);
```
Remplacer par :
```typescript
    await authInstance.register(itemRelationsRoutes);
    await authInstance.register(itemCascadeShiftRoutes);
    await authInstance.register(itemMoveRoutes);
```

- [ ] **Étape 2 — Typecheck**

```bash
pnpm --filter @spok/api exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 3 — Lancer toute la suite API pour vérifier l'absence de régression**

```bash
pnpm --filter @spok/api test -- --run
```
Expected: tous les tests verts.

- [ ] **Étape 4 — Commit**

```bash
git add apps/api/src/routes/items.ts
git commit -m "feat: enregistrer la route cascade-shift dans itemsRoutes"
```

---

## Task 7 — Utilitaire client de calcul des dépendants en cascade

**Files:**
- Create: `apps/web/src/lib/cascadeShift.ts`
- Create: `apps/web/src/lib/cascadeShift.test.ts`

- [ ] **Étape 1 — Écrire les tests**

```typescript
// apps/web/src/lib/cascadeShift.test.ts
/* TNR de computeCascadeDependents : parcours transitif du graphe de relations 'drives'
 * ("Entraîne") pour construire l'aperçu de la modale de confirmation de cascade. */
import { describe, it, expect } from 'vitest'
import { computeCascadeDependents } from './cascadeShift'
import type { Item } from '@spok/shared'

function mockItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    title: `Item ${overrides.id}`, type: 'TASK', parentId: null, spaceId: 's1',
    dueDate: null, startDate: null, endDate: null, relationsFrom: [],
    ...overrides,
  } as Item
}

describe('computeCascadeDependents', () => {
  it('retourne vide si deltaDays est 0', () => {
    const items = [mockItem({ id: 'A' })]
    expect(computeCascadeDependents('A', 0, items)).toEqual([])
  })

  it('retourne vide si aucune relation drives sortante', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'blocks' }] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any }),
    ]
    expect(computeCascadeDependents('A', 5, items)).toEqual([])
  })

  it('trouve un dépendant direct et calcule avant/après', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' }] }),
      mockItem({ id: 'B', title: 'Préparer ODJ', dueDate: '2026-01-13T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('B')
    expect(result[0].title).toBe('Préparer ODJ')
  })

  it('parcourt une chaîne transitive A drives B drives C', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' }] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any, relationsFrom: [{ id: 'r2', fromItemId: 'B', toItemId: 'C', type: 'drives' }] }),
      mockItem({ id: 'C', dueDate: '2026-01-17T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.map(d => d.id).sort()).toEqual(['B', 'C'])
  })

  it('un diamant (A->B->D, A->C->D) ne liste D qu\'une seule fois', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [
        { id: 'r1', fromItemId: 'A', toItemId: 'B', type: 'drives' },
        { id: 'r2', fromItemId: 'A', toItemId: 'C', type: 'drives' },
      ] }),
      mockItem({ id: 'B', dueDate: '2026-01-13T00:00:00.000Z' as any, relationsFrom: [{ id: 'r3', fromItemId: 'B', toItemId: 'D', type: 'drives' }] }),
      mockItem({ id: 'C', dueDate: '2026-01-14T00:00:00.000Z' as any, relationsFrom: [{ id: 'r4', fromItemId: 'C', toItemId: 'D', type: 'drives' }] }),
      mockItem({ id: 'D', dueDate: '2026-01-15T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.filter(d => d.id === 'D')).toHaveLength(1)
  })

  it('un dépendant sans date est absent du résultat mais la chaîne continue au-delà', () => {
    const items = [
      mockItem({ id: 'A', relationsFrom: [{ id: 'r1', fromItemId: 'A', toItemId: 'X', type: 'drives' }] }),
      mockItem({ id: 'X', relationsFrom: [{ id: 'r2', fromItemId: 'X', toItemId: 'Y', type: 'drives' }] }), // pas de date
      mockItem({ id: 'Y', dueDate: '2026-01-20T00:00:00.000Z' as any }),
    ]
    const result = computeCascadeDependents('A', 5, items)
    expect(result.map(d => d.id)).toEqual(['Y'])
  })
})
```

- [ ] **Étape 2 — Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @spok/web test cascadeShift -- --run`
Expected: FAIL — `Cannot find module './cascadeShift'`

- [ ] **Étape 3 — Implémenter**

```typescript
// apps/web/src/lib/cascadeShift.ts
/* Calcule côté client la liste des items entraînés en cascade par le déplacement d'une ancre via
 * la relation 'drives' ("Entraîne") — parcours transitif du graphe, chaque item une seule fois
 * même en cas de diamant. Utilisé par ItemEditModal (sauvegarde) et TimelineView (drag du corps
 * de barre) pour construire l'aperçu de la modale de confirmation avant itemsApi.cascadeShift. */
import type { Item } from '@spok/shared';
import { addDays, formatDateShort } from './dateUtils';

export interface CascadeDependent {
  id: string;
  title: string;
  beforeLabel: string;
  afterLabel: string;
}

export function computeCascadeDependents(anchorId: string, deltaDays: number, allItems: Item[]): CascadeDependent[] {
  if (deltaDays === 0) return [];

  const byId = new Map(allItems.map((i) => [i.id, i]));
  const visited = new Set<string>([anchorId]);
  const result: CascadeDependent[] = [];
  const queue: string[] = [anchorId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = byId.get(currentId);
    if (!current) continue;

    for (const rel of current.relationsFrom || []) {
      if (rel.type !== 'drives' || visited.has(rel.toItemId)) continue;
      visited.add(rel.toItemId);

      const target = byId.get(rel.toItemId);
      if (!target) continue;

      const referenceDate = target.dueDate || target.startDate || target.endDate;
      if (referenceDate) {
        const before = new Date(referenceDate);
        const after = addDays(before, deltaDays);
        result.push({
          id: target.id,
          title: target.title,
          beforeLabel: formatDateShort(before),
          afterLabel: formatDateShort(after),
        });
      }

      queue.push(rel.toItemId);
    }
  }

  return result;
}
```

- [ ] **Étape 4 — Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter @spok/web test cascadeShift -- --run`
Expected: PASS (7 tests)

- [ ] **Étape 5 — Commit**

```bash
git add apps/web/src/lib/cascadeShift.ts apps/web/src/lib/cascadeShift.test.ts
git commit -m "feat: computeCascadeDependents — parcours transitif client des relations drives"
```

---

## Task 8 — Client API : méthode `cascadeShift`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (dans `itemsApi`, à côté de `updateRelation`)

- [ ] **Étape 1 — Ajouter la méthode**

Chercher `createRelation` dans `itemsApi` et ajouter juste après le bloc `updateRelation` :
```typescript
  cascadeShift: (spaceId: string, itemId: string, data: { deltaDays: number; dependentIds: string[] }) =>
    fetchApi<{ success: boolean; shiftedCount: number }>(`/spaces/${spaceId}/items/${itemId}/cascade-shift`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
```

- [ ] **Étape 2 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 3 — Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: itemsApi.cascadeShift"
```

---

## Task 9 — Modale de confirmation de cascade

**Files:**
- Create: `apps/web/src/components/CascadeShiftConfirmModal.tsx`

- [ ] **Étape 1 — Créer le composant**

```tsx
// apps/web/src/components/CascadeShiftConfirmModal.tsx
/* Modale de confirmation avant d'appliquer un décalage en cascade aux dépendants d'un item ancre
 * (relation 'drives' — "Entraîne"). Appelée depuis ItemEditModal (sauvegarde) et TimelineView
 * (drag du corps de barre) avec la liste déjà calculée par computeCascadeDependents. */
import type { CascadeDependent } from '../lib/cascadeShift';
import { Button } from './ui/Button';

interface CascadeShiftConfirmModalProps {
  anchorTitle: string;
  deltaDays: number;
  dependents: CascadeDependent[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CascadeShiftConfirmModal({ anchorTitle, deltaDays, dependents, onConfirm, onCancel }: CascadeShiftConfirmModalProps) {
  const sign = deltaDays > 0 ? '+' : '';
  const plural = dependents.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-card border rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Déplacer aussi les éléments liés ?</h3>
        <p className="text-sm text-muted-foreground mb-3">
          «{anchorTitle}» passe de {sign}{deltaDays} jour{Math.abs(deltaDays) > 1 ? 's' : ''}.
          {' '}{dependents.length} élément{plural ? 's' : ''} lié{plural ? 's' : ''} {plural ? 'seront' : 'sera'} décalé{plural ? 's' : ''} :
        </p>
        <ul className="text-sm mb-4 space-y-1 max-h-48 overflow-y-auto">
          {dependents.map((d) => (
            <li key={d.id} className="flex justify-between gap-2">
              <span className="truncate">{d.title}</span>
              <span className="text-muted-foreground whitespace-nowrap">{d.beforeLabel} → {d.afterLabel}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="bordered" size="sm" onClick={onCancel}>Non, seul</Button>
          <Button size="sm" onClick={onConfirm}>Oui, déplacer</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 3 — Commit**

```bash
git add apps/web/src/components/CascadeShiftConfirmModal.tsx
git commit -m "feat: CascadeShiftConfirmModal"
```

---

## Task 10 — `useSpaceActions` : `handleCascadeShift`

**Files:**
- Modify: `apps/web/src/pages/useSpaceActions.ts`

- [ ] **Étape 1 — Ajouter la mutation et le handler**

Chercher la définition de `deleteRelationMutation` (juste après `createRelationMutation`, vers la ligne 147) et ajouter une nouvelle mutation juste après ce bloc :
```typescript
  const cascadeShiftMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, deltaDays, dependentIds }: { itemId: string; itemSpaceId: string; deltaDays: number; dependentIds: string[] }) =>
      itemsApi.cascadeShift(itemSpaceId, itemId, { deltaDays, dependentIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });
```

Chercher `handleUpdateRelation` (vers la ligne 363-366) et ajouter juste après :
```typescript
  const handleCascadeShift = useCallback((itemId: string, deltaDays: number, dependentIds: string[]) => {
    const itemSpaceId = resolveItemSpaceId(itemId);
    cascadeShiftMutation.mutate({ itemId, itemSpaceId, deltaDays, dependentIds });
  }, [resolveItemSpaceId, cascadeShiftMutation]);
```

Chercher le retour du hook, bloc `// Relations` (vers la ligne 474-476), et ajouter `handleCascadeShift` :
```typescript
    // Relations
    handleCreateRelation,
    handleDeleteRelation,
    handleUpdateRelation,
    handleCascadeShift,
```

- [ ] **Étape 2 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 3 — Commit**

```bash
git add apps/web/src/pages/useSpaceActions.ts
git commit -m "feat: useSpaceActions.handleCascadeShift"
```

---

## Task 11 — `ItemEditModal` : ajouter `drives` aux 4 emplacements de relation

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx`

- [ ] **Étape 1 — Import de l'icône**

Chercher l'import `lucide-react` qui contient `Ban, ArrowRight, Link2` dans `ItemEditModal.tsx` et ajouter `FastForward` à la liste.

- [ ] **Étape 2 — Type de `newRelationType` (ligne 231)**

Remplacer :
```typescript
  const [newRelationType, setNewRelationType] = useState<'blocks' | 'relates' | 'implements'>('implements');
```
Par :
```typescript
  const [newRelationType, setNewRelationType] = useState<'blocks' | 'relates' | 'implements' | 'drives'>('implements');
```

- [ ] **Étape 3 — Dropdown de création (lignes ~1465-1470)**

Remplacer :
```tsx
                        <Select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value as 'blocks' | 'relates' | 'implements')}
                          options={[
                            { value: 'blocks',     label: 'Bloque...'  },
                            { value: 'implements', label: 'Permet...'  },
                            { value: 'relates',    label: 'Lié à...'   },
                          ]} />
```
Par :
```tsx
                        <Select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value as 'blocks' | 'relates' | 'implements' | 'drives')}
                          options={[
                            { value: 'blocks',     label: 'Bloque...'   },
                            { value: 'implements', label: 'Permet...'   },
                            { value: 'drives',     label: 'Entraîne...' },
                            { value: 'relates',    label: 'Lié à...'    },
                          ]} />
```

- [ ] **Étape 4 — Labels `relationsFrom` (lignes ~1499-1500)**

Remplacer :
```typescript
                      const typeLabel = relation.type === 'blocks' ? 'Bloque' : relation.type === 'implements' ? 'Permet' : 'Lié à';
                      const typeClass = relation.type === 'blocks' ? 'bg-red-100 text-red-700' : relation.type === 'implements' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';
```
Par :
```typescript
                      const typeLabel = relation.type === 'blocks' ? 'Bloque' : relation.type === 'implements' ? 'Permet' : relation.type === 'drives' ? 'Entraîne' : 'Lié à';
                      const typeClass = relation.type === 'blocks' ? 'bg-red-100 text-red-700' : relation.type === 'implements' ? 'bg-green-100 text-green-700' : relation.type === 'drives' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
```

- [ ] **Étape 5 — Labels `relationsTo` (lignes ~1514-1515)**

Remplacer :
```typescript
                      const typeLabel = relation.type === 'blocks' ? 'Bloqué par' : relation.type === 'implements' ? 'Permis par' : 'Lié à';
                      const typeClass = relation.type === 'blocks' ? 'bg-orange-100 text-orange-700' : relation.type === 'implements' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';
```
Par :
```typescript
                      const typeLabel = relation.type === 'blocks' ? 'Bloqué par' : relation.type === 'implements' ? 'Permis par' : relation.type === 'drives' ? 'Entraîné par' : 'Lié à';
                      const typeClass = relation.type === 'blocks' ? 'bg-orange-100 text-orange-700' : relation.type === 'implements' ? 'bg-green-100 text-green-700' : relation.type === 'drives' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
```

- [ ] **Étape 6 — Modale d'édition de relation (lignes ~1739-1741)**

Remplacer :
```tsx
              {([
                { id: 'blocks',     label: 'bloque',    Icon: Ban,        hex: '#ef4444', sel: 'bg-red-50 border-red-400',   hov: 'hover:bg-red-50 hover:border-red-300'   },
                { id: 'implements', label: 'permet',    Icon: ArrowRight, hex: '#22c55e', sel: 'bg-green-50 border-green-400', hov: 'hover:bg-green-50 hover:border-green-300' },
                { id: 'relates',    label: 'est lié à', Icon: Link2,      hex: '#3b82f6', sel: 'bg-blue-50 border-blue-400',  hov: 'hover:bg-blue-50 hover:border-blue-300'  },
              ] as const).map(type => (
```
Par :
```tsx
              {([
                { id: 'blocks',     label: 'bloque',    Icon: Ban,        hex: '#ef4444', sel: 'bg-red-50 border-red-400',   hov: 'hover:bg-red-50 hover:border-red-300'   },
                { id: 'implements', label: 'permet',    Icon: ArrowRight, hex: '#22c55e', sel: 'bg-green-50 border-green-400', hov: 'hover:bg-green-50 hover:border-green-300' },
                { id: 'drives',     label: 'entraîne',  Icon: FastForward, hex: '#a855f7', sel: 'bg-purple-50 border-purple-400', hov: 'hover:bg-purple-50 hover:border-purple-300' },
                { id: 'relates',    label: 'est lié à', Icon: Link2,      hex: '#3b82f6', sel: 'bg-blue-50 border-blue-400',  hov: 'hover:bg-blue-50 hover:border-blue-300'  },
              ] as const).map(type => (
```

- [ ] **Étape 7 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 8 — Commit**

```bash
git add apps/web/src/components/ItemEditModal.tsx
git commit -m "feat: ItemEditModal — ajouter le type de relation drives (Entraîne)"
```

---

## Task 12 — `ItemEditModal` : brancher la confirmation de cascade dans la sauvegarde

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx`

- [ ] **Étape 1 — Imports**

Ajouter en haut du fichier, à côté des autres imports de `lib/` :
```typescript
import { computeCascadeDependents, type CascadeDependent } from '../lib/cascadeShift';
import { CascadeShiftConfirmModal } from './CascadeShiftConfirmModal';
```

- [ ] **Étape 2 — État `pendingCascade` et mutation**

Chercher la déclaration de `editingRelationId`/`editRelationType` (ligne 234-235) et ajouter juste après :
```typescript
  const [pendingCascade, setPendingCascade] = useState<{
    updates: Parameters<typeof updateMutation.mutate>[0];
    deltaDays: number;
    dependents: CascadeDependent[];
  } | null>(null);
```

Note : `updateMutation` est défini plus bas dans le fichier (ligne 360) — TypeScript autorise cette référence de type car `Parameters<typeof updateMutation.mutate>` n'est évalué qu'au niveau des types, pas à l'exécution. Si le linter/tsc se plaint d'un usage avant déclaration, déplacer cette ligne d'état juste après la définition de `updateMutation` (après la ligne 374) plutôt qu'à la ligne 234 — dans ce cas, vérifier que `pendingCascade` reste déclaré avant `doSubmit` (ligne 633) qui l'utilise.

Chercher la définition de `updateMutation` (ligne 360-374) et ajouter juste après :
```typescript
  const cascadeShiftMutation = useMutation({
    mutationFn: (data: { deltaDays: number; dependentIds: string[] }) =>
      itemsApi.cascadeShift(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });
```

- [ ] **Étape 3 — Calcul du delta de référence dans `doSubmit`**

Chercher le bloc de gestion des 3 champs de date (lignes 685-704) :
```typescript
    // Handle dueDate changes
    const newDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    const currentDueDate = item.dueDate ? new Date(item.dueDate).toISOString() : null;
    if (newDueDate !== currentDueDate) {
      updates.dueDate = newDueDate;
    }

    // Handle startDate changes
    const newStartDate = startDate ? new Date(startDate).toISOString() : null;
    const currentStartDate = item.startDate ? new Date(item.startDate).toISOString() : null;
    if (newStartDate !== currentStartDate) {
      updates.startDate = newStartDate;
    }

    // Handle endDate changes
    const newEndDate = endDate ? new Date(endDate).toISOString() : null;
    const currentEndDate = item.endDate ? new Date(item.endDate).toISOString() : null;
    if (newEndDate !== currentEndDate) {
      updates.endDate = newEndDate;
    }
```
Ajouter juste après ce bloc (avant `// Handle tag changes`) :
```typescript
    // Cascade "Entraîne" : référence dueDate > startDate > endDate parmi les champs modifiés
    // (uniquement quand l'ancienne ET la nouvelle valeur existent — un champ qui apparaît/disparaît
    // n'est pas un déplacement dans le temps, pas de delta calculable).
    let cascadeDeltaDays = 0;
    if (updates.dueDate !== undefined && currentDueDate && newDueDate) {
      cascadeDeltaDays = Math.round((new Date(newDueDate).getTime() - new Date(currentDueDate).getTime()) / 86400000);
    } else if (updates.startDate !== undefined && currentStartDate && newStartDate) {
      cascadeDeltaDays = Math.round((new Date(newStartDate).getTime() - new Date(currentStartDate).getTime()) / 86400000);
    } else if (updates.endDate !== undefined && currentEndDate && newEndDate) {
      cascadeDeltaDays = Math.round((new Date(newEndDate).getTime() - new Date(currentEndDate).getTime()) / 86400000);
    }
    const cascadeDependents = cascadeDeltaDays !== 0 ? computeCascadeDependents(itemId!, cascadeDeltaDays, allItems) : [];
```

- [ ] **Étape 4 — Gater l'envoi sur la confirmation**

Remplacer :
```typescript
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    } else {
      onClose();
    }
  };
```
Par :
```typescript
    if (Object.keys(updates).length > 0) {
      if (cascadeDependents.length > 0) {
        setPendingCascade({ updates, deltaDays: cascadeDeltaDays, dependents: cascadeDependents });
      } else {
        updateMutation.mutate(updates);
      }
    } else {
      onClose();
    }
  };

  const confirmCascade = (applyCascade: boolean) => {
    if (!pendingCascade) return;
    updateMutation.mutate(pendingCascade.updates);
    if (applyCascade) {
      cascadeShiftMutation.mutate({ deltaDays: pendingCascade.deltaDays, dependentIds: pendingCascade.dependents.map((d) => d.id) });
    }
    setPendingCascade(null);
  };
```

- [ ] **Étape 5 — Rendre la modale**

Chercher le bloc `{editingRelationId && editingRelationMeta && createPortal(` (ligne 1729) et ajouter juste avant :
```tsx
      {pendingCascade && createPortal(
        <CascadeShiftConfirmModal
          anchorTitle={item?.title || ''}
          deltaDays={pendingCascade.deltaDays}
          dependents={pendingCascade.dependents}
          onConfirm={() => confirmCascade(true)}
          onCancel={() => confirmCascade(false)}
        />,
        document.body
      )}

```

- [ ] **Étape 6 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur. Si `pendingCascade` déclaré avant `updateMutation` pose un problème de type, appliquer la note de l'étape 2 (déplacer la déclaration après `updateMutation`).

- [ ] **Étape 7 — Vérification manuelle au dev**

Démarrer le dev (`pnpm dev:start` si pas déjà lancé), créer deux items dans un espace de test, ajouter une relation `drives` de A vers B (B ayant une date), puis modifier la date de A dans la modale d'édition et sauvegarder : vérifier que la modale de confirmation de cascade apparaît, que "Non, seul" ne déplace que A, et que "Oui, déplacer" déplace aussi B du même delta.

- [ ] **Étape 8 — Commit**

```bash
git add apps/web/src/components/ItemEditModal.tsx
git commit -m "feat: ItemEditModal — confirmation de cascade à la sauvegarde d'une date"
```

---

## Task 13 — `PertView` : ajouter `drives`

**Files:**
- Modify: `apps/web/src/components/views/PertView.tsx`

- [ ] **Étape 1 — Import de l'icône**

Remplacer :
```typescript
import { Ban, ArrowRight, Link2, ChevronDown, ChevronRight } from 'lucide-react';
```
Par :
```typescript
import { Ban, ArrowRight, Link2, FastForward, ChevronDown, ChevronRight } from 'lucide-react';
```

- [ ] **Étape 2 — `PERT_RELATION_TYPES` et `RELATION_HEX`**

Remplacer :
```typescript
const PERT_RELATION_TYPES = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        hexColor: '#ef4444', tailwindColor: 'text-red-500',   selectedClass: 'bg-red-50   border-red-400   dark:bg-red-950/30',   hoverClass: 'hover:bg-red-50   hover:border-red-300'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, hexColor: '#22c55e', tailwindColor: 'text-green-500', selectedClass: 'bg-green-50 border-green-400 dark:bg-green-950/30', hoverClass: 'hover:bg-green-50 hover:border-green-300' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      hexColor: '#3b82f6', tailwindColor: 'text-blue-500',  selectedClass: 'bg-blue-50  border-blue-400  dark:bg-blue-950/30',  hoverClass: 'hover:bg-blue-50  hover:border-blue-300'  },
] as const;

const RELATION_HEX: Record<string, string> = {
  blocks: '#ef4444',
  implements: '#22c55e',
  relates: '#3b82f6',
};
```
Par :
```typescript
const PERT_RELATION_TYPES = [
  { id: 'blocks',     label: 'Bloque',   Icon: Ban,         hexColor: '#ef4444', tailwindColor: 'text-red-500',    selectedClass: 'bg-red-50    border-red-400    dark:bg-red-950/30',    hoverClass: 'hover:bg-red-50    hover:border-red-300'    },
  { id: 'implements', label: 'Permet',   Icon: ArrowRight,  hexColor: '#22c55e', tailwindColor: 'text-green-500',  selectedClass: 'bg-green-50  border-green-400  dark:bg-green-950/30',  hoverClass: 'hover:bg-green-50  hover:border-green-300'  },
  { id: 'drives',     label: 'Entraîne', Icon: FastForward, hexColor: '#a855f7', tailwindColor: 'text-purple-500', selectedClass: 'bg-purple-50 border-purple-400 dark:bg-purple-950/30', hoverClass: 'hover:bg-purple-50 hover:border-purple-300' },
  { id: 'relates',    label: 'Lié à',    Icon: Link2,       hexColor: '#3b82f6', tailwindColor: 'text-blue-500',   selectedClass: 'bg-blue-50   border-blue-400   dark:bg-blue-950/30',   hoverClass: 'hover:bg-blue-50   hover:border-blue-300'   },
] as const;

const RELATION_HEX: Record<string, string> = {
  blocks: '#ef4444',
  implements: '#22c55e',
  drives: '#a855f7',
  relates: '#3b82f6',
};
```

- [ ] **Étape 3 — Marker SVG**

Remplacer :
```tsx
              <marker id="arrow-normal"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" /></marker>
              <marker id="arrow-blocks"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ef4444" /></marker>
              <marker id="arrow-implements" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22c55e" /></marker>
              <marker id="arrow-relates"    markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" /></marker>
```
Par :
```tsx
              <marker id="arrow-normal"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" /></marker>
              <marker id="arrow-blocks"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ef4444" /></marker>
              <marker id="arrow-implements" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22c55e" /></marker>
              <marker id="arrow-drives"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#a855f7" /></marker>
              <marker id="arrow-relates"    markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" /></marker>
```

Note : `getRelationColor`/`markerType` (lignes 702-704) utilisent déjà `RELATION_HEX` génériquement (`rel.type in RELATION_HEX`) — aucune autre modification nécessaire là, l'entrée `drives` ajoutée à l'étape 2 suffit à leur faire résoudre la bonne couleur et le bon marker.

- [ ] **Étape 4 — `RelationRow` (verbe affiché)**

Remplacer :
```typescript
    switch (typeId) {
      case 'blocks':     return [sourceName, 'bloque',    targetName, sourceStatus, targetStatus];
      case 'implements': return [sourceName, 'permet',    targetName, sourceStatus, targetStatus];
      case 'relates':    return [sourceName, 'est lié à', targetName, sourceStatus, targetStatus];
      default:           return [sourceName, '→',         targetName, sourceStatus, targetStatus];
    }
```
Par :
```typescript
    switch (typeId) {
      case 'blocks':     return [sourceName, 'bloque',    targetName, sourceStatus, targetStatus];
      case 'implements': return [sourceName, 'permet',    targetName, sourceStatus, targetStatus];
      case 'drives':     return [sourceName, 'entraîne',  targetName, sourceStatus, targetStatus];
      case 'relates':    return [sourceName, 'est lié à', targetName, sourceStatus, targetStatus];
      default:           return [sourceName, '→',         targetName, sourceStatus, targetStatus];
    }
```

- [ ] **Étape 5 — `nodeRelationStroke`**

Remplacer :
```typescript
                if (nodeRels.some(r => r.type === 'implements')) return RELATION_HEX.implements;
                if (nodeRels.some(r => r.type === 'relates'))    return null;
                return null;
```
Par :
```typescript
                if (nodeRels.some(r => r.type === 'implements')) return RELATION_HEX.implements;
                if (nodeRels.some(r => r.type === 'drives'))     return RELATION_HEX.drives;
                if (nodeRels.some(r => r.type === 'relates'))    return null;
                return null;
```

- [ ] **Étape 6 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 7 — Commit**

```bash
git add apps/web/src/components/views/PertView.tsx
git commit -m "feat: PertView — ajouter le type de relation drives (Entraîne)"
```

---

## Task 14 — `TimelineView`/`timeline-constants.ts` : ajouter `drives`

**Files:**
- Modify: `apps/web/src/components/views/timeline-constants.ts`
- Modify: `apps/web/src/components/views/TimelineView.tsx`

- [ ] **Étape 1 — `timeline-constants.ts`**

Remplacer :
```typescript
import { Link2, Ban, ArrowRight, type LucideIcon } from 'lucide-react';
```
Par :
```typescript
import { Link2, Ban, ArrowRight, FastForward, type LucideIcon } from 'lucide-react';
```

Remplacer :
```typescript
// Relation types (same as MindMapView)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        description: 'Contrainte dure — B ne peut démarrer avant la fin de A', color: 'text-red-500'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, description: 'A permet/rend possible B',                                color: 'text-green-500' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      description: 'A et B doivent être traités ensemble',                   color: 'text-blue-500'  },
];
```
Par :
```typescript
// Relation types (same as MindMapView)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',   Icon: Ban,         description: 'Contrainte dure — B ne peut démarrer avant la fin de A',        color: 'text-red-500'    },
  { id: 'implements', label: 'Permet',   Icon: ArrowRight,  description: 'A permet/rend possible B',                                       color: 'text-green-500'  },
  { id: 'drives',     label: 'Entraîne', Icon: FastForward, description: 'Déplacer A décale B du même nombre de jours',                    color: 'text-purple-500' },
  { id: 'relates',    label: 'Lié à',    Icon: Link2,       description: 'A et B doivent être traités ensemble',                            color: 'text-blue-500'   },
];
```

- [ ] **Étape 2 — `TimelineView.tsx` : marker + couleur de flèche**

Remplacer :
```tsx
                  <marker id="arrowhead-blocks"     markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" opacity="0.8" /></marker>
                  <marker id="arrowhead-implements" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#22c55e" opacity="0.8" /></marker>
                  <marker id="arrowhead-relates"    markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3b82f6" opacity="0.8" /></marker>
```
Par :
```tsx
                  <marker id="arrowhead-blocks"     markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" opacity="0.8" /></marker>
                  <marker id="arrowhead-implements" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#22c55e" opacity="0.8" /></marker>
                  <marker id="arrowhead-drives"     markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#a855f7" opacity="0.8" /></marker>
                  <marker id="arrowhead-relates"    markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3b82f6" opacity="0.8" /></marker>
```

Remplacer :
```typescript
                  const color = arrow.type === 'blocks' ? '#ef4444' : arrow.type === 'implements' ? '#22c55e' : '#3b82f6';
                  const markerId = `arrowhead-${arrow.type === 'blocks' ? 'blocks' : arrow.type === 'implements' ? 'implements' : 'relates'}`;
```
Par :
```typescript
                  const color = arrow.type === 'blocks' ? '#ef4444' : arrow.type === 'implements' ? '#22c55e' : arrow.type === 'drives' ? '#a855f7' : '#3b82f6';
                  const markerId = `arrowhead-${arrow.type === 'blocks' ? 'blocks' : arrow.type === 'implements' ? 'implements' : arrow.type === 'drives' ? 'drives' : 'relates'}`;
```

- [ ] **Étape 3 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 4 — Commit**

```bash
git add apps/web/src/components/views/timeline-constants.ts apps/web/src/components/views/TimelineView.tsx
git commit -m "feat: TimelineView — ajouter le type de relation drives (Entraîne)"
```

---

## Task 15 — `mindmap-utils.ts` : ajouter `drives`

**Files:**
- Modify: `apps/web/src/components/views/mindmap-utils.ts`

- [ ] **Étape 1 — Modifier**

Remplacer :
```typescript
import { Link2, Ban, ArrowRight, type LucideIcon } from 'lucide-react';
```
Par :
```typescript
import { Link2, Ban, ArrowRight, FastForward, type LucideIcon } from 'lucide-react';
```

Remplacer :
```typescript
// Relation type options with descriptions
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        description: 'Contrainte dure — B ne peut démarrer avant la fin de A', color: 'text-red-500'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, description: 'A permet/rend possible B',                                color: 'text-green-500' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      description: 'A et B doivent être traités ensemble',                   color: 'text-blue-500'  },
];
```
Par :
```typescript
// Relation type options with descriptions
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',   Icon: Ban,         description: 'Contrainte dure — B ne peut démarrer avant la fin de A',        color: 'text-red-500'    },
  { id: 'implements', label: 'Permet',   Icon: ArrowRight,  description: 'A permet/rend possible B',                                       color: 'text-green-500'  },
  { id: 'drives',     label: 'Entraîne', Icon: FastForward, description: 'Déplacer A décale B du même nombre de jours',                    color: 'text-purple-500' },
  { id: 'relates',    label: 'Lié à',    Icon: Link2,       description: 'A et B doivent être traités ensemble',                            color: 'text-blue-500'   },
];
```

- [ ] **Étape 2 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 3 — Commit**

```bash
git add apps/web/src/components/views/mindmap-utils.ts
git commit -m "feat: MindMapView — ajouter le type de relation drives (Entraîne)"
```

---

## Task 16 — `TimelineView` : nouvelle interaction de déplacement du corps de barre + cascade

C'est la tâche la plus délicate du plan — `TimelineView.tsx` porte déjà un avertissement en tête de fichier sur la fragilité de la logique de drag (`relationDrag`, offsets de coordonnées). On étend le même mécanisme de drag existant (`dragging`/`dragPreview`/`handleDragMove`/`handleDragEnd`) avec un 3e type `'move'`, plutôt que d'inventer un système parallèle.

**Files:**
- Modify: `apps/web/src/components/views/TimelineView.tsx`

- [ ] **Étape 1 — Imports**

Chercher les imports de `../../lib/api` et `./timeline-constants` en tête de fichier, ajouter :
```typescript
import { computeCascadeDependents, type CascadeDependent } from '../../lib/cascadeShift';
import { CascadeShiftConfirmModal } from '../CascadeShiftConfirmModal';
```

- [ ] **Étape 2 — Étendre le type `dragging` et ajouter l'état de cascade en attente**

Remplacer :
```typescript
  // Drag state for resizing
  const [dragging, setDragging] = useState<{
    itemId: string;
    type: 'start' | 'end';
    initialX: number;
    initialDate: Date;
    lastDeltaDays: number;
  } | null>(null);
```
Par :
```typescript
  // Drag state for resizing (start/end) et de déplacement du corps de barre (move)
  const [dragging, setDragging] = useState<{
    itemId: string;
    type: 'start' | 'end' | 'move';
    initialX: number;
    initialDate: Date;       // start/end : la date du champ concerné. move : startDate (ou dueDate/aujourd'hui à défaut) au début du drag
    initialEndDate?: Date;   // move uniquement : endDate au début du drag
    lastDeltaDays: number;
  } | null>(null);

  // Cascade "Entraîne" en attente de confirmation après un drag de déplacement (type 'move')
  const [pendingCascade, setPendingCascade] = useState<{
    itemId: string;
    startDate: string | null;
    endDate: string | null;
    deltaDays: number;
    dependents: CascadeDependent[];
  } | null>(null);
  const dragMovedRef = useRef(false);
```

- [ ] **Étape 3 — Gérer le nouveau type dans `handleDragMove`**

Chercher la fin de la branche `else` (type `'end'`, avant la fermeture `}, [dragging, dragPreview, dayWidth, items]);` de `handleDragMove`) :
```typescript
    } else {
      if (!hasExistingDates || newDate >= currentStart) {
        setDragPreview({
          itemId: dragging.itemId,
          startDate: dragPreview?.startDate ?? item.startDate ?? (hasExistingDates ? null : newDate.toISOString()),
          endDate: newDate.toISOString(),
        });
        setDragging(prev => prev ? { ...prev, lastDeltaDays: deltaDays } : null);
      }
    }
  }, [dragging, dragPreview, dayWidth, items]);
```
Par :
```typescript
    } else if (dragging.type === 'end') {
      if (!hasExistingDates || newDate >= currentStart) {
        setDragPreview({
          itemId: dragging.itemId,
          startDate: dragPreview?.startDate ?? item.startDate ?? (hasExistingDates ? null : newDate.toISOString()),
          endDate: newDate.toISOString(),
        });
        setDragging(prev => prev ? { ...prev, lastDeltaDays: deltaDays } : null);
      }
    } else {
      // type === 'move' : translation du corps de barre, start et end décalés du même delta
      const movedStart = addDays(dragging.initialDate, deltaDays);
      const movedEnd = addDays(dragging.initialEndDate ?? dragging.initialDate, deltaDays);
      setDragPreview({
        itemId: dragging.itemId,
        startDate: movedStart.toISOString(),
        endDate: movedEnd.toISOString(),
      });
      setDragging(prev => prev ? { ...prev, lastDeltaDays: deltaDays } : null);
    }
  }, [dragging, dragPreview, dayWidth, items]);
```

Note : la variable `newDate` du bloc `type: 'move'` provient du calcul de snap générique en début de fonction (`raw`/`snap`), commun aux 3 types — laisser ce calcul de snap inchangé, seule la branche finale change.

- [ ] **Étape 4 — Gérer la confirmation de cascade dans `handleDragEnd`**

Remplacer :
```typescript
  // Handle drag end — un seul appel API avec la position finale
  const handleDragEnd = useCallback(() => {
    const preview = dragPreview;
    setDragging(null);
    setDragPreview(null);
    if (preview && onUpdateDates) {
      onUpdateDates(preview.itemId, preview.startDate, preview.endDate);
      const itemId = preview.itemId;
      setSavedItemId(itemId);
      setTimeout(() => setSavedItemId(prev => prev === itemId ? null : prev), 1500);
    }
  }, [dragPreview, onUpdateDates]);
```
Par :
```typescript
  // Handle drag end — un seul appel API avec la position finale
  const handleDragEnd = useCallback(() => {
    const preview = dragPreview;
    const dragType = dragging?.type;
    const deltaDays = dragging?.lastDeltaDays ?? 0;
    setDragging(null);
    setDragPreview(null);
    if (!preview) return;

    if (dragType === 'move' && deltaDays !== 0 && onCascadeShift) {
      const dependents = computeCascadeDependents(preview.itemId, deltaDays, items);
      if (dependents.length > 0) {
        setPendingCascade({ itemId: preview.itemId, startDate: preview.startDate, endDate: preview.endDate, deltaDays, dependents });
        return; // attend la confirmation avant d'appeler onUpdateDates
      }
    }

    if (onUpdateDates) {
      onUpdateDates(preview.itemId, preview.startDate, preview.endDate);
      const itemId = preview.itemId;
      setSavedItemId(itemId);
      setTimeout(() => setSavedItemId(prev => prev === itemId ? null : prev), 1500);
    }
  }, [dragPreview, dragging, onUpdateDates, onCascadeShift, items]);

  const confirmTimelineCascade = useCallback((applyCascade: boolean) => {
    if (!pendingCascade) return;
    if (onUpdateDates) {
      onUpdateDates(pendingCascade.itemId, pendingCascade.startDate, pendingCascade.endDate);
      setSavedItemId(pendingCascade.itemId);
      setTimeout(() => setSavedItemId(prev => prev === pendingCascade.itemId ? null : prev), 1500);
    }
    if (applyCascade && onCascadeShift) {
      onCascadeShift(pendingCascade.itemId, pendingCascade.deltaDays, pendingCascade.dependents.map(d => d.id));
    }
    setPendingCascade(null);
  }, [pendingCascade, onUpdateDates, onCascadeShift]);
```

- [ ] **Étape 5 — Ajouter `onCascadeShift` aux props du composant**

Chercher l'interface de props (bloc `onUpdateDates?: ...` vers la ligne 55) et ajouter juste après :
```typescript
  onUpdateDates?: (id: string, startDate: string | null, endDate: string | null) => void;
  onCascadeShift?: (id: string, deltaDays: number, dependentIds: string[]) => void;
```

Chercher la déstructuration des props du composant (ligne 87, `onUpdateDates,`) et ajouter `onCascadeShift,` juste après.

Mettre à jour le commentaire d'en-tête du fichier (ligne 7, `Props clés : items, relations, onUpdateDates, onCreateRelation, onDeleteRelation, spaceId.`) :
```
 * Props clés : items, relations, onUpdateDates, onCascadeShift, onCreateRelation, onDeleteRelation, spaceId.
```

- [ ] **Étape 6 — Handler de mousedown sur le corps de barre (clic vs drag)**

Chercher la définition de `handleDragStart` (resize) et ajouter juste après :
```typescript
  // Mousedown sur le corps de la barre : clic simple = ouvrir la modale (comportement existant),
  // mouvement > 4px = démarre un drag de déplacement (type 'move'), distinct du resize des poignées.
  const handleBodyMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
    if (!canEdit || !onUpdateDates) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragMovedRef.current = false;

    const initialDate = item.startDate ? new Date(item.startDate) : (item.dueDate ? new Date(item.dueDate) : new Date());
    const initialEndDate = item.endDate ? new Date(item.endDate) : undefined;

    const onMove = (ev: MouseEvent) => {
      if (!dragMovedRef.current && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
        dragMovedRef.current = true;
        setDragging({ itemId, type: 'move', initialX: startX, initialDate, initialEndDate, lastDeltaDays: 0 });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [canEdit, onUpdateDates, items]);
```

- [ ] **Étape 7 — Brancher sur le corps de barre**

Chercher :
```tsx
                        {!derived && (
                          <div
                            className="h-full flex items-center cursor-pointer px-1 min-w-0"
                            onClick={() => onEdit(item.id)}
```
Par :
```tsx
                        {!derived && (
                          <div
                            className="h-full flex items-center cursor-pointer px-1 min-w-0"
                            onMouseDown={(e) => handleBodyMouseDown(e, item.id)}
                            onClick={() => {
                              if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                              onEdit(item.id);
                            }}
```

- [ ] **Étape 8 — Rendre la modale de confirmation**

Chercher le rendu du `editingRelation` (modale d'édition de relation existante dans ce fichier) et ajouter juste avant :
```tsx
      {pendingCascade && (() => {
        const anchorItem = items.find(i => i.id === pendingCascade.itemId);
        return (
          <CascadeShiftConfirmModal
            anchorTitle={anchorItem?.title || ''}
            deltaDays={pendingCascade.deltaDays}
            dependents={pendingCascade.dependents}
            onConfirm={() => confirmTimelineCascade(true)}
            onCancel={() => confirmTimelineCascade(false)}
          />
        );
      })()}
```

- [ ] **Étape 9 — Typecheck**

```bash
pnpm --filter @spok/web exec tsc --noEmit
```
Expected: 0 erreur.

- [ ] **Étape 10 — Vérification manuelle au dev**

Sur la vue Gantt d'un espace de test :
1. Vérifier qu'un simple clic sur le corps d'une barre ouvre toujours la modale d'édition (pas de régression).
2. Glisser le corps d'une barre (sans relation `drives`) : vérifier que début ET fin se décalent ensemble du même nombre de jours, sans modale de confirmation (aucun dépendant).
3. Créer une relation `drives` entre deux items datés, glisser le corps de la barre de l'ancre : vérifier que la modale de confirmation apparaît avec la liste correcte, et que "Oui, déplacer" décale bien le dépendant.
4. Vérifier que les poignées de resize (début/fin) fonctionnent toujours normalement (pas de cascade proposée sur un simple resize).

- [ ] **Étape 11 — Commit**

```bash
git add apps/web/src/components/views/TimelineView.tsx
git commit -m "feat: TimelineView — drag de déplacement du corps de barre + cascade drives"
```

---

## Task 17 — `SpacePage` : brancher `onCascadeShift`

**Files:**
- Modify: `apps/web/src/pages/SpacePage.tsx`

- [ ] **Étape 1 — Ajouter la prop à l'appel de `TimelineView`**

Chercher (dans le bloc `viewMode === 'timeline'`) :
```tsx
              onUpdateDates={(id, startDate, endDate) => actions.handleInlineUpdate(id, { startDate, endDate })}
              onCreateRelation={actions.handleCreateRelation}
```
Remplacer par :
```tsx
              onUpdateDates={(id, startDate, endDate) => actions.handleInlineUpdate(id, { startDate, endDate })}
              onCascadeShift={actions.handleCascadeShift}
              onCreateRelation={actions.handleCreateRelation}
```

- [ ] **Étape 2 — Typecheck complet**

```bash
pnpm typecheck
```
Expected: 0 erreur sur les 5 paquets.

- [ ] **Étape 3 — Suite de tests complète (mep)**

```bash
pnpm --filter @spok/api test -- --run
pnpm --filter @spok/web test -- --run
```
Expected: tous les tests verts.

- [ ] **Étape 4 — Commit**

```bash
git add apps/web/src/pages/SpacePage.tsx
git commit -m "feat: brancher onCascadeShift sur TimelineView"
```

---

## Écart assumé par rapport à la spec

La spec ([2026-09-13-cascade-date-relation-design.md](../specs/2026-09-13-cascade-date-relation-design.md)) mentionne une "transaction Prisma unique" pour l'endpoint `cascade-shift`. Task 5 utilise une boucle séquentielle sans `$transaction`, comme `item-bulk.ts` (bulk-duplicate) — pas un oubli : le mock `$transaction` du harnais de test (`test/helpers.ts:71-75`) invoque le callback avec une **nouvelle** instance `createMockPrisma()`, déconnectée de la variable `prisma` sur laquelle portent les assertions des tests. Aucune route testée de ce projet n'utilise donc `$transaction(async (tx) => ...)` avec des assertions sur les appels individuels. Le risque d'une écriture partielle (quelques items décalés puis une erreur) est mineur et du même ordre que `bulk-duplicate`, qui accepte déjà ce compromis.

## Hors périmètre (rappel du design)

- Pas de champ d'écart explicite à la création du lien.
- Pas de rétro-propagation (déplacer un dépendant ne bouge jamais son ancre).
- Le drag de déplacement du corps de barre utilise un snap simple (jour arrondi) à tous les niveaux de zoom, sans répliquer la logique fine "plus proche lundi/1er du mois" du resize — différence de granularité assumée, pas un bug.
- Si un filtre de recherche est actif sur le Gantt, l'aperçu de cascade se base sur les items actuellement chargés dans la vue (`items`) — un dépendant filtré hors vue par la recherche ne sera pas dans l'aperçu tant que le filtre est actif (edge case accepté, pas traité).
