# SPOK - Suivi des tâches

## À faire

### Éditeur & contenu
- [x] @mentions dans TipTap : extension mention, autocomplete membres, lien cliquable, déclenchement notification MENTION — 000593b
- [x] #références d'items dans TipTap : extension suggestion (#), autocomplete cross-espaces/communautés, lien cliquable → ouvre ItemEditModal — 000593b

### Notifications
- [x] Notifications par email : envoi via Resend quand une notif est créée, avec préférences utilisateur par type (in-app / email / désactivé), configurables dans le profil et par l'admin — 3457763

### Espaces & organisation
- [x] Templates d'espace (structure pré-configurée : statuts, types, items) — déjà implémenté
- [x] Tags partagés au niveau communauté — b5d10de

### Exports
- [x] Export PDF données (tableau items + relations, jspdf + autotable) — b4db74f
- [x] Export PNG capture vue actuelle (html2canvas) — b4db74f

### Priorité
- [x] Référentiel priorité 4 niveaux (Urgente/Haute/Normale/Basse) — f498b48
- [x] Sélecteur priorité dans ItemEditModal — f498b48
- [x] Affichage priorité dans ListView (colonne + tri) et KanbanView (badge) — f498b48

### Vues
- [x] Vue Texte : fix portails masqués quand l'espace principal est vide — b3b2c9e
- [x] Vue Membres (Kanban par membre, drag & drop assignation, support portails) — f0cb1b4
- [x] Vue Priorités (Kanban P1-P4, drag & drop priorité) — f0cb1b4
- [x] Filtres partagés GlobalTaskFilterBar (hook + composant réutilisable dans Mes tâches, Échéances, Organisation) — f0cb1b4
- [x] Menu réorganisé : "Vues globales" + section "Mes activités" (Mes tâches, Échéances, Organisation) — f0cb1b4

### Diagrammes
- [x] Type DIAGRAM avec éditeur draw.io intégré (iframe embed.diagrams.net) — bd9112f
- [x] Sauvegarde XML dans content.xml + export PNG vers R2 — ad032dc
- [x] Preview PNG dans la modale, icône Workflow, thème clair — 2ffc84a
- [x] Modales d'édition fullscreen — 2ffc84a
- [x] Migration 101 .drawio existants de R2 vers content.xml — bd9112f
- [x] getTypeIcon() avec fallback FileText (fix crash prod) — 699d683

### Items
- [ ] Fusion d'éléments : fusionner un item avec ses enfants (concaténer descriptions, remonter petits-enfants, supprimer les enfants absorbés)

### Infra & emails
- [ ] Configurer un domaine custom Resend (ex: `noreply@spok.app`) avec SPF/DKIM/DMARC pour éviter les spams

### UX & navigation
- [ ] Onboarding pour les nouveaux utilisateurs (guide premier lancement, tutoriel interactif)
- [ ] Favoris / récents : accès rapide aux espaces fréquemment utilisés ou récemment visités
- [ ] Refonte sidebar : voir toutes les communautés d'un coup (au lieu du dropdown mono-communauté)
- [ ] Breadcrumb communauté → espace dans les pages de contenu

### Membres & permissions
- [x] Modèle Invitation dédié (pending/accepted/declined) au lieu de créer directement un membership — b3bf186

## Idées (à explorer)

### Nouvelles visualisations
- [x] Matrice effort/impact — items sur 2 axes (priorité vs complexité), drag pour repositionner — 640a267
- [x] Treemap — rectangles imbriqués proportionnels au nombre d'enfants ou contributions — 09a1a35
- [x] Heatmap temporelle — grille mois/semaines colorée par activité (créations, contributions) — ed8be2d
- [x] Burndown/Burnup — courbe d'avancement des tâches dans le temps (done vs total) — aa1aa4c
- [x] Diagramme de flux cumulatif (CFD) — empilage des statuts dans le temps — 6091981
- [x] Chord diagram — relations circulaires entre espaces ou types d'items — 68bf9a8
- [x] Réseau égocentrique — centré sur un item, N niveaux de voisins — 0d74d3a
- [x] Organigramme — arborescence verticale des membres par communauté/espace/rôle — d570ef8
- [x] Vue matricielle — tableau croisé (assigné × statut, type × espace) — 5e73a0f

### Séances de présentation live
- [ ] Définir le transport temps réel (WebSocket Fastify natif / Socket.io / SSE)
- [ ] Modèle de session : liée à un espace/communauté ? lien/code d'invitation ?
- [ ] Accès : membres uniquement ou ouvert à quiconque avec le lien ?
- [ ] Vue participant : item courant en lecture seule, navigation libre ou verrouillée sur l'animateur ?
- [ ] Interactions participants : commentaires, réactions, votes ?
- [ ] Persistance : session éphémère ou sauvegardée (historique, compte-rendu) ?
- [ ] Préparation : liste d'items à l'avance ou sélection live par l'animateur ?
- [ ] MVP : animateur sélectionne → participants voient en temps réel, puis itérer

### Serveur MCP (Model Context Protocol)
- [ ] Réfléchir à l'intérêt : exposer les données SPOK (items, espaces, relations) comme contexte pour les LLM
- [ ] Cas d'usage : navigation/recherche dans SPOK via Claude, création d'items par prompt, résumé de contenu, analyse de graphe
- [ ] Architecture : serveur MCP séparé ou intégré à l'API Fastify existante ?
- [ ] Quelles ressources exposer (items, espaces, communautés, relations, contributions) ?
- [ ] Quels outils MCP proposer (search, create, update, summarize, navigate) ?
- [ ] Auth : comment authentifier les requêtes MCP (token utilisateur, clé API dédiée) ?

## Historique

### 2026-03-14
- Dashboard cockpit : KPIs, en retard, urgent, en cours, semaine, progression par espace — 105b7e1
- Dashboard : échéances, répartition statut/type, tous types d'items — d6d225f

### 2026-03-13
- Type DIAGRAM : éditeur draw.io intégré (iframe, sauvegarde XML, export PNG R2, preview modale) — bd9112f
- Modales d'édition fullscreen (comme pages communauté) — 2ffc84a
- getTypeIcon() fallback FileText (fix crash prod items DIAGRAM) — 699d683
- Migration 101 .drawio existants de R2 vers content.xml — bd9112f
- Fix : "Enregistrer et Quitter" draw.io sauvegarde XML + PNG sans fermer la modale — 5cc8d47

### 2026-03-12
- Fix Vue Texte : portails masqués quand espace principal vide — b3b2c9e
- Menu réorganisé : "Vues globales" + "Mes activités" — f0cb1b4
- Filtres partagés GlobalTaskFilterBar (hook + composant) — f0cb1b4
- Vue Membres Kanban (assignation par drag & drop) — f0cb1b4
- Vue Priorités Kanban (P1-P4 par drag & drop) — f0cb1b4
- Priorité : sélecteur ItemEditModal + affichage ListView/KanbanView — f498b48
- Export PDF données + capture PNG vue actuelle — b4db74f

### 2026-03-11
- Fix sidebar : espaces disparaissent au retour sur la fenêtre — ac04cf7

### 2026-03-10
- ViewHelpButton : bouton ? aide contextuelle pour chaque vue — 1983fc0
- EgoNetworkView : réseau égocentrique centré sur un item, profondeur 1-3 — 0d74d3a
- HeatmapView : carte de chaleur style GitHub, créations/modifications — ed8be2d
- PWA installabilité : manifest, service worker, icônes — d72914c
- DeadlinesView : affiche tous les types d'items, pas seulement TASK — f5ff338
- Types → catégorie basique, Kanban → planification — 243dc7f
- MatrixView : distribution en grille au lieu de cluster superposé — 544ec89
- HeatmapView : carte de chaleur style GitHub, créations/modifications — ed8be2d
- Gantt : flèches de relations connectées au centre des barres — 0e0840f

### 2026-03-09
- MindMap 3 lignes de titre — 1e9ac95
- Gantt réorganisation chronologique persistée — 945a871
- Sélecteurs d'espaces groupés par communauté partout — f0900d1
- Bouton suppression dans modale item — e27a2d5
- MatrixView effort/impact avec drag & persistence — 640a267
- CrossTableView tableau croisé configurable — 5e73a0f
- Modèle Invitation dédié (pending/accepted/declined) — b3bf186

### 2026-03-08
- ChordView : diagramme chord, relations entre types ou espaces — 68bf9a8
- DeadlinesView : onglet dashboard "Échéances", items groupés par urgence — d093921
- CfdView : diagramme de flux cumulatif, empilage statuts dans le temps — 6091981
- OrgChartView : organigramme vertical des membres par rôle — d570ef8
- BurndownView : courbe burnup/burndown, 2 modes, tooltip, stats, ligne idéale — aa1aa4c
- Restauration audit logs UPDATE/MOVE : dialog champ par champ avec sélection — a950424
- @mentions et #références d'items dans TipTap — 000593b
- Notifications par email avec préférences utilisateur — 3457763
- Tags partagés au niveau communauté — b5d10de
- TreemapView : rectangles imbriqués, 3 modes de taille, zoom, tooltip — 09a1a35
- Rôle par défaut configurable pour nouveaux membres communauté sur espaces — bfa9de6
- RadialTreeView : arbre radial d3-hierarchy, zoom/pan, tooltip, légende — 927c8cb

### 2026-03-07
- Landing page : 8 features, 15 vues par catégorie, communautés publiques — 5992bf2
- Accès anonyme lecture seule aux communautés publiques — 1f9d3d3 + f0d1748
- Header menu redesign : dropdown user info, profil, admin — 774d031
- BubbleView : cercles imbriqués proportionnels avec zoom, tooltip, légende — 4df0e37

### 2026-02-26
- Vue Schéma : canvas libre ReactFlow, positions persistées, connexions = relations — b04ab2b
- SchemaView : hiérarchie, layout arbre, réorganiser, multi-sélection — 446c905
- SchemaView : groupes imbriqués + drag reparent — f21d5f9

### 2026-02-25
- Enrichir relations : label/commentaire, édition inline, type "Lié à" — c4849fb
- Vue Relations : cartographie non hiérarchique — ebdbd13
- Assignation d'items (schema, API, sélecteur membre, filtre "Assigné à moi") — fbb4887
- Transfert de propriété espace + communauté — 1013fb5
- Statut "Bloqué" → "À valider" — e5c6766
- MindMap : édition relations + icônes type + tooltip commentaire — 98209e8
- Refactoring Phase 5 complet (items.ts, MindMapView, SpacePage, ItemEditModal, TimelineView, SequenceView)
- Tests Phase 4 : 413 tests (294 API + 78 web stores/utils + 41 web hooks/stores)

### 2026-02-24
- Portails d'espaces enfants cross-space dans 9 vues — 2c6bea2
- Segmentation Kanban/Types par espace + drag cross-space — e19130b
- Support portail GraphView + SunburstView — 07b10f0
- MindMap layout radial portails + distance adaptive — 5cd3ad0
- Refonte réorganisation MindMap — fa469df

### 2026-02-23
- Vue Calendrier mensuelle — c459701
- Menu vues groupées par catégorie — ed0b4a7
- Barre de recherche globale dans la toolbar — c0feb6c

### 2026-02-22
- Drag & drop des espaces dans la sidebar — f26c95e

### 2026-02-15–16
- Images avatar/couverture espaces et communautés — 1258856
- ItemActionMenu unifié dans toutes les vues — 282d58f
- Suppressions sécurisées + audit + restauration — 5e9afd2
- Gestion membres d'espace — 0ef397b
- Création de communauté côté utilisateur — 6e0af11
- Convertir item en espace — f53ce85
- Vérification email non-bloquante — df10f53

### 2026-02-07–11
- Import forum MSF complet (3638 items, 52181 contributions) + corrections données
- Éditeur rich text TipTap — 3dcd743
- Vue graphe force-directed 3 niveaux — c1f79e4
- Vue Sunburst Dashboard — 518a5dc
- MindMap : layout étoile, groupement, zoom projet — 717b916
- Admin : Stats, Anomalies, Référentiels, tri colonnes
- Recherche globale cross-espaces — 61163d5
- Upload avatar utilisateur — a4157e0
- Responsive mobile — 655959a

### 2026-02-05–06
- Import forum v3 + BBCode→HTML — e3a39d3
- Carte mentale : persistance positions, titres complets — d4f140e, 9069dfd
- UI : sidebar, header, formulaire, filtres, Dashboard — multiples commits
