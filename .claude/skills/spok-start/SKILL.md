---
name: spok-start
description: Démarrer l'environnement de développement SPOK. Déclencher au début de chaque session de développement, ou quand l'utilisateur demande de démarrer, lancer le dev, ou ouvrir l'appli.
---

# start-dev — Démarrage environnement SPOK

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

2. **Lancer le dev**
   ```bash
   pnpm dev:start
   ```
   (Lance PostgreSQL Docker + API port 3001 + Web port 3000)

3. **Ouvrir le navigateur avec le plugin Chrome** :
   - Vérifier si Chrome est déjà ouvert : `mcp__Claude_in_Chrome__list_connected_browsers`
   - Si aucun browser connecté : `Start-Process "chrome.exe"` puis attendre quelques secondes
   - Appeler `mcp__Claude_in_Chrome__tabs_context_mcp` **sans** `createIfEmpty` pour récupérer les onglets existants
   - Si un onglet existe : naviguer vers `http://localhost:3000` via `mcp__Claude_in_Chrome__navigate`
   - Si aucun onglet disponible : créer un onglet via `mcp__Claude_in_Chrome__tabs_create_mcp` puis naviguer — **ne jamais utiliser `createIfEmpty: true`** (crée un nouveau groupe "Démarre" à chaque session)

4. **Lire le contexte de session**
   - `docs/session-journal.md` — section EN COURS
   - `docs/TODO.md` — tâches en attente

5. **Présenter un résumé** : ce qui était en cours, ce qui reste à faire, proposer la suite.

## Nettoyage worktree (fin de session ou sur demande)

```bash
# Depuis C:/_dev/spok
BRANCH=$(git -C "C:/_dev/spok" worktree list | grep worktrees | awk '{print $3}' | tr -d '[]')
git -C "C:/_dev/spok" worktree remove ".claude/worktrees/<nom>" --force
git -C "C:/_dev/spok" branch -d $BRANCH
```

Les changements doivent avoir été faits directement sur master — il n'y a donc rien à merger.

## Points d'attention

- Ne jamais tuer les processus du projet `bank` (port 3002)
- PostgreSQL est partagé entre projets — ne pas `db:down` sans vérifier
- Si l'API ne répond pas : vérifier que le build packages est fait (`pnpm build:packages`)
