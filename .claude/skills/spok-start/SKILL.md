---
name: spok-start
description: Démarrer l'environnement de développement SPOK. Déclencher au début de chaque session de développement, ou quand l'utilisateur demande de démarrer, lancer le dev, ou ouvrir l'appli.
---

# start-dev — Démarrage environnement SPOK

> **Une seule session « Start » démarre et arrête le dev** (décision Thomas 2026-10-24, CLAUDE.md « Une seule
> session démarre/arrête le dev »). Si cette session n'est pas la session Start et que le dev ne tourne pas : ne pas
> lancer `pnpm dev:start` / `dev:stop`, le signaler à Thomas pour que la session Start s'en charge. Les étapes 3-4
> (lecture du contexte, résumé) restent valables pour toute session.

## Séquence de démarrage

0. **Détecter le contexte git** — Claude Desktop crée un worktree par conversation
   ```bash
   git -C "C:/_dev/spok" worktree list
   ```
   Si la session tourne dans un worktree (`C:/_dev/spok/.claude/worktrees/...`) :
   - Le signaler à l'utilisateur : "Je suis dans le worktree `<nom>`. Tout le travail sera fait dans `C:/_dev/spok` sur master directement."
   - Tous les fichiers doivent être lus/écrits dans `C:/_dev/spok`, pas dans le worktree
   - À la fin de session (ou sur demande) : merger + supprimer le worktree (voir section "Nettoyage worktree" ci-dessous)

1. **Lancer le dev d'emblée, sans vérification préalable** — en tâche de fond (`run_in_background: true`)
   ```bash
   pnpm dev:start
   ```
   `scripts/dev-start.ps1` gère Docker seul : s'il est arrêté, il renomme `%LOCALAPPDATA%\Docker\run` en
   `run_broken_<date>` (sockets orphelins laissés à chaque arrêt, panne récurrente — `remove ...\Docker\run\<socket>:
   The file cannot be accessed by the system`), lance Docker Desktop, attend le moteur (3 min max), puis PostgreSQL,
   API 3001 et Web 3000. Dans le même appel suivant, boucler jusqu'à ce que `http://localhost:3001/health` et
   `http://localhost:3000` répondent 200 (3 min max).
   - Échec « Docker ne répond pas » → lire la fin de `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`
     (`backend crashed`), citer la ligne à Thomas, ne rien supprimer ni réinstaller.
   - Les anciens `run_broken_*` / `run.old` ne se suppriment que sur demande de Thomas.
   - Port « réservé » (bank 3002 et autres projets) : voir la mémoire windows-port-reservations.

2. **Ouvrir l'appli dans le navigateur intégré** (outils `mcp__Claude_Browser__*`) : `preview_start` avec
   `url: "http://localhost:3000"`, puis `read_console_messages` (erreurs). Ne pas utiliser le Chrome de Thomas
   (`claude-in-chrome`) sauf demande explicite de sa part.

3. **Lire le contexte de session** (en parallèle) :
   - `docs/session-journal.md` — section EN COURS
   - `docs/TODO.md` — tâches en attente
   - `docs/ARCHITECTURE.md` — patterns de code, stores, zones fragiles

4. **Présenter un résumé** : ce qui était en cours, ce qui reste à faire, proposer la suite.

## Nettoyage worktree (fin de session ou sur demande)

```bash
# Depuis C:/_dev/spok
BRANCH=$(git -C "C:/_dev/spok" worktree list | grep worktrees | awk '{print $3}' | tr -d '[]')
git -C "C:/_dev/spok" worktree remove ".claude/worktrees/<nom>" --force
git -C "C:/_dev/spok" branch -d $BRANCH
```

Les changements doivent avoir été faits directement sur master — il n'y a donc rien à merger.

## Règle de documentation — obligatoire avant tout code

**Toute demande de modification de code** (fonctionnalité, correctif, retouche d'interface, route API…) passe par la
skill **`spok-dev`** : `Skill({ skill: "spok-dev" })`. Elle appelle `spok-doc` avant (spec) et après (liste de
contrôle des trois couches : spec SPOK, en-têtes et `businessRules.ts`, aide utilisateur dans l'interface avec
rappels fonctionnels). Ne pas attendre que l'utilisateur le demande.

## Points d'attention

- Ne jamais tuer les processus du projet `bank` (port 3002)
- PostgreSQL est partagé entre projets — ne pas `db:down` sans vérifier
- Si l'API ne répond pas : vérifier que le build packages est fait (`pnpm build:packages`)
