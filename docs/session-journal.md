# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## EN COURS

### Script de démarrage dev — readiness + ouverture navigateur — 2026-08-31
- Demande Thomas : scripter ce que je faisais à la main au démarrage (attendre que la stack serve du 200, ouvrir le navigateur) plutôt que des actions manuelles
- Constat : la chaîne existe déjà (hook `session-start-hook.ps1` → `dev-autostart.ps1` → `pnpm dev:start`). Manquaient : l'attente readiness (le hook disait juste « ~60s ») et l'ouverture navigateur
- Choix : étendre `dev-autostart.ps1` (pas de nouveau fichier, éviter un 2e poller). Cas « dev déjà lancé » non traité (Thomas : aucun besoin, l'onglet est déjà là)
- `dev-autostart.ps1` réécrit : attente Docker (inchangée) → `Start-Process pnpm dev:start` non bloquant → poll `:3000` + `:3001/health` toutes les 3s jusqu'à 200/200 (timeout 180s) → `Start-Process chrome.exe http://localhost:3000` inconditionnel (résolution chemin Program Files / (x86), sinon message, aucun fallback en cascade)
- Effet de bord : `pnpm dev` se détache de la fenêtre PowerShell du watcher — `pnpm dev:stop` tue node par port, sans impact
- Vérifié : parse PS OK, poll readiness OK sur stack en cours (200/200), résolution Chrome OK (`C:\Program Files\Google\Chrome\Application\chrome.exe`). Chemin cold-start complet (attente Docker + détachement dev) non testé (nécessiterait de tout arrêter)
- NON COMMITÉ

### Fix cache PWA (interface figée sur d'anciennes versions) — 2026-08-24
- Signalé par Thomas : des utilisateurs avaient une interface vieille de plusieurs mois malgré les MEP successives
- Cause : `sw.js` (service worker PWA) matchait la règle nginx `\.(js|...)$` en `immutable, expires 1y` au lieu du `no-cache` prévu pour l'app shell — retardait la détection de mise à jour côté navigateur
- Cause principale : aucun mécanisme ne rechargeait un onglet déjà ouvert (PWA installée, onglet épinglé) quand une nouvelle version du SW s'activait — l'app tournait indéfiniment sur le bundle chargé en mémoire au premier chargement
- Corrigé :
  - `nginx.conf` : ajout `location = /sw.js` en `no-cache` (précédence exacte sur la règle regex des assets)
  - `sw.js` : `CACHE_NAME` `spok-v3` → `spok-v4` pour purger le cache applicatif existant chez les utilisateurs
  - `main.tsx` : écoute `controllerchange` sur le service worker → rechargement automatique de la page quand une nouvelle version prend le contrôle
- Typecheck web OK, check-doc-headers OK
- NON COMMITÉ — à MEP sur demande

### Audit sécurité API — 2026-08-24
- Demande Thomas : état de la sécurité de SPOK
- Audité : auth/JWT, CORS, upload fichiers, requêtes SQL brutes ($queryRawUnsafe), tokens
- 4 correctifs appliqués (`apps/api`) :
  - `@fastify/rate-limit` : 100 req/min/IP global, 5 req/min/IP sur `/auth/register`, `/login`, `/forgot-password`, `/reset-password` (`strictRateLimit` dans `auth.ts`)
  - `JWT_SECRET` : suppression du fallback en dur `'super-secret-key-change-in-production'` (`jwt.ts`), l'API refuse de démarrer si absent — vérifié avec Thomas que la valeur en prod Railway est déjà un vrai secret, pas le fallback
  - Refresh token stocké en base sous forme de hash SHA-256 (`hashRefreshToken`, `auth.ts`) au lieu du token en clair — impact : sessions actives invalidées au déploiement (reconnexion nécessaire après expiration de l'access token, 15 min)
  - `@fastify/helmet` enregistré (headers de sécurité)
- Non modifiés (jugés non exploitables ou hors périmètre) : `$queryRawUnsafe` dans `anomalies.ts`/`duplicates.ts` (params bindés ou constante fixe, pas d'injection possible), blocklist extensions sur upload documents (whitelist MIME déjà en place pour images)
- Typecheck `api` OK, `auth.test.ts` 29/29 (1 test ajusté pour le hash)
- MEP en cours

### Refonte esthétique SPOK — piste "Dense technique" (chantier en cours) — 2026-08-19
- Demande Thomas : revoir l'esthétique globale de SPOK, carte blanche
- Exploré 3 directions via Claude Design (canvas) sur un écran représentatif (sidebar + bandeau + toolbar de vues + liste) : A "Éditorial neutre" (Newsreader/Manrope, indigo), B "Dense technique" (IBM Plex, cyan, coins nets), C "Chaleureux structuré" (Bricolage Grotesque, terracotta, cartes arrondies) — canvas : https://claude.ai/code/artifact/d1831e3a-8133-4f3d-a1e2-ea9beb71dba7
- Thomas choisit B, inversé (sidebar+bandeau gris clair / zone de contenu blanche) + barres d'outils de la vue (`SpaceToolbar`) également en gris clair
- **Phase 1 (tokens globaux, fait)** : `index.css` (variables HSL recalibrées gris-bleu froid, `--radius` 0.5rem→0.25rem), `tailwind.config.js` (fontFamily sans=IBM Plex Sans, mono=IBM Plex Mono), `index.html` (lien Google Fonts), `SpaceToolbar.tsx` (conteneur `bg-background`→`bg-muted/60`)
- **Phase 2 (fond gris sidebar/bandeau, fait)** : zone fragile, skill `spok-layout` relu avant modif — `Layout.tsx` : `<aside>` `bg-white`→`bg-muted` (dark mode inchangé), `<header>` `bg-card`→`bg-muted`. Décision "sidebar fond blanc" du commit `9088d3e` sciemment changée à la demande explicite de Thomas (pas une régression accidentelle) — bordures autour des lignes d'espace et auto-expand restent, eux, inchangés (invariants non touchés)
- Vérifié en réel (JS exec sur le DOM, pas de screenshot possible dans cet environnement) : `aside`/`header` en `rgb(240,242,245)`, contenu en `rgb(252,252,253)`, police IBM Plex Sans appliquée, `--radius` à 0.25rem, toolbar en `rgba(240,242,245,0.6)`
- Typecheck web OK, check-doc-headers OK
- NON COMMITÉ — dark mode et densité des composants (paddings/tailles par vue) volontairement non touchés, hors périmètre pour l'instant

### Sélecteur de vues à 3 familles (Discussion/Pilotage/Exploration) — 2026-08-19
- Chantiers 3/4 en attente (TODO) : Thomas veut qu'en FORUM, les vues hors discussion restent accessibles via un menu déroulant (idem PROJET à l'inverse) au lieu d'être masquées
- Découverte en creusant le code : `VIEW_REGISTRY` (`packages/shared/src/constants/viewRegistry.ts`) classe déjà chaque vue en 4 catégories `basic/itemTypes/planning/exploration` — TODO.md était périmé (« PROJECT aucune restriction » alors que `MODE_EXCLUDED.projet` masquait déjà une longue liste, y compris la vue Liste)
- Design validé (question posée, réponse « 3 groupes toujours visibles ») : 3 familles fixes — Discussion (thread/recent/text), Pilotage (le reste hors exploration), Exploration (catégorie `exploration` de VIEW_REGISTRY réutilisée telle quelle) — le mode choisit la famille en boutons directs, les 2 autres passent en dropdowns "Autres vues" jamais masqués
- Implémenté dans `SpaceToolbar.tsx` : `MODE_ALLOWED`/`MODE_EXCLUDED` (blocage dur) supprimés, remplacés par `getViewGroup`/`MODE_PRIMARY_GROUP` ; dropdowns réutilisent le pattern Filtre/Aperçu déjà présent (state + ref + fermeture clic extérieur/Echap)
- Vérifié en réel (navigateur intégré, communauté "Test SPOK" basculée FORUM puis PROJET puis remise Neutre) : FORUM → Discussions/Texte/Récents en direct + dropdowns Pilotage (14 vues, filtrées par accès) et Exploration ; PROJET → Pilotage en direct (regroupé par sous-sections Basique/Types/Planification) + dropdowns Discussion/Exploration ; clic sur une vue du dropdown change bien la vue active
- Bug signalé par Thomas après 1re vérif : dropdowns vides au clic — cause = panneau en `absolute` piégé par le `overflow-x-auto` de la barre de vues (règle CSS : un axe non-`visible` force l'autre à `auto`, donc le panneau qui dépasse verticalement était clippé par le scroll horizontal). Fix : passage en portal `fixed` positionné via `getBoundingClientRect()`, même pattern que `ExportDropdownButton.tsx` déjà dans le code. Revérifié en réel : contenu visible, clic fonctionnel
- Demandes complémentaires de Thomas : (1) regrouper les vues du panneau "Autres vues" par sous-catégorie comme la barre principale (2) icône manquante sur PERT
- (1) Panneau "Autres vues" : sous-groupé par section (Basique/Types/Planification) avec en-têtes, même logique `sectionMap` que la barre principale
- (2) Bug trouvé au passage : l'icône `GitMerge` de PERT (`viewRegistry.ts`) n'était ni importée ni dans `VIEW_ICON_MAP` de `SpaceToolbar.tsx` — PERT n'a jamais eu d'icône dans la barre de vues (bug préexistant, pas introduit par ce chantier). Fix : import + ajout à la map
- Vérifié en réel (JS exec sur le DOM, panel en portal non lu par get_page_text) : panneau Pilotage affiche bien BASIQUE/TYPES/PLANIFICATION en en-têtes, PERT a désormais une icône svg
- Typecheck web OK, check-doc-headers OK, en-tête du fichier mis à jour
- Reste ouvert (Étape 3/4) : affiner les CHAMPS autorisés par contexte (hors périmètre de cette session, seules les vues étaient demandées) ; Étape 5 (mode Exploration) toujours en attente de spec
- NON COMMITÉ — à MEP sur demande

### Fix clic résultat recherche n'ouvrait pas la modale item — 2026-08-11
- `SearchPage.tsx` (items + contributions) passait `openItemId` via `state` du router React (`navigate(..., { state })`) — jamais lu nulle part, la modale ne s'ouvrait pas
- `SpacePage.tsx` ne lit que le param d'URL `?item=id` pour déclencher l'ouverture — pattern déjà utilisé et fonctionnel dans `GlobalSearch.tsx`
- Même bug trouvé et corrigé sur le clic nœud graphe : `DashboardPage.tsx` (onglet Graphe) et `GraphPage.tsx`
- Vérifié en navigateur (preview local) : clic sur un résultat de recherche ouvre bien la modale du bon item dans le bon espace
- Typecheck web vert — MEP en cours

### Type UNDEFINED + indices de règles de gestion (RuleHint) — 2026-07-25
- Type "Non défini" (`UNDEFINED`) ajouté à l'enum Prisma `ItemType` : nouveau type par défaut à la création (remplace `NOTE`), propagé dans tous les schémas Zod (API, MCP) et listes de filtre/sélection web
- Fix API : `startDate` n'est plus forcé à `new Date()` à la création si absent (`items.ts`) — dates vides par défaut, comme `dueDate`/`endDate`
- Accentuation visuelle (ring) des boutons sélectionnés statut/priorité dans `ItemEditModal`, alignée sur le style déjà utilisé pour le sélecteur de type
- Nouveau registre de règles de gestion `apps/web/src/lib/businessRules.ts` + composant `RuleHint` (icône d'indice en mode dev uniquement `import.meta.env.DEV`, tooltip en portail pour échapper à l'opacité du bouton parent) sur les boutons type/statut de la modale — doc vivante consultée par Claude et affichée à l'utilisateur, à tenir à jour à chaque nouvelle règle de comportement (mémoire `feedback_business_rules_doc`)
- Sélecteur de type regroupé visuellement en 3 sections (`TYPE_GROUPS` dans `constants/ui.ts`) : Défaut (Non défini/Note), Activités (Projet/Tâche/Réunion/Période/Bug), Livrables (Lien/Config/Document/Image/Diagramme) — section "Autres" de secours si l'enum évolue sans mise à jour du groupe
- Type Réunion : bascule automatique en mode "Heures" (au lieu de jours pleins) à la création/sélection
- `isExclusiveType` entièrement retiré d'`ItemEditModal` (masquait statut/priorité/parent/assignation/commentaires/relations/tags pour Diagramme/Image/Document/Lien) — tous les champs sont désormais visibles pour tous les types, retiré section par section sur demande de Thomas après vérifications itératives
- Process : accord explicite pour exécution inline par défaut (plus de choix subagent/inline à chaque plan) et arrêt de la rédaction de fichiers spec après brainstorming (résumé en chat suffisant) — mémoires `feedback_execution_inline_default`, `feedback_no_spec_docs`
- Specs/plans de cette session : `docs/superpowers/specs/2026-07-25-business-rules-hints-design.md`, `docs/superpowers/plans/2026-07-25-business-rules-hints.md`
- Typecheck 3 paquets (web/api/mcp) vert après chaque étape ; MEP en cours

### Horizons temporels + revue de rattrapage (chantier 1) — IMPLÉMENTÉ, vérifié — 2026-07-19
- Suite des chantiers 0-3 issus de la réflexion multi-contextes sur /today (chantier 0 fait le 2026-07-18) — chantier 1 arbitré et implémenté en 9 tâches (spec `docs/superpowers/specs/2026-07-19-horizons-revue-design.md`, plan `docs/superpowers/plans/2026-07-19-horizons-revue.md`)
- Tasks 1-8 (implémentation, revues qualité + spec passées) : enum Prisma `HorizonBucket` + `Item.manualHorizon`/`Item.horizonSetAt` ; `packages/shared/src/utils/horizon.ts` (`effectiveHorizon`, `isOverdueForReview`, `HORIZON_LABELS`, `HORIZON_ORDER`) ; PATCH `items.ts` accepte `manualHorizon` ; `GET /user/review-queue` (`review-queue.ts`) ; select étendu `user-tasks.ts` ; `reviewQueueApi` + types dans `apps/web/src/lib/api.ts` ; composant générique `HorizonGroup.tsx` (section repliable, prop `getKey` ajoutée après revue qualité, absente du plan initial) ; `/tasks` (`GlobalTasksPage.tsx`) regroupé par horizon, pagination serveur supprimée ; section « À réviser » dans /today (`ReviewQueueSection.tsx` + `TodayPage.tsx`)
- Task 9 (vérification globale, aucun code touché) : `pnpm exec vitest run` → 538/538 tests verts (39 fichiers, y compris `horizon.test.ts`/`review-queue.test.ts`/`items.test.ts` étendu) ; `pnpm typecheck` → 0 erreur sur les 5 paquets (web/api/mcp/shared/database) ; `node scripts/check-doc-headers.mjs` → ✅ OK (11 fichiers vérifiés)
- Retours UI Thomas après Task 9 sur `/today` : `ReviewQueueSection` étirait la colonne "Ma liste du jour" à sa hauteur (bug CSS Grid `align-items:stretch`, page devenue "inexploitable") — sortie du grid 2 colonnes, largeur plafonnée (`max-w-xl`) et hauteur plafonnée avec scroll interne (`max-h-64`) ; grille `/today` repassée en 2 colonnes agendas (2/3) / listes (1/3), `À réviser` et `Ma liste du jour` côte à côte sur le tiers restant (retours itératifs, cf. mémoire `feedback_ui_layout_debug_approach`)
- TODO.md et ce journal mis à jour en conséquence
- MEP en cours (commit + push demandés par Thomas)

### /today — grille horaire étendue à minuit — 2026-07-18
- Demandé par Thomas : les heures d'ouverture de la grille (7h-20h) trop courtes
- `DayTimeGrid.tsx` : `DAY_END_H` 20 → 24 ; `TodayPage.tsx` : `placeEntry` (findFreeSlot) borne haute 20:00 → 23:59, commentaire d'en-tête mis à jour
- Typecheck web OK, check-doc-headers OK

### Permission prompts pendant les mep — fix + incident — 2026-07-18
- Demandé par Thomas : réduire les demandes d'autorisation techniques pendant les mep
- Diagnostic (scan des transcripts) : git/pnpm/psql déjà largement autorisés ; le vrai point de blocage était l'étape de surveillance CI, écrite en une commande composée (`Start-Sleep; $run = gh run list ...; gh run watch $run ...`) qui ne commence pas par `gh` — aucune règle ne peut la matcher, nouveau run ID à chaque mep = nouvelle demande à chaque fois
- Fix `.claude/settings.local.json` : ajout `PowerShell(gh run *)`/`PowerShell(gh workflow *)`/`PowerShell(gh api *)`/`PowerShell(docker exec spok-postgres-dev psql *)` (miroir des règles Bash déjà larges) ; nettoyage de 2 entrées corrompues (artefacts mojibake)
- Process : désormais surveillance CI en deux appels séparés (`gh run list ...` puis `gh run watch <id> ...`) au lieu d'une commande composée, pour que le préfixe `gh run` matche toujours
- Incident survenu en le corrigeant : éditer `settings.local.json` lui-même redemande une autorisation à chaque fois (probable protection volontaire, non contournable) + vérification JSON post-édition redondante (un `python -c` différent à chaque fois, jamais couvert par une règle) — a généré 5 prompts d'affilée pendant que j'annonçais avoir réglé le problème. Habitude corrigée : plus de vérification JSON systématique après une édition ciblée d'un tableau
- Escalade Thomas sur les promesses de comportement non tenues (5 mois de pratique) → mémoire `feedback_stop_complaining.md` mise à jour : ne plus formuler d'engagement sur le comportement futur, décrire seulement ce qui a été fait concrètement

### /today — colonnes par agenda (chantier 0) — IMPLÉMENTÉ — 2026-07-18
- Contexte : réflexion de fond avec Thomas sur la surcharge multi-contextes → 4 chantiers proposés (0: colonnes par agenda ; 1: horizons+revue ; 2: fenêtres de faisabilité ; 3: placement contraint). Chantier 0 validé et fait, spec `docs/superpowers/specs/2026-07-18-today-columns-per-agenda-design.md` (commit bd0bd49)
- `DayTimeGrid.tsx` : colonne Agenda unique → une lane par source (`AgendaSourceCol`, clé `feed:<id>`/`spok` via `agendaSourceKey`), chacune avec son propre layout de chevauchements ; en-têtes avec pastille couleur ; ligne « maintenant » traverse tout ; colonne Tâches inchangée
- `TodayPage.tsx` : pastilles de visibilité au-dessus de la grille (toutes sources, couleur du feed, SPOK en dernier), état `spok-today-visible-sources` en localStorage (clé absente = visible), indépendant du `enabled` des feeds ; meta des blocs feed retiré (redondant avec l'en-tête), conservé pour SPOK (nom d'espace)
- Vérifié en réel (navigateur intégré, DOM, 2 feeds factices) : colonnes Hotmail/TestA/TestB/SPOK/Tâches rendues, clic pastille → colonne retirée + localStorage écrit, persistance après rechargement OK, feeds de test supprimés et localStorage nettoyé
- Typecheck web OK, check-doc-headers OK
- Menu contextuel /today enrichi (demande Thomas « pourquoi limité ») : cause = seuls 4 callbacks câblés (les actions à contexte d'espace jamais branchées sur cette page multi-espaces). Ajouté : M'assigner (assignedToId = user courant) + Modifier le statut (sous-menu, référentiels PAR DÉFAUT — même compromis que /tasks, statuts personnalisés d'espace non chargés). Resté hors périmètre : Déplacer/Dupliquer/Fusionner/Ajouter un enfant/Convertir (modales de sélection d'espace de SpacePage à extraire — le signaler si demandé). Typecheck OK
- MEP 2026-07-18 : TNR 510/510 + typecheck 5 paquets verts, commit 093631b (colonnes + menu, TodayPage partagé). ⚠️ Incident évité : TODO.md corrompu par un remplacement Get-Content/Set-Content (mojibake UTF-8→1252) — restauré via git checkout puis ré-édité avec l'outil Edit ; ne JAMAIS modifier un fichier via Get-Content/Set-Content
- Retour Thomas post-mep (capture prod) : 8 colonnes écrasées dans 30% de largeur, liste trop large. Fix en 2 temps : (1) min-w-[110px] par colonne + overflow-x-auto sur la grille (en-têtes et corps défilent ensemble) ; (2) après 2e retour, abandon du partage en fractions → liste du jour en largeur FIXE compacte (minmax(300px,380px)), grille = tout le reste. Au passage : leçon JSX, un commentaire {/* */} ne peut pas précéder l'élément dans une branche de ternaire. Typecheck OK, vérifié en local (computed 621px/380px). MEP 2026-07-18 : TNR 510/510 + typecheck 5 paquets verts, commit dcbe5bf
- Chantiers 1-3 (horizons+revue, fenêtres de faisabilité, placement contraint) : en attente d'arbitrage de Thomas sur l'ordre — synthèse complète faite dans la conversation

### Fix /contact et /sitemap sans menus pour utilisateur connecté — 2026-07-15
- Signalé par Thomas : "/contact est moisie, il n'y a pas les menus"
- Cause : `noSidebarRoutes` de Layout.tsx traitait `/contact` (et `/sitemap`, même défaut, non signalé mais identique) comme les pages d'auth (login/register...) — masquait sidebar ET bandeau MÊME utilisateur connecté. Un utilisateur qui clique "Contact"/"Plan du site" depuis le bandeau se retrouvait bloqué sans nav pour repartir
- Fix : séparation `authFlowRoutes` (toujours sans chrome) vs `publicStandaloneRoutes` = `/sitemap`+`/contact` (sans chrome seulement si NON connecté ; chrome complet si connecté)
- Vérifié en réel (navigateur intégré, 4 scénarios) : /contact connecté → sidebar+bandeau présents (régression corrigée) ; /contact anonyme → inchangé (formulaire seul, Connexion/Inscription) ; /sitemap connecté → sidebar+bandeau présents ; /sitemap anonyme → inchangé
- Typecheck web OK, check-doc-headers OK, typecheck 5 paquets OK
- MEP 2026-07-15 : commit e8230cf (2 tentatives ratées avant : message copié par erreur d'un commit précédent — annulées via `git reset --soft` avant push, aucune perte)

### Contexte de communauté (Forum/Projet) — IMPLÉMENTÉ — 2026-07-15
- Décision Thomas : le mode d'interface devient une propriété de la COMMUNAUTÉ (forum = sujets/discussions, projet = sous-projets/pilotage), dérivé automatiquement ; hors communauté = « tous » ; Exploration à déterminer plus tard (hors périmètre)
- Spec : `docs/superpowers/specs/2026-07-15-community-context-mode-design.md`
- Fait : enum Prisma `CommunityContext` + `Community.context` (nullable, db:push OK) ; types partagés + inputs ; zod create/update + handlers API ; store `interfaceMode` devenu dérivé (plus de localStorage, défaut 'tous', seul écrivain = Layout) ; effect de dérivation dans Layout (currentCommunity.context) ; sélecteur 4 boutons du header SUPPRIMÉ ; sélecteur « Contexte » (Neutre/Forum/Projet) dans CommunitySettingsPage (OWNER)
- Écart spec assumé : pas de choix à la création (la création redirige déjà vers la page réglages où vit le sélecteur)
- Tests : +4 tests communities (context create/défaut null/invalide/patch+reset) → 42/42 ; typecheck web+api OK
- Vérifié en réel (DOM, navigateur intégré toujours sans frames) : header sans boutons de mode ni champ recherche ; bandeau complet en 'tous' hors communauté ; communauté passée en FORUM (SQL dev) → bandeau filtré (plus de Sunburst/Carte mentale/Graphe/Liens/Ma journée/Dashboard/Tâches/Activité) et sélecteur de vues d'espace réduit à Discussions/Récents/Texte (Kanban/Gantt absents) ; donnée de test remise à NULL après vérif
- Compléments (demande « y a pas des choses à ajouter ? ») : badge Forum/Projet à côté du titre dans le header (avec tooltip explicatif) + contexte affiché dans le bloc lecture seule des réglages ; nav mobile alignée sur le bandeau (`MODE_GLOBAL_EXCLUDED` déplacé dans le store interfaceMode, importé par GlobalNavBar ET Layout — fin de la divergence desktop/mobile) ; TODO étapes 3-5 recadrées (affiner FORUM/PROJECT, Exploration = loupe). Vérifié en réel : badge présent avec tooltip, grille mobile filtrée en FORUM (6 items au lieu de ~14), donnée de test remise à NULL. Typecheck web OK
- MEP 2026-07-15 : typecheck 5 paquets OK, TNR 510/510 (1re passe : crash d'un worker vitest sans échec de test, relance propre OK), commit d44ca99 (contexte communauté + retrait champ recherche header — Layout.tsx partagé entre les deux, séparation impossible au fichier). Prod : le schéma s'applique au démarrage du conteneur (start-api.sh → prisma db push)

### Revue ergonomique interface — arbitrages Thomas — 2026-07-15
- Revue générale (menus, sidebar) livrée : 6 propositions. Arbitrages reçus : point 2 inversé — c'est le CHAMP de recherche du header qui saute, le bouton Recherche du bandeau (page /search + filtres) devient l'unique entrée → FAIT (Layout.tsx, import GlobalSearch retiré, composant conservé pour SitemapPage ; champ était hidden sm:block donc mobile inchangé). Typecheck web OK, NON COMMITÉ
- Point 3 (sélecteur de vues) : en discussion — modes = filtre grossier (seul Forum restreint réellement, MODE_ALLOWED null en Projet/Exploration), épinglage par espace recommandé, question posée à Thomas (épinglage / affinage modes / les deux)
- Points 1 (dégraisser bandeau), 4 (header compact au scroll), 5 (filtre+favoris sidebar), 6 (modes compacts) : en attente d'arbitrage

### Description visible pour tous les types + allowlist permissions — 2026-07-15
- Demande Thomas : dans ItemEditModal, afficher la description quel que soit le type — même famille que le fix dates du 14/07 (`isExclusiveType` masquait le bloc description pour LINK/DIAGRAM/IMAGE/DOCUMENT)
- Fix : gate `!isExclusiveType` retiré du seul bloc Description (l.864) ; les autres blocs gates (réactions, statut, relations, tags) non touchés, hors périmètre. Sauvegarde déjà générique. Typecheck web OK
- Doc SPOK non consultable ni mise à jour (MCP login 401) — à faire quand le MCP sera réparé
- Permissions : règles préfixe `PowerShell(pnpm:*)`, `PowerShell(git:*)`, `PowerShell(npx tsc/vitest:*)`, check-doc-headers ajoutées à `.claude/settings.local.json` (les 5 règles exactes de la session supprimées) — miroir des règles Bash existantes, moins de prompts
- MEP 2026-07-15 : typecheck 5 paquets OK, TNR 506/506 (⚠️ invocation correcte = `pnpm exec vitest run` à la RACINE, pas `--filter @spok/web` qui perd la config jsdom), check-doc-headers OK — commits 13e7083 (mindmap) + c43ccdf (description) — les scénarios navigateur mindmap restent à valider par Thomas en prod

### MindMap layout incrémental — spec + plan — 2026-07-15
- Demande Thomas : tempérer la réorganisation de la MindMap après suppression/déplacement (branches qui sautent à l'autre bout de l'écran), prise en compte locale des modifications, + suggestions lisibilité espaces denses
- Diagnostic : le chemin « suppression pure » ne se déclenche presque jamais (children.length du parent survivant change → recalcul complet) ; le reparentage efface les positions de branches ENTIÈRES (clearAffectedBranches)
- Décidé : modèle incrémental — layout complet seulement au premier rendu + bouton Réorganiser ; tout changement structurel = ré-éventail LOCAL du/des parent(s) affecté(s) via reorganizeRef existant ; à la suppression les frères se resserrent (choix Thomas) ; racine de l'espace jamais ré-éventaillée ; relations = arêtes seules
- Spec : `docs/superpowers/specs/2026-07-15-mindmap-incremental-layout-design.md` ; plan : `docs/superpowers/plans/2026-07-15-mindmap-incremental-layout.md` — validés par Thomas ("go")
- IMPLÉMENTÉ (Tasks 1-4) : `mindmap-incremental.ts` (diffItems/diffRelations/initialPositionForNew, 12 tests Vitest verts) ; fabriques `buildMindmapNode`/`buildTreeEdge`/`buildRelationEdge` extraites de calculateLayout (placePortalItem non touché) ; effect structurel réécrit en 4 chemins (complet / incrémental structurel / relations seules / contenu seul) ; `clearAffectedBranches` supprimé de onNodeDragStop. Typecheck web OK
- Ajustement vs plan : `findAnyTreeNode` (fullTree + arbres de portail) pour les badges hasChildren/childCount des items de portail
- Vérification navigateur intégré IMPOSSIBLE : le pane ne produit aucune frame (rAF jamais déclenché) → screenshots timeout, fitView inerte, arêtes non rendues (préexistant, vérifié identique sur baseline via git stash). Les 9 scénarios du plan (Task 5) sont à faire par Thomas dans son navigateur
- NON COMMITÉ
- Suggestions lisibilité notées hors périmètre dans la spec (repli auto gros espaces, zoom sémantique, focus généralisé, agrégation feuilles)
- ⚠️ MCP SPOK : login 401 (doc MindMapView non consultable) — signalé à Thomas

### Fix dates masquées ItemEditModal pour types media — 2026-07-14
- Signalé par Thomas : dans la modale item, types Lien/Doc/Image/Diagramme, les dates (Début/Fin/Échéance) devaient être réaffichées, vides par défaut
- Cause : `isExclusiveType` (LINK/DIAGRAM/IMAGE/DOCUMENT) masquait le bloc dates en plus du reste — contraire à l'intention du refactor ItemEditModal (base uniforme, tous champs visibles), resté non traité pour ce bloc précis
- Fix : condition du bloc dates réduite à `!isForumMode` seul, `isExclusiveType` retiré de cette seule condition (les autres blocs qui l'utilisent restent inchangés, hors périmètre de la demande)
- Vérifié : aucune logique de valeur par défaut par type ne s'applique à ces 4 types (les handlers de duration auto ne matchent que MEETING/TASK/PROJECT/PERIOD) — donc "vides par défaut" est déjà le comportement naturel, pas de code supplémentaire nécessaire
- Vérifié en réel (navigateur intégré, item type Lien "Maquettes Figma") : Début/Fin/Échéance affichés avec "Choisir une date" (vide), aucune erreur console
- Typecheck web scopé OK, check-doc-headers OK
- Commité (à mep)

### Skill spok-layout + vue admin Accès utilisateur — 2026-07-14
- Suite de "Organigramme à revoir" (backlog) : Thomas a précisé qu'il existe plusieurs interfaces montrant les accès utilisateurs. Investigation : `OrgChartView` (membres/rôles d'un espace) fait doublon avec `SpaceMembersManager` sur `SpaceSettingsPage` — même query, même donnée, juste une visualisation en plus sans valeur ajoutée
- Besoin réel exprimé : une vue (admin) montrant pour UN utilisateur ce à quoi il a droit d'accès (adhésion directe + accès implicite via visibilité OPEN/READONLY héritée) ET ce à quoi il pourrait avoir accès (aucun accès actuel, un admin pourrait lui en accorder un)
- Backend : `GET /admin/users/:id/access-tree` (`admin/users.ts`) — même sémantique que `checkSpaceAccess`/`getEffectiveVisibility` (items.ts) mais chargée en masse (pas de N+1), calcul en mémoire sur tout l'arbre communautés→espaces GROUP. Types partagés `AccessTreeNode`/`AccessRole`/`AccessSource` (`@spok/shared`). 5 nouveaux tests (direct, implicite via communauté, PRIVATE sans accès, bypass ADMIN global, 404) — 29/29 users.test.ts
- Frontend : moteur de layout+SVG extrait de `OrgChartView.tsx` en composant partagé `components/ui/BoxTreeDiagram.tsx` (accepte une forêt de racines, pas juste un arbre) — `OrgChartView` réécrit pour le consommer (comportement visuel identique, code réduit). Nouvelle page `pages/admin/UserAccessPage.tsx` (route `/admin/users/:userId/access`), lien "Voir l'accès" dans `UsersPage.tsx`
- Vérifié en réel (navigateur intégré, admin mode via `spok-admin-mode` localStorage) : Alice Martin (membre direct des 4 espaces) → tout en vert MEMBER ; Charlie Durand (membre de 2 des 4 espaces seulement) → 2 espaces verts + 2 gris "aucun accès", exactement conforme aux memberships réels vérifiés via l'API admin
- Effet de bord découvert et corrigé : skill `spok-layout` (écrite plus tôt dans la session) affirmait à tort que `AdminLayout.tsx` était utilisé pour `/admin/*` — vérifié via `App.tsx` que ce fichier est mort (commentaire "AdminLayout removed"), skill corrigée
- Typecheck web+api scopés OK, check-doc-headers OK
- NON COMMITÉ

### Export PDF Vue Texte — aligné sur les données affichées — 2026-07-14
- Demande : « il faudrait modifier l'export pdf pour que ce soit à l'image des données affichées dans la vue »
- Cause : le bouton PDF de TextView passait par `exportDataPDF` générique (tableau Titre/Type/Statut/..., items bruts, sans tri ni filtre) — ne correspondait ni au contenu (document hiérarchique) ni à l'ordre/filtre affichés
- Fix : nouvelle fonction `exportTextDocumentPDF` (exportUtils.ts) — PDF multi-pages en flux de texte reproduisant l'arbre affiché (indentation, titre, statut, description, contributions), alimentée par les mêmes `filteredItems`/`portalItemGroupsFiltered` que le rendu écran (recherche en cours + groupes portails inclus). `SpaceExportButton` reçoit un override `pdfExport` pour cette vue uniquement (CSV/Excel/JSON inchangés)
- Vérifié en réel (navigateur intégré, espace 30 items, avec et sans filtre de recherche) : export déclenché sans erreur console dans les deux cas ; typecheck web OK
- Commité (71071f0)

### Fix layout MindMap — reparentage décale des branches entières — 2026-07-13
- Signalé par Thomas (2 captures prod) : déplacer un item (vers la racine, ou dans un autre nœud) désynchronise le parent (recalculé par le layout radial car son nombre de descendants change) de ses enfants restants (positions sauvegardées figées) → traits qui traversent tout le canevas
- 1er correctif (ancien parent direct uniquement) insuffisant : `calculateLayout` calcule le rayon/angle de CHAQUE ancêtre en fonction de son propre nombre total de descendants — un reparentage peut donc décaler toute une branche jusqu'à sa racine, pas juste le parent direct. La 2e capture montrait deux nœuds intermédiaires distincts recalculés, chacun avec ses enfants éparpillés — cohérent avec cette explication plus large
- Fix élargi (MindMapView.tsx, onNodeDragStop) : remonte à la racine de la branche affectée des DEUX côtés du déplacement (ancien ET nouveau parent) et efface les positions sauvegardées de toute la branche, hors le sous-arbre du nœud déplacé
- Vérification par navigateur bloquée (timeout outil `computer`) et données dev insuffisantes pour reproduire — vérification reportée en prod après mep (fix purement client, aucune donnée/migration touchée)
- Typecheck web scopé OK, check-doc-headers OK
- Commité (e85c56d) — RESTE (Thomas) : vérifier en prod sur le cas réel signalé

### Fix crash MindMap — elementsFromPoint sur coordonnée non finie — 2026-07-13
- Remonté par Sentry (prod, spok-web, Chrome OS) : TypeError "Failed to execute 'elementsFromPoint' ... non-finite" sur /spaces/:id?view=mindmap
- Cause tracée précisément : poignée de drag native HTML5 (GripVertical, mindmap-nodes.tsx) — le garde-fou existant ne détectait que clientX/Y=0 (annulation standard HTML5) mais pas NaN, produit par un drag tactile annulé sur Chrome OS → elementsFromPoint(NaN, NaN) lève une exception
- Fix : garde Number.isFinite en plus du test =0, à la fois dans mindmap-nodes.tsx (onDrag/onDragEnd) et dans MindMapView.tsx (getSidebarSpaceAtPoint, protégée à la frontière de l'API navigateur pour couvrir tous les appelants)
- Pas de test dédié écrit (composants de vue non couverts par des tests unitaires dans ce repo, cohérent avec la convention existante) — typecheck web scopé OK, check-doc-headers OK
- Commité (6935063)

### Fix accès menu Carte mentale/Graphe global/Liens — 2026-07-12
- Signalé par Thomas : "Carte mentale globale" invisible, quel que soit le mode d'interface
- Cause tracée : commit f5d6d69 (20 mai, refactor menu MenuItem→MENU_REGISTRY) avait basculé global-mindmap/global-graph/global-links de access:'user' à access:'admin' — invisibles pour tout compte non-admin depuis, effet de bord passé inaperçu 2 mois
- Remis à access:'user' (cohérent avec global-sunburst resté 'public') — confirmé par Thomas
- pnpm build:packages + redémarrage dev (HMR ne recharge pas shared compilé)
- Commité (bf8d8b1)

### Cascade communityId aux espaces enfants (déplacement vers une autre communauté) — 2026-07-12
- Besoin : « lors du déplacement d'un espace dans une autre communauté, il faudrait que cela embarque les espaces enfants »
- Bug confirmé : PATCH /spaces/:id ne mettait à jour QUE le communityId de l'espace déplacé — les descendants restaient rattachés à l'ancienne communauté, arbre incohérent
- Fix : si communityId change réellement (comparé à l'existant), collecte récursive des descendants (même pattern que le DELETE, dupliqué localement — convention déjà en place 6x dans ce fichier, pas d'extraction) puis space.updateMany sur tous les descendants avec le nouveau communityId — séquentiel (pas de $transaction : le mock helpers.ts ne déroule pas les promesses d'un tableau, cohérent avec l'unique autre usage de $transaction du fichier qui ignore déjà la valeur de retour)
- 2 nouveaux tests (cascade sur 2 niveaux, pas de cascade si communityId inchangé) — 50/50 spaces.test.ts, typecheck api scopé OK
- Commité (adff75f)

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
