# Architecture UI - SPOK

Documentation de la structure et terminologie de l'interface utilisateur.

## Structure principale

```
+----------------------------------------------------------+
|                        Header (h-14)                      |
|  [Titre page] [Badge type] [ViewModeSelector]            |
+------------+---------------------------------------------+
|            |                                             |
|  Sidebar   |              Main Content                   |
|   (w-52)   |               (Outlet)                      |
|            |                                             |
|  - Home    |    [Vue active: List/Kanban/Sequence/Types] |
|  - Spaces  |                                             |
|  - User    |                                             |
|            |                                             |
+------------+---------------------------------------------+
```

## Pages

| Page | Fichier | Route | Description |
|------|---------|-------|-------------|
| Tableau de bord | `DashboardPage.tsx` | `/` | Liste des spaces de l'utilisateur |
| Espace | `SpacePage.tsx` | `/spaces/:id` | Items d'un space avec vues multiples |
| Paramètres | `SpaceSettingsPage.tsx` | `/spaces/:id/settings` | Configuration du space |
| Historique | `SpaceHistoryPage.tsx` | `/spaces/:id/history` | Logs d'audit |
| Login | `LoginPage.tsx` | `/login` | Connexion |
| Register | `RegisterPage.tsx` | `/register` | Inscription |

### Pages Admin

| Page | Fichier | Route |
|------|---------|-------|
| Utilisateurs | `admin/UsersPage.tsx` | `/admin/users` |
| Spaces | `admin/SpacesPage.tsx` | `/admin/spaces` |

## Layouts

### Layout principal (`Layout.tsx`)

- **Sidebar** : Navigation gauche fixe (w-52)
  - Lien Dashboard (icone Home)
  - Liste des spaces (icone FolderKanban)
  - Info utilisateur + déconnexion
  - Lien admin si rôle ADMIN

- **Header** : Barre supérieure sticky (h-14)
  - Titre de la page
  - Badge du type de space
  - `ViewModeSelector` pour changer de vue

- **Outlet** : Zone de contenu scrollable

### Layout Admin (`AdminLayout.tsx`)

Layout spécifique avec sidebar de navigation admin (w-64).

## Modes de vue

Sélectionnables via `ViewModeSelector` dans le header.

| Vue | Fichier | Description |
|-----|---------|-------------|
| Liste | `views/ListView.tsx` | Tableau avec recherche, tri, colonnes |
| Kanban | `views/KanbanView.tsx` | Colonnes par statut, drag & drop |
| Séquence | `views/SequenceView.tsx` | Timeline avec relations hiérarchiques |
| Types | `views/TypesView.tsx` | Colonnes par type d'item, drag & drop |

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

## Composants UI de base

Situés dans `components/ui/`.

| Composant | Fichier | Usage |
|-----------|---------|-------|
| Button | `Button.tsx` | Boutons avec variants (default, destructive, outline, secondary, ghost, link) et tailles (sm, default, lg, icon) |
| Modal | `Modal.tsx` | Fenêtres modales avec backdrop, fermeture Escape |
| Badge | `Badge.tsx` | Étiquettes pour types et statuts |
| Card | `Card.tsx` | Conteneurs (CardHeader, CardContent, CardTitle, CardDescription) |
| Input | `Input.tsx` | Champs de saisie texte |
| Select | `Select.tsx` | Listes déroulantes |

## Modales

| Modale | Fichier | Usage |
|--------|---------|-------|
| Édition item | `ItemEditModal.tsx` | Créer/modifier un item (titre, description, URL, parent, statut, type, dates) |
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

Boutons toggle pour basculer entre les modes de vue (List, Kanban, Sequence, Types).

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

## Arborescence des fichiers

```
src/
├── pages/
│   ├── DashboardPage.tsx
│   ├── SpacePage.tsx
│   ├── SpaceSettingsPage.tsx
│   ├── SpaceHistoryPage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   └── admin/
│       ├── UsersPage.tsx
│       └── SpacesPage.tsx
├── components/
│   ├── Layout.tsx
│   ├── AdminLayout.tsx
│   ├── AdminRoute.tsx
│   ├── ItemEditModal.tsx
│   ├── SelectionActionBar.tsx
│   ├── ViewModeSelector.tsx
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
│   │   └── Select.tsx
│   ├── views/
│   │   ├── ListView.tsx
│   │   ├── KanbanView.tsx
│   │   ├── SequenceView.tsx
│   │   └── TypesView.tsx
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
│   └── space.ts
├── constants/
│   └── ui.ts
├── lib/
│   ├── api.ts
│   └── utils.ts
└── hooks/
    └── (custom hooks)
```

## Conventions de nommage

- **Pages** : `[Name]Page.tsx` (ex: `DashboardPage.tsx`)
- **Vues** : `[Name]View.tsx` (ex: `ListView.tsx`)
- **Modales** : `[Feature]Modal.tsx` (ex: `ItemEditModal.tsx`)
- **Composants** : PascalCase, pattern `[Feature][Type]` (ex: `AuditLogItem`)

## Librairies UI

- **Icones** : lucide-react
- **Drag & Drop** : @dnd-kit
- **Styling** : Tailwind CSS
- **State** : Zustand
- **Data fetching** : TanStack React Query
- **Routing** : React Router v6

