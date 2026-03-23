# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Dev local

- **PostgreSQL** en Docker (conteneur `spok-postgres-dev`, port 25432, partage entre projets)
- **API + Web** en local via `pnpm dev` (hot reload natif, pas de Docker)
- `pnpm dev:start` fait les deux : demarre postgres Docker puis lance `pnpm dev`

## Production

Deploye sur Railway :
- **API** : `docker/Dockerfile.api` (Fastify, port 3001)
- **Web** : `docker/Dockerfile.web` (nginx, build Vite statique)
- **PostgreSQL** : service Railway
- Push sur `origin/master` declenche le deploiement automatique

## Lexique des pages

### Publiques (sans auth)
| Route | Composant | Description |
|---|---|---|
| `/` (non connecte) | `LandingPage` | Page d'atterrissage, hero, communautes publiques, showcase vues |
| `/login` | `LoginPage` | Connexion (rendu dans Layout sans sidebar) |
| `/register` | `RegisterPage` | Inscription (rendu dans Layout sans sidebar) |
| `/forgot-password` | `ForgotPasswordPage` | Mot de passe oublie (rendu dans Layout sans sidebar) |
| `/reset-password` | `ResetPasswordPage` | Reinitialisation mot de passe |
| `/verify-email` | `VerifyEmailPage` | Verification email |
| `/invitation` | `InvitationPage` | Acceptation d'invitation |
| `/sitemap` | `SitemapPage` | Plan du site |

### Utilisateur connecte (Layout avec sidebar)
| Route | Composant | Description |
|---|---|---|
| `/` | `HomePage` → `HomeView` | Page d'accueil, communautes et espaces de l'utilisateur |
| `/communities` | `CommunitiesListPage` | Liste des communautes |
| `/spaces` | `SpacesListPage` | Liste des espaces |
| `/dashboard` | `DashboardViewPage` | Tableau de bord |
| `/graph` | `GraphPage` | Graphe global |
| `/sunburst` | `SunburstPage` | Sunburst global |
| `/mindmap` | `MindMapPage` | Carte mentale globale |
| `/tasks` | `GlobalTasksPage` | Taches globales (protege) |
| `/search` | `SearchPage` | Recherche avancee |

### Espaces
| Route | Composant | Description |
|---|---|---|
| `/spaces/:id` | `SpaceOverviewPage` | Apercu d'un espace (stats, membres, vues dispo) |
| `/spaces/:id/content` | `SpacePage` | Contenu d'un espace (23 vues : list, kanban, gantt, mindmap...) |
| `/spaces/:id/settings` | `SpaceSettingsPage` | Parametres de l'espace (protege) |
| `/spaces/:id/history` | `SpaceHistoryPage` | Historique / audit log (protege) |

### Communautes
| Route | Composant | Description |
|---|---|---|
| `/communities/:id` | `CommunityPage` | Page d'une communaute |
| `/communities/:id/settings` | `CommunitySettingsPage` | Parametres communaute (protege) |

### Administration (admin uniquement)
| Route | Composant | Description |
|---|---|---|
| `/admin/users` | `UsersPage` | Gestion utilisateurs |
| `/admin/spaces` | `SpacesPage` | Gestion espaces |
| `/admin/communities` | `CommunitiesPage` | Gestion communautes |
| `/admin/stats` | `StatsPage` | Statistiques |
| `/admin/audit-logs` | `AuditLogsPage` | Logs d'audit |
| `/admin/anomalies` | `AnomaliesPage` | Diagnostics |
| `/admin/menu` | `MenuConfigPage` | Configuration des menus (table MenuItem) |
| `/admin/views` | `ViewsConfigPage` | Configuration des vues (legacy) |
| `/admin/referentiels` | `ReferentielsPage` | Referentiels (statuts, types, priorites) |

## Instructions pour Claude

### Démarrage de session (OBLIGATOIRE — AVANT TOUTE ACTION)
1. Lire `~/.claude/CLAUDE.md` (instructions globales, accords permanents)
2. Lire `docs/session-journal.md` (accords permanents + historique)
3. Lire `docs/TODO.md` (tâches en cours)
4. Faire le point avec l'utilisateur avant de commencer quoi que ce soit

### Workflow Git (OBLIGATOIRE)
- **JAMAIS** merger dans master ni pusher sans accord explicite de l'utilisateur
- Commiter uniquement sur la branche worktree (`claude/*`)
- Apres commit, attendre que l'utilisateur teste en local (`pnpm dev:start`)
- Merger et pusher **uniquement** quand l'utilisateur dit "merge et push" (ou equivalent)

### Modifier des donnees en base dev (OBLIGATOIRE)
- **MenuItem (menus)** : utiliser l'interface `/admin/menu` ou Prisma Studio (`pnpm db:studio`). JAMAIS curl en chaine.
- **Donnees en base** : Prisma Studio ou script TS one-liner (`npx tsx script.ts`). JAMAIS d'appels API curl complexes.
- **Quand une interface admin existe** : l'utiliser ou proposer a l'utilisateur de le faire lui-meme. Ne pas reinventer.
- **Principe general** : toujours choisir la methode la plus simple et directe. Si ca prend plus de 2 commandes, c'est qu'on fait faux.

### Configuration des ports (NE PAS MODIFIER)
- **Web** : port 3000 (configure dans `apps/web/vite.config.ts` avec `strictPort: true`)
- **API** : port 3001 (configure via `API_PORT`)
- **PostgreSQL dev** : port 25432 (host) / 5432 (Docker interne)

### Demarrage / Arret
```bash
pnpm dev:start   # PostgreSQL Docker + API + Web en local
pnpm dev:stop    # Arrete les processus node (PostgreSQL reste actif)
```

### Redemarrage des services
Apres chaque developpement necessitant un redemarrage : `pnpm dev:stop` puis `pnpm dev:start`.

**Redemarrage necessaire apres** :
- Modifications du schema Prisma
- Ajout/suppression de dependances
- Modifications de `vite.config.ts` ou fichiers de configuration
- Modifications des fichiers `.env`

**Pas de redemarrage necessaire** (hot reload natif) :
- Modifications de code TypeScript/React (tsx watch + Vite HMR)
