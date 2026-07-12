---
name: spok-deploy
description: Déployer SPOK en production. Enchaîne rebuild des packages, commit, mise à jour TODO.md, et push vers Railway. Déclencher quand l'utilisateur dit "deploy", "pousse en prod", "commit et push", ou demande de déployer.
---

# spok-deploy — Déploiement en production

> **Anti-tunnel** : entre chaque étape, si un message de l'utilisateur est arrivé, l'intégrer avant de poursuivre — il prime sur le déroulé de la skill.
> **Exécution non bloquante** : `pnpm exec vitest run` et `gh run watch` tournent en arrière-plan (`run_in_background: true`), jamais en foreground — un message de Thomas doit pouvoir arriver pendant l'attente.

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

5. **Contrôle documentation** — bloquant
   ```bash
   node scripts/check-doc-headers.mjs        # en-têtes des fichiers source du diff à pousser
   ```
   - Échec → ajouter les en-têtes manquants (raison d'être, params clés, règles d'usage) avant de commiter
   - Checklist complémentaire (non scriptable) :
     - Comportement documenté modifié ? → item SPOK à jour (status `to_validate`)
     - Nouveau composant/route/script ? → l'item SPOK existe ou a été signalé comme absent

6. **Commiter**
   ```bash
   git -C C:/_dev/spok add <fichiers pertinents>
   git -C C:/_dev/spok commit -m "type: description courte"
   ```
   Format commit : `feat|fix|refactor|docs|style|test|chore: description`

7. **Pusher vers origin/master**
   ```bash
   git -C C:/_dev/spok push origin master
   ```
   Le push déclenche la CI (`.github/workflows/test.yml` : typecheck web/api + TNR, ~1 min).
   Railway est en « Wait for CI » : le déploiement ne part que si la CI est verte.

8. **Vérifier la CI et confirmer**
   ```bash
   gh run list --workflow=test.yml --limit 1        # état du run
   gh run watch <run-id> --exit-status              # attendre le verdict si besoin
   ```
   - CI verte → Railway déploie (~2-3 min après le vert) — afficher le hash + https://spok.space
   - CI rouge → **la prod n'a PAS été déployée** : lire `gh run view <run-id> --log-failed`, corriger, recommiter — ne jamais annoncer un déploiement sans CI verte

## CI — règles

- Les commits ne touchant que `docs/**`, `*.md`, `.claude/**`, `_old/**` ne déclenchent pas la CI → déploiement direct
- La directive skip-ci de GitHub (entre crochets dans le message de commit) contourne les tests (micro-correction urgente) — **exceptionnel**, jamais par confort
- **PIÈGE** : GitHub scanne TOUT le message du commit de tête (titre + corps) — ne jamais écrire la chaîne `[skip` + `ci]` dans un message de commit (même pour en parler), ça saute la CI silencieusement (vécu le 2026-07-12, deux pushes sautés)
- Si un push avec du code n'a pas déclenché la CI : vérifier le message de commit, puis `gh workflow run test.yml` pour un run manuel
- Relance manuelle possible : `gh workflow run test.yml`

## Points d'attention

- Ne **jamais** commiter `.env` ou fichiers de credentials
- Ne **jamais** pusher sans accord explicite de l'utilisateur (sauf si "commit et push" ou "deploy" est dit explicitement)
- Si des migrations Prisma sont incluses : vérifier que `db:migrate` a été fait et que le fichier migration est dans le commit
- Si `packages/shared/` a changé : `pnpm build:packages` est **obligatoire** avant commit
- La CI fait le typecheck, mais pour un doute avant commit : `pnpm typecheck` (les 5 packages)
