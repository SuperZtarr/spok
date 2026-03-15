# SPOK - Suivi des tâches

## À faire

### Items
- [ ] Fusion d'éléments : fusionner un item avec ses enfants (concaténer descriptions, remonter petits-enfants, supprimer les enfants absorbés)
- [ ] Breadcrumb dans l'item (Communauté, Espaces, hiérarchie)

### UX & navigation
- [x] Refonte sidebar : communautés dépliées par défaut, compteur d'espaces quand réduit — 75d49c7 (2026-03-15)
- [ ] Breadcrumb communauté → espace dans les pages de contenu
- [ ] Onboarding pour les nouveaux utilisateurs (guide premier lancement, tutoriel interactif)
- [ ] Favoris / récents : accès rapide aux espaces fréquemment utilisés ou récemment visités
- [ ] Whiteboard : tableau blanc collaboratif (dessin libre, post-its, formes)
- [ ] Mermaid : rendu de diagrammes Mermaid dans l'éditeur ou les descriptions

### Infra & emails
- [x] Configurer domaine Resend spok.space avec SPF/DKIM/DMARC — 30fbf6d (2026-03-15)
- [ ] invitation d'un nouveau membre

## Idées (à explorer)

### Libs & intégrations

#### Visualisation / diagrammes
- [ ] Mermaid — texte → diagramme, idéal pour contenu généré
- [ ] Excalidraw — whiteboard embarquable React

#### Gestion de tâches / planning
- [ ] FullCalendar — vue calendrier/planning

#### Graphe de connaissances
- [ ] Cytoscape.js — graphes interactifs, très puissant
- [ ] D3.js — visualisation de graphes sur mesure (déjà utilisé partiellement)
- [ ] Obsidian-like graph — reproductible avec Cytoscape ou vis.js

#### Surprise
- [ ] Observable Plot — visualisation de données exploratoire, très expressif
- [ ] Markmap — mindmap généré depuis du Markdown
- [ ] Tiptap extensions — tableaux imbriqués, mentions (déjà fait), bloc diagram-as-code intégrable

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

## Terminé

### UX & navigation
- [x] Écran d'accueil orienté navigation (communautés → espaces) — d222fcf
- [x] Sidebar multi-communauté : dépliées par défaut, compteur quand réduit — 75d49c7

### Communautés
- [x] Flow création communauté multi-étapes avec approbation admin — 75d49c7
- [x] Historique emails communauté + renvoi aux nouveaux/anciens membres — 0a833f6, ad6f162
- [x] Modales admin 90% viewport + en-têtes tableau sticky — a4b1220

### Infra
- [x] Domaine Resend spok.space (SPF/DKIM/DMARC) — 30fbf6d
- [x] Fix détachement parentId cross-communauté — 90d00f6

### Éditeur & contenu
- [x] @mentions dans TipTap — 000593b
- [x] #références d'items dans TipTap — 000593b

### Notifications
- [x] Notifications par email avec préférences utilisateur — 3457763

### Espaces & organisation
- [x] Templates d'espace — déjà implémenté
- [x] Tags partagés au niveau communauté — b5d10de

### Exports
- [x] Export PDF données — b4db74f
- [x] Export PNG capture vue actuelle — b4db74f

### Priorité
- [x] Référentiel priorité 4 niveaux — f498b48
- [x] Sélecteur priorité dans ItemEditModal — f498b48
- [x] Affichage priorité ListView/KanbanView — f498b48

### Vues
- [x] Vue Texte : fix portails — b3b2c9e
- [x] Vue Membres Kanban — f0cb1b4
- [x] Vue Priorités Kanban — f0cb1b4
- [x] Filtres partagés GlobalTaskFilterBar — f0cb1b4
- [x] Menu réorganisé "Vues globales" + "Mes activités" — f0cb1b4

### Diagrammes
- [x] Type DIAGRAM avec éditeur draw.io intégré — bd9112f
- [x] Sauvegarde XML + export PNG R2 — ad032dc
- [x] Preview PNG, modales fullscreen — 2ffc84a
- [x] getTypeIcon() fallback FileText — 699d683

### Membres & permissions
- [x] Modèle Invitation dédié — b3bf186

### Visualisations
- [x] Matrice effort/impact — 640a267
- [x] Treemap — 09a1a35
- [x] Heatmap temporelle — ed8be2d
- [x] Burndown/Burnup — aa1aa4c
- [x] CFD — 6091981
- [x] Chord diagram — 68bf9a8
- [x] Réseau égocentrique — 0d74d3a
- [x] Organigramme — d570ef8
- [x] Vue matricielle — 5e73a0f

## Historique

### 2026-03-15
- Sidebar multi-communauté : dépliées par défaut, compteur espaces quand réduit — 75d49c7
- Flow création communauté multi-étapes + approbation admin (pendingPublic) — 75d49c7
- Modales admin 90% viewport + en-têtes tableau sticky — a4b1220
- Fix détachement parentId cross-communauté — 90d00f6
- Fix dépendance wx-react-gantt + colonnes membres pleine hauteur — 839b929
- Historique emails communauté + renvoi individuel/groupé — 0a833f6, ad6f162
- Domaine Resend spok.space (SPF/DKIM/DMARC) — 30fbf6d

### 2026-03-14
- Écran d'accueil orienté navigation (communautés → espaces) — d222fcf
- Dashboard cockpit : KPIs, en retard, urgent, en cours, semaine, progression par espace — 105b7e1
- Dashboard : échéances, répartition statut/type, tous types d'items — d6d225f

### 2026-03-13
- Type DIAGRAM : éditeur draw.io intégré — bd9112f
- Modales d'édition fullscreen — 2ffc84a
- getTypeIcon() fallback FileText — 699d683
- Migration 101 .drawio existants de R2 vers content.xml — bd9112f
- Fix : "Enregistrer et Quitter" draw.io — 5cc8d47

### 2026-03-12
- Fix Vue Texte : portails masqués quand espace principal vide — b3b2c9e
- Menu réorganisé + filtres partagés + vues Membres/Priorités — f0cb1b4
- Priorité : sélecteur + affichage — f498b48
- Export PDF + capture PNG — b4db74f

### 2026-03-11
- Fix sidebar : espaces disparaissent au retour sur la fenêtre — ac04cf7

### 2026-03-10
- ViewHelpButton — 1983fc0
- EgoNetworkView — 0d74d3a
- HeatmapView — ed8be2d
- PWA installabilité — d72914c
- DeadlinesView tous types — f5ff338
- MatrixView distribution en grille — 544ec89
- Gantt flèches de relations — 0e0840f

### 2026-03-09
- MindMap 3 lignes — 1e9ac95
- Gantt réorganisation chronologique — 945a871
- Sélecteurs d'espaces groupés par communauté — f0900d1
- Bouton suppression modale item — e27a2d5
- MatrixView effort/impact — 640a267
- CrossTableView — 5e73a0f
- Modèle Invitation dédié — b3bf186

### 2026-03-08
- ChordView — 68bf9a8
- DeadlinesView — d093921
- CfdView — 6091981
- OrgChartView — d570ef8
- BurndownView — aa1aa4c
- Restauration audit logs UPDATE/MOVE — a950424
- @mentions et #références TipTap — 000593b
- Notifications email — 3457763
- Tags communauté — b5d10de
- TreemapView — 09a1a35
- Rôle par défaut espaces — bfa9de6
- RadialTreeView — 927c8cb

### 2026-03-07
- Landing page — 5992bf2
- Accès anonyme communautés publiques — 1f9d3d3 + f0d1748
- Header menu redesign — 774d031
- BubbleView — 4df0e37

### 2026-02-26
- Vue Schéma canvas libre — b04ab2b
- SchemaView hiérarchie + layout arbre — 446c905
- SchemaView groupes imbriqués + drag reparent — f21d5f9

### 2026-02-25
- Relations enrichies — c4849fb
- Vue Relations — ebdbd13
- Assignation d'items — fbb4887
- Transfert de propriété — 1013fb5
- Statut "Bloqué" → "À valider" — e5c6766
- MindMap édition relations — 98209e8
- Refactoring Phase 5 + Tests Phase 4

### 2026-02-24
- Portails cross-space 9 vues — 2c6bea2
- Kanban/Types segmenté par espace — e19130b
- Portail GraphView + SunburstView — 07b10f0
- MindMap layout radial portails — 5cd3ad0
- Refonte réorganisation MindMap — fa469df

### 2026-02-23
- Vue Calendrier mensuelle — c459701
- Menu vues groupées par catégorie — ed0b4a7
- Barre de recherche globale toolbar — c0feb6c

### 2026-02-22
- Drag & drop espaces sidebar — f26c95e

### 2026-02-15–16
- Images avatar/couverture espaces et communautés — 1258856
- ItemActionMenu unifié — 282d58f
- Suppressions sécurisées + audit + restauration — 5e9afd2
- Gestion membres d'espace — 0ef397b
- Création de communauté côté utilisateur — 6e0af11
- Convertir item en espace — f53ce85
- Vérification email non-bloquante — df10f53

### 2026-02-07–11
- Import forum MSF complet + corrections
- Éditeur rich text TipTap — 3dcd743
- Vue graphe force-directed — c1f79e4
- Vue Sunburst Dashboard — 518a5dc
- MindMap layout étoile — 717b916
- Admin Stats, Anomalies, Référentiels
- Recherche globale cross-espaces — 61163d5
- Upload avatar utilisateur — a4157e0
- Responsive mobile — 655959a

### 2026-02-05–06
- Import forum v3 + BBCode→HTML — e3a39d3
- Carte mentale persistance — d4f140e, 9069dfd
- UI sidebar, header, formulaire, filtres, Dashboard
