# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPOK is a modular multi-user application for structuring, linking, evaluating, and planning. It's a TypeScript monorepo using pnpm workspaces.

## Commands

### Development (Docker - mode principal)
```bash
pnpm dev:start            # Tout-en-un : lance PostgreSQL + API + Web en Docker
pnpm dev:stop             # Arret propre des 3 conteneurs
pnpm dev:logs             # Logs des 3 services en temps reel
pnpm dev:logs:api         # Logs API uniquement
pnpm dev:logs:web         # Logs Web uniquement
pnpm dev:logs:db          # Logs PostgreSQL uniquement
```

### Development (local sans Docker - fallback)
```bash
pnpm dev                  # Build packages puis lance API + Web en local
pnpm dev:api              # API seule (port 3001)
pnpm dev:web              # Web seul (port 3000)
pnpm build:packages       # Build @spok/shared + @spok/database
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
pnpm typecheck            # Run TypeScript type checking
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
  Dockerfile.api.dev      # Image dev API (node:20-slim, tsx watch)
  Dockerfile.web.dev      # Image dev Web (node:20-alpine, vite)
  docker-compose.dev.yml  # 3 services : postgres, api, web
  Dockerfile.api          # Image prod API
  Dockerfile.web          # Image prod Web (nginx)
  docker-compose.yml      # Compose prod
scripts/
  dev-start.ps1           # Script demarrage Docker dev
  dev-stop.ps1            # Script arret Docker dev
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
- `DATABASE_URL` - PostgreSQL connection string (local: `localhost:25432`, Docker interne: `postgres:5432`)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Change in production
- `API_PORT` - Default 3001
- `VITE_API_URL` - API URL for frontend
- `RESEND_API_KEY` - Email sending (Resend)
- `R2_*` - Cloudflare R2 image storage

## Workspace Dependencies

Internal packages use `workspace:*` protocol. When importing:
- `@spok/database` exports Prisma client
- `@spok/shared` exports shared types/constants

## Docker Dev - Details techniques

Les conteneurs utilisent `node-linker=hoisted` dans `.npmrc` (genere au build) pour eviter les symlinks pnpm incompatibles avec Docker. Les packages workspace `@spok/*` sont lies via symlinks manuels dans le Dockerfile.

Les volumes montent le code source (read-only) pour le hot reload :
- API : `apps/api/src`, `packages/shared/src`, `packages/database/prisma`
- Web : `apps/web/src`, `apps/web/index.html`, `apps/web/public`, `packages/shared/src`

PostgreSQL est expose sur le port 25432 (host) pour eviter les conflits avec une instance locale.

## Production

Deploye sur Railway :
- **API** : `docker/Dockerfile.api` (Fastify, port 3001)
- **Web** : `docker/Dockerfile.web` (nginx, build Vite statique)
- **PostgreSQL** : service Railway
- Push sur `origin/master` declenche le deploiement automatique

## Instructions pour Claude

### Workflow Git (OBLIGATOIRE)
- **JAMAIS** merger dans master ni pusher sans accord explicite de l'utilisateur
- Commiter uniquement sur la branche worktree (`claude/*`)
- Apres commit, attendre que l'utilisateur teste en local (`pnpm dev:start`)
- Merger et pusher **uniquement** quand l'utilisateur dit "merge et push" (ou equivalent)

### Configuration des ports (NE PAS MODIFIER)
- **Web** : port 3000 (configure dans `apps/web/vite.config.ts` avec `strictPort: true`)
- **API** : port 3001 (configure via `API_PORT`)
- **PostgreSQL dev** : port 25432 (host) / 5432 (Docker interne)

### Demarrage / Arret
```bash
pnpm dev:start   # Lance les 3 conteneurs Docker (postgres, api, web)
pnpm dev:stop    # Arrete les conteneurs + fallback kill processus node
```
Les scripts PowerShell sont dans `scripts/dev-start.ps1` et `scripts/dev-stop.ps1`.

### Redemarrage des services
Apres chaque developpement necessitant un redemarrage : `pnpm dev:stop` puis `pnpm dev:start`.

**Redemarrage necessaire apres** :
- Modifications du schema Prisma
- Ajout/suppression de dependances
- Modifications de `vite.config.ts` ou fichiers de configuration
- Modifications des fichiers `.env`

**Pas de redemarrage necessaire** (rechargement automatique via volumes Docker) :
- Modifications de code TypeScript/React (tsx watch + Vite HMR)
