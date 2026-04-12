---
name: spok-deploy
description: Déployer SPOK en production. Enchaîne rebuild des packages, commit, mise à jour TODO.md, et push vers Railway. Déclencher quand l'utilisateur dit "deploy", "pousse en prod", "commit et push", ou demande de déployer.
---

# spok-deploy — Déploiement en production

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
   Railway détecte le push et déclenche le déploiement automatique.

7. **Confirmer**
   - Afficher le hash du commit
   - Rappeler que Railway déploie automatiquement (délai ~2-3 min)
   - Mentionner l'URL prod : https://spok.space

## Points d'attention

- Ne **jamais** commiter `.env` ou fichiers de credentials
- Ne **jamais** pusher sans accord explicite de l'utilisateur (sauf si "commit et push" ou "deploy" est dit explicitement)
- Si des migrations Prisma sont incluses : vérifier que `db:migrate` a été fait et que le fichier migration est dans le commit
- Si `packages/shared/` a changé : `pnpm build:packages` est **obligatoire** avant commit
- Le push sur `master` = déploiement prod immédiat — vérifier que le code compile (`pnpm typecheck`) si doute
