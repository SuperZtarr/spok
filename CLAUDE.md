# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPOK is a modular multi-user application for structuring, linking, evaluating, and planning. It's a TypeScript monorepo using pnpm workspaces.

## Commands

### Development
```bash
pnpm install              # Install all dependencies
pnpm dev                  # Build packages then run all apps (API + Web)
pnpm dev:api              # Run API only (port 3001)
pnpm dev:web              # Run Web only (port 3000)
pnpm build:packages       # Build shared libraries only (@spok/shared, @spok/database)
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

### Docker (development database)
```bash
docker-compose -f docker/docker-compose.dev.yml up -d    # Start PostgreSQL
docker-compose -f docker/docker-compose.dev.yml down     # Stop PostgreSQL
```

## Architecture

```
apps/
  api/          # @spok/api - Fastify REST API (port 3001)
  web/          # @spok/web - React + Vite SPA (port 3000)
packages/
  database/     # @spok/database - Prisma ORM + schema
  shared/       # @spok/shared - Shared types and constants
```

### API Structure (apps/api/)
- `src/plugins/` - Fastify plugins (prisma, jwt)
- `src/routes/` - Route handlers (auth, spaces, items, tags)
- Routes are registered in `src/index.ts` with prefixes (`/auth`, `/spaces`, etc.)

### Web Structure (apps/web/)
- Uses `@/` path alias for `./src/`
- State management: Zustand
- Data fetching: TanStack React Query
- Routing: React Router v6
- Styling: Tailwind CSS
- Dev server proxies `/api/*` to the API server

### Database Schema (packages/database/)
Core models: User, Space, SpaceMembership, Item (NOTE/PROJECT/TASK), ItemRelation, Tag

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Change in production
- `API_PORT` - Default 3001
- `VITE_API_URL` - API URL for frontend

## Workspace Dependencies

Internal packages use `workspace:*` protocol. When importing:
- `@spok/database` exports Prisma client
- `@spok/shared` exports shared types/constants

## Instructions pour Claude

### Configuration des ports (NE PAS MODIFIER)
- **Web** : port 3000 (configuré dans `apps/web/vite.config.ts` avec `strictPort: true`)
- **API** : port 3001 (configuré via `API_PORT`)

### Démarrage / Arrêt
```bash
pnpm dev:start   # Tout-en-un : Docker, kill ports, build packages, dev
pnpm dev:stop    # Arrêt propre (tue les processus node sur 3000/3001)
```
Les scripts PowerShell sont dans `scripts/dev-start.ps1` et `scripts/dev-stop.ps1`.

### Redémarrage des services
Après chaque développement nécessitant un redémarrage : `pnpm dev:stop` puis `pnpm dev:start`.

**Redémarrage nécessaire après** :
- Modifications du schéma Prisma → `pnpm db:generate` puis `pnpm dev:start`
- Ajout/suppression de dépendances → `pnpm install` puis `pnpm dev:start`
- Modifications de `vite.config.ts` ou fichiers de configuration
- Modifications des fichiers `.env`

**Pas de redémarrage nécessaire** (rechargement automatique) :
- Modifications de code TypeScript/React (tsx watch + Vite HMR)
