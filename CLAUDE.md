# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Instructions pour Claude
Les règles générales (plan validé avant de coder, micro-correction, commits, confirmations) sont dans le CLAUDE.md
global. Ici, seulement ce qui est propre à SPOK.

- Micro-correction qui touche un composant : demander si on actualise sa spec SPOK et sa fiche d'aide. Tout autre
  changement : plan validé + trois couches de doc (skill `spok-dev`).

### Interdictions absolues
- Ne JAMAIS modifier des données en production sans demande explicite
- Ne JAMAIS appeler `api.spok.space` directement (curl, fetch, ou tout autre outil)
- Ne JAMAIS utiliser `isolation: "worktree"` dans l'outil Agent
- Ne JAMAIS faire `git add -A` (risque d'inclure .env, credentials, binaires)

### Workflow Git
- Directement dans `C:\_dev\spok` sur master, pas de worktree ; sessions séparées par thème, même base de code
- Push sur `origin/master` = déploiement Railway prod

### Une seule session fait les MEP (décision Thomas 2026-10-23)
Plusieurs sessions codent en parallèle dans le même dossier : deux sessions qui commitent se volent leurs fichiers
(index partagé, fichier modifié entre la vérification et le commit — CI cassée le 2026-10-23).
- **Session de développement** : ne commite JAMAIS, ne pousse jamais, ne lance pas `pnpm dev:stop` / `dev:start`
  si le dev tourne déjà. Lot terminé → l'inscrire dans la section « PRÊT POUR MEP » en haut de
  `docs/session-journal.md` (nom du lot, fichiers exacts — lignes concernées pour un fichier partagé —, tests faits,
  non vérifié). Thomas demande « MEP » ici → répondre que le lot est inscrit et que la MEP se fait depuis la session MEP.
- **Session MEP** (session dédiée, titre « MEP ») : seule à commiter et pousser, sur demande de Thomas — skill
  `spok-deploy` : un commit par lot, une vérification complète de l'ensemble, push, CI en tâche de fond, section vidée.

### Une seule session démarre/arrête le dev (décision Thomas 2026-10-24)
Le dev local (Docker `spok-postgres-dev`, API 3001, web 3000) est partagé par toutes les sessions.
- **Session Start** (session dédiée, titre « Start ») : seule à lancer `pnpm dev:start` / `pnpm dev:stop`, à démarrer
  ou dépanner Docker Desktop — skill `spok-start` (procédure de la panne récurrente `Docker\run` incluse).
- **Autres sessions** : ne lancent jamais `pnpm dev:start` / `dev:stop` ni Docker. Dev arrêté ou en panne → le
  signaler à Thomas pour qu'il le demande à la session Start.

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

### Documentation et suivi
- **Toute modification de code passe par la skill `spok-dev`** : spec SPOK consultée avant (elle fait foi, pas le
  code ; item absent ou divergence → le signaler), trois couches mises à jour après (spec en `to_validate`, doc dans
  le code, aide dans l'interface), journal.
- Tâches, bugs, évolutions : uniquement dans SPOK, espace « Bugs et évolutions » (décision Thomas 2026-11-26) —
  `docs/TODO.md` n'est plus tenu.

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
  docker-compose.dev.yml  # PostgreSQL dev (port 25432)
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
Core models: User, Space (hierarchy), SpaceMembership, Community, CommunityMembership, Item (UNDEFINED/PROJECT/TASK/MEETING/PERIOD/ARTICLE/QUESTION/PROCESS ; images, fichiers, liens = contenus d'un item), ItemRelation, Tag, Contribution, AuditLog, RefreshToken, PasswordResetToken

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

## Production

Railway : API `docker/Dockerfile.api`, Web `docker/Dockerfile.web` (nginx), PostgreSQL service Railway.

