# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Instructions pour Claude
Ne pas déployer, demander validation
Ne pas coder, reflechir a la proposition d'une solution 
Lorsqu'une solution est convenue, proposer un plan a valider avant de coder

### Interdictions absolues
- Ne JAMAIS modifier des données en production sans demande explicite
- Ne JAMAIS commiter ou pusher sans demande explicite de l'utilisateur
- Ne JAMAIS appeler `api.spok.space` directement (curl, fetch, ou tout autre outil)
- Ne JAMAIS utiliser `isolation: "worktree"` dans l'outil Agent
- Ne JAMAIS faire `git add -A` (risque d'inclure .env, credentials, binaires)

### Workflow Git
- Travailler directement dans `C:\_dev\spok` sur master — pas de worktree
- Les conversations sont séparées par thème mais partagent la même base de code
- "commit et push" = commit + `git push origin master` = déploiement Railway prod
- Tout enchaîner sans pause ni question intermédiaire

### Zones fragiles
- **MindMap** : edges recalculés via `onInit`, portails placement fixe — ne pas modifier sans vérifier les edges
- **Navigation globale / Sidebar** : `GlobalNavBar.tsx` et `Layout.tsx` (les anciens noms `MainMenu.tsx`/`Sidebar.tsx` n'existent plus) — bandeau Bootstrap plein hauteur sans hamburger, jamais de logique `layoutMode` avec mesure de largeur, style Notion/Linear pour la sidebar — lire le skill `spok-layout` avant toute modification
- **Auth/Token** : logique refresh proactive — ne pas simplifier sans comprendre pourquoi

### Référence technique obligatoire

Lire `docs/ARCHITECTURE.md` avant de travailler sur :
- N'importe quel composant vue (ListView, KanbanView, MindMapView, etc.)
- Les stores Zustand (`stores/`)
- Les hooks TanStack Query (`hooks/`)
- SpacePage

Ce fichier documente les patterns de code, les stores existants, les conventions queryKey, et la structure attendue des vues. Ne pas déduire ces patterns depuis le code seul.

### Documentation dans le code — règle absolue

**Tout fichier créé ou modifié reçoit un commentaire en tête** (composant, hook, utilitaire, store, route API, helper) :
- Raison d'être : pourquoi ce fichier existe, quel problème il résout
- Params/props clés : ce qu'on lui passe et pourquoi
- Règles d'usage : où l'utiliser, ce qu'on ne doit pas faire avec

Format : bloc `/* ... */` ou JSDoc `/** ... */` avant les imports. Une ligne suffit si c'est simple. Ne pas attendre que l'utilisateur le demande — c'est non négociable, au même titre que le TS check.

### Documentation — règles obligatoires

**Consulter avant de coder**
- Avant toute modification de code sur un composant, page ou comportement : lire l'item de doc correspondant dans SPOK via `mcp__spok__search_items` ou `mcp__spok__get_space`
- Si l'item n'existe pas → le signaler à l'utilisateur avant de coder
- La doc décrit l'intention décidée, pas l'implémentation actuelle — si le code diverge de la doc, c'est le code qui a tort, pas la doc
- Ne jamais déduire le comportement attendu depuis le code seul

**Signaler les divergences**
- Si le code implémenté ne correspond pas à la doc : le signaler explicitement, ne pas suivre le code silencieusement

**Mettre à jour après avoir codé**
- Après toute modification qui change un comportement documenté : mettre à jour l'item SPOK correspondant (status `to_validate`, description mise à jour)
- Granularité : mettre à jour au niveau du composant parent, pas nécessairement chaque sous-item

**Journalisation**
- `docs/session-journal.md` : écrire après chaque action significative, garder la section EN COURS courte
- `docs/TODO.md` : mettre à jour après chaque commit (date + hash)

---

## Project Overview

SPOK is a modular multi-user application for structuring, linking, evaluating, and planning. It's a TypeScript monorepo using pnpm workspaces.

## Commands

### Development
```bash
pnpm dev:start            # Tout-en-un : PostgreSQL Docker + API + Web en local
pnpm dev:stop             # Arret des processus node (PostgreSQL reste actif)
pnpm dev                  # Build packages puis lance API + Web en local
pnpm dev:api              # API seule (port 3001)
pnpm dev:web              # Web seul (port 3000)
pnpm build:packages       # Build @spok/shared + @spok/database
pnpm db:up                # Demarrer PostgreSQL Docker seul
pnpm db:down              # Arreter PostgreSQL Docker
pnpm dev:logs:db          # Logs PostgreSQL
```

### Database (PostgreSQL via Prisma)
```bash
pnpm db:generate          # Generate Prisma client after schema changes
pnpm db:push              # Push schema to database (dev)
pnpm db:migrate           # Create migration files
pnpm db:studio            # Open Prisma Studio GUI
pnpm db:seed              # Seed database with initial data
```

### Build & Quality
```bash
pnpm build                # Build all packages
pnpm typecheck            # Typecheck des 5 packages (web, api, mcp, shared, database)
pnpm clean                # Remove all dist folders and node_modules
```

## Architecture

```
apps/
  api/          # @spok/api - Fastify REST API (port 3001)
  web/          # @spok/web - React + Vite SPA (port 3000)
packages/
  database/     # @spok/database - Prisma ORM + schema
  shared/       # @spok/shared - Shared types and constants
docker/
  docker-compose.dev.yml  # PostgreSQL dev (port 5433)
  Dockerfile.api          # Image prod API
  Dockerfile.web          # Image prod Web (nginx)
  docker-compose.yml      # Compose prod
scripts/
  dev-start.ps1           # PostgreSQL Docker + pnpm dev
  dev-stop.ps1            # Arret processus node
```

### API Structure (apps/api/)
- `src/plugins/` - Fastify plugins (prisma, jwt)
- `src/routes/` - Route handlers (auth, spaces, items, tags, graph, admin/*)
- Routes are registered in `src/index.ts` with prefixes (`/auth`, `/spaces`, etc.)

### Web Structure (apps/web/)
- Uses `@/` path alias for `./src/`
- State management: Zustand
- Data fetching: TanStack React Query
- Routing: React Router v6
- Styling: Tailwind CSS
- Vues : ListView, KanbanView, TimelineView (Gantt), MindMapView, SequenceView, GraphView, SunburstView
- Dev server proxies `/api/*` to the API server (via `VITE_API_PROXY_TARGET`)

### Database Schema (packages/database/)
Core models: User, Space (hierarchy), SpaceMembership, Community, CommunityMembership, Item (NOTE/PROJECT/TASK/MEETING/PERIOD/LINK/CONFIG/DOCUMENT/IMAGE/BUG), ItemRelation, Tag, Contribution, AuditLog, RefreshToken, PasswordResetToken

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string (local: `localhost:5433`, Docker interne: `postgres:5432`)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Change in production
- `API_PORT` - Default 3001
- `VITE_API_URL` - API URL for frontend
- `RESEND_API_KEY` - Email sending (Resend)
- `R2_*` - Cloudflare R2 image storage

## Workspace Dependencies

Internal packages use `workspace:*` protocol. When importing:
- `@spok/database` exports Prisma client
- `@spok/shared` exports shared types/constants

## Dev local

- **PostgreSQL** en Docker (conteneur `spok-postgres-dev`, port 5433, partage entre projets)
- **API + Web** en local via `pnpm dev` (hot reload natif, pas de Docker)
- `pnpm dev:start` fait les deux : demarre postgres Docker puis lance `pnpm dev`

## Production

Deploye sur Railway :
- **API** : `docker/Dockerfile.api` (Fastify, port 3001)
- **Web** : `docker/Dockerfile.web` (nginx, build Vite statique)
- **PostgreSQL** : service Railway
- Push sur `origin/master` declenche le deploiement automatique

