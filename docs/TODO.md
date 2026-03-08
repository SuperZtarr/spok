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

### Membres & permissions
- [ ] Modèle Invitation dédié (pending/accepted/declined) au lieu de créer directement un membership — **basse priorité**

## Idées (à explorer)

### Nouvelles visualisations
- [ ] Matrice effort/impact — items sur 2 axes (priorité vs complexité), drag pour repositionner
- [x] Treemap — rectangles imbriqués proportionnels au nombre d'enfants ou contributions — 09a1a35
- [ ] Heatmap temporelle — grille mois/semaines colorée par activité (créations, contributions)
- [x] Burndown/Burnup — courbe d'avancement des tâches dans le temps (done vs total) — aa1aa4c
- [ ] Diagramme de flux cumulatif (CFD) — empilage des statuts dans le temps
- [ ] Chord diagram — relations circulaires entre espaces ou types d'items
- [ ] Réseau égocentrique — centré sur un item, N niveaux de voisins
- [ ] Organigramme — arborescence verticale des membres par communauté/espace/rôle
- [ ] Vue matricielle — tableau croisé (assigné × statut, type × espace)

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

### 2026-03-08
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
