# Duplication répétée avec décalage de dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre la duplication d'item existante (`DuplicateToSpaceModal` / `POST /spaces/:id/items/bulk-duplicate`) pour créer N copies en une fois, chacune décalée cumulativement d'une unité de temps choisie (jour/semaine/mois/an), en conservant le choix d'espace cible et d'inclusion des enfants déjà existants.

**Architecture:** Le payload de `bulk-duplicate` gagne `iterations` (défaut 1, comportement inchangé) et `offsetUnit` (jour/semaine/mois/an, optionnel). Le corps de la route — aujourd'hui un unique passage séquentiel (créer items → lier parents → dupliquer relations → auditer) — est enveloppé dans une boucle de N passages, chacun avec un delta cumulatif appliqué à `dueDate`/`startDate`/`endDate` de chaque item dupliqué (racine + enfants si inclus, même delta pour tous → l'écart relatif parent/enfant est conservé). Corrige au passage un oubli existant : `startDate`/`endDate` n'étaient pas recopiés du tout par la duplication (seul `dueDate` l'était).

**Tech Stack:** Fastify + Prisma + Zod (API), React + TanStack Query (Web), Vitest.

**Hors périmètre :** lien permanent entre items dupliqués (cf. TODO "Groupes d'items liés par la date" du 2026-09-12) — ici chaque copie est indépendante une fois créée.

---

## Task 1: Backend — `bulk-duplicate` : itérations + décalage + fix startDate/endDate

**Contexte :** Aucun test n'existe aujourd'hui pour `item-bulk.ts` (fichier non testé). On en crée un complet : régression du comportement actuel + nouveau comportement.

**Files:**
- Modify: `apps/api/src/routes/item-bulk.ts`
- Create: `apps/api/src/routes/item-bulk.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

```ts
/*
 * TNR de POST /spaces/:spaceId/items/bulk-duplicate : duplication simple (regression),
 * iterations + decalage de dates cumulatif, copie startDate/endDate (fix), enfants inclus.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemBulkRoutes } from './item-bulk.js'

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
    await opt.register(itemBulkRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

function mockSourceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    type: 'MEETING',
    title: 'Réunion hebdo',
    description: null,
    content: null,
    url: null,
    status: 'todo',
    priority: 2,
    position: 0,
    dueDate: new Date('2026-01-15T00:00:00.000Z'),
    startDate: new Date('2026-01-15T09:00:00.000Z'),
    endDate: new Date('2026-01-15T10:00:00.000Z'),
    parentId: null,
    tags: [],
    ...overrides,
  }
}

describe('POST /spaces/:spaceId/items/bulk-duplicate', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })

    // Membership OK sur l'espace source et cible (meme espace par defaut dans ces tests)
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.tag.findMany.mockResolvedValue([])
    prisma.itemRelation.findMany.mockResolvedValue([])
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `new-item-${counter}`, ...data })
    })
    prisma.item.update.mockResolvedValue({})
  })

  it('duplicates once by default (iterations omis) — comportement inchangé', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()]) // items demandés
      .mockResolvedValueOnce([mockSourceItem()]) // allItems (meme set, pas d'enfants)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().duplicatedCount).toBe(1)
    expect(prisma.item.create).toHaveBeenCalledTimes(1)
  })

  it('copie startDate et endDate (fix — auparavant seul dueDate etait copie)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()])
      .mockResolvedValueOnce([mockSourceItem()])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false },
    })

    const createCall = prisma.item.create.mock.calls[0][0]
    expect(createCall.data.startDate).toEqual(new Date('2026-01-15T09:00:00.000Z'))
    expect(createCall.data.endDate).toEqual(new Date('2026-01-15T10:00:00.000Z'))
  })

  it('avec iterations=3 et offsetUnit=week, cree 3 items avec des dates decalees cumulativement (copie 1 = +0, copie 2 = +1 semaine, copie 3 = +2 semaines)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem()])
      .mockResolvedValueOnce([mockSourceItem()])

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 3, offsetUnit: 'week' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().duplicatedCount).toBe(3)
    expect(prisma.item.create).toHaveBeenCalledTimes(3)

    const dueDates = prisma.item.create.mock.calls.map((c: any) => c[0].data.dueDate.toISOString())
    expect(dueDates).toEqual([
      '2026-01-15T00:00:00.000Z', // copie 1 : +0
      '2026-01-22T00:00:00.000Z', // copie 2 : +1 semaine
      '2026-01-29T00:00:00.000Z', // copie 3 : +2 semaines
    ])
  })

  it('decalage "month" est calendaire (pas une approximation 30 jours)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem({ dueDate: new Date('2026-01-31T00:00:00.000Z'), startDate: null, endDate: null })])
      .mockResolvedValueOnce([mockSourceItem({ dueDate: new Date('2026-01-31T00:00:00.000Z'), startDate: null, endDate: null })])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 2, offsetUnit: 'month' },
    })

    const dueDates = prisma.item.create.mock.calls.map((c: any) => c[0].data.dueDate.toISOString())
    // 31 jan +1 mois calendaire -> 28 fev (2026 n'est pas bissextile), pas "31 jan + 30 jours" (2 mars)
    expect(dueDates[1]).toBe('2026-02-28T00:00:00.000Z')
  })

  it('un item sans date reste sans date apres decalage (pas de date inventee)', async () => {
    prisma.item.findMany
      .mockResolvedValueOnce([mockSourceItem({ dueDate: null, startDate: null, endDate: null })])
      .mockResolvedValueOnce([mockSourceItem({ dueDate: null, startDate: null, endDate: null })])

    await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', includeChildren: false, iterations: 2, offsetUnit: 'week' },
    })

    const secondCall = prisma.item.create.mock.calls[1][0]
    expect(secondCall.data.dueDate).toBeNull()
    expect(secondCall.data.startDate).toBeNull()
    expect(secondCall.data.endDate).toBeNull()
  })

  it('rejette iterations > 365', async () => {
    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/bulk-duplicate',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemIds: ['item-1'], targetSpaceId: 'space-1', iterations: 400 },
    })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project api item-bulk` (depuis `C:/_dev/spok`)
Expected: FAIL — `iterations`/`offsetUnit` non supportés, `startDate`/`endDate` non copiés, tous les tests rouges ou partiellement faux

- [ ] **Step 3: Étendre le schéma et écrire la fonction de décalage calendaire**

Dans `apps/api/src/routes/item-bulk.ts`, remplacer :

```ts
const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
});
```

par :

```ts
const bulkDuplicateSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  targetSpaceId: z.string(),
  includeChildren: z.boolean().default(true),
  iterations: z.number().int().min(1).max(365).default(1),
  offsetUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
});

// Décalage calendaire (pas une approximation en jours fixes) : +1 mois sur le 31 janvier
// donne le dernier jour de février (clampé), jamais un débordement type "31 jan + 30 jours"
// qui roulerait sur début mars (comportement par défaut de Date#setMonth — testé et corrigé
// pendant l'implémentation : setMonth seul donnait "2026-03-03" au lieu de "2026-02-28").
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

- [ ] **Step 4: Envelopper le corps existant dans une boucle d'itérations**

Toujours dans `item-bulk.ts`, la structure actuelle (après validation des accès et récupération de `allItems`/mapping de tags, qui ne changent PAS d'une itération à l'autre) est :

```ts
    // Create a mapping from old IDs to new IDs
    const oldIdToNewId = new Map<string, string>();

    // First pass: create all items without parent relationships
    const createdItems: any[] = [];
    for (const item of allItems) {
      const newItem = await fastify.prisma.item.create({
        data: {
          type: item.type,
          title: item.title,
          description: item.description,
          content: item.content as any,
          url: item.url,
          status: item.status,
          priority: item.priority,
          position: item.position,
          dueDate: item.dueDate,
          spaceId: targetSpaceId,
          createdById: request.user.userId,
          parentId: null, // Will be set in second pass
        },
      });
      ...
    }

    // Second pass: update parent relationships
    ...

    // Duplicate relations between duplicated items
    ...

    // Audit log for duplication
    ...

    return {
      success: true,
      duplicatedCount: createdItems.length,
      targetSpaceId,
    };
```

Remplacer par (boucle sur `iterations`, `oldIdToNewId`/`createdItems` deviennent locaux à chaque itération, `allCreatedItems` accumule pour le compte final) :

```ts
    const allCreatedItems: any[] = [];

    for (let iteration = 1; iteration <= iterations; iteration++) {
      const shiftAmount = iteration - 1; // copie 1 = +0, copie 2 = +1 unité, copie 3 = +2 unités...

      // Mapping from old IDs to new IDs — local à cette itération
      const oldIdToNewId = new Map<string, string>();
      const createdItems: any[] = [];

      // First pass: create all items without parent relationships
      for (const item of allItems) {
        const shiftedDates = shiftItemDates(item, offsetUnit, shiftAmount);
        const newItem = await fastify.prisma.item.create({
          data: {
            type: item.type,
            title: item.title,
            description: item.description,
            content: item.content as any,
            url: item.url,
            status: item.status,
            priority: item.priority,
            position: item.position,
            dueDate: shiftedDates.dueDate,
            startDate: shiftedDates.startDate,
            endDate: shiftedDates.endDate,
            spaceId: targetSpaceId,
            createdById: request.user.userId,
            parentId: null, // Will be set in second pass
          },
        });

        oldIdToNewId.set(item.id, newItem.id);
        createdItems.push({ oldItem: item, newItem });

        // Create tag associations
        if (item.tags.length > 0) {
          const newTagMappings = item.tags
            .map((t: any) => sourceTagIdToTargetId.get(t.tagId))
            .filter((id: string | undefined): id is string => id !== undefined);

          if (newTagMappings.length > 0) {
            await fastify.prisma.itemTag.createMany({
              data: newTagMappings.map((tagId: string) => ({
                itemId: newItem.id,
                tagId: tagId,
              })),
            });
          }
        }
      }

      // Second pass: update parent relationships
      for (const { oldItem, newItem } of createdItems) {
        if (oldItem.parentId) {
          const newParentId = oldIdToNewId.get(oldItem.parentId)
            || (targetSpaceId === request.params.spaceId ? oldItem.parentId : null);
          if (newParentId) {
            await fastify.prisma.item.update({
              where: { id: newItem.id },
              data: { parentId: newParentId },
            });
          }
        }
      }

      // Duplicate relations between duplicated items (this iteration only)
      const relations = await fastify.prisma.itemRelation.findMany({
        where: {
          fromItemId: { in: allItemIds },
          toItemId: { in: allItemIds },
        },
      });

      for (const relation of relations) {
        const newFromId = oldIdToNewId.get(relation.fromItemId);
        const newToId = oldIdToNewId.get(relation.toItemId);
        if (newFromId && newToId) {
          await fastify.prisma.itemRelation.create({
            data: {
              fromItemId: newFromId,
              toItemId: newToId,
              type: relation.type,
            },
          });
        }
      }

      // Audit log for duplication
      for (const { oldItem, newItem } of createdItems) {
        await createAuditLog(fastify.prisma, {
          action: 'CREATE',
          entity: 'Item',
          entityId: newItem.id,
          userId: request.user.userId,
          spaceId: targetSpaceId,
          changes: {
            after: serializeItemForAudit(newItem),
            duplicatedFrom: oldItem.id,
          } as any,
        });
      }

      allCreatedItems.push(...createdItems);
    }

    return {
      success: true,
      duplicatedCount: allCreatedItems.length,
      targetSpaceId,
    };
```

Le bloc juste avant (accès, `items`, `allItemIds`, `allItems`, mapping de tags `sourceTagIdToTargetId`) reste **inchangé et hors de la boucle** — il ne dépend pas de l'itération.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project api item-bulk`
Expected: PASS (7 tests)

- [ ] **Step 6: Typecheck + suite complète api**

Run: `pnpm --filter @spok/api typecheck && npx vitest run --project api`
Expected: pas d'erreur, tous les tests verts (y compris les autres suites déjà existantes)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/item-bulk.ts apps/api/src/routes/item-bulk.test.ts
git commit -m "feat(api): bulk-duplicate - iterations + decalage de dates calendaire, fix copie startDate/endDate"
```

---

## Task 2: Client API web

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Étendre la signature de `bulkDuplicate`**

```ts
  bulkDuplicate: (
    spaceId: string,
    data: { itemIds: string[]; targetSpaceId: string; includeChildren?: boolean; iterations?: number; offsetUnit?: 'day' | 'week' | 'month' | 'year' }
  ) =>
    fetchApi<{ success: boolean; duplicatedCount: number; targetSpaceId: string }>(
      `/spaces/${spaceId}/items/bulk-duplicate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): itemsApi.bulkDuplicate - iterations/offsetUnit"
```

---

## Task 3: UI — `DuplicateToSpaceModal`

**Files:**
- Modify: `apps/web/src/components/DuplicateToSpaceModal.tsx`

- [ ] **Step 1: État + mutation**

Ajouter les imports/état (à côté de `includeChildren`) :

```ts
  const [iterations, setIterations] = useState(1);
  const [offsetUnit, setOffsetUnit] = useState<'day' | 'week' | 'month' | 'year'>('week');
```

Mettre à jour la mutation :

```ts
  const bulkDuplicateMutation = useMutation({
    mutationFn: () =>
      itemsApi.bulkDuplicate(currentSpaceId, {
        itemIds: effectiveIds,
        targetSpaceId: selectedSpaceId,
        includeChildren,
        iterations,
        offsetUnit: iterations > 1 ? offsetUnit : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', currentSpaceId] });
      if (selectedSpaceId !== currentSpaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', selectedSpaceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['space', currentSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', selectedSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs', selectedSpaceId] });
      onClose();
    },
  });
```

- [ ] **Step 2: UI — nombre d'itérations + chips de décalage**

Juste après le bloc `<label>` « Inclure les éléments enfants » (avant la fermeture du `<>`), ajouter :

```tsx
            <div className="space-y-2 mb-6">
              <label className="flex items-center gap-2 text-sm">
                <span>Nombre d'itérations</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              {iterations > 1 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Décalage entre chaque copie (dates conservées, décalées cumulativement)</p>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'day', label: '1 jour' },
                      { value: 'week', label: '1 semaine' },
                      { value: 'month', label: '1 mois' },
                      { value: 'year', label: '1 an' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOffsetUnit(opt.value)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          offsetUnit === opt.value ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
```

- [ ] **Step 3: Adapter le libellé du bouton et le compte-rendu**

```tsx
          <Button
            onClick={() => bulkDuplicateMutation.mutate()}
            disabled={!selectedSpaceId || bulkDuplicateMutation.isPending}
          >
            {bulkDuplicateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Duplication...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {iterations > 1 ? `Dupliquer ×${iterations}` : 'Dupliquer'}
              </>
            )}
          </Button>
```

- [ ] **Step 4: Réinitialiser à la fermeture** (évite de garder N=12 pour la prochaine ouverture sur un autre item)

Dans `onClose` du bouton d'annulation et de la croix, rien à changer côté parent — plus simple : réinitialiser localement quand `isOpen` repasse à `false`. Ajouter :

```ts
  useEffect(() => {
    if (!isOpen) {
      setIterations(1);
      setOffsetUnit('week');
    }
  }, [isOpen]);
```

(Ajouter `useEffect` à l'import React en tête de fichier : `import { useState, useMemo, useEffect } from 'react';`)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/DuplicateToSpaceModal.tsx
git commit -m "feat(web): DuplicateToSpaceModal - iterations + decalage de dates"
```

---

## Task 4: Vérification manuelle (dev)

**Contexte** : per `testing-protocol`, ne pas tester soi-même en premier — demander à Thomas de valider. Script fourni pour qu'il puisse suivre.

- [ ] **Step 1: Script de test manuel (à faire suivre à Thomas)**

1. Ouvrir un item ayant une date (dueDate ou startDate/endDate, ex. une Réunion) avec 1-2 enfants.
2. Cliquer « Dupliquer vers un espace » → régler Itérations à 4, décalage "1 semaine", garder l'espace actuel, "Inclure les enfants" coché.
3. Valider → vérifier dans la liste : 4 nouvelles copies (+ leurs enfants), dates espacées d'une semaine chacune par rapport à l'original (copie 1 = même date, copie 2 = +1 sem., copie 3 = +2 sem., copie 4 = +3 sem.).
4. Ouvrir un enfant d'une des copies décalées → vérifier que sa propre date (si elle en a une) est décalée du même delta que le parent (écart parent/enfant conservé).
5. Refaire un test simple avec Itérations = 1 (défaut) → vérifier que le comportement est identique à avant (une seule copie, pas de décalage).
6. Vérifier qu'un item Réunion (avec startDate/endDate, pas seulement dueDate) dupliqué conserve maintenant ses heures de début/fin (fix du bug de copie).

- [ ] **Step 2: Suite complète avant commit final (per CLAUDE.md — vérifications lourdes réservées au mep)**

Run: `pnpm typecheck && npx vitest run`
Expected: 5 packages OK, tous les tests verts

---

## Self-Review Notes

- **Spec coverage** : itérations (Task 1+3), décalage jour/semaine/mois/an calendaire (Task 1), inclusion enfants avec décalage cohérent — automatique car même delta appliqué à tous les items du batch (racine + descendants), pas de logique séparée nécessaire. Fix startDate/endDate (Task 1, tests dédiés).
- **Ambiguïté résolue** : indexation des copies confirmée avec Thomas — copie 1 = décalage 0 (clone exact), copie 2 = +1 unité, etc. (`shiftAmount = iteration - 1`).
- **Risque identifié** : la boucle fait des appels Prisma séquentiels (pas de transaction globale) — cohérent avec le reste de la route (déjà le cas avant ce chantier), pas de régression introduite. Un échec à mi-itération laisse les itérations précédentes déjà créées (comportement pré-existant du endpoint, inchangé).
