# SPOK - Suivi des tâches

## À faire

### Modes d'interface (Forum / Projet / Exploration)

> Prérequis absolu avant de coder les modes : refactoriser ItemEditModal

- [x] **Étape 1 — Refactor ItemEditModal** : supprimer toutes les conditions d'affichage par type d'item (`if item.type === X`), repartir d'une base uniforme tous champs visibles — 2026-06-14
- [x] **Étape 2 — Implémenter le système de modes** : sélecteur global dans la navigation, stockage localStorage, store Zustand, filtres vues (SpaceToolbar + GlobalNavBar) et champs (ItemEditModal) — 2026-06-14
> Recadrage 2026-07-15 : le mode n'est plus une bascule utilisateur — il est dérivé du champ `Community.context` (FORUM/PROJECT, null = neutre « tous »), choisi par le propriétaire dans les réglages de la communauté. Sélecteur 4 boutons du header supprimé.

- [x] **Contexte de communauté** : champ `Community.context` + dérivation automatique du mode (Layout), sélecteur Contexte dans les réglages (OWNER), badge Forum/Projet dans le header, filtrage de la nav mobile aligné sur le bandeau desktop (`MODE_GLOBAL_EXCLUDED` partagé via le store) — 2026-07-15 (d44ca99)
- [ ] **Étape 3 — Affiner le contexte FORUM** : vues/champs autorisés (aujourd'hui : thread/recent/text + exclusions bandeau)
- [ ] **Étape 4 — Affiner le contexte PROJECT** : aujourd'hui aucune restriction (MODE_ALLOWED null) — définir ce qui est réellement utile en pilotage
- [ ] **Étape 5 — Exploration** : à repenser en « loupe » utilisateur activable partout (pas un contexte de contenu), spec à faire

### Tests / qualité
- [x] BUG filtres échéances (GlobalTaskFilterBar) : corrigé — 2026-07-12
- [x] Réparer les TNR : 47 tests en échec réalignés sur les comportements actuels des routes — 422/422 verts — 2026-07-11
- [x] Routes graph.ts : accès public (visitorPreview) implémenté sur les 4 routes graphe/sunburst — anonyme et non-membre voient les communautés publiques, 403 propre sinon, plus aucun crash 500 — 2026-07-12
- [x] spaces.ts DELETE /:id : commentaire corrigé — CommunityRole n'a que OWNER/MEMBER, pas d'ADMIN au niveau communauté, le code était déjà correct — 2026-07-12
- [x] Couverture community-referentiels.ts : 13 tests (GET public, PUT/reset réservés OWNER, check-status-usage) — 2026-07-12
- [x] Fix layout MindMap : reparentage décalant des branches entières — reset des positions sauvegardées sur toute la branche racine affectée (ancien ET nouveau parent), pas seulement le parent direct — 2026-07-14 (e85c56d)
- [x] MindMap layout incrémental : la carte ne bouge plus globalement — layout complet seulement au premier rendu/repli/portails/bouton Réorganiser ; ajout/suppression/reparentage = ré-éventail local du/des parent(s) affecté(s) (module pur `mindmap-incremental.ts`, 12 tests), relations = arêtes seules, `clearAffectedBranches` supprimé — spec/plan docs/superpowers 2026-07-15 — 2026-07-15 (13e7083)

### Didacticiels / aide contextuelle
- [ ] Revoir tous les tours de vues : contenu manquant ou absent (thread, text, et potentiellement d'autres) — pour chaque vue, soit compléter les étapes dans viewTours.ts, soit supprimer le bouton aide

### UX & formulaires
- [x] /today — D&D tâche→grille : glisser une tâche ou une suggestion de la liste sur la colonne Tâches (placement à l'heure du drop, snap 15 min) + grille en 2 colonnes Agenda/Tâches — 2026-07-12
- [x] /today — D&D événement→liste : glisser une réunion (bandeau journée entière ou colonne Agenda) sur la liste du jour crée une TASK et l'engage — espace cible = espace personnel (résolu via SpaceMembership OWNER + type PERSONAL, le plus ancien) — 2026-07-12
- [x] Vue Texte : export PDF réécrit pour refléter le document affiché (arbre, descriptions, contributions, filtre de recherche, sections portails) au lieu du tableau générique — 2026-07-14 (71071f0)
- [x] ItemEditModal : dates (Début/Fin/Échéance) réaffichées pour les types Lien/Doc/Image/Diagramme (masquées à tort par `isExclusiveType`) — vides par défaut, rien ne les préremplit — 2026-07-14
- [x] ItemEditModal : description visible pour tous les types (gate `isExclusiveType` retiré du bloc Description) — 2026-07-15 (c43ccdf)
- [x] Fix /contact et /sitemap sans sidebar/bandeau pour un utilisateur connecté (isAuthPage traitait ces pages publiques comme les pages d'auth) — 2026-07-15 (e8230cf)
- [x] /today — colonnes par agenda : une colonne par feed ICS + colonne SPOK dédiée + Tâches unique, pastilles de visibilité persistées (localStorage) indépendantes du `enabled` des feeds — spec docs/superpowers/specs/2026-07-18 (chantier 0 de la réflexion multi-contextes ; chantiers 1-3 : horizons+revue, fenêtres de faisabilité, placement contraint — à arbitrer) — 2026-07-18 (093631b, largeurs dcbe5bf : liste fixe 380px, min 110px/colonne + scroll horizontal)
- [x] /today — menu contextuel enrichi : M'assigner + Modifier le statut (référentiels par défaut, compromis /tasks) ; Déplacer/Dupliquer/Fusionner/Ajouter un enfant restent non câblés (modales d'espace à extraire de SpacePage si besoin) — 2026-07-18 (093631b)
- [ ] Vue Gantt : ajout rapide d'une échéance via clic droit sur une barre (raccourci, pas besoin d'ouvrir la modale complète)
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
- [ ] Notifications : suivi de lecture / marqué comme non lue
- [ ] Notifications : exploiter la table `ItemView` (item_views) — le suivi des vues par utilisateur existe déjà dans le schéma Prisma (constaté 2026-07-11), reste à l'exploiter côté notifications

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

- [x] Skill `spok-layout` : documente Layout.tsx/GlobalNavBar.tsx (anciens MainMenu.tsx/Sidebar.tsx, supprimés) — invariants, régressions passées (z-index, overflow-hidden, polling sidebar, largeur toggle), fichiers clés — ARCHITECTURE.md et CLAUDE.md mis à jour avec les noms de fichiers réels — 2026-07-14

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

