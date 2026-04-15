# Systeme de menus

## Comment ca marche

Les menus sont stockes en base dans la table MenuItem (pas en dur dans le code).
Un jeu de defaults existe dans packages/shared/src/constants/menuDefaults.ts (67 items).
Au chargement (GET /menu), les defaults manquants sont auto-syncs en base.
L'admin peut tout reconfigurer via /admin/menu.

## Table MenuItem (schema.prisma)

| Champ | Type | Description |
|-------|------|-------------|
| key | String unique | Identifiant technique ("list", "admin-users") |
| label | String | Texte affiche |
| icon | String | Nom d'icone Lucide |
| section | String | Groupe ("global", "basic", "planning", "exploration", "admin", "misc") |
| sectionLabel | String | Label de section ("Vues globales", "Basique") |
| sectionOrder | Int | Ordre des sections entre elles |
| route | String? | Route de navigation ("/communities") — OU — |
| viewMode | String? | Mode de vue d'espace ("list", "kanban") |
| order | Int | Ordre dans la section |
| visible | Boolean | Affiche ou cache |
| access | 'public' / 'user' / 'admin' | Niveau d'acces requis |

Un item est soit route-based (navigation globale) soit viewMode-based (vue d'espace), jamais les deux.

## Sections (6)

| Section | sectionOrder | Contenu |
|---------|-------------|---------|
| global | 0 | home, communities, spaces, sunburst global, mindmap global, graph global, dashboard, links global |
| basic | 1 | list, tree, text, types, members, priority, crossTable, thread |
| itemTypes | 2 | links, images, documents, bugs |
| planning | 3 | kanban, planning, timeline, calendar, burndown, cfd |
| exploration | 4 | mindmap, graph, sunburst, relations, bubble, radialTree, treemap, chord, heatmap, ego |
| admin | 5 | communities, spaces, users, stats, audit, anomalies, menu, referentiels, api-doc |
| misc | 6 | search, contact, profile, sitemap, logout |

## Access levels
- `public` : visible par tous (connectes et anonymes)
- `user` : visible uniquement par les utilisateurs connectes
- `admin` : visible uniquement par les admins (GlobalRole === ADMIN)

## Routes API

### GET /menu (public)
- Retourne tous les items visibles
- Auto-sync des defaults manquants
- Tri par sectionOrder, puis order

### GET /admin/menu (admin)
- Retourne TOUS les items (y compris caches)
- Auto-sync des defaults

### PUT /admin/menu (admin)
- Remplacement complet : supprime tout, re-insere la config
- Transactionnel

### POST /admin/menu/reset (admin)
- Reset aux defaults

## Fichiers cles
- `packages/database/prisma/schema.prisma` — modele MenuItem
- `packages/shared/src/constants/menuDefaults.ts` — DEFAULT_MENU_ITEMS (67 items)
- `packages/shared/src/types/menuItem.ts` — types MenuItemConfig, MenuSection
- `apps/api/src/routes/admin/menu.ts` — routes CRUD admin
- `apps/web/src/components/ViewModeSelector.tsx` — rendu des menus cote web
