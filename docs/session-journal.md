# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## EN COURS — 2026-06-17

### Gantt — scrollbar navigation + positionnement aujourd'hui
- `TimelineView.tsx` + `index.css` : barre de défilement horizontale en bas (±3 ans, thumb proportionnel au zoom)
- `TimelineView.tsx` : aujourd'hui positionné au 1/4 gauche (init + bouton Aujourd'hui)

### À faire ensuite
- Affiner specs mode Forum/Projet/Exploration (étapes 3-5)
- Didacticiels : thread (pas de tour), text (tour vide)
- Gantt : root drop zone + grip toujours visible (universalisation treeview)

## HISTORIQUE — 2026-06-07

### PertToolbar migré sur ViewToolbar + fixes count
- `ViewToolbar.tsx` : slots `extraControls` + `customExport` pour injection de contrôles spécifiques
- `PertToolbar.tsx` : migré sur `ViewToolbar`, ne garde que les contrôles PERT (bloquants, zoom, sortMode, export SVG)
- `FilterToolbar.tsx` : count `X/Y` affiché dès que `filteredItemCount !== totalItemCount` (couvre filtre bloquants PERT)
- `PertView.tsx` : `filteredItemCount={showOnlyBlocking ? sortedItems.length : undefined}`

## HISTORIQUE — 2026-06-01

### Tri arborescence multi-vues + filtre MindMap
- `lib/treeSort.ts` : utilitaire partagé (TreeSort, sortTreeAlpha, applyTreeSort)
- `ui/TreeSortButton.tsx` : composant dropdown partagé
- `ListView.tsx` : refactorisé vers composants partagés
- `ThreadView.tsx`, `TimelineView.tsx`, `PertView.tsx`, `PertToolbar.tsx`, `SpacePage.tsx` : bouton tri ajouté
- `MindMapView.tsx` : bouton Filtrer local (type/statut) dans Panel top-left, priorité sur props SpaceToolbar

### Corrections diverses vues (en cours)
- `exportUtils.ts` : export SVG PERT via canvas (data URI, inlining styles, remplacement foreignObject)
- `SpacePage.tsx` : fix DnD arborescence (rootItemsList → rootItems)
- `ListView.tsx` : tri arborescence (manual/alpha-flat/alpha-tree), toolbar sticky
- `PertToolbar.tsx` : sticky top-0
- `PertView.tsx` : toggle tri rank/alpha, svgRef pour export, tooltip titre nœuds
- `TreeItemRow.tsx` : tooltip titre tronqué

## HISTORIQUE — 2026-06-01

### Fix PERT export + tri alpha + fix ListView
- `ExportDropdownButton.tsx` : dropdown via `createPortal` → corrige position hors écran
- `PertToolbar.tsx` + `PertView.tsx` : toggle tri dépendances / alphabétique
- `ListView.tsx` : fix crash `parentNames` utilisé avant initialisation

## HISTORIQUE — 2026-05-31

### Refactor toolbars par vue + export unifié (dba38db)
- `PertToolbar.tsx` : zoom + collapse + ExportDropdownButton (PDF data, PNG, PDF visuel)
- `TimelineView` : collapse/expand + ExportDropdownButton (CSV, Excel, PDF, PNG) dans toolbar interne
- `MindMapView` : boutons dans Panel RF (collapse, réorganiser, tout voir, ExportDropdownButton PNG+PDF schéma)
- `CollapseToggleButton` + `ExportDropdownButton` : composants partagés
- `exportUtils.ts` : fonctions d'export centralisées
- `SpaceToolbar` : ne garde que search/filtres/sélecteur/nouveau
- Fix icône commentaire relation : `setQueryData` optimiste sur create/update relation
- Fix MindMap fitView : ne recentre plus après interaction utilisateur
- Fix NotificationBell z-index

## HISTORIQUE — 2026-05-26

### Dashboard : panneau "Assignés à moi"
- `MyDashboardView.tsx` : dérivé `assignedTasks` depuis `allTasks` (assignedToId === user.id), panneau dans colonne droite après Aujourd'hui

### Fix bugs dashboard + auth returnTo
- `DeadlinesView.tsx` : prop `filters?` optionnelle — quand embedded, utilise les filtres du parent au lieu de sa propre instance
- `MyDashboardView.tsx` : passe `filters` à `<DeadlinesView embedded filters={filters} />`
- `LoginPage.tsx` : bandeau "Vous serez redirigé vers [page]" si `spok_returnTo` en sessionStorage

### Fix dropdowns header (NotificationBell + GlobalSearch)
- `Layout.tsx` : retiré `overflow-hidden` du Row 1 header — clipait les dropdowns absolus

### Vue PERT : tri automatique par rang de dépendance
- `timeline-tree.ts` : `buildTree` accepte un `sortFn` optionnel (fallback tri par `position`)
- `PertView.tsx` : `pertSortFn` (rang ASC, titre alpha ASC) passé à `buildTree` — tri local/temporaire, sans impact sur les autres vues
- `pert-utils.test.ts` : 4 nouveaux tests (chaîne linéaire, alpha, rang+alpha, hiérarchie)

## HISTORIQUE — 2026-05-22

### Relations proxies sur nœud replié — PERT
- `PertView.tsx` : `parentMap` + `effectiveRelations` useMemo — résout chaque endpoint vers son ancêtre visible, déduplique, filtre les self-loops
- Flèches proxies affichées en pointillés (`strokeDasharray`), non cliquables
- Chemin critique désactivé sur les flèches proxies

### Dialog édition relation — Gantt + PERT (0e89e3c) — poussé en prod
- `TimelineView.tsx` : clic sur flèche → dialog modifier/supprimer (remplace ConfirmModal delete-only), prop `onUpdateRelation` ajoutée
- `PertView.tsx` : idem, path SVG transparent cliquable dans `renderArrow`, dialog avec PERT_RELATION_TYPES (blocks/depends)
- `SpacePage.tsx` : `onUpdateRelation` câblé à TimelineView, `onDeleteRelation` + `onUpdateRelation` câblés à PertView

### Vue PERT + refactor VIEW_REGISTRY (c020256, 967716f) — poussé en prod
- `packages/shared/src/constants/viewRegistry.ts` : source unique pour les 30 vues — plus besoin de toucher N fichiers pour ajouter une vue
- `viewDefaults.ts` + `menuDefaults.ts` + `viewMode.ts` : régénérés depuis VIEW_REGISTRY
- `apps/web/src/constants/viewIcons.ts` : map icônes centralisée (remplace ICONS dans ViewModeSelector et VIEW_ICON_MAP dans Layout)
- `PertView.tsx` : création de liens par glisser-déposer (comme Gantt), handle SVG sur bord droit, détection target par containment rect
- **MCP doc bloquée** : `mcp__spok__list_spaces` retourne vide, `get_space` retourne 404 — auth ztarr ne fonctionne plus (seules communautés publiques accessibles), doc SPOK à créer manuellement
- Fix build prod : `Gauge` et `Home` retirés des imports inutilisés dans `ViewModeSelector.tsx` (TS6133)

### Restauration item après reconnexion (d4291a6)
- `SpacePage` : sync bidirectionnelle `editingItemId ↔ ?item=` — param maintenu dans l'URL pendant toute l'ouverture de la modale
- `App.tsx` : au moment du `auth:logout`, sauvegarde `window.location.href` dans `sessionStorage('spok_returnTo')`
- `LoginPage` : après connexion réussie, lit `spok_returnTo` dans sessionStorage et redirige là (puis efface)
- Multi-onglets OK : sessionStorage est isolé par onglet

## HISTORIQUE — 2026-05-16

### Vue Doublons admin (9e6828b, 7e44f08, 6eda6f2, aad0904, 08cdeee)
- `GET /admin/duplicates` : détection par titre normalisé (LOWER/TRIM/REGEXP), URL (LINK), nom de fichier (IMAGE/DOCUMENT)
- Fil d'ariane : 2 niveaux de parents via LEFT JOIN (grandparent + parent)
- `DuplicatesPage` : tabs Tous/Titre/URL/Fichier, groupes de cartes scrollables horizontalement, breadcrumb Communauté > Espace > ancêtres
- Entrée menu admin "Doublons" avec icône Copy
- Fix build : variable `idx` inutilisée supprimée (TS6133, bloquait le build prod)

### Fix scrollbar vues à colonnes (bbeb926)
- `SpacePage` view container : ajout `kanban`, `members`, `types`, `priority` dans la liste `overflow-hidden flex flex-col`
- Sans ça, l'overflow horizontal remontait jusqu'au `overflow-hidden` de SpacePage et les colonnes de droite étaient coupées sans scrollbar

## HISTORIQUE — 2026-05-10

### MCP : fix description items doc (b460cfc, a900086)
- `create_item` / `update_item` : `body.description = textToHtml()` au lieu de `body.content = textToTiptap()`
- Nouveau `textToHtml()` : texte brut → `<p>...</p>` avec échappement HTML
- `extractText()` : gère HTML (strip tags) + join paragraphes avec `\n`
- Script migration `fix-mcp-descriptions.ts` : 253 items prod corrigés (TipTap JSON → HTML propre)
- Hooks PreToolUse : codage bloqué sans flag, git push bloqué sans flag
- Skill spok-start révisée : ouverture Chrome via PowerShell avant plugin

### Refonte tableau de bord (de8b44d)
- Suppression `DashboardCockpitView` (code mort)
- Renommage `MyOrganizationView` → `MyDashboardView`
- Déplacement section Échéances avant Semaine
- Layout horizontal : Échéances (flex-1, max-w-4xl) + Priorités/Retard/Aujourd'hui (w-72) + Répartitions/Progression (w-64)
- `flex-wrap` + `min-w-[320px]` pour le responsive
- `DeadlinesView` : colonnes espace/statut/priorité masquées sur mobile (`hidden sm:`)
- `UserProfileModal` : boutons logout et thème sans largeur forcée

### Navigation sticky entre espaces + indicateur vue par défaut (95c5dd4)
- `SpacePage` : priorité vue = `?view=URL > viewMode store > space.defaultView > list`
- `SpaceToolbar` : point pulsé (`animate-pulse`) sur bouton vue par défaut quand on n'y est pas
- `Layout` : nav mobile compactée en grille 4 colonnes (icône + label, sans en-têtes de section)

## HISTORIQUE — 2026-05-06

### Chemin critique Gantt — terminé (abe7f75)
- Algo CPM (forward/backward pass, Kahn topo sort) dans `timeline-utils.ts`
- Toggle GitBranch dans toolbar Gantt, barres critiques `ring-2 ring-red-500`
- Fix build prod : `NEW_USER` manquant dans Records de `NotificationBell.tsx` et `UserProfileModal.tsx` (88a3d5d)

### Diagramme — auto-save XML (4b32983)
- `ItemEditModal.tsx` : `autoSaveDiagramMutation` + debounce 2s sur `diagramXml`
- Déclenché uniquement si `type === 'DIAGRAM'` et item existant
- Invalide uniquement `['items', spaceId]` — pas de réinit du form

### MCP fix (4b32983)
- `apps/mcp/src/index.ts` : `body.description` → `body.content` lors d'update item

## HISTORIQUE — 2026-05-04

### MEETING — TimeRangePicker (plage horaire draggable)
- Nouveau composant `TimeRangePicker.tsx` : timeline 7h–22h, snap 15 min, 3 modes drag (start/end/move)
- Intégré dans `ItemEditModal.tsx` section dates, uniquement pour `type === 'MEETING'`
- `handleTimeRangeChange` : met à jour startDate/endDate en gardant la date, changeant l'heure
- Synchronisation bidirectionnelle avec les DateTimeField existants

### Menu contextuel — Modifier le statut avec sous-menu
- `ItemActionMenu` : ajout `submenu?: ItemAction[]` + `checked?: boolean` + rendu sous-menu portal (z-index 100000)
- `itemMenuGroups` : `statusAction` remplacé par `statusOptions + currentStatusId` → entrée "Modifier le statut" avec sous-menu listant tous les statuts visibles, statut courant coché
- 12 vues mises à jour : ListView, TimelineView, KanbanView, PlanningView, TextView, ImagesView, DocumentsView, LinksView, MindMapView, mindmap-nodes, mindmap-layout, space-tree-view
- KanbanView : suppression de la logique `nextStatusMap` / `nextStatus` / `nextStatusLabel`
- ImagesView/DocumentsView : correction du calcul bugué de `doneStatusId` (utilisait `statusLabels` au lieu de `statuses`)

## HISTORIQUE — 2026-05-01

### Gantt — timeline adaptive + centrage aujourd'hui + persistance vue
- TimelineView : ResizeObserver → containerWidth, visibleDays = floor((w-288)/dayWidth)
- centerDate (état) remplace visibleStartDate : visibleStartDate = centerDate - visibleDays/2 (useMemo)
- Redimensionnement : visibleDays change → visibleStartDate recalculé, aujourd'hui reste centré
- goToToday : setCenterDate(today) → recentre instantanément
- overflow-x-hidden + suppression min-w-max : grille remplit l'espace, pas de scrollbar horizontal
- Tooltip `title` sur les titres tronqués de la colonne gauche
- SpacePage : ?view=X dans l'URL (replace) — persist la vue sur refresh
  - viewReadyRef empêche le sync URL prématuré avant application du defaultView
  - defaultView effect lit searchParams.get('view') en priorité sur space.defaultView

## HISTORIQUE — 2026-04-30

### Responsive mobile — livré (c3ba19f)
- SpacePage : px-0 mobile, px-4 desktop
- SpaceToolbar : toggle filtres mobile (SlidersHorizontal), vues complexes masquées (kanban, types, members, timeline, graph…), mindmap gardé
- ListView : icône ℹ par ligne (statut, type, priorité, dates, parent), statut masqué de la grille mobile
- ThreadView : lastActivity + contribCount masqués mobile, métadonnées non-wrappantes
- ItemEditModal : header compact mobile
- Layout : sidebar 85vw, nav mobile avec sections/icônes
- HomeView, CommunityPage, SpaceExportButton, SpaceToolbar "Nouveau" : labels masqués mobile

## HISTORIQUE — 2026-04-29

### Menu contextuel — terminé (c6af110)
- 5 groupes : Ouvrir (Ouvrir / Ouvrir dans un nouvel onglet) / Modifier (Modifier, Absorber, Éclater, Fusionner) / [sep] M'assigner, Marquer terminé, Déplacer / Ajouter (Ajouter un enfant, Dupliquer) / Autres (Convertir en espace, Supprimer)
- onOpen (navigate onglet actuel) propagé dans 17 vues + SpacePage + space-tree-view
- space-tree-view migré vers buildItemMenuGroups

### Vignette utilisateur + toggles admin/dev (9c271cc 2026-04-29)
- Header : icône user → vignette nom+avatar
- Sidebar footer : suppression vignette
- UserProfileModal : AdminModeToggle + DevModeToggle + DevDbStatus déplacés

### Contributions non lues + viewedAt (2026-04-28)
- API items : isUnseen boolean → viewedAt (string|null), exposé seulement si updatedByOther+recent — ac493b3
- Fix : viewedAt omis (undefined) si non pertinent → évite clignotement de tous les items — ac493b3
- API item-contributions POST : touch item.updatedAt+updatedById au moment de créer une contribution
- shared type Item : isUnseen → viewedAt
- ListView, KanbanView, MindMap, TimelineView : isUnseen calculé depuis viewedAt (urgent rouge prime sur bleu)
- ItemEditModal : snapshot viewedAt avant ouverture (ref), contributions nouvelles surlignées en bleu + badge "Nouveau"
- Boutons modales : variant outline → bordered sur tous les Annuler/Fermer (13 modales) — ac493b3
- Doc SPOK mise à jour : En-tête, Vues, SpacePage, ItemEditModal (to_validate)

### PWA icône écran d'accueil (2026-04-28)
- icon-512.png régénéré depuis icon-192.png (hub design)
- sw.js : CACHE_NAME spok-v1 → spok-v2 (force invalidation cache sur téléphone)

### Navigation espaces → defaultView (2026-04-28)
- SpacePage useEffect : suppression garde `!space.defaultView` → toujours appliquer la vue (fallback 'list')
- CommunityPage : suppression `onClick={() => setMode('overview')}` sur SpaceCards (écrasait le defaultView)
- HomeView : SpaceCard `to` changé de `/spaces/:id/overview` → `/spaces/:id` (applique defaultView via SpacePage)

### Refonte header — GlobalNavBar (2026-04-28)
- Header 2 lignes : ligne 1 (h-12) titre + recherche + notifs + bouton profil ; ligne 2 barre de nav globale
- GlobalNavBar.tsx : boutons groupés par section (Global / Personnel / Administration) — même style visuel que SpaceToolbar
- MainMenu.tsx : retiré du Layout (conservé dans le projet mais non utilisé)
- Sections exclues : basic/itemTypes/planning/exploration (restent dans SpaceToolbar) + misc (logout/search/profile gérés ailleurs)
- Badge activité sur le bouton Activité ; admin en rouge uniquement si adminMode actif

### Composants cards + items non lus (2026-04-28)
- Statuts : Non défini=indigo, Annulé=rose, fix lookup '' → 'undefined' dans buildStatusColorMap/LabelMap
- Button : variant `bordered` (border-gray-400 + bg-secondary)
- CommunityCard.tsx + CommunityBanner : composants réutilisables extraits de CommunityListView
- ItemCard.tsx : composant réutilisable extrait de ActivityPage
- ActivityPage : utilise CommunityCard + SpaceCard + ItemCard, hiérarchie communauté > espaces > sous-espaces > items
- API activity : sous-espaces nestés (parentId), grouping community > espace racine > children
- API items : champ isUnseen calculé depuis ItemView (updatedAt vs viewedAt)
- isUnseen : animation unseen-blink bleue dans ListView, KanbanView, MindMap, TimelineView (urgent rouge prime)

### Documentation interfaces (session précédente)
- Espace Structure : 25 items documentés (Sidebar×7, Header×6, Zone principale×6, Sécurité & Accès×4 + 1 BUG inchangé)
- Espace Administration : nettoyage (14 annulés, 6 remontés à la racine) + 11 pages documentées + ViewsConfigPage, ApiDocPage, PerfPage créés
- Espace Modales & Overlays : 23 NOTEs vides annulés, CommunityDetailModal + SpaceDetailModal réécrits, StatusPropagationModal créé, 73 items passés à to_validate
- docs/technical/ : 6 fichiers supprimés (items-system, menu-system, auth-permissions, notifications, spaces-communities, views-system) + dossier supprimé
- CommunitySettingsPage : onglet Tags dédié (déplacé depuis Général)
- MCP extractText : fix récursif (bullet lists) + parsing JSON string — rebuild MCP
- CLAUDE.md global : ajout règle "une seule question à la fois"
- Espace Communautés : CommunityPage + sous-items, CommunitiesListPage + sous-items, CommunitySettingsPage + 7 onglets, ConfirmModal, CommunityDeleteConfirmModal
- Espace Espaces : SpaceOverviewPage + 5 sous-items, SpacePage + 6 sous-items, SpaceSettingsPage + 4 onglets, SpaceHistoryPage, Barre d'outils [SpaceToolbar] + 2 sous-items, Vues (5 sections + 30 items vue), item "Pages" + 6 sous-items annulés (doublons vides)
- Espace Items : Item [Item] + 3 sous-items, ItemEditModal + 5 sous-items (+ 28 sous-sous-items), ItemActionMenu + 15 actions, MergeItemModal
- Espace Pages publiques : 8 pages documentées (Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Invitation, Landing, Sitemap)
- Espace Pages utilisateur : 8 pages documentées (Accueil, Recherche, Dashboard, SpacesList, Graphe, Tâches, Sunburst, MindMap)

### Organisation documentation (session précédente)
- Objectif : doc SPOK = spec d'intention, consultée avant de coder (règle ajoutée dans CLAUDE.md)
- CONFIG.md désindexé de git (credentials) — 4f4f428
- CLAUDE.md + spok-doc skill restructurés — 9357e8b
- Template item de spec défini (Intention / Décisions de design / Comportements attendus / Contraintes / Fichiers)
- docs/technical/ et docs/specs/ : contenu différent, à évaluer puis migrer dans SPOK avant suppression
- Descriptions mises à jour sur 3 espaces prod (Projet SPOK, Produit SPOK, Contexte)
- 101 NOTEs supprimées de "Projet SPOK" (IMAGEs conservées), 13 items supprimés de "Produit SPOK"
- Restructuration hiérarchie doc : création "Fonctionnement structurel" + "Interfaces" sous Projet SPOK
- 12 espaces déplacés dans les bons groupes parents
- "Produit - SPOK" supprimé (vide, sans usage)
- MCP get_space : limite par défaut 50 → 200
- skill spok-doc mise à jour (IDs parents, hiérarchie)

## EN COURS — 2026-04-25

- Vue par défaut par espace : champ defaultView sur Space (Prisma + API + type shared + SpaceSettingsPage dropdown + SpacePage apply on entry) — ef8e463
- ListView responsive : grid par breakpoints, titre toujours visible — 9c81421
- MindMap dark mode : background dots adaptatif — 9c81421
- Admin audit logs : colonne entityId + titre (changes.before/after.title)
- Menu contextuel : option canEdit dans buildItemMenuGroups, gates write callbacks, VIEWER/MEMBER voient edit+openInNewTab seulement
- SpaceContentRedirect : useLocation().search préservé dans Navigate
- Toolbar espace : ligne de boutons de vues par section (useMenuItems().spaceViews), filtrés par allowedViews VIEWER, labels de section
- SpaceBreadcrumb supprimé de SpacePage (composant créé mais non utilisé)

## EN COURS — 2026-04-24

- MindMap dark mode : background dots adaptatif (hidden dark:block avec couleur slate-700)
- ListView responsive : grid par breakpoints, titre toujours visible, colonnes masquées progressivement
- TS warnings corrigés : Plus inutilisé, getItemUpdatedAt manquant, onOpenInNewTab non utilisé
- Commit 9c81421 pushé → prod Railway

## EN COURS — 2026-04-24 (précédent)

- Bugs UX corrigés : sidebar toggle z-index (z-[60]→z-30), dark mode textes noirs sidebar (text-black→text-foreground), favicon MindMap (Google→DuckDuckGo), logout redirect vers /login, recherche responsive (w-20 sm:w-28 md:w-40 lg:w-56), 409 sur inline update (suppression updatedAt), ouvrir item dans nouvel onglet (menu contextuel + ?item= param)
- CLAUDE.md : ajout règle interdiction appel API prod

## EN COURS — 2026-04-22 (suite)

- Fix accès communautés publiques pour non-membres (isPublic ignoré dans 3 endpoints) :
  - communities GET /:id : isPublic || visibility !== PRIVATE
  - communities GET /:id/members : même logique
  - spaces GET / : même logique (bug && → || en plus)
  - items checkSpaceAccess : même logique
- R2 CORS : corrigé dans Cloudflare (pointait vers localhost:3000)
- Auth flows : pre-fill email login→forgot-password, auto-login après reset-password
- Inscription : contrôle pseudo déjà utilisé (insensible casse)
- SpaceOverviewPage : route /spaces/:id/overview enregistrée, liens depuis HomeView + MainMenu

## EN COURS — 2026-04-22

- RichTextEditor : BubbleMenu tableaux (ajouter/supprimer lignes+colonnes, supprimer tableau) + CSS column-resize-handle (TipTap v3 @floating-ui)
- Bouton déconnexion déplacé : retiré du menu header (MainMenu), ajouté en bas de la modale profil (UserProfileModal)
- GlobalTasksPage + MyOrganizationView : filtre myTasks (créé par OU assigné à moi) activé par défaut
- API user-tasks.ts : ajout filtre myTasks (OR createdById/assignedToId), updatedAfter, updatedAt dans validSortBy
- HomeView : section communautés avec badge d'activité récente (items modifiés les 7 derniers jours par communauté)
  - Illustration communauté : fallback avatarUrl || coverUrl (fix)
  - Confirmé fonctionnel visuellement

## EN COURS — 2026-04-21

- Permissions items par ownership : OWNER peut éditer/supprimer tous les items, MEMBER uniquement les siens
  - API : items.ts PATCH+DELETE, item-move.ts move+bulk-move → check `createdById !== userId` pour MEMBER
  - Frontend : `canEditItem` function dans SpacePage, propagée à 13 vues (ListView, KanbanView, TimelineView, PlanningView, TextView, TypesView, ThreadView, PriorityView, MembersKanbanView, LinksView, ImagesView, DocumentsView, MindMapView/mindmap-layout)
- CommunitySettingsPage onglet Espaces : colonne Propriétaire ajoutée (API spaces.ts + type SpaceWithRole + frontend)

## EN COURS — 2026-04-19

- CommunitySettingsPage onglet Espaces : remplacé drag-drop cards par table admin-style (search, colonnes Nom/Type/Membres/Items/Créé/Supprimer, hiérarchie via indentation, drag-drop conservé, SpaceDeleteConfirmModal ajouté)
- Colonnes supprimées vs admin : Communauté (inutile dans les settings), Parent (géré par la hiérarchie)

## EN COURS — 2026-04-18

- Root cause cache dev identifié : SW (service worker) prod interceptait Vite en dev → fix main.tsx (prod only) + Cache-Control no-store
- MainMenu.tsx : 4 boutons catégories (Basique/Types/Planif/Explor) → 1 bouton "Espaces" avec dropdown multi-colonnes + lien Présentation
- menuDefaults.ts : ajout vue "Récents" (key: recent, section: basic, viewMode: recent)
- dev-start.ps1 : nettoyage dist/sw.js + node_modules/.vite au démarrage
- spok-menu skill : refactorisée pour refléter la vraie archi (MainMenu, pas ViewModeSelector)
- Commit 7f7a778 — À tester en local (connecté + ouverture dropdown Espaces)

## EN COURS — 2026-04-16

- Fix cache logo : déplacé public/logo.png → src/assets/logo.png (import Vite hashé), 7 composants mis à jour
- MindMap : vignettes élargies max-w 200→260px, RADIAL_STEP 350→420, positionsStorageKey v2→v3

## EN COURS — 2026-04-15

- Nettoyage espaces doc : doublons Modèle de données annulés (102 items), Modales todos passés en cours
- Espaces restructurés : Pages publiques (cmnxnu81f01h8n856xt1fj4bo), Pages utilisateur (cmnxohuia01mln856b8bu9luo) créés
- Pages publiques groupées : Authentification / Accès par lien / Découverte
- Pages utilisateur groupées : Navigation globale / Visualisations globales
- Structure espace Interface utilisateur legacy vidée — à supprimer
- Organisation cible (cmnxq6a9d01rqn8569geutzga) enrichie dans Projet SPOK : arbre complet avec Visions Globales, Structure de la page, Administration, Modèle de données, Systèmes
- 37 vues d'espace créées et regroupées en 5 catégories (Tableau de bord, Basique, Types, Planification, Exploration)
- Vues globales groupées en 3 sections (Vues globales, Mes activités, Divers)
- Feat : champ description sur Space (schema Prisma, API, textarea settings, tooltip header)
- Fix seed : Role.ADMIN et Role.VIEWER n'existent pas dans l'enum → remplacés par Role.MEMBER
- Commit & push → prod Railway
- Prochaine étape : mettre à jour spok-doc skill avec descriptions fonctionnelles des espaces
- Feat : vignettes MindMap réorganisées + illustrations par type (favicon, date réunion, doc, image) — 5bdf57d
- Chore : cleanup 7 scripts tmp API, docs/technical ajoutés, MCP client + launch scripts, assets pub (favicon/logo), skills spok-rebuild + spok-tnr — c7343a5
- Deploy prod → push origin/master

## EN COURS — 2026-04-13

- Nettoyage CLAUDE Documentations : ~20 items annulés (doublons/obsolètes), ~63 items requalifiés en to_validate
- Items skills déplacés sous leur parent skill (SPOK START/DEPLOY/API/DOC/TNR/REBUILD) via script Python
- Nouvelles skills créées : spok-tnr (.claude/skills/spok-tnr/), spok-rebuild (.claude/skills/spok-rebuild/)
- settings.local.json : permissions ajoutées pour git worktree list, Chrome navigate/tabs
- Mémoire : feedback session-journal, reference_skills_spok.md (IDs items skills dans SPOK)
- Structure "Fichiers de consignes" créée dans CLAUDE Documentations (CLAUDE.md, Skills, Memory, docs/)
- Consignes skills rapatriées dans les skills concernées (côté utilisateur, branche worktree)

## EN COURS — 2026-04-12

- Push prod : 2 commits (e30f753 fix éclatement H2/H3 menus vues, 9fcd494 chore skills)
