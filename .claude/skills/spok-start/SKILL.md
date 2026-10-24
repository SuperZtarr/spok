---
name: spok-start
description: Démarrer l'environnement de développement SPOK. Déclencher au début de chaque session de développement, ou quand l'utilisateur demande de démarrer, lancer le dev, ou ouvrir l'appli.
---

# start-dev — Démarrage environnement SPOK

> **Une seule session « Start » démarre et arrête le dev** (décision Thomas 2026-10-24, CLAUDE.md « Une seule
> session démarre/arrête le dev »). Si cette session n'est pas la session Start et que le dev ne tourne pas : ne pas
> lancer `pnpm dev:start` / `dev:stop`, le signaler à Thomas pour que la session Start s'en charge. Les étapes 4-5
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

1. **Vérifier Docker** — le conteneur `spok-postgres-dev` doit tourner
   ```bash
   docker ps | grep spok-postgres-dev
   ```
   Si absent : `pnpm db:up`

   **Docker ne répond pas** (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`) :
   - Lancer `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"` puis attendre jusqu'à 3 min que
     `docker info` réponde (boucle de 5 s, pas de `sleep` aveugle).
   - Toujours rien → lire la fin de `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log` (chercher
     `backend crashed`).
   - **Panne connue, récurrente** (2026-09-07, 2026-10-24) : `remove ...\AppData\Local\Docker\run\<socket>: The file
     cannot be accessed by the system`. Docker s'est mal arrêté (veille, extinction) et laisse dans `Docker\run` des
     sockets orphelins qu'il ne sait plus supprimer ; désactiver l'inférence ne suffit pas. Correctif (sans
     suppression, accord Thomas 2026-10-24) : Docker Desktop fermé, renommer le dossier avec un nom daté puis relancer
     ```powershell
     Rename-Item "$env:LOCALAPPDATA\Docker\run" ("run_broken_" + (Get-Date -Format yyyyMMdd-HHmm))
     ```
     Docker recrée `run` vide. Les anciens `run_broken_*` / `run.old` ne se suppriment que sur demande de Thomas.
   - Autre erreur → s'arrêter, citer la ligne du journal à Thomas, ne rien supprimer ni réinstaller.

2. **Lancer le dev** — en tâche de fond (`run_in_background: true`)
   ```bash
   pnpm dev:start
   ```
   (Lance PostgreSQL Docker + API port 3001 + Web port 3000). Vérifier ensuite que `http://localhost:3001/health`
   et `http://localhost:3000` répondent 200.

3. **Ouvrir l'appli dans le navigateur intégré** (outils `mcp__Claude_Browser__*`) : `preview_start` avec
   `url: "http://localhost:3000"`, puis `read_console_messages` (erreurs). Ne pas utiliser le Chrome de Thomas
   (`claude-in-chrome`) sauf demande explicite de sa part.

4. **Lire le contexte de session** (en parallèle) :
   - `docs/session-journal.md` — section EN COURS
   - `docs/TODO.md` — tâches en attente
   - `docs/ARCHITECTURE.md` — patterns de code, stores, zones fragiles

5. **Présenter un résumé** : ce qui était en cours, ce qui reste à faire, proposer la suite.

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
