---
name: spok-tnr
description: Lancer et maintenir les tests non régressifs SPOK (Vitest). Utiliser quand on veut exécuter les tests, ajouter de nouveaux tests, ou vérifier la non-régression avant un commit/deploy.
---

# spok-tnr — Tests Non Régressifs SPOK

## État actuel

Vitest **est installé** (vérifié 2026-07-11) : root et `@spok/api` en ^4.x, `@spok/web` en ^2.x, config `vitest.config.ts` à la racine. Si le runner venait à manquer :
```bash
cd C:/_dev/spok
pnpm add -D -w vitest @vitest/coverage-v8
pnpm --filter @spok/api add -D vitest
pnpm --filter @spok/web add -D vitest @vitest/coverage-v8
```

## Lancer les tests

```bash
cd C:/_dev/spok
pnpm exec vitest run                        # tous les tests (API + web)
pnpm exec vitest run --project api          # API seulement
pnpm exec vitest run --project web          # web seulement
pnpm exec vitest run apps/api/src/routes/items.test.ts  # un fichier
pnpm exec vitest --coverage                 # avec couverture
```

## Structure des tests

```
apps/api/src/
  test/
    helpers.ts          # buildItemsTestApp, getTestToken, MockPrisma
    setup.ts            # setup global
    smoke.test.ts       # smoke tests API
  routes/
    auth.test.ts        # 29 tests
    items.test.ts       # 35 tests
    spaces.test.ts      # 47 tests
    communities.test.ts # 38 tests
    tags.test.ts        # 13 tests
    referentiels.test.ts# 10 tests
    auditLogs.test.ts   # 11 tests
    graph.test.ts       # 17 tests
    search.test.ts      # 8 tests
    user-tasks.test.ts  # 14 tests
    admin/
      users.test.ts     # 24 tests
      spaces.test.ts    # 15 tests
      communities.test.ts # 14 tests
      auditLogs.test.ts # 12 tests
      referentiels.test.ts # 3 tests

apps/web/src/
  test/
    setup.ts
    smoke.test.ts       # smoke tests web
  lib/
    api.test.ts
    dateUtils.test.ts
    utils.test.ts
  hooks/
    useSort.test.ts
  stores/
    auth.test.ts
    community.test.ts
    dashboardTab.test.ts
    selection.test.ts
    space.test.ts
    theme.test.ts
    viewMode.test.ts
```

## Config (vitest.config.ts à la racine)

- **api** : environment `node`, root `./apps/api`
- **web** : environment `jsdom`, root `./apps/web`, alias `@/` → `./apps/web/src`

## Conventions

- Tests API : Fastify app mockée via `buildItemsTestApp` + `MockPrisma` — pas de vraie DB
- Tests web : stores Zustand, hooks, utils — pas de composants React complexes
- Mocks systématiques : `audit.js`, `r2.js`, JWT

## Quand lancer les TNR

- Avant chaque commit sur une route API ou un store web modifié
- Après une migration Prisma (smoke test au minimum)
- Avant un deploy en prod

## Ajouter un test

1. Créer `apps/api/src/routes/[route].test.ts` ou `apps/web/src/[...]/[module].test.ts`
2. Importer les helpers : `buildItemsTestApp`, `getTestToken`, `MockPrisma`
3. Suivre le pattern `describe / it / expect` existant
4. Lancer uniquement ce fichier pour valider avant d'intégrer
