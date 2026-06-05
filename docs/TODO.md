# SPOK - Suivi des tâches

## À faire

### UX & formulaires
- [x] Uniformiser boutons Enregistrer (gris/actif), guard sortie, Ctrl+S, Ctrl+V avatars — c720cf6, b789789, a41db60 (2026-03-21)
- [x] Avatar sur cover : fallback top-right de la cover quand pas d'avatar (2026-03-22)
- [x] Revoir les listes d'espaces : SpaceCard uniforme, grilles partout, SpacesListPage filtree — fce8e91 (2026-03-21)
- [x] Transferer des fonctions admin vers la gestion directe : mode admin toggle, onglet Danger communaute/espace, desactivation compte (2026-03-22)
- [x] Images avatar/cover non affichées en prod pour les non-propriétaires d'espace/communauté — résolu 2026-04-21
- [x] Interface lecture seule VIEWER : 4 vues (list/kanban/gantt/mindmap), badge "Lecture seule", drag desactive — testé 2026-04-22
- [x] Bugs UX : sidebar toggle z-index, dark mode textes noirs, favicon 404, logout redirect, recherche responsive, 409 inline update, ouvrir item dans nouvel onglet — 2026-04-24
- [x] Vue par défaut par espace (champ defaultView, settings dropdown, apply on entry) — 2026-04-25
- [x] ListView responsive : grid par breakpoints, titre toujours visible — 2026-04-25
- [x] MindMap dark mode : background dots adaptatif — 2026-04-25
- [x] Admin audit logs : afficher entityId + titre de l'item supprimé/restauré — 2026-04-25
- [x] Menu contextuel : permissions canEdit (MEMBER voit edit/ouvrir, pas delete/move) — 2026-04-25
- [x] SpaceContentRedirect : préserver les query params (?item=) — 2026-04-25
- [x] Toolbar espace : sélecteur de vues (boutons par section, filtrés par config admin menu) — 2026-04-25
- [x] Menu contextuel : revoir ordre et libellés — 5 groupes, onOpen navigate onglet actuel — c6af110 (2026-04-29)
- [x] Gantt : timeline adaptive (centerDate, ResizeObserver, aujourd'hui centré au resize), persistance vue ?view=X dans URL — c4f6dc9 (2026-05-01)
- [x] Menu contextuel : "Modifier le statut" avec sous-menu (tous les statuts visibles, statut courant coché) — b3b1a2e (2026-05-04)
- [x] MEETING : TimeRangePicker vertical draggable (plage horaire journée) dans ItemEditModal — b3b1a2e (2026-05-04)
- [x] ItemEditModal footer : responsive mobile (flex-wrap, sm:ml-auto) — b3b1a2e (2026-05-04)
- [x] Chemin critique Gantt : CPM dans timeline-utils + toggle toolbar + ring rouge — abe7f75 (2026-05-06)
- [x] Tableau de bord : refonte layout (Échéances avant Semaine, colonnes horizontales, responsive) — de8b44d (2026-05-10)
- [x] Navigation sticky entre espaces : vue active conservée lors du changement d'espace — 95c5dd4 (2026-05-10)
- [x] SpaceToolbar : indicateur (point pulsé) sur la vue par défaut quand on n'y est pas — 95c5dd4 (2026-05-10)
- [x] Restauration item après reconnexion : ?item= maintenu dans l'URL + returnTo sessionStorage après expiration token — (2026-05-20)
- [x] Vue PERT : VIEW_REGISTRY source unique pour 30 vues + création liens drag-and-drop — c020256, 967716f (2026-05-20)
- [x] Vue PERT : relations proxies sur nœud replié (flèches pointillées reportées sur l'ancêtre visible) — (2026-05-22)
- [x] Vue PERT : tri automatique par rang de dépendance (topologique, alphabétique à égalité), hiérarchie préservée — (2026-05-25)
- [x] Mode admin dans settings : options elargies quand admin mode actif (selecteur communaute complet, suppression sans etre OWNER) — déjà implémenté
- [x] Aperçu des vignettes dans les settings : onglet Aperçu dans CommunitySettingsPage et SpaceSettingsPage — 2026-05-26
- [x] Bug : redirection vers l'URL d'origine après déconnexion/expiration token — fix LoginPage.onSuccess lit spok_returnTo directement
- [ ] Vue Tableau croisé : export dédié (CSV ou Excel avec lignes/colonnes du tableau)
- [ ] Pages globales (Liens, Images...) : revoir le filtre/navigation (vue d'espace + vue transverse globale)
- [ ] Page favoris / epingles (espaces, items, pages epingles par l'utilisateur)
- [ ] Whiteboard : tableau blanc collaboratif (dessin libre, post-its, formes)
- [ ] Mermaid : rendu de diagrammes Mermaid dans l'éditeur ou les descriptions
- [ ] ajouter un correcteur d'orthographe dans les zones de textes

### Modales
- [x] Les tableaux ne sont pas éditables ? (modale édition item) — ajout/suppression lignes et colonnes via toolbar contextuelle — résolu 2026-04-22
- [x] Modale édition item : champ "parent" → permettre de changer d'espace et de communauté — boutons déplacer/dupliquer/convertir dans le footer de la modale — a440cea (2026-04-22)

### Evolutions (backlog récupéré depuis Projet SPOK)
- [ ] Filtres à mettre partout
- [ ] Ajouter une vue pour les éléments modifiés récemment
- [ ] Formulaire d'items peu adapté aux mobiles
- [ ] Dans le menu Types, ajouter une vue Todo
- [ ] Organigramme à revoir
- [ ] Recherche dans la vue
- [ ] Réduction de données
- [ ] Identification d'élément
- [ ] Notifications : suivi de lecture / marqué comme non lue
- [ ] Notifications : impliquerait d'ajouter un suivi des vues par utilisateur

### IA / Résumés
- [ ] Résumé de conversations avec identification des consensus (style Reddit TL;DR)
  - Backend : `POST /:id/summarize` → appel Claude API (Haiku), crée une contribution SUMMARY
  - Prompt structuré : synthèse, points de consensus, désaccords ouverts, décisions actées
  - Frontend : bouton "Résumer" sur vue détail item (si contributions > 0), style distinct (badge IA)
  - Prérequis : `@anthropic-ai/sdk` dans apps/api, `ANTHROPIC_API_KEY` dans .env

### Intégrations externes
- [ ] Connexion calendrier messagerie (Outlook/Hotmail, Gmail) : pousser des RDV (items MEETING) et récupérer les événements via Microsoft Graph API / Google Calendar API

### MCP SPOK
- [x] MCP : CRUD complet items, espaces, communautés (15 outils) — 65800d7 (2026-04-29)
- [x] MCP : get_item, champs complets list/search/get, fix description HTML, 253 items doc migrés — b460cfc, a900086 (2026-05-10)

## Idées (à explorer)

### Monitoring (priorité basse)
- [ ] Sentry — error tracking + performance monitoring (traces API, temps de rendu React) — tier gratuit suffisant, ~30min à mettre en place (Fastify + React)

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

### 2026-03-21
- [x] Vues d'espace Images, Liens, Documents, Bugs + section Types dans le menu — e843737
- [x] Covers communautés/espaces : repositionner (drag Y) et zoomer (slider) — 34381d8
- [x] Menu header restructuré : séparation vues globales / vues espace avec nom espace en bleu — 083c74f
- [x] Couleurs de fond par section dans le menu header (bleu espaces, rouge admin, gris divers) — e72efaa
- [x] Acces par défaut des menus revus (public/user) — f3297cb
- [x] Fix : section Types dans admin menu, icônes ExternalLink/Image/Bug, menu espace invisible — 6e9a878, e72efaa
- [x] ViewConfig : catégorie itemTypes synchronisée avec menuDefaults — 34381d8

### 2026-03-20
- [x] Refonte header, menu principal, routes individuelles, visiteurs — 758cf4b
- [x] Table MenuItem unifiée (42 items, 6 sections) — 758cf4b
- [x] Page admin /admin/menu pour configurer tous les menus — 758cf4b
- [x] Recherche avancée : 5 types, filtres tags/url, pagination, surlignage — 758cf4b
- [x] ViewsConfigPage en 4 onglets — 758cf4b
- [x] Landing : features actualisées, communautés avec covers — 758cf4b
- [x] Sitemap complet avec descriptions, filtrage par auth — 758cf4b
- [x] Tutoriels revus (pulse-only, tour dashboard) — 0cbc6a6
- [x] Page de contact / support — 054ce63
- [x] Page liens rapides (étiquettes avec favicon) — 182052e
- [x] Page favoris/épinglés avec bookmarks d'items — 83fac2c

### 2026-03-19
- [x] Refonte 8 pages admin (pagination, search, export CSV, avatars) — a8eeb74
- [x] Sidebar drag & drop reorder communautés — a8eeb74
- [x] Cartes communautés publiques enrichies (cover, avatar) — a8eeb74
- [x] Plan du site + composants publics réutilisables — a303f5a
- [x] Config admin pages globales (menu principal dynamique) — a303f5a
- [x] Fusion Dashboard + Tableau de bord en vue unique — a303f5a
- [x] Filtrage dashboard par membership — a303f5a
- [x] Communautés publiques + bouton "Découvrez sans connexion" — a303f5a

### 2026-03-17
- [x] MindMap : réordonnancement frères par drag — 45694d1
- [x] Permissions : visibilité espaces (OPEN/READONLY/PRIVATE) — 0d2f928
- [x] Templates d'espace : 8 templates enrichis — f506434

### 2026-03-15
- [x] Sidebar multi-communauté dépliées par défaut + compteur — 75d49c7
- [x] Flow création communauté multi-étapes + approbation admin — 75d49c7
- [x] Onboarding complet : modale bienvenue + tours guidés toutes vues — 13e605d
- [x] Parcours premier utilisateur — e179fd8
- [x] Communautés publiques : rejoindre/quitter — 448d67a
- [x] Breadcrumb item (Communauté → Espace → Parents) — 0676f90
- [x] Favoris / récents — 3054f7d
- [x] Domaine Resend spok.space (SPF/DKIM/DMARC) — 30fbf6d
- [x] Template email header/footer SPOK — 5775ae7
- [x] Invitations membres (inscrits + non-inscrits) — 25f35ba, 950bec0

### 2026-03-14
- [x] Écran d'accueil orienté navigation — d222fcf
- [x] Dashboard cockpit : KPIs, progression par espace — 105b7e1

### 2026-03-13
- [x] Type DIAGRAM avec éditeur draw.io intégré — bd9112f
- [x] Modales d'édition fullscreen — 2ffc84a

### 2026-03-12
- [x] Menu réorganisé + filtres partagés + vues Membres/Priorités — f0cb1b4
- [x] Priorité : référentiel 4 niveaux + sélecteur + affichage — f498b48
- [x] Export PDF + capture PNG — b4db74f

### 2026-03-10–11
- [x] EgoNetworkView, HeatmapView, MatrixView, DeadlinesView — 0d74d3a, ed8be2d
- [x] PWA installabilité — d72914c
- [x] Gantt flèches de relations — 0e0840f
- [x] Fix sidebar espaces disparaissent — ac04cf7

### 2026-03-08–09
- [x] ChordView, CfdView, BurndownView, TreemapView, RadialTreeView, CrossTableView — 68bf9a8, 6091981, aa1aa4c, 09a1a35
- [x] @mentions et #références TipTap — 000593b
- [x] Notifications email — 3457763
- [x] Tags communauté — b5d10de
- [x] Modèle Invitation dédié — b3bf186

### 2026-03-07
- [x] Landing page — 5992bf2
- [x] Accès anonyme communautés publiques — 1f9d3d3
- [x] BubbleView — 4df0e37

### 2026-02-22–26
- [x] Relations enrichies + Vue Relations — c4849fb, ebdbd13
- [x] Portails cross-space 9 vues — 2c6bea2
- [x] Vue Calendrier mensuelle — c459701
- [x] Drag & drop espaces sidebar — f26c95e

### 2026-02-15–16
- [x] Images avatar/couverture espaces et communautés — 1258856
- [x] Suppressions sécurisées + audit + restauration — 5e9afd2
- [x] Gestion membres d'espace — 0ef397b
- [x] Convertir item en espace — f53ce85

### 2026-02-07–11
- [x] Import forum MSF complet
- [x] Éditeur rich text TipTap — 3dcd743
- [x] Vue graphe, Sunburst, MindMap — c1f79e4, 518a5dc, 717b916
- [x] Admin Stats, Anomalies, Référentiels
- [x] Recherche globale cross-espaces — 61163d5
- [x] Responsive mobile — 655959a
