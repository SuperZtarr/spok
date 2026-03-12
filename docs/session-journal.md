# Session Journal - SPOK

---

## Accords permanents

> Cette section persiste entre les sessions. Claude DOIT la lire au démarrage et appliquer ces règles sans qu'on ait à les rappeler.

### 1. Checklist post-commit (5 étapes obligatoires)
Après chaque commit :
1. Mettre à jour `docs/TODO.md` local (marquer terminé + date + hash)
2. Synchroniser vers `C:\_dev\spok\docs\TODO.md` (source de vérité)
3. Mettre à jour `docs/session-journal.md` (entrée avec état TERMINÉ + commit)
4. Créer/mettre à jour un item dans l'espace **Documentation Projet** (ID: `cmluq9mwu0003s9m9jv90v0lg`) via l'API locale
5. Proposer la prochaine tâche de la TODO et attendre validation

### 2. Documentation Projet dans SPOK
- Espace ID : `cmluq9mwu0003s9m9jv90v0lg`
- API locale : `http://localhost:3001`
- Auth : `POST /auth/login` avec `admin@spok.app` / `admin1234`
- Après chaque **feat** ou **refactor** : créer un item DOCUMENT décrivant ce qui a été implémenté (titre, description, composants modifiés, décisions d'architecture)
- Après chaque **fix** important : mettre à jour l'item parent ou créer une NOTE

### 3. Workflow Git
- Ne JAMAIS merger dans master ni pusher sans accord explicite de l'utilisateur
- Commiter sur la branche worktree (`claude/*`)
- Tester en local avant merge
- Merger et pusher uniquement quand l'utilisateur dit "merge et push"

### 4. Communication
- Être direct et factuel
- Procéder étape par étape
- Ne pas proposer d'implémentation non demandée
- En cas d'oubli détecté, corriger immédiatement sans excuses excessives

### 5. Anti-tunnel : rendre la main fréquemment
- **Ne jamais faire un tour long** : découper chaque développement en petites étapes et rendre la main entre chaque, pour laisser l'utilisateur intervenir/corriger/réorienter
- **1 étape = 1 tour** : une étape logique (ex: modifier 1 fichier, ou présenter un plan) puis STOP — attendre la réponse de l'utilisateur avant de continuer
- **Avant de coder** : présenter le plan et attendre validation
- **Si erreur** : s'arrêter, expliquer, attendre les instructions

---

## Historique des sessions precedentes (resume)

### Fonctionnalites implementees
- **Vue Graphe force-directed** : 3 niveaux (espace, communaute, global), filtres communautes, noeuds structurels — commits `61878ae`, etc.
- **Vue Sunburst** : visualisation D3.js hierarchique dans le Dashboard — commit `518a5dc`
- **Vue MindMap** : layout etoile, groupement natif ReactFlow, zones projet draggables, zoom projet — commits `717b916`, `0128134`, `b000057`, `00d7fd0`
- **Vue Timeline/Gantt** : centrage, sticky, relations, enfants + mode compact (masquer items sans date) — commits `700fbf2`, `197f76b`
- **Hierarchie d'espaces** : parentId, arborescence sidebar, validation circulaire
- **Communautes publiques/privees** : isPublic, listing public, rejoindre — commit `e8576d4`
- **Optimistic locking** : detection conflits 409, dialogue resolution champ par champ
- **Upload images R2** : drag & drop, sharp WebP, Cloudflare R2
- **Landing page publique** : hero, fonctionnalites, vues
- **Page admin Stats** : totaux, series temporelles, repartition par type — commits `5a2b108`, `09aa5c3`
- **Couleurs de type** : referentiels appliques partout (Kanban, Liste, Sequence, recherche)
- **Breadcrumb ItemEditModal** : fil d'Ariane cliquable
- **Password reset** : tokens, email Resend, page de reset

### Corrections et infra
- Fix nginx workers OOM Railway (`worker_processes 2`) — commits `3f285c2`, `02e002c`
- Fix build prod (useEffect manquant) — commit `487be18`
- Fix type BUG dans validation Zod — commit `1d3ae00`
- Fix tooltips titres tronques — commit `2511734`
- Fix pre-selection communaute — commit `81bbfde`
- Fix dev-start.ps1 pour worktrees — commit `6413ba6`
- Fix restauration items supprimes — commits `596125f`, `3d63987`
- Fix endDate activites prod (planningelement) — script one-shot
- **Dockerisation complete du dev** : API + Web + PostgreSQL en conteneurs, hot reload via volumes — commit `0e4dcb0`

### Decisions d'architecture
- **Workflow Git** : ne plus merger/pusher sans accord explicite de l'utilisateur. Commiter sur branche worktree, tester en local, puis merge sur demande.
- **Dev Docker** : `pnpm dev:start` lance 3 conteneurs (postgres:25432, api:3001, web:3000). Utilise `node-linker=hoisted` + symlinks manuels pour compatibilite pnpm/Docker.
- **Prod Railway** : push sur `origin/master` declenche le deploiement automatique.

---

#### [2026-02-15] - Images avatar et couverture pour espaces et communautés

**Demande :** Implémenter l'upload d'images d'illustration (avatar + couverture) pour les espaces et communautés, avec affichage sur Dashboard, sidebar et CommunitySelector. Organisation R2 structurée par entité.
**Actions réalisées :**
- Schema Prisma : ajout avatarUrl/coverUrl aux modèles Space et Community
- Types partagés : ajout des champs aux interfaces Space, Community, AdminCommunity
- Utilitaire R2 : processAvatar (256x256), processCover (1200x400), uploadEntityImage générique
- Routes API : 8 nouvelles routes (POST/DELETE avatar et cover pour espaces et communautés)
- Client API frontend : uploadAvatar/deleteAvatar/uploadCover/deleteCover dans spacesApi et communitiesApi
- SpaceSettingsPage : section Images (avatar rond cliquable + couverture via ImageUploadZone)
- CommunitySettingsPage : même section Images
- DashboardPage : cover en bandeau sur les cartes, avatar à la place de FolderKanban, avatar communauté dans les en-têtes de section
- Layout sidebar : avatar espace dans SpaceTreeItem et liste espaces personnels
- CommunitySelector : avatar communauté dans la sélection active et la liste déroulante
**État :** TERMINÉ
**Commit :** 1258856

---

#### [2026-02-15] - Menu dropdown réutilisable pour actions d'items

**Demande :** Créer un menu dropdown avec actions groupées par catégorie, réutilisable dans toutes les vues, pour remplacer les hover buttons sur les nœuds/lignes/cartes.
**Actions réalisées :**
- Nouveau composant `ItemActionMenu.tsx` : bouton trigger ⋮, dropdown avec groupes séparés, labels de catégorie, variant danger, fermeture click-outside + Escape
- MindMapView : 6 hover buttons → 1 menu ⋮ avec 3 groupes (Créer, Organiser, Supprimer)
- KanbanView : 3 hover buttons → 1 menu ⋮ en coin supérieur droit avec 2 groupes
- ListView : 3 hover buttons → 1 menu ⋮ avec 2 groupes
- Nettoyage imports Button inutilisés dans KanbanView et ListView
**État :** TERMINÉ
**Commit :** 671368c

---

#### [2026-02-15] - Analyse fonctionnelle + mise à jour TODO

**Demande :** Analyse fonctionnelle de l'organisation Communautés/Espaces/Items — identifier incohérences, manques et améliorations. Puis ajout à la TODO.
**Actions réalisées :**
- Analyse parallèle (data model, frontend UX, types partagés) via 3 agents
- Identifié 2 incohérences, 6 manques fonctionnels, 7 améliorations
- Ajout de tous les items dans `docs/TODO.md` section "À faire"
**État :** TERMINÉ

---

#### [2026-02-15] - Suppressions sécurisées + audit global + restauration

**Demande :** Toute suppression (items, espaces, communautés) doit passer par un audit log complet avec état avant suppression, modales de confirmation listant les enfants, choix cascade vs orphan, et restauration possible depuis l'admin.
**Actions réalisées :**
- Schema Prisma : Space.parent onDelete SetNull, AuditLog.spaceId nullable, batchId
- Types partagés : AuditEntity étendu (Space/Community), types DeletePreview
- Helpers audit : serializeSpaceForAudit, serializeCommunityForAudit, batchId
- Fix items : audit individuel de chaque enfant avec batchId
- Espaces : preview endpoint + DELETE refactoré avec audit + deleteChildren
- Communautés : preview endpoint + DELETE refactoré avec audit + deleteChildren
- Admin : même logique pour espaces et communautés admin
- Route admin /audit-logs : filtres, stats, restauration batch, purge
- Frontend : SpaceDeleteConfirmModal, CommunityDeleteConfirmModal
- Intégration dans Dashboard, SpaceSettings, admin Spaces/Communities
- Page admin AuditLogsPage avec table paginée, filtres, stats, restauration batch
**État :** TERMINÉ
**Commit :** 5e9afd2

---

#### [2026-02-22] - Drag & drop des espaces dans la sidebar

**Demande :** Permettre de déplacer un espace dans un autre sous-espace par drag & drop directement depuis la sidebar.
**Actions réalisées :**
- Ajout de `@dnd-kit/core` (DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor) dans Layout.tsx
- SpaceTreeItem rendu draggable (poignée GripVertical au hover) et droppable (surbrillance cible)
- DragOverlay avec aperçu du nom de l'espace en cours de déplacement
- Zone "Déplacer à la racine" pour détacher un sous-espace de son parent
- Mutation API `spacesApi.update(spaceId, { parentId })` au drop avec invalidation du cache React Query
- Protections : distance d'activation 8px (pas d'interférence avec les clics), no-op si même parent, l'API valide les références circulaires
**État :** TERMINÉ
**Commit :** f26c95e

---

#### [2026-02-23] - Vue Calendrier mensuelle

**Demande :** Ajouter une vue calendrier mensuelle affichant les items avec dates (dueDate, startDate, endDate) sur une grille de 6 semaines.
**Actions réalisées :**
- Création `CalendarView.tsx` : grille mensuelle lundi→dimanche, navigation mois, bouton "Aujourd'hui", items positionnés par date, items multi-jours (startDate→endDate) étendus, max 3 items visibles par cellule avec compteur "+N", highlight type/status
- Modification `viewMode.ts` : ajout `'calendar'` au type ViewMode + entrée "Calendrier" (icône Calendar, catégorie planning)
- Modification `SpacePage.tsx` : import + rendu conditionnel, classé flatView + highlightMode
- Modification `ViewModeSelector.tsx` : import icône Calendar + ajout dans le dictionnaire ICONS
**État :** TERMINÉ
**Commit :** c459701

---

#### [2026-02-23] - Menu vues groupées par catégorie + fix MindMap

**Demande :** Afficher les labels de catégorie (Basique, Planification, Exploration) au-dessus des boutons de vue dans le menu principal quand il y a assez de place, avec des blocs visuellement séparés.
**Actions réalisées :**
- ViewModeSelector.tsx : `renderSpaceViewsInline` regroupe les vues par catégorie avec label uppercase au-dessus, séparateurs verticaux, fond `bg-accent/50` sur la catégorie active, boutons en `rounded-md` avec fond `bg-primary/10` pour la vue active
- MindMapView.tsx : fix crash — `searchMatchIds` n'était pas destructuré dans `MindMapViewInner` ni passé en prop depuis le wrapper forwardRef
**État :** TERMINÉ
**Commit :** ed0b4a7

---

#### [2026-02-23] - Barre de recherche globale dans la toolbar

**Demande :** Déplacer la barre de recherche de ListView vers la toolbar commune de SpacePage, pour qu'elle soit disponible sur toutes les vues. En mode highlight, les items correspondants doivent être mis en évidence avec un anneau jaune.
**Actions réalisées :**
- SpacePage.tsx : ajout du champ de recherche dans la toolbar (entre filtres et compteur), state searchQuery, filterBySearch (filtre en mode flat, no-op en highlight), searchMatchIds (Set<string> des IDs matchant)
- ListView.tsx : suppression de la barre de recherche interne et du filtrage local
- 8 vues highlight (TextView, SequenceView, TimelineView, PlanningView, CalendarView, MindMapView, GraphView, SunburstView) : prop searchMatchIds, isDimmed étendu, isSearchMatch avec highlight jaune (ring-2 ring-yellow-400 bg-yellow-50, ou glow canvas #facc15 pour GraphView/SunburstView)
- TreeItem + ItemChildren : propagation searchMatchIds dans l'arborescence
**État :** TERMINÉ
**Commit :** c0feb6c

---

#### [2026-02-24] - Segmentation Kanban/Types par espace + drag cross-space

**Demande :** Afficher un board Kanban/Types complet par espace (principal + portails), empilés verticalement, avec drag & drop intra et cross-espace + modale de confirmation si l'item a des descendants.
**Actions réalisées :**
- KanbanView.tsx : un DndContext unique, droppable IDs composites `spaceId::statusId`, boards par espace avec header portail, hauteur redimensionnable
- TypesView.tsx : même refactoring symétrique avec `spaceId::typeId`
- SpacePage.tsx : `handleMoveItemToSpace` avec vérification descendants → modale confirmation (déplacer seul / avec descendants / annuler)
- Fix 404 : toutes les mutations (update, delete, move, relations, convert) utilisent maintenant le `spaceId` réel de l'item au lieu du spaceId de la page
- Suppression console.log de debug
**État :** TERMINÉ
**Commit :** e19130b

---

#### [2026-02-24] - Support portail GraphView + SunburstView

**Demande :** Ajouter le support des portails d'espaces enfants dans GraphView et SunburstView (les 2 vues manquantes).
**Actions réalisées :**
- Backend : paramètre `additionalSpaceIds` dans les endpoints graph space et sunburst
- Frontend : hooks `useGraphData` et `useSunburstData` passent `additionalSpaceIds`, GraphView et SunburstView les transmettent
**État :** TERMINÉ
**Commit :** 07b10f0

---

#### [2026-02-24] - MindMap layout radial portails + distance adaptive

**Demande :** Items portails affichés en ligne droite au lieu d'en éventail. Puis augmenter la distance pour les éléments avec beaucoup de descendants, et réduire la branche des feuilles sans enfants.
**Actions réalisées :**
- Réécriture complète `placePortalItem` : layout en éventail radial (direction __space__ → portail) au lieu d'arbre linéaire
- Arc allocation proportionnelle (50% égal + 50% proportionnel au nombre de descendants visibles)
- Coefficient distance augmenté progressivement : 0.4 → 0.6 → 0.8
- Feuilles (sans enfants) rapprochées : `sqrt(max(d-1, 0))` au lieu de `sqrt(d)` — divise le rayon par 2 pour les feuilles
- Appliqué dans les 8 occurrences (layoutFan, reorganizeRef, portal useEffect, portal resetLayout)
**État :** TERMINÉ
**Commit :** 5cd3ad0

---

#### [2026-02-24] - Refonte réorganisation MindMap + UI tweaks

**Demande :** Revoir la réorganisation MindMap avec 4 règles claires + corrections UI diverses
**Règles établies :**
1. "Réorganiser les enfants" = éventail direction parent_direct → élément (pas __space__)
2. Éléments fixés : même règle, direction toujours locale
3. Portails : distance proportionnelle au nombre d'items, enfants en éventail __space__ → portail
4. Drag : les enfants suivent (comportement conservé)
**Actions réalisées :**
- Fix baseAngle dans reorganizeRef : utilise le parent direct au lieu de __space__
- Rayon adaptatif (sqrt descendants) cohérent avec layoutFan
- Distance portail = 300 + sqrt(n)*100 au lieu de 180 fixe (useEffect + resetLayout)
- Réorganisation items portail : recherche dans fullTree puis portalTrees, gestion child-space nodes
- Bouton ↺ sur nœuds portail pour réorganiser leurs enfants
- UI: modal fullscreen mobile, admin sidebar réordonnée, header élargi, logo crop CSS, ITEM_TYPES fix
**État :** TERMINÉ
**Commit :** fa469df

---

#### [2026-02-24] - Portails d'espaces enfants cross-space dans toutes les vues

**Demande :** Pouvoir cocher des espaces enfants dans la sidebar pour afficher leurs items en lecture seule dans l'espace parent, avec distinction visuelle.
**Actions réalisées :**
- Store Zustand : `includeChildrenSpaceIds` (Set) avec checkboxes dans la sidebar (Layout.tsx)
- API : paramètre `additionalSpaceIds` dans items.ts pour récupérer les items de plusieurs espaces
- SpacePage.tsx : `portalItemsBySpace` (Map groupant items par espace source), passé en prop à toutes les vues
- 9 vues implémentées : Liste (colonne espace), Kanban (badge espace, sections portail), Texte (sections portail), Types (badge espace), Timeline (badge + barres dashed), Planning (badge espace), Calendrier (bordure dashed + tooltip), Séquence (badge + dashed border), MindMap (nœuds portail avec layout arbre directionnel, drag group, resetLayout aligné)
**État :** TERMINÉ
**Commit :** 2c6bea2

---

#### [2026-02-25] - Vitest infrastructure + 294 tests API

**Demande :** Phase 3-4 de l'audit : installer Vitest, écrire des tests pour toutes les routes API.
**Actions réalisées :**
- Vitest installé avec workspace configs (API=node, web=jsdom), `vitest.config.ts` root
- Mock Prisma complet dans `apps/api/src/test/helpers.ts` (20+ modèles, builders)
- 17 fichiers de test créés : auth (29), items (35), spaces (47), communities (38), tags (13), referentiels (10), auditLogs (11), graph (17), search (8), user-tasks (14), admin users (24), admin spaces (15), admin communities (14), admin auditLogs (12), admin referentiels (3), smoke API (2), smoke web (2)
- Bug identifié : routes admin/users.ts lignes 357/415 — chemins sans `/` initial (`':id/spaces'`) causent `/admin/users:id/spaces` au lieu de `/admin/users/:id/spaces`
**État :** TERMINÉ
**Commit :** ee2359f

---

#### [2026-02-25] - Refactoring items.ts (Phase 5)

**Demande :** Phase 5 de l'audit : refactoring des fichiers > 1000 lignes. Premier fichier : items.ts (1716 lignes).
**Actions réalisées :**
- Extraction de 6 sous-modules Fastify depuis items.ts :
  - `item-relations.ts` (~110 lignes) : create/delete relation
  - `item-move.ts` (~270 lignes) : move + bulk-move
  - `item-bulk.ts` (~210 lignes) : bulk-duplicate
  - `item-uploads.ts` (~150 lignes) : image + document upload
  - `item-contributions.ts` (~200 lignes) : CRUD contributions
  - `item-convert.ts` (~185 lignes) : convert-to-space
- `checkSpaceAccess` transformé de closure interne en fonction exportée (prend `prisma` en paramètre)
- items.ts réduit à ~380 lignes (schemas CRUD + list/create/get/update/delete + registration des sous-plugins)
- 372 tests passent sans modification
**État :** TERMINÉ
**Commit :** 6e5e414

---

#### [2026-02-25] - Refactoring SpacePage.tsx (Phase 5)

**Demande :** Phase 5, troisième fichier : SpacePage.tsx (2016 lignes).
**Actions réalisées :**
- Extraction de 3 fichiers depuis SpacePage.tsx :
  - `space-tree-view.tsx` (~310 lignes) : composants TreeItem, ItemChildren, RootDropZone (vue arborescence avec drag & drop)
  - `useSpaceActions.ts` (~220 lignes) : hook custom avec 6 mutations (delete, update, move, relations, convert), action handlers, état des modales (deletingItem, convertingItem, pendingCrossSpaceMove)
  - `SpaceToolbar.tsx` (~270 lignes) : composant toolbar avec filtres type/statut, recherche, compteur, boutons expand/collapse/réorganiser
- SpacePage.tsx réduit à ~760 lignes (état, queries, DnD, formulaire création, view switch, modales)
- 372 tests passent sans modification
**État :** TERMINÉ
**Commit :** a3168fd

---

#### [2026-02-25] - Refactoring MindMapView.tsx (Phase 5)

**Demande :** Phase 5, deuxième fichier : MindMapView.tsx (2553 lignes).
**Actions réalisées :**
- Extraction de 3 fichiers depuis MindMapView.tsx :
  - `mindmap-utils.ts` (~248 lignes) : types (TreeItem, PortalState, LayoutDatum), constantes (RADIAL_STEP, RELATION_TYPES), fonctions utilitaires (buildTree, getStatusColor, tailwindBgToHex, etc.)
  - `mindmap-nodes.tsx` (~278 lignes) : composants React MindMapNode, SpaceNode, PortalNode + registre nodeTypes
  - `mindmap-layout.ts` (~480 lignes) : calculateLayout (layout radial), buildPortalNodesAndEdges (logique portails dédupliquée), interfaces MindMapCallbacks/MindMapLayoutOptions
- MindMapView.tsx réduit à ~780 lignes (état, handlers, JSX)
- Déduplication : `buildPortalNodesAndEdges` remplace ~250 lignes dupliquées entre useEffect et resetLayout
- Fix tsconfig.json : ajout `types` explicites pour éviter stub @types/testing-library__jest-dom
- 372 tests passent sans modification
**État :** TERMINÉ
**Commit :** 267f387

---

#### [2026-02-25] - Tests web Phase 4 (community, dashboardTab, theme, useSort, api)

**Demande :** Compléter la Phase 4 des tests web — stores, hooks et utilitaires restants.
**Actions réalisées :**
- `community.test.ts` (5 tests) : get/set/persist currentCommunity
- `dashboardTab.test.ts` (10 tests) : get/set/persist tab + constantes DASHBOARD_TABS/NAV_ITEMS
- `theme.test.ts` (5 tests) : initTheme light/dark/system, setTheme + DOM classList
- `useSort.test.ts` (12 tests) : toggle key/order, sortData strings/numbers/nulls/unknown
- `api.test.ts` (9 tests) : ApiError constructor, isConflictError type guard
- `setup.ts` : ajout mock global `window.matchMedia` pour jsdom
- Total : 413 tests (372 existants + 41 nouveaux)
**État :** TERMINÉ
**Commit :** 9007e21

---

#### [2026-02-25] - Refactoring ItemEditModal, TimelineView, SequenceView (Phase 5 finale)

**Demande :** Compléter la Phase 5 du refactoring — les 3 derniers fichiers > 1000 lignes.
**Actions réalisées :**
- ItemEditModal.tsx (1339 → 1247) : extraction `item-edit-constants.ts` (56 lignes, durées), `item-edit-helpers.ts` (38 lignes, fileNameToTitle, urlToTitle, getDescendantIds)
- TimelineView.tsx (1131 → 988) : extraction `timeline-constants.ts` (33 lignes, zoom config, RELATION_TYPES), `timeline-utils.ts` (50 lignes, date utils, getStatusColor), `timeline-tree.ts` (64 lignes, buildTree, flattenTree)
- SequenceView.tsx (1040 → 698) : extraction `sequence-chains.ts` (216 lignes, computeHierarchyChains), `SequenceSVG.tsx` (97 lignes, SVGConnectors), `sequence-utils.ts` (32 lignes, RELATION_TYPES, formatDate)
- Typecheck OK, 372 tests passent sans modification
**État :** TERMINÉ
**Commit :** addd2af

---

#### [2026-02-25] - Vue Relations (cartographie non hiérarchique)

**Demande :** Ajouter une vue qui visualise les relations entre items indépendamment de la hiérarchie parent/enfant (amélioration #7)
**Actions réalisées :**
- Nouveau composant `RelationsMapView.tsx` : force-graph 2D basé sur react-force-graph-2d
- Affiche uniquement les relations libres (blocks, depends, relates) entre items
- Toggles par type de relation, option afficher items sans relations
- Couleurs par type d'item, flèches directionnelles, highlight (type/statut/recherche)
- Ajouté `'relations'` dans viewMode store (icône Waypoints, catégorie exploration)
- Câblé dans SpacePage.tsx et ViewModeSelector.tsx
**État :** TERMINÉ
**Commit :** ebdbd13

---

#### [2026-02-25] - Assignation d'items

**Demande :** Ajouter l'assignation d'items à des membres + vue "Assigné à moi" (manque fonctionnel #3)
**Actions réalisées :**
- Schema Prisma : `assignedToId` + relation `assignedTo` sur Item, index
- API items.ts : `assignedToId` dans create/update zod, `assignedTo` dans includes listing + get, conflict detection
- API user-tasks.ts : filtre `assignedToMe`, `assignedToId`/`assignedTo` dans select et réponse
- Types shared : `assignedToId` sur Item, `assignedTo` sur ItemWithRelations, dans Create/UpdateItemInput
- UI ItemEditModal : sélecteur dropdown des membres de l'espace (visible si > 1 membre)
- UI GlobalTasksPage : chip filtre "Assigné à moi" (violet)
**État :** TERMINÉ
**Commit :** fbb4887

---

#### [2026-02-25] - Statut "Bloqué" → "À valider"

**Demande :** Remplacer le statut "bloqué" par "à valider" dans les référentiels par défaut
**Actions réalisées :**
- `defaultReferentiels.ts` : id `blocked`→`to_validate`, label `Bloqué`→`À valider`, couleur noir→violet
**État :** TERMINÉ
**Commit :** e5c6766

---

#### [2026-02-25] - Transfert de propriété (espace + communauté)

**Demande :** Implémenter le transfert de propriété pour espaces et communautés (manque fonctionnel #2)
**Décision :** Ancien owner → MEMBER (choix utilisateur, pas ADMIN)
**Actions réalisées :**
- Route API `POST /:id/transfer-ownership` sur communities.ts et spaces.ts (transaction atomique)
- Méthodes client `transferOwnership()` sur spacesApi et communitiesApi
- Bouton couronne (Crown) + modale de confirmation dans CommunityMembersManager et SpaceMembersManager
- Visible uniquement par l'OWNER, sur les membres autres que soi-même
**État :** TERMINÉ
**Commit :** 1013fb5

---

#### [2026-02-25] - MindMap : édition relations + icônes type + tooltip commentaire

**Demande :** Clic sur une relation dans la MindMap ne doit plus supprimer mais éditer. Icône du type de lien sur l'edge, tooltip du commentaire au survol.
**Actions réalisées :**
- Custom edge `RelationEdge` dans mindmap-nodes.tsx : icône du type (Ban, ArrowLeft, Link2, Copy, Cog, FlaskConical) dans un cercle sur le lien, tooltip commentaire au hover
- Modale d'édition relation dans MindMapView : même style que la modale de création (grille type + champ commentaire + Enregistrer/Supprimer/Annuler)
- `onUpdateRelation` ajouté dans MindMapViewProps, useSpaceActions (mutation + handler), SpacePage
- Edges relation passés en `type: 'relation'` dans mindmap-layout.ts (custom edge au lieu de default)
- `edgeTypes` enregistré dans ReactFlow
**État :** TERMINÉ
**Commit :** 98209e8

---

#### [2026-02-25] - Enrichir les relations entre items

**Demande :** Ajouter un commentaire sur les relations, pouvoir éditer (modifier type + commentaire) et supprimer une relation (amélioration #8)
**Actions réalisées :**
- Schema Prisma : `label String?` sur ItemRelation
- API : `label` dans createRelationSchema, route PATCH `/:id/relations/:relationId`, audit UPDATE_RELATION
- Types shared : `label` dans CreateRelationInput + ItemRelation, `UPDATE_RELATION` dans AuditAction
- Client API : `updateRelation()` + label dans createRelation
- UI ItemEditModal : type "Lié à" ajouté, champ commentaire à la création, label affiché en italique sous chaque relation, bouton crayon → formulaire inline (type + label + sauvegarder/annuler)
- Audit UI : UPDATE_RELATION dans AuditLogDetail et AuditLogItem
**État :** TERMINÉ
**Commit :** c4849fb

---

#### [2025-02-15] - Fix build Railway après unification ItemActionMenu

**Demande :** Correction automatique suite à l'échec du build Railway (commit 282d58f)
**Actions réalisées :**
- Supprimé l'import inutilisé `CheckSquare` dans `TypesView.tsx`
- Supprimé l'import inutilisé `X` dans `SpaceSettingsPage.tsx`
- Commit `1e97a24`, merge fast-forward dans master, push origin
**État :** TERMINÉ

---

#### [2026-02-26] - Vue Schéma (canvas libre)

**Demande :** Ajouter une vue permettant de faire des schémas visuels avec les éléments — canvas libre, connexions = relations en base, positions persistées.
**Décision :** ReactFlow en mode libre, positions sauvegardées via SpaceModule (canvas-layout), type picker pour les nouvelles connexions.
**Actions réalisées :**
- Route API `canvas-layout.ts` : GET/PUT positions via SpaceModule (`moduleKey: 'canvas-layout'`)
- Enregistrement dans `spaces.ts` à `/:spaceId/canvas-layout`
- Client `canvasLayoutApi` dans `api.ts` (get, update)
- Composant `SchemaView.tsx` : ReactFlow canvas libre, nœuds custom (titre, type, statut), edges custom (icône type relation), handles source/target sur 4 côtés, grille pointillée snap 20px, MiniMap, debounced save positions (1s)
- Connexion entre handles → picker type de relation → crée ItemRelation
- Double-clic nœud → ouvre ItemEditModal
- Support portails (bordure dashed), highlight type/statut, searchMatchIds (jaune)
- Ajout `'schema'` dans viewMode (icône PenTool, catégorie exploration)
- Intégration SpacePage + ViewModeSelector
**État :** TERMINÉ
**Commit :** b04ab2b

---

#### [2026-02-26] - SchemaView : hiérarchie, layout arbre, réorganiser, multi-sélection

**Demande :** Afficher la hiérarchie parent→enfant dans la vue Schéma, layout initial en arbre, bouton réorganiser dans la toolbar, sélection multiple.
**Actions réalisées :**
- Edges hiérarchie gris clair (HierarchyEdge) : parent bottom → enfant top
- Algorithme `computeHierarchyLayout` : arbre avec blocs racine empilés verticalement
- Layout hiérarchique utilisé à l'initialisation (quand pas de positions sauvegardées)
- Bouton "Réorganiser" dans SpaceToolbar (comme MindMap) via ref callback
- Multi-sélection : drag sur fond = rectangle de sélection, Shift+clic, déplacement groupé
**État :** TERMINÉ
**Commit :** 446c905

---

#### [2026-02-26] - Fix portails SchemaView + compteur items

**Demande :** Les portails (espaces enfants cochés) ne s'affichent pas en vue Schéma, et le compteur d'éléments ne les inclut pas.
**Actions réalisées :**
- Ajout de `'schema'` dans `isFlatView` (SpacePage) pour que tous les items soient récupérés (pas seulement les racines)
- Compteur d'items utilise `allItemsData?.data?.length` au lieu de `space.itemCount` pour inclure les portails
**État :** TERMINÉ
**Commits :** bbd627c, d983134

---

#### [2026-02-26] - SchemaView : groupes imbriqués + drag reparent

**Demande :** Remplacer les liens de hiérarchie par des nœuds conteneurs (enfants visuellement à l'intérieur du parent). Permettre de drag & drop un nœud sur un autre pour le reparenter, et hors d'un parent pour le détacher.
**Actions réalisées :**
- Suppression des HierarchyEdges, remplacement par nesting visuel ReactFlow (`parentId` sur les nœuds enfants)
- Nouveau composant `SchemaGroupNode` : conteneur avec header (titre, icône, statut, menu actions) + zone enfants
- Algorithme récursif `computeGroupSizes` : calcul bottom-up des dimensions (largeur/hauteur) des groupes imbriqués
- Protection anti-cycle dans `computeSize` (set `visiting`)
- Drag & drop reparent : drop un nœud sur un autre → API `update(parentId)`, drop hors d'un parent → détache (`parentId: null`)
- `ReactFlowProvider` wrapper pour accès `useReactFlow().getIntersectingNodes()`
- Edges de relation en courbes de Bézier (`getBezierPath`)
- Multi-sélection conservée (drag rectangle + Shift+clic)
**État :** TERMINÉ
**Commit :** f21d5f9

---

#### [2026-03-08] - RadialTreeView

**Demande :** Créer une nouvelle vue "Arbre radial" utilisant d3-hierarchy tree layout en mode radial
**Actions réalisées :**
- Nouveau composant `RadialTreeView.tsx` : arbre radial SVG avec zoom/pan, tooltip, légende, nœuds colorés par type
- Ajout du mode `radialTree` dans `viewMode.ts` (label "Arbre radial", icône Orbit, catégorie exploration)
- Ajout icône `Orbit` dans `ViewModeSelector.tsx`
- Wiring dans `SpacePage.tsx` (import, isFlatView, isHighlightMode, overflow classes, rendu conditionnel)
**État :** TERMINÉ
**Commit :** 927c8cb

---

#### [2026-03-08] - Rôle par défaut pour nouveaux membres

**Demande :** Rôle par défaut configurable pour les nouveaux membres de communauté sur les espaces
**Actions réalisées :**
- Ajout `defaultRole Role?` sur le modèle Space (schema Prisma)
- Type Space et UpdateSpaceInput mis à jour dans @spok/shared
- Fonction `autoJoinCommunitySpaces` dans communities.ts : auto-join sur join/invite
- Sélecteur dans SpaceSettingsPage (4 options : aucun, lecteur, membre, admin)
**État :** TERMINÉ
**Commit :** bfa9de6

---

#### [2026-03-08] - @mentions et #références dans TipTap

**Demande :** Ajouter @mentions (utilisateurs) et #références (items) dans l'éditeur TipTap
**Actions réalisées :**
- Extension TipTap Mention (@) : autocomplete membres de l'espace, badges bleus
- Extension TipTap itemMention (#) : autocomplete items cross-espaces, badges violets
- Composant MentionList.tsx : popup suggestion avec navigation clavier
- Backend mentions.ts : extractMentionedUserIds + notifyMentionedUsers
- Déclenchement MENTION dans items.ts (create/update) et item-contributions.ts (create)
- RichTextEditor : props spaceId + mentionableItems, styling mention-user/mention-item
- ItemEditModal : passage des props aux 3 instances de RichTextEditor
**État :** EN COURS (pas encore commité)

---

#### [2026-03-08] - Notifications email + préférences

**Demande :** Notifications par email via Resend avec préférences utilisateur par type, configurables dans le profil et par l'admin
**Actions réalisées :**
- Schema Prisma : `notificationPreferences Json?` sur User
- Types shared : NotificationChannel, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES
- notifications.ts refactoré : vérifie préférences user (all/in_app/none), envoie email via Resend si 'all'
- API user.ts : GET/PATCH /user/notification-preferences
- API admin/users.ts : PATCH /:id/notification-preferences + notificationPreferences dans le détail
- Frontend UserProfileModal : section Notifications avec boutons par type (App+Email / App seule / Désactivé)
- Frontend api.ts : getNotificationPreferences, updateNotificationPreferences
**État :** EN COURS (pas encore commité)

---

#### [2026-03-08] - Tags partagés au niveau communauté

**Demande :** Tags communautaires disponibles dans tous les espaces de la communauté
**Actions réalisées :**
- Schema Prisma : communityId optionnel sur Tag, relation Community.tags, index + unique constraint
- API tags.ts : listing inclut les tags de la communauté associée, badge isCommunityTag
- API communities.ts : CRUD tags communautaires (GET/POST/PATCH/DELETE /:id/tags)
- Frontend api.ts : communitiesApi.getTags/createTag/updateTag/deleteTag
- Frontend TagSelector : badge "communauté" sur les tags partagés
- Frontend CommunitySettingsPage : section CommunityTagsSection (CRUD inline)
**État :** TERMINÉ — b5d10de

---

#### [2026-03-08] - Templates d'espace (vérification)

**Demande :** Templates d'espace (structure pré-configurée : statuts, types, items)
**Constat :** Déjà implémenté ! Backend (spaces.ts) applique les templates, frontend (DashboardPage) affiche le sélecteur avec 4 templates (Vide, Projet, Kanban, Réunions), types définis dans @spok/shared (spaceTemplates.ts)
**État :** TERMINÉ (déjà existant)

---

#### [2026-03-08] - TreemapView

**Demande :** Visualisation Treemap — rectangles imbriqués proportionnels
**Actions réalisées :**
- TreemapView.tsx : SVG treemap d3-hierarchy, 3 modes de taille (enfants/contributions/égal), zoom sur clic parent, tooltip, légende, highlight/search
- Wiring : viewMode.ts (type + VIEW_MODES), ViewModeSelector (icône SquareStack), SpacePage (import, isFlatView, isHighlightMode, overflow, render)
**État :** TERMINÉ — 09a1a35

---

#### [2026-03-08] - OrgChartView

**Demande :** Organigramme — arborescence verticale des membres par espace/rôle
**Actions réalisées :**
- OrgChartView.tsx : arbre SVG vertical, racine = espace → groupes par rôle (OWNER/ADMIN/MEMBER/VIEWER) → membres individuels, couleurs par rôle, tooltip, légende, connecteurs Bézier, layout récursif
- Wiring : viewMode.ts (type + VIEW_MODES, icône Users, catégorie basic), ViewModeSelector, SpacePage (rendu avant loading items, charge ses propres données via spacesApi.getMembers)
**État :** TERMINÉ — d570ef8

---

#### [2026-03-08] - BurndownView

**Demande :** Burndown/Burnup — courbe d'avancement des tâches dans le temps (done vs total)
**Actions réalisées :**
- BurndownView.tsx : chart SVG avec 2 modes (Burnup = 2 courbes total/done, Burndown = reste à faire + ligne idéale en pointillés), tooltip au survol, stats en barre de contrôle, axes/grille, ResizeObserver, adaptatif pas journalier/hebdo/mensuel
- Wiring : viewMode.ts (type + VIEW_MODES, icône TrendingDown, catégorie planning), ViewModeSelector, SpacePage (import, isFlatView, overflow, render)
**État :** TERMINÉ — aa1aa4c

---

#### [2026-03-08] - Restauration audit logs UPDATE/MOVE

**Demande :** Ajouter dans l'admin des audit logs une restauration sur les UPDATE/MOVE, avec dialogue de confirmation champ par champ (comme la résolution de conflit concurrent)
**Actions réalisées :**
- Backend admin/auditLogs.ts : route POST /:id/restore étendue pour UPDATE/MOVE, body `fieldsToRestore[]` optionnel, restauration sélective des champs, audit log de traçabilité
- AuditRestoreDialog.tsx : dialog avec comparaison champ par champ (valeur actuelle en rouge / valeur à restaurer en vert), checkboxes de sélection, boutons tout sélectionner/désélectionner
- api.ts : `adminApi.auditLogs.restore()` accepte `fieldsToRestore?: string[]`
- AuditLogsPage.tsx : bouton Restaurer sur les lignes UPDATE/MOVE (single + batch), wiring du dialog
**État :** TERMINÉ — a950424

---

#### [2026-03-08] - ChordView (diagramme chord)

**Demande :** Chord diagram — relations circulaires entre espaces ou types d'items
**Actions réalisées :**
- ChordView.tsx : d3-chord SVG, 2 modes (par type / par espace), option inclure hiérarchie, rubans colorés proportionnels, tooltip, légende, hover highlight
- Wiring : viewMode.ts (type + VIEW_MODES, icône Disc, catégorie exploration), ViewModeSelector, SpacePage
- Dépendances : d3-chord, d3-shape ajoutés
**État :** TERMINÉ — 68bf9a8

---

#### [2026-03-08] - DeadlinesView (onglet Échéances dashboard)

**Demande :** Nouvel onglet dans le dashboard affichant les items avec échéance
**Actions réalisées :**
- dashboardTab.ts : ajout tab `deadlines` (icône CalendarCheck, label "Échéances")
- DeadlinesView.tsx : liste items avec dueDate groupés par urgence (En retard, Aujourd'hui, Cette semaine, Ce mois, Plus tard), badges statut/priorité/espace, clic → ItemEditModal
- DashboardPage.tsx : wiring du nouveau tab
**État :** TERMINÉ — d093921

---

#### [2026-03-08] - CfdView (flux cumulatif)

**Demande :** Diagramme de flux cumulatif — empilage des statuts dans le temps
**Actions réalisées :**
- CfdView.tsx : chart SVG stacked area, snapshots journaliers/hebdo/mensuels adaptatifs, tooltip au survol avec crosshair, légende, stats total, couleurs par statut
- Wiring : viewMode.ts (type + VIEW_MODES, icône Layers, catégorie planning), ViewModeSelector, SpacePage (import, isFlatView, overflow, render)
**État :** TERMINÉ — 6091981

---

#### [2026-03-09] - Session features batch

**Demande :** Série de fonctionnalités et améliorations
**Actions réalisées :**
- MindMap : hauteur nœuds augmentée à 3 lignes (line-clamp-3) — 1e9ac95
- Gantt : bouton réorganisation chronologique persistée via API reorder, respect hiérarchie — 945a871
- Sélecteurs d'espaces groupés par communauté : utilitaire spaceGrouping.ts, Select optgroups, appliqué dans SpaceSettingsPage, MoveToSpaceModal, DuplicateToSpaceModal, UserDetailModal, CommunityDetailModal — f0900d1
- CommunitySelector : dropdown prend toute la hauteur disponible (calc 100vh - 120px) — f0900d1
- Bouton suppression (Trash2) dans ItemEditModal avec confirmation — e27a2d5
- MatrixView : scatter 2 axes effort/impact, 4 quadrants, drag repositionnement, persistence SpaceModule — 640a267
- CrossTableView : tableau croisé dynamique, 4 dimensions (statut/type/assigné/espace), totaux, cellules expandables — 5e73a0f
**État :** TERMINÉ
**Commits :** 1e9ac95, 945a871, f0900d1, e27a2d5, 640a267, 5e73a0f, b3bf186

---

#### [2026-03-08] - Commits session

**Commits créés :**
- 000593b feat: @mentions and #item references in TipTap editor
- 3457763 feat: email notifications with user preferences
- b5d10de feat: community-level shared tags
- 09a1a35 feat: TreemapView — nested rectangles proportional to children/contributions
- d570ef8 feat: OrgChartView — vertical tree of space members grouped by role
- aa1aa4c feat: BurndownView — burnup/burndown chart for task progress over time
- a950424 feat: audit log restore for UPDATE/MOVE with field-by-field selection dialog
**État :** TERMINÉ

---

#### [2026-03-12] - Export PDF données + capture PNG vue actuelle

**Demande :** Enrichir les exports avec du PDF pour les vues adaptées, puis capture PNG pour les vues visuelles
**Décision :** PDF tabulaire pour les données (jspdf + autotable), PNG pour la capture visuelle des vues (html2canvas au lieu de PDF car plus pertinent pour une image)
**Actions réalisées :**
- Installation jspdf, jspdf-autotable, html2canvas
- SpaceExportButton.tsx : fonctions exportPDF (tableau items + relations A4 paysage) et exportViewPNG (capture html2canvas)
- SpaceToolbar.tsx : propagation viewContainerRef
- SpacePage.tsx : ref viewContainerRef sur le conteneur des vues
- Dropdown export enrichi avec séparateur données/visuel (CSV, JSON, Excel | PDF données, PNG vue)
**État :** TERMINÉ
**Commit :** b4db74f

---

#### [2026-03-11] - Fix sidebar refresh au retour sur la fenêtre

**Demande :** La sidebar perd les espaces personnels et communautaires quand on revient sur la page/fenêtre
**Actions réalisées :**
- Layout.tsx : `refetchOnWindowFocus: 'always'` sur les 2 queries d'espaces
- api.ts : sync Zustand store après token refresh (pas juste localStorage)
**État :** TERMINÉ
**Commit :** ac04cf7

---
