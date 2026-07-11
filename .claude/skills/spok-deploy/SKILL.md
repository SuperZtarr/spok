---
name: spok-deploy
description: Déployer SPOK en production. Enchaîne rebuild des packages, commit, mise à jour TODO.md, et push vers Railway. Déclencher quand l'utilisateur dit "deploy", "pousse en prod", "commit et push", ou demande de déployer.
---

# spok-deploy — Déploiement en production

> **Anti-tunnel** : entre chaque étape, si un message de l'utilisateur est arrivé, l'intégrer avant de poursuivre — il prime sur le déroulé de la skill.

## Séquence de déploiement

1. **Rebuild les packages partagés**
   ```bash
   cd C:/_dev/spok && pnpm build:packages
   ```
   Obligatoire si `packages/shared/` ou `packages/database/` ont été modifiés.

2. **Vérifier les fichiers modifiés**
   ```bash
   git -C C:/_dev/spok status
   git -C C:/_dev/spok diff --stat
   ```
   Lister ce qui sera commité, identifier les changements.

3. **Mettre à jour `docs/TODO.md`**
   - Cocher `[x]` les tâches terminées dans cette session
   - Ajouter la date et le hash de commit (approximatif ou à compléter après)
   - Déplacer vers la section "Terminé" si applicable

4. **Mettre à jour `docs/session-journal.md`**
   - Mettre à jour la section **EN COURS** avec le contexte exact pour reprendre
   - Une ligne par action

5. **Commiter**
   ```bash
   git -C C:/_dev/spok add <fichiers pertinents>
   git -C C:/_dev/spok commit -m "type: description courte"
   ```
   Format commit : `feat|fix|refactor|docs|style|test|chore: description`

6. **Pusher vers origin/master**
   ```bash
   git -C C:/_dev/spok push origin master
   ```
   Le push déclenche la CI (`.github/workflows/test.yml` : typecheck web/api + TNR, ~1 min).
   Railway est en « Wait for CI » : le déploiement ne part que si la CI est verte.

7. **Vérifier la CI et confirmer**
   ```bash
   gh run list --workflow=test.yml --limit 1        # état du run
   gh run watch <run-id> --exit-status              # attendre le verdict si besoin
   ```
   - CI verte → Railway déploie (~2-3 min après le vert) — afficher le hash + https://spok.space
   - CI rouge → **la prod n'a PAS été déployée** : lire `gh run view <run-id> --log-failed`, corriger, recommiter — ne jamais annoncer un déploiement sans CI verte

## CI — règles

- La CI tourne sur **chaque push** (pas de paths-ignore : un push multi-commits finissant par un commit docs sautait la CI — constaté 2026-07-12)
- `[skip ci]` dans le message de commit = contourner les tests (micro-correction urgente ou mep purement docs) — **exceptionnel**, jamais par confort
- Relance manuelle possible : `gh workflow run test.yml`

## Points d'attention

- Ne **jamais** commiter `.env` ou fichiers de credentials
- Ne **jamais** pusher sans accord explicite de l'utilisateur (sauf si "commit et push" ou "deploy" est dit explicitement)
- Si des migrations Prisma sont incluses : vérifier que `db:migrate` a été fait et que le fichier migration est dans le commit
- Si `packages/shared/` a changé : `pnpm build:packages` est **obligatoire** avant commit
- La CI fait le typecheck, mais pour un doute avant commit : `cd apps/web && npx tsc --noEmit` (le script racine `pnpm typecheck` ne vérifie rien, aucun package n'a de script typecheck)
