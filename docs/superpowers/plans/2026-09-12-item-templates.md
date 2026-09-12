# Modèles de structures d'items (Item Templates) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à n'importe quel utilisateur de sauvegarder la structure (titre + type, récursif) d'un item existant comme modèle réutilisable, puis de l'insérer d'un coup — nouvel item racine + toute son arborescence de sous-items — dans n'importe quel espace existant.

**Architecture:** Nouvelle table Prisma globale `ItemTemplate` (pas de portée espace/communauté — partagée par tout le monde). Le serveur généralise la fonction récursive `createItems` qui existe déjà pour `SPACE_TEMPLATES` (créée à la création d'espace) en un helper partagé, réutilisé par une nouvelle route `POST /spaces/:spaceId/items/from-template` qui crée toute l'arborescence en une transaction. Côté web, deux nouvelles modales légères (`SaveAsTemplateModal`, `InsertTemplateModal`) branchées sur `ItemEditModal` (enregistrer / insérer comme enfant de l'item ouvert) et sur `SpaceToolbar` (insérer à la racine de l'espace).

**Tech Stack:** Fastify + Prisma (API), React + TanStack Query + Zustand (Web), Vitest (tests), types partagés dans `@spok/shared`.

**Hors périmètre (voir `docs/TODO.md`)** : décalages de dates relatifs, lien permanent entre items (déplacer toute une grappe), édition de la structure avant sauvegarde, portée par espace/communauté, page de gestion dédiée des modèles.

---

## Task 1: Schéma Prisma — modèle `ItemTemplate`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Ajouter le modèle et la relation User**

Dans `schema.prisma`, ajouter la relation sur `User` (à côté des autres relations, ex. après `dayPlanEntries`) :

```prisma
  dayPlanEntries              DayPlanEntry[]
  itemTemplates                ItemTemplate[]
```

Puis ajouter le modèle en fin de fichier :

```prisma
// Modèle de structure d'items (titre+type, récursif) — capturé depuis un item existant,
// réutilisable pour créer d'un coup un item + toute son arborescence de sous-items dans
// n'importe quel espace existant. Portée globale (pas de spaceId/communityId) : partagé
// par tous les utilisateurs, pour le moment (2026-09-12).
model ItemTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  // Arbre récursif { title: string, type: ItemType, children: [...] } — un seul nœud racine.
  structure   Json
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById])
  @@map("item_templates")
}
```

- [ ] **Step 2: Régénérer le client Prisma et pousser le schéma en dev**

Run: `pnpm db:generate && pnpm db:push`
Expected: `Your database is now in sync with your Prisma schema.` et génération du client sans erreur.

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(db): ajoute le modele ItemTemplate"
```

---

## Task 2: Helper de test — mock Prisma

**Files:**
- Modify: `apps/api/src/test/helpers.ts`

- [ ] **Step 1: Ajouter `itemTemplate` à `createMockPrisma`**

Dans `createMockPrisma()`, ajouter une ligne à côté de `dayPlanEntry: mockModel(),` :

```ts
    dayPlanEntry: mockModel(),
    itemTemplate: mockModel(),
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/test/helpers.ts
git commit -m "test: ajoute itemTemplate au mock Prisma"
```

---

## Task 3: Types partagés

**Files:**
- Create: `packages/shared/src/types/itemTemplate.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Écrire le type**

```ts
/* Types du modèle ItemTemplate : structure récursive titre+type capturée depuis un item existant. */
import type { ItemType } from './item.js';

export interface ItemTemplateNode {
  title: string;
  type: ItemType;
  children: ItemTemplateNode[];
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  structure: ItemTemplateNode;
  createdById: string;
  createdByName: string;
  createdAt: string;
}
```

- [ ] **Step 2: Exporter depuis l'index des types**

Dans `packages/shared/src/types/index.ts`, ajouter :

```ts
export * from './itemTemplate.js';
```

- [ ] **Step 3: Build du package partagé**

Run: `pnpm build:packages`
Expected: build réussi sans erreur TypeScript.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/itemTemplate.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): types ItemTemplate/ItemTemplateNode"
```

---

## Task 4: Helper serveur — création récursive d'arborescence (extraction + généralisation)

**Contexte :** `spaces.ts` a déjà une fonction récursive inline `createItems` (créée à la création d'espace, pour `SPACE_TEMPLATES`). On l'extrait dans un helper partagé, réutilisable par la nouvelle route `from-template`, plutôt que dupliquer la récursion.

**Files:**
- Create: `apps/api/src/utils/itemTree.ts`
- Create: `apps/api/src/utils/itemTree.test.ts`
- Modify: `apps/api/src/routes/spaces.ts:356-377`

- [ ] **Step 1: Écrire le test du helper (rouge)**

```ts
/* TNR de createItemTree : création récursive d'items depuis une structure { title, type, children }. */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { createItemTree } from './itemTree.js'

describe('createItemTree', () => {
  it('creates a flat list of root items with incrementing position', async () => {
    const prisma = createMockPrisma()
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    const created = await createItemTree(
      prisma as any,
      [
        { title: 'A', type: 'TASK', children: [] },
        { title: 'B', type: 'TASK', children: [] },
      ],
      { spaceId: 'space-1', createdById: 'user-1', parentId: null }
    )

    expect(created).toHaveLength(2)
    expect(prisma.item.create).toHaveBeenCalledTimes(2)
    expect(prisma.item.create).toHaveBeenNthCalledWith(1, {
      data: { title: 'A', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: null, position: 0 },
    })
    expect(prisma.item.create).toHaveBeenNthCalledWith(2, {
      data: { title: 'B', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: null, position: 1 },
    })
  })

  it('creates nested children under their parent id', async () => {
    const prisma = createMockPrisma()
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    await createItemTree(
      prisma as any,
      [
        { title: 'Réunion', type: 'MEETING', children: [
          { title: 'Rédiger l\'ODJ', type: 'TASK', children: [] },
        ] },
      ],
      { spaceId: 'space-1', createdById: 'user-1', parentId: null }
    )

    expect(prisma.item.create).toHaveBeenCalledTimes(2)
    // Le 2e appel (l'enfant) doit avoir parentId = l'id retourné par le 1er appel ("item-1")
    expect(prisma.item.create).toHaveBeenNthCalledWith(2, {
      data: { title: 'Rédiger l\'ODJ', type: 'TASK', spaceId: 'space-1', createdById: 'user-1', parentId: 'item-1', position: 0 },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project api itemTree` (depuis la racine `C:/_dev/spok`)
Expected: FAIL — `Cannot find module './itemTree.js'`

- [ ] **Step 3: Écrire le helper**

```ts
/*
 * Création récursive d'une arborescence d'items à partir d'une structure { title, type, children }.
 * Utilisé par la création d'espace depuis un SPACE_TEMPLATE (spaces.ts) et par
 * POST /spaces/:spaceId/items/from-template (item-templates). Ne pose ni statut, ni dates,
 * ni tags — structure pure (titre+type).
 */
import type { PrismaClient, Item } from '@spok/database';
import type { ItemType } from '@spok/shared';

export interface ItemTreeNode {
  title: string;
  type: ItemType;
  children?: ItemTreeNode[];
}

export async function createItemTree(
  prisma: PrismaClient,
  nodes: ItemTreeNode[],
  params: { spaceId: string; createdById: string; parentId: string | null }
): Promise<Item[]> {
  const created: Item[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const item = await prisma.item.create({
      data: {
        title: node.title,
        type: node.type,
        spaceId: params.spaceId,
        createdById: params.createdById,
        parentId: params.parentId,
        position: i,
      },
    });
    created.push(item);
    if (node.children && node.children.length > 0) {
      await createItemTree(prisma, node.children, { ...params, parentId: item.id });
    }
  }
  return created;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project api itemTree`
Expected: PASS (2 tests)

- [ ] **Step 5: Refactorer `spaces.ts` pour utiliser le helper (DRY)**

Dans `apps/api/src/routes/spaces.ts`, remplacer le bloc (lignes ~356-377) :

```ts
      // Create template items
      if (template.items && template.items.length > 0) {
        const createItems = async (items: SpaceTemplateItem[], parentId: string | null) => {
          for (let i = 0; i < items.length; i++) {
            const tplItem = items[i];
            const item = await fastify.prisma.item.create({
              data: {
                title: tplItem.title,
                type: tplItem.type,
                spaceId: space.id,
                createdById: request.user.userId,
                parentId,
                position: i,
              },
            });
            if (tplItem.children && tplItem.children.length > 0) {
              await createItems(tplItem.children, item.id);
            }
          }
        };
        await createItems(template.items, null);
      }
```

par :

```ts
      // Create template items
      if (template.items && template.items.length > 0) {
        await createItemTree(fastify.prisma, template.items, {
          spaceId: space.id,
          createdById: request.user.userId,
          parentId: null,
        });
      }
```

Ajouter l'import en haut du fichier (à côté des autres imports `./`) :

```ts
import { createItemTree } from '../utils/itemTree.js';
```

Le paramètre `SpaceTemplateItem` reste utilisé pour le typage de `template.items` (import déjà présent) — il est structurellement compatible avec `ItemTreeNode` (mêmes champs).

- [ ] **Step 6: Vérifier le typecheck api**

Run: `pnpm --filter @spok/api typecheck`
Expected: pas d'erreur

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/utils/itemTree.ts apps/api/src/utils/itemTree.test.ts apps/api/src/routes/spaces.ts
git commit -m "refactor(api): extrait createItemTree, reutilise dans spaces.ts"
```

---

## Task 5: Routes `item-templates`

**Files:**
- Create: `apps/api/src/routes/item-templates.ts`
- Create: `apps/api/src/routes/item-templates.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

```ts
/*
 * TNR de /item-templates : liste (tri par nom), creation, suppression (createur uniquement).
 * Portee globale — pas de filtre par espace/communaute.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemTemplatesRoutes } from './item-templates.js'

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
  await app.register(itemTemplatesRoutes, { prefix: '/item-templates' })

  await app.ready()
  return { app, prisma }
}

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    name: 'Réunion type',
    description: null,
    structure: { title: 'Réunion', type: 'MEETING', children: [] },
    createdById: USER_ID,
    createdAt: new Date(),
    createdBy: { name: 'Test User' },
    ...overrides,
  }
}

describe('Item templates routes', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  describe('GET /item-templates', () => {
    it('lists all templates sorted by name', async () => {
      prisma.itemTemplate.findMany.mockResolvedValue([mockTemplate()])

      const res = await app.inject({ method: 'GET', url: '/item-templates', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(1)
      expect(prisma.itemTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } })
      )
    })

    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/item-templates' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /item-templates', () => {
    it('creates a template from a name and a structure tree', async () => {
      prisma.itemTemplate.create.mockResolvedValue(mockTemplate())

      const res = await app.inject({
        method: 'POST', url: '/item-templates',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Réunion type', structure: { title: 'Réunion', type: 'MEETING', children: [] } },
      })

      expect(res.statusCode).toBe(201)
      expect(prisma.itemTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Réunion type',
          description: undefined,
          structure: { title: 'Réunion', type: 'MEETING', children: [] },
          createdById: USER_ID,
        },
        include: { createdBy: { select: { name: true } } },
      })
    })

    it('rejects an empty name', async () => {
      const res = await app.inject({
        method: 'POST', url: '/item-templates',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '', structure: { title: 'Réunion', type: 'MEETING', children: [] } },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /item-templates/:id', () => {
    it('deletes when the current user is the creator', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(mockTemplate())
      prisma.itemTemplate.delete.mockResolvedValue(mockTemplate())

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/tpl-1', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(200)
      expect(prisma.itemTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } })
    })

    it('forbids deleting a template created by someone else', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(mockTemplate({ createdById: 'someone-else' }))

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/tpl-1', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(403)
      expect(prisma.itemTemplate.delete).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown template', async () => {
      prisma.itemTemplate.findUnique.mockResolvedValue(null)

      const res = await app.inject({ method: 'DELETE', url: '/item-templates/unknown', headers: { authorization: `Bearer ${token}` } })

      expect(res.statusCode).toBe(404)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project api item-templates`
Expected: FAIL — `Cannot find module './item-templates.js'`

- [ ] **Step 3: Écrire la route**

```ts
/*
 * Routes /item-templates : modèles de structures d'items (titre+type, récursif), portée globale
 * — partagés par tous les utilisateurs. Utilisés par le picker d'insertion (POST /spaces/:id/
 * items/from-template) et le bouton "Enregistrer comme modèle" d'ItemEditModal.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// z.ZodTypeAny (plutôt qu'un ZodType<T> précis) : Zod ne parvient pas à inférer un type
// TypeScript propre pour un schéma auto-référencé via z.lazy — la validation runtime reste
// complète, seul le typage statique est relâché ici.
const nodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    children: z.array(nodeSchema),
  })
);

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  structure: nodeSchema,
});

export const itemTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // List all templates (global scope), sorted by name for the picker
  fastify.get('/', async (_request, reply) => {
    const templates = await fastify.prisma.itemTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { createdBy: { select: { name: true } } },
    });
    return reply.send(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        structure: t.structure,
        createdById: t.createdById,
        createdByName: t.createdBy.name,
        createdAt: t.createdAt,
      }))
    );
  });

  // Create a template
  fastify.post('/', async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const template = await fastify.prisma.itemTemplate.create({
      data: {
        name: body.name,
        description: body.description,
        structure: body.structure,
        createdById: request.user.userId,
      },
      include: { createdBy: { select: { name: true } } },
    });
    return reply.status(201).send({
      id: template.id,
      name: template.name,
      description: template.description,
      structure: template.structure,
      createdById: template.createdById,
      createdByName: template.createdBy.name,
      createdAt: template.createdAt,
    });
  });

  // Delete a template — creator only
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const template = await fastify.prisma.itemTemplate.findUnique({ where: { id: request.params.id } });
    if (!template) {
      return reply.notFound('Template not found');
    }
    if (template.createdById !== request.user.userId) {
      return reply.forbidden('Only the creator can delete this template');
    }
    await fastify.prisma.itemTemplate.delete({ where: { id: request.params.id } });
    return reply.send({ success: true });
  });
};
```

- [ ] **Step 4: Enregistrer la route dans `index.ts`**

Ajouter l'import (à côté des autres imports de routes) :

```ts
import { itemTemplatesRoutes } from './routes/item-templates.js';
```

Ajouter l'enregistrement (à côté de `notificationsRoutes`) :

```ts
  await app.register(itemTemplatesRoutes, { prefix: '/item-templates' });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project api item-templates`
Expected: PASS (7 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @spok/api typecheck`
Expected: pas d'erreur

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/item-templates.ts apps/api/src/routes/item-templates.test.ts apps/api/src/index.ts
git commit -m "feat(api): routes /item-templates (list/create/delete)"
```

---

## Task 6: Route `POST /spaces/:spaceId/items/from-template`

**Files:**
- Modify: `apps/api/src/routes/items.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Ajouter dans un nouveau fichier `apps/api/src/routes/items-from-template.test.ts` :

```ts
/*
 * TNR de POST /spaces/:spaceId/items/from-template : cree toute l'arborescence d'un modele
 * en une fois, controle d'acces identique a la creation d'item classique.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { createMockPrisma, getTestToken, MockPrisma } from '../test/helpers.js'
import { jwtPlugin } from '../plugins/jwt.js'
import { itemsRoutes } from './items.js'

const USER_ID = 'test-user-id'

async function buildApp() {
  const app = Fastify({ logger: false })
  const prisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({ statusCode: error.statusCode, error: error.name || 'Error', message: error.message })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', prisma as any)
  await app.register(jwtPlugin)
  await app.register(async function (opt) {
    opt.addHook('preHandler', opt.optionalAuthenticate)
    await opt.register(itemsRoutes, { prefix: '/spaces/:spaceId/items' })
  })

  await app.ready()
  return { app, prisma }
}

describe('POST /spaces/:spaceId/items/from-template', () => {
  let app: FastifyInstance
  let prisma: MockPrisma
  let token: string

  beforeEach(async () => {
    const result = await buildApp()
    app = result.app
    prisma = result.prisma
    token = getTestToken(app, { userId: USER_ID, email: 'test@test.com' })
  })

  it('creates the root item and its children from the template structure', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      structure: { title: 'Réunion', type: 'MEETING', children: [{ title: 'Rédiger l\'ODJ', type: 'TASK', children: [] }] },
    })
    let counter = 0
    prisma.item.create.mockImplementation(({ data }: any) => {
      counter += 1
      return Promise.resolve({ id: `item-${counter}`, ...data })
    })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe('item-1')
    expect(res.json().title).toBe('Réunion')
    expect(prisma.item.create).toHaveBeenCalledTimes(2)
  })

  it('inserts under parentId when provided', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      structure: { title: 'Réunion', type: 'MEETING', children: [] },
    })
    prisma.item.create.mockResolvedValue({ id: 'item-1', title: 'Réunion', type: 'MEETING', parentId: 'parent-1' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1', parentId: 'parent-1' },
    })

    expect(res.statusCode).toBe(201)
    expect(prisma.item.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: 'parent-1' }) })
    )
  })

  it('returns 404 for an unknown template', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'MEMBER' })
    prisma.itemTemplate.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'unknown' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('forbids viewers from creating items from a template', async () => {
    prisma.spaceMembership.findUnique.mockResolvedValue({ userId: USER_ID, spaceId: 'space-1', role: 'VIEWER' })

    const res = await app.inject({
      method: 'POST', url: '/spaces/space-1/items/from-template',
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: 'tpl-1' },
    })

    expect(res.statusCode).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project api items-from-template`
Expected: FAIL — 404/500, la route n'existe pas encore

- [ ] **Step 3: Ajouter la route dans `items.ts`**

Ajouter l'import en haut du fichier :

```ts
import { createItemTree } from '../utils/itemTree.js';
```

Ajouter la route juste après la route `POST /` existante (celle qui finit par `return reply.status(201).send({ ...item, tags: ... });` autour de la ligne 329) :

```ts
  // Create an item + its full sub-tree from a saved template
  fastify.post<{ Params: { spaceId: string }; Body: { templateId: string; parentId?: string } }>(
    '/from-template',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }
      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot create items');
      }

      const { templateId, parentId } = request.body;
      const template = await fastify.prisma.itemTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return reply.notFound('Template not found');
      }

      const structure = template.structure as unknown as { title: string; type: string; children: any[] };
      const [rootItem] = await createItemTree(fastify.prisma, [structure as any], {
        spaceId: request.params.spaceId,
        createdById: request.user.userId,
        parentId: parentId ?? null,
      });

      await createAuditLog(fastify.prisma, {
        action: 'CREATE',
        entity: 'Item',
        entityId: rootItem.id,
        userId: request.user.userId,
        spaceId: request.params.spaceId,
        changes: { after: { ...serializeItemForAudit(rootItem), fromTemplateId: templateId } },
      });

      return reply.status(201).send(rootItem);
    }
  );
```

**Note** : le routeur de Fastify (`find-my-way`) priorise toujours un segment statique (`/from-template`) sur un segment paramétrique (`/:id`), quel que soit l'ordre de déclaration dans le fichier — pas de risque de collision avec `GET /:id`/`PATCH /:id`. L'ordre d'insertion dans ce plan (juste après `POST /`) est une question de lisibilité, pas de fonctionnement.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project api items-from-template`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck + suite complète api**

Run: `pnpm --filter @spok/api typecheck && npx vitest run --project api`
Expected: pas d'erreur, tous les tests verts (y compris ceux déjà existants de `items.ts`)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/items.ts apps/api/src/routes/items-from-template.test.ts
git commit -m "feat(api): POST /spaces/:spaceId/items/from-template"
```

---

## Task 7: Client API web

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Ajouter `itemTemplatesApi`**

Ajouter l'import de type en haut du fichier (à côté des autres imports `@spok/shared`) :

```ts
import type { ItemTemplate, ItemTemplateNode } from '@spok/shared';
```

Ajouter, après le bloc `itemsApi` (ou à un autre endroit cohérent avec les autres `xxxApi`) :

```ts
export const itemTemplatesApi = {
  list: () => fetchApi<ItemTemplate[]>('/item-templates'),

  create: (data: { name: string; description?: string; structure: ItemTemplateNode }) =>
    fetchApi<ItemTemplate>('/item-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/item-templates/${id}`, { method: 'DELETE' }),

  createFromTemplate: (spaceId: string, data: { templateId: string; parentId?: string }) =>
    fetchApi<Item>(`/spaces/${spaceId}/items/from-template`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

(`Item` est déjà importé plus haut dans le fichier pour `itemsApi` — ne pas le réimporter.)

- [ ] **Step 2: Typecheck web**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): client itemTemplatesApi"
```

---

## Task 8: Helpers de construction de structure (web)

**Files:**
- Modify: `apps/web/src/components/item-edit-helpers.ts`
- Create: `apps/web/src/components/item-edit-helpers.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

```ts
/* TNR des helpers item-edit-helpers : construction/comptage de structure de modèle. */
import { describe, it, expect } from 'vitest'
import { buildItemTemplateStructure, countTemplateNodes } from './item-edit-helpers'
import type { Item } from '@spok/shared'

function mockItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    title: 'Item', type: 'NOTE', parentId: null, spaceId: 's1',
    ...overrides,
  } as Item
}

describe('buildItemTemplateStructure', () => {
  it('builds a single node with no children', () => {
    const items = [mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null })]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure).toEqual({ title: 'Réunion', type: 'MEETING', children: [] })
  })

  it('builds nested children recursively, in position order', () => {
    const items = [
      mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null, position: 0 }),
      mockItem({ id: '2', title: 'Rédiger le CR', type: 'TASK', parentId: '1', position: 1 }),
      mockItem({ id: '3', title: 'Réserver la salle', type: 'TASK', parentId: '1', position: 0 }),
    ]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure.children.map((c) => c.title)).toEqual(['Réserver la salle', 'Rédiger le CR'])
  })

  it('ignores items outside the captured subtree', () => {
    const items = [
      mockItem({ id: '1', title: 'Réunion', type: 'MEETING', parentId: null }),
      mockItem({ id: '2', title: 'Autre chose', type: 'NOTE', parentId: null }),
    ]
    const structure = buildItemTemplateStructure('1', items)
    expect(structure.children).toHaveLength(0)
  })
})

describe('countTemplateNodes', () => {
  it('counts the root plus all descendants', () => {
    const node = {
      title: 'Réunion', type: 'MEETING' as const, children: [
        { title: 'A', type: 'TASK' as const, children: [] },
        { title: 'B', type: 'TASK' as const, children: [{ title: 'C', type: 'TASK' as const, children: [] }] },
      ],
    }
    expect(countTemplateNodes(node)).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project web item-edit-helpers`
Expected: FAIL — `buildItemTemplateStructure`/`countTemplateNodes` non exportés

- [ ] **Step 3: Écrire les helpers**

Modifier l'import en tête de fichier (fusionner, ne pas dupliquer la ligne d'import) :

```ts
import type { Item, ItemTemplateNode } from '@spok/shared';
```

Puis ajouter en fin de fichier :

```ts
/** Capture récursivement un item et ses descendants en structure de modèle (titre+type). */
export function buildItemTemplateStructure(id: string, allItems: Item[]): ItemTemplateNode {
  const item = allItems.find((i) => i.id === id);
  const children = allItems
    .filter((i) => i.parentId === id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((child) => buildItemTemplateStructure(child.id, allItems));
  return { title: item?.title ?? '', type: (item?.type ?? 'NOTE') as ItemTemplateNode['type'], children };
}

/** Compte le nombre total de nœuds (racine incluse) d'une structure de modèle. */
export function countTemplateNodes(node: ItemTemplateNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTemplateNodes(child), 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project web item-edit-helpers`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/item-edit-helpers.ts apps/web/src/components/item-edit-helpers.test.ts
git commit -m "feat(web): helpers buildItemTemplateStructure/countTemplateNodes"
```

---

## Task 9: `SaveAsTemplateModal`

**Files:**
- Create: `apps/web/src/components/SaveAsTemplateModal.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
/*
 * Modale "Enregistrer comme modèle" : capture un item existant + ses descendants (titre+type,
 * récursif) et les sauvegarde comme ItemTemplate réutilisable (portée globale — visible par
 * tous les utilisateurs). Ouverte depuis la barre d'actions d'ItemEditModal.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, LayoutTemplate } from 'lucide-react';
import { itemTemplatesApi } from '../lib/api';
import { buildItemTemplateStructure, countTemplateNodes } from './item-edit-helpers';
import type { Item } from '@spok/shared';
import { Button } from './ui/Button';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  allItems: Item[];
}

export function SaveAsTemplateModal({ isOpen, onClose, itemId, allItems }: SaveAsTemplateModalProps) {
  const queryClient = useQueryClient();
  const item = allItems.find((i) => i.id === itemId);
  const [name, setName] = useState(item?.title || '');
  const [description, setDescription] = useState('');

  const structure = isOpen ? buildItemTemplateStructure(itemId, allItems) : null;
  const nodeCount = structure ? countTemplateNodes(structure) : 0;

  const saveMutation = useMutation({
    mutationFn: () => itemTemplatesApi.create({ name: name.trim(), description: description.trim() || undefined, structure: structure! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate className="w-4 h-4" />
            Enregistrer comme modèle
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-2 text-xs text-muted-foreground">
          {nodeCount} élément{nodeCount > 1 ? 's' : ''} seront capturés (titre + type uniquement).
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom du modèle</label>
            <input
              className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description (optionnel)</label>
            <textarea
              className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="bordered" size="sm" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/SaveAsTemplateModal.tsx
git commit -m "feat(web): modale SaveAsTemplateModal"
```

---

## Task 10: Brancher "Enregistrer comme modèle" dans `ItemEditModal`

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx`

- [ ] **Step 1: Import + state**

Ajouter l'import (à côté des autres imports de modales, ex. `MoveToSpaceModal`/`DuplicateToSpaceModal`) :

```ts
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
```

Ajouter un state à côté de `showMoveModal`/`showDuplicateModal` (ligne ~222) :

```ts
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
```

- [ ] **Step 2: Bouton dans la barre d'actions contextuelles**

Dans le bloc `{item && canEdit && itemId && (<div className="flex items-center gap-1 sm:ml-auto">`, ajouter un bouton avant celui de « Dupliquer vers un espace » (ligne ~1668) :

```tsx
                <Button type="button" variant="ghost" size="sm" title="Enregistrer comme modèle"
                  onClick={() => setShowSaveAsTemplateModal(true)}>
                  <LayoutTemplate className="w-4 h-4" />
                </Button>
```

Ajouter `LayoutTemplate` à l'import lucide-react existant (grosse ligne d'import en tête de fichier).

- [ ] **Step 3: Rendre la modale**

À côté du rendu de `MoveToSpaceModal`/`DuplicateToSpaceModal` en fin de fichier (avant la fermeture du composant) :

```tsx
      {itemId && (
        <SaveAsTemplateModal
          isOpen={showSaveAsTemplateModal}
          onClose={() => setShowSaveAsTemplateModal(false)}
          itemId={itemId}
          allItems={allItems}
        />
      )}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ItemEditModal.tsx
git commit -m "feat(web): bouton Enregistrer comme modele dans ItemEditModal"
```

---

## Task 11: `InsertTemplateModal`

**Files:**
- Create: `apps/web/src/components/InsertTemplateModal.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
/*
 * Modale "Insérer un modèle" : liste les ItemTemplate disponibles (portée globale, recherche),
 * optionnellement un sélecteur de parent, et crée l'arborescence complète en un appel.
 * Ouverte depuis SpaceToolbar (racine de l'espace) et ItemEditModal (comme enfant de l'item ouvert).
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, LayoutTemplate, Search, Trash2 } from 'lucide-react';
import { itemTemplatesApi } from '../lib/api';
import { countTemplateNodes } from './item-edit-helpers';
import { useAuthStore } from '../stores/auth';
import type { Item } from '@spok/shared';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface InsertTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  allItems: Item[];
  /** Item sous lequel insérer (child) ; absent = insertion à la racine de l'espace. */
  defaultParentId?: string | null;
  onCreated: (rootItemId: string) => void;
}

export function InsertTemplateModal({ isOpen, onClose, spaceId, allItems, defaultParentId, onCreated }: InsertTemplateModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [parentId, setParentId] = useState(defaultParentId || '');

  const { data: templates } = useQuery({
    queryKey: ['item-templates'],
    queryFn: () => itemTemplatesApi.list(),
    enabled: isOpen,
  });

  const filtered = useMemo(() => {
    const list = templates || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [templates, search]);

  const parentOptions = useMemo(() => [
    { value: '', label: 'Aucun parent (racine)' },
    ...[...allItems].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })).map((i) => ({ value: i.id, label: i.title })),
  ], [allItems]);

  const createMutation = useMutation({
    mutationFn: (templateId: string) => itemTemplatesApi.createFromTemplate(spaceId, { templateId, parentId: parentId || undefined }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      onCreated(created.id);
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemTemplatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-templates'] }),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate className="w-4 h-4" />
            Insérer un modèle
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Rechercher un modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Parent</label>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-sm text-center text-muted-foreground">Aucun modèle. Crée-en un depuis un item existant ("Enregistrer comme modèle").</p>
          )}
          {filtered.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors group">
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(tpl.id)}
              >
                <div className="text-sm font-medium truncate">{tpl.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {countTemplateNodes(tpl.structure)} élément{countTemplateNodes(tpl.structure) > 1 ? 's' : ''}
                  {tpl.description ? ` — ${tpl.description}` : ''}
                </div>
              </button>
              {tpl.createdById === user?.id && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  title="Supprimer ce modèle"
                  onClick={() => deleteMutation.mutate(tpl.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border flex-shrink-0">
          <Button type="button" variant="bordered" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/InsertTemplateModal.tsx
git commit -m "feat(web): modale InsertTemplateModal"
```

---

## Task 12: Brancher "Insérer un modèle" — `ItemEditModal` + `SpaceToolbar`/`SpacePage`

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx`
- Modify: `apps/web/src/pages/SpaceToolbar.tsx`
- Modify: `apps/web/src/pages/SpacePage.tsx`

- [ ] **Step 1: `ItemEditModal` — bouton "Ajouter une structure" (insérer comme enfant de l'item ouvert)**

Import (à côté de `SaveAsTemplateModal`) :

```ts
import { InsertTemplateModal } from './InsertTemplateModal';
```

State (à côté de `showSaveAsTemplateModal`) :

```ts
  const [showInsertTemplateModal, setShowInsertTemplateModal] = useState(false);
```

Bouton, juste après celui de la Task 10 :

```tsx
                <Button type="button" variant="ghost" size="sm" title="Ajouter une structure"
                  onClick={() => setShowInsertTemplateModal(true)}>
                  <FolderPlus className="w-4 h-4" />
                </Button>
```

(`FolderPlus` est déjà importé dans ce fichier — utilisé pour "Convertir en espace".)

Rendu, à côté de `SaveAsTemplateModal` :

```tsx
      {itemId && (
        <InsertTemplateModal
          isOpen={showInsertTemplateModal}
          onClose={() => setShowInsertTemplateModal(false)}
          spaceId={spaceId}
          allItems={allItems}
          defaultParentId={itemId}
          onCreated={(rootId) => onNavigate?.(rootId)}
        />
      )}
```

- [ ] **Step 2: `SpaceToolbar` — nouveau prop + bouton**

Dans `SpaceToolbarProps` (ligne ~142), ajouter :

```ts
  onInsertTemplate?: () => void;
```

Dans la signature du composant (destructuring, ligne ~172), ajouter `onInsertTemplate,` juste après `canEdit,`.

Dans le JSX, juste avant le bloc `{canEdit && (<Link to={...history}>` (ligne ~631) :

```tsx
          {canEdit && onInsertTemplate && (
            <Button variant="ghost" size="sm" title="Insérer un modèle" onClick={onInsertTemplate}>
              <LayoutTemplate className="w-4 h-4" />
            </Button>
          )}
```

Ajouter `LayoutTemplate` à l'import lucide-react en tête de fichier.

- [ ] **Step 3: `SpacePage` — état, handler, wiring aux ~20 instances de `<SpaceToolbar>`**

Ajouter, à côté de `handleNewItem` (ligne ~501) :

```ts
  const [showInsertTemplateModal, setShowInsertTemplateModal] = useState(false);

  const handleInsertTemplateCreated = useCallback((rootItemId: string) => {
    setEditingItemId(rootItemId);
  }, []);

  const handleInsertTemplate = useCallback(() => {
    setShowInsertTemplateModal(true);
  }, []);
```

(Vérifier que `useState`/`useCallback` sont déjà importés en tête de fichier — c'est le cas, `SpacePage.tsx` les utilise déjà abondamment.)

Brancher le prop sur les 20 instances de `<SpaceToolbar>` via deux remplacements globaux (les deux variantes littérales déjà présentes dans le fichier) :

```ts
onNewItem={handleNewItem}
```
→
```ts
onNewItem={handleNewItem}
          onInsertTemplate={handleInsertTemplate}
```

et

```ts
onNewItem={canEdit ? handleNewItem : undefined}
```
→
```ts
onNewItem={canEdit ? handleNewItem : undefined}
          onInsertTemplate={canEdit ? handleInsertTemplate : undefined}
```

Utiliser l'outil d'édition en mode "remplacer toutes les occurrences" pour ces deux chaînes exactes (respectivement 1 et 19 occurrences dans le fichier — 20 au total, une par vue).

Rendre la modale une seule fois, à un endroit central du JSX de `SpacePage` (par exemple à côté du rendu de `MoveToSpaceModal`/`DuplicateToSpaceModal` si `SpacePage` en a, sinon juste avant la fermeture du composant racine) :

```tsx
      <InsertTemplateModal
        isOpen={showInsertTemplateModal}
        onClose={() => setShowInsertTemplateModal(false)}
        spaceId={spaceId!}
        allItems={allItems}
        onCreated={handleInsertTemplateCreated}
      />
```

Ajouter l'import :

```ts
import { InsertTemplateModal } from '../components/InsertTemplateModal';
```

`SpacePage.tsx` a déjà un `const allItems = useMemo(() => allItemsData?.data || itemsData?.data || [], [...])` (ligne ~307) — l'utiliser directement pour le prop `allItems` de `InsertTemplateModal`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ItemEditModal.tsx apps/web/src/pages/SpaceToolbar.tsx apps/web/src/pages/SpacePage.tsx
git commit -m "feat(web): insertion de modele depuis ItemEditModal et SpaceToolbar"
```

---

## Task 13: Vérification manuelle (dev)

**Contexte** : per `testing-protocol`, ne pas tester soi-même en premier — demander à Thomas de valider visuellement une fois les tâches 1-12 vertes. Lister ici le script de test pour qu'il puisse le suivre.

- [ ] **Step 1: Rebuild + dev**

Run: `pnpm build:packages && pnpm dev:start` (si pas déjà lancé)

- [ ] **Step 2: Script de test manuel (à faire suivre à Thomas)**

1. Ouvrir un item existant qui a des sous-items (ou en créer un : "Réunion" + 2-3 enfants).
2. Cliquer l'icône "Enregistrer comme modèle" dans la barre d'actions → nommer, valider.
3. Aller dans un **autre espace** (ou le même) → bouton toolbar "Insérer un modèle" → rechercher le modèle créé → cliquer dessus.
4. Vérifier : l'item racine + tous ses enfants (mêmes titres/types) sont créés, l'item racine s'ouvre dans la modale.
5. Depuis un item existant, tester "Ajouter une structure" (icône dans la modale) → vérifier que le nouvel item racine est bien créé **comme enfant** de l'item ouvert.
6. Vérifier la suppression : dans le picker, supprimer un modèle qu'on a créé (icône poubelle au survol) → il disparaît de la liste ; vérifier qu'un modèle créé par un autre utilisateur n'a pas d'icône poubelle.

- [ ] **Step 3: Suite complète avant commit final (per CLAUDE.md — vérifications lourdes réservées au mep)**

Run: `pnpm typecheck && npx vitest run`
Expected: 5 packages OK, tous les tests verts

---

## Self-Review Notes

- **Spec coverage** : capture (Task 8-9-10), insertion racine (Task 11-12 SpaceToolbar), insertion comme enfant (Task 11-12 ItemEditModal), suppression créateur-only (Task 5), portée globale (schéma Task 1, pas de spaceId/communityId), extraction DRY de `createItems`/`createItemTree` (Task 4). Hors périmètre (dates, lien permanent, édition avant sauvegarde) : non implémenté, déjà noté dans `docs/TODO.md`.
- **Types** : `ItemTreeNode` (serveur, `type: ItemType`) et `ItemTemplateNode` (partagé) ont la même forme structurelle mais des noms différents — c'est voulu (le serveur n'a pas besoin d'importer `@spok/shared` juste pour ce type interne), à ne pas confondre lors de l'implémentation.
- **Point vérifié** : Task 6, pas de risque de collision de route entre `/from-template` et `/:id` — `find-my-way` priorise les segments statiques indépendamment de l'ordre de déclaration.
