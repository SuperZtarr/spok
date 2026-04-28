# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## EN COURS — 2026-04-28

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
