# SPOK - Suivi des tâches

## En cours

### Phase 5 — Refactoring fichiers critiques (audit)
- [x] items.ts (1716 → 7 fichiers, ~110-380 lignes chacun) — 6e5e414 (2026-02-25)
- [x] MindMapView.tsx (2553 → 4 fichiers : utils 248, nodes 278, layout 480, view 780) — 267f387 (2026-02-25)
- [x] SpacePage.tsx (2016 → 4 fichiers : tree-view 310, actions hook 220, toolbar 270, page 760) — a3168fd (2026-02-25)
- [x] ItemEditModal.tsx (1339 → 3 fichiers : constants 56, helpers 38, modal 1247) — addd2af (2026-02-25)
- [x] TimelineView.tsx (1131 → 4 fichiers : constants 33, utils 50, tree 64, view 988) — addd2af (2026-02-25)
- [x] SequenceView.tsx (1040 → 4 fichiers : chains 216, SVG 97, utils 32, view 698) — addd2af (2026-02-25)

### Phase 4 — Tests unitaires et d'intégration (audit)
- [x] Auth tests (29) — ee2359f (2026-02-25)
- [x] Items tests (35) — ee2359f (2026-02-25)
- [x] Spaces tests (47) — ee2359f (2026-02-25)
- [x] Communities tests (38) — ee2359f (2026-02-25)
- [x] Tags tests (13) — ee2359f (2026-02-25)
- [x] Referentiels tests (10) — ee2359f (2026-02-25)
- [x] AuditLogs tests (11) — ee2359f (2026-02-25)
- [x] Graph tests (17) — ee2359f (2026-02-25)
- [x] Search tests (8) — ee2359f (2026-02-25)
- [x] User-tasks tests (14) — ee2359f (2026-02-25)
- [x] Admin users tests (24) — ee2359f (2026-02-25)
- [x] Admin spaces tests (15) — ee2359f (2026-02-25)
- [x] Admin communities tests (14) — ee2359f (2026-02-25)
- [x] Admin auditLogs tests (12) — ee2359f (2026-02-25)
- [x] Admin referentiels tests (3) — ee2359f (2026-02-25)
- [x] Smoke tests API+Web (4) — ee2359f (2026-02-25)
- [x] Web stores tests (auth, space, selection, viewMode, community, dashboardTab, theme) — 7b93e62 + 9007e21 (2026-02-25)
- [x] Web utils tests (lib/utils.ts, lib/dateUtils.ts, lib/api.ts) — 7b93e62 + 9007e21 (2026-02-25)
- [x] Web hooks tests (useSort) — 9007e21 (2026-02-25)
- [ ] ~Web components tests (Button, Modal, Badge)~ — wrappers Tailwind, peu de logique à tester

## À faire

### Incohérences à corriger
- ~~Fix : ajouter BUG dans ITEM_TYPES des constantes partagées~~ → déjà présent (constants/index.ts ligne 11)
- ~~Investiguer anomalie admin : Total items = 5014, somme par espace = 0~~ → bug dans toNum(), corrigé af0b4b9

### Manques fonctionnels
- ~~Bouton "Inviter" dans les settings communauté pour OWNER/ADMIN~~ → déjà implémenté (CommunityMembersManager)
- ~~Transfert de propriété (espace et communauté)~~ → 1013fb5 (2026-02-25)
- ~~Assignation d'items (champ assignedTo sur Item)~~ → fbb4887 (2026-02-25)
- ~~Recherche cross-espaces pour les items (endpoint /items/search global)~~ → déjà implémenté (GET /search + GlobalSearch.tsx)

### Nouvelles vues
- ~~Vue Calendrier (affichage mensuel/semaine des items avec dates, navigation, création rapide)~~ → c459701 (2026-02-23)

### Nouvelles vues (suite)
- ~~Vue Schéma (canvas libre ReactFlow, positions persistées, connexions = relations)~~ → b04ab2b (2026-02-26)

### Séances de présentation live (nouvelle fonctionnalité)
- [ ] Définir le transport temps réel (WebSocket Fastify natif / Socket.io / SSE)
- [ ] Modèle de session : liée à un espace/communauté ? lien/code d'invitation ?
- [ ] Accès : membres uniquement ou ouvert à quiconque avec le lien ?
- [ ] Vue participant : item courant en lecture seule, navigation libre ou verrouillée sur l'animateur ?
- [ ] Interactions participants : commentaires, réactions, votes ?
- [ ] Persistance : session éphémère ou sauvegardée (historique, compte-rendu) ?
- [ ] Préparation : liste d'items à l'avance ou sélection live par l'animateur ?
- [ ] MVP : animateur sélectionne → participants voient en temps réel, puis itérer

### Améliorations
- Rôle par défaut configurable pour les nouveaux membres de communauté sur les espaces
- Archivage d'items (flag archivedAt) plutôt que suppression définitive
- Modèle Invitation dédié (pending/accepted/declined) au lieu de créer directement un membership
- Templates d'espace (structure pré-configurée : statuts, types, items)
- Tags partagés au niveau communauté (actuellement scoped par espace uniquement)
- Notifications (invitation, assignation, contribution, mention)
- ~~Vue cartographie non hiérarchique (visualisation des relations entre items indépendamment de la hiérarchie parent/enfant)~~ → ebdbd13 (2026-02-25)
- ~~Enrichir les relations entre items (types de relation, labels, poids, métadonnées)~~ → c4849fb (2026-02-25)

## Terminé récemment
| 2026-03-07 | Landing page : 8 features, 15 vues par catégorie, communautés publiques | 5992bf2 |
| 2026-03-07 | Accès anonyme lecture seule aux communautés publiques (API + frontend) | 1f9d3d3 + f0d1748 |
| 2026-03-07 | Header menu redesign : dropdown user info, profil, admin | 774d031 |
| 2026-03-07 | BubbleView : cercles imbriqués proportionnels avec zoom, tooltip, légende | 4df0e37 |
| 2026-02-26 | Vue Schéma : canvas libre ReactFlow, positions persistées en DB, connexions = relations | b04ab2b |
| 2026-02-25 | Enrichir relations : label/commentaire, édition inline, type "Lié à", audit UPDATE_RELATION | c4849fb |
| 2026-02-25 | Vue Relations : cartographie non hiérarchique des relations entre items | ebdbd13 |
| 2026-02-25 | Assignation d'items (schema, API, sélecteur membre, filtre "Assigné à moi") | fbb4887 |
| 2026-02-25 | Transfert de propriété espace + communauté (API, client, UI bouton couronne + modale) | 1013fb5 |
| 2026-02-25 | 41 web tests (community, dashboardTab, theme, useSort, api) — Phase 4 quasi complète | 9007e21 |
| 2026-02-25 | Refactor ItemEditModal (1339→3), TimelineView (1131→4), SequenceView (1040→4) — Phase 5 complète | addd2af |
| 2026-02-25 | Refactor SpacePage.tsx : 2016 lignes → 4 modules (tree-view, actions hook, toolbar, page) | a3168fd |
| 2026-02-25 | Refactor MindMapView.tsx : 2553 lignes → 4 modules (utils, nodes, layout, view) + déduplication portails | 267f387 |
| 2026-02-25 | Refactor items.ts : 1716 lignes → 7 modules (relations, move, bulk, uploads, contributions, convert) | 6e5e414 |
| 2026-02-25 | Fix exclude test files from production tsc build | 71b05c0 |
| 2026-02-25 | 78 web tests (utils, dateUtils, stores auth/space/selection/viewMode) | 7b93e62 |
| 2026-02-25 | Vitest infrastructure + 294 tests API (auth, items, spaces, communities, tags, referentiels, auditLogs, graph, search, user-tasks, admin) + smoke web | ee2359f |
| 2026-02-24 | Relations cross-space + UX MindMap (pin, labels, édition portails, modal spaceId dynamique) | ac2bf7b |
| 2026-02-24 | MindMap layout radial portails + distance adaptive descendants + feuilles rapprochées | 5cd3ad0 |
| 2026-02-24 | Refonte réorganisation MindMap (direction parent direct, rayon adaptatif, portails proportionnels, réorg portail) + UI tweaks | fa469df |
| 2026-02-24 | Segmentation Kanban/Types par espace + drag cross-space + modale confirmation descendants | e19130b |
| 2026-02-24 | Support portail espaces enfants dans GraphView et SunburstView | 07b10f0 |
| 2026-02-24 | Persistance localStorage portails sidebar + cascade cocher/décocher espaces enfants | ec20250 |
| 2026-02-24 | Fix build prod : 5 erreurs TypeScript (imports inutilisés, type manquant, propriété inexistante) | a59ebef |
| 2026-02-24 | Portails d'espaces enfants cross-space dans 9 vues (Liste, Kanban, Texte, Types, Timeline, Planning, Calendrier, Séquence, MindMap) | 2c6bea2 |
| 2026-02-23 | Menu vues groupées par catégorie avec labels + fix searchMatchIds MindMap | ed0b4a7 |
| 2026-02-23 | Barre de recherche globale dans la toolbar avec highlight jaune sur toutes les vues | c0feb6c |
| 2026-02-23 | Vue Calendrier mensuelle avec navigation et affichage des items par date | c459701 |
| 2026-02-22 | Drag & drop des espaces dans la sidebar (réorganisation hiérarchie par glisser-déposer) | f26c95e |
| 2026-02-16 | Fusionner pages Tests et Anomalies en page Diagnostics (onglets) | 854157b |
| 2026-02-16 | Ajouter BUG dans le menu filtres/highlight SpacePage | 237371e |
| 2026-02-15 | Fix erreurs build (imports inutilisés, Select options, hasChildren) | da12b57 |
| 2026-02-15 | Interface gestion des membres d'espace dans SpaceSettings (invitation, suppression, rôles) | 0ef397b |
| 2026-02-15 | Création de communauté côté utilisateur (API + formulaire CommunitySelector) | 6e0af11 |
| 2026-02-15 | Créer espace personnel au login pour les users legacy (34 users sans espace personnel) | c2d7870 |
| 2026-02-15 | Convertir un item et ses enfants en nouvel espace (endpoint + modale + intégration toutes vues) | f53ce85 |
| 2026-02-15 | Naviguer vers le premier espace lors de la sélection d'une communauté | 72340c7 |
| 2026-02-15 | Suppressions sécurisées avec audit global et restauration (espaces, communautés, items) | 5e9afd2 |
| 2026-02-15 | Vérification email non-bloquante à l'inscription (envoi Resend, bannière amber, badge profil, page /verify-email, resend) | df10f53 |
| 2026-02-15 | Unifier ItemActionMenu dans toutes les vues et l'arborescence (Kanban, Liste, Timeline, Texte, Séquence, Types, Planning, TreeItem) + actions Déplacer/Dupliquer | 282d58f |
| 2026-02-15 | Fix build : suppression imports inutilisés (TypesView, SpaceSettingsPage) | 1e97a24 |
| 2026-02-15 | Menu dropdown réutilisable (ItemActionMenu) pour actions d'items — MindMap, Kanban, Liste | 671368c |
| 2026-02-15 | Images avatar et couverture pour espaces et communautés (upload, suppression, affichage Dashboard/sidebar/CommunitySelector, arborescence R2 organisée) | 1258856 |
| 2026-02-11 | MindMap : bouton suppression au hover + fix type BUG dans constantes UI | 19a97fa |
| 2026-02-11 | Fix crash React #130 : type BUG manquant dans TYPE_ICONS/ItemType | b547797 |
| 2026-02-11 | Fix restauration items (body JSON vide + parentId orphelin) | 596125f |
| 2026-02-11 | Noeud central espace dans le graphe niveau space | 163ee31 |
| 2026-02-11 | Fix graphe ne remplit pas l'écran sur grand écran | e7ce847 |
| 2026-02-11 | Fix défilement des pages (overflow-auto sur main Layout) | b489309 |
| 2026-02-11 | Vue Sunburst interactive dans le Dashboard (hiérarchie anneaux concentriques) | 518a5dc |
| 2026-02-09 | Hiérarchie d'espaces (parentId) avec arborescence sidebar et dashboard | 139727b |
| 2026-02-09 | Page admin Statistiques (totaux, activite, repartition, top espaces) | 5a2b108 |
| 2026-02-09 | Fix graphe occupe toute la hauteur disponible | 09aa5c3 |
| 2026-02-09 | Filtre communautes graphe global + noeuds structurels espace/communaute | 61878ae |
| 2026-02-09 | Vue graphe force-directed a 3 niveaux (espace, communaute, global) | c1f79e4 |
| 2026-02-08 | Groupement natif ReactFlow (parentId) pour zones projet MindMap | 381e40a |
| 2026-02-08 | Breadcrumb ItemEditModal + zoom projet MindMap + favicon optimisé | 3aaffbb |
| 2026-02-08 | MindMap : layout étoile + résolution collisions zones projet | 717b916 |
| 2026-02-08 | Docs : cartographie composants + catalogue fonctionnalités | c51dcde |
| 2026-02-08 | MindMap : rayons dynamiques + blocs projet déplaçables | 891fc2a |
| 2026-02-08 | Dashboard : titre dédoublonné + barre d'actions sticky | 3ded0ce |
| 2026-02-08 | Fix cache stale après login + fix type setContent TipTap | 26640f1 |
| 2026-02-08 | Formulaire lecture seule : texte brut au lieu d'inputs disabled + fix description TipTap | c69c292 |
| 2026-02-08 | UI : titre SPOK préfixé, modal 80%, types en boutons d'options | 648d8d5 |
| 2026-02-08 | UI lecture seule pour les visiteurs (VIEWER) : masquer toutes les actions d'édition dans les 7 vues, ItemEditModal, arborescence et RichTextEditor | 4879259 |
| 2026-02-08 | Visibilité communautaire : les membres voient tous les espaces et contenus (API + routes protégées VIEWER) | 31073b5 |
| 2026-02-08 | Import forum via tables raw + transformation SPOK + fix mojibake CP1252 (3638 items, 52181 contribs, 140 spaces uniques) | 2e7bb4a |
| 2026-02-07 | Fix auteurs forum : 586 items + 11383 contribs corrigés, 31 users créés, noms numériques nettoyés | 4cd36ac |
| 2026-02-07 | Upload d'avatar utilisateur (upload, suppression, affichage sidebar + profil) | a4157e0 |
| 2026-02-07 | Layout fixe (sidebar + header sticky) — déjà en place, vérifié | N/A (aucune modif) |
| 2026-02-07 | Fix pseudos : 25 utilisateurs numériques renommés "Membre N" (aucun avec données) | script data |
| 2026-02-07 | Fix mojibake : 1283 corrections ciblées + fix regex anomalies | 49a45c9 |
| 2026-02-07 | Tests cohérence métier : liens vers consoles admin avec filtre anomalie | 1a0ee62 |
| 2026-02-07 | Console tests non-régression (21 tests) + nettoyage fichiers | 828a7e0 |
| 2026-02-07 | Admin : page Référentiels (consultation) | 69745e0 |
| 2026-02-07 | Recherche globale cross-espaces + réorganisation sidebar | 61163d5 |
| 2026-02-07 | Admin : tri des colonnes par clic sur en-têtes (3 pages) | d8dae87 |
| 2026-02-07 | Admin : page Anomalies avec 12 contrôles de qualité des données | 1a7818c |
| 2026-02-07 | Fix données import : 3638 items + 52181 contributions réparées | script fix-descriptions.ts |
| 2026-02-07 | Fix crash SequenceView (hook après return conditionnel) | f72a08c |
| 2026-02-07 | Séquence : ajout/suppression relations (comme MindMap) | 553ef2d |

## Terminé
| Date | Tâche | Commit |
|------|-------|--------|
| 2026-02-07 | Gantt : flèches de dépendance entre items | a942728 |
| 2026-02-07 | Éditeur rich text TipTap (descriptions + contributions) + fix entités HTML forum | 3dcd743, 771318b, e8bc85b |
| 2026-02-06 | Fix rendu HTML auto + correction 98 topics forum mal parsés | 77cc4ce |
| 2026-02-06 | Carte mentale : titres complets + espacement progressif entre frères | 9069dfd |
| 2026-02-06 | Import forum v3 : complétion import GBK + conversion BBCode→HTML | e3a39d3 |
| 2026-02-06 | Carte mentale : persistance positions + liens dynamiques + espacement | d4f140e |
| 2026-02-06 | Fix arborescence : hiérarchie correcte + légende responsive | 8d1df0b |
| 2026-02-06 | Responsive mobile : sidebar slide-over + hamburger menu | 655959a |
| 2026-02-06 | UI : sidebar active + header compact toolbar unifiée | 773940c |
| 2026-02-06 | Sidebar : espaces séparés par section + largeur redimensionnable | 573e18f |
| 2026-02-06 | Barre du haut : communauté + fix espace courant | cb67bd5 |
| 2026-02-06 | Formulaire : statut en boutons + boutons sticky | 574be34 |
| 2026-02-06 | Filtres type : indicateur visuel du mode | 6d55857 |
| 2026-02-06 | Fix carte mentale : charger tous les items sans limite | 5ade272 |
| 2026-02-06 | Dashboard : espaces communautaires visibles + bouton Rejoindre | a1cd45d |
| 2026-02-06 | Carte mentale : rectangles englobants PROJECT + Dashboard segmenté | a0998e4 |
| 2026-02-05 | Import forum MSF complet (55817 messages, 3638 topics) | e313954 |
