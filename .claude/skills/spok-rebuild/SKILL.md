---
name: spok-rebuild
description: Rebuilder l'environnement SPOK après un changement de schéma Prisma, de package partagé, ou quand le dev ne démarre plus. Déclencher quand le schéma DB a changé, quand les types partagés ont changé, ou quand le dev ne démarre plus.
---

# spok-rebuild — Rebuild et réinitialisation SPOK

> **Anti-tunnel** : entre chaque étape, si un message de l'utilisateur est arrivé, l'intégrer avant de poursuivre — il prime sur le déroulé de la skill.

## Choisir le bon niveau

| Situation | Niveau |
|-----------|--------|
| Types `@spok/shared` ou `@spok/database` modifiés | **1 — Packages** |
| Schéma Prisma modifié (`schema.prisma`) | **2 — Schema** |
| Dev ne démarre plus, erreurs de module | **3 — Full rebuild** |

---

## Niveau 1 — Packages seulement

```bash
cd C:/_dev/spok
pnpm build:packages
```

Rebuild `@spok/shared` + `@spok/database`. Suffisant quand seuls les types ou constantes partagés ont changé.

---

## Niveau 2 — Schema Prisma

```bash
cd C:/_dev/spok
pnpm db:generate        # regénère le client Prisma
pnpm db:push            # pousse le schéma vers la DB (dev uniquement, sans migration)
pnpm build:packages     # rebuild les packages qui dépendent du client
```

Utiliser `pnpm db:migrate` à la place de `db:push` si on veut garder un historique de migration.

---

## Niveau 3 — Full rebuild

```bash
cd C:/_dev/spok
pnpm build:packages     # shared + database
cd apps/web && npx tsc --noEmit   # typecheck web
cd ../api && npx tsc --noEmit     # typecheck api
```

⚠️ `pnpm typecheck` (script racine) ne vérifie RIEN : aucun package n'a de script `typecheck`. Utiliser `npx tsc --noEmit` par app.

Si des erreurs de module persistent après ça :

```bash
pnpm clean              # supprime tous les dist/ et node_modules
pnpm install            # réinstalle tout
pnpm build:packages
```

---

## Après un rebuild

Relancer le dev :
```bash
pnpm dev:start
```

Si l'API était déjà lancée, la tuer d'abord (`pnpm dev:stop`) pour éviter les conflits de port.
