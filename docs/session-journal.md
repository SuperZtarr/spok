# Session Journal - SPOK

---

#### [2026-02-12 ~14:00] - Ergonomie dates + auto-fill titre + durées meeting/période

**Demande :** Suite de la session précédente. Compléter les boutons de durée pour MEETING (date de fin = date début + durée sélectionnée) et ajouter la même fonctionnalité pour PERIOD. Garder le DateTimeField modifiable dans tous les cas.

**Précisions utilisateur :**
- Ne pas remplacer le DateTimeField par les boutons de durée, mais les combiner
- Les boutons de durée pré-remplissent la date de fin, le DateTimeField reste modifiable
- PERIOD aussi a besoin de boutons de durée (1j, 2j, 3j, 5j, 1 sem., 2 sem., 1 mois, 3 mois)

**Actions réalisées :**
- Défini `MEETING_DURATIONS` (15min → 4h) et `PERIOD_DURATIONS` (1j → 3 mois) comme constantes
- Section "Date de fin" : boutons de durée affichés au-dessus du DateTimeField pour MEETING et PERIOD (visibles seulement si startDate est définie)
- Bouton sélectionné mis en surbrillance (comparaison de la durée actuelle avec la durée du bouton)
- L'auto-fill titre (session précédente) inclus dans le même commit
- Build OK

**Fichier modifié :**
- `apps/web/src/components/ItemEditModal.tsx`

**État :** TERMINÉ
**Commit :** `3122e92`

---

#### [2026-02-11 11:00] - Corrections supplémentaires + données Commercial

**Réalisations additionnelles :**

1. **Noeud central espace dans le graphe** — Le graphe au niveau espace affiche maintenant un noeud SPACE central relié aux items racines. Commit `163ee31`.

2. **Insertion données "Commercial"** — Script d'insertion en prod : 13 catégories (PROJECT) + 41 produits (NOTE) dans l'espace Commercial, avec marquage ⛔ pour les items interdits (verboten).

3. **Fix restauration d'items supprimés** — Deux bugs corrigés :
   - Le POST /restore envoyait Content-Type: application/json sans body → Fastify rejetait avec 400. Ajout de `body: JSON.stringify({})`. Commit `596125f`.
   - Si le parent ou le créateur d'un item supprimé n'existait plus, la restauration plantait. L'item est maintenant placé à la racine. Commit `3d63987`.

**Commits poussés :** `163ee31`, `3d63987`, `596125f`

**État :** TERMINÉ

---

#### [2026-02-11 10:30] - Résumé de session

**Réalisations de la session :**

1. **Vue Sunburst interactive** — Nouvelle visualisation D3.js dans le Dashboard (onglet Sunburst) montrant la hiérarchie Global → Communautés → Espaces → Items → Enfants en anneaux concentriques. Hover = surbrillance + breadcrumb, click = navigation. Commit `518a5dc` + fix TS `07cb44c`.

2. **Fix défilement des pages** — Ajout `overflow-auto` sur le main du Layout pour permettre le scroll sur toutes les pages. Les pages plein écran (graphe, mindmap, sunburst) forcent `h-full overflow-hidden`. Commit `b489309`.

3. **Fix graphe grand écran** — Restauration de `flex flex-col` sur le main du Layout pour que les vues plein écran s'étirent correctement via flex-1. Commit `e7ce847`.

4. **Noeud central espace dans le graphe** — Le graphe au niveau espace affiche maintenant un noeud SPACE central relié aux items racines. Commit `163ee31`.

5. **Insertion données "Commercial"** — Script d'insertion en prod : 13 catégories (PROJECT) + 41 produits (NOTE) avec marquage ⛔ pour les items interdits.

**Commits poussés en prod :** `518a5dc`, `07cb44c`, `b489309`, `e7ce847`, `163ee31`

**État des tâches en cours :**
- Upload d'images R2 : code prêt, en attente config Cloudflare
- Landing page publique : code prêt, en attente vérification
- Optimistic locking : code prêt, en attente vérification

**État :** TERMINÉ

---

#### [2026-02-11 09:45] - Vue Sunburst interactive dans le Dashboard

**Demande :** Ajouter une visualisation Sunburst (D3.js) dans le Dashboard, montrant la hierarchie complete des donnees SPOK sous forme d'anneaux concentriques (Global → Communautes → Espaces → Items → Enfants → Contributions).

**Actions realisees :**
- Installe `d3-shape`, `d3-interpolate` + types dans @spok/web
- Cree `packages/shared/src/types/graph.ts` : interface `SunburstNode`
- Ajoute endpoint `GET /graph/sunburst?communityIds=...` dans `apps/api/src/routes/graph.ts` : construit l'arbre recursif, valeur feuilles = max(1, contributionCount)
- Ajoute `graphApi.sunburst()` dans `apps/web/src/lib/api.ts`
- Cree `apps/web/src/hooks/useSunburstData.ts` (React Query)
- Cree `apps/web/src/components/views/SunburstView.tsx` (~250 lignes) : d3-hierarchy.partition + d3-shape.arc, hover surbrillance chemin + breadcrumb %, click navigation, filtre communautes, legende, ResizeObserver
- Ajoute 3e onglet "Sunburst" (icone CircleDot) dans `apps/web/src/pages/DashboardPage.tsx`

**Fichiers crees :**
- `packages/shared/src/types/graph.ts`
- `apps/web/src/hooks/useSunburstData.ts`
- `apps/web/src/components/views/SunburstView.tsx`

**Fichiers modifies :**
- `packages/shared/src/types/index.ts`
- `apps/api/src/routes/graph.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/package.json` + `pnpm-lock.yaml`

**Etat :** TERMINE
**Commit :** 518a5dc

---

#### [2026-02-11 01:00] - Upload d'images via Cloudflare R2

**Demande :** Permettre l'upload d'images par drag & drop sur les items de type IMAGE, stockage sur Cloudflare R2 (S3-compatible), prévisualisation, et fallback URL externe.

**Actions réalisées :**
- Installé `@aws-sdk/client-s3` dans `@spok/api`
- Ajouté variables R2 dans `.env.example` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL)
- Créé `apps/api/src/utils/r2.ts` : S3Client R2, `isR2Configured()`, `processImage()` (sharp 1920px WebP 82), `uploadImageToR2()`, `deleteImageFromR2()`
- Ajouté route `POST /:id/image` dans `apps/api/src/routes/items.ts` : authentification, validation MIME/taille, process+upload R2, suppression ancienne image, mise à jour item.url
- Ajouté `itemsApi.uploadImage()` dans `apps/web/src/lib/api.ts` (FormData + fetch)
- Créé `apps/web/src/components/ui/ImageUploadZone.tsx` : zone drag & drop, prévisualisation, bouton supprimer, spinner upload, validation client
- Modifié `apps/web/src/components/ItemEditModal.tsx` : mutation upload, ImageUploadZone pour type IMAGE, fallback URL externe dans `<details>`, affichage `<img>` en lecture seule, section URL séparée pour LINK/DOCUMENT

**Fichiers créés :**
- `apps/api/src/utils/r2.ts`
- `apps/web/src/components/ui/ImageUploadZone.tsx`

**Fichiers modifiés :**
- `apps/api/package.json` (+ @aws-sdk/client-s3)
- `.env.example` (+ variables R2)
- `apps/api/src/routes/items.ts` (+ import r2, + route POST /:id/image)
- `apps/web/src/lib/api.ts` (+ itemsApi.uploadImage)
- `apps/web/src/components/ItemEditModal.tsx` (+ ImageUploadZone, mutation upload, sections IMAGE vs LINK/DOCUMENT)

**État :** EN COURS — compilation OK, code prêt, non committé. Reporté à demain pour test + commit.

**Pré-requis pour test :** Configurer un bucket R2 Cloudflare + renseigner les variables dans `.env`

---

#### [2026-02-10 21:45] - Landing Page publique

**Demande :** Créer une page d'accueil publique visible par les visiteurs non connectés, avec header (logo + connexion/inscription), hero, section fonctionnalités (6 blocs), section vues disponibles (6 modes), et footer.

**Actions réalisées :**
- Créé `apps/web/src/pages/LandingPage.tsx` : page complète avec header sticky, hero, 6 cartes fonctionnalités (icônes Lucide), 6 vues présentées, footer
- Modifié `apps/web/src/App.tsx` : ajout composant `HomeRoute` qui affiche LandingPage si non connecté, Layout (dashboard) si connecté. Import LandingPage.
- Style cohérent avec le design system existant (CSS vars HSL, Tailwind, classes Button réutilisées sur des Link)

**Fichiers créés :**
- `apps/web/src/pages/LandingPage.tsx`

**Fichiers modifiés :**
- `apps/web/src/App.tsx`

**État :** EN COURS — compilation OK, dev serveurs actifs, en attente de vérification utilisateur et commit

---

#### [2026-02-10 21:25] - Optimistic Locking avec résolution de conflit

**Demande :** Implémenter l'optimistic locking sur les items pour détecter les conflits d'édition concurrente et proposer un dialogue de résolution champ par champ.

**Actions réalisées :**
- **Types partagés** (`packages/shared/src/types/`) : ajout `updatedAt` dans `UpdateItemInput`, types `ConflictField` et `ConflictErrorResponse` dans `api.ts`
- **API** (`apps/api/src/routes/items.ts`) : ajout `updatedAt` au schéma Zod `updateItemSchema`, détection de conflit dans PATCH /:id (compare dates, construit liste des champs modifiés, renvoie 409 avec détail)
- **Frontend helper** (`apps/web/src/lib/api.ts`) : fonction `isConflictError()` pour détecter les 409 CONFLICT_DETECTED
- **Composant ConflictDialog** (`apps/web/src/components/ConflictDialog.tsx`) : modal de résolution avec radio par champ (serveur/mien), boutons raccourcis "tout garder du serveur/les miennes"
- **ItemEditModal** : inclut `item.updatedAt` dans le payload, détecte 409 via `isConflictError`, affiche ConflictDialog, résolution → re-mutation sans updatedAt (force overwrite)
- **SpacePage** : helper `handleInlineUpdate` passe `updatedAt` pour les updates inline, sur 409 invalide les queries (auto-reload)

**Fichiers créés :**
- `apps/web/src/components/ConflictDialog.tsx`

**Fichiers modifiés :**
- `packages/shared/src/types/item.ts`
- `packages/shared/src/types/api.ts`
- `apps/api/src/routes/items.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/components/ItemEditModal.tsx`
- `apps/web/src/pages/SpacePage.tsx`

**État :** EN COURS — compilation OK, dev serveurs démarrés, en attente de vérification utilisateur et commit

---

#### [2026-02-09 01:15] - Hiérarchie d'espaces (parentId)

**Demande :** Permettre qu'un espace ait un autre espace comme parent, créant une arborescence. Règles : seuls les GROUP peuvent être imbriqués, héritage communauté du parent, suppression cascade.

**Actions réalisées :**
- **Schéma Prisma** : ajout `parentId`, relation `SpaceHierarchy` (onDelete: Cascade), index sur `parentId`
- **Types partagés** : ajout `parentId` dans `Space`, `parent` dans `SpaceWithRole`, `parentId` dans `CreateSpaceInput` et `UpdateSpaceInput`
- **API spaces.ts** : création avec `parentId` (héritage communauté du parent), update avec validation circulaire (remontée chaîne parents), validation PERSONAL interdit
- **API admin/spaces.ts** : ajout `parentId`, `parent`, `childCount` dans list/get/update
- **API client** : `spacesApi.list()` accepte `parentId`, `spacesApi.update()` accepte `parentId`
- **Sidebar (Layout.tsx)** : `buildSpaceTree()` + composant récursif `SpaceTreeItem` avec expand/collapse persisté localStorage
- **Dashboard** : `SpaceCardWithChildren` pour affichage hiérarchique, sélecteur espace parent dans formulaire création
- **SpaceSettingsPage** : sélecteur espace parent (exclut soi-même et descendants)

**Fichiers modifiés :**
- `packages/database/prisma/schema.prisma`
- `packages/shared/src/types/space.ts`
- `apps/api/src/routes/spaces.ts`
- `apps/api/src/routes/admin/spaces.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/hooks/useSpaces.ts`
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/SpaceSettingsPage.tsx`

**État :** EN COURS — compilation OK, en attente de vérification et commit

---

#### [2026-02-09 00:15] - Vue graphe force-directed a 3 niveaux

**Demande :** Ajouter une vue graphe force-directed dans SPOK avec `react-force-graph-2d`, a 3 niveaux (espace, communaute, global), avec liens activables (hierarchie, relations, tags communs).

**Actions realisees :**
- Installe `react-force-graph-2d` dans @spok/web
- Cree `apps/api/src/routes/graph.ts` : 3 endpoints (space, community, global) construisant noeuds + liens (hierarchy, relation, tag)
- Enregistre dans `apps/api/src/index.ts`
- Ajoute `graphApi` dans `apps/web/src/lib/api.ts`
- Cree `apps/web/src/hooks/useGraphData.ts` (React Query)
- Cree `apps/web/src/components/views/GraphView.tsx` (~200 lignes) : ForceGraph2D, noeuds colores par type, liens colores par type, panneau de controle avec checkboxes, tooltip hover, bouton recentrer, persistence localStorage
- Ajoute `'graph'` au type ViewMode + icone Network dans ViewModeSelector
- Integre GraphView dans SpacePage (mode graph)
- Cree CommunityPage (`/communities/:communityId`) avec GraphView level=community
- Ajoute route dans App.tsx
- Ajoute onglet "Graphe global" dans DashboardPage

**Fichiers crees :**
- `apps/api/src/routes/graph.ts`
- `apps/web/src/hooks/useGraphData.ts`
- `apps/web/src/components/views/GraphView.tsx`
- `apps/web/src/pages/CommunityPage.tsx`

**Fichiers modifies :**
- `apps/api/src/index.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/viewMode.ts`
- `apps/web/src/components/ViewModeSelector.tsx`
- `apps/web/src/pages/SpacePage.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/App.tsx`

**Etat :** TERMINE

---

#### [2026-02-09 01:00] - Page admin Statistiques + fix hauteur graphe

**Demande :** Ajouter une page Statistiques dans l'administration (/admin/stats) avec totaux, series temporelles, repartition par type et top espaces. Aussi : corriger la zone de graphe qui ne s'etend pas a toute la hauteur disponible.

**Actions realisees :**
- Installe `recharts` dans @spok/web
- Cree `apps/api/src/routes/admin/stats.ts` : endpoint GET /admin/stats?period=7d|30d|90d|365d|all
- Enregistre dans `apps/api/src/index.ts`
- Ajoute `adminApi.stats` dans `apps/web/src/lib/api.ts`
- Cree `apps/web/src/pages/admin/StatsPage.tsx` : 4 cartes totaux, LineChart activite, BarChart par type, top 10 espaces, selecteur de periode
- Ajoute route dans App.tsx et lien sidebar dans AdminLayout.tsx
- Fix graphe : supprime h-[600px] fixe du Dashboard, ajoute min-h-0 sur main Layout, overflow-hidden conditionnel sur SpacePage

**Fichiers crees :**
- `apps/api/src/routes/admin/stats.ts`
- `apps/web/src/pages/admin/StatsPage.tsx`

**Fichiers modifies :**
- `apps/api/src/index.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/App.tsx`
- `apps/web/src/components/AdminLayout.tsx`, `apps/web/src/components/Layout.tsx`
- `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/SpacePage.tsx`

**Etat :** TERMINE
**Commits :** 5a2b108, 09aa5c3

---

#### [2026-02-09 00:40] - Filtre communautes + noeuds structurels graphe

**Demande :** Ajouter des checkboxes pour filtrer par communaute dans la vue globale, et relier les items orphelins a leur espace/communaute via des noeuds structurels.

**Actions realisees :**
- API : endpoint global accepte `communityIds` pour filtrer par communautes
- API : `buildGraph` ajoute des noeuds SPACE et COMMUNITY virtuels, lie les items racine a leur espace, et les espaces a leur communaute
- Frontend : fetch des communautes utilisateur, checkboxes dans le panneau de controle (scope global, > 1 communaute)
- Persistence localStorage des communautes selectionnees

**Fichiers modifies :**
- `apps/api/src/routes/graph.ts`
- `apps/web/src/components/views/GraphView.tsx`
- `apps/web/src/hooks/useGraphData.ts`
- `apps/web/src/lib/api.ts`

**Etat :** TERMINE
**Commit :** 61878ae

---

#### [2026-02-08 23:40] - Groupement natif ReactFlow pour les zones projet MindMap

**Demande :** Remplacer le mecanisme custom de groupement des zones projet (~200 lignes : rectangle de fond separe, drag manuel synchronise, calcul de bounding box) par le groupement natif ReactFlow v12 via `parentId`.

**Actions realisees :**
- Cree `getAbsolutePositions(nodes)` : parcourt la chaine `parentId` pour calculer la position absolue de chaque noeud (necessaire pour les edges apres groupement)
- Cree `applyNativeGrouping(nodes, tree, statuses, collapsedIds)` : collecte les PROJECT avec enfants visibles tries par profondeur (plus profond d'abord), cree des noeuds groupe, convertit les positions des membres en relatif, met `parentId` sur chaque membre
- Supprime `generateProjectGroupNodes()` (~60 lignes)
- Supprime `groupDragStart` ref et le code de sync manuelle dans `onNodeDrag` (~20 lignes)
- Supprime `onNodeDragStart` (init du group drag)
- Modifie `ProjectGroupNode` : supprime `pointerEvents: 'none'` du div principal et `pointerEvents: 'auto'` du titre
- Modifie la chaine de layout (useMemo, useEffect, resetLayout) : remplace `generateProjectGroupNodes` par `applyNativeGrouping` + `getAbsolutePositions`
- Modifie `onNodesChange` : utilise `getAbsolutePositions` au lieu de `node.position`
- Modifie `onNodeDragStop` : calcule les positions absolues avant de sauvegarder

**Fichier modifie :**
- `apps/web/src/components/views/MindMapView.tsx`

**Etat :** EN COURS
**Prochaine etape :** Verification visuelle — zones projet, drag groupe, drag enfant, edges, persistence positions, groupes imbriques, collapse/expand

---

#### [2026-02-08 23:15] - 4 ameliorations SPOK (breadcrumb, zoom MindMap, favicon)

**Demande :** Implementer 4 ameliorations identifiees : fil d'Ariane dans ItemEditModal, zoom projet MindMap, recherche contributions (deja fait), favicon optimise.

**Actions realisees :**
- **Breadcrumb ItemEditModal** : ajout d'un fil d'Ariane cliquable (Espace > Parent1 > ... > Item) en haut du modal. Navigue entre items via `onNavigate`. Nouvelles props `spaceName` et `onNavigate` passees depuis SpacePage.
- **Zoom projet MindMap** : double-clic sur un noeud PROJECT → affiche uniquement le sous-arbre de ce projet. Le noeud central affiche le nom du projet. Bouton "Vue complete" pour revenir. Etat `focusedProjectId` dans MindMapViewInner.
- **Recherche contributions** : deja implementee, aucune modification.
- **Favicon optimise** : redimensionne de 1536x1024 (2.2 Mo) a 32x32 (1 Ko) via Pillow.

**Fichiers modifies :**
- `apps/web/src/components/ItemEditModal.tsx`
- `apps/web/src/pages/SpacePage.tsx`
- `apps/web/src/components/views/MindMapView.tsx`
- `apps/web/public/favicon.png`

**Etat :** TERMINE
**Prochaine etape :** Verification visuelle puis commit si valide

---

#### [2026-02-08 13:30] - Appliquer les couleurs de type des referentiels partout

**Demande :** Appliquer les couleurs spécifiques du referentiel (color/bgHover par type d'item) dans toute l'application, au lieu des couleurs generiques (primary, outline, muted-foreground).

**Actions realisees :**
- Cree `getTypeColor()` et `getTypeTextColor()` helpers dans `apps/web/src/constants/ui.ts`
  - `getTypeColor(type, typeLabels?)` retourne `{ color, bgHover }` depuis les referentiels ou les defaults
  - `getTypeTextColor(type, typeLabels?)` retourne la classe texte correspondante via mapping explicite (pour Tailwind JIT)
- Modifie `ItemEditModal.tsx` : boutons de type (edit + lecture seule) utilisent la bordure coloree du referentiel
- Modifie `SpacePage.tsx` : filtres toolbar + selecteur type nouveau item utilisent la bordure coloree
- Modifie `ListView.tsx` : badge type avec bordure coloree
- Modifie `KanbanView.tsx` : icone type coloree (propagation de referentiels aux sous-composants KanbanColumn/KanbanCard)
- Modifie `GlobalSearch.tsx` : badge type avec label traduit + couleur de fond
- Modifie `SequenceView.tsx` : icone type coloree

**Fichiers modifies :**
- `apps/web/src/constants/ui.ts`
- `apps/web/src/components/ItemEditModal.tsx`
- `apps/web/src/pages/SpacePage.tsx`
- `apps/web/src/components/views/ListView.tsx`
- `apps/web/src/components/views/KanbanView.tsx`
- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/views/SequenceView.tsx`

**Etat :** TERMINE
**Prochaine etape :** Verification visuelle puis commit si valide

---

#### [2026-02-08 ~15:00] - Investigation regression profil utilisateur en production

**Demande :** La modale profil utilisateur n'est plus accessible en production et l'avatar ne s'affiche plus.

**Investigation :**
- Verification exhaustive du code : Layout.tsx, UserProfileModal.tsx, Modal.tsx, routes API, stores — aucune modification par nos commits
- Build de production : compile sans erreur
- Git local et remote synchronises
- Fonctionne en dev, pas en prod

**Diagnostic :** Le service **web** sur Railway avait des deploiements "removed" — le frontend n'etait plus deploye. Cause probable : limites du plan Railway, nettoyage automatique ou probleme de facturation.

**Resolution :** Force redeploy via commit vide (`32734c3`). Le service web a ete redeploye et tout refonctionne.

**Etat :** TERMINE
**Lecon :** En cas de "regression" en prod uniquement, verifier d'abord l'etat des deploiements Railway avant d'investiguer le code.

---

#### [2026-02-08 ~16:00] - Fix nginx workers OOM sur Railway

**Demande :** Comprendre pourquoi 11 deploiements "removed" ce matin sur Railway (service web).

**Diagnostic :** Les logs montrent que nginx lancait ~47 worker processes (`worker_processes auto;` detecte tous les CPUs du host partage Railway). Cela causait un depassement memoire → Railway arretait le conteneur → retentait → boucle de "removed".

**Actions realisees :**
- Transforme `docker/nginx.conf` d'un simple `server` block en config nginx complete
- Ajout `worker_processes 2;` et `worker_connections 512;` pour limiter la memoire
- Modifie `docker/Dockerfile.web` : copie vers `/etc/nginx/nginx.conf` (au lieu de `conf.d/default.conf`)
- Ajout `error_log /dev/stderr` et `access_log /dev/stdout` pour visibilite dans Railway
- Commits : `3f285c2` (fix workers) + `02e002c` (ajout logs)

**Etat :** TERMINE
**Lecon :** Sur Railway, nginx `worker_processes auto` cree un worker par CPU du host partage (~47), causant un OOM. Toujours forcer `worker_processes 2` pour les conteneurs Railway.

---

#### [2026-02-08 ~16:45] - MindMap : rayons dynamiques + blocs projet deplacables

**Demande :** Eviter la superposition des noeuds dans la carte mentale quand il y a beaucoup d'items. Permettre de deplacer les blocs projet avec leurs enfants.

**Actions realisees :**
- Remplace les constantes fixes (`BASE_RADIUS=450`, `RADIUS_INCREMENT=400`) par des rayons dynamiques
  - `dynamicBaseRadius = max(MIN_RADIUS, rootCount * (NODE_WIDTH+NODE_GAP) / 2pi)` pour les items racine
  - `dynamicChildRadius = max(MIN_RADIUS, childCount * (NODE_WIDTH+NODE_GAP) / angleRange)` pour les enfants
- Blocs projet maintenant draggables : quand on deplace un bloc, tous ses noeuds enfants se deplacent ensemble
  - `ProjectGroupNode` rendu interactif (cursor grab)
  - `onNodesChange` etendu pour detecter le drag d'un groupe et appliquer le delta a tous ses membres
  - Positions des membres sauvegardees a la fin du drag

**Fichier modifie :**
- `apps/web/src/components/views/MindMapView.tsx`

**Etat :** TERMINE

---

#### [2026-02-08 ~18:00] - MindMap : layout étoile + collisions zones projet

**Demande :** Améliorer le layout MindMap pour que les zones projet ne superposent pas d'autres éléments, et que les items soient mieux distribués.

**Actions réalisées :**
- Layout en étoile : chaque parent distribue ses enfants en éventail centré vers l'extérieur (60°-180° selon nombre d'enfants) au lieu d'hériter l'arc étroit du cercle global
- Résolution collisions projet : les noeuds étrangers sont poussés hors des rectangles englobants des projets (appliquée en dernier pour avoir la priorité)
- Résolution chevauchements : les noeuds trop proches sont écartés radialement (15 passes, gap minimum 30px)
- Espacement réduit dans les projets (rayon 180px au lieu de 300px)
- Tri des items par type (PROJECT, NOTE, TASK) puis par position
- Zones projet transparentes aux clics (pointerEvents: none) pour permettre de saisir les items en dessous

**Commits :** `717b916`, `0128134`, `b000057`, `00d7fd0`
**Etat :** TERMINE

---
