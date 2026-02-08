# Architecture UI - SPOK

Documentation de la structure et terminologie de l'interface utilisateur.

## Structure principale

```
+----------------------------------------------------------+
|                        Header (h-14)                      |
|  [Logo] [CommunitySelector] [GlobalSearch] [ThemeToggle]  |
+------------+---------------------------------------------+
|            |                                             |
|  Sidebar   |              Main Content                   |
|   (w-52)   |               (Outlet)                      |
|            |                                             |
|  - Home    |    [Vue active selon ViewModeSelector]      |
|  - Spaces  |    List/Kanban/Sequence/Types/Planning/     |
|  - User    |    Timeline/MindMap                         |
|            |                                             |
+------------+---------------------------------------------+
```

## Pages

| Page | Fichier | Route | Description |
|------|---------|-------|-------------|
| Tableau de bord | `DashboardPage.tsx` | `/` | Liste des spaces (personnels + communautaires) |
| Espace | `SpacePage.tsx` | `/spaces/:id` | Items d'un space avec vues multiples |
| Paramètres space | `SpaceSettingsPage.tsx` | `/spaces/:id/settings` | Configuration du space |
| Paramètres communauté | `CommunitySettingsPage.tsx` | `/communities/:id/settings` | Configuration de la communauté |
| Historique | `SpaceHistoryPage.tsx` | `/spaces/:id/history` | Logs d'audit |
| Login | `LoginPage.tsx` | `/login` | Connexion |
| Register | `RegisterPage.tsx` | `/register` | Inscription |
| Mot de passe oublié | `ForgotPasswordPage.tsx` | `/forgot-password` | Demande de reset |
| Reset mot de passe | `ResetPasswordPage.tsx` | `/reset-password` | Reset avec token |

### Pages Admin

| Page | Fichier | Route |
|------|---------|-------|
| Utilisateurs | `admin/UsersPage.tsx` | `/admin/users` |
| Spaces | `admin/SpacesPage.tsx` | `/admin/spaces` |
| Communautés | `admin/CommunitiesPage.tsx` | `/admin/communities` |
| Référentiels | `admin/ReferentielsPage.tsx` | `/admin/referentiels` |
| Anomalies | `admin/AnomaliesPage.tsx` | `/admin/anomalies` |
| Tests | `admin/TestsPage.tsx` | `/admin/tests` |

## Layouts

### Layout principal (`Layout.tsx`)

- **Sidebar** : Navigation gauche fixe (w-52)
  - Logo SPOK (lien vers dashboard)
  - Recherche globale (`GlobalSearch`)
  - Liste des spaces (triés alphabétiquement, séparés par section)
  - Info utilisateur + déconnexion + avatar
  - Lien admin si rôle ADMIN

- **Header** : Barre supérieure sticky (h-14)
  - Sélecteur de communauté (`CommunitySelector`)
  - Titre de la page + badge type
  - `ViewModeSelector` pour changer de vue
  - Toggle thème clair/sombre

- **Outlet** : Zone de contenu scrollable

### Layout Admin (`AdminLayout.tsx`)

Layout spécifique avec sidebar de navigation admin (w-64).

## Modes de vue

Sélectionnables via `ViewModeSelector` dans le header.

| Vue | Fichier | Description |
|-----|---------|-------------|
| Liste | `views/ListView.tsx` | Tableau avec recherche, tri, colonnes |
| Kanban | `views/KanbanView.tsx` | Colonnes par statut, drag & drop |
| Séquence | `views/SequenceView.tsx` | Graphe avec relations hiérarchiques (ReactFlow) |
| Types | `views/TypesView.tsx` | Colonnes par type d'item, drag & drop |
| Planning | `views/PlanningView.tsx` | Diagramme de Gantt avec dépendances |
| Timeline | `views/TimelineView.tsx` | Frise chronologique |
| Carte mentale | `views/MindMapView.tsx` | Mind map interactive (ReactFlow), drag & reparent |

## Système de permissions UI (canEdit)

Les vues et composants reçoivent un prop `canEdit?: boolean` (défaut `true`).
Défini dans `SpacePage.tsx` : `const canEdit = space?.role !== 'VIEWER'`.

Quand `canEdit` est `false` (rôle VIEWER) :
- Les boutons d'ajout, modification et suppression sont masqués
- Les drag handles sont masqués (pas de réorganisation)
- Les formulaires sont désactivés (`disabled`)
- `ItemEditModal` affiche "Détail de l'élément" en lecture seule
- `RichTextEditor` masque la toolbar et passe en mode non-éditable
- Les connexions et reparenting dans MindMap/Sequence sont désactivés

## Types d'items

Définis dans `constants/ui.ts` (`ITEM_TYPES`).

| Type | Icone | Description |
|------|-------|-------------|
| `NOTE` | FileText | Note simple |
| `PROJECT` | FolderKanban | Projet (conteneur) |
| `TASK` | CheckSquare | Tâche |
| `MEETING` | Calendar | Réunion |
| `PERIOD` | Clock | Période |
| `LINK` | Link | Lien externe |
| `CONFIG` | Settings | Configuration |
| `DOCUMENT` | FileText | Document |
| `IMAGE` | Image | Image |

## Statuts

Workflow : `todo` -> `in_progress` -> `done` | `cancelled`

| Statut | Couleur | Description |
|--------|---------|-------------|
| `todo` | Gris | À faire |
| `in_progress` | Bleu | En cours |
| `done` | Vert | Terminé |
| `cancelled` | Rouge | Annulé |

Couleurs définies dans `STATUS_COLORS` (`constants/ui.ts`).
Les statuts sont personnalisables par space via les référentiels.

## Composants UI de base

Situés dans `components/ui/`.

| Composant | Fichier | Usage |
|-----------|---------|-------|
| Button | `Button.tsx` | Boutons avec variants (default, destructive, outline, secondary, ghost, link) et tailles (sm, default, lg, icon) |
| Modal | `Modal.tsx` | Fenêtres modales avec backdrop, fermeture Escape |
| Badge | `Badge.tsx` | Etiquettes pour types et statuts |
| Card | `Card.tsx` | Conteneurs (CardHeader, CardContent, CardTitle, CardDescription) |
| Input | `Input.tsx` | Champs de saisie texte |
| Select | `Select.tsx` | Listes déroulantes |
| RichTextEditor | `RichTextEditor.tsx` | Editeur rich text TipTap (gras, italique, listes, liens, titres, undo/redo) avec mode `editable` |

## Modales

| Modale | Fichier | Usage |
|--------|---------|-------|
| Edition item | `ItemEditModal.tsx` | Créer/modifier un item (titre, description, URL, parent, statut, type, dates, relations, contributions). Mode lecture seule si `canEdit=false` |
| Déplacer | `MoveToSpaceModal.tsx` | Déplacer item(s) vers un autre space |
| Dupliquer | `DuplicateToSpaceModal.tsx` | Dupliquer item(s) vers un autre space |
| Profil | `UserProfileModal.tsx` | Voir le profil utilisateur |

### Modales Admin

| Modale | Fichier | Usage |
|--------|---------|-------|
| Utilisateur | `admin/UserFormModal.tsx` | Créer/modifier un utilisateur |
| Détail space | `admin/SpaceDetailModal.tsx` | Détails et config d'un space |

## Composants fonctionnels

### Barre d'actions (`SelectionActionBar.tsx`)

Barre flottante apparaissant lors de la multi-sélection d'items.
Actions : déplacer, dupliquer, supprimer.

### Sélecteur de vue (`ViewModeSelector.tsx`)

Boutons toggle pour basculer entre les 7 modes de vue.

### Recherche globale (`GlobalSearch.tsx`)

Recherche cross-espaces dans la sidebar. Interroge l'API `/search`.

### Sélecteur de communauté (`CommunitySelector.tsx`)

Dropdown dans le header pour basculer entre communautés.

## Composants Paramètres

Situés dans `components/settings/`.

| Composant | Usage |
|-----------|-------|
| `TypeLabelsManager.tsx` | Configurer les labels des types d'items |
| `StatusManager.tsx` | Configurer le workflow des statuts |
| `ColorPicker.tsx` | Sélection de couleur |

## Composants Audit

Situés dans `components/audit/`.

| Composant | Usage |
|-----------|-------|
| `AuditLogList.tsx` | Liste des entrées d'audit |
| `AuditLogItem.tsx` | Une entrée d'audit avec icone d'action |
| `AuditLogDetail.tsx` | Détail des changements |
| `AuditFilters.tsx` | Filtres de recherche |

## State Management (Zustand)

Stores dans `stores/`.

| Store | Fichier | Contenu |
|-------|---------|---------|
| Auth | `auth.ts` | Utilisateur connecté, tokens |
| Selection | `selection.ts` | Items sélectionnés (multi-select) |
| View Mode | `viewMode.ts` | Mode de vue actif |
| Space | `space.ts` | Space courant |
| Community | `community.ts` | Communauté active |
| Theme | `theme.ts` | Préférence thème clair/sombre |

## Hooks personnalisés

Situés dans `hooks/`.

| Hook | Fichier | Usage |
|------|---------|-------|
| useItems | `useItems.ts` | React Query : CRUD items |
| useSpaces | `useSpaces.ts` | React Query : CRUD spaces |
| useReferentiels | `useReferentiels.ts` | React Query : référentiels |
| useAuditLogs | `useAuditLogs.ts` | React Query : logs d'audit |
| useSort | `useSort.ts` | Tri des colonnes (en-têtes cliquables) |

## Arborescence des fichiers

```
src/
├── pages/
│   ├── DashboardPage.tsx
│   ├── SpacePage.tsx
│   ├── SpaceSettingsPage.tsx
│   ├── SpaceHistoryPage.tsx
│   ├── CommunitySettingsPage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   └── admin/
│       ├── UsersPage.tsx
│       ├── SpacesPage.tsx
│       ├── CommunitiesPage.tsx
│       ├── ReferentielsPage.tsx
│       ├── AnomaliesPage.tsx
│       └── TestsPage.tsx
├── components/
│   ├── Layout.tsx
│   ├── AdminLayout.tsx
│   ├── AdminRoute.tsx
│   ├── ItemEditModal.tsx
│   ├── SelectionActionBar.tsx
│   ├── ViewModeSelector.tsx
│   ├── GlobalSearch.tsx
│   ├── CommunitySelector.tsx
│   ├── MoveToSpaceModal.tsx
│   ├── DuplicateToSpaceModal.tsx
│   ├── UserProfileModal.tsx
│   ├── DevDbStatus.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   └── RichTextEditor.tsx
│   ├── views/
│   │   ├── ListView.tsx
│   │   ├── KanbanView.tsx
│   │   ├── SequenceView.tsx
│   │   ├── TypesView.tsx
│   │   ├── PlanningView.tsx
│   │   ├── TimelineView.tsx
│   │   └── MindMapView.tsx
│   ├── admin/
│   │   ├── UserFormModal.tsx
│   │   └── SpaceDetailModal.tsx
│   ├── audit/
│   │   ├── AuditLogList.tsx
│   │   ├── AuditLogItem.tsx
│   │   ├── AuditLogDetail.tsx
│   │   └── AuditFilters.tsx
│   └── settings/
│       ├── TypeLabelsManager.tsx
│       ├── StatusManager.tsx
│       └── ColorPicker.tsx
├── stores/
│   ├── auth.ts
│   ├── selection.ts
│   ├── viewMode.ts
│   ├── space.ts
│   ├── community.ts
│   └── theme.ts
├── hooks/
│   ├── useItems.ts
│   ├── useSpaces.ts
│   ├── useReferentiels.ts
│   ├── useAuditLogs.ts
│   └── useSort.ts
├── constants/
│   └── ui.ts
└── lib/
    ├── api.ts
    └── utils.ts
```

## Conventions de nommage

- **Pages** : `[Name]Page.tsx` (ex: `DashboardPage.tsx`)
- **Vues** : `[Name]View.tsx` (ex: `ListView.tsx`)
- **Modales** : `[Feature]Modal.tsx` (ex: `ItemEditModal.tsx`)
- **Composants** : PascalCase, pattern `[Feature][Type]` (ex: `AuditLogItem`)

## Librairies UI

- **Icones** : lucide-react
- **Drag & Drop** : @dnd-kit (Kanban, Types, arborescence)
- **Graphes** : ReactFlow (Sequence, MindMap)
- **Rich Text** : TipTap (@tiptap/react, StarterKit, Underline, Link, Placeholder)
- **Styling** : Tailwind CSS
- **State** : Zustand
- **Data fetching** : TanStack React Query
- **Routing** : React Router v6
