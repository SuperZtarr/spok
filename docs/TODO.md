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
- [ ] Réparer les TNR : 47 tests API en échec sur 414 (constaté 2026-07-11) — les tests datent du commit initial Vitest (ee2359f) et n'ont pas suivi l'évolution des routes (communities, spaces, referentiels, user-tasks, items, graph, search) + useSort.test.ts (erreur d'import) + 1 test pert-utils

### Didacticiels / aide contextuelle
- [ ] Revoir tous les tours de vues : contenu manquant ou absent (thread, text, et potentiellement d'autres) — pour chaque vue, soit compléter les étapes dans viewTours.ts, soit supprimer le bouton aide

### UX & formulaires
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
- [ ] Connexion calendrier messagerie (Outlook/Hotmail, Gmail) : pousser des RDV (items MEETING) et récupérer les événements via Microsoft Graph API / Google Calendar API

### Outillage Claude

- [ ] Skill `spok-layout` : documenter Sidebar + MainMenu (invariants, ce qui a régressé, fichiers clés) — enrichir aussi ARCHITECTURE.md avec le détail

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

