# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## EN COURS

### Fix crash MindMap — elementsFromPoint sur coordonnée non finie — 2026-07-13
- Remonté par Sentry (prod, spok-web, Chrome OS) : TypeError "Failed to execute 'elementsFromPoint' ... non-finite" sur /spaces/:id?view=mindmap
- Cause tracée précisément : poignée de drag native HTML5 (GripVertical, mindmap-nodes.tsx) — le garde-fou existant ne détectait que clientX/Y=0 (annulation standard HTML5) mais pas NaN, produit par un drag tactile annulé sur Chrome OS → elementsFromPoint(NaN, NaN) lève une exception
- Fix : garde Number.isFinite en plus du test =0, à la fois dans mindmap-nodes.tsx (onDrag/onDragEnd) et dans MindMapView.tsx (getSidebarSpaceAtPoint, protégée à la frontière de l'API navigateur pour couvrir tous les appelants)
- Pas de test dédié écrit (composants de vue non couverts par des tests unitaires dans ce repo, cohérent avec la convention existante) — typecheck web scopé OK, check-doc-headers OK
- NON COMMITÉ

### Fix accès menu Carte mentale/Graphe global/Liens — 2026-07-12
- Signalé par Thomas : "Carte mentale globale" invisible, quel que soit le mode d'interface
- Cause tracée : commit f5d6d69 (20 mai, refactor menu MenuItem→MENU_REGISTRY) avait basculé global-mindmap/global-graph/global-links de access:'user' à access:'admin' — invisibles pour tout compte non-admin depuis, effet de bord passé inaperçu 2 mois
- Remis à access:'user' (cohérent avec global-sunburst resté 'public') — confirmé par Thomas
- pnpm build:packages + redémarrage dev (HMR ne recharge pas shared compilé)
- NON COMMITÉ

### Cascade communityId aux espaces enfants (déplacement vers une autre communauté) — 2026-07-12
- Besoin : « lors du déplacement d'un espace dans une autre communauté, il faudrait que cela embarque les espaces enfants »
- Bug confirmé : PATCH /spaces/:id ne mettait à jour QUE le communityId de l'espace déplacé — les descendants restaient rattachés à l'ancienne communauté, arbre incohérent
- Fix : si communityId change réellement (comparé à l'existant), collecte récursive des descendants (même pattern que le DELETE, dupliqué localement — convention déjà en place 6x dans ce fichier, pas d'extraction) puis space.updateMany sur tous les descendants avec le nouveau communityId — séquentiel (pas de $transaction : le mock helpers.ts ne déroule pas les promesses d'un tableau, cohérent avec l'unique autre usage de $transaction du fichier qui ignore déjà la valeur de retour)
- 2 nouveaux tests (cascade sur 2 niveaux, pas de cascade si communityId inchangé) — 50/50 spaces.test.ts, typecheck api scopé OK
- NON COMMITÉ

### Fix commentaire spaces.ts DELETE /:id — 2026-07-12
- CommunityRole n'a que OWNER/MEMBER (pas d'ADMIN au niveau communauté) — le commentaire "Community OWNER or ADMIN" était obsolète, le code (OWNER only) était déjà correct. Commentaire aligné sur la réalité du schéma
- Dernier item ouvert du TODO "Tests / qualité" — section entièrement traitée
- Vérifié : 487/487 TNR, typecheck 5/5, check-doc-headers OK

### Page « Ma journée » (/today) — 2026-07-12
- Besoin (brainstorming) : « je ne sais plus ce que je dois faire » → réunions Outlook (client + Hotmail) hors SPOK → page /today = réunions ICS + liste du jour mixte (suggestions serveur + pioche manuelle, persistée par date)
- Spec docs/superpowers/specs/2026-07-11-today-page-design.md, plan docs/superpowers/plans/2026-07-12-today-page.md — exécution inline complète (9 tâches)
- Backend : tables CalendarFeed + DayPlanEntry (db push local, prod suivra au deploy via start-api.sh), utils/calendar-source.ts (node-ical, RRULE, cache 15 min), routes /user/calendar-feeds + /user/agenda + /user/day-plan — 15 nouveaux tests
- Front : TodayPage + components/today/* (AgendaTimeline, DayPlanList, CalendarFeedsModal, PickTasksModal), hooks/useAgenda.ts (bornes de journée calculées côté client), route /today, entrée menu « Ma journée » (Personnel, icône Sun, masquée modes forum/exploration)
- Vérifié : 446/446 TNR, typecheck 5/5, check-doc-headers OK, smoke test API local vert (suggestions réelles) — vérif visuelle À FAIRE par Thomas (feed ICS réel à ajouter)
- Doc SPOK : item « Ma journée [TodayPage] » créé (cmrgzj9lj0001335i00ab6rpf, to_validate) via Prisma direct
- Divergence constatée : MainMenu.tsx n'existe plus → GlobalNavBar.tsx (+ SpaceToolbar pour les vues) — skill spok-menu annotée, à réécrire proprement un jour
- Fix annexe : scripts/restart-dev.ps1 ($pid réservé → $procId)
- Time-blocking (2026-07-12, spec 2026-07-12-today-timeblocking-design.md, plan 2026-07-12-today-timeblocking.md) : DayPlanEntry.plannedStart/plannedDuration, PATCH day-plan étendu (null dé-place et efface la durée), lib/timeblock.ts (findFreeSlot pur, testé), DayTimeGrid (grille 7h-20h, drag/resize pointer events snap 15 min, chevauchements côte à côte), bouton « Placer » (premier créneau libre), TodayPage réorganisée (grille 2/3 + liste 1/3, allDay en bandeau) — AgendaTimeline plus utilisée par la page (conservée)
- Vérifié time-blocking : 455/455 TNR (9 nouveaux), typecheck 5/5, smoke test PATCH placement réel OK
- Doc SPOK TodayPage mise à jour (time-blocking ajouté, to_validate)
- Commité et poussé (mep 2026-07-12, e6af61e) — le schéma prod s'applique au déploiement (start-api.sh db push)
- Post-mep : auto-login dev (LoginPage, build dev + VITE_DEV_AUTOLOGIN=1 dans apps/web/.env — navigateur intégré Claude au contexte vierge) ; fix fetchApi 204 No Content (DELETE calendar-feed ne rafraîchissait pas la liste) — vérifié en réel, suppression OK — commités (3f08e19, c7b40c9)
- Feed « Matthias » en erreur chez Thomas : lien Outlook généré avec GUID nul (00000000-…) → 500 côté Microsoft — dépublier/republier le calendrier dans Outlook
- Filtre global sur /today (2026-07-12) : GlobalTaskFilterBar + useGlobalTaskFilters réutilisés tels quels ; /user/agenda accepte spaceId/status/priority/search (contraintes ADDITIONNELLES sur les suggestions uniquement — plan et grille jamais filtrés) ; la pioche hérite des critères (extraFilters). 458/458 TNR (3 nouveaux), typecheck 5/5, vérifié en réel (recherche non-matchante → suggestions vides, Effacer → retour) — commité (5f03b93)
- Doc SPOK TodayPage : filtre global ajouté aux comportements (to_validate)
- Backlog acté avec Thomas : D&D tâche→grille (placement au drop) et événement→liste (création de tâche — question ouverte : espace cible) — reportés, le filtre passait d'abord
- Post-mep 2 (2026-07-12) : pleine largeur (max-w-5xl retiré) ; ligne rouge « maintenant » (jour courant, refresh 1 min, vérifiée au pixel) ; grille en DEUX colonnes Agenda/Tâches (même axe, ligne rouge traversante) ; D&D HTML5 liste→colonne Tâches (tâche non placée = placement, suggestion = engagée+placée en un geste via POST day-plan étendu, liseré de prévisualisation, snap 15 min) — 460/460 TNR (2 nouveaux), typecheck 5/5, drop vérifié en réel dans le panneau (bloc posé à 13h45 puis nettoyé) — commité (mep 2026-07-12 soir)
- D&D événement→tâche (sens inverse) : toujours au TODO, question espace cible ouverte
- Fix suggestions : le statut standard `late` (« En retard ») était ignoré par l'algo (10 tâches invisibles en prod !) → inclus dans les critères et classé rang 0 avec les retards de date ; `scheduled` reste différé jusqu'à sa date (deferredByDate, voulu) — vérifié sur données prod en lecture seule (35→45 tâches capturées), 461/461 TNR — commité (mep 2026-07-12 soir)
- Fix filtre Types : la ligne Types de la barre était ignorée (agenda forçait type TASK) → /user/agenda accepte ?type= (validé contre les ItemType, défaut TASK), suggestions + pioche câblées — vérifié en réel (coche Anomalie → requête type=TASK,BUG), 462/462 TNR — commité (mep 2026-07-12 soir)
- Menu contextuel des items sur /today (ItemActionMenu + buildItemMenuGroups réutilisés) : lignes de liste, suggestions et blocs de grille — Ouvrir/Nouvel onglet/Modifier (ItemEditModal branchée, pattern GlobalTasksPage)/Supprimer avec confirm — vérifié en réel (menu ouvert, modale OK), 462/462 TNR, typecheck 5/5 — commité (mep 2026-07-12 soir)
- UX case/croix vérifiée avec Thomas : case = done/rouvrir (l'entrée reste, barrée) ; ✕ = dés-engager/dé-placer — confusion levée, comportement nominal confirmé en réel
- Fix lisibilité FilterChip (GlobalTaskFilterBar, composant partagé) : puce active = coche ✓ + gras + ring-1 (le pastel seul était illisible, remontée Thomas) — typecheck OK, vérif visuelle Thomas — commité (mep 2026-07-12 soir)
- RESTE (Thomas) : vérifier que le tenant client autorise « Publier un calendrier » ; tester la page en réel (feed ICS + drag des blocs)
- Suggestions : plafond remonté 10→50 (Thomas avait beaucoup d'éléments matchant les critères)
- Liste du jour + suggestions en cartes flex-wrap (largeur fixe 256px) au lieu d'une colonne empilée — plus d'éléments visibles sans long scroll
- Suggestions groupées en arbre repliable par espace (chevron + nom + compteur) — répond au besoin d'identifier de quel projet vient chaque suggestion (nom d'espace retiré des cartes individuelles, redondant avec le groupe)
- Largeur page : plafond max-w-7xl remis (repéré trop large en grand écran), ratio grille/liste 3fr/2fr (était 2fr/1fr, jugé trop étroit pour la liste)
- Largeur : plafond max-w-7xl retiré (blanc à droite sur grand écran) ; ratio grille/liste ajusté à 3fr/7fr (grille Agenda+Tâches réduite, liste élargie) après essais 6fr/2fr puis 3fr/2fr
- Vérifié : typecheck 5/5 après chaque itération

### Filtre communauté (contexte de travail) — 2026-07-12
- Besoin : « je m'organise selon des activités d'un contexte » → la coche Communauté de GlobalTaskFilterBar existait dans l'UI mais n'était jamais sérialisée en paramètre API — bug identifié plus tôt dans la session, corrigé maintenant
- API : `communityId` (multi-valeurs) sur /user/tasks (narrows accessibleSpaceIds AVANT le filtre spaceId — bug annexe corrigé au passage : un spaceId filtré n'était plus jamais intersecté avec les espaces accessibles pour une sélection à 1 seul espace) et /user/agenda (même traitement que spaceId/status/priority : suggestions uniquement)
- useGlobalTaskFilters.ts : `selectedCommunities` enfin sérialisé dans queryParams — bénéficie automatiquement à /today, /tasks (GlobalTasksPage) et Tableau de bord (MyDashboardView), qui passent déjà l'objet queryParams complet
- 4 nouveaux tests (2 user-tasks, 2 agenda) — 465/465 TNR, typecheck 5/5

### Suggestions /today — tous les éléments, plus de filtre d'urgence — 2026-07-12
- Besoin : « je ne vois pas tous les éléments » → deux mécanismes masquaient : (1) filtre d'urgence codé en dur dans la requête (dueDate<to OU in_progress/late OU priorité≥3), indépendant des statuts choisis dans la barre ; (2) plafond SUGGESTION_CAP=50
- agenda.ts : filtre d'urgence retiré de la clause WHERE (ne sert plus qu'au TRI via rank(), plus à l'exclusion) ; défaut type passe de TASK-only à tous types (la barre restreint depuis ce défaut) ; plafond supprimé (take:100→500 en sécurité + orderBy dueDate/priority pour un cap sûr) ; TodayPage : useGlobalTaskFilters({ defaultTypes: [] })
- Note : la pioche (PickTasksModal → /user/tasks) garde son défaut TASK-only, cohérent avec la page Tâches globales — pas touché (hors périmètre de la demande)
- 2 tests retirés (obsolètes, testaient le mécanisme retiré) + 3 nouveaux (défaut sans type, pas de plafond, item calme sans échéance/priorité suggéré) — 466/466 TNR, typecheck 5/5
- Doc SPOK TodayPage mise à jour (défaut de page + comportement suggestions, to_validate)
- MCP SPOK toujours en 401 — script Prisma direct utilisé

### D&D événement→liste (dernier item du backlog /today) — 2026-07-12
- POST /user/day-plan/from-event : crée une TASK (titre + échéance de l'événement) dans l'espace personnel (résolu via SpaceMembership OWNER + Space type PERSONAL, le plus ancien — cohérent avec la garantie posée à l'inscription/connexion dans auth.ts) et l'engage (source manual, non placée)
- Front : bandeau journée entière + blocs de la colonne Agenda (DayTimeGrid) draggables (dataTransfer {kind:'event', title, start}) ; DayPlanList cible de drop (surbrillance ring pendant le survol)
- N'altère jamais l'événement source (feed ICS lecture seule, ou item MEETING existant)
- 3 nouveaux tests API — 469/469 TNR, typecheck 5/5, smoke test réel (création + nettoyage entry + item)
- Doc SPOK TodayPage mise à jour (to_validate) ; TODO.md ligne D&D événement→liste cochée
- Backlog /today du 2026-07-12 entièrement traité (filtre global, filtre types, filtre communauté, D&D dans les deux sens, menu contextuel, zoom multi-années Gantt)

### Fix bug filtres échéances (GlobalTaskFilterBar) — 2026-07-12
- Cause réelle (tracée précisément, corrige ma note approximative de tout à l'heure) : useGlobalTaskFilters.ts dueDateParams testait `minFrom === undefined` alors que minFrom vaut `null` — condition toujours vraie. Effet concret : "En retard" combiné à Aujourd'hui/Semaine/Mois se voyait réimposer un plancher "aujourd'hui" SI un preset borné était traité après "En retard" dans l'ordre de sélection → les tâches en retard étaient exclues à tort, de façon dépendante de l'ordre de clic
- Fix : calcul réécrit indépendant de l'ordre (hasOverdue précalculé ; plancher "aujourd'hui" posé seulement si un preset borné est choisi SANS overdue)
- 5 nouveaux tests (useGlobalTaskFilters.test.ts, nouveau fichier, renderHook + vi.useFakeTimers) — vérifiés isolément (règle : TNR complète réservée au mep, pas en intermédiaire), typecheck web scopé OK

### Couverture community-referentiels.ts — 2026-07-12
- Nouveau fichier community-referentiels.test.ts : 13 tests — GET public (optionalAuthenticate, comme referentiels.ts), PUT/reset réservés au OWNER (401 sans token, 403 si MEMBER/aucune adhésion), fusion partielle statuses/typeLabels, validation Zod (400), check-status-usage (comptage sur les espaces de la communauté, statusId='undefined' → status null)
- Vérifiés isolément (fichier seul) + typecheck api scopé OK
- NON COMMITÉ

### Zoom Gantt — niveau Multi-années — 2026-07-12
- Besoin : dépasser la vision Année sur le Gantt (`TimelineView.tsx`)
- timeline-constants.ts : ZoomLevel + 'multiyear' (1095 j ≈ 3 ans, dayWidth 2, navStep/snapDays 90) — mécanisme Record+tableau ordonné, extensible sans casser day/week/month/quarter/year
- Entête réorganisée : niveau Année → lignes Trimestre + Mois ; niveau Multi-années → lignes Année + Trimestre (nouveaux regroupements `quarters`/`years`, réutilisent le pattern `months`/`weeks` existant) ; lignes de grille des barres suivent trimestres/mois selon le niveau
- SCROLL_RANGE_DAYS 6→8 ans (marge de défilement pour le nouveau niveau)
- Vérifié : typecheck 5/5 — NON COMMITÉ

### Sentry (code prêt, activation en attente des DSN) — 2026-07-13
- @sentry/node (API : init si SENTRY_DSN, capture des 500 inconnues uniquement) + @sentry/react (web : init si VITE_SENTRY_DSN au build, tracesSampleRate 0)
- Dockerfile.web : ARG/ENV VITE_SENTRY_DSN ; .env.example : les 2 clés
- No-op tant que les DSN ne sont pas posés — RESTE (Thomas) : compte sentry.io, 2 projets (node + react), DSN dans Railway (SENTRY_DSN sur spok-api, VITE_SENTRY_DSN sur spok-web) 
- Vérifié : typecheck 5/5, 426/426 TNR, front OK sans DSN — commité et poussé (mep 2026-07-11)
- ACTIVÉ (2026-07-11) : org sentry `roedel`, projets spok-api (Fastify) + spok-web (React), DSN posés dans Railway, services redéployés
- Vérif front de bout en bout OK : 2 erreurs de test remontées dans le dashboard (SPOK-WEB-1 handler global, SPOK-WEB-2 captureException) — côté API, rien à vérifier tant qu'aucune vraie 500 (config = 500 inconnues uniquement)
- Doc fonctionnelle : 2 items créés sous Système > PROD en to_validate — "Monitoring d'erreurs [Sentry]" (cmrgtiq8t0001nbhnchmj0ao1) et "Chaîne de déploiement [CI + Wait for CI]" (cmrgtiqim0003nbhn718tobtw) — via Prisma direct (scripts tmp_create_system_doc.ts)
- MCP SPOK HS : 401 au login (SPOK_EMAIL/SPOK_PASSWORD du .env ≠ mot de passe roté) — RESTE (Thomas) : mettre le bon mot de passe dans .env puis redémarrer Claude


### Scripts typecheck réels — 2026-07-13
- script typecheck (tsc --noEmit) ajouté aux 5 packages → pnpm typecheck fonctionne enfin
- CI simplifiée (une étape typecheck), avertissements retirés de CLAUDE.md + skills rebuild/deploy
- Commité et poussé (4ff8e87, mep 2026-07-11)



### Rattrapage documentation code — 2026-07-12
- Passe complète sur le repo : 293 fichiers source sans commentaire d’en-tête → 0 restant (vagues : stores/hooks/lib 41, routes/plugins/utils 53, pages/constants/scripts/packages 80, composants 115, reliquat 4)
- Script permanent scripts/check-doc-headers.mjs + étape 5 bloquante dans la skill spok-deploy
- Vérifié : build packages, typecheck web+api, 426/426 TNR
- Non commité — prochain mep
### Accès public graph.ts (option 2) — 2026-07-12
- `graph.ts` : les 4 routes (space graph, community graph, global, sunburst) gèrent l'anonyme et le non-membre selon la Matrice des droits (visitorPreview) — communautés publiques visibles, espaces PRIVATE exclus, 403 propre sinon
- `graph.test.ts` : +5 tests (anonyme public/privé, non-membre public/privé, global anonyme) — 426/426 verts
- Doc SPOK "Visualisations globales" mise à jour (to_validate) via script direct (MCP en anciens credentials jusqu'au redémarrage)
- Non commité — prochain mep

### SÉCURITÉ — fuite de secrets repo public + rotation — 2026-07-11
- Fuite détectée : DB prod Railway, mots de passe admin, clés R2 en clair dans fichiers trackés (repo PUBLIC depuis ~avril)
- Rotés : mot de passe Postgres prod (ALTER USER + variables Railway), JWT_SECRET/JWT_REFRESH_SECRET + NODE_ENV=production (Thomas), mot de passe admin superztarr@gmail.com (402 refresh tokens purgés)
- spok-api Railway : DATABASE_URL était en dur avec l'ancien mot de passe → corrigée ; déploiements OK
- Nettoyage repo : `_env.ts` lit le .env racine (nouvelles clés PROD_DATABASE_URL, SPOK_EMAIL, SPOK_PASSWORD), 6 scripts + MCP (launch.mjs, start-prod.bat) + skill spok-api + settings.local.json purgés — plus aucun secret dans les fichiers trackés (vérifié)
- Clés R2 rotées (Roll du token, secret = SHA-256 du token value) : .env local à jour, accès bucket testé OK — Thomas colle le secret dans Railway + GitHub Actions
- Skills corrigées : spok-tnr (vitest EST installé), spok-rebuild + spok-deploy + CLAUDE.md (pnpm typecheck ne vérifie rien → npx tsc --noEmit par app), spok-menu (pas de table MenuItem → MENU_REGISTRY + AppConfig menu_overrides), spok-start (noms outils claude-in-chrome)
- Nettoyage + skills commités/poussés (f1605ec, f6a9752, fd7d7b6) — repo public propre à HEAD
- spok-tnr enrichie : section "Check santé post-modification" + script permanent `apps/api/scripts/health-check.ts` (API/Web/DB locale, DB prod, R2 en une passe) — testée en réel : infra tout vert, typecheck OK
- TNR : 47 tests en échec réparés → 422/422 verts. Causes : dérive depuis ee2359f — description obligatoire + workflow pendingPublic (communities), invitations par token (communities/spaces), multi-OWNER, visibilité effective OPEN→MEMBER, plus de bypass admin (user-tasks/search), référentiels au niveau communauté (referentiels + admin), titre optionnel + reactionSummary (items), sémantique depends (pert-utils), dép @testing-library/react manquante (useSort)
- helpers.ts : MockPrisma modernisé (factory uniforme, tous les modèles dont invitation/itemView, findMany→[] par défaut)
- Bugs routes corrigés : graph /spaces/:id/graph et search / crashaient (500) pour un anonyme (request.user sans garde) → 403 / résultats vides. Autres handlers graph.ts encore concernés → TODO
- Réparations TNR commitées/poussées (f3b4947, e49723d, b731088)
- Anti-tunnel renforcé (2026-07-12) : CLAUDE.md global (« Enchaîner avec contrôle » : traiter immédiatement tout message en cours de route + points d'étape sur longues séquences + recadrage si élargissement de périmètre), skills spok-deploy/rebuild/tnr (encart anti-tunnel), mémoire feedback_runaway_coding mise à jour
- CI GitHub Actions (2026-07-12) : `.github/workflows/test.yml` — typecheck web/api + 422 TNR sur chaque push master (f0648cc, 9e77a39), premier run vert en 55 s ; paths-ignore docs/.claude/md, `[skip ci]` en soupape — "Wait for CI" coché sur les deux services Railway spok-web et spok-api (2026-07-11)
- Backup R2 réparé : le secret GitHub DATABASE_URL avait encore l'ancien mot de passe (échec du run du 11/07 04:48) → secret mis à jour via gh, run manuel vert
- RESTE : purge historique git (optionnel) ; redémarrer Claude pour recharger les skills modifiées

### Diagnostic doc "Fonctionnement structurel" + corrections — 2026-07-11
- Doc SPOK Modèle de données : ItemView créé (tables techniques), MenuItem requalifié (stocké via AppConfig, pas une table), ItemType sorti des tables (enum, à la racine), doublon PasswordResetToken (Autres fonctionnalités) → cancelled
- Doc SPOK Système : notes Architecture API/Web rafraîchies (39 routes, 41 pages, 41 vues, 15 stores, 20 hooks, tailles fichiers), Dettes techniques : section "Vérification 2026-07-11" (checkSpaceAccess/gros fichiers non traités, constants/ui.ts traité 7967L→181L), statuts passés à to_validate
- Port Postgres dev : réalité = 5433 (conteneur + .env) — corrigé dans .env.example, CLAUDE.md, mémoire (procedures, reference_config)
- TODO.md : ligne notifications corrigée (table ItemView existe déjà)
- Skill spok-doc : compteurs tables corrigés (13 fonctionnelles / 12 techniques)
- Items SPOK en attente de validation par Thomas (to_validate → done)

### À faire ensuite
- Affiner specs mode Forum/Projet/Exploration (étapes 3-5)
- Didacticiels : thread (pas de tour), text (tour vide)

## HISTORIQUE — 2026-07-05

### Fusion TreeItem/TreeItemRow — root drop zone + grip toujours visible Gantt
- `TreeItemRow.tsx` : composant de ligne d'arborescence unique (variant `inline` ListView / `sticky` Gantt-PERT), grip toujours visible, `RootDropZone` co-localisée
- `space-tree-view.tsx` : `TreeItem` délègue le rendu à `TreeItemRow`, garde le fetch récursif des enfants (`ItemChildren`)
- `TimelineView.tsx` : ajout `RootDropZone` pendant le drag + gestion du drop `over.id === 'root'` dans `handleGanttDragEnd`
- `PertView.tsx` : bascule sur le composant partagé (pas de DnD activé, `onMove` toujours absent côté PERT)

### Mode Projet — vue Types accessible aux utilisateurs
- `viewRegistry.ts` : `types` passe de `access: 'admin'` à `access: 'user'` — n'était bloqué que par le niveau d'accès, pas par le filtre de mode (déjà non exclu pour "projet")

## HISTORIQUE — 2026-06-17

### Gantt — scrollbar navigation + positionnement aujourd'hui (terminé)
- `TimelineView.tsx` + `index.css` : barre de défilement horizontale en bas (±3 ans, thumb proportionnel au zoom)
- `TimelineView.tsx` : aujourd'hui positionné au 1/4 gauche (init + bouton Aujourd'hui)

## HISTORIQUE — 2026-06-07

### PertToolbar migré sur ViewToolbar + fixes count
- `ViewToolbar.tsx` : slots `extraControls` + `customExport` pour injection de contrôles spécifiques
- `PertToolbar.tsx` : migré sur `ViewToolbar`, ne garde que les contrôles PERT (bloquants, zoom, sortMode, export SVG)
- `FilterToolbar.tsx` : count `X/Y` affiché dès que `filteredItemCount !== totalItemCount` (couvre filtre bloquants PERT)
- `PertView.tsx` : `filteredItemCount={showOnlyBlocking ? sortedItems.length : undefined}`

## HISTORIQUE — 2026-06-01

### Tri arborescence multi-vues + filtre MindMap
- `lib/treeSort.ts` : utilitaire partagé (TreeSort, sortTreeAlpha, applyTreeSort)
- `ui/TreeSortButton.tsx` : composant dropdown partagé
- `ListView.tsx` : refactorisé vers composants partagés
- `ThreadView.tsx`, `TimelineView.tsx`, `PertView.tsx`, `PertToolbar.tsx`, `SpacePage.tsx` : bouton tri ajouté
- `MindMapView.tsx` : bouton Filtrer local (type/statut) dans Panel top-left, priorité sur props SpaceToolbar

### Corrections diverses vues (en cours)
- `exportUtils.ts` : export SVG PERT via canvas (data URI, inlining styles, remplacement foreignObject)
- `SpacePage.tsx` : fix DnD arborescence (rootItemsList → rootItems)
- `ListView.tsx` : tri arborescence (manual/alpha-flat/alpha-tree), toolbar sticky
- `PertToolbar.tsx` : sticky top-0
- `PertView.tsx` : toggle tri rank/alpha, svgRef pour export, tooltip titre nœuds
- `TreeItemRow.tsx` : tooltip titre tronqué

## HISTORIQUE — 2026-06-01

### Fix PERT export + tri alpha + fix ListView
- `ExportDropdownButton.tsx` : dropdown via `createPortal` → corrige position hors écran
- `PertToolbar.tsx` + `PertView.tsx` : toggle tri dépendances / alphabétique
- `ListView.tsx` : fix crash `parentNames` utilisé avant initialisation

## HISTORIQUE — 2026-05-31

### Refactor toolbars par vue + export unifié (dba38db)
- `PertToolbar.tsx` : zoom + collapse + ExportDropdownButton (PDF data, PNG, PDF visuel)
- `TimelineView` : collapse/expand + ExportDropdownButton (CSV, Excel, PDF, PNG) dans toolbar interne
- `MindMapView` : boutons dans Panel RF (collapse, réorganiser, tout voir, ExportDropdownButton PNG+PDF schéma)
- `CollapseToggleButton` + `ExportDropdownButton` : composants partagés
- `exportUtils.ts` : fonctions d'export centralisées
- `SpaceToolbar` : ne garde que search/filtres/sélecteur/nouveau
- Fix icône commentaire relation : `setQueryData` optimiste sur create/update relation
- Fix MindMap fitView : ne recentre plus après interaction utilisateur
- Fix NotificationBell z-index

## HISTORIQUE — 2026-05-26

### Dashboard : panneau "Assignés à moi"
- `MyDashboardView.tsx` : dérivé `assignedTasks` depuis `allTasks` (assignedToId === user.id), panneau dans colonne droite après Aujourd'hui

### Fix bugs dashboard + auth returnTo
- `DeadlinesView.tsx` : prop `filters?` optionnelle — quand embedded, utilise les filtres du parent au lieu de sa propre instance
- `MyDashboardView.tsx` : passe `filters` à `<DeadlinesView embedded filters={filters} />`
- `LoginPage.tsx` : bandeau "Vous serez redirigé vers [page]" si `spok_returnTo` en sessionStorage

### Fix dropdowns header (NotificationBell + GlobalSearch)
- `Layout.tsx` : retiré `overflow-hidden` du Row 1 header — clipait les dropdowns absolus

### Vue PERT : tri automatique par rang de dépendance
- `timeline-tree.ts` : `buildTree` accepte un `sortFn` optionnel (fallback tri par `position`)
- `PertView.tsx` : `pertSortFn` (rang ASC, titre alpha ASC) passé à `buildTree` — tri local/temporaire, sans impact sur les autres vues
- `pert-utils.test.ts` : 4 nouveaux tests (chaîne linéaire, alpha, rang+alpha, hiérarchie)

## HISTORIQUE — 2026-05-22

### Relations proxies sur nœud replié — PERT
- `PertView.tsx` : `parentMap` + `effectiveRelations` useMemo — résout chaque endpoint vers son ancêtre visible, déduplique, filtre les self-loops
- Flèches proxies affichées en pointillés (`strokeDasharray`), non cliquables
- Chemin critique désactivé sur les flèches proxies

### Dialog édition relation — Gantt + PERT (0e89e3c) — poussé en prod
- `TimelineView.tsx` : clic sur flèche → dialog modifier/supprimer (remplace ConfirmModal delete-only), prop `onUpdateRelation` ajoutée
- `PertView.tsx` : idem, path SVG transparent cliquable dans `renderArrow`, dialog avec PERT_RELATION_TYPES (blocks/depends)
- `SpacePage.tsx` : `onUpdateRelation` câblé à TimelineView, `onDeleteRelation` + `onUpdateRelation` câblés à PertView

### Vue PERT + refactor VIEW_REGISTRY (c020256, 967716f) — poussé en prod
- `packages/shared/src/constants/viewRegistry.ts` : source unique pour les 30 vues — plus besoin de toucher N fichiers pour ajouter une vue
- `viewDefaults.ts` + `menuDefaults.ts` + `viewMode.ts` : régénérés depuis VIEW_REGISTRY
- `apps/web/src/constants/viewIcons.ts` : map icônes centralisée (remplace ICONS dans ViewModeSelector et VIEW_ICON_MAP dans Layout)
- `PertView.tsx` : création de liens par glisser-déposer (comme Gantt), handle SVG sur bord droit, détection target par containment rect
- **MCP doc bloquée** : `mcp__spok__list_spaces` retourne vide, `get_space` retourne 404 — auth ztarr ne fonctionne plus (seules communautés publiques accessibles), doc SPOK à créer manuellement
- Fix build prod : `Gauge` et `Home` retirés des imports inutilisés dans `ViewModeSelector.tsx` (TS6133)

### Restauration item après reconnexion (d4291a6)
- `SpacePage` : sync bidirectionnelle `editingItemId ↔ ?item=` — param maintenu dans l'URL pendant toute l'ouverture de la modale
- `App.tsx` : au moment du `auth:logout`, sauvegarde `window.location.href` dans `sessionStorage('spok_returnTo')`
- `LoginPage` : après connexion réussie, lit `spok_returnTo` dans sessionStorage et redirige là (puis efface)
- Multi-onglets OK : sessionStorage est isolé par onglet

## HISTORIQUE — 2026-05-16

### Vue Doublons admin (9e6828b, 7e44f08, 6eda6f2, aad0904, 08cdeee)
- `GET /admin/duplicates` : détection par titre normalisé (LOWER/TRIM/REGEXP), URL (LINK), nom de fichier (IMAGE/DOCUMENT)
- Fil d'ariane : 2 niveaux de parents via LEFT JOIN (grandparent + parent)
- `DuplicatesPage` : tabs Tous/Titre/URL/Fichier, groupes de cartes scrollables horizontalement, breadcrumb Communauté > Espace > ancêtres
- Entrée menu admin "Doublons" avec icône Copy
- Fix build : variable `idx` inutilisée supprimée (TS6133, bloquait le build prod)

### Fix scrollbar vues à colonnes (bbeb926)
- `SpacePage` view container : ajout `kanban`, `members`, `types`, `priority` dans la liste `overflow-hidden flex flex-col`
- Sans ça, l'overflow horizontal remontait jusqu'au `overflow-hidden` de SpacePage et les colonnes de droite étaient coupées sans scrollbar

## HISTORIQUE — 2026-05-10

### MCP : fix description items doc (b460cfc, a900086)
- `create_item` / `update_item` : `body.description = textToHtml()` au lieu de `body.content = textToTiptap()`
- Nouveau `textToHtml()` : texte brut → `<p>...</p>` avec échappement HTML
- `extractText()` : gère HTML (strip tags) + join paragraphes avec `\n`
- Script migration `fix-mcp-descriptions.ts` : 253 items prod corrigés (TipTap JSON → HTML propre)
- Hooks PreToolUse : codage bloqué sans flag, git push bloqué sans flag
- Skill spok-start révisée : ouverture Chrome via PowerShell avant plugin

### Refonte tableau de bord (de8b44d)
- Suppression `DashboardCockpitView` (code mort)
- Renommage `MyOrganizationView` → `MyDashboardView`
- Déplacement section Échéances avant Semaine
- Layout horizontal : Échéances (flex-1, max-w-4xl) + Priorités/Retard/Aujourd'hui (w-72) + Répartitions/Progression (w-64)
- `flex-wrap` + `min-w-[320px]` pour le responsive
- `DeadlinesView` : colonnes espace/statut/priorité masquées sur mobile (`hidden sm:`)
- `UserProfileModal` : boutons logout et thème sans largeur forcée

### Navigation sticky entre espaces + indicateur vue par défaut (95c5dd4)
- `SpacePage` : priorité vue = `?view=URL > viewMode store > space.defaultView > list`
- `SpaceToolbar` : point pulsé (`animate-pulse`) sur bouton vue par défaut quand on n'y est pas
- `Layout` : nav mobile compactée en grille 4 colonnes (icône + label, sans en-têtes de section)

## HISTORIQUE — 2026-05-06

### Chemin critique Gantt — terminé (abe7f75)
- Algo CPM (forward/backward pass, Kahn topo sort) dans `timeline-utils.ts`
- Toggle GitBranch dans toolbar Gantt, barres critiques `ring-2 ring-red-500`
- Fix build prod : `NEW_USER` manquant dans Records de `NotificationBell.tsx` et `UserProfileModal.tsx` (88a3d5d)

### Diagramme — auto-save XML (4b32983)
- `ItemEditModal.tsx` : `autoSaveDiagramMutation` + debounce 2s sur `diagramXml`
- Déclenché uniquement si `type === 'DIAGRAM'` et item existant
- Invalide uniquement `['items', spaceId]` — pas de réinit du form

### MCP fix (4b32983)
- `apps/mcp/src/index.ts` : `body.description` → `body.content` lors d'update item

## HISTORIQUE — 2026-05-04

### MEETING — TimeRangePicker (plage horaire draggable)
- Nouveau composant `TimeRangePicker.tsx` : timeline 7h–22h, snap 15 min, 3 modes drag (start/end/move)
- Intégré dans `ItemEditModal.tsx` section dates, uniquement pour `type === 'MEETING'`
- `handleTimeRangeChange` : met à jour startDate/endDate en gardant la date, changeant l'heure
- Synchronisation bidirectionnelle avec les DateTimeField existants

### Menu contextuel — Modifier le statut avec sous-menu
- `ItemActionMenu` : ajout `submenu?: ItemAction[]` + `checked?: boolean` + rendu sous-menu portal (z-index 100000)
- `itemMenuGroups` : `statusAction` remplacé par `statusOptions + currentStatusId` → entrée "Modifier le statut" avec sous-menu listant tous les statuts visibles, statut courant coché
- 12 vues mises à jour : ListView, TimelineView, KanbanView, PlanningView, TextView, ImagesView, DocumentsView, LinksView, MindMapView, mindmap-nodes, mindmap-layout, space-tree-view
- KanbanView : suppression de la logique `nextStatusMap` / `nextStatus` / `nextStatusLabel`
- ImagesView/DocumentsView : correction du calcul bugué de `doneStatusId` (utilisait `statusLabels` au lieu de `statuses`)

## HISTORIQUE — 2026-05-01

### Gantt — timeline adaptive + centrage aujourd'hui + persistance vue
- TimelineView : ResizeObserver → containerWidth, visibleDays = floor((w-288)/dayWidth)
- centerDate (état) remplace visibleStartDate : visibleStartDate = centerDate - visibleDays/2 (useMemo)
- Redimensionnement : visibleDays change → visibleStartDate recalculé, aujourd'hui reste centré
- goToToday : setCenterDate(today) → recentre instantanément
- overflow-x-hidden + suppression min-w-max : grille remplit l'espace, pas de scrollbar horizontal
- Tooltip `title` sur les titres tronqués de la colonne gauche
- SpacePage : ?view=X dans l'URL (replace) — persist la vue sur refresh
  - viewReadyRef empêche le sync URL prématuré avant application du defaultView
  - defaultView effect lit searchParams.get('view') en priorité sur space.defaultView

## HISTORIQUE — 2026-04-30

### Responsive mobile — livré (c3ba19f)
- SpacePage : px-0 mobile, px-4 desktop
- SpaceToolbar : toggle filtres mobile (SlidersHorizontal), vues complexes masquées (kanban, types, members, timeline, graph…), mindmap gardé
- ListView : icône ℹ par ligne (statut, type, priorité, dates, parent), statut masqué de la grille mobile
- ThreadView : lastActivity + contribCount masqués mobile, métadonnées non-wrappantes
- ItemEditModal : header compact mobile
- Layout : sidebar 85vw, nav mobile avec sections/icônes
- HomeView, CommunityPage, SpaceExportButton, SpaceToolbar "Nouveau" : labels masqués mobile

## HISTORIQUE — 2026-04-29

### Menu contextuel — terminé (c6af110)
- 5 groupes : Ouvrir (Ouvrir / Ouvrir dans un nouvel onglet) / Modifier (Modifier, Absorber, Éclater, Fusionner) / [sep] M'assigner, Marquer terminé, Déplacer / Ajouter (Ajouter un enfant, Dupliquer) / Autres (Convertir en espace, Supprimer)
- onOpen (navigate onglet actuel) propagé dans 17 vues + SpacePage + space-tree-view
- space-tree-view migré vers buildItemMenuGroups

### Vignette utilisateur + toggles admin/dev (9c271cc 2026-04-29)
- Header : icône user → vignette nom+avatar
- Sidebar footer : suppression vignette
- UserProfileModal : AdminModeToggle + DevModeToggle + DevDbStatus déplacés

### Contributions non lues + viewedAt (2026-04-28)
- API items : isUnseen boolean → viewedAt (string|null), exposé seulement si updatedByOther+recent — ac493b3
- Fix : viewedAt omis (undefined) si non pertinent → évite clignotement de tous les items — ac493b3
- API item-contributions POST : touch item.updatedAt+updatedById au moment de créer une contribution
- shared type Item : isUnseen → viewedAt
- ListView, KanbanView, MindMap, TimelineView : isUnseen calculé depuis viewedAt (urgent rouge prime sur bleu)
- ItemEditModal : snapshot viewedAt avant ouverture (ref), contributions nouvelles surlignées en bleu + badge "Nouveau"
- Boutons modales : variant outline → bordered sur tous les Annuler/Fermer (13 modales) — ac493b3
- Doc SPOK mise à jour : En-tête, Vues, SpacePage, ItemEditModal (to_validate)

### PWA icône écran d'accueil (2026-04-28)
- icon-512.png régénéré depuis icon-192.png (hub design)
- sw.js : CACHE_NAME spok-v1 → spok-v2 (force invalidation cache sur téléphone)

### Navigation espaces → defaultView (2026-04-28)
- SpacePage useEffect : suppression garde `!space.defaultView` → toujours appliquer la vue (fallback 'list')
- CommunityPage : suppression `onClick={() => setMode('overview')}` sur SpaceCards (écrasait le defaultView)
- HomeView : SpaceCard `to` changé de `/spaces/:id/overview` → `/spaces/:id` (applique defaultView via SpacePage)

### Refonte header — GlobalNavBar (2026-04-28)
- Header 2 lignes : ligne 1 (h-12) titre + recherche + notifs + bouton profil ; ligne 2 barre de nav globale
- GlobalNavBar.tsx : boutons groupés par section (Global / Personnel / Administration) — même style visuel que SpaceToolbar
- MainMenu.tsx : retiré du Layout (conservé dans le projet mais non utilisé)
- Sections exclues : basic/itemTypes/planning/exploration (restent dans SpaceToolbar) + misc (logout/search/profile gérés ailleurs)
- Badge activité sur le bouton Activité ; admin en rouge uniquement si adminMode actif

### Composants cards + items non lus (2026-04-28)
- Statuts : Non défini=indigo, Annulé=rose, fix lookup '' → 'undefined' dans buildStatusColorMap/LabelMap
- Button : variant `bordered` (border-gray-400 + bg-secondary)
- CommunityCard.tsx + CommunityBanner : composants réutilisables extraits de CommunityListView
- ItemCard.tsx : composant réutilisable extrait de ActivityPage
- ActivityPage : utilise CommunityCard + SpaceCard + ItemCard, hiérarchie communauté > espaces > sous-espaces > items
- API activity : sous-espaces nestés (parentId), grouping community > espace racine > children
- API items : champ isUnseen calculé depuis ItemView (updatedAt vs viewedAt)
- isUnseen : animation unseen-blink bleue dans ListView, KanbanView, MindMap, TimelineView (urgent rouge prime)

### Documentation interfaces (session précédente)
- Espace Structure : 25 items documentés (Sidebar×7, Header×6, Zone principale×6, Sécurité & Accès×4 + 1 BUG inchangé)
- Espace Administration : nettoyage (14 annulés, 6 remontés à la racine) + 11 pages documentées + ViewsConfigPage, ApiDocPage, PerfPage créés
- Espace Modales & Overlays : 23 NOTEs vides annulés, CommunityDetailModal + SpaceDetailModal réécrits, StatusPropagationModal créé, 73 items passés à to_validate
- docs/technical/ : 6 fichiers supprimés (items-system, menu-system, auth-permissions, notifications, spaces-communities, views-system) + dossier supprimé
- CommunitySettingsPage : onglet Tags dédié (déplacé depuis Général)
- MCP extractText : fix récursif (bullet lists) + parsing JSON string — rebuild MCP
- CLAUDE.md global : ajout règle "une seule question à la fois"
- Espace Communautés : CommunityPage + sous-items, CommunitiesListPage + sous-items, CommunitySettingsPage + 7 onglets, ConfirmModal, CommunityDeleteConfirmModal
- Espace Espaces : SpaceOverviewPage + 5 sous-items, SpacePage + 6 sous-items, SpaceSettingsPage + 4 onglets, SpaceHistoryPage, Barre d'outils [SpaceToolbar] + 2 sous-items, Vues (5 sections + 30 items vue), item "Pages" + 6 sous-items annulés (doublons vides)
- Espace Items : Item [Item] + 3 sous-items, ItemEditModal + 5 sous-items (+ 28 sous-sous-items), ItemActionMenu + 15 actions, MergeItemModal
- Espace Pages publiques : 8 pages documentées (Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Invitation, Landing, Sitemap)
- Espace Pages utilisateur : 8 pages documentées (Accueil, Recherche, Dashboard, SpacesList, Graphe, Tâches, Sunburst, MindMap)

### Organisation documentation (session précédente)
- Objectif : doc SPOK = spec d'intention, consultée avant de coder (règle ajoutée dans CLAUDE.md)
- CONFIG.md désindexé de git (credentials) — 4f4f428
- CLAUDE.md + spok-doc skill restructurés — 9357e8b
- Template item de spec défini (Intention / Décisions de design / Comportements attendus / Contraintes / Fichiers)
- docs/technical/ et docs/specs/ : contenu différent, à évaluer puis migrer dans SPOK avant suppression
- Descriptions mises à jour sur 3 espaces prod (Projet SPOK, Produit SPOK, Contexte)
- 101 NOTEs supprimées de "Projet SPOK" (IMAGEs conservées), 13 items supprimés de "Produit SPOK"
- Restructuration hiérarchie doc : création "Fonctionnement structurel" + "Interfaces" sous Projet SPOK
- 12 espaces déplacés dans les bons groupes parents
- "Produit - SPOK" supprimé (vide, sans usage)
- MCP get_space : limite par défaut 50 → 200
- skill spok-doc mise à jour (IDs parents, hiérarchie)

## EN COURS — 2026-04-25

- Vue par défaut par espace : champ defaultView sur Space (Prisma + API + type shared + SpaceSettingsPage dropdown + SpacePage apply on entry) — ef8e463
- ListView responsive : grid par breakpoints, titre toujours visible — 9c81421
- MindMap dark mode : background dots adaptatif — 9c81421
- Admin audit logs : colonne entityId + titre (changes.before/after.title)
- Menu contextuel : option canEdit dans buildItemMenuGroups, gates write callbacks, VIEWER/MEMBER voient edit+openInNewTab seulement
- SpaceContentRedirect : useLocation().search préservé dans Navigate
- Toolbar espace : ligne de boutons de vues par section (useMenuItems().spaceViews), filtrés par allowedViews VIEWER, labels de section
- SpaceBreadcrumb supprimé de SpacePage (composant créé mais non utilisé)

## EN COURS — 2026-04-24

- MindMap dark mode : background dots adaptatif (hidden dark:block avec couleur slate-700)
- ListView responsive : grid par breakpoints, titre toujours visible, colonnes masquées progressivement
- TS warnings corrigés : Plus inutilisé, getItemUpdatedAt manquant, onOpenInNewTab non utilisé
- Commit 9c81421 pushé → prod Railway

## EN COURS — 2026-04-24 (précédent)

- Bugs UX corrigés : sidebar toggle z-index (z-[60]→z-30), dark mode textes noirs sidebar (text-black→text-foreground), favicon MindMap (Google→DuckDuckGo), logout redirect vers /login, recherche responsive (w-20 sm:w-28 md:w-40 lg:w-56), 409 sur inline update (suppression updatedAt), ouvrir item dans nouvel onglet (menu contextuel + ?item= param)
- CLAUDE.md : ajout règle interdiction appel API prod

## EN COURS — 2026-04-22 (suite)

- Fix accès communautés publiques pour non-membres (isPublic ignoré dans 3 endpoints) :
  - communities GET /:id : isPublic || visibility !== PRIVATE
  - communities GET /:id/members : même logique
  - spaces GET / : même logique (bug && → || en plus)
  - items checkSpaceAccess : même logique
- R2 CORS : corrigé dans Cloudflare (pointait vers localhost:3000)
- Auth flows : pre-fill email login→forgot-password, auto-login après reset-password
- Inscription : contrôle pseudo déjà utilisé (insensible casse)
- SpaceOverviewPage : route /spaces/:id/overview enregistrée, liens depuis HomeView + MainMenu

## EN COURS — 2026-04-22

- RichTextEditor : BubbleMenu tableaux (ajouter/supprimer lignes+colonnes, supprimer tableau) + CSS column-resize-handle (TipTap v3 @floating-ui)
- Bouton déconnexion déplacé : retiré du menu header (MainMenu), ajouté en bas de la modale profil (UserProfileModal)
- GlobalTasksPage + MyOrganizationView : filtre myTasks (créé par OU assigné à moi) activé par défaut
- API user-tasks.ts : ajout filtre myTasks (OR createdById/assignedToId), updatedAfter, updatedAt dans validSortBy
- HomeView : section communautés avec badge d'activité récente (items modifiés les 7 derniers jours par communauté)
  - Illustration communauté : fallback avatarUrl || coverUrl (fix)
  - Confirmé fonctionnel visuellement

## EN COURS — 2026-04-21

- Permissions items par ownership : OWNER peut éditer/supprimer tous les items, MEMBER uniquement les siens
  - API : items.ts PATCH+DELETE, item-move.ts move+bulk-move → check `createdById !== userId` pour MEMBER
  - Frontend : `canEditItem` function dans SpacePage, propagée à 13 vues (ListView, KanbanView, TimelineView, PlanningView, TextView, TypesView, ThreadView, PriorityView, MembersKanbanView, LinksView, ImagesView, DocumentsView, MindMapView/mindmap-layout)
- CommunitySettingsPage onglet Espaces : colonne Propriétaire ajoutée (API spaces.ts + type SpaceWithRole + frontend)

## EN COURS — 2026-04-19

- CommunitySettingsPage onglet Espaces : remplacé drag-drop cards par table admin-style (search, colonnes Nom/Type/Membres/Items/Créé/Supprimer, hiérarchie via indentation, drag-drop conservé, SpaceDeleteConfirmModal ajouté)
- Colonnes supprimées vs admin : Communauté (inutile dans les settings), Parent (géré par la hiérarchie)

## EN COURS — 2026-04-18

- Root cause cache dev identifié : SW (service worker) prod interceptait Vite en dev → fix main.tsx (prod only) + Cache-Control no-store
- MainMenu.tsx : 4 boutons catégories (Basique/Types/Planif/Explor) → 1 bouton "Espaces" avec dropdown multi-colonnes + lien Présentation
- menuDefaults.ts : ajout vue "Récents" (key: recent, section: basic, viewMode: recent)
- dev-start.ps1 : nettoyage dist/sw.js + node_modules/.vite au démarrage
- spok-menu skill : refactorisée pour refléter la vraie archi (MainMenu, pas ViewModeSelector)
- Commit 7f7a778 — À tester en local (connecté + ouverture dropdown Espaces)

## EN COURS — 2026-04-16

- Fix cache logo : déplacé public/logo.png → src/assets/logo.png (import Vite hashé), 7 composants mis à jour
- MindMap : vignettes élargies max-w 200→260px, RADIAL_STEP 350→420, positionsStorageKey v2→v3

## EN COURS — 2026-04-15

- Nettoyage espaces doc : doublons Modèle de données annulés (102 items), Modales todos passés en cours
- Espaces restructurés : Pages publiques (cmnxnu81f01h8n856xt1fj4bo), Pages utilisateur (cmnxohuia01mln856b8bu9luo) créés
- Pages publiques groupées : Authentification / Accès par lien / Découverte
- Pages utilisateur groupées : Navigation globale / Visualisations globales
- Structure espace Interface utilisateur legacy vidée — à supprimer
- Organisation cible (cmnxq6a9d01rqn8569geutzga) enrichie dans Projet SPOK : arbre complet avec Visions Globales, Structure de la page, Administration, Modèle de données, Systèmes
- 37 vues d'espace créées et regroupées en 5 catégories (Tableau de bord, Basique, Types, Planification, Exploration)
- Vues globales groupées en 3 sections (Vues globales, Mes activités, Divers)
- Feat : champ description sur Space (schema Prisma, API, textarea settings, tooltip header)
- Fix seed : Role.ADMIN et Role.VIEWER n'existent pas dans l'enum → remplacés par Role.MEMBER
- Commit & push → prod Railway
- Prochaine étape : mettre à jour spok-doc skill avec descriptions fonctionnelles des espaces
- Feat : vignettes MindMap réorganisées + illustrations par type (favicon, date réunion, doc, image) — 5bdf57d
- Chore : cleanup 7 scripts tmp API, docs/technical ajoutés, MCP client + launch scripts, assets pub (favicon/logo), skills spok-rebuild + spok-tnr — c7343a5
- Deploy prod → push origin/master

## EN COURS — 2026-04-13

- Nettoyage CLAUDE Documentations : ~20 items annulés (doublons/obsolètes), ~63 items requalifiés en to_validate
- Items skills déplacés sous leur parent skill (SPOK START/DEPLOY/API/DOC/TNR/REBUILD) via script Python
- Nouvelles skills créées : spok-tnr (.claude/skills/spok-tnr/), spok-rebuild (.claude/skills/spok-rebuild/)
- settings.local.json : permissions ajoutées pour git worktree list, Chrome navigate/tabs
- Mémoire : feedback session-journal, reference_skills_spok.md (IDs items skills dans SPOK)
- Structure "Fichiers de consignes" créée dans CLAUDE Documentations (CLAUDE.md, Skills, Memory, docs/)
- Consignes skills rapatriées dans les skills concernées (côté utilisateur, branche worktree)

## EN COURS — 2026-04-12

- Push prod : 2 commits (e30f753 fix éclatement H2/H3 menus vues, 9fcd494 chore skills)
