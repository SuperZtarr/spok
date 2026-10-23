---
name: spok-deploy
description: Déployer SPOK en production depuis la session MEP (seule session qui commite). Traite les lots inscrits « PRÊT POUR MEP » dans le journal — un commit par lot, une vérification complète, push vers Railway, CI en tâche de fond. Déclencher quand l'utilisateur dit "MEP", "deploy", "pousse en prod", "commit et push". Dans une autre session : ne pas commiter, renvoyer vers la session MEP.
---

# spok-deploy — Déploiement en production

> **Session MEP seulement** (décision Thomas 2026-10-23, CLAUDE.md « Une seule session fait les MEP ») : une seule
> session commite et pousse. Si cette session n'est pas la session MEP (titre « MEP ») : ne rien commiter, inscrire
> le lot dans « PRÊT POUR MEP » (`docs/session-journal.md`) et le dire à Thomas.

> **Anti-tunnel** : entre chaque étape, si un message de l'utilisateur est arrivé, l'intégrer avant de poursuivre — il prime sur le déroulé de la skill.
> **Exécution non bloquante** : `pnpm exec vitest run` et `gh run watch` tournent en arrière-plan (`run_in_background: true`), jamais en foreground — un message de Thomas doit pouvoir arriver pendant l'attente.

## Séquence de déploiement

1. **Rebuild les packages partagés**
   ```bash
   cd C:/_dev/spok && pnpm build:packages
   ```
   Obligatoire si `packages/shared/` ou `packages/database/` ont été modifiés.

2. **Lire les lots et vérifier les fichiers modifiés**
   ```bash
   git -C C:/_dev/spok status
   git -C C:/_dev/spok diff --stat
   ```
   - Lire la section **« PRÊT POUR MEP »** de `docs/session-journal.md` : chaque lot liste ses fichiers.
   - Tout fichier modifié qui n'appartient à aucun lot inscrit (travail en cours d'une autre session) **reste hors
     des commits** ; fichier partagé entre un lot prêt et un travail en cours → ne commiter que les lignes du lot.
   - Une autre session a-t-elle des fichiers indexés (`git diff --cached`) ? → ne pas commiter, signaler à Thomas.

3. **Mettre à jour `docs/TODO.md`** — dans le commit du lot
   - Cocher `[x]` les tâches terminées, avec la **date seule** (pas de hash : `git log` le retrouve, plus de commit
     « docs: TODO - hash »)
   - Déplacer vers la section "Terminé" si applicable

4. **Mettre à jour `docs/session-journal.md`**
   - Retirer de « PRÊT POUR MEP » les lots poussés (une ligne dans EN COURS : lot, date, MEP)
   - Une ligne par action

4 bis. **Vérification complète — une seule passe sur l'ensemble des lots à pousser**
   - Typecheck des 5 paquets et TNR (`pnpm typecheck`, `pnpm exec vitest run`, en arrière-plan) sur l'état exact qui
     sera commité : si des fichiers en cours d'autres sessions sont présents, vérifier dans une copie de l'index
     (`git checkout-index -a --prefix=<scratchpad>/`, `node_modules` reliés par jonction) plutôt que sur le dossier

5. **Contrôle documentation** — bloquant
   ```bash
   node scripts/check-doc-headers.mjs        # en-têtes des fichiers source du diff à pousser
   ```
   - Échec → ajouter les en-têtes manquants (raison d'être, params clés, règles d'usage) avant de commiter
   - Checklist complémentaire (non scriptable) :
     - Comportement documenté modifié ? → item SPOK à jour (status `to_validate`)
     - Nouveau composant/route/script ? → l'item SPOK existe ou a été signalé comme absent
     - Interface modifiée (vue, page, modale, bouton, champ) ? → fiche d'aide utilisateur à jour (conseils, tour + repères `data-tour`, infobulles, état vide, aide des champs — cf. skill spok-doc, couche 3)
     - Actions à effet et blocs de décision touchés ? → rappel fonctionnel présent (ce qui va se passer) — liste de contrôle « terminé » de la skill `spok-dev`
   - Contrôle de l'aide utilisateur (si `apps/web` est dans le diff) :
     ```bash
     cd C:/_dev/spok && pnpm exec vitest run --project web apps/web/src/help   # depuis la racine : config jsdom (vitest.config.ts)
     ```
     Rouge → fiche, registre ou repère manquant : corriger avant de commiter

6. **Commiter — un commit par lot**
   ```bash
   git -C C:/_dev/spok add <fichiers du lot>
   git -C C:/_dev/spok commit -m "type: description courte"
   ```
   Format commit : `feat|fix|refactor|docs|style|test|chore: description`
   - Avant chaque commit : `git diff --cached --stat` = exactement les fichiers du lot (sinon une autre session a
     indexé quelque chose : stop, signaler)

7. **Pusher vers origin/master**
   ```bash
   git -C C:/_dev/spok push origin master
   ```
   Le push déclenche la CI (`.github/workflows/test.yml` : typecheck web/api + TNR, ~1 min).
   Railway est en « Wait for CI » : le déploiement ne part que si la CI est verte.

8. **Vérifier la CI — en tâche de fond, sans narrer**
   ```bash
   gh run list --workflow=test.yml --limit 1        # état du run
   gh run watch <run-id> --exit-status              # TOUJOURS en run_in_background: true
   ```
   - Lancer le watch en arrière-plan puis rendre la main (fin de tour ou tâche suivante) — ne pas rester à dire « je surveille la CI », ne pas sonder en direct
   - **CI verte → silence.** Ne pas déranger Thomas pour confirmer que tout va bien ; mentionner le hash + https://spok.space seulement s'il redemande ou dans le prochain message naturel
   - **CI rouge → alerte immédiate**, sans attendre qu'il demande : la prod n'a **pas** été déployée, lire `gh run view <run-id> --log-failed`, corriger, recommiter — ne jamais annoncer un déploiement sans CI verte

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
