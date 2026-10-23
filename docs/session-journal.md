# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## PRÊT POUR MEP

> Une seule session (« MEP ») commite et pousse (décision Thomas 2026-10-23). Les autres sessions inscrivent ici
> chaque lot terminé : nom, fichiers exacts (lignes concernées pour un fichier partagé), tests faits, non vérifié.
> La session MEP retire le lot une fois poussé.

_(aucun lot en attente)_

## EN COURS

### Organisation des sessions et des consignes — 2026-10-23
- Décisions Thomas : une seule session « MEP » commite et pousse, les autres inscrivent leurs lots dans « PRÊT POUR MEP » ; micro-correction (< ~20 lignes, sans nouveau comportement) sans plan à valider, avec question sur la mise à jour de la doc du composant ; plus de hash dans le TODO (date seule). Appliqué : CLAUDE.md projet et global, skills spok-dev et spok-deploy, cette section. MEP 2026-10-23 (docs seules, sans CI)

### Process : la place des items suit leur changement d'espace — 2026-10-23
- Suite de l'incident « PJ Rodrigue ». utils/processPlacement.ts (moveProcessPlacement) appelé dans la transaction de bulk-move (item-move.ts) et de la conversion en espace (item-convert.ts) : couloirs et positions suivent, item séparé de son couloir → libre, place existante à l'arrivée remplacée. processPlacement.test.ts 5 tests (mock, sans base) + items.test 68/68, typecheck API OK, aide 411/411. businessRules process-placement-follows-move, conseil dans process.help.ts, spec « Vue Process » to_validate. Puis, accord Thomas : fiche d'aide créée pour MoveToSpaceModal (move-to-space.help.ts, registre pageHelp, « ? », tour move-targets / move-children / move-confirm, rappels HelpHint sur « Inclure les éléments enfants » et « Déplacer », écrits d'après bulk-move — pas d'annulation automatique) ; la modale invalide aussi process-nodes / process-lanes des deux espaces. Aide 414/414, typecheck web OK. Déplacement réel non testé (Docker local arrêté). MEP b910d11 (index vérifié à part : typecheck web + API), CI verte

### Prod — process de « D&D5 Manu - Rodrigue » rattaché à « PJ Rodrigue » — 2026-10-23
- Constat Thomas : process créé la veille introuvable. Lecture prod (accord Thomas) : données intactes ; déplacement groupé de 33 éléments (2026-10-22 00:35) vers PJ Rodrigue, mais process_nodes / process_lanes restés sur l'ancien spaceId → vue vide d'un côté, sans mise en page de l'autre. BUG : le déplacement d'éléments n'emmène pas leur place dans le process (à corriger).
- Rattachement (accord explicite, script lancé par Thomas, écriture refusée à Claude) : sauvegarde _old/process-restore-prod-2026-10-23.json (non versionné) ; transaction : process recréé dans PJ supprimé (3 positions, 6 couloirs), 8 positions + 4 couloirs déplacés vers PJ ; recompte PJ 8/4, ancien 0/0. Script supprimé

### sanitizeHtml : classes limitées (revue sécurité) — 2026-10-23
- MEP lot fiche : CI verte sur 60d488e (après correctif du bloc Article embarqué par erreur dans d0b6036). Revue sécurité auto : `class` libre → un contenu pouvait prendre fixed/inset-0/z-50 et recouvrir l'interface. Demande Thomas : restreindre. ALLOWED_CLASSES = classes de RichTextEditor + import du forum (+ spoiler) ; styles déjà filtrés par propriété (aucune position). businessRules user-html-sanitized complétée. Tests sanitize/clipboard/lecture/aide 429/429. Inventaire des classes en prod NON fait (lecture prod refusée par le contrôle de permissions) : une classe absente de la liste ferait perdre une mise en forme, rien de plus. NON COMMITÉ

### MEP lot fiche d'élément seul — 2026-10-23
- Demande Thomas : MEP du lot fiche (mode lecture, Copier la fiche PNG, bouton visiteur retiré, HelpHint) sans Articles ni sanitizeHtml des vues/API. 20 fichiers isolés ; HEAD + lot seul vérifié dans une copie (typecheck web OK, TNR web 802/802). Restent NON COMMITÉS : Articles (schéma Prisma, API, MCP, shared), sanitizeHtml des vues / séance live / e-mails / items.ts, launch.json, dev-autostart.ps1

### Infobulles d'aide hors de la fenêtre — 2026-10-23
- Constat Thomas (infobulle « Copier la fiche » coupée en haut). HelpHint ne passait dessous que si l'élément était à < 60 px du haut, sans tenir compte de la hauteur du texte. Correctif : placeHint (pur) sur la taille mesurée (useLayoutEffect, invisible avant placement) — au-dessus si ça tient, sinon dessous, sinon côté le plus large, toujours ramenée dans la fenêtre. HelpHint.test.ts 4 tests, aide 397/397, typecheck web OK. Non vérifié à l'écran. NON COMMITÉ

### Copier la fiche : image intégrée en PNG (collage Word) — 2026-10-23
- Retour Thomas : l'image ne se collait pas dans Word. Causes : adresse relative en dev (/api/local-uploads/…) + fichiers stockés en WebP. itemClipboard.ts : withAbsoluteMediaUrl, imageToPngDataUrl (fetch → canvas → PNG, 1280 px max), itemSheetToClipboardHtml (repli <img> sur l'adresse complète), HTML passé en promesse à ClipboardItem. Tests itemClipboard + aide 408/408, typecheck web OK. Spec « Copier la fiche » to_validate. Aide inchangée (déjà juste). Non vérifié : collage réel Word/mail, CORS du stockage R2 en prod (sinon repli). NON COMMITÉ

### Bouton admin « Voir comme visiteur » retiré de la fiche — 2026-10-23
- Décision Thomas : doublon d'« Afficher » (un visiteur ouvre la fiche en lecture, le bouton montrait un formulaire grisé que personne ne voit plus). ItemEditModal : état visitorPreview, bouton et useAdminMode retirés, en-tête complété. Aucune aide ni spec ne le citait (spec « Modale d'édition d'item » inchangée). Typecheck web OK, aide 393/393. Non vérifié à l'écran. NON COMMITÉ (même fichier que le mode lecture et Copier la fiche)

### Copier la fiche : image, schéma et document inclus — 2026-10-23
- Demande Thomas : la fiche copiée ne contenait que l'adresse du média. itemClipboard.ts : `link` → `media` ; IMAGE/DIAGRAM intégrés en `<img>` (URL publique R2, 640 px) et `![titre](url)` en Markdown ; DOCUMENT = lien « 📎 nom du fichier » (préfixe horodaté retiré, fileNameFromUrl) ; LINK inchangé. Aide : hints.copySheet / copySheetDone (HelpHint sur le bouton, remplace le title), étape Actions du tour complétée. Tests itemClipboard + aide 404/404, typecheck web OK. Spec SPOK « Copier la fiche » réécrite, to_validate. Collage réel (Word/mail) non vérifié — à faire par Thomas. NON COMMITÉ

### Faille XSS : contenu utilisateur nettoyé à l'affichage, URL d'item http(s) — 2026-10-23
- L'API ne filtrait ni le HTML (description, contributions) ni le schéma des URL (javascript: accepté). sanitizeHtml branché sur les 7 dangerouslySetInnerHTML (TextView ×2, ThreadView ×2, contributions ItemEditModal, LiveWindow, aperçu e-mail CommunitySettingsPage) ; htmlToText remplace innerHTML (itemExport stripHtml, DeleteConfirmModal) ; impression : titre/statut/libellés/couleur échappés, HTML nettoyé, image si URL sûre ; copie de fiche nettoyée ; safeHref sur les liens item.url (10 fichiers + modale). API items.ts : itemUrlField (http(s) seulement, 400 sinon). businessRules user-html-sanitized. Tests web 421/421, API items 63/63, typecheck web + api OK. Spec « Sécurité & Accès » complétée, to_validate. Non fait : nettoyage HTML côté API. Commit 6bf07fd (non poussé)
- Prod lue (lecture seule, accord Thomas, scripts jetables supprimés) : aucun contenu malveillant (11 620 items, 51 986 contributions, 3 e-mails) ; 1 URL file:/// (lien local Shadowrun) ; 2 contributions 2011 avec le texte « javascript:void(0); ». L'import du forum contient 2 189 iframes YouTube et ~4 800 onerror="this.style.display='none'" → liste blanche ajustée (iframe youtube(-nocookie)/embed, ce onerror exact, details/summary/time, styles par propriété). Passage du nettoyeur sur les 46 195 contenus HTML prod : texte visible inchangé ; retirés seulement 6 img à src vide, 7 iframes à identifiant corrompu (👍), 215 liens à href sans schéma (identifiants YouTube nus, déjà cassés)

### Menu Afficher / Ouvrir + mode lecture de la modale item — 2026-10-23
- Menu ⋮ : « Afficher » (onOpen(id,'read')) + « Ouvrir » (fiche, 'edit') pour tous, « Modifier » retiré. lib/itemOpenMode.ts (?mode=lecture, défaut lecture si !canEdit). ItemReadView.tsx (fiche = ItemSheet de Copier la fiche, média en grand). ItemEditModal : initialMode, sélecteur Afficher | Modifier/Fiche, Afficher bloqué si modifs non enregistrées. SpacePage : ?item traité à chaque apparition (avant : une seule fois → « Ouvrir » sur un item du même espace ne rouvrait rien) + ?mode. TodayPage branchée. lib/sanitizeHtml.ts (l'API ne filtre pas le HTML — faille XSS existante ailleurs : TextView, ThreadView, contributions de la modale, LiveWindow, NON traitée). Aide : hints, étape item-mode-switch, zones read-media/read-content, ITEM_MENU_STEP. businessRules item-open-mode-default. Tests 417/417, typecheck web OK. Specs SPOK : nouvel item cmvkoqozm0006es9latkqqfx7 + menu contextuel + Afficher/Ouvrir, to_validate. Vérif à l'écran à faire par Thomas. NON COMMITÉ

### Fin de l'incident Railway — prod déployée sur f474990 — 2026-10-23
- Demande Thomas (« redéploie »). Les 2 services étaient restés sur le build du 2026-10-21 01:45 (16f5841). `railway redeploy` ne relance que le dernier déploiement (ancien commit) → déploiement du commit f474990 via l'API Railway (serviceInstanceDeployV2) sur spok-api et spok-web : SUCCESS tous deux. Vérifié sur spok.space : le bundle contient les textes du 2026-10-22 (modale de fusion). Toutes les MEP des 21 et 22/10 sont en prod

### Type « Article » — mise en œuvre — 2026-10-23
- Plan exécuté (7 tâches, registre .superpowers/sdd/2026-10-23-type-article/progress.md). Type ARTICLE partout + référentiels personnalisés complétés ; table article_blocks ; routes item-article.ts (lecture + composition) ; page /spaces/:id/articles/:id, ArticleBlock, ArticleEditor, ArticleItemPicker, printArticle, useArticle ; aide article.help.ts ; businessRules (3 règles) ; spec SPOK « Article [ArticlePage] » (cmvl3yeg…) + « Types d'items » to_validate ; ARCHITECTURE et MODELE-DONNEES à jour. Tests : api referentiels 2/2, articleVisibility 5/5, item-article 13/13 ; web article + aide 418/418 ; tsc api/web OK. Écran : lecture desktop / 375 px / impression, Composer (ajout, gauche, note saisie, glisser, avertissement), bob sans Composer. Auto-relecture finale (pas de sous-agent). Commit 1fb22a4 (MEP 2026-10-23 : typecheck 5 paquets OK, TNR 1649/1649). CI rouge au 1er passage (timeout 5 s de communities.test, sans rapport, vert en local) → relancée verte ; Railway avait sauté le déploiement → be3e58f déployé via l'API Railway sur api et web, SUCCESS, vérifié sur spok.space

### Type « Article » — brainstorming et plan — 2026-10-23
- Brainstorming (maquettes A/B/C, choix Thomas : flux de blocs A d'abord). Validé : blocs = références vers des éléments existants (réutilisables dans plusieurs articles), « Ajouter un texte » = nouvelle note, texte des notes modifiable sur place, lecteur voit le contenu sans accès à la source, droit évalué à la lecture sur l'auteur de la référence, avertissement si moins visible. Plan : docs/superpowers/plans/2026-10-23-type-article.md (7 tâches), en attente de relecture par Thomas
- Constat : item-modal.help.ts et itemMenuGroups.anonymous.test.ts modifiés hors de cette session (entrées « Afficher » / « Ouvrir » du menu) — non touchés

### Nettoyage relations / TODO — 2026-10-22
- Tour fiche d'élément, étape Relations : types actuels (bloque, permet, entraîne, lié à). seed.ts : dernière relation `depends` → `blocks` inversée (comme la migration prod). TODO : accusé de lecture (a2eb5d9), doublon « Sélecteur de vue » (annulé 15/10) et types de relation (069d869) cochés. Aide 393/393, typecheck database sans erreur. Seed non relancé. Commit be27c21

### Modale de fusion : cibles autorisées seulement + fiche d'aide — 2026-10-22
- API (item-merge.ts) refusait : cible non gérable par un MEMBER (403), copie verrouillée (403), cible d'un autre espace (404, sous-espaces inclus dans la vue). lib/mergeTargets.ts (pur, test 3/3) + canManageItem = canEditItem de SpacePage. Modale sans aide → fiche components/help/merge-item.help.ts (registre 'merge-item', « ? », tour merge-source / merge-targets, rappels pickTarget / noTarget / transfer / sourceDeleted / confirm écrits d'après la route), textes en dur remplacés. businessRules merge-targets-allowed-only. Aide 396/396, typecheck web OK. Vérifié en bob (MEMBER, compte seed) : 3 cibles = ses éléments sur 64, explication et « ? » affichés, étape de comparaison OK (annulée, aucune fusion). Spec SPOK : item existant « Fusion d'items [MergeItemModal] » (espace Items, c4f07580…) retrouvé et réécrit (il inversait source et cible, sans les droits), to_validate. Commit d584882

### Séance live : plus de requête pour un anonyme — 2026-10-22
- useLiveSession (appelé par SpacePage sur chaque espace) : `enabled` exige un utilisateur connecté → plus de GET /live-sessions/by-space en 401 pour un anonyme. businessRules anonymous-read-only complétée. Test useLiveSession.anonymous.test.tsx 2/2 ; LiveSessionHost.test aligné (utilisateur connecté, l'hôte n'est monté que connecté) ; tests séances + aide 431/431, typecheck web OK ; vérifié en anonyme (aucune requête live-sessions, tout en 200). Base locale remise en l'état. Commit a2e1a5f (MEP 2026-10-22 : typecheck 5 paquets OK, TNR 1569/1569)

### Prod — clés AppConfig orphelines supprimées — 2026-10-22
- Accord explicite de Thomas. Script jetable via prodPrisma() (lecture + sauvegarde, puis suppression par clé exacte) : 2 lignes présentes (views 2722 car., view_categories 204 car., inchangées depuis le 2026-03-17), global_pages / global_page_groups absentes. Supprimées 2, recompte 0 ; app_config prod vide ensuite. Sauvegarde : _old/appconfig-orphans-prod-2026-10-22.json (non versionné). Script supprimé

### Fiche d'élément réduite / complète dans tous les modes — 2026-10-22
- Demande Thomas : bouton « Plus de champs » visible hors Forum pour masquer les champs en Projet etc. ; défaut réduit en Forum ET JDR (précision Thomas), complet en Projet / Tous, non mémorisé. ItemEditModal : forumExpanded → expanded (défaut par mode, reset à chaque fiche et changement de mode), bouton et résumé dans tous les modes, commentaires alignés. businessRules (forum-modal-reduced-with-summary réécrite, id conservé), aide item-modal (conseil + étape). Tests aide + item-edit-helpers 399/399, typecheck web OK, vérifié à l'écran (Forum/JDR réduite, Projet/Tous complète, repli en Projet OK). Spec « Modale d'édition d'item » to_validate. Commit f42b831

### Contrôle « anonyme en lecture seule » — 2026-10-22
- Règle Thomas : un anonyme ne modifie rien (spec « Sécurité & Accès » to_validate). API : 160 routes d'écriture appelées sans jeton (script jetable, base locale) → 149 × 401, 10 publiques par conception (auth, contact, mcp), /auth/logout 400 (révocation du jeton fourni) — conforme. Interface (communauté de test passée OPEN puis remise PRIVATE) : fiche sans champ modifiable, Kanban réservé, Gantt et carte mentale verrouillés (canEdit), Séances sans création. Écarts : « Marquer comme non lu » proposé (itemMenuGroups.ts:95), réactions et bouton Contribution affichés (ItemEditModal ReactionBar, 401 silencieux), markViewed appelé à l'ouverture de la fiche (ItemEditModal:261, 401 → expulsion vers /login tant que le correctif hasSession n'est pas en prod)
- Corrigé (accord Thomas) : ReactionBar readOnly (compteurs seuls, rien si aucune réaction) passé par ItemEditModal (item + contributions) quand !user ; markViewed seulement si user ; « Marquer comme non lu » absent du menu si non connecté (itemMenuGroups, useAuthStore.getState). Aide item-modal (conseil + étape Réactions), businessRules anonymous-read-only, test itemMenuGroups.anonymous.test.ts 2/2, typecheck web OK, aide 391/391. Vérifié en anonyme (menu sans « non lu », fiche sans bouton de réaction, compteur ✅ 1 non cliquable, aucun POST /view) et connecté (réactions cliquables, /view 204). Base locale remise en l'état. Spec « Sécurité & Accès » to_validate. Commit e88d7f8

### Page ouverte par son URL renvoyée vers l'accueil — 2026-10-21
- Cause (reproduite, trace réseau) : GlobalNavBar appelait GET /activity pour un visiteur anonyme → 401 → fetchApi le traitait en expiration (clearAuth + auth:logout) → /login ; en dev l'auto-login renvoyait ensuite vers /. En prod : anonyme renvoyé vers /login depuis /communities, /search…
- Correctif : GlobalNavBar `enabled: !!user` ; fetchApi : refresh/expiration seulement si une session existe (hasSession), sinon simple ApiError. businessRules (session-expired-only-with-session), test api.session.test.ts 2/2, typecheck web OK, aide 387/387, vérifié dans le navigateur (anonyme reste sur /communities et /search, 0 appel /activity ; connecté : /activity 200). Spec SPOK « Sécurité & Accès » to_validate. Commit 87cb0b0 (MEP 2026-10-22 : typecheck 5 paquets OK, TNR 1558/1558)

### Incident Railway — MEP du 21/10 non déployées — 2026-10-21
- Railway « Major Outage » depuis 07:24 UTC (builds suspendus, API/CLI indisponibles). Prod (web, API probablement aussi) restée sur 16f5841 (01:45). Poussés mais NON déployés : 825ef12, 49814cb, 0361c1d, 6998566, d57e8b7, cbd6362 (+ commits docs). À la levée : vérifier que spok-web et spok-api sont sur ac0c735, sinon « Redeploy » du dernier commit

### Dates au changement de statut hors modale — 2026-10-21
- Signalé par Thomas : passage à Terminé via le menu ⋯ sans date de fin. Diagnostic : PATCH simple déjà OK (web + API) ; trous = propagation aux enfants (updateMany sans dates) et règle « début vide → aujourd'hui » absente de l'API (Today, MCP). Correctif : apps/api/src/utils/statusDates.ts (source unique) branché sur PATCH item et propagation (dates vides seulement). Tests items.test.ts 61/61 (3 rouges → verts), typecheck api OK, vérifié sur l'API locale (parent + enfant propagé datés). businessRules.ts (2 règles → API), commentaire useSpaceActions, spec Modale d'édition to_validate. MEP cbd6362 (typecheck paquets OK, TNR 1554/1554)

### Restauration prod — espace « Project management / Gestion de projets » (cmth8p959019cvcsbxvl8ff04) — 2026-10-21
- Demande explicite de Thomas : 144 items supprimés par erreur à 13:34 UTC (une suppression en cascade). 37 restaurés à la main par Thomas ; 107 recréés par script depuis le journal d'audit (champs complets, id d'origine, audit CREATE) ; 36 items restaurés à la main étaient revenus à la racine → recalés sous leur parent d'origine (audit MOVE). Contrôle : 144/144 présents, 0 écart parent/type. Non récupérable (pas dans l'audit) : liens, tags, assignations, commentaires de ces items. Scripts tmp_ supprimés après usage

### /admin/views rebranchée sur menu_overrides — 2026-10-21
- Décision Thomas : rebrancher. Constats : /admin/views éditait un système mort (useViewConfig, lu seulement par ViewModeSelector non rendu) ; le vrai système (MENU_REGISTRY + AppConfig menu_overrides, lu par useMenuItems) n'avait plus d'écran ni même de route d'écriture (en-tête de menu.ts faux).
- API : adminMenuRoutes (GET /admin/menu, PUT /admin/menu/overrides — différences seules, clé inconnue / section admin → 400, admin seul), 6 tests ; routes/admin/config.ts supprimé (+ /config et /admin/config retirés d'index.ts). Shared : viewDefaults.ts et types/viewConfig.ts supprimés ; MENU_REGISTRY : entrées Administration › Vues et Performances (ajoutées : pages accessibles seulement par l'URL). Web : ViewModeSelector, useViewConfig, useGlobalPages, configApi/adminConfigApi supprimés ; ViewsConfigPage réécrite (onglets Pages globales / Vues d'espace, œil, accès Tous/Connectés/Admins, « modifié », retour au code, Tout réinitialiser, Enregistrer/Ctrl+S) ; fiche admin-views.help.ts (« ? », tour, rappels) ; exemption du contrôle « ? admin » retirée ; ApiDocPage à jour. Typecheck web/api OK, aide 387/387, menu.test 6/6, vérifié à l'écran (aller-retour Assignations → Connectés → réinitialisé, menu Administration). Skill spok-menu à jour (redémarrer Claude). Specs : Configuration des vues réécrite (to_validate), Configuration des menus annulée. Clés AppConfig orphelines en base (views, view_categories, global_pages, global_page_groups) laissées en place (prod : suppression sur demande seulement). MEP d57e8b7 (typecheck 6 paquets OK, TNR 1550/1550)

### Skill spok-dev + rappels fonctionnels — 2026-10-21
- Constat Thomas (Admin > Communautés, « Approuver » : « je ne sais plus ce que je valide ») : les 12 pages d'administration n'ont aucune aide. Demande : la doc auto-portée (spec / dev / utilisateur) doit être prise en compte par la skill de doc, appelée par la skill de dev — qui n'existait pas.
- Créé .claude/skills/spok-dev (porte d'entrée de toute modification de code : spok-doc avant/après, plan validé, tests ciblés, liste de contrôle « terminé » des 3 couches). spok-doc : rappels fonctionnels (action à effet = infobulle « ce qui va se passer », bloc de décision = explication), composant touché sans aide → fiche créée, liste « terminé ». spok-start/spok-deploy/CLAUDE.md renvoient à spok-dev. Items SPOK : spok-dev créé (cmvhv3n2v000i7071xqvll70i), spok-doc mis à jour. Mémoire mise à jour. MEP edb78d2 — redémarrer Claude pour charger la skill
- Suite proposée : lot 1 = aide des 12 pages d'administration ; lot 2 = pages restantes (invitation…) ; lot 3 = coverage.test exige une fiche par route
- Lot 1 fait (via spok-dev) : 11 fiches pages/help/admin-*.help.ts (registre PAGE_HELP), « ? » + tour (≥ 2 repères) sur 11 pages admin, rappels fonctionnels vérifiés dans le code API via help/pageHint.ts (hints) : Communautés (bloc d'approbation expliqué + visibilité demandée affichée sur chaque ligne ; Approuver/Rejeter/Supprimer), Utilisateurs (accès Claude, désactiver, réactiver, supprimer, accès), Espaces, Audit (restaurer, batch, champs, purges irréversibles), Doublons, Diagnostics, Performances. coverage.test : pageHint → hints, « ? » sur toute page admin (exemption ViewsConfigPage). En-tête routes/admin/tests.ts corrigé (lecture seule SQL, pas vitest). Typecheck web OK, aide 378/378, vérifié à l'écran (10 pages, infobulles, tour Utilisateurs). Spec Gestion des communautés to_validate. Découvertes : /admin/views sans effet (lu seulement par ViewModeSelector, non rendu) ; spec « Configuration des menus » décrit /admin/menu non routée. MEP 6998566 (typecheck 6 paquets OK, TNR 1535/1535)

### Retour des paramètres depuis l'administration — 2026-10-21
- Signalé par Thomas : depuis Admin > Communautés, « Retour » des paramètres de communauté menait à l'accueil (navigate('/') en dur, conforme à la spec d'alors). hooks/useGoBack.ts (historique de l'appli si idx > 0, sinon repli) branché sur CommunitySettingsPage (repli : page de la communauté) et SpaceSettingsPage (repli : l'espace ; avant : toujours l'espace, donc pas de retour à Admin > Espaces). UserAccessPage déjà correct ; Diagnostics/Doublons ouvrent des espaces sans bouton retour. Vérifié à l'écran : Admin Communautés → paramètres → Retour = liste ; Admin Espaces → idem ; ouverture directe → repli. Typecheck web OK. Specs SPOK Paramètres communauté / espace to_validate. MEP 0361c1d

### Modes d'affichage — sélecteur de vues — 2026-10-21
- Organisation des menus présentée à Thomas (2 classements : catégories du registre / familles de SpaceToolbar). Demandes : mode Projet sans Types/Images/Liens/Documents en boutons directs, avec Carte mentale ; « Autres vues » = un menu par catégorie (Basique, Types, Planification, Exploration) au lieu des familles.
- SpaceToolbar : MODE_PRIMARY_ADJUST (projet), splitViewsForMode = répartition unique (ligne de boutons + panneau, avant calculées séparément), menus OTHER_MENU_KEYS par catégorie. Tests SpaceToolbar.curatedViews 9/9, typecheck web OK, vérifié à l'écran (Forum, Projet). Spec SPOK « Mode d'interface » to_validate. MEP 49814cb
- Forum : + Images et Calendrier en boutons directs (MODE_PRIMARY_ADJUST.forum). Tests 9/9, typecheck OK, vérifié à l'écran. Spec mise à jour. MEP 49814cb
- Projet : Liste retirée des boutons directs (reste dans « Basique »). « Forum : ajoute Récents » : déjà en direct (famille Discussion), rien à faire. Tests 9/9, vérifié à l'écran, spec à jour. MEP 49814cb
- JDR : Liste et Liens retirés (Discussions, Carte mentale, Images, Documents, Récents). businessRules.ts (règle du mode) mis à jour. Tests 9/9, typecheck OK, vérifié à l'écran ; changer de mode ne change pas la vue affichée (vérifié). Spec à jour. MEP 49814cb

### Modale de relation de la fiche d'élément — 2026-10-21
- ItemEditModal : modale inline « Modifier la relation » remplacée par RelationEditDialog (portail z-[200] au-dessus de la fiche ; état réduit à editingRelationMeta {source, target, type, label}). API items.ts : status ajouté aux select toItem/fromItem du détail (pastilles colorées par statut). Typecheck web/api OK, tests API relations 16/16, vérifié à l'écran (ouverture, Annuler ne ferme que la relation). Constat existant non traité : Échap ferme aussi la fiche (toutes les sous-modales de la fiche). MEP 825ef12

### Recherche mobile — résultats masqués — 2026-10-20
- Mesure 375×812 : en-tête collé de SearchPage = 538 px sur 763 (70 %), filtres empilés (208 px) + 5 types sur 3 lignes. Correctif (accord Thomas) : en mobile seul le champ est collé (en-tête en `contents`), description masquée, types sur une ligne défilante (no-scrollbar), filtres repliés derrière « Filtres » (pastille = nb actifs) ; desktop inchangé. Après : partie collée 70 px, premiers résultats à 309 px (avant 639), pas de débordement horizontal ; desktop vérifié. search.help.ts (conseil + tour), spec Recherche (Markdown, to_validate). typecheck web OK, help 320/320. MEP e76eb22
- Constat hors périmètre : au premier chargement par URL (/search, /communities), l'appli renvoie vers l'accueil → TODO

### Vue Process (chantier A) — 2026-10-20
- Brainstorm validé par Thomas : cycle brainstorm → enchaînement de tâches → modèle (B) → mise en œuvre planifiée (C) ; A = vue d'espace « Process », un process par espace, page vide + panneau « Non placés », positions libres partagées (table process_nodes), double-clic = NOTE, liens = vraies relations via la modale habituelle, pas de formes graphiques. Plan : docs/superpowers/plans/2026-10-20-vue-process.md
- Implémenté, testé à l'usage par Thomas, commité d956e91 et poussé : schéma ProcessNode (db push local fait), routes /spaces/:id/process-nodes (7 tests), process-utils (6 tests), useProcessNodes, RelationCreateDialog/RelationEditDialog (copie partagée, MindMap/PERT/Gantt non migrés), ProcessView/ProcessNode/ProcessUnplacedPanel, registre (planning, order 8), fiche d'aide, businessRules, ARCHITECTURE, MODELE-DONNEES (édité à la main, générateur hors dépôt). Typecheck 6 paquets OK, TNR 1420/1420 (compteur de vues 31 → 32). Spec SPOK « Vue Process [ProcessView] » to_validate
- Modales de relation unifiées (validé à l'usage par Thomas, commit ece92a6, poussé) : RelationSentenceRow (phrase « A bloque B » du PERT + explication détaillée du type, choix Thomas) utilisée par RelationCreateDialog/RelationEditDialog, branchées dans MindMap, PERT, Gantt et Process ; copies inline supprimées (MindMap : seuls rendu + état des modales touchés). Typecheck web OK, tests vues + aide 381/381. Specs SPOK « Vues » (section Modales de relation) et « Vue Process » to_validate
- 2026-10-21 (commit 582bcc5, mep) : panneau « Non placés » en arborescence (buildTree/flattenTree, recherche à plat) ; bouton « Réorganiser en processus » (layoutAsProcess = rangs PERT en colonnes, ordre vertical conservé, ConfirmModal, PUT groupé /spaces/:id/process-nodes en transaction). Tests route 10/10, process-utils 9/9, aide OK, typecheck web/api OK. Spec SPOK Vue Process to_validate
- 2026-10-21 (commit 383857a, mep) : correctif branches multiples de « Réorganiser » — cause : chaque colonne était empilée selon l'ancienne hauteur, indépendamment de la précédente → branches croisées. layoutAsProcess place désormais chaque item à la hauteur moyenne de ses prédécesseurs (décalage vers le bas si conflit). Test de reproduction + 10/10, typecheck web OK. Demande de diagrammes de flux (formes graphiques) : brainstorming à lancer
- 2026-10-21 (commit 383857a, mep) : canevas Process trop petit quand le panneau « Non placés » est vide — cause : 'process' absent des 3 listes de vues plein cadre de SpacePage (h-full / overflow-hidden), hauteur prise du contenu. Ajouté à côté de 'pert', chaîne h-full vérifiée dans le DOM
- 2026-10-21 (commit 3bd1d13, mep ; Réorganiser sans confirmation à la demande de Thomas) : couloirs (flux) — brainstorm validé (couloirs horizontaux empilés nommés par un item, démarrent vides, rangement visuel, Réorganiser à colonnes communes), plan docs/superpowers/plans/2026-10-21-process-couloirs.md. Table ProcessLane + ProcessNode.laneId (db push local), routes /process-lanes (GET/POST/PUT order/DELETE) + laneId sur les nœuds (19 tests), computeLaneLayout/findLaneAt/layoutAsProcess avec couloirs (14 tests), ProcessLaneNode (groupe xyflow), glisser dedans/dehors, menus, bouton du panneau. Typecheck web/api OK, aide 335/335, vue chargée sans erreur. Spec SPOK to_validate
- 2026-10-21 (non commité) : titre et menu des couloirs inaccessibles — cause : xyflow met pointer-events: none sur un nœud ni sélectionnable ni déplaçable sans gestionnaire (index.mjs, hasPointerEvents) ; zone de titre de ProcessLaneNode repassée en pointer-events: auto (bande laissée transparente pour le pan et le double-clic). Typecheck OK, non vérifié à l'écran (session du navigateur intégré expirée)
- 2026-10-21 (non commité) : liens vers un item-couloir conservés, rattachés au couloir (sous-processus, poignées invisibles gauche/droite) ; réduction des couloirs (chevron, préférence localStorage, items masqués, liens rattachés, liens internes masqués) ; data des arêtes avec fromItemId/toItemId (modale d'édition). process-utils 17/17, aide OK, typecheck web OK
- 2026-10-21 FAILLE (en prod depuis 3bd1d13) : garde denied() async renvoyait `reply` (thenable → undefined) → après un 403/404, les routes process-nodes/process-lanes continuaient d'écrire (VIEWER et non-membre pouvaient modifier positions et couloirs). Corrigé (booléen) + 14 tests « aucune écriture après refus » (RED sur 3bd1d13, GREEN 36/36). Commit cc944eb, mep (accord Thomas)
- Commité 499a54b (mep, front) : déplacement libre des couloirs (x/y en base et route poussés avec cc944eb) — computeLaneLayout/findLaneAt avec origine x/y, glisser par le titre (dragHandle, style pointer-events none sur la bande), Réorganiser remet la pile ; couloir replié en boîte (hauteur et longueur) ; liens vers un item-couloir ; repli. process-utils 20/20, typecheck web OK. Spec SPOK to_validate. À tester par Thomas
- Commité 499a54b (mep) : commentaire des relations en icône (bulle) + infobulle au survol — arête partagée RelationEdge (MindMap, non modifiée) au lieu du texte sur la flèche ; tracé courbe au lieu d'angles droits. process-utils 21/21
- Commité 499a54b (mep) : régression visuelle signalée par Thomas (capture « chaos ») — cause : les courbes de RelationEdge (MindMap) traversaient les couloirs ; RelationEdge accepte data.pathStyle 'smoothstep' (défaut courbe inchangé pour la MindMap), Process repasse en angles droits avec la bulle de commentaire
- Commité 499a54b (mep) : chevauchement des flèches (capture Thomas) — cause : le tracé à angles droits tourne à mi-chemin, une flèche sautant des colonnes tombait dans la voie verticale d'une autre. assignEdgeChannels : chaque flèche vers l'avant tourne juste avant la colonne cible, voie propre par flèche (décalage 10 px) ; data.centerX passé à getSmoothStepPath (RelationEdge, défaut MindMap inchangé). process-utils 23/23, typecheck OK
- Commité 499a54b (mep) : 2e capture — tronçon horizontal traversant un item de la même ligne. Routage étendu : 3 tracés candidats (ligne de départ, ligne cible, voie de contournement à hauteur libre), premier sans item traversé ni tronçon horizontal déjà pris ; couloirs exclus des obstacles ; data.corridor tracé par RelationEdge. process-utils 26/26, typecheck OK
- Commité 499a54b (mep) : relations vers l'entrée (gauche) / depuis la sortie (droite) d'un couloir — poignées reliables, onConnect traduit lane-<id> en item du couloir. Typecheck web OK
- Commité b6a6575 (mep) : retours de processus (flèches vers l'arrière : sortie de couloir → entrée du suivant) traversaient les items — cause : tracé par défaut (tournant à mi-hauteur). assignEdgeChannels les route aussi : sortie à droite, voie horizontale de préférence entre deux couloirs, sinon aux abords des items, rentrée à gauche, voie propre par flèche. process-utils 27/27, typecheck OK
- Commité b6a6575 (mep) : retours qui « font le tour » — cause : espace entre couloirs de 16 px = une seule voie, déjà prise → repli sur l'espace au-dessus du 1er / sous le dernier couloir. LANE_GAP 16 → 40 et 5 voies par espace (pas de 8 px) essayées avant d'aller plus loin. process-utils 28/28, typecheck OK
- 2026-10-22 Chantier B (modèles) — brainstorm SUSPENDU par Thomas : il réfléchit à « un process doit-il permettre de créer un modèle ? ». Acquis : besoin = réfléchir une fois une démarche/bonnes pratiques (rdv, copil, projet = grappe d'items : préparation, réunion, CR…), l'enregistrer en modèle, l'insérer quand le cas se présente dans un espace existant (plusieurs fois possible ; un projet né d'un modèle peut ensuite devenir un espace dédié via « Convertir en espace ») ; modèle = un item parent + sa grappe (pas tout le process d'un espace) ; recopier presque tout (contenu, tags par nom, relations internes, couloirs, disposition) sauf statut/dates/assigné/commentaires ; rythme = écarts de dates de l'exemple par rapport à une étape de référence choisie à l'enregistrement (option 1 retenue), date de référence donnée à l'insertion. Conception complète proposée en chat, non validée
- Reste : chantiers B (carte de session proposée) et C ; modale de relation d'ItemEditModal

### Modèle de données — suite de la session d'audit (coupée par la limite d'usage) — 2026-10-16
- docs/MODELE-DONNEES.md généré depuis schema.prisma : diagramme Mermaid erDiagram (60 relations, rendu vérifié avec mermaid 10.9.1, 30 tables reliées ; AppConfig et RefreshToken sans relation déclarée), détail des 32 tables (PK/FK/unique/défauts, onDelete, index), 13 enums ; lien vers l'artifact MCD/MLD. Généré par script (scratchpad) : régénérer plutôt que corriger à la main. Commité avec la doc le 2026-10-20
- packages/database/.env : 5433 → 25432 (oubli du changement de port du 14/10), `prisma db push` local OK (déjà en phase).
- Prod 2026-10-20 (accord Thomas) : 323 statuts vides passés à NULL (transaction, recompte 0). Reste : migrations versionnées (chantier dédié, proposé en session à part).

### Navigabilité communautés / espaces — 2026-10-16
- État des lieux (note de session navigabilite-espaces-constats.md) puis 4 lots validés par Thomas, commités sans push : f022fe4 (bugs : rester dans la communauté après suppression/départ, sous-espaces remontés sous le parent, accueil premier accès), ca7200d (CreateSpaceModal unique, menu ⋯ et « + » de la sidebar, MoveSpaceModal), ba6807d (ordre manuel : Space.position, PUT /spaces/reorder, glisser avant/dans/après, Monter/Descendre). Tests ciblés + typecheck web/api OK, vérifié à l'écran en local. db push local fait (prod : db push au démarrage). Specs SPOK to_validate : Sidebar, Création d'espace, Page/Paramètres communauté, Liste des espaces, Paramètres espace, Confirmation quitter/supprimer, Accueil, Space
- ba6807d commité en n'indexant que mes passages de spaces.ts/spaces.test.ts (transaction PATCH d'une autre session laissée non commitée)

### Modèle de données — fiabilisation — 2026-10-16
- Audit de cohérence des 29 tables (doc dans le dossier de notes de session) puis corrections validées par Thomas : restauration audit complète (visibility, context, référentiels…), suppression d'utilisateur réservée aux comptes sans trace (countUserTraces), SpaceModule et statuts des modèles d'espace supprimés, colonnes isPublic/pendingPublic supprimées (API/web/MCP sur visibility ; isPublic accepté en entrée seulement), statut '' → null à l'écriture, relation « parent » retirée, Invitation.role typé, purge refresh tokens expirés, index en double retirés. VIEWER gardé (rôle implicite, recommandation initiale erronée). TNR 1399/1399, typecheck 6 paquets OK. Commit e7f760e
- Reste : données prod `items.status = ''` à passer à NULL (local fait) ; migrations versionnées (start-api.sh fait `db push --accept-data-loss`) → chantier à part ; MCD/MLD visuel à produire

### Zoom au pincement du pad (Windows) — 2026-10-16
- Cause : @xyflow/system n'applique le facteur ×10 du pincement (ctrl+wheel) que sur macOS → pincement ~10× trop lent sous Windows. hooks/useTrackpadPinchZoom.ts (capture wheel, ctrl + |deltaY| < 50 en pixels, hors Mac, centré pointeur) branché sur MindMapView et DashboardMindMapView (bornes de zoom en constantes). typecheck web OK. Validé au pad par Thomas. Commit ca38a23, en prod (poussé avec 4ef85cf). Spec SPOK Carte mentale [MindMapView] : section Navigation (zoom) ajoutée, to_validate

### Libellé du bouton de sourdine — 2026-10-16
- CommunityCard (liste des communautés, Activité) : « Notifier »/« Sourdine » + cloche → « Masquer l'activité » / « Afficher l'activité » (orange) + œil, infobulles précisant que la cloche n'est pas touchée. activity.help.ts aligné, règle businessRules community-mute-activity-only, spec Activité réécrite en Markdown (to_validate). typecheck web OK, help 310/310, vérifié à l'écran sur /communities (bascule aller-retour). Bouton mort de CommunityBanner (jamais de onMute) non touché. MEP 2026-10-20 : 32767b0 (sourdine) + fca5974 (transaction PATCH /spaces/:id, carte globale) + businessRules et MODELE-DONNEES.md en commit de doc ; spaces API 84/84, web help+drop 319/319, typecheck api+web OK

### Doc séances — processus — 2026-10-15
- Document SPOK « Processus d'une séance » (cmv9yofvt0004nkmdwe7dpcvs, enfant de LiveSession, espace Espaces, to_validate) : rôles, cycle (schéma texte), avant / pendant / après en tableaux qui / où / effet, visibilité par rôle. Rédigé d'après la spec parente (pas de revue du code). Rendu du schéma et des tableaux non vérifié dans SPOK
- Nom des espaces de séance préfixé « Séance » (demande Thomas) : components/live/sessionName.ts defaultSessionName (web, date locale) + défaut serveur live-sessions.ts (UTC), nouvelles séances et suites ; séances existantes non renommées. Tests : sessionName.test.ts (2), live-sessions 63/63, live web 35/35, typecheck api+web OK. businessRules + spec LiveSession + Processus à jour (to_validate). MEP f92a183, UI non vérifiée
- Bouton de l'en-tête des séances réservé aux séances démarrées (demande Thomas) : GET /live-sessions/ongoing → status LIVE seulement ; LiveSessionsButton filtre LIVE, toujours rouge, « Séances en direct ». Tests : ongoing (2 réécrits), LiveSessionsButton (préparée seule → masqué, test rendu fiable), live api 63/63, live web 36/36, typecheck api+web OK. businessRules, specs LiveSession / Processus / En-tête à jour (to_validate). MEP b79097a, UI non vérifiée

### Validation doc SPOK — 2026-10-15
- 271 items to_validate relevés. Cancelled (accord Thomas) : 19 fiches-champs du 16/03 de l'ancienne modale d'édition (renvoi vers ItemEditModal de l'espace Items) + « Sélecteur de vue » (doublon GlobalNavBar). 26 autres fiches-champs (profil, création, e-mail…) gardées : pas de remplaçant
- Pages utilisateur : done ×9 (MindMap, Liens, Recherche, Tâches, Tableau de bord, Ma journée, Sunburst, notes Visualisations/Navigation globales) ; Accueil aligné sur le code (60 j, Voir tout → cloche), to_validate
- Activité : sourdine documentée (communauté, illimitée, fil d'activité seulement — pas la cloche), validée par Thomas → done ; libellé du bouton trompeur → TODO
- Graphe global aligné (filtres communauté + types de lien, pas de filtre par type d'item) → done
- Structure : done ×6 (Charte, Mode d'interface, GlobalNavBar, Sidebar, JWT, Sécurité & Accès) ; corrigés to_validate : En-tête (JDR, séances), Rôles communauté/espace (OWNER/MEMBER seulement, lecture seule = implicite), Rôles plateforme (admin hors mode admin = normal) ; Matrice des droits réécrite d'après checkSpaceAccess (to_validate)
- Assigné = auteur (décision Thomas) : utils/itemOwnership.ts canMemberManageItem → PATCH, DELETE (items.ts), bulk-move (item-move.ts) ; SpacePage.canEditItem + assigné ; règle businessRules assignee-can-manage-item ; +3 tests (items 56/56). typecheck api+web OK, items/cross-space/bulk 68/68, web lib 125/125. Matrice + Rôles espace à jour (to_validate). MEP 0733420, UI non vérifiée
- Revue sécu de 0733420 : fusion/absorption sans garde d'auteur (faille antérieure, exploitable via l'assignation) → gardes canMemberManageItem (source+cible, parent+enfants), item-merge-ownership.test.ts 6/6, TNR api 686/686, typecheck api OK. Suppression/déplacement de branche : sous-items d'autrui emportés, accepté par Thomas. Reste : modale de fusion propose des cibles refusées (TODO). MEP 2ba292f
- Restent dans Pages utilisateur : Liste des espaces (spec ≠ code : ni filtre, ni bouton, ni ?new=space, hook après return — chantier à arbitrer), Graphe global (filtre par type à vérifier)

### Vues globales — arbitrage de la revue — 2026-10-15
- Accueil « Voir tout » (Non lus) → ouvre la cloche (stores/notificationPanel.ts, NotificationBell piloté par le store) ; plus de lien vers /notifications
- Carte mentale globale : clic communauté → /communities/:id ; glisser-déposer gardé (Thomas) + retour de survol (nœud translucide, cible ping vert / rouge, étiquette curseur, cible = nœud sous le curseur) ; dashboard-mindmap-drop.ts (règles pures, 7 tests) ; MindMapPage attend le PATCH, recharge spaces/sidebar/communities, bandeau d'erreur, nœud remis en place ; changement de communauté d'un espace à sous-espaces permis (l'API propageait déjà communityId depuis adff75f — garde-fou web et conseil d'aide retirés le 2026-10-16, propagation passée en transaction)
- Liens globaux : sélecteur Communauté / Espace (+ sous-espaces) côté API, useInfiniteQuery 200/page, « Charger plus », total ; Images globale abandonnée
- Fiches d'aide home, global-mindmap, global-links à jour ; ARCHITECTURE (store). typecheck web OK, help + drop 317/317 (via --project web). Vérifié en local : survol (4 cas), filtre liens, cloche. Dépôt réel validé par Thomas à l'écran. NON vérifié : « Charger plus » (4 liens en local). Specs SPOK en prod avec accord de Thomas (to_validate) : « Carte mentale globale [MindMapPage] » réécrite (glisser-déposer gardé, clic communauté), « Liens globaux [GlobalLinksPage] » créée (cmv9jvocj000ccrhm5o8dl8gq). MEP 7bd4fc3, 54c69b7, 5276d50

### Port Postgres dev 5433 → 25432 — 2026-10-14
- 5433 tombé dans une plage réservée par Hyper-V (5353–5452) → conteneur sans port publié, API « Can't reach database ». Passage à 25432 (aligné dev-environment.md, liste, voyages) : docker-compose.dev.yml, .env, apps/api/.env, .env.example, scripts/_env.ts, health-check.ts, CLAUDE.md, skill spok-api, mémoire. Conteneur recréé (volume conservé), API 200. `bank/.env` encore en 5433 : à mettre à jour (autre projet, non touché). Commit 7a890a4

### Aide utilisateur intégrée — phase 1 — 2026-10-14
- Décision Thomas : 3 couches de doc (spec SPOK / doc technique dans le code / aide utilisateur dans l'interface), textes d'aide DANS LE CODE (mémoire three-doc-layers). Spec SPOK « Aide utilisateur intégrée [help] » cmv7xld7h00055de22u5fihif (to_validate)
- help/types.ts (HelpEntry, TourStep), help/HelpButton.tsx (point d'interrogation générique), components/views/help/<vue>.help.ts ×32 + index (VIEW_HELP, Record strict) générés depuis viewDescriptions + viewTours (supprimés) ; tours écrits pour overview, links, bugs, todo, documents, thread, images, recent, pert (+ textes corrigés) ; ViewHelpButton = relais ; useOnboarding/ViewModeSelector sur VIEW_HELP ; tours de pages déplacés tels quels dans help/pageTours.ts ; help/coverage.test.ts (31 vues). typecheck web OK. MEP b5eb8d0
- Lot 1 tours complets (modèle : intro → commandes de la vue → élément → gestes → barre commune ; « ? » auto en fin) : list, thread, mindmap, images, documents, links, recent. help/commonTourSteps.ts (ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS) ; data-tour posés : new-item, item-menu, bulk-upload, collapse-toggle, toolbar-order/filter/highlight, thread-topic, images-zoom/tile, documents-row, links-tag, recent-new/modified, mindmap-reset/fit/relations/legend. coverage.test : FULL_TOUR_VIEWS (≥5 étapes, ≥3 pointées) + repères existants. Placement du « ? » déjà conforme partout (droite du #view-header). Skill spok-menu mis à jour (redémarrer Claude). coverage 39/39, typecheck web OK. UI NON vérifiée. MEP b5eb8d0
- Lot 2 tours complets : kanban, tree, timeline, planning, calendar, pert, todo, bugs, types, priority, members (textes corrigés : Planning = par urgence, Gantt = zoom réel, gestes échéance/dépendance/chemin critique). data-tour ajoutés : timeline-compact/critical, pert-node/relation-filter/zoom/legend ; FullCalendar via .fc-header-toolbar/.fc-event. FULL_TOUR_VIEWS = lots 1+2. coverage 50/50, typecheck web OK. UI NON vérifiée. MEP b5eb8d0 (TNR 1087/1087)
- Lot 3 tours complets : graph, sunburst, radialTree, bubble, treemap, chord, heatmap, ego, relations, crossTable, burndown, cfd, text, overview (textes corrigés : clic Sunburst/Bulles/Treemap, tailles réelles). data-tour posés : sunburst-segment, radial-node, bubble-node, treemap-node, heatmap-cell, ego-node, crosstable-cell, text-item, overview-view-card, chord/burndown/cfd-chart. Toutes les vues en FULL_TOUR_VIEWS + test « toute vue doit avoir un tour complet ». coverage 65/65, typecheck web OK. UI NON vérifiée. MEP 0c526e3 (TNR 1102/1102)
- Phase 2 lot A : registre help/pageHelp.ts (PAGE_HELP : dashboard, item-modal, community-settings, space-settings ; fiches pages/help/*.help.ts et components/help/item-modal.help.ts), 3 boutons d'aide maison supprimés (ItemEditModal, CommunitySettings, SpaceSettings) + bouton nu du tableau de bord → HelpButton variant « page » ; help/pageTours.ts supprimé ; tour paramètres d'espace corrigé (pas d'onglet Référentiels, + Aperçu), communauté complété (Référentiels, Tags, Aperçu, Danger), repère item-contributions ajouté. HelpEntry.short (accroche) : remplace les 3 copies de descriptions (OverviewView, SpaceOverviewPage, LandingPage). coverage étendu (pages, accroches, repères générés) 66/66, typecheck web OK. MEP 652665a
- Phase 2 lot B : help/PageHelpButton.tsx (pageKey → fiche + clignotement + tour) ; fiches + repères pour home, search, activity, today, tasks, communities, community, spaces, space-overview, space-history (cartes SpaceCard/CommunityCard ancrées ; repère home-communities posé → l'étape « Vos communautés » du tour de bienvenue marche enfin ; historique : pas de filtre auteur). coverage 76/76, typecheck web OK. MEP 652665a
- Phase 2 lots C+D : fiches + repères bookmarks, profile (modale), live-window, global-graph, global-sunburst, global-mindmap, global-links (21 fiches de pages/modales au total). « Réinitialiser tous les tutoriels » inclut maintenant les tours de pages (spok-page-tour-*). Seuil pages : ≥ 2 étapes pointées. Revue des vues globales : constats au TODO (lien /notifications mort, carte mentale globale → paramètres + déplacement silencieux, liens sans filtre espace, pas d'Images globales). coverage 83/83, typecheck web OK. MEP 652665a
- Reporté : HelpHint/EmptyHelp créés au 1er usage (phase 3, pas de code mort) ; phase 2 = pages/modales + descriptions de vues dupliquées dans OverviewView, LandingPage, SpaceOverviewPage
- Phase 3 lot A (états vides) : help/EmptyHelp.tsx (encart, ou bandeau `banner` au-dessus des colonnes Kanban/Types/Assignés/Priorité/Tableau croisé) ; champ `empty` dans 28 fiches de vues ; branché sur 28 vues (Bulles, Arbre radial, Treemap n'avaient aucun état vide ; Arborescence vide gagne un bouton Nouveau). Exemptées : overview, calendar, heatmap, mindmap (cadre utile vide). coverage.test : empty + EmptyHelp branché. coverage 111/111, typecheck web OK. Vérifié à l'écran (Liste, Kanban, Bulles). MEP 652665a
- Phase 3 lot B (infobulles) : help/HelpHint.tsx (survol + focus, portail) ; textes help/spaceToolbar.hints.ts ; SpaceToolbar : boutons de vue (libellé + accroche VIEW_HELP.short), Autres vues, ordre ×3, Filtre/Aperçu + Types/Statuts, compteur, modèle, historique, paramètres (title → aria-label ; tour commonTourSteps historique → [aria-label=…]). 6 boutons à icône seule sans libellé (estimation « 23 » fausse) : title + aria-label. MEP 652665a
- Phase 4 mode Aide (plan docs/superpowers/plans/2026-10-14-mode-aide.md, registre .superpowers/sdd/2026-10-14-mode-aide/progress.md) : stores/helpMode.ts, help/helpZones.ts (findHelpZone, zoneText), help/HelpModeOverlay.tsx (monté dans Layout ; Maj+?, lecture seule par capture sur window, encadré + carte épinglable, bandeau, Échap), bouton « Mode Aide » dans l'encart du ?, help/shellZones.ts (20 zones du cadre = data-devzone, + sous-zones toolbar-vues/ordre/filtre/apercu/actions), HelpEntry.zones + data-help-zone="<vue>:<zone>" sur les 31 vues (2 à 4 zones). coverage.test : zones du cadre ⇔ textes, ≥ 2 zones par vue (Todo/Bugs composés de ListView, Calendrier 1 zone), aucun orphelin. Défaut trouvé à l'écran et corrigé (TDD) : carte de survol effacée par le rafraîchissement périodique. help 312/312, typecheck web OK, vérifié à l'écran (Maj+?, survol, clic bloqué, épinglage, Échap, zones des 31 vues). Skills spok-doc/spok-menu à jour (redémarrer Claude). Spec SPOK [help] mise à jour en prod avec accord de Thomas (phase 4, barre commune, infobulles des en-têtes ; to_validate). MEP 515065c
- Revue des 31 vues (script dans la page, espace de test, admin) puis corrections validées par Thomas : 12 « + Nouveau » recopiés dans SpacePage → NewItemButton (Arborescence + 11 vues graphiques, l'étape Nouveau y manquait) ; NewItemButton et CollapseToggleButton sous HelpHint ; « Étendre » maison de l'Arborescence → CollapseToggleButton ; Carte mentale : étape zoom sur .react-flow__controls (Controls ignore data-tour) ; Présentation : étapes de barre retirées, sections pointées (overview-settings/stats/subspaces/members) + bouton Paramètres icône seule sans nom → aria-label + HelpHint ; HelpHint + hints dans les fiches pour Gantt (11), PERT (10, filtres {label}), Carte mentale (4), Images (zoom vignettes), import Images/Documents (BulkUploadButton) ; étapes Réduire/Étendre ajoutées aux tours Gantt et PERT, étapes Gantt/PERT ciblant des title → data-tour. coverage.test : en-têtes #view-header de toutes les vues sans title natif + composants partagés. help 166/166, typecheck web OK, revue rejouée : plus aucune commande d'en-tête sans infobulle, restent 4 cibles conditionnelles (données). MEP 515065c
- Barre d'espace, commandes non couvertes (relevé Thomas) : HelpHint sur Séances (ParentSessionsButton) et Exporter (ExportDropdownButton, donc toutes les vues via SpaceExportButton), textes dans spaceToolbar.hints (sessions, export) ; title natifs restants → HelpHint (× recherche ×2, filtres mobiles) ; SPACE_TOOLBAR_STEPS + Séances, Insérer un modèle, Paramètres, Exporter (data-tour toolbar-sessions/template/settings, view-export) → présents dans les 31 tours ; repères orphelins toolbar-filters/search retirés. coverage.test : bloc « barre d'espace » (pas de title natif, commande aria-label → HelpHint ou repère, repère posé → étape) — vérifié qu'un title réintroduit fait échouer. help 131/131, typecheck web OK, vérifié à l'écran (tour Liste 14 étapes, infobulles, menu Exporter). MEP 515065c
- Vérif écran phases 2-3 (navigateur intégré, admin local) : cibles des tours de 18 pages + fiche d'item contrôlées, infobulles barre d'espace (survol). Corrigé : « ? » de HelpButton sans type="button" → dans la fiche d'item (form) un clic ENREGISTRAIT et fermait la fiche ; étape finale « Besoin d'aide ? » sautée sur toutes les pages (ciblait title="Aide sur cette vue") → HelpButton marque son bouton (TOUR_ANCHOR_ATTR), runTour le cible (bon « ? » quand une modale couvre une vue) ; fiche d'item en mode Forum : étape « Plus de champs » (data-tour item-more-fields) + conseil ; graphe global : « ? » recouvrait le panneau (→ gauche) et étape périmètre sans cible (→ data-tour graph-controls) ; tableau de bord → PageHelpButton ; Historique/Paramètres de la barre : lien + bouton = 2 arrêts clavier → aria-label sur le lien, bouton tabIndex -1. Cibles conditionnelles laissées (favoris, portée de recherche, espaces perso, contributions, enfants). coverage 127/127, typecheck web OK. MEP 652665a
- Phase 5 : règles des 3 couches dans les skills — spok-doc (section « trois couches » + règles couche 3, après-codage), spok-deploy (check-list aide + `vitest run src/help`), spok-start (rappel), spok-menu (pages/modales via PageHelpButton, infobulles HelpHint, Link+Button). Redémarrer Claude pour recharger les skills. MEP 484f6b7
- Phase 3 lot C (aide des champs) : HelpEntry.fields + help/FieldHelp.tsx (page, field) ; textes dans space-settings (6, phrases existantes déplacées), community-settings (3), item-modal (5 : début/fin, échéance, priorité, parent, assigné), community (parent du nouvel espace), communities (description). Séance (NewSessionDialog) laissée en place (phrase contextuelle unique). coverage.test : FieldHelp → fields existant. coverage 127/127, typecheck web OK, vérifié à l'écran (paramètres d'espace, fiche d'item). Spec SPOK [help] mise à jour (to_validate). MEP 652665a

### MindMap : sous-sous-espaces rattachés à la racine — 2026-10-14
- buildPortalNodesAndEdges (mindmap-layout.ts) reliait tout nœud de sous-espace à __space__ → arête vers child-space-<parent> si le parent est affiché, parents traités avant enfants, placement dans le prolongement du parent (arc racine = 1er niveau seulement), position enregistrée prioritaire. mindmap-layout.portals.test.ts (3), mindmap 19/19, typecheck web OK. Validé par Thomas à l'écran. MEP 56ae2c0

### Stockage local des fichiers en dev — 2026-10-14
- utils/r2.ts : mode local si pas de R2 ET NODE_ENV !== 'production' (fichiers dans apps/api/.local-uploads, URL /api/local-uploads/<clé>, mêmes clés que R2 ; envoi/suppression/copie/isR2Url) ; routes/local-uploads.ts (GET /local-uploads/*, chemin vérifié), enregistrée par index.ts seulement en mode local ; .gitignore. r2.local.test.ts 5/5, TNR api 677/677, typecheck api OK, route vérifiée sur l'API de dev. Envoi d'image réel NON vérifié (Thomas). MEP dcf55f6

### Recherche (/search) — 2026-10-14
- search.ts /advanced : périmètre = espaces lisibles (readableSpaceIdsForUser + espaces des communautés non privées, filterReadableSpaceIds) pour connecté ET anonyme (fuite sous-espace hérité d'un parent privé corrigée) ; filtres d'items appliqués aux contributions via l'item, sections communautés/espaces/utilisateurs omises (itemFiltersActive) ; dès 1 caractère, 10/page. SearchPage : libellés type/statut, filtre Statut, sélecteur de tag (tags de l'espace choisi), pagination par section (« Voir les N résultats »). search 17/17, typecheck api+web OK. Doc SPOK « Recherche [SearchPage] » to_validate. UI NON vérifiée visuellement. MEP fbb566c
- Regroupement (option A validée par Thomas) : items et contributions triés communauté › espace › récence par l'API, affichés sous en-têtes « Communauté › Espace » (groupBySpace, groupes consécutifs ; perso → « Espaces personnels »). typecheck api+web OK, search 17/17, appel API local 200. MEP fbb566c (TNR 1037/1037)

### Fuite « Activité récente » (accueil + /activity) — 2026-10-14
- GET /activity prenait tous les espaces des communautés suivies (titres d'items d'espaces privés non membre). Filtré par filterReadableSpaceIds (espaces suivis + espaces des items marqués non lus), mode admin via header x-admin-mode (la route a son propre hook jwtVerify). +3 tests, activity 8/8, typecheck api OK. MEP 69215af
- Audit des lectures non contrôlées : readableSpaceIdsForUser (items.ts) branché sur /user/tasks, /user/agenda, /user/review-queue (mêmes « tous les espaces de mes communautés ») ; IDOR fusion/absorption (item-merge.ts) et réactions (item-reactions.ts) : l'item/la contribution doit appartenir à l'espace de l'URL. Tests : item-cross-space.test.ts (6), review-queue +1, user-tasks réaligné. Reste : recherche anonyme (sous-espace hérité d'un parent privé), dans le chantier Recherche. TNR 1025/1025, typecheck OK. MEP e2be134

### Suppression d'espace avec enfants en échec (Sentry P2003) — 2026-10-13
- Logs Railway : DELETE /spaces/:id?deleteChildren=true → 400 (audit écrit après space.delete d'un sous-espace → FK audit_logs_spaceId_fkey). Pas de transaction : chaque essai supprimait items + 1 sous-espace ; Thomas a fini sans enfants puis via admin (rien de perdu hors intention)
- Audit avant delete : spaces.ts (sous-espaces), admin/spaces.ts, admin/communities.ts (sous-espaces + espace racine). Web : suppression avec try/catch + erreur affichée. Test d'ordre ajouté. TNR 1005/1005, typecheck OK. MEP ec35d0a. db:push local JDR fait. Transaction de la suppression : non faite (à proposer)
- Le « 503 page paramètres d'espace » noté plus bas = probablement ce même incident
- Suppression transactionnelle : utils/spaceDeletion.ts (deleteSpaceTree / deleteCommunityTree / runDeletion, timeout 30 s, audits items en createMany) remplace 4 copies (spaces, admin/spaces, communities, admin/communities). 4e copie (DELETE /communities/:id propriétaire) avait encore le bug FK → corrigé. Mock $transaction(fn) passe désormais le même mock. TNR api 656/656, typecheck api OK, vérif base locale réelle OK (rollback sur panne + suppression complète). MEP 89e8dad

### Vignettes de préparation des séances — 2026-10-13
- visibleAgenda(agenda, viewer) : animateur = toutes les vignettes, présentateur = celles de ses lignes, participant = aucune ; appliqué aussi aux réponses HTTP (broadcastAgenda renvoie la vue de l'appelant, qui renvoyait la préparation brute). +2 tests, live-sessions 61/61, typecheck api OK. MEP 460c7ef. Doc SPOK « Séances de présentation en direct » (cmv27if320005f3dmsfyejatp) non mise à jour : espace introuvable via MCP

### Mode JDR — 2026-10-13
- Enum CommunityContext + JDR (db:generate fait, db:push local NON fait : Docker arrêté), API zod, interfaceMode 'jdr', Layout (dérivation + bouton), SpaceToolbar MODE_PRIMARY_VIEWS, CommunitySettingsPage (4e option). Tests web 3/3, communautés 57/57, typecheck 6 paquets OK. UI NON vérifiée visuellement. MEP 7013bbd

### Quitter / se rétrograder dans un espace — 2026-10-12
- MEP 5494c5b/f0c4574/169b5d5 (CI verte). Revue sécu 169b5d5 : vignette visible des autres présentateurs → correctif proposé, en attente
- leave OWNER si co-propriétaire ; MembersColumnManager : actions sur soi (onLeave, espaces seulement), flèches visibles ; SpaceSettingsPage : Quitter pour membre direct. spaces 76/76, web settings 4/4, typecheck api+web OK. UI NON vérifiée visuellement. MEP f66d29d

### Admin hors mode admin = utilisateur normal — 2026-10-12
- Diagnostic prod (lecture seule) : séance JDR « Mes JDR » privée, communauté « Thomas JDR » = 1 membre (ztarr) → aucun invitable ; espaces OPEN « D&D5 Manu - Rodrigue », « Séance du 20 février 2026 » (à passer en privé par Thomas). Script gardé : apps/api/scripts/check-live-session-access.ts
- ztarr voyait des espaces privés en lecture seule hors mode admin : passe-droit ADMIN supprimé (checkSpaceAccess, GET /spaces/:id, filterReadableSpaceIds, search). TNR api 643/643, typecheck api OK. MEP f0c4574
- Séances : vignette en préparation (thumbnailUrl, jamais aux participants) + NoInviteCandidates (liste vide expliquée, lien membres). TNR api 645/645, web live 33/33, typecheck api/web/shared OK. UI NON vérifiée visuellement. MEP 169b5d5

### Demande de publication — 2026-10-12
- Annulation par le propriétaire (PATCH PRIVATE + bouton « Annuler la demande ») ; reject-public vide pendingVisibility ; test conversion isPublic du PATCH admin. Tests communautés 72/72, typecheck api+web OK. UI NON vérifiée visuellement (port 3000 pris par une autre session). MEP 5494c5b
- POST /spaces accepte visibility (GROUP) ; MCP create_space l'envoie dans le POST (PATCH supprimé). spaces 75/75, mcp-core 41/41, typecheck api+mcp-core OK. MEP f0c4574 — après MEP : build:packages déjà prévu, redémarrer Claude pour le MCP local

### Règles d'envoi partagées — 2026-10-12
- `@spok/shared` uploadRules (validateUpload) remplace 5 copies (web, item-uploads, spaces, communities, user) + plafond multipart. build:packages fait, web uploadRules 10/10, TNR api 635/635, typecheck api/web/shared OK. MEP bd20247
- PATCH /spaces/:id : garde isSpaceOwnerOrAdmin (admin global hors mode admin refusé, validé Thomas). TNR api 636/636, typecheck api OK. MEP e86878b
- Sidebar GET /spaces : visibilité effective (getEffectiveVisibilities + keepVisibleWithRole), 2 tests. TNR api 638/638, typecheck api OK. MEP e86878b

### Visibilité communauté : isPublic retiré des contrôles — 2026-10-12
- Prod : check-community-visibility --prod → 0 incohérence (resynchro faite par Thomas)
- API : plus aucune lecture d'isPublic pour l'accès/les listes (graph, items, spaces, search, communities, admin/users) ; PATCH admin convertit isPublic → visibility. Tests 7 fichiers 240/240, typecheck api OK. MEP ac14b92
- Fuite espaces privés (spaces.ts) : GET /:id et /:id/members via checkSpaceAccess, /:id/join refusé si PRIVATE (hors mode admin), POST / sous parent = écriture au parent requise. 6 tests ajoutés, spaces 64/64, typecheck api OK, règle businessRules `private-space-direct-members-only`. MEP ac14b92
- Règle Thomas : propriétaire de communauté = OWNER dans tous ses espaces (isCommunityOwnerOfSpace dans items.ts, branché checkSpaceAccess, isSpaceOwnerOrAdmin, GET /, GET /:id, PATCH, join). Test live-sessions inversé (préparation par OWNER de communauté autorisée). TNR api 625/625, typecheck api OK. MEP ac14b92
- Revue sécu de ac14b92 : graph.ts (4 routes) filtré par filterReadableSpaceIds (portails compris), PATCH parentId gardé, join READONLY refusé (pas de VIEWER en base). TNR api 635/635, typecheck api OK. MEP 144474b

### MCP distant pour utilisateurs tiers — 2026-10-12
- Conception validée : MCP monté dans l'API (`POST /mcp`, outils via fastify.inject avec le jeton de l'appelant), jetons personnels (étape 1), OAuth claude.ai/Desktop (étape 2, plus tard), conformité = instructions serveur + get_space_conventions + validation stricte + Markdown→HTML, audit source MCP
- Plan étape 1 : docs/superpowers/plans/2026-10-12-mcp-distant-etape1.md — IMPLÉMENTÉ, MEP 825ef12 (typecheck 6 paquets OK, TNR 1478/1478)
- Fait : table personal_access_tokens (db push local) ; auth PAT dans jwt.ts (portée read, périmètre /spaces /communities /search /notifications /mcp, jamais /user /auth /admin) ; /user/tokens ; packages/mcp-core (outils, instructions, conventions, Markdown) ; apps/mcp rebranché (45 outils) ; POST /mcp ; audit changes.source via plugins/requestContext ; UI Profil → Accès Claude ; Dockerfile.api
- Vérifs : TNR 925/925, typecheck 5 paquets OK, build Docker OK (contexte git), E2E HTTP local OK (statut libellé → id, Markdown échappé, audit source). UI NON vérifiée visuellement (à faire par Thomas)
- Bug create_contribution (objet Tiptap vs z.string) corrigé
- Débit /mcp corrigé (revue sécu sur bceb559) : 300 req/min par IP avant auth, 120 req/min par id de jeton après auth (mcp/tokenRateLimit.ts, partagé avec le plafond de sous-requêtes). TNR 949/949
- MEP a65c23a puis bceb559 + 05bdd18 (CI verte). Détail : llms.txt (apps/web/public + bloc nginx UTF-8), /mcp 401/403/405 explicites (WWW-Authenticate + lien llms.txt), correctifs revue sécu : ids zId() dans mcp-core + chemins piégés refusés dans injectClient, lots JSON-RPC refusés, clé rate-limit = hash Authorization, plafond 600 sous-requêtes/min/jeton. Tests mcp-core 40/40, api mcp 15/15, nginx -t OK
- Tags MCP corrigés (appelaient /tags inexistant) : list_tags(spaceId) tous profils, create/update/delete_tag sur /spaces/:id/tags en profil admin (couleur #RRGGBB), get_tag supprimé ; create_item/update_item acceptent tags (noms/ids résolus, inconnu refusé). mcp-core 37/37, E2E local OK. NON COMMITÉ
- Doc SPOK « Serveur MCP SPOK » mise à jour (to_validate). Redémarrer Claude pour charger le nouveau MCP local
- trustProxy : logs DIAG PROXY prod lus (ip=100.64.0.1 pour tous → quota par IP commun en prod ; XFF = client, edge) → `trustProxy: 2` dans index.ts + diagnostic d7b9a78 retiré. Tests MCP 17/17. MEP 2026-10-12 — vérifier en prod que request.ip = IP client
- Accès MCP accordé par l'admin : User.mcpAccessGrantedAt/RequestedAt + notif MCP_ACCESS_REQUEST (db push local), hasMcpAccess vérifié à chaque requête PAT (403), création de jeton bloquée, /user/mcp-access(+/request), POST /admin/users/:id/mcp-access (AuditLog), UI Profil (demander/en attente) + colonne MCP admin, llms.txt, businessRules, doc SPOK to_validate. Tests api ciblés OK, typecheck web+api OK. UI NON vérifiée visuellement. MEP 2026-10-12. Après MEP : `npx tsx apps/api/scripts/backfill-mcp-access.ts --prod` (liste) puis `--apply`
- MEP b081266 (CI verte). Rattrapage prod NON fait (permission refusée) : à lancer par Thomas.
- Alerte tentative refusée (MCP_ACCESS_DENIED, 1/utilisateur/24 h, mcp/deniedAccessAlert.ts) + échappement HTML des emails de notification et d'invitation (emailTemplate.ts escapeHtml/emailSubject). Tests 65/65, typecheck web+api OK. MEP 2026-10-12 (8a8c9e6 fix échappement + feat alerte)

### Mode admin — phase 3 (contenu des espaces) — 2026-10-12
- checkSpaceAccess(prisma, userId, spaceId, isAdminMode) : mode admin → rôle OWNER (membre ou non) ; 40 appels de routes passent request.isAdminMode (items, tags, relations, contributions, réactions, move, merge, bulk, convert, uploads, auditLogs, referentiels). Utilitaires live (liveInvites, helpers live-sessions) inchangés
- GET /spaces/:id renvoie role OWNER en mode admin → écrans de l'espace débloqués ; live-sessions création + invite-candidates ; annulation d'invitation ; SpacePage bouton séance
- Code mort supprimé : pages/DashboardPage.tsx (plus routée) + components/DashboardToolbar.tsx (orphelin)
- Tests : items+spaces 103/103 (+6), routes touchées vertes ; typecheck web/api OK. Non vérifié en navigateur (admin propriétaire de tout en local). MEP 2026-10-12 (avec correctifs visibilité + sidebar)
- BUG visibilité d'espace : PATCH /spaces/:id ne l'enregistrait jamais (absente d'updateData) → corrigé, null = héritée ; GET /:id renvoie inheritedVisibility/inheritedFrom ; écran : choix « Héritée — X » (au lieu de « Ouvert » affiché à tort). Vérifié local (Backend API : READONLY puis retour hérité). NON COMMITÉ
- BUG sidebar : « Arc Enigmes a Sigil ! » (prod, communauté privée Campagne ShadowWorld, seul membre Ondoval) visible sur la page communauté mais pas dans la sidebar — GET /spaces sans communityId ignorait le mode admin. Corrigé : en mode admin, espaces de toutes les communautés, privés compris, rôle OWNER (+2 tests). NON COMMITÉ
- 503 signalé sur la page paramètres d'espace en prod : URL de la requête en échec demandée à Thomas, non diagnostiqué

### Mode admin = tout voir, tout faire — phase 1 communautés — 2026-10-12
- Règle Thomas (mémoire feedback_admin_mode_all_access) : toute garde OWNER doit accepter l'admin en mode admin
- API : `isOwnerOrAdmin` dans communities.ts (delete, available-users, add/remove member, role, invite, invitations, tags x3, emails x4, images) ; community-referentiels checkCommunityOwner + isAdminMode. Exceptions : join/leave/mute/transfer-ownership
- Web : CommunitySettingsPage visibilité/contexte/membres/ajout d'espaces sur canEdit (adminMode)
- Tests communities 51/51 (+5 mode admin, 4 invite réalignés). Typecheck web/api OK. Non vérifié en navigateur (pas de communauté non possédée en local). NON COMMITÉ
- Option A validée : PATCH PRIVATE → OPEN/READONLY = demande (pendingPublic/pendingVisibility + notif admins, helper notifyAdminsOfPublicationRequest partagé avec la création), sauf mode admin ; retour PRIVATE / OPEN↔READONLY immédiats. UI : avertissement + « en attente ». Tests 55/55 (+4). Vérifié local (demande créée puis refusée via reject-public). NON COMMITÉ
- Limites notées : le propriétaire ne peut pas annuler sa propre demande ; reject-public ne vide pas pendingVisibility
- Phase 2 espaces : spaces.ts isSpaceOwnerOrAdmin (available-users, add/remove member, role, invite, invitations, images x4, send-email) + bypass admin sur delete/delete-preview ; SpaceSettingsPage membres en OWNER si canEdit. Tests 108/108. MEP 2026-10-12 (phases 1-2 + option A)
- Code mort supprimé : components/CommunitySelector.tsx (aucun import)
- Signalé : PATCH /spaces/:id laisse passer tout admin global même SANS mode admin (incohérent avec la règle, non modifié)

### Vignettes : raccourcis paramètres + vue par défaut — 2026-10-11
- ui/SpaceCard : boutons haut-droite « vue par défaut » (?view=defaultView, repli list) + paramètres (OWNER/admin) ; ui/CommunityCard : bouton paramètres (OWNER/admin), « Publication en attente » déplacé sous la pastille ; showActions=false sur les aperçus des pages de paramètres
- Typecheck web OK ; vérifié local (5+5 boutons, vue mindmap ouverte, paramètres communauté ouverts). Doc SPOK CommunityPage + CommunitiesListPage MAJ. MEP 2026-10-11
- Repositionné à la demande : pastille + boutons en bas à droite sous l'image (SpaceCard : dernière ligne dédiée pour ne pas tronquer le nom ; CommunityCard : ligne Notifier/Quitter). Vérifié local
- Divergence « Fil »/« Liste » corrigée : SpaceSettingsPage replie sur 'list' (FALLBACK_DEFAULT_VIEW). Vérifié local (Backend API → Liste). Doc SPOK SpaceSettingsPage MAJ. NON COMMITÉ

### /communities : distinguer privées / publiques — 2026-10-11
- Icône globe/cadenas trop discrète et lue sur isPublic (désynchronisable) ; carte « à rejoindre » toujours globe
- Fait : `ui/CommunityVisibilityPill` (Privée ambre / Ouverte vert / Lecture seule bleu) sur la cover, lue sur visibility, dans CommunityCard + carte à rejoindre. Typecheck web OK, vérifié en local (« Test SPOK » isPublic=true/PRIVATE → « Privée »). Doc SPOK CommunitiesListPage MAJ (to_validate). NON COMMITÉ
- Suite : pastille renommée `ui/VisibilityPill` (entity community/space, inheritedFrom) ; vignettes d'espace de CommunityPage = visibilité effective résolue côté client (propre → parent → communauté), pointillé si héritée. Vérifié en local (community-test). Doc SPOK CommunityPage MAJ. NON COMMITÉ
- En-tête de CommunityPage : globe/cadenas sur isPublic remplacé par VisibilityPill (visibility). Vérifié local (« Test SPOK » → Privée). Pastille héritée : « · hérité » dans le libellé. MEP 2026-10-11

### Upload avatar/couverture communauté : 403 en prod — 2026-10-11
- Cause : uploads (user/space/community avatar+cover) en fetch direct sans header X-Admin-Mode → admin non OWNER refusé (le PATCH passait via fetchApi). Pas de refresh 401 non plus
- Fait : api.ts → helper `uploadFile` via fetchApi (Content-Type JSON non posé pour FormData). Typecheck web OK. Non vérifié en navigateur (upload). MEP 2026-10-11

### Sidebar : visibilité des communautés + communautés privées visibles par des non-membres — 2026-10-11
- Cause : GET /communities filtrait les « publiques » sur isPublic (déprécié) ; « Campagne ShadowWorld » (prod) a isPublic=true + visibility=PRIVATE → visible dans la sidebar et accessible (GET /:id, /:id/members faisaient `isPublic || visibility`). Création admin posait isPublic sans visibility
- Fait : communities.ts filtre/contrôle sur visibility seul ; admin create renseigne visibility ; type shared Community.visibility ; CommunityBadge (globe/œil/cadenas, nom grisé non membre, « Invitation », bouclier admin) dans la sidebar et l'en-tête immersif ; script lecture seule `scripts/check-community-visibility.ts` (local : « Test SPOK » incohérente). businessRules + doc SPOK Barre latérale MAJ (to_validate)
- Tests 46/46 communities (+4, 1 réaligné) ; typecheck web/api OK ; vérifié en local (icônes, infobulles, 0 erreur console ; cas non membre non visualisable avec le seul compte admin). NON COMMITÉ
- Reste : diagnostic prod + resync données (sur accord) ; même `isPublic ||` dans graph.ts, items.ts, spaces.ts, admin/users.ts, search.ts (hors périmètre, signalé)

### Recherche : portée par défaut = espace/communauté courant — 2026-10-11
- Signalé : filtres de /search incohérents. Diagnostic : choix communauté écrasé (2 setSearchParams successifs, react-router v6), filtres items sans effet sur les autres sections, utilisateurs jamais filtrés, espace sans sous-espaces, tags texte libre, pagination commune
- Validé : `lib/searchScope.ts` (bandeau + grille mobile → ?spaceId= / ?communityId= selon le pathname), SearchPage : ligne « Recherche dans : » + « Toute la communauté » / « Partout », `updateParams` (fix communauté), communauté déduite de l'espace ; API /search/advanced : spaceId = sous-arbre, utilisateurs filtrés par portée
- Tests : 11/11 search API (+3), 4/4 searchScope ; typecheck web/api OK ; vérifié en local (espace parent → items du sous-espace, élargissement, changement de communauté, depuis page communauté). Doc SPOK SearchPage MAJ (to_validate). NON COMMITÉ
- Revue sécu : filtre communauté révélait les membres d'une communauté privée → membres listés seulement si admin / membre / communauté publique non privée (+1 test, 12/12)

### Séances : invités (accès à la séance seule) — 2026-10-11
- Plan `docs/superpowers/plans/2026-10-11-live-session-invitees.md` exécuté inline (tâches 1-6), commits LOCAUX non poussés (8f5fdd2, d5b1269, d4378c1, d776426, 5b310c1, 5b68618 + doc/correctif). Modèle LiveSessionInvite (createdMembership), utils/liveInvites.ts, routes invite-candidates / invitees, section « Invités » de « Préparer la séance », panneau « Invités » du bandeau
- Vérifié en local (admin + Alice ajoutée à la communauté « Un JDR ») : invitation depuis le bandeau → notification, séance dans « séances en cours », éléments de la séance OK, éléments du parent 404 ; retrait → 404/403. Correctif : message « déjà accès » faux quand tous les candidats sont invités
- Constat hors périmètre : GET /spaces/:id expose la fiche d'un espace PRIVÉ aux membres de la communauté (TODO)

### Modale item : bouton « Copier la fiche » — 2026-10-11
- Validé (« copie seule ») : bouton ClipboardCopy dans le pied de page de ItemEditModal (après PDF), copie HTML + Markdown via `lib/itemClipboard.ts` (champs renseignés seulement, relations avec titre lié, convertisseur HTML→Markdown maison sans dépendance). Impression/PDF non touchés (pas de refactor commun, contrairement au plan initial). 8 tests OK, typecheck web OK, vérifié en local (contenu copié + état ✓). Doc SPOK créée (cmv3r2qp10005odabh9ujduyd). Commit local ab6a8b4 (non poussé)

### Fix 404 console GET /live-sessions/by-space sur chaque espace — 2026-10-11
- Cause : by-space répondait 404 pour tout espace non-séance (appelé par SpacePage sur chaque espace). Désormais 200 null (403 inchangé si non membre) ; front `getBySpace` → `LiveSessionState | null`, LiveSessionHost vide la séance active si null. +1 test API, +1 test web, typecheck api/web OK. Les 7 tests « invités » de live-sessions.test.ts échouent (chantier invitations en cours, sans lien). Commité dans d4378c1 (embarqué par le commit d'une autre session, laissé tel quel — accord Thomas). NON POUSSÉ

### Fix 403 upload avatar/cover communauté en mode admin — 2026-10-11
- Cause : routes POST/DELETE `/communities/:id/avatar|cover` exigeaient OWNER sans bypass admin (contrairement à PATCH /:id). Helper `getCommunityForImageEdit` dans communities.ts (OWNER ou admin en mode admin). Typecheck API OK. Commit local 0683134 (non poussé). Même problème probable sur spaces.ts (non traité)

### Séances : préparation initiale à la création — 2026-10-11
- Thomas : « tout prendre en compte ici » (travail de l'autre session repris). Point de sauvegarde, commits LOCAUX non poussés : 668dac6 (bouton « séances en cours » de l'autre session), 524c363 (bandeau toolbar + renommage Préparation) — build + typecheck 5 paquets OK, 797/797 tests avant commit
- Validé (C puis B, « ok ») : « Nouvelle séance » → `NewSessionDialog` « Préparer la séance » (premier niveau de l'espace parent, ordre position, tout coché, « avec ses N sous-éléments » activé par défaut, Tout cocher/décocher). API POST /live-sessions : champ `agenda` facultatif, éléments de l'espace parent uniquement (400 sinon, validé AVANT toute écriture — pas de transaction, écart au plan car le mock Prisma de transaction fournit un client séparé), sous-éléments directs après leur parent, createMany. `components/live/initialAgenda.ts` (logique pure)
- Tests : +3 API (47/47), +4 initialAgenda, +2 NewSessionDialog. Typecheck web OK. Vérifié en vrai (local, espace « Mon scénario ») : séance créée PREPARED, préparation Scène 2 / Scène 1 / Indice A / Indice B. businessRules + doc SPOK MAJ. NON COMMITÉ
- Nouvelle demande (à cadrer) : invités d'une séance sans accès à l'espace parent, désignés éventuellement à la création — noté [À REVOIR] dans la doc SPOK

### Bandeau de séance dans la toolbar + « Programme » → « Préparation » — 2026-10-11
- Demande Thomas (« oui ») : LiveSessionBar passé en 3e ligne de SpaceToolbar via `liveSessionBarSlot` (SpacePage), plus rien entre la toolbar et la vue ; bouton « Programme (n) » du bandeau renommé « Préparation (n) » (LiveSessionBar.tsx — fichier aussi modifié par une autre session, seul le libellé + en-tête touchés). Puis « partout » (Thomas) : libellés (fenêtre en direct, menu « Ajouter à la préparation de … », AddChildrenDialog, AgendaPanel, messages d'erreur API), businessRules, commentaires et intitulés de tests (web, api, shared). Seul l'identifiant technique `agenda` reste. Incident : script perl a double-encodé l'UTF-8 inséré → réparé (octets C3 83 C2 xx → C3 xx), plus aucun « Ã »
- Typecheck web + api OK, 72 tests séances OK. Vérifié sur un espace de séance local : 3 lignes dans la zone `toolbar`. Skill spok-menu + doc SPOK LiveSession MAJ. NON COMMITÉ

### Séances live : bouton « séances en cours » dans l'en-tête — 2026-10-11
- Validé (« ok ») : route GET /live-sessions/ongoing (membre du parent ou de la séance, en direct d'abord), LiveSessionsButton à côté de la cloche (masqué si aucune, badge, rouge si direct, liste en portail, Ouvrir/Rejoindre → séance active), refresh 30 s + invalidations (création, rejoindre, suite, start/end, événements started/ended). API 44/44, web 46/46, typecheck OK. NON COMMITÉ

### Import en masse vues Images + Documents, réduction d'image — 2026-10-11
- Plan validé (« oui ») : `lib/uploadRules.ts` (source unique web des règles : formats image, 5 Mo, extensions interdites, 25 Mo — ImageUploadZone/FileUploadZone n'ont plus de copie), `lib/imageResize.ts` (1920 px WebP dans le navigateur avant contrôle des 5 Mo, jamais les GIF ; aussi branché dans ImageUploadZone → modale, avatar, couverture), `lib/bulkUpload.ts` (orchestration, 3 en parallèle, suppression de l'item si envoi KO), `hooks/useBulkUpload.ts`, `components/ui/BulkUploadButton.tsx` (bouton + dépôt sur la vue + bandeau). Branché ImagesView et DocumentsView (canEdit)
- +22 tests (uploadRules, imageResize, bulkUpload). Typecheck web OK. Vérifié en vrai (navigateur intégré, dev d'une autre session) : boutons présents dans les 2 vues ; réduction 4000×3000 31 Mo → 1920×1440 WebP 1,37 Mo ; dépôt de 3 fichiers → BMP refusé avant envoi, 2 items créés puis supprimés car R2 non configuré en local (compteur 4→4), bilan affiché. Envoi R2 réel NON testé (pas de R2 en local)
- businessRules : `bulk-upload-images-documents`, `image-resize-before-upload`. Doc SPOK Images / Documents MAJ (to_validate). MEP 2026-10-11 (fc37006 MCP, c3c12ad import) — typecheck 5 paquets OK, 792/792 tests

### Import Shadow World (md → SPOK prod via MCP) — FAIT 2026-10-11
- 7 espaces, 188 items (dont 40 GBK `cmv2yi0ll00hihrilzzlrthfr`). Thomas a créé pendant l'import un espace parent « Import » (`cmv2yct2j00bqhrilfsj98y5n`) et y a rangé 6 des 7 espaces — GBK pas encore rangé. Visibilité PRIVATE envoyée par PATCH sans erreur, non relue (list_spaces affiche « ? »). Markdown affiché brut (MCP texte → <p>)
- Demande Thomas (« go ») : importer les 7 .md de `C:\Users\Admin\OneDrive\Documents\_JDR\SHADOW WORLD` (racine seulement) dans la communauté prod `cmv2rzgrj0001zm5epbrme4la` (« Campagne ShadowWorld », PUBLIQUE) : 1 espace PRIVÉ par fichier (nom = titre `#`), chaque `##` = item NOTE (description = texte de la section, ordre du fichier), chaque `###` = enfant du `##` précédent, texte avant le 1er `##` = item « Introduction ». ~188 items. Espaces PRIVÉS impératif (03 contient « SECRETS MJ »)
- Découpe : `python -I apps/api/scripts/tmp_split_md_sections.py "<dossier>" <scratchpad>/sw` → par fichier index.json + NN.txt
- Débloqué (MCP relancé par Thomas). FAIT (espaces PRIVÉS) : 02 `cmv2xrt350006hrilfnu67s04` (9), 03 `cmv2xtn01001bhrilfjsxgt3z` (28), 06 `cmv2xxy3n004jhrilq5wd8gzl` (10), 07 `cmv2y3gc7005rhrilnd66aww9` (8), Anto-9 `cmv2y5ccu006rhriljv5n4cw2` (57), cahier `cmv2yf5zx00dehrilsijaqevo` (36). Reste : campagne-shadow-world-v02
- Bloqué (résolu) : MCP `create_space` → 400 (`type` requis, jamais envoyé) + `visibility` ignorée par POST /spaces (absente du schéma → espace visible dans une communauté publique). Fix MCP (`apps/mcp/src/index.ts` : type GROUP + PATCH visibilité après création), build OK. NON COMMITÉ. Thomas redémarre Claude pour charger le MCP corrigé. RIEN n'a encore été créé dans SPOK
- Hors périmètre à signaler : API POST /spaces devrait accepter `visibility` ; MCP `create_item` envoie la description en texte brut (markdown affiché tel quel)

### Séances de présentation live — étapes 1 et 2 — 2026-10-10
- Retour Thomas : nouvel espace de séance absent de la sidebar → invalidation ['sidebar-spaces'] (ParentSessionsButton, LiveSessionBar suite). Typecheck web OK. NON COMMITÉ
- CI verte (run 38046739848) → prod déployée. Adaptation mobile LiveWindow (plein écran < 768px, Voir l'espace / Retour au direct) — 571f586
- 2026-10-10 soir (« ok ») : 5 points de la revue sécurité corrigés, NON COMMITÉS — suppression en cascade refusée si descendant verrouillé (non-OWNER) ; programme filtré pour les participants (visibleAgenda + liveHub.broadcastEach, refetch sur roles) ; enfants limités à l'espace de séance (loadState, sessionCopy) ; restauration d'audit admin limitée au rangement sur copie verrouillée ; /suite revérifie isParentMember. API 113/113 ciblés, web 43/43, typecheck API + web OK. MEP 2026-10-10 : 537494d (sécurité), 571f586 (mobile) — typecheck 5 paquets OK, 770/770 tests
- MEP 2026-10-10 : 3cbd457 (Tâches colonne Assigné, autre session), 3b87228 (séances live), 67bd850 (bouton Nouvel espace, autre session) — typecheck 5 paquets OK, 758/758 tests. Prochain : adaptation mobile (validée)
- Conception validée en chat (Thomas), plan `docs/superpowers/plans/2026-10-10-live-sessions-socle.md` validé (« cela a l'air ok »), exécution inline sur master. Ledger : `.superpowers/sdd/2026-10-10-live-sessions-socle/progress.md`
- FAIT : schéma (db push local OK), verrou API itemLock (items, uploads, convert, merge/absorb, cascade-shift, bulk-move), liveHub, sessionCopy (+R2 copy), routes /live-sessions, client SSE + useLiveSession, LiveWindow, bandeau/fil/panneau présentateur, bouton Séances, intégration SpacePage + ItemEditModal. Tests ciblés verts, typecheck web OK
- Débloqué (dev lancé par une autre session Claude arrêté avec l'accord de Thomas) : generate + typecheck API OK. Retour Thomas : fenêtre restait après Terminer → masquée hors LIVE
- Étape 2 validée (« oui » conception, « ok » plan) + demandes en cours : pas de spoil des sous-items (révélation progressive), copie rangée sous la copie du parent d'origine. FAIT : schéma PREPARED + LiveSessionAgendaItem, routes start/agenda/pending-children/reveal, store séance active, LiveSessionHost (App.tsx), AgendaPanel, PendingChildren, actions « Séance » (menu + modale). Tests ciblés verts, typecheck API + web OK. Vérif UI par Thomas en attente. NON COMMITÉ
- Demande Thomas (« ok ») : ajout au programme d'un élément avec sous-éléments → question « Élément seul / Avec ses N sous-éléments » (route source-children, option includeChildren, AddChildrenDialog via LiveSessionHost). Tests 29/29 API, 15/15 web, typecheck OK
- Retour Thomas (capture) : « À révéler » visible des présentateurs → réservé à l'animateur (API pending-children/reveal = host seul, UI). 30/30 API, typecheck OK
- Concurrence : une seule séance en cours par espace (409 + bouton « Ouvrir la séance en cours »), noms uniques, libellés d'actions nommant la séance. Suite (option B, « ok ») : LiveSession.previousSessionId @unique (db push local avec --accept-data-loss, avertissement d'unicité sur colonne neuve), route /:id/suite, cloneSessionCopies, bouton « Créer la suite » + liens. 38/38 API, typecheck API + web OK. NON COMMITÉ

### Page communauté : bouton « Nouvel espace » — 2026-10-10
- Signalé Thomas : aucun moyen de créer un espace depuis /communities/:id (seulement Réglages OWNER ou Tableau de bord). Plan validé (« ok »)
- FAIT : CommunityPage — bouton à côté de « Espaces (N) » (OWNER/MEMBER ou mode admin, = règle API), formulaire nom + « Espace parent » (demande Thomas : créer aussi les sous-espaces ici ; bouton dans la vue Aperçu abandonné), ouvre l'espace créé. Typecheck web OK. Doc SPOK Page communauté MAJ. NON COMMITÉ

### Icône PWA restée ancienne — 2026-10-10
- Test Thomas : réinstallée sur mobile, toujours l'ancienne icône. Prod vérifiée : `icon-192.png` servi = celui du dépôt (réseau gris, avril) ; l'ancien = atome de mars. Cause : nginx `immutable` 1 an sur tous les .png sans empreinte
- Plan validé (« oui ») : icônes → `*.v2.png` (manifest, index.html, sw.js précache, `CACHE_NAME` spok-v5) + nginx immutable limité à `^~ /assets/`, autres images en `no-cache`. `nginx -t` OK + en-têtes vérifiés en conteneur jetable ; nouvelles URL servies en dev. Doc SPOK « Service worker PWA » MAJ. MEP 2026-10-10 (47f0cff) — en attente de la confirmation de Thomas sur le téléphone

### Responsive / mobile — 2026-10-10
- Plan validé (Thomas « ok », zoom mobile inclus). FAIT : HomeView (grille aperçus + en-tête carte min-w-0/truncate + libellé raccourcis), mindmap-layout (pas portails min(40°, 360°/N) + rayon ≥ 240px d'arc ; `SPACE_NODE_ID` exporté), MindMapView (`initialFit` : mobile < 768px, zoom < 0,6 → setCenter nœud espace à 0,6 ; branché premier rendu + onInit), Layout row 1 (bloc titre flex-1 min-w-0, spacer retiré, communauté du fil d'Ariane tronquée). Typecheck web OK. Doc SPOK MAJ (Accueil, En-tête, Carte mentale). Typecheck 5 paquets + 672/672 tests OK. MEP 2026-10-10 (1a9dc90, 188e529, 5cd6b20)
- Validé par Thomas sur téléphone en prod (accueil, carte mentale CMDB, header) — 2026-10-10
- Icône PWA : versionnement v2 + nginx (47f0cff, autre session) validé par Thomas sur téléphone. Chantier responsive clos

### Page Tâches : colonne Assigné — 2026-09-29
- Choix Thomas (« oui ») : vraie colonne Assigné triable au lieu de l'œil barré à côté du titre. API `/user/tasks` : sortBy `assignedToName` → `orderBy { assignedTo: { name } }` (+1 test ; `nulls` écarté car User.name obligatoire). Web : colonne desktop (grille 7 colonnes) avec œil barré à côté du nom, pastille assigné sur mobile. Doc SPOK Tâches MAJ. Typecheck web/api OK
- Non vérifié à l'exécution : Docker Desktop arrêté (pas de base locale) — tri par assigné même forme que le tri par espace existant. NON COMMITÉ

### Accusé de lecture à l'assignation — FAIT — 2026-09-29
- Conception validée (Thomas) : modale + vue Membres + colonne Assigné de /tasks (œil barré si pas vu) ; règles : vu = ItemView de l'assigné après assignedAt ; réassignation = repart de zéro ; auto-assignation / désassignation / assignations antérieures = pas d'indicateur (option A, pas de reprise)
- FAIT : schéma `Item.assignedAt/assignedById` (db push local + generate + build:packages) ; `apps/api/src/utils/assignment.ts` (+6 tests) ; écritures branchées : création + PATCH (items.ts), fusion (item-merge : garde la date d'origine), restauration audit (admin/auditLogs.ts) ; lectures : liste items, fiche item, /user/tasks renvoient `assignmentReceipt`. Types : shared `AssignmentReceipt` + `Item.assignedAt/assignedById/assignmentReceipt`, web `GlobalTask.assignmentReceipt`. Typecheck api OK, 60 tests api OK
- Web : `lib/assignmentReceipt.ts` (+4 tests) ; modale sous « Assigné à » (seulement pour l'assigné enregistré) ; œil barré sur les cartes MembersKanbanView ; page Tâches : PAS de colonne Assigné (écart à la conception annoncée, doc SPOK corrigée) → œil barré à côté du titre avec infobulle « Pas encore vu par X » ; règle businessRules `assignment-read-receipt` ; doc SPOK (Assigné à, Membres, Tâches, modèle Item)
- MEP 2026-09-29 (a2eb5d9 accusé, e2fdbbe chemin critique) — build + typecheck 5 packages OK, 671/671 tests verts — schéma additif (start-api.sh fait db push)

### Chemin critique Gantt/PERT : CPM standard — 2026-09-28
- Signalé en creusant les types de relation : Gantt = tout item daté participait (isolé → critique) ; Gantt ET PERT = fin de chaîne LF = son propre EF → toute fin de chaîne / chaîne courte critique
- Fix `timeline-utils` (seuls les items reliés par une relation d'ordre participent) + `timeline-utils` et `pert-utils` (LF d'une fin de chaîne = fin du projet = EF max). +4 tests (rouges avant fix). Tests existants inchangés et verts. Typecheck web OK. Doc SPOK Gantt MAJ. MEP 2026-09-29 (e2fdbbe)

### Ménage TODO — section « Serveur MCP » close — 2026-09-28
- 6 questions de conception obsolètes remplacées par les réponses de fait (serveur séparé `apps/mcp`, 44 outils, auth par compte + JWT, pas de ressources). MEP 2026-09-29

### Types de relation : source unique + conversion des types hors liste (option B) — 2026-09-28
- `constants/relationTypes.ts` (+4 tests) remplace 9 tables locales (ItemEditModal ×3, RelationTooltip, timeline-constants, flèches Gantt, mindmap-utils, mindmap-layout, PertView ×3, PertToolbar, RelationsMapView). Ordonnancement unique `isOrderingRelation` = blocks + implements : Gantt CPM aligné sur le PERT (+3 tests, dont implements qui ordonne désormais), PERT ne fait plus ordonner `relates` en sens inverse (reste de `depends`), Entraîne affiché (centre à centre) et filtrable, carte des relations : 4 types visibles par défaut
- API `z.enum(RELATION_TYPES)` création/modif (+5 tests 400), MCP enum (description suggérait DEPENDS_ON), seed sans types hors liste, règle businessRules `relation-types-single-source`
- Comportement préexistant noté, non modifié : chemin critique Gantt — tout item terminal isolé ressort critique (LF = son propre EF)
- Script `migrate-relation-types.ts` : local appliqué (2 `tests` → relates). Prod : 18 `depends` + 13 `depends_on` (créés via le MCP). Le classifieur auto-mode a bloqué Claude (Production Reads / Modify Shared Resources) → Thomas a complété la ligne `depends_on` et lancé `--prod --apply` : 31 converties en `blocks` inversé, 0 fusion ; revérif à blanc : aucune relation hors liste
- MEP 2026-09-28 (069d869) — typecheck 5 packages OK, 657/657 tests verts (3 tests items.test.ts passés de RELATED/DEPENDS_ON à des types officiels). Script de migration non commité (en attente de la ligne depends_on par Thomas)

### RelationTooltip aligné sur RELATION_TYPES — 2026-09-28
- Bloque / Permet / Entraîne / Lié à, couleurs des badges ItemEditModal ; `depends` retiré (type inconnu = nom brut). En-tête corrigé (utilisé aussi par graphe, carte des relations, arêtes MindMap). Base locale : aucun `depends`, 2 `tests` (seed). Typecheck web OK. NON COMMITÉ
- Hors périmètre → TODO : source unique des types de relation (`depends` encore dans CPM Gantt, PERT, MindMap, RelationsMapView dont le filtre par défaut masque Permet/Entraîne ; API sans enum). Doc SPOK « Dépendances » MAJ

### Focus des modales — étape 1 : focus visible global — 2026-09-28
- Constat : `Modal.tsx` ne gère aucun focus (ni initial, ni piège Tab, ni restauration) ; focus par défaut hétérogène (titre même sur item existant, recherche, nom… ; confirmations : aucun) ; focus quasi invisible (`focus:outline-none` partout, pas de style global)
- Règle proposée (6 points, en attente de validation Thomas) : création → titre ; item existant → la modale (pas le titre) ; recherche → champ recherche ; confirmation destructive → Annuler ; non destructive → action principale ; `Modal.tsx` : piège Tab + restauration du focus
- Fait (demande Thomas) : `index.css` — contour 2px `--ring` offset 2px sur `:focus-visible` (boutons, liens, champs, contenteditable, tabindex), hors layer + !important. MEP 2026-09-28 (3dd9da7)
- Étape 2 (règle validée « go ») : `hooks/useDialogFocus.ts` (+6 tests jsdom : data-autofocus, panneau, autoFocus respecté, rotation Tab, pile, restauration) branché dans `Modal.tsx` (16 modales) + 10 modales maison (script) + 8 dialogues relation/portail (Item, Gantt, PERT, MindMap). Cibles : titre seulement si item sans titre ; Annuler sur suppressions/Unsaved/AuditRestore/StatusManager ; action sur Cascade/StatusPropagation ; ConfirmModal selon confirmVariant. Skill spok-menu + doc SPOK « Focus des modales » créés. MEP 2026-09-28 (3dd9da7) — typecheck 5 packages OK, 644/644 tests verts

### Fix faux conflit à l'enregistrement d'un item Image / Document / Diagramme — 2026-09-28
- Signalé par Thomas (création d'item + image, puis diagrammes). Cause : les écritures directes de la modale (upload image/document, auto-save XML diagramme à 2 s, « Enregistrer et fermer » draw.io) font avancer `updatedAt` serveur sans relire la fiche (non-invalidation volontaire, antérieure à `mergeFormWithServer`) → Enregistrer envoie l'ancien `updatedAt` + type/titre modifiés → 409 à chaque fois
- Revue des autres écritures : contributions et relations invalident déjà la fiche ; favori / lu-non lu ne touchent pas l'item ; Lien et autres types : pas d'écriture directe
- Fix `ItemEditModal` : `refreshItem()` (fiche + liste) après les 4 écritures, y compris si l'upload du PNG échoue ; commentaire obsolète + en-tête corrigés. Typecheck web OK. Doc SPOK « Enregistrer » MAJ. MEP 2026-09-28 (8fe8c8e)

### Boutons « Nouveau » bleu vif + « Enregistrer » orange — 2026-09-28
- Demande Thomas : bouton Nouveau des vues en couleur flashy (bleu choisi) ; en cours de route : Enregistrer de la modale item en orange
- `components/ui/NewItemButton.tsx` (bg-blue-600, source unique) remplace les 19 copies `bg-secondary` des en-têtes de vue (script) ; `ViewToolbar.tsx` (inutilisé) non touché ; imports `Plus` morts retirés (MindMap, Timeline). `ItemEditModal` : Enregistrer en `bg-orange-500 hover:bg-orange-600` (twMerge écrase bg-primary)
- Skill spok-menu (standard du bouton) + doc SPOK (Vues, Enregistrer) mis à jour. Typecheck web OK. MEP 2026-09-28 (3209561, 8fe8c8e)
- Suite (signalé par Thomas) : barre d'en-tête de vue invisible dans l'inspecteur dev → `data-devzone="contenu-barre-vue"` sur les 31 `#view-header` (19 vues + SpacePage), couleur dans ZONE_COLORS. Skill spok-menu + doc SPOK outils dev MAJ. MEP 2026-09-28 (3209561)

### MCP SPOK — 3e cause : token expiré vu comme anonyme — 2026-09-28
- Symptôme : 15 min après le login, `list_spaces` vide, 404 sur les espaces privés, `search_items` vide — sans erreur. Cause : access token 15 min, routes `optionalAuthenticate` → requête traitée en anonyme (pas de 401 → pas de re-login)
- Fix `apps/mcp/src/client.ts` : re-login avant l'`exp` du JWT (marge 60 s). Build OK ; effectif au prochain redémarrage de Claude. MEP 2026-09-28 (4db5fb2)
- Rattrapage doc SPOK (tout depuis le 11/07, 73 commits feat/fix) : FAIT via MCP, tout en `to_validate` — ~35 items mis à jour, 17 créés (Items, Espaces, Communautés, Structure, Modales, Pages utilisateur/publiques, Admin, Système, Modèle de données, Autres fonctionnalités). Sources : journal + businessRules.ts + code
- Signalé dans la doc : item « Sélecteur de vue » (Structure) = doublon probable de « Bandeau de navigation [GlobalNavBar] » ; divergence RelationTooltip (type `depends` hors RELATION_TYPES) ; Activité : sourdine à compléter par Thomas


### MCP SPOK 401 — 2e cause : parsing du .env dans launch.mjs — 2026-09-28
- Le mot de passe prod (mis à jour par Thomas dans le `.env` racine) contient `"` et `'` ; `launch.mjs` lisait les valeurs avec `[^"']*` → tronqué au 1er guillemet (2 caractères lus sur 16) → 401
- Fix : valeur brute après le 1er `=`, guillemets retirés seulement s'ils entourent toute la valeur. Vérifié localement sans afficher le secret : 16 caractères lus, e-mail OK. Mémoire project_mcp_prod mise à jour
- Vérifié après redémarrage de Claude : `search_items` répond sans 401
- MEP 2026-09-28 (93c6545)

### « Marquer comme non lu » (items + notifications) — 2026-09-28
- Demande Thomas (option A ; B « accusé de lecture » noté au TODO, limité à l'assignation). Constat : `ItemView` déjà exploitée (activity, clignotement, badge Nouveau) — entrée TODO close
- Schéma : `ItemView.markedUnread Boolean @default(false)` (db push local ; en prod, start-api.sh fait `prisma db push`, colonne additive). API : `POST /activity/items/:id/unread`, `…/view` efface la marque, feed `/activity` inclut les items marqués quels que soient âge/auteur/mute/espace (accès : membre de la communauté ou de l'espace), espaces perso → pseudo-groupe `__personal__` ; liste items : marqué → `viewedAt: null` (clignote) ; `PATCH /notifications/:id/unread`. +7 tests API
- Web : `lib/queryClient.ts` (client extrait de main.tsx pour rafraîchir le cache hors composant), `markItemUnread` dans itemMenuGroups (action « Marquer comme non lu », groupe Ouvrir → toutes les vues sans câblage), bouton dans la modale (ferme la modale), action dans la cloche sur les notifications lues, ActivityPage : titre simple pour le groupe perso. Écart au design : pas d'action dans la page Activité (tout y est déjà non lu). Règle `mark-unread`
- Vérifié au dev : menu Gantt → marque en base + clignotement → présent dans Activité (5→6) → ouverture efface la marque ; modale d'un item perso → groupe « Espaces personnels » sans lien ; cloche lu → non lu (badge 1) → relu. États restaurés. Typecheck api+web OK
- MEP 2026-09-28 (2963b42) — build packages + typecheck 5 packages OK, 638/638 tests verts

### Modes — étape 3/4 : modale Forum toujours réduite + résumé — 2026-09-28
- Choix Thomas (brainstorming) : périmètre modale seule ; Forum = toujours réduite avec résumé (option A) ; Projet inchangé
- `buildForumSummary` (item-edit-helpers, +4 tests) : type (hors Note/Non défini) · statut · priorité (PRIORITIES) · période (une seule date si même jour) ou « dès » · échéance · assigné · N liens. `ItemEditModal` : effet de dépliage auto supprimé, ligne de résumé cliquable (→ déplie) sous l'en-tête en Forum replié. Règle `forum-modal-reduced-with-summary`
- Vérifié au dev (Test SPOK, Forum) : Réunion hebdo S8 réduite avec « Réunion · Terminé · 22 avr. 2026 », clic → complète ; Note vierge sans résumé ; bascule Projet → complète, pas de toggle. Typecheck web OK
- MCP SPOK 401 : doc « modes d'interface » non mise à jour
- MEP 2026-09-28 (321de3c) — typecheck 5 packages OK, 631/631 tests verts

### Priorités inversées dans DeadlinesView et DeleteConfirmModal — 2026-09-28
- TODO « DeadlinesView ne filtre pas la priorité » : le filtre fonctionne (Urgente = 4 → 0 item, conforme à la base). La vraie divergence : tables de libellés locales à l'échelle inversée (1 = Critique) dans `DeadlinesView` et `DeleteConfirmModal`, alors que la référence `PRIORITIES` est 4 = Urgente … 1 = Basse → badges contredisant le filtre ; la capture de Thomas affichait « Haute » pour une priorité 2 (Normale)
- Fix : les deux fichiers lisent `PRIORITIES` (libellé + couleurs). Règle `priority-scale-single-source` dans businessRules
- Vérifié au dev : dashboard filtré « Haute » → 2 items (= base), badges « Haute » ; confirmation de suppression d'« Amélioration des vues » → « Normale » (annulée). Typecheck web OK
- MEP 2026-09-28 (418ed50) — typecheck 5 packages OK, 631/631 tests verts

### Gantt : déplacement de barre au jour près dans tous les zooms — 2026-09-28
- Option A retenue par Thomas. `handleDragMove` : type `move` → `addDays(initialDate, round(rawDays))`, plus de snap calendaire (lundi en trimestre, 1er du mois en année, pas de 90 j en multi-années). Resize start/end inchangé
- Vérifié au dev en zoom année (4 px/j) : glisser de 20 px sur OWASP → 12→17 juil. (+5 j, heure conservée), fin « aujourd'hui » → +5 j. Item restauré. Typecheck web OK
- MEP 2026-09-28 (6c8474b) — typecheck 5 packages OK, 631/631 tests verts

### Modèle : nom vide après lien direct + accord du libellé — 2026-09-28
- `SaveAsTemplateModal` : effet sur `isOpen` qui pré-remplit le nom avec le titre courant et vide la description à chaque ouverture (l'initialiseur `useState` tournait au montage, avant chargement d'`allItems`). Libellé « 1 élément sera capturé » / « N éléments seront capturés »
- Vérifié au dev par lien direct + reload : feuille « Amélioration des vues » (nom OK, singulier), parent « Capture écran — Dashboard V2 » (nom OK, « 9 éléments seront capturés »). Typecheck web OK
- MEP 2026-09-28 (ddd4fb2) — typecheck 5 packages OK, 631/631 tests verts

### « Absorber les enfants » seulement si l'item a des enfants — 2026-09-28
- `hasChildItems` (itemMenuGroups.ts, +3 tests : `childCount` de la liste API ou `children` des vues en arbre ; paramètre `object` car `childCount` absent du type partagé Item). Appliqué comme le motif « Éclater » aux 13 appels `buildItemMenuGroups` (Documents, Images, Liens, Kanban, Liste, Planning, Priorité, Types, Membres, Fil, Texte, TreeItemRow, carte mentale). Modale : bouton si `allItems` contient un enfant. Règle businessRules `absorb-children-only-if-children`
- Vérifié au dev : menu Gantt du parent « Capture écran — Dashboard V2 » (7 enfants) propose l'action, menu de la feuille « Amélioration des vues » non ; modale idem. Typecheck web OK
- MEP 2026-09-28 (8d2b626) — typecheck 5 packages OK, 631/631 tests verts

### Fix modale item périmée après modif dans une vue / absorption — 2026-09-28
- Signalé par Thomas : la modale ignore les changements faits dans les vues (date Gantt, statut MindMap) et n'affiche pas la description après absorption, jusqu'au rechargement
- Cause double : (1) fiche `['item', spaceId, id]` jamais invalidée par les mutations des vues + staleTime global 5 min → pas de refetch ; (2) même rechargée (absorption l'invalide), le formulaire ne se recopiait que si id/dates changeaient (initKey) → description/statut/titre figés. Risque associé : « Enregistrer » sur une fiche périmée renvoyait les anciennes valeurs par-dessus la modif de la vue
- Fix `ItemEditModal` : `staleTime: 0` + `refetchOnMount: 'always'` sur la fiche ; resynchro sur `updatedAt` avec fusion champ par champ (`mergeFormWithServer` + `tagKey` dans item-edit-helpers, +4 tests) — un champ modifié par l'utilisateur garde sa saisie
- Vérifié au dev : échéance posée au Gantt visible à la réouverture sans reload ; absorption → description compilée visible sans reload ; saisie du titre conservée après ajout d'un commentaire. Items de test créés/supprimés via l'API locale. Typecheck web OK
- Remarqué : « Absorber les enfants » est proposé sans condition (modale + menus), même sans enfant → erreur serveur (TODO)
- MEP 2026-09-28 (fb47579) — typecheck 5 packages OK, 624/624 tests verts

### Fix MindMap : actions des nœuds périmées (suppression « croit avoir encore ses enfants ») — 2026-09-28
- Signalé par Thomas en live dans la carte mentale (« Amélioration des vues » : enfants déplacés dans un autre item, la confirmation annonçait 3 descendants). Diagnostic dans son onglet : liste `['items','space-dev','all']` à jour (0 enfant) → le compte venait d'un `handleDelete` périmé
- Cause : les nœuds MindMap stockent leurs callbacks (onDelete, onMerge, onConvertToSpace, onMoveToSpace…) dans `data` à la construction ; depuis le layout incrémental (15/07) les nœuds existants ne sont plus reconstruits (`...n.data`) → handlers capturant une ancienne liste d'items
- Fix : `withCurrentCallbacks` (mindmap-layout, +4 tests) + effet sur `layoutCallbacks` dans MindMapView qui remplace les callbacks dans les data des nœuds existants (ni positions, ni arêtes, ni relayout)
- Vérifié au dev (items TEST via API locale, supprimés ensuite) : carte chargée, enfants déplacés P→Q via la modale, onDelete du nœud P rafraîchi, confirmation sans descendants ; arêtes Q→enfants correctes, plus d'arête depuis P. Typecheck web OK
- MEP 2026-09-28 (d1cd6dc) — typecheck 5 packages OK, 624/624 tests verts

### Connexion : mémoriser le dernier e-mail — 2026-09-28
- Demande Thomas (ne se souvient jamais du login local). `LoginPage.tsx` : e-mail stocké en localStorage (`spok_last_login_email`) dans `onSuccess` uniquement, pré-rempli + autoFocus sur le mot de passe ; `autoComplete="username"` / `"current-password"`. Règle `login-remember-last-email` dans businessRules
- Vérifié au dev : après l'auto-login dev puis déconnexion, /login affiche admin@spok.app, focus mot de passe. Typecheck web OK
- MEP 2026-09-28 (7a9e875) — typecheck 5 packages OK, 624/624 tests verts

### MCP SPOK — suite après redémarrage — 2026-09-28
- Après redémarrage de Claude, le process MCP est bien `launch.mjs` (nouvelle config OK), aucune variable SPOK_* parasite dans l'environnement Windows, mais toujours 401 → le `SPOK_PASSWORD` du `.env` racine n'est pas le bon mot de passe prod de superztarr@gmail.com. À corriger par Thomas (puis redémarrer Claude)

### Gantt : décaler un parent sans dates (barre pointillée) — 2026-09-28
- Demande Thomas : pas de « main » sur un item sans dates mais avec enfants. Option A retenue : glisser la barre pointillée = décaler ses enfants (et liés « Entraîne »), le parent reste sans dates
- `TimelineView` : `handleBodyMouseDown(e, id, derivedRange)` (dates initiales = période dérivée), flag `anchorWithoutDates` dans `dragging`/`pendingCascade`, `handleDragEnd` → toujours la modale (jamais `onUpdateDates` sur l'ancre, ni à l'application ni à l'annulation), barre pointillée avec zone de prise `cursor-grab` + clic = ouvrir l'item. `CascadeShiftConfirmModal` : prop `anchorWithoutDates` (titre « Décaler le groupe ? », enfants cochés par défaut, « Annuler »/« Décaler », bouton désactivé si rien de coché). 2 règles businessRules (barre sans fin, parent sans dates)
- Vérifié au dev (« Déconnexion aléatoire après 30 minutes », 3 enfants) : modale correcte, « Décaler » → 3 enfants +9 j (start/end/due), parent NULL ; « Annuler » → rien. Données restaurées. Typecheck web OK
- Faux négatif pendant les tests expliqué : en zoom trimestre, snap au 1er du mois → petit glisser = delta 0 (ajouté au TODO)
- MEP 2026-09-28 (acfeb0f fix barre sans fin, fdb9873 parent sans dates) — typecheck 5 packages OK, 616/616 tests verts

### Fix Gantt : barre qui « disparaît » au glisser — 2026-09-28
- Signalé par Thomas pendant la MEP échéance. Cause (préexistante, drag 'move' du 13/09) : item avec début sans fin = barre dessinée jusqu'à aujourd'hui, mais le déplacement prenait fin = début + delta → barre d'1 jour près du début (ex. OWASP : start=end=31 juil.), hors période visible
- Décision Thomas (option A) : la barre se déplace telle qu'affichée, une date de fin est enregistrée. `moveInitialEnd` (timeline-utils, +5 tests : fin existante / sans fin → maintenant / début futur → début / échéance seule / aucune date) branché dans `handleBodyMouseDown`
- Vérifié au dev (séquence souris simulée en plusieurs mousemove, le glisser natif de l'outil ne déclenche pas le drag) : OWASP 12 juil.→aujourd'hui devient 31 juil.→17 oct., barre visible pendant et après. Item restauré. Typecheck web OK
- Noté : en zoom trimestre, le déplacement est aimanté au 1er du mois (40px ≈ +19 j) — comportement de snap existant, non modifié
- MEP 2026-09-28 (acfeb0f)

### Gantt : échéance au clic droit, déplaçable et supprimable — 2026-09-28
- Demande Thomas : ajout rapide d'échéance par clic droit (option A : jour sous le curseur, sans menu), puis complément en cours de design : pouvoir la déplacer et la supprimer aisément
- `lib/timelineDueDate.ts` (+8 tests) : `dayAtLaneX`, `dueDateForDay` (heure existante conservée, sinon midi local). `TimelineView` : prop `onUpdateDueDate(id, iso|null)`, clic droit sur la zone chronologique, losange interactif (zone 16px, glisser seuil 4px avec aperçu, clic droit = suppression). `SpacePage` branché sur `handleInlineUpdate`. Écart au plan : `useSpaceActions` étendu (`dueDate` dans le type + mise à jour optimiste, sinon le losange revenait en arrière pendant la requête). Règle `gantt-due-date-gestures` dans businessRules
- Vérifié au dev (item « Implémenter JWT », restauré à l'identique ensuite) : clic droit → 2 oct 12:00 en base ; glisser → 6 oct 12:00 ; clic droit losange → NULL, start/end intacts ; zoom mois → 15 oct 12:00. Aucune erreur console. Typecheck web OK
- MCP SPOK toujours 401 : Claude pas encore redémarré (ancien process `dist/index.js` du 27/09 11:55)
- MEP 2026-09-28 (c6af7e0) — typecheck 5 packages OK, 611/611 tests verts

### Fix MCP SPOK 401 — 2026-09-27
- Cause : `apps/mcp/src/client.ts` chargeait `apps/mcp/.env` (copie d'avril, mot de passe d'avant la rotation 2026-07-11) en écrasant les variables déjà définies → 401 quelle que soit la config. Config active (`~/.claude.json`) = ancienne entrée locale `dist/index.js` + mot de passe en clair ; l'entrée `launch.mjs` était dans `~/.claude/settings.local.json`, non lu pour les MCP
- Fix : client.ts n'écrase plus une variable déjà set (dist recompilé) ; entrée user remplacée via `claude mcp add spok -s user -- node .../launch.mjs` (plus de mot de passe en clair) ; entrée morte retirée de settings.local.json ; mémoire project_mcp_prod réécrite
- Suppression de `apps/mcp/.env` refusée par le classifieur auto-mode → à faire par Thomas (plus bloquant après le fix)
- MEP 2026-09-27 (9c5cb31). Reste : redémarrage de Claude par Thomas, puis test `search_items` ; si 401 → mot de passe du .env racine à mettre à jour (Thomas)

### Fix barre de défilement horizontale dans ItemEditModal — 2026-09-27
- Cause (préexistante) : contributions non lues surlignées en `px-2 -mx-2`, la marge négative dépassait de 4px à droite du conteneur scrollable (`pr-1`) et était rognée de 8px à gauche. N'apparaissait que sur les items avec contributions non lues
- Fix : `px-2` sur toutes les contributions, fond bleu seul conditionnel. Vérifié (Réunion hebdo S8) : scrollWidth = clientWidth (603), surlignage entier. Typecheck web OK
- MEP 2026-09-27

### Fix clés React dupliquées dans ItemEditModal — 2026-09-27
- Reproduit sur tous les items (pas seulement ceux avec enfants) : la clé dupliquée = id de l'item ouvert. Inspection des fibers React → aucun élément DOM de la modale ne la porte → composants sans DOM : `SaveAsTemplateModal` + `InsertTemplateModal` frères avec `key={itemId}` (ajout du 12/09). Pas de boucle de rendu (0 warning en 5 s au repos), un warning par rendu
- Fix : clés `save-tpl-${itemId}` / `insert-tpl-${itemId}`. Vérifié : 0 warning au chargement et à la saisie, reset de la modale de modèle d'un item à l'autre OK (nom = titre de l'enfant). Typecheck web OK
- Découvert, non corrigé (TODO) : nom de modèle vide si item ouvert par lien direct après reload (`useState` initialisé avant chargement de `allItems`)
- MEP 2026-09-27

### Bascule manuelle du mode d'interface (boutons Forum/Projet/Tous) — 2026-09-27
- Demande Thomas : pouvoir switcher de mode dans l'interface générale via des boutons d'option. Revient sur la décision 2026-07-15 (sélecteur retiré, mode 100 % dérivé du contexte). Option A retenue : contexte = défaut, surcharge manuelle tenue tant qu'on reste dans la même communauté, non persistée. Exploration non proposé (réservé)
- `stores/interfaceMode.ts` : `contextMode` + `applyContextMode` (Layout seul) / `chooseMode` (boutons). `Layout.tsx` : boutons à la place du badge de contexte (hidden sm:flex), effet de dérivation keyé sur la paire communauté+contexte avec ref du dernier appliqué + garde d'état transitoire. `businessRules.ts` : règle `interface-mode-context-override`
- Bug trouvé en vérifiant : changer d'espace dans la même communauté effaçait le choix (currentSpace vide pendant le chargement → communauté nulle → contexte réappliqué). Corrigé par la garde `communityResolving` + ref
- Vérifié au dev (Test SPOK, FORUM) : Forum par défaut → Projet → espaces Dev/Backend gardent Projet → accueil = Tous → retour dans la communauté = Forum ; GlobalNavBar suit (Forum masque Tableau de bord/Tâches…, Tous affiche tout). Typecheck web OK
- MCP SPOK toujours 401 : doc non mise à jour
- MEP 2026-09-27 (e4a9661) — typecheck 5 packages OK, 603/603 tests verts

### Modale Forum : description à hauteur adaptée, contributions visibles — 2026-09-26
- Demande Thomas : en mode Forum, la description (80vh fixe) masquait les contributions. Option A retenue : hauteur adaptée au contenu (240px min, plafond puis scroll interne)
- `RichTextEditor` : prop `fillHeight` supprimée (seul usage = ItemEditModal), `defaultMaxHeight` accepte `number | string`. `ItemEditModal` : `defaultMaxHeight="40vh"` en Forum replié (55vh prévu initialement, abaissé après mesure : sur 768px de haut les contributions restaient 20px sous le bord)
- Vérifié au dev (Réunion hebdo S8, 2 contributions, viewport 768px) : éditeur plafonné à 307px, « Contributions (2) » visible sans scroll. Typecheck web OK
- MCP SPOK toujours 401 : item de doc modale Forum non mis à jour
- MEP 2026-09-27 (3553c56)

### Cascade "Entraîne" étendue aux enfants (parent/enfant) — 2026-09-19
- Demande Thomas : pouvoir décaler un item et entraîner ses enfants, en plus de la relation "Entraîne" existante. Clarifié par échange : le drag du corps de barre (déjà en prod) fonctionne bien ("non, je viens de tester, c'est bien") ; le vrai besoin est de proposer le décalage des enfants **dans la modale de confirmation**, pas une cascade parent/enfant automatique/silencieuse — la hiérarchie reste structurelle, décision initiale confirmée
- **Backend** : `utils/itemDescendants.ts` (BFS parentId, même pattern que `drivesGraph.ts`). `item-cascade-shift.ts` revalide désormais `drivesReachable ∪ descendantIds` (un dependentId confirmé peut être un enfant OU un lié "Entraîne"). Tests réécrits avec un mock `item.findMany` basé sur `where` (parentId vs id) plutôt que sur l'ordre d'appel — nécessaire car `getDescendantIds` utilise le même modèle Prisma que la récupération finale
- **Frontend** : `computeCascadeDescendants` dans `cascadeShift.ts` (réutilise `getDescendantIds` déjà existant dans `item-edit-helpers.ts` pour ItemEditModal). `CascadeShiftConfirmModal` : nouvelle section séparée avec case à cocher "Décaler aussi les N enfants" (décochée par défaut, liste avant/après dépliable), indépendante de la section "Entraîne" existante. Câblé dans `ItemEditModal` (sauvegarde) et `TimelineView` (drag du corps de barre)
- Vérifié au dev sur données réelles (pas des items de test dédiés cette fois) : "Refonte authentification" (Projet, 5 enfants dont 1 daté) — décalage +7j via la modale d'édition affiche bien "Décaler aussi les 1 enfant", coché affiche l'aperçu ("OAuth2 Google/GitHub 10→17 sept"), confirmé et persisté (vérifié après reload complet). Le drag direct sur le Gantt n'a pas pu être re-testé de façon fiable via l'automatisation du navigateur (le geste simulé sélectionne le texte au lieu de déclencher le mousedown custom) — méchanisme déjà validé manuellement lors du build initial (Task 16), code partagé donc pas de risque de régression spécifique
- Données de test réelles modifiées puis restaurées à l'identique (dates de "Refonte authentification" et "OAuth2 Google/GitHub")
- Typecheck web+api OK, 603/603 tests verts (dont 4 nouveaux tests backend `itemDescendants`/`item-cascade-shift`, 5 nouveaux tests frontend `computeCascadeDescendants`)
- Reste : contrôle Thomas, puis commit et MEP sur demande

### Déplacement en cascade des items liés — relation "Entraîne" (drives) — 2026-09-13
- Demande Thomas : reprise du chantier TODO "Groupes d'items liés par la date". Brainstorming → le parent/enfant reste purement structurel (rejeté comme base de cascade en cours de route) → nouveau type de relation `drives` ("Entraîne", sens unique ancre→dépendants, écart jamais stocké, chaîne transitive, détection de cycle). Spec `docs/superpowers/specs/2026-09-13-cascade-date-relation-design.md`, plan `docs/superpowers/plans/2026-09-13-cascade-date-relation.md` (17 tâches), exécution inline
- **Backend** : `utils/dateShift.ts` (extrait de `item-bulk.ts`), `utils/drivesGraph.ts` (BFS reachability, cycle+cascade), cycle détecté à la création d'une relation `drives` (`item-relations.ts`), nouvel endpoint `POST /items/:id/cascade-shift` (`item-cascade-shift.ts`) — revalide côté serveur la reachability + l'accès en écriture par espace (relations cross-space). Pas de `$transaction` (mock de test du projet incompatible avec le style callback — cf. note "Écart assumé" dans le plan), même pattern que `bulk-duplicate`. 424/424 tests api verts
- **Frontend** : `lib/cascadeShift.ts` (parcours transitif client, diamants dédupliqués), `CascadeShiftConfirmModal`, type `drives` ajouté aux 4 endroits où les relations existent déjà (ItemEditModal, PertView, TimelineView, MindMapView — périmètre élargi en cours de route après découverte que Timeline/MindMap ont leur propre UI de relation, validé avec Thomas). `TimelineView` : nouveau drag de déplacement du corps de barre (distinct des poignées de resize), seuil clic/drag 4px
- **2 bugs découverts et corrigés en vérifiant manuellement au dev** (hors périmètre initial du plan, validés avec Thomas) : (1) `cascadeShiftMutation` n'invalidait que la liste `['items', spaceId]`, pas la requête individuelle `['item', spaceId, dependentId]` de chaque dépendant — un dépendant rouvert restait stale sans reload complet ; fix par `predicate` (le dépendant peut être dans un autre espace, cross-space). (2) `ItemEditModal.tsx:327` — `initKey` de l'effet de synchronisation des champs ignorait `dueDate` (seuls startDate/endDate présents) : rouvrir la modale d'un item dont seule l'échéance a changé affichait l'ancienne valeur. Bug préexistant, révélé par la cascade sur les items dueDate-only (TASK)
- Vérifié en réel au dev (2 items TEST créés puis supprimés) : cascade via ItemEditModal (modale de confirmation, delta correct, dépendant décalé) ET via drag Gantt (+8j, même flux) ; clic simple sur le corps de barre ouvre toujours la modale (pas de régression) ; poignées de resize inchangées (pas de cascade proposée)
- Typecheck 5 packages OK, 591/591 tests verts

### Règles fonctionnelles dans la modale de cascade + badges dev sur toutes les modales — 2026-09-14
- Demande Thomas : ajouter dans `CascadeShiftConfirmModal` une explication des règles métier sous chaque bouton (à destination de l'utilisateur final, pas juste dev) — fait : phrase sous "Non, seul" (le lien reste actif) et sous "Oui, déplacer" (couvre toute la chaîne transitive)
- Demande Thomas (suite) : afficher le nom de chaque modale en mode dev, sur **toutes** les modales — extension de `DevZoneInspector`/`useDevMode()` existant. Scope validé en 2 temps : d'abord les 16 fichiers basés sur le composant partagé `Modal.tsx` (nouvelle prop `devName`, badge dans le header), puis la quinzaine de modales maison (overlay `fixed inset-0` fait main) avec un nouveau composant partagé `ui/DevModalBadge.tsx` posé manuellement dans chaque en-tête : `CascadeShiftConfirmModal`, `DuplicateToSpaceModal`, `MoveToSpaceModal`, `SaveAsTemplateModal`, `InsertTemplateModal`, `WelcomeModal`, `UnsavedChangesGuard`, `PickTasksModal`, `CalendarFeedsModal`, `CommunityListView` (création), `StatusManager` (confirmation), `AuditLogDetail`, les 2 lightbox images (`ImagesView`, `ImageUploadZone`), et les modales de relation dupliquées dans `ItemEditModal`/`TimelineView`/`PertView`/`MindMapView` (create + edit, 8 emplacements)
- Exclu volontairement : le backdrop mobile de la sidebar dans `Layout.tsx` (pas une modale au sens fonctionnel, déjà couvert par la zone `sidebar` de `DevZoneInspector`)
- Vérifié au dev (mode dev ON/OFF via localStorage) : badge visible/masqué correctement sur `ItemEditModal`, `DeleteConfirmModal`, `DuplicateToSpaceModal`
- Typecheck web OK, 167/167 tests web verts
- Reste : contrôle Thomas, puis commit (par étape logique, pas un seul gros commit) et MEP sur demande

### Duplication répétée avec décalage de dates — 2026-09-12
- Demande Thomas : étendre `DuplicateToSpaceModal` (nombre d'itérations + décalage jour/semaine/mois/an + inclure ou non les enfants, ce dernier déjà existant)
- Backend `item-bulk.ts` : `iterations` (1-365, défaut 1) + `offsetUnit` optionnel dans le schéma. Boucle sur les itérations (copie 1 = +0, copie 2 = +1 unité, etc. — confirmé avec Thomas). `shiftDate()` calendaire (pas une approximation en jours fixes) : bug trouvé et corrigé pendant l'implémentation — `setMonth` seul fait déborder "31 jan +1 mois" sur le 3 mars au lieu de clamper au 28 fév ; fixé avec `setFullYear(y, m, jour clampé)` atomique. Fix au passage : `startDate`/`endDate` n'étaient pas copiés du tout par la duplication (seul `dueDate` l'était) — corrigé, prérequis direct du décalage
- Aucun test n'existait sur `item-bulk.ts` — nouveau fichier complet (7 tests : régression 1x, fix startDate/endDate, décalage cumulatif x3, arrondi calendaire fin de mois, item sans date, validation iterations>365)
- Web : `itemsApi.bulkDuplicate` + UI (input itérations, chips jour/semaine/mois/an affichées si N>1, libellé bouton "Dupliquer ×N", reset à la fermeture)
- Vérifié en conditions réelles au dev : item daté (12 sept 2026) dupliqué ×3 semaine → copies à 12/19/26 sept exactement
- Typecheck 5 packages OK, 561/561 tests verts, check-doc-headers OK
- Reste : contrôle Thomas, puis MEP sur demande

### Modèles de structures d'items (Item Templates) — 2026-09-12
- Demande Thomas : pouvoir créer une "grappe" (ex. Réunion + tâches de prep/ODJ/CR) réutilisable, dans un espace déjà existant (pas seulement à la création d'espace comme `SPACE_TEMPLATES` actuel). Décisions brainstorming : B (définissable par l'utilisateur, pas figé dans le code), D (portée globale, partagé avec tout le monde pour le moment). Dates/décalages relatifs et lien permanent "déplacer toute la grappe" → hors périmètre, ajoutés au TODO séparément
- Brainstorming → design (résumé chat, pas de fichier spec par préférence Thomas du 25/07) → plan écrit `docs/superpowers/plans/2026-09-12-item-templates.md` → exécution inline, 13 tâches TDD
- **Backend** : modèle Prisma `ItemTemplate` (portée globale, `structure: Json` = arbre récursif titre+type). Helper `apps/api/src/utils/itemTree.ts` (`createItemTree`) extrait de la logique déjà existante dans `spaces.ts` (création d'items depuis `SPACE_TEMPLATES`, DRY). Routes `item-templates.ts` (GET liste/POST création/DELETE créateur-only) + `POST /spaces/:id/items/from-template` dans `items.ts` (crée toute l'arborescence en une fois). 27 tests ajoutés, 394/394 api verts
- **Web** : types partagés `ItemTemplate`/`ItemTemplateNode`, client `itemTemplatesApi`, helpers `buildItemTemplateStructure`/`countTemplateNodes` (4 tests), modales `SaveAsTemplateModal` (capture item+descendants) et `InsertTemplateModal` (picker + recherche + sélecteur de parent + suppression créateur-only). Branché : `ItemEditModal` (boutons "Enregistrer comme modèle" LayoutTemplate / "Ajouter une structure" ListTree dans la barre d'actions) + `SpaceToolbar` (bouton "Insérer un modèle", un seul rendu dans `SpacePage` — pas 20 comme supposé en planification, corrigé à l'exécution)
- Bug trouvé et corrigé en vérifiant manuellement : `SaveAsTemplateModal`/`InsertTemplateModal` restaient montés d'un item à l'autre dans `ItemEditModal`, leur `useState` (nom pré-rempli / parent par défaut) ne se réinitialisait qu'au premier montage → `key={itemId}` sur les deux (même pattern que `RichTextEditor` dans le même fichier)
- Vérifié au dev via network/DB (pas seulement l'UI, cf. bug ci-dessous) : capture "Refonte authentification" (Projet + 5 tâches) → POST /item-templates avec la structure exacte ; insertion → POST /spaces/.../items/from-template crée bien les 6 items liés (racine + 5 enfants), visibles dans la liste, comptage 30→36
- **Découverte séparée, hors périmètre** (ajoutée au TODO) : `ItemEditModal` boucle en re-render continu (warning React "two children with the same key" en rafale) sur les items dont les enfants ont des ids dupliqués côté cache — rend l'observation UI peu fiable pendant les tests, mais n'affecte pas les données (vérifiées correctes via network/DB). Pas introduit par ce chantier (aucune modif de la logique de fetch/cache items)
- Typecheck api+web OK, check-doc-headers OK (19 fichiers)
- Reste : contrôle Thomas, puis MEP sur demande. Investiguer séparément le bug de clés dupliquées

### Modale item mode Forum : Description pleine largeur/hauteur — 2026-09-07
- Demande Thomas : en mode Forum, la zone Description de `ItemEditModal` doit occuper toute la place dispo. Validé : hauteur 80vh, largeur = grille 2 colonnes
- MCP SPOK toujours 401 — item de doc non consultable ni à mettre à jour
- `RichTextEditor.tsx` : nouveau prop `fillHeight?: string` — si fourni (et pas de resize manuel), conteneur = `height: fillHeight` sans plafond. Priorité : editorHeight > fillHeight > minHeight/maxHeight
- `ItemEditModal.tsx` : blocs media (URL/Diagramme/Image/Fichier) extraits dans const `mediaSection`. Grille = `isForumMode ? [1fr,380px] : [1fr,0.85fr,380px]`. Colonne centrale rendue seulement `!isForumMode`. En Forum : `mediaSection` sous la Description dans la colonne principale + `fillHeight="80vh"` sur le `RichTextEditor` de description. En-têtes MAJ
- Typecheck web OK
- Vérifié par Thomas puis MEP 2026-09-07 (abfd068)

### Fix faux positif hasChanges sur items datés — 2026-09-07
- Signalé par Thomas en testant la modale Forum : guard "quitter sans sauvegarder" se déclenche sans modification
- Root cause (pré-existant, pas lié au chantier Forum) : `hasChanges` comparait le state date (heure locale, `toDatetimeLocal`) à `new Date(item.xxxDate).toISOString().slice(0,16)` (UTC) → mismatch permanent en TZ non-UTC pour tout item ayant startDate/endDate/dueDate. Items sans date OK → « parfois »
- Régression : commit `5c5389c` (31/03) avait corrigé, puis init dates repassée en `toDatetimeLocal` le 17/06 (`01a7a3b0`) sans réaligner `hasChanges`
- 1re passe (`isoOrNull` pleine précision) : insuffisante. Item test `cmoe26n14002xzcddhmyo2szm` (IMAGE) a `startDate=2026-07-12T17:39:05.874Z` → secondes/ms non nulles, alors que `toDatetimeLocal` à l'init tronque à la minute → mismatch persistant
- Fix retenu `ItemEditModal.tsx:590` : `toMinuteISO(d) = new Date(d).toISOString().slice(0,16)` (gère NaN) appliqué aux DEUX côtés (state local tronqué minute + item ISO UTC)
- Typecheck web OK
- Connu, non traité (mineur) : `doSubmit` a la même troncature minute → un save déclenché par un autre champ réécrit `startDate` en perdant les secondes. Self-heal au prochain save
- MEP 2026-09-07 (abfd068) — CI verte, avec le chantier Forum

### Accueil : « Échéances proches » vide alors que le détail en a plein — 2026-09-07
- Root cause : `GET /user/tasks` retombait sur `where.type = 'TASK'` quand aucun `type` n'était passé. HomeView (`HomeView.tsx:241`) appelle sans `type` → ne voyait que les Tâches. Dashboard/DeadlinesView passent les types explicitement → voient tout
- Fix racine (demande Thomas : éviter régressions futures) : `user-tasks.ts` — suppression du défaut TASK. Type filtré uniquement si `type=` fourni avec ≥1 valeur valide, sinon tous types. Commentaires MAJ
- `user-tasks.test.ts` : test `'should default to type=TASK'` → `'ne filtre pas par type sans param'` (`where.type` undefined). 16/16 verts
- `ApiDocPage.tsx:63` : desc MAJ
- Non touché : `useGlobalTaskFilters` garde `defaultTypes:['TASK']` (page /tasks reste « Tâches »). Autres appelants sans type : `PickTasksModal` (voit tous types si contexte agenda sans type — OK)
- Vérifié au dev : « TODO assignés » de l'accueil affiche désormais MEETING/PERIOD/DOCUMENT/CONFIG (avant : Tâches seules) ; « En retard » inclut un item CONFIG. « Échéances proches » reste vide en local (dataset Admin sans échéance à J+7) mais le mécanisme est bon
- Typecheck api+web OK
- MEP 2026-09-07 (a9b0df6) — CI verte

### Modale Forum : toggle « Plus de champs » (option B) — 2026-09-07
- Demande Thomas : en Forum, pouvoir créer des items d'autres types + accéder aux autres champs, mais en affichage optionnel (toggle). Option B validée = tout sous le toggle, y compris Parent + Tags
- `ItemEditModal.tsx` : `forumExpanded` state + `showAll = !isForumMode || forumExpanded`. Bouton « Plus de champs / Moins de champs » (ChevronDown/Up) dans le header, visible seulement en Forum. Tous les `!isForumMode` des sections (Type/Statut/Priorité/Dates/Assigné/Dépendances) → `showAll` ; Parent/Tags/Enfants (avant inconditionnels) → `{showAll && …}`. Grille : `showAll ? 3-col : 1-col`. `fillHeight 80vh` sur description quand `!showAll`. mediaSection sous la description quand `!showAll`, sinon colonne centrale
- Auto-ouverture si l'item porte des données avancées : type ≠ NOTE/UNDEFINED, priorité, dates, assigné, ou relations. **Statut volontairement exclu** (quasi toujours renseigné → sinon ça s'ouvre tout le temps)
- Reset `forumExpanded` à false au changement d'item
- Vérifié au dev (communauté Test SPOK = Forum) : modal réduit = titre + description(80vh) + contributions + ID + toggle ; déplié = modal 3-col complet ; toggle OK dans les 2 sens ; auto-ouverture OK sur item daté / Réunion
- Typecheck web OK, check-doc-headers OK
- MEP 2026-09-07 (55dc5f7) — CI verte

### Dashboard : filtre non appliqué aux répartitions + fenêtres trop étroites — 2026-09-07
- Signalé par Thomas : dans `MyDashboardView` (onglet Tableau de bord), filtre pas appliqué sur tous les panneaux + fenêtres trop petites
- Fix filtre : `doneData` (`MyDashboardView.tsx:~290`) hardcodait type/status/pageSize → ignorait la barre de filtres. Passé en `...filters.queryParams` + `status:'done'` forcé (comme `allData`) ; queryKey inclut `filters.queryParams`. Vérifié au dev : « Par statut »/« Par type » passent de 13 à 0 en filtrant Priorité=Haute (avant : restaient ≥ terminés)
- Réagencement : `flex flex-wrap` scindé en 2 lignes. Ligne B nouvelle = répartitions en `grid sm:grid-cols-2 xl:grid-cols-3` pleine largeur (au lieu de `w-64`). Badge `spaceName` → `max-w-[130px] truncate` ; `SpaceProgressBar` nom → `min-w-[120px]` ; `overflow-x-hidden` sur les 4 listes
- Ligne A, itérations largeur (retours Thomas) : « trop large » puis « 672px = mini, grandir si place dispo ; colonne suivante plus large ». État final : Échéances `flex-[2] min-w-[672px]` (pas de max → absorbe l'espace en trop) ; colonne listes `flex-1 min-w-[320px] max-w-[560px]`. Vérifié au dev 1280/1440/1680 : à 1680 Échéances s'étale et les titres ne tronquent plus, colonne listes à 560 ; à 1280 les deux tiennent côte à côte (troncatures serrées, OK)
- Observé pendant le test (PRÉ-EXISTANT, hors périmètre, NON corrigé) : `DeadlinesView` embarqué n'applique pas le filtre Priorité comme les panneaux `allData` (avec Priorité=Haute : items « Moyenne » encore listés, « 2 en retard » alors que le panneau « En retard » disait « Rien »). Filtrages divergents DeadlinesView ↔ MyDashboardView
- Typecheck web OK
- MEP 2026-09-07 (4360314) — CI verte
- **Reste ouvert (TODO)** : `DeadlinesView` embarqué qui ne filtre pas la priorité comme les autres panneaux — non traité

### Déplacement boutons Déconnexion / Mode admin / Mode dev vers la row 1 du header — 2026-08-31
- Demande Thomas : sortir Déconnexion + Mode admin (puis Mode dev, puis "Retourner à") de la section « Divers » du bandeau (GlobalNavBar) et les placer à gauche de la vignette utilisateur dans la row 1 du header
- MCP SPOK toujours 401 — doc non consultable
- `DevDbStatus.tsx` : `AdminModeToggle` et `DevModeToggle` reçoivent `variant?: 'full' | 'compact'` (défaut `full` → `UserProfileModal` inchangé ; `compact` = h-7 aligné row 1, label `hidden lg:inline`)
- `GlobalNavBar.tsx` : retiré `<AdminModeToggle />`, le bouton "Retourner à" + tout son état (`resumeInfo`/`useEffect spok_resume`/`handleResume`), `handleLogout`, la clé `logout` ajoutée à `EXCLUDED_KEYS`. Imports nettoyés (`useAuthStore`, `authApi`, `useState`/`useEffect`, `LogOut`/`RotateCcw`). « Divers » garde Recherche/Contact/Plan du site
- `Layout.tsx` : `handleLogout` complet (authApi.logout + purge `spok_last_location`/`spok_resume` + `logout()` + `navigate('/')`) + état/effect/handler de reprise déplacés ici ; row 1, avant la vignette, `<div hidden md:flex>` = `[Mode admin][Mode dev][Déconnexion][Retourner à ?]` — mobile inchangé (grille sidebar + modale profil)
- Typecheck web OK, check-doc-headers OK (3 fichiers), en-têtes MAJ
- Vérifié visuellement par Thomas (« très bien »)
- MEP 2026-08-31

### Overlay dev : noms + encadrés colorés des zones du layout — 2026-08-31
- Demande Thomas (en cours de route sur le chantier ci-dessus) : en mode dev, afficher le nom des zones avec un encadrement de couleur par zone, pour se donner un vocabulaire commun. Découpe validée : « on verra si ça suffit » sur un 1er jet à 5 zones
- `DevDbStatus.tsx` : nouveau hook exporté `useDevMode()` (localStorage `spok-dev-mode` + événement `spok:devmode`, même pattern que `useAdminMode`)
- Nouveau `apps/web/src/components/DevZoneStyles.tsx` : monté 1× dans `Layout`, si `useDevMode()` injecte un `<style>` global — `outline: 2px dashed <couleur>` + libellé `::before` = `attr(data-devzone)`. Mode dev OFF → rien monté, attributs inertes. Couleur par zone dans `ZONE_COLORS`
- Attributs `data-devzone` posés sur les éléments réels (aucun wrapper) : premier niveau `sidebar` (`<aside>`), `header` (row 1), `bandeau` (`GlobalNavBar`), `toolbar` (`SpaceToolbar`), `contenu` (`<main>`)
- Approfondissement sidebar (demande Thomas) : sous-zones `sidebar-logo`, `sidebar-guide`, `sidebar-nav` (`<nav>` scrollable), `sidebar-footer`
- Approfondissement `sidebar-nav` : sections internes `sidebar-favoris`, `sidebar-recents`, `sidebar-mes-espaces`, `sidebar-communaute` (racine de `CommunitySection`, répétée), `sidebar-autres-espaces`, `sidebar-arbre` (mode communauté immersif)
- 1re version : libellés opaques permanents en haut de chaque zone → retour Thomas « peu lisible dans certains cas » (masquaient le contenu : Backend API, ADMINISTRATION, ACCUEIL…)
- 2e version (libellé au survol de la zone + légende) : encore rejetée par Thomas
- 3e version : pastilles de couleur au bord droit de chaque zone + infobulle → rejetée (« pas toujours dans le coin », « pas vraiment mieux »)
- 4e version (inspecteur pur : rien en permanence, survol → encadré + nom) : proposée, puis Thomas tranche l'inverse
- Version retenue (`DevZoneInspector.tsx`, renommé depuis `DevZoneStyles.tsx`) : `<style>` global = encadré `outline 1px dashed` permanent sur CHAQUE zone (toutes visibles en continu) + overlay JS `position: fixed` qui, au survol, met en évidence la zone `data-devzone` la plus interne sous le curseur (encadré plein + fond léger) et affiche son nom en badge à son coin haut-droit — un seul nom à la fois (`closest('[data-devzone]')` sur `mousemove`, recalcul rAF sur scroll/resize). Zéro impact layout (aucun `position: relative` injecté)
- Typecheck 5/5 OK, TNR 538/538 OK, check-doc-headers OK (4 fichiers)
- MEP 2026-08-31

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
