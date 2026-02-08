# Session Journal - SPOK

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
