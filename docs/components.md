# SPOK - Cartographie des composants

## Structure

```
apps/web/src/
├── components/
│   ├── views/          # 8 vues de visualisation des items
│   ├── ui/             # Composants UI réutilisables
│   ├── admin/          # Modales admin
│   ├── audit/          # Composants d'historique
│   └── settings/       # Gestion des référentiels
├── pages/              # Pages (routes)
├── stores/             # State management (Zustand)
├── constants/          # Constantes UI
├── hooks/              # Hooks React custom
└── lib/                # Utilitaires & client API

apps/api/src/
├── routes/             # Routes Fastify
│   └── admin/          # Routes admin
├── plugins/            # Plugins Fastify (prisma, jwt, adminAuth)
└── index.ts            # Point d'entrée, enregistrement routes

packages/
├── database/           # Prisma schema + client
└── shared/             # Types et constantes partagés
```

---

## Layout principal

### `App.tsx` — Routeur
Routes publiques : `/login`, `/register`, `/forgot-password`, `/reset-password`
Routes protégées (dans `Layout`) :
- `/` — Dashboard
- `/spaces/:spaceId` — Vue espace
- `/spaces/:spaceId/settings` — Paramètres espace
- `/spaces/:spaceId/history` — Historique espace
- `/communities/:communityId/settings` — Paramètres communauté
- `/admin/*` — Panel admin (ADMIN only)

### `components/Layout.tsx` — Structure de l'application
- Sidebar responsive (redimensionnable desktop, slide-over mobile)
- Navigation espaces groupés par type (personnel / communauté)
- Header : titre page, recherche globale, sélecteur de vue
- Profil utilisateur, lien admin, déconnexion

---

## Composants principaux

| Fichier | Composant | Description |
|---------|-----------|-------------|
| `Layout.tsx` | `Layout` | Wrapper principal : sidebar + header + contenu |
| `AdminLayout.tsx` | `AdminLayout` | Layout admin : sidebar nav + outlet |
| `AdminRoute.tsx` | `AdminRoute` | Guard route admin (redirige si non-ADMIN) |
| `ViewModeSelector.tsx` | `ViewModeSelector` | Boutons de sélection de vue (8 modes) |
| `CommunitySelector.tsx` | `CommunitySelector` | Dropdown sélection communauté |
| `GlobalSearch.tsx` | `GlobalSearch` | Recherche cross-espaces (items + contributions) |
| `ItemEditModal.tsx` | `ItemEditModal` | Formulaire item complet (titre, description, type, statut, parent, dates, contributions, relations). Composant le plus complexe. |
| `UserProfileModal.tsx` | `UserProfileModal` | Profil utilisateur (avatar, nom, email, mot de passe, thème) |
| `MoveToSpaceModal.tsx` | `MoveToSpaceModal` | Déplacement groupé d'items vers un autre espace |
| `DuplicateToSpaceModal.tsx` | `DuplicateToSpaceModal` | Duplication groupée d'items |
| `SelectionActionBar.tsx` | `SelectionActionBar` | Barre d'actions flottante pour opérations groupées |
| `DevDbStatus.tsx` | `DevModeToggle`, `DevDbStatus` | Toggle mode dev + health check API |

---

## Composants UI (`components/ui/`)

| Fichier | Composant | Props clés |
|---------|-----------|------------|
| `Button.tsx` | `Button` | `variant` (default/outline/ghost/secondary), `size` (sm/md/lg) |
| `Input.tsx` | `Input` | Props HTML standard |
| `Modal.tsx` | `Modal` | `isOpen`, `onClose`, `title`, `size` (sm/md/lg/large) |
| `Badge.tsx` | `Badge` | `variant` (default/outline/secondary) |
| `Select.tsx` | `Select` | `value`, `onChange`, `options` |
| `RichTextEditor.tsx` | `RichTextEditor` | `content`, `onChange`, `editable`, `placeholder` |

---

## Vues (`components/views/`)

Toutes les vues partagent une interface commune :
```typescript
{
  items: ItemWithRelations[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}
```

| Fichier | Vue | Description |
|---------|-----|-------------|
| `ListView.tsx` | Liste | Tableau colonné avec en-tête sticky, recherche, actions par ligne |
| `KanbanView.tsx` | Kanban | Colonnes par statut, drag-and-drop pour changer le statut |
| `TypesView.tsx` | Types | Colonnes par type d'item, drag-and-drop pour changer le type |
| `MindMapView.tsx` | Carte mentale | Layout radial (ReactFlow), relations, portails, blocs projet, drag-and-drop |
| `SequenceView.tsx` | Séquence | Flux horizontal de dépendances, tri topologique, création de relations |
| `PlanningView.tsx` | Planning | Items groupés par période (en retard, aujourd'hui, cette semaine, ce mois, plus tard) |
| `TimelineView.tsx` | Gantt | Timeline avec barres redimensionnables, zoom, flèches de dépendance |
| `TreeView.tsx` | Arborescence | Vue hiérarchique en arbre |

---

## Pages (`pages/`)

| Fichier | Route | Description |
|---------|-------|-------------|
| `LoginPage.tsx` | `/login` | Connexion |
| `RegisterPage.tsx` | `/register` | Inscription |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Demande de réinitialisation |
| `ResetPasswordPage.tsx` | `/reset-password` | Réinitialisation mot de passe (via token) |
| `DashboardPage.tsx` | `/` | Page d'accueil, liste des espaces |
| `SpacePage.tsx` | `/spaces/:spaceId` | Vue espace (gère CRUD items, sélection de vue, opérations groupées) |
| `SpaceSettingsPage.tsx` | `/spaces/:spaceId/settings` | Paramètres espace (nom, membres, référentiels) |
| `SpaceHistoryPage.tsx` | `/spaces/:spaceId/history` | Historique d'audit |
| `CommunitySettingsPage.tsx` | `/communities/:id/settings` | Paramètres communauté |

### Pages admin (`pages/admin/`)

| Fichier | Route | Description |
|---------|-------|-------------|
| `UsersPage.tsx` | `/admin/users` | Liste/gestion utilisateurs |
| `SpacesPage.tsx` | `/admin/spaces` | Liste tous les espaces |
| `CommunitiesPage.tsx` | `/admin/communities` | Liste toutes les communautés |
| `AnomaliesPage.tsx` | `/admin/anomalies` | 12 contrôles de qualité des données |
| `ReferentielsPage.tsx` | `/admin/referentiels` | Consultation référentiels par défaut |
| `TestsPage.tsx` | `/admin/tests` | Tests de non-régression (21 tests) |

---

## Stores Zustand (`stores/`)

| Fichier | Store | State | Actions principales |
|---------|-------|-------|---------------------|
| `auth.ts` | `useAuthStore` | `user`, `accessToken`, `isAuthenticated` | `setAuth`, `logout`, `updateUser` |
| `community.ts` | `useCommunityStore` | `currentCommunity` | `setCurrentCommunity` |
| `space.ts` | `useSpaceStore` | `currentSpace` | `setCurrentSpace` |
| `selection.ts` | `useSelectionStore` | `selectedIds`, `isSelectionMode` | `toggleSelection`, `selectAll`, `clearSelection` |
| `theme.ts` | `useThemeStore` | `theme` (light/dark) | `setTheme`, `initTheme` |
| `viewMode.ts` | `useViewModeStore` | `mode` | `setMode` |

Modes de vue : `list`, `tree`, `sequence`, `mindmap`, `kanban`, `types`, `timeline`, `planning`

---

## Composants settings, audit, admin

### Settings (`components/settings/`)
| Fichier | Description |
|---------|-------------|
| `StatusManager.tsx` | CRUD + réordonnancement des statuts |
| `TypeLabelsManager.tsx` | Labels, couleurs, visibilité des types |
| `ColorPicker.tsx` | Sélecteur de couleur |

### Audit (`components/audit/`)
| Fichier | Description |
|---------|-------------|
| `AuditLogList.tsx` | Liste paginée des entrées d'audit |
| `AuditLogItem.tsx` | Affichage d'une entrée |
| `AuditLogDetail.tsx` | Détail étendu d'une action |
| `AuditFilters.tsx` | Filtres (action, utilisateur, dates) |

### Admin modales (`components/admin/`)
| Fichier | Description |
|---------|-------------|
| `UserDetailModal.tsx` | Détail/édition utilisateur |
| `SpaceDetailModal.tsx` | Détail espace |
| `CommunityDetailModal.tsx` | Détail communauté |

---

## Constantes (`constants/ui.ts`)

| Constante | Description |
|-----------|-------------|
| `TYPE_ICONS` | Mapping type → icône Lucide |
| `TYPE_LABELS` / `TYPE_LABELS_SHORT` | Labels des types (FR) |
| `STATUS_LABELS` / `STATUS_COLORS` | Labels et couleurs des statuts |
| `KANBAN_COLUMNS` / `TYPE_COLUMNS` | Configuration des colonnes Kanban |
| `getTypeColor(type)` | Retourne `{ color, bgHover }` pour un type |
| `getTypeTextColor(type)` | Retourne la classe texte Tailwind |

---

## API — Routes principales

### Auth (`/auth`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/register` | Inscription (crée espace personnel) |
| POST | `/login` | Connexion |
| POST | `/refresh` | Renouvellement token |
| GET | `/me` | Utilisateur courant |
| POST | `/logout` | Déconnexion |
| POST | `/forgot-password` | Demande reset mot de passe |
| POST | `/reset-password` | Reset avec token |

### Espaces (`/spaces`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste des espaces de l'utilisateur |
| POST | `/` | Créer un espace |
| GET | `/:id` | Détail espace |
| PATCH | `/:id` | Modifier espace (OWNER/ADMIN) |
| DELETE | `/:id` | Supprimer espace (OWNER) |
| POST | `/:id/join` | Rejoindre un espace communautaire |
| GET/POST | `/:id/members` | Membres + invitation |

### Items (`/spaces/:spaceId/items`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste items (paginée, filtrable) |
| POST | `/` | Créer item (MEMBER+) |
| GET | `/:id` | Détail item avec enfants, relations, contributions |
| PATCH | `/:id` | Modifier item |
| DELETE | `/:id` | Supprimer item |
| POST | `/:id/relations` | Créer relation |
| DELETE | `/:id/relations/:rid` | Supprimer relation |
| PATCH | `/:id/move` | Déplacer item |
| POST | `/bulk-move` | Déplacement groupé |
| POST | `/bulk-duplicate` | Duplication groupée |
| GET/POST | `/:id/contributions` | Contributions |
| PATCH/DELETE | `/:id/contributions/:cid` | Modifier/supprimer contribution |

### Autres routes
| Préfixe | Description |
|---------|-------------|
| `/communities` | CRUD communautés + membres |
| `/search` | Recherche globale (items + contributions) |
| `/user` | Profil, préférences, avatar, mot de passe |
| `/admin/*` | Users, Spaces, Communities, Anomalies, Référentiels, Tests |
| `/health` | Health check |

### Contrôle d'accès
- **Global** : USER → ADMIN
- **Espace** : VIEWER → MEMBER → ADMIN → OWNER
- **Communauté** : MEMBER → ADMIN → OWNER
- VIEWER = lecture seule, MEMBER+ = CRUD items
