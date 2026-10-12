# SPOK - Suivi des tâches

## À faire

### Responsive / mobile (relevé sur téléphone Android, 2026-10-07)
- [x] Accueil : aperçus Échéances / En retard / TODO / Non lus 1 par ligne sur mobile (`grid-cols-1 sm:2 lg:4`), en-tête de carte tronqué (badge + « Voir tout » toujours visibles) — 2026-10-10 (1a9dc90)
- [x] Carte mentale : sous-espaces superposés au-delà de 9 (pas fixe 40°) → pas 360°/N + rayon élargi ; anciens placements : bouton « Réorganiser » — 2026-10-10 (188e529)
- [x] Carte mentale : cadrage d'ouverture mobile, centré sur le nœud espace au zoom 0,6 si la carte entière serait illisible — 2026-10-10 (188e529)
- [x] Header : avatar coupé à droite → bloc titre `flex-1 min-w-0` (tronque), bloc droit fixe — 2026-10-10 (5cd6b20)
- [x] Icône PWA restée ancienne même après réinstallation (test Thomas 2026-10-10) : la prod servait la bonne icône, mais nginx mettait tous les .png en `immutable` 1 an → le téléphone gardait l'image de mars. Icônes renommées `favicon/icon-192/icon-512.v2.png` (manifest, index.html, sw.js, `CACHE_NAME` spok-v5) ; nginx : immutable limité à `/assets/` (Vite, avec empreinte), fichiers de `public/` en `no-cache`. MEP 2026-10-10 (47f0cff) — validé par Thomas sur téléphone le 2026-10-10
- [x] (Mineur) Accueil : libellé des raccourcis plus petit sur mobile (« Tableau de bord ») — 2026-10-10 (1a9dc90)

### BUG clés React dupliquées dans ItemEditModal
- [x] Warning "Encountered two children with the same key" à chaque rendu de la modale, sur TOUS les items. Diagnostic initial (doublons d'ids dans le cache, boucle de re-renders) erroné : `SaveAsTemplateModal` et `InsertTemplateModal`, enfants frères de `<Modal>`, portaient tous deux `key={itemId}` (posé le 2026-09-12 pour reset leur state). Pas de boucle — un warning par rendu, nombreux au chargement/à la saisie. Clés préfixées `save-tpl-`/`insert-tpl-` — 2026-09-27 (615b5af)
- [x] `SaveAsTemplateModal` : nom du modèle vide quand l'item est ouvert par lien direct après rechargement (`useState(item?.title)` évalué au montage, avant chargement d'`allItems`) — nom + description réinitialisés à chaque ouverture ; libellé accordé (« 1 élément sera capturé ») — 2026-09-28 (ddd4fb2)

### Groupes d'items liés par la date (déplacer toute une grappe)
- [x] Nouveau type de relation `drives` ("Entraîne", sens unique, écart déduit dynamiquement, chaîne transitive, détection de cycle) — spec `docs/superpowers/specs/2026-09-13-cascade-date-relation-design.md`, plan `docs/superpowers/plans/2026-09-13-cascade-date-relation.md`. Backend : `item-cascade-shift.ts` + `drivesGraph.ts` (revalidation serveur). Frontend : `lib/cascadeShift.ts`, `CascadeShiftConfirmModal`, branché dans ItemEditModal (sauvegarde) et nouveau drag de déplacement du corps de barre dans TimelineView ; type `drives` ajouté partout où les relations existent (ItemEditModal, PertView, TimelineView, MindMapView) — 2026-09-14 (4eae01d)
- [x] Extension enfants : la modale de confirmation propose aussi, séparément (case décochée par défaut), de décaler les enfants (`parentId`) de l'ancre — `utils/itemDescendants.ts` (backend, revalidation `drives ∪ descendants`), `computeCascadeDescendants` (frontend). La hiérarchie parent/enfant reste structurelle : ce n'est jamais automatique, toujours une proposition explicite — 2026-09-19 (58a3f6b)

### Modales et boutons (2026-09-28)
- [x] Bouton « Nouveau » des vues en bleu vif via composant partagé `NewItemButton` (19 vues) + zone dev `contenu-barre-vue` sur chaque `#view-header` — 2026-09-28 (3209561)
- [x] Focus des modales : `useDialogFocus` (focus initial selon la règle, Tab piégé, restauration) dans `Modal.tsx`, modales maison et dialogues relation/portail + contour `:focus-visible` global — 2026-09-28 (3dd9da7)
- [x] Faux conflit à l'enregistrement d'un item Image/Document/Diagramme (écritures directes sans relecture de la fiche) + bouton Enregistrer orange — 2026-09-28 (8fe8c8e)

### Refonte esthétique
- [x] Piste "Dense technique" choisie (canvas Claude Design, 3 directions explorées) : tokens globaux (IBM Plex Sans/Mono, palette gris-bleu froid, radius réduit), fond gris clair sidebar/header/toolbar de vue vs contenu blanc, cohérent clair/sombre — 2026-08-19
- [ ] Densité des composants (paddings/tailles par vue) — volontairement non touchée, à faire au cas par cas si besoin

### Modes d'interface (Forum / Projet / Exploration)

> Prérequis absolu avant de coder les modes : refactoriser ItemEditModal

- [x] **Étape 1 — Refactor ItemEditModal** : supprimer toutes les conditions d'affichage par type d'item (`if item.type === X`), repartir d'une base uniforme tous champs visibles — 2026-06-14
- [x] **Étape 2 — Implémenter le système de modes** : sélecteur global dans la navigation, stockage localStorage, store Zustand, filtres vues (SpaceToolbar + GlobalNavBar) et champs (ItemEditModal) — 2026-06-14
> Recadrage 2026-07-15 : le mode n'est plus une bascule utilisateur — il est dérivé du champ `Community.context` (FORUM/PROJECT, null = neutre « tous »), choisi par le propriétaire dans les réglages de la communauté. Sélecteur 4 boutons du header supprimé.

- [x] **Contexte de communauté** : champ `Community.context` + dérivation automatique du mode (Layout), sélecteur Contexte dans les réglages (OWNER), badge Forum/Projet dans le header, filtrage de la nav mobile aligné sur le bandeau desktop (`MODE_GLOBAL_EXCLUDED` partagé via le store) — 2026-07-15 (d44ca99)
- [x] **Étapes 3+4 (partiel) — Sélecteur de vues à 3 familles** : `MODE_ALLOWED`/`MODE_EXCLUDED` (blocage dur) remplacés par 3 familles fixes Discussion/Pilotage/Exploration (`SpaceToolbar.tsx`, `exploration` reprend la catégorie `VIEW_REGISTRY`) — le mode choisit la famille en boutons directs (FORUM→Discussion, PROJET→Pilotage), les 2 autres restent accessibles via dropdowns "Autres vues", plus rien n'est masqué. Vérifié en réel (communauté test, FORUM et PROJET) — 2026-08-19
- [x] **Bascule manuelle du mode** : boutons d'option Forum/Projet/Tous dans le header (à la place du badge de contexte, masqués sur mobile) — le contexte de la communauté donne le mode par défaut, le choix manuel le surcharge tant qu'on reste dans la même communauté (non persisté). Revient sur la décision 2026-07-15 (bascule utilisateur supprimée) — 2026-09-27 (e4a9661)
- [x] **Étape 3/4 — champs par contexte (périmètre : modale uniquement, choix Thomas)** : Forum = modale toujours réduite (plus de dépliage auto, qui l'ouvrait complète pour la quasi-totalité des items) + ligne de résumé cliquable des champs avancés renseignés (`buildForumSummary`) ; Projet/Tous inchangés (modale complète). Vues et création d'item volontairement hors périmètre — 2026-09-28 (321de3c)
- [ ] **Étape 5 — Exploration** : à repenser en « loupe » utilisateur activable partout (pas un contexte de contenu), spec à faire

### Cache PWA
- [x] Interface figée sur d'anciennes versions chez certains utilisateurs : `sw.js` caché à tort en `immutable 1y` par nginx (règle regex assets), aucun rechargement auto d'un onglet déjà ouvert à l'activation d'une nouvelle version — corrigé (`location = /sw.js` no-cache, `CACHE_NAME` bumpé, reload sur `controllerchange`) — 2026-08-24

### Sécurité API
- [x] Audit sécurité API (auth/JWT/CORS/upload/SQL) : rate limiting sur `/auth/*` (5 req/min/IP), `JWT_SECRET` sans fallback en dur (échec au démarrage si absent), refresh token hashé SHA-256 en base, `@fastify/helmet` — 2026-08-24
- [x] 403 à l'upload avatar/cover d'une communauté en mode admin (routes images réservées à l'OWNER sans bypass admin, contrairement à PATCH) — 2026-10-11 (0683134)
- [x] Même contrôle sur les routes avatar/cover des espaces (`spaces.ts`) : `getSpaceForImageEdit` → `isSpaceOwnerOrAdmin` sur les 4 routes, front via `uploadFile` (header admin) — déjà couvert par 7917dbe, vérifié le 2026-10-12

### Tests / qualité
- [x] BUG filtres échéances (GlobalTaskFilterBar) : corrigé — 2026-07-12
- [x] Réparer les TNR : 47 tests en échec réalignés sur les comportements actuels des routes — 422/422 verts — 2026-07-11
- [x] Routes graph.ts : accès public (visitorPreview) implémenté sur les 4 routes graphe/sunburst — anonyme et non-membre voient les communautés publiques, 403 propre sinon, plus aucun crash 500 — 2026-07-12
- [x] spaces.ts DELETE /:id : commentaire corrigé — CommunityRole n'a que OWNER/MEMBER, pas d'ADMIN au niveau communauté, le code était déjà correct — 2026-07-12
- [x] Couverture community-referentiels.ts : 13 tests (GET public, PUT/reset réservés OWNER, check-status-usage) — 2026-07-12
- [x] Fix layout MindMap : reparentage décalant des branches entières — reset des positions sauvegardées sur toute la branche racine affectée (ancien ET nouveau parent), pas seulement le parent direct — 2026-07-14 (e85c56d)
- [x] MindMap layout incrémental : la carte ne bouge plus globalement — layout complet seulement au premier rendu/repli/portails/bouton Réorganiser ; ajout/suppression/reparentage = ré-éventail local du/des parent(s) affecté(s) (module pur `mindmap-incremental.ts`, 12 tests), relations = arêtes seules, `clearAffectedBranches` supprimé — spec/plan docs/superpowers 2026-07-15 — 2026-07-15 (13e7083)
- [x] BUG clic résultat recherche (SearchPage) : le lien ouvrait l'espace mais pas la modale item — passait `openItemId` en `state` du router, jamais lu (SpacePage ne lit que le param d'URL `?item=`) — corrigé (+ même bug sur clic nœud graphe dans DashboardPage/GraphPage) en alignant sur le pattern `?item=id` déjà utilisé par GlobalSearch — 2026-08-11

### Didacticiels / aide contextuelle
- [ ] Revoir tous les tours de vues : contenu manquant ou absent (thread, text, et potentiellement d'autres) — pour chaque vue, soit compléter les étapes dans viewTours.ts, soit supprimer le bouton aide

### UX & formulaires
- [x] Recherche : portée par défaut = espace (sous-espaces inclus) ou communauté d'où on la lance, élargissement explicite ; fix choix communauté écrasé ; utilisateurs filtrés par portée — 2026-10-11 (51bc4ee)
- [x] Sidebar : visibilité des communautés (globe/œil/cadenas, non membre grisé, « Invitation », bouclier admin) ; communautés privées visibles/accessibles par des non-membres quand isPublic est désynchronisé → GET /communities, /:id, /:id/members sur visibility seul, création admin renseigne visibility — 2026-10-11 (18f3be3)
- [x] BUG upload avatar/couverture communauté (et espace, profil) : 403 pour un admin en mode admin non OWNER — uploads en fetch direct sans X-Admin-Mode ni refresh 401 → helper `uploadFile` via fetchApi — 2026-10-11 (c12ca0a)
- [x] Visibilité affichée en pastille (`VisibilityPill`, lue sur visibility) : cartes de /communities, en-tête de la page communauté, vignettes d'espace (visibilité effective, « · hérité » en pointillé si héritée) — 2026-10-11 (3d33f79)
- [x] Vignettes communauté/espace : raccourcis paramètres (OWNER/admin) + vue par défaut (espace), groupés avec la pastille en bas à droite sous l'image — 2026-10-11 (a726011)
- [x] SpaceSettingsPage : vue par défaut non réglée affichée « Liste » (comme SpacePage) au lieu de « Fil » — 2026-10-11 (aa95e92)
- [x] Mode admin = droits OWNER sur communautés et espaces (API isOwnerOrAdmin / isSpaceOwnerOrAdmin + écrans de paramètres) ; PATCH communauté PRIVATE → public soumis à validation admin (sauf mode admin) — 2026-10-12
- [x] Mode admin phase 3 : checkSpaceAccess(…, isAdminMode) → OWNER dans tout espace (items, tags, relations, contributions…), GET /spaces et /spaces/:id en OWNER (sidebar : espaces de toutes les communautés, privés compris), création de séance, annulation d'invitation — 2026-10-12
- [x] BUG visibilité d'espace jamais enregistrée (PATCH) + choix « Héritée » dans les paramètres — 2026-10-12
- [x] Admin global HORS mode admin = utilisateur normal (règle Thomas) : plus de lecture d'office — checkSpaceAccess (rôle 'ADMIN' supprimé), GET /spaces/:id, filterReadableSpaceIds (graphes), recherche — 2026-10-12 (f0c4574)
- [x] Séances live (JDR) : vignette image/schéma à gauche du titre en préparation (`thumbnailUrl`, animateur/présentateurs seulement, null pour les participants) ; liste d'invitation vide expliquée (`NoInviteCandidates` : ajouter d'abord les joueurs à la communauté + lien) — 2026-10-12 (169b5d5)
- [ ] Actions d'animation des séances live réservées à l'animateur, admin compris — à ouvrir au mode admin ?
- [x] PATCH /spaces/:id aligné : isSpaceOwnerOrAdmin (OWNER de l'espace ou de la communauté, admin en mode admin) — un admin global hors mode admin est refusé (validé Thomas) — 2026-10-12 (e86878b)
- [x] Demande de publication : « Annuler la demande » dans les paramètres (PATCH visibility PRIVATE sur communauté privée = annulation) ; reject-public vide aussi pendingVisibility — 2026-10-12 (5494c5b)
- [x] Données prod : isPublic/visibility resynchronisés (ShadowWorld, Découvrir SPOK, GBK Team Forum) — `check-community-visibility.ts --prod` : 14 communautés, 0 incohérente — 2026-10-12
- [x] `isPublic` n'est plus lu nulle part dans l'API pour l'accès/les listes : `visibility !== 'PRIVATE'` seul dans graph, items, spaces, search, communities, admin/users (OR permissifs et AND restrictifs) ; PATCH /admin/communities/:id convertit isPublic en visibility (source de désynchro) — 2026-10-12 (ac14b92)
- [ ] Recherche (/search) — reste du diagnostic 2026-10-11 : filtres items (type/statut/tags) sans effet sur les sections communautés/utilisateurs (les masquer ou filtrer les contributions via l'item) ; champ Tags texte libre → sélecteur ; filtre Statut absent + types d'item en codes bruts ; pagination commune à toutes les sections ; périmètre incohérent (communautés publiques visibles mais pas leurs espaces/items) ; écarts doc : 20/page vs 10, min 2 caractères vs 1
- [x] BUG modale item périmée : changements faits dans les vues (date Gantt, statut MindMap…) ou par absorption invisibles à la réouverture jusqu'au rechargement — fiche relue à chaque ouverture (staleTime 0) + formulaire resynchronisé sur `updatedAt` avec fusion champ par champ (`mergeFormWithServer`, saisie en cours conservée) — 2026-09-28 (fb47579)
- [x] BUG MindMap : actions des nœuds périmées depuis le layout incrémental (callbacks stockés dans `data` jamais rafraîchis) → ex. suppression d'un parent vidé annonçant encore « N descendants » jusqu'au rechargement. `withCurrentCallbacks` + effet sur `layoutCallbacks` — 2026-09-28 (d1cd6dc)
- [x] « Absorber les enfants » n'est plus proposé sur un item sans enfant (erreur serveur « No children to absorb ») — `hasChildItems` (itemMenuGroups, 3 tests) appliqué aux 13 menus contextuels + bouton de la modale conditionné sur `allItems` — 2026-09-28 (8d2b626)
- [x] Connexion : dernier e-mail connecté mémorisé (localStorage `spok_last_login_email`, après connexion réussie uniquement) et pré-rempli, focus sur le mot de passe ; `autoComplete` username/current-password pour le gestionnaire du navigateur. Jamais le mot de passe — 2026-09-28 (7a9e875)
- [x] /today — D&D tâche→grille : glisser une tâche ou une suggestion de la liste sur la colonne Tâches (placement à l'heure du drop, snap 15 min) + grille en 2 colonnes Agenda/Tâches — 2026-07-12
- [x] /today — D&D événement→liste : glisser une réunion (bandeau journée entière ou colonne Agenda) sur la liste du jour crée une TASK et l'engage — espace cible = espace personnel (résolu via SpaceMembership OWNER + type PERSONAL, le plus ancien) — 2026-07-12
- [x] Vue Texte : export PDF réécrit pour refléter le document affiché (arbre, descriptions, contributions, filtre de recherche, sections portails) au lieu du tableau générique — 2026-07-14 (71071f0)
- [x] ItemEditModal : dates (Début/Fin/Échéance) réaffichées pour les types Lien/Doc/Image/Diagramme (masquées à tort par `isExclusiveType`) — vides par défaut, rien ne les préremplit — 2026-07-14
- [x] ItemEditModal : description visible pour tous les types (gate `isExclusiveType` retiré du bloc Description) — 2026-07-15 (c43ccdf)
- [x] ItemEditModal mode Forum : grille 2 colonnes (colonne centrale Type/Statut/Priorité/Dates supprimée, blocs media relocalisés sous la Description), Description en `fillHeight` 80vh (nouveau prop `RichTextEditor`) — 2026-09-07
- [x] BUG ItemEditModal : faux positif `hasChanges` sur tout item daté (guard « quitter sans sauvegarder » sans modification) — comparaison de dates state (heure locale, tronquée minute) vs `item.xxxDate` (ISO UTC + secondes) ; `toMinuteISO()` sur les deux côtés — 2026-09-07 (abfd068)
- [x] MyDashboardView (onglet Tableau de bord) : `doneData` reprend `filters.queryParams` (au lieu de hardcoder type/status) → répartitions « Par statut/type », « Progression », KPI « terminés » suivent la barre de filtres. Réagencement : répartitions en bande pleine largeur `grid` (au lieu de colonne 256px), Échéances `flex-[2] min-w-[672px]` sans max, colonne listes `max-w-[560px]`, badges d'espace tronqués — 2026-09-07
- [x] ItemEditModal mode Forum : description à hauteur adaptée au contenu (240px min, plafond 40vh puis scroll interne) au lieu de 80vh fixe — les contributions restent visibles dessous. Prop `fillHeight` de `RichTextEditor` supprimée, `defaultMaxHeight` accepte une valeur CSS — 2026-09-27 (3553c56)
- [x] ItemEditModal : barre de défilement horizontale parasite — surlignage des contributions non lues en `px-2 -mx-2` (marge négative de 8px) dépassant du conteneur scrollable (`pr-1` = 4px) ; `px-2` appliqué à toutes les contributions, plus de marge négative — 2026-09-27 (3e5401c)
- [x] BUG dashboard « DeadlinesView ne filtre pas la priorité » : le filtre fonctionnait, mais les badges de priorité de `DeadlinesView` (et la ligne Priorité de `DeleteConfirmModal`) utilisaient une table locale à l'échelle inversée (1 = Critique au lieu de 1 = Basse / 4 = Urgente) → badges contredisant le filtre. Tables locales remplacées par `PRIORITIES` (constants/ui) — 2026-09-28 (418ed50)
- [x] `DuplicateToSpaceModal`/`bulk-duplicate` : itérations (1-365) + décalage calendaire jour/semaine/mois/an cumulatif, fix copie startDate/endDate (auparavant seul dueDate copié) — 2026-09-12
- [x] Modale Forum : toggle « Plus de champs » (`forumExpanded`/`showAll`) — modal réduit (titre/description 80vh/contributions) par défaut, déplié = modal 3-col complet (Type tous groupes, Statut, Priorité, Dates, Assigné, Dépendances, Parent, Tags, Enfants). Auto-ouvert si type≠Note / priorité / dates / assigné / relations — 2026-09-07
- [x] BUG accueil : « Échéances proches » / « TODO assignés » ne montraient que les Tâches — `GET /user/tasks` retombait sur `type=TASK` sans param. Défaut supprimé : tous types sauf si `type=` explicite. `/tasks` reste « Tâches » (filtre client) — 2026-09-07
- [x] Fix /contact et /sitemap sans sidebar/bandeau pour un utilisateur connecté (isAuthPage traitait ces pages publiques comme les pages d'auth) — 2026-07-15 (e8230cf)
- [x] /today — colonnes par agenda : une colonne par feed ICS + colonne SPOK dédiée + Tâches unique, pastilles de visibilité persistées (localStorage) indépendantes du `enabled` des feeds — spec docs/superpowers/specs/2026-07-18 (chantier 0 de la réflexion multi-contextes ; chantiers 1-3 : horizons+revue, fenêtres de faisabilité, placement contraint — à arbitrer) — 2026-07-18 (093631b, largeurs dcbe5bf : liste fixe 380px, min 110px/colonne + scroll horizontal)
- [x] /today — menu contextuel enrichi : M'assigner + Modifier le statut (référentiels par défaut, compromis /tasks) ; Déplacer/Dupliquer/Fusionner/Ajouter un enfant restent non câblés (modales d'espace à extraire de SpacePage si besoin) — 2026-07-18 (093631b)
- [x] Horizons temporels + revue de rattrapage (chantier 1) : champs manualHorizon/horizonSetAt, /tasks regroupé par horizon (Maintenant/Aujourd'hui/Semaine/Mois/Plus tard/À trier), section « À réviser » dans /today (bac à trier + horizons dépassés, jamais LATER, hauteur plafonnée avec scroll interne) — grille /today réorganisée en 2 colonnes (agendas 2/3, À réviser + Ma liste du jour côte à côte sur le 1/3 restant) — spec docs/superpowers/specs/2026-07-19-horizons-revue-design.md — 2026-07-19
- [x] Type UNDEFINED ("Non défini") : nouveau type par défaut à la création, groupé visuellement (Défaut/Activités/Livrables) dans le sélecteur — fix API startDate forcé à `new Date()` à la création — `isExclusiveType` entièrement retiré d'ItemEditModal (tous les champs visibles pour tous les types) — nouveau registre de règles de gestion `businessRules.ts` + icône d'indice dev-only `RuleHint` sur les boutons type/statut — 2026-07-25
- [x] Vue Gantt — échéance en direct : clic droit sur la zone chronologique d'une ligne = poser/déplacer l'échéance au jour sous le curseur (heure conservée, sinon 12:00 local), glisser le losange = déplacer, clic droit sur le losange = supprimer. Sans confirmation ni cascade « Entraîne ». Helpers `lib/timelineDueDate.ts` (8 tests), `dueDate` ajouté à la mise à jour optimiste de `useSpaceActions` — 2026-09-28 (c6af7e0)
- [x] BUG Gantt : glisser une tâche sans date de fin la faisait « disparaître » — la barre (dessinée jusqu'à aujourd'hui) était réduite à 1 jour près de son début (fin = début + delta), souvent hors période visible. Fin de référence = fin affichée (`moveInitialEnd` dans timeline-utils, 5 tests) : la barre se déplace telle quelle et reçoit une date de fin — 2026-09-28 (acfeb0f)
- [x] Gantt : barre pointillée d'un parent sans dates (période dérivée des enfants) désormais saisissable — glisser = « Décaler le groupe ? » (`CascadeShiftConfirmModal` mode `anchorWithoutDates` : enfants cochés par défaut, liés « Entraîne » inclus, « Annuler » ne modifie rien), le parent n'est jamais daté — 2026-09-28 (fdb9873)
- [x] Gantt zoom trimestre/année/multi-années : le déplacement de barre s'aimantait au lundi / 1er du mois / pas de 90 j (la date elle-même) → petit glisser sans effet, ou barre qui recule/saute d'un mois. Déplacement désormais au jour près dans tous les zooms ; le resize (poignées) garde son aimantation — 2026-09-28 (6c8474b)
- [x] Import en masse dans les vues Images et Documents (bouton + glisser-déposer, un item par fichier) + réduction d'image dans le navigateur avant envoi (1920 px WebP, GIF exclus) — MEP 2026-10-11 (c3c12ad) — envoi R2 en prod vérifié par Thomas (2026-10-12)
- [x] Règles d'envoi en double web/API : source unique `packages/shared/src/utils/uploadRules.ts` (`validateUpload`, sans File) — web (adaptateur `lib/uploadRules.ts`), item-uploads, avatars/covers espaces/communautés/profil, plafond multipart ; le web bloque aussi les types MIME exécutables — 2026-10-12 (bd20247)
- [ ] Vue Tableau croisé : export dédié (CSV ou Excel avec lignes/colonnes du tableau)
- [ ] Pages globales (Liens, Images...) : revoir le filtre/navigation (vue d'espace + vue transverse globale)
- [ ] Page favoris / epingles (espaces, items, pages epingles par l'utilisateur)
- [ ] Whiteboard : tableau blanc collaboratif (dessin libre, post-its, formes)
- [ ] Mermaid : rendu de diagrammes Mermaid dans l'éditeur ou les descriptions
- [ ] ajouter un correcteur d'orthographe dans les zones de textes

### Evolutions (backlog récupéré depuis Projet SPOK)
- [x] Organigramme à revoir : `OrgChartView` (membres/rôles d'un espace) faisait doublon avec `SpaceMembersManager` sur `SpaceSettingsPage` — moteur de layout extrait en composant partagé `BoxTreeDiagram` ; nouvelle vue admin `/admin/users/:userId/access` (arbre communautés→espaces avec accès effectif d'un utilisateur : direct/hérité de la visibilité/aucun) répond au vrai besoin identifié (voir qui a/pourrait avoir accès à quoi) — 2026-07-14
- [ ] Recherche dans la vue
- [ ] Réduction de données
- [ ] Identification d'élément
- [x] « Marquer comme non lu » : notifications (cloche, `PATCH /notifications/:id/unread`) et items (menus contextuels de toutes les vues + modale ; `ItemView.markedUnread`, `POST /activity/items/:id/unread`, effacé à l'ouverture). Item marqué → Activité / Non lus quels que soient âge, auteur, espace (perso → groupe « Espaces personnels ») + clignotement — 2026-09-28 (2963b42)
- [x] Accusé de lecture à l'assignation — `Item.assignedAt/assignedById`, `utils/assignment.ts` (tampon sur création/PATCH/fusion/restauration d'audit, calcul groupé), `assignmentReceipt` renvoyé par liste/fiche/`/user/tasks` ; modale « Vu par X le … » / « Pas encore vu », œil barré dans la vue Membres et à côté du titre dans la page Tâches (pas de colonne Assigné) — 2026-09-29 (a2eb5d9)
- [x] Chemin critique Gantt/PERT en CPM standard (item isolé jamais critique, fin de chaîne = fin du projet) — 2026-09-29 (e2fdbbe)
- [ ] (historique) Accusé de lecture à l'assignation : quand un item est assigné à quelqu'un, montrer à l'assigneur si l'assigné l'a consulté depuis l'assignation (ex. « Vu par Alice le 3 oct. » / « Pas encore vu ») — s'appuie sur `ItemView` de l'assigné (demande Thomas 2026-09-28, scope limité aux assignations)
- [x] Exploiter la table `ItemView` : déjà faite avant 2026-09 (feed /activity, panneau Non lus, clignotement des items non vus, badge « Nouveau » des contributions) — entrée obsolète, close le 2026-09-28

### IA / Résumés
- [ ] Résumé de conversations avec identification des consensus (style Reddit TL;DR)
  - Backend : `POST /:id/summarize` → appel Claude API (Haiku), crée une contribution SUMMARY
  - Prompt structuré : synthèse, points de consensus, désaccords ouverts, décisions actées
  - Frontend : bouton "Résumer" sur vue détail item (si contributions > 0), style distinct (badge IA)
  - Prérequis : `@anthropic-ai/sdk` dans apps/api, `ANTHROPIC_API_KEY` dans .env

### Intégrations externes
- [x] Lecture des calendriers externes (Outlook/Hotmail) par abonnement ICS — page « Ma journée » (/today) : réunions + liste du jour persistée + time-blocking (grille 7h-20h) — 2026-07-12
- [ ] Connexion calendrier messagerie (suite) : pousser des RDV (items MEETING) vers Outlook via Microsoft Graph API / Google Calendar API — l'ingestion est derrière l'interface CalendarSource, prête pour Graph
- [x] Limite connue : abonnement ICS (« Publier ce calendrier ») indisponible sur comptes employeur/client de Thomas — option de publication absente d'Outlook, probable politique RSSI. Pas un bug SPOK. Comptes perso connectés en live (Hotmail, roedelthomas, Travail, domestique, divers) ; agenda « Matthias » cassé côté Microsoft (500 sur ce flux précis), contournement : export .ics → nouvel agenda → republier (manip Thomas) — 2026-07-18

### Outillage Claude

- [x] MCP SPOK 401 : `apps/mcp/src/client.ts` écrasait les credentials par ceux de `apps/mcp/.env` (copie d'avant la rotation 2026-07-11) — ne remplace plus une variable déjà définie ; config user refaite via `claude mcp add` → `launch.mjs` (.env racine, plus de mot de passe en clair) — 2026-09-27 (9c5cb31). `apps/mcp/.env` n'existe plus (constaté 2026-09-28)
- [x] MCP SPOK 401 (2e cause) : `launch.mjs` tronquait les valeurs `.env` au premier guillemet — lecture brute — 2026-09-28 (93c6545)
- [x] MCP SPOK résultats vides sans erreur : token 15 min expiré → routes `optionalAuthenticate` traitées en anonyme, pas de 401 donc pas de re-login — re-login avant l'`exp` du JWT — 2026-09-28 (4db5fb2). Actif après redémarrage de Claude
- [x] Rattrapage doc SPOK de tout ce qui a été livré depuis le 11/07 (MCP en panne) — ~35 items mis à jour, 17 créés, tous `to_validate` — 2026-09-28
- [x] MCP `create_space` cassé (400 : `type` jamais envoyé) + visibilité demandée ignorée (POST /spaces n'accepte pas `visibility` → espace visible dans une communauté publique) — fix MCP (type GROUP + PATCH visibilité) — 2026-10-11 (fc37006). POST /spaces accepte `visibility` (GROUP), create_space l'envoie dans le POST sans PATCH de rattrapage — 2026-10-12 (f0c4574)
- [x] MCP distant étape 1 : POST /mcp dans l'API (jetons personnels spok_pat_, portées read/write, périmètre /spaces /communities /search /notifications), packages/mcp-core partagé (instructions serveur, get_space_conventions, validation statut/type/dates/parent/tags, Markdown → HTML), audit changes.source, UI Profil → Accès Claude ; tags MCP réparés (/tags inexistant) ; create_contribution réparé — 2026-10-12 (a65c23a) ; découverte llms.txt + erreurs /mcp explicites + correctifs revue sécu (ids, lots, débit) — 2026-10-12 ; trustProxy 2 (IP client réelle derrière les 2 proxys Railway, quota par IP n'est plus commun) — 2026-10-12 (0ad5403) ; accès MCP accordé par l'admin (demande depuis le profil, colonne MCP admin, jetons coupés sans accès) — 2026-10-12 (b081266) ; alerte admin sur tentative refusée + échappement HTML des emails (8a8c9e6) — 2026-10-12
- [ ] MCP distant étape 2 : OAuth (claude.ai / Claude Desktop), outil d'import d'arbre en un appel avec aperçu (import .md/.pdf par d'autres utilisateurs)
- [ ] Doc SPOK à valider par Thomas (items `to_validate` du 2026-09-28), dont : item « Sélecteur de vue » (Structure) = doublon probable de « Bandeau de navigation [GlobalNavBar] » ; page Activité : fonctionnement de la sourdine à préciser ; ancienne arborescence ItemEditModal dans « Les modales » non mise à jour (référence = espace Items)
- [x] `RelationTooltip` : libellés/couleurs alignés sur `RELATION_TYPES` (Bloque, Permet, Entraîne, Lié à), `depends` retiré — 2026-09-28
- [x] Types de relation — code (2026-09-28, 069d869) : source unique `constants/relationTypes.ts` (9 tables locales remplacées), ordonnancement = blocks + implements partout (Gantt CPM aligné sur le PERT, PERT ne fait plus ordonner `relates` en sens inverse), Entraîne affiché et filtrable dans le PERT, carte des relations avec les 4 types, API `z.enum(RELATION_TYPES)`, MCP enum, seed corrigé
- [x] Types de relation — données prod : script `apps/api/scripts/migrate-relation-types.ts` (ligne `depends_on` complétée et `--prod --apply` lancé par Thomas, classifieur auto-mode ayant bloqué Claude). 31 relations converties en `blocks` inversé (18 `depends` + 13 `depends_on`), 0 fusion ; revérification : aucune relation hors liste — 2026-09-28
- [ ] (historique) Types de relation : source unique côté web (libellés, couleurs, sens). `depends` (hors `RELATION_TYPES`, l'API accepte tout `z.string()`) survit dans le chemin critique Gantt (`timeline-utils`), le PERT (`pert-utils`), `mindmap-layout`, `RelationsMapView` (filtre par défaut blocks/depends/relates → Permet et Entraîne masqués) et l'en-tête de `item-relations.ts` ; le seed crée `tests`/`duplicates`. Décider aussi de la validation API (enum) et du sort des relations `depends` éventuelles en prod

- [x] Skill `spok-layout` : documente Layout.tsx/GlobalNavBar.tsx (anciens MainMenu.tsx/Sidebar.tsx, supprimés) — invariants, régressions passées (z-index, overflow-hidden, polling sidebar, largeur toggle), fichiers clés — ARCHITECTURE.md et CLAUDE.md mis à jour avec les noms de fichiers réels — 2026-07-14
- [x] `dev-autostart.ps1` : attend la readiness (`:3000` + `:3001/health` = 200) puis ouvre Chrome sur localhost:3000 — plus d'actions manuelles au démarrage — 2026-08-31 (bea0bcd)
- [x] Boutons Déconnexion / Mode admin / Mode dev (compact) + « Retourner à » déplacés de la section « Divers » du bandeau vers la row 1 du header, avant la vignette utilisateur (desktop uniquement, mobile inchangé) — 2026-08-31
- [x] `DevZoneInspector` : inspecteur de zones dev-only — encadrés colorés permanents (`data-devzone`) sur sidebar/header/bandeau/toolbar/contenu + sous-zones sidebar, nom de la zone au survol, piloté par le mode dev — 2026-08-31
- [x] Badges de nom de modale en mode dev : nouveau `DevModalBadge` (+ prop `devName` sur `Modal.tsx`), posé sur les 16 modales basées sur `Modal.tsx` et sur la quinzaine de modales maison (overlay fait main) — 2026-09-14 (e1f83e4)

## Idées (à explorer)

### Monitoring (priorité basse)
- [x] Sentry — error tracking : code en place API + web, no-op sans DSN — reste (Thomas) : compte sentry.io + DSN dans Railway — 2026-07-11

### Libs à intégrer (priorité haute)
- [ ] cmdk — palette de commandes (Ctrl+K) : navigation rapide, recherche, actions
- [ ] Mermaid — rendu de diagrammes texte dans les descriptions TipTap
- [ ] Excalidraw — whiteboard embarquable React (pour la tâche Whiteboard)

### Libs à intégrer (intéressant)
- [ ] Yjs — édition collaborative temps réel (CRDT), nécessite WebSocket
- [ ] Tiptap extensions — tableaux imbriqués, bloc diagram-as-code dans l'éditeur
- [ ] Markmap — mindmap généré depuis du Markdown
- [ ] Cytoscape.js — remplacement potentiel de D3 pour les grands graphes

### Séances de présentation live
- [x] Conception close le 2026-10-10 (plan : `docs/superpowers/plans/2026-10-10-live-sessions-socle.md`) : espace dédié daté (sous-espace PRIVATE), création réservée aux OWNER de la communauté, accès = membres de l'espace parent, transport SSE, copies verrouillées (organisation libre, commentaires/relations), affichage libre multi-présentateurs, journal chronologique, fenêtre flottante, desktop uniquement
- [x] Étape 1 « Socle » — 2026-10-10 (3b87228)
- [x] Étape 2 « Préparation et séance active » — 2026-10-10 (3b87228) (plan `docs/superpowers/plans/2026-10-10-live-sessions-preparation.md`) — statut préparée, programme, fenêtre qui suit la navigation, actions sur les items, révélation progressive des sous-items, rangement sous la copie du parent d'origine
  - Ajouts du 2026-10-10 : question « avec les sous-éléments ? », « À révéler » réservé à l'animateur, une seule séance en cours par espace, suite de séance (nouvelle séance liée : programme non présenté + éléments présentés recopiés)
- [x] Adaptation mobile : fenêtre en direct plein écran sur écran étroit, bascule « Voir l'espace » / « Retour au direct » — 2026-10-10 (571f586)
- [x] Sidebar : nouvel espace de séance visible immédiatement (invalidation ['sidebar-spaces']) — 2026-10-11 (f7a99c1)
- [x] Durcissement sécurité (revue automatique : cascade, programme filtré participants, périmètre des sous-éléments, restauration d'audit, présentateurs de la suite) — 2026-10-10 (537494d)
- [x] Préparation initiale à la création (« Préparer la séance ») — 2026-10-11 (efa3715, 2048994) — LOCAL, non poussé
- [x] Invités d'une séance (membres de la communauté sans accès au parent, à la création et depuis le bandeau, repris dans la suite) — 2026-10-11 (8f5fdd2..HEAD) — LOCAL, non poussé ; limites : flux SSE non coupé au retrait, nom du parent visible
- [x] Fuite : espace PRIVÉ accessible à tout membre de la communauté — GET /spaces/:id (fiche, aussi pour un anonyme d'une communauté publique), GET /:id/members, POST /:id/join (adhésion libre = accès complet aux items), POST / sous un parent privé. Tout passe par checkSpaceAccess / visibilité effective ; READONLY renvoie VIEWER — 2026-10-12 (ac14b92)
- [x] Propriétaire de communauté = OWNER dans tous les espaces de sa communauté, privés compris (checkSpaceAccess, isSpaceOwnerOrAdmin, GET / sidebar, GET /:id, PATCH, join) — 2026-10-12 (ac14b92)
- [x] Revue sécu de ac14b92 : graphes/sunburst (items des espaces privés aux membres de la communauté, `additionalSpaceIds` jamais contrôlé → items de n'importe quel espace) → `filterReadableSpaceIds` (items.ts, règle checkSpaceAccess en masse) ; PATCH /spaces/:id parentId = écriture au parent requise ; join réservé aux espaces OUVERTS (READONLY donnait MEMBER, pas de rôle VIEWER en base) — 2026-10-12 (144474b)
- [x] Sidebar (GET /spaces) : espaces non-membre filtrés sur la visibilité effective (`getEffectiveVisibilities`, version en masse dans items.ts) — sous-espace hérité d'un parent privé retiré, rôle implicite selon la visibilité héritée (anonymes compris) ; OWNER de communauté et mode admin : liste complète — 2026-10-12 (e86878b)
- [ ] Plus tard : compte-rendu généré à la clôture ; tri « présenté le » dans les vues
- [ ] Plus tard (peut-être) : invités sans compte, réactions/votes/questions, passage de main, mobile

### Serveur MCP (Model Context Protocol)
- [x] Section de conception close le 2026-09-28 — le serveur existe et sert en prod (doc SPOK : Système › Architecture technique › « Serveur MCP SPOK [apps/mcp] »). Réponses de fait aux 6 questions d'origine :
  - Intérêt / cas d'usage : Claude lit et écrit dans SPOK (recherche, CRUD, mise à jour de la documentation) ; résumé et analyse de graphe faits côté Claude, pas d'outil dédié
  - Architecture : serveur séparé `apps/mcp` (stdio), client de l'API REST de prod — pas intégré à Fastify
  - Ressources : aucune ressource MCP, uniquement des outils
  - Outils (44) : espaces, items (dont `search_items`), communautés, utilisateurs, contributions, tags, membres d'espace et de communauté, notifications, relations (types limités à blocks/implements/drives/relates depuis le 2026-09-28)
  - Auth : compte utilisateur (e-mail + mot de passe du `.env` racine via `launch.mjs`) → JWT, reconnexion avant expiration (4db5fb2) ; pas de clé API dédiée

