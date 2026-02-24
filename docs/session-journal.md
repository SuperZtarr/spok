# Session Journal - SPOK

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

#### [2025-02-15] - Fix build Railway après unification ItemActionMenu

**Demande :** Correction automatique suite à l'échec du build Railway (commit 282d58f)
**Actions réalisées :**
- Supprimé l'import inutilisé `CheckSquare` dans `TypesView.tsx`
- Supprimé l'import inutilisé `X` dans `SpaceSettingsPage.tsx`
- Commit `1e97a24`, merge fast-forward dans master, push origin
**État :** TERMINÉ

---
