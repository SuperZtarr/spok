# SPOK - Suivi des tâches

## À faire

### Modes d'interface (Forum / Projet / Exploration)

> Prérequis absolu avant de coder les modes : refactoriser ItemEditModal

- [x] **Étape 1 — Refactor ItemEditModal** : supprimer toutes les conditions d'affichage par type d'item (`if item.type === X`), repartir d'une base uniforme tous champs visibles — 2026-06-14
- [x] **Étape 2 — Implémenter le système de modes** : sélecteur global dans la navigation, stockage localStorage, store Zustand, filtres vues (SpaceToolbar + GlobalNavBar) et champs (ItemEditModal) — 2026-06-14
- [ ] **Étape 3 — Mode Forum** : affiner spec vues/champs
- [ ] **Étape 4 — Mode Projet** : affiner spec vues/champs
- [ ] **Étape 5 — Mode Exploration** : tout exposé, à affiner

### Tests / qualité
- [x] BUG filtres échéances (GlobalTaskFilterBar) : corrigé — 2026-07-12
- [x] Réparer les TNR : 47 tests en échec réalignés sur les comportements actuels des routes — 422/422 verts — 2026-07-11
- [x] Routes graph.ts : accès public (visitorPreview) implémenté sur les 4 routes graphe/sunburst — anonyme et non-membre voient les communautés publiques, 403 propre sinon, plus aucun crash 500 — 2026-07-12
- [x] spaces.ts DELETE /:id : commentaire corrigé — CommunityRole n'a que OWNER/MEMBER, pas d'ADMIN au niveau communauté, le code était déjà correct — 2026-07-12
- [x] Couverture community-referentiels.ts : 13 tests (GET public, PUT/reset réservés OWNER, check-status-usage) — 2026-07-12
- [x] Fix layout MindMap : reparentage décalant des branches entières — reset des positions sauvegardées sur toute la branche racine affectée (ancien ET nouveau parent), pas seulement le parent direct — 2026-07-14 (e85c56d)

### Didacticiels / aide contextuelle
- [ ] Revoir tous les tours de vues : contenu manquant ou absent (thread, text, et potentiellement d'autres) — pour chaque vue, soit compléter les étapes dans viewTours.ts, soit supprimer le bouton aide

### UX & formulaires
- [x] /today — D&D tâche→grille : glisser une tâche ou une suggestion de la liste sur la colonne Tâches (placement à l'heure du drop, snap 15 min) + grille en 2 colonnes Agenda/Tâches — 2026-07-12
- [x] /today — D&D événement→liste : glisser une réunion (bandeau journée entière ou colonne Agenda) sur la liste du jour crée une TASK et l'engage — espace cible = espace personnel (résolu via SpaceMembership OWNER + type PERSONAL, le plus ancien) — 2026-07-12
- [x] Vue Texte : export PDF réécrit pour refléter le document affiché (arbre, descriptions, contributions, filtre de recherche, sections portails) au lieu du tableau générique — 2026-07-14 (71071f0)
- [ ] Vue Tableau croisé : export dédié (CSV ou Excel avec lignes/colonnes du tableau)
- [ ] Pages globales (Liens, Images...) : revoir le filtre/navigation (vue d'espace + vue transverse globale)
- [ ] Page favoris / epingles (espaces, items, pages epingles par l'utilisateur)
- [ ] Whiteboard : tableau blanc collaboratif (dessin libre, post-its, formes)
- [ ] Mermaid : rendu de diagrammes Mermaid dans l'éditeur ou les descriptions
- [ ] ajouter un correcteur d'orthographe dans les zones de textes

### Evolutions (backlog récupéré depuis Projet SPOK)
- [ ] Organigramme à revoir
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

### Outillage Claude

- [ ] Skill `spok-layout` : documenter Sidebar + MainMenu (invariants, ce qui a régressé, fichiers clés) — enrichir aussi ARCHITECTURE.md avec le détail

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

