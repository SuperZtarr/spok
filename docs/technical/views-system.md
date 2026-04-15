# Systeme de vues

## Les 35 vues (apps/web/src/components/views/)

### Basique
- ListView — liste standard
- TreeView — arborescence (pas de composant dedie, c'est une variante)
- TextView — vue texte
- TypesView — items groupes par type
- MembersKanbanView — kanban par membre
- PriorityView — matrice de priorite
- CrossTableView — tableau croise
- ThreadView — discussions/fils

### Types d'items (filtrees)
- LinksView — items LINK
- ImagesView — items IMAGE
- DocumentsView — items DOCUMENT
- BugsView — items BUG

### Planification
- KanbanView — colonnes par statut, drag & drop
- PlanningView — planification
- TimelineView — Gantt
- CalendarView — calendrier
- BurndownView — burndown chart agile
- CfdView — diagramme de flux cumulatif

### Exploration / visualisation
- MindMapView — carte mentale
- GraphView — graphe force-directed (D3)
- SunburstView — diagramme sunburst
- RelationsMapView — carte des relations
- BubbleView — bulles
- RadialTreeView — arbre radial
- TreemapView — treemap
- ChordView — diagramme d'accords
- HeatmapView — heatmap
- EgoNetworkView — reseau ego

### Globales / dashboard
- HomeView — page d'accueil
- OverviewView — apercu d'espace
- DashboardCockpitView — cockpit
- DashboardMindMapView — mindmap dashboard
- CommunityListView — liste communautes
- OrgChartView — organigramme
- DeadlinesView — echeances

## ViewMode store (stores/viewMode.ts)

```
State : mode (ViewMode), allowedViews (ViewMode[] | null)
Actions : setMode(), setAllowedViews()
Persist : mode dans localStorage['view-mode-storage']
Default : 'tree'
```

VIEWER_ALLOWED_VIEWS = ['overview', 'list', 'kanban', 'timeline', 'mindmap']
→ si role VIEWER, setAllowedViews(VIEWER_ALLOWED_VIEWS)

## ViewModeSelector (components/ViewModeSelector.tsx)

Composant de navigation par vues, responsive :
- Mobile : dropdown unifie
- Desktop : navigation horizontale par categories avec dropdowns au hover

Categories : dashboard, basic, itemTypes, planning, exploration
Chaque vue a : id, label, icon (Lucide), category, order, visible, access

Filtrage par access level :
- public : vues publiques seulement
- user : public + user
- admin mode : toutes

Tour tracking : localStorage['spok-view-tour-done-{mode}'] pour marquer les tours vus (indicateur UnseenDot)

## ViewConfig (packages/shared/src/constants/viewDefaults.ts)

DEFAULT_VIEW_CONFIG : 39 entrees definissant toutes les vues disponibles
DEFAULT_VIEW_CATEGORIES : 5 categories (dashboard, basic, itemTypes, planning, exploration)
DEFAULT_GLOBAL_PAGES : 11 pages globales (home, communities, spaces, search, profile, etc.)

Hook useViewConfig() (hooks/useViewConfig.ts) :
- Query 'view-config' via configApi.getViews
- Fallback sur DEFAULT_VIEW_CONFIG
- Filtre par access level de l'utilisateur
- Cache 5 minutes

Hook useGlobalPages() (hooks/useGlobalPages.ts) :
- Meme logique pour les pages globales

## Fichiers cles
- `apps/web/src/components/views/*.tsx` — composants de vues
- `apps/web/src/components/ViewModeSelector.tsx` — selecteur de vue
- `apps/web/src/stores/viewMode.ts` — store et VIEWER_ALLOWED_VIEWS
- `packages/shared/src/constants/viewDefaults.ts` — configs par defaut
- `packages/shared/src/types/viewConfig.ts` — types ViewConfigItem, ViewCategory, etc.
- `apps/web/src/hooks/useViewConfig.ts` — hook de chargement
- `apps/web/src/hooks/useGlobalPages.ts` — hook pages globales
