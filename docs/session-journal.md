# Session Journal - SPOK

## Accords permanents

> Les consignes et règles de collaboration sont dans `CLAUDE.md` (projet et global). Ce journal est réservé au contexte de session en cours.

## PRÊT POUR MEP

> Une seule session (« MEP ») commite et pousse (décision Thomas 2026-10-23). Les autres sessions inscrivent ici
> chaque lot terminé : nom, fichiers exacts (lignes concernées pour un fichier partagé), tests faits, non vérifié.
> La session MEP retire le lot une fois poussé.

_(aucun lot en attente)_

## EN COURS

- 2026-11-26 — MEP : 3 lots (éclater / absorber partie par partie, composition des articles sur la page, corbeille du stockage avec table storage_trash créée par le db push du démarrage). 3 annonces datées. Typecheck OK, TNR 3178/3178. APRÈS, sur accord de Thomas : migrate-article-layout.ts --prod ; orphelins anciens à la corbeille (Volumétrie) ; restore-period-statuses.ts --prod toujours en attente.

- 2026-11-26 — Corbeille du stockage (60 jours, restauration, rubrique Stockage de Volumétrie, contenus sauvegardés à la suppression d'espace) : inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-26 — Articles : composition à la souris sur la page, inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-26 — Éclater / Absorber : fenêtre de choix partie par partie, inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-25 — MEP : 6 lots (icône d'application, statut par défaut, aperçu des liens, glisser sous un élément, Composer commun, barres de vue compactes). Micro-correction MEP : la garde typeRegistry.guard refusait defaultStatus écrit en dur → typeRegistry.ts ajouté aux sources de statuts, appliesToValues de item-default-status dérivé du registre. 4 annonces datées. Typecheck OK, TNR 3135/3136 puis garde 5/5 et lib 337/337 après correction. Restauration des statuts des périodes en prod toujours en attente (railway login).

- 2026-11-25 — FAIT (accord explicite de Thomas, tunnel `railway connect Postgres --tunnel-only`) : `restore-period-statuses.ts --prod --apply` → 31 périodes ont retrouvé leur statut (22 done, 7 in_progress, 1 todo, 1 scheduled) ; 6 laissées (3 devenues tâches, 2 statut déjà posé, 1 supprimée). Vérifié par un second passage à blanc : 0 à remettre.

- 2026-11-25 — Barres de vue (icônes seules puis défilement) : inscrit PRÊT POUR MEP, NON COMMITÉ.
- 2026-11-25 — « Composer » commun Article / Process : inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-25 — Glisser dans les arborescences : correctif appliqué, inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-25 — MEP : CI rouge sur 1289bf4 (item-contents.ts importait utils/linkPreview.js non commité : début du travail « aperçu des liens » d'une autre session, embarqué avec le lot coordonnées). Corrigé par 9d74fbc puis fd49a04 (bouton « Actualiser l'aperçu » et son rappel d'aide) : aperçu des liens retiré des commits, CI verte, laissé intact dans le dossier. Ce travail reste à inscrire par sa session ; api.ts garde une méthode preview inutilisée.

- 2026-11-25 — MEP : 3 commits du 2026-11-21 poussés (CI verte), puis 10 lots dont coordonnées (enum ItemContentKind + PHONE/EMAIL/ADDRESS, colonne item_contents.value, db push). 5 annonces datées. Typecheck OK, TNR 3107/3109 (item-contents et NewSessionDialog instables sous charge, 30/30 seuls). APRÈS : restore-period-statuses.ts --prod sur accord de Thomas. CLI Railway déconnecté : déploiements non surveillés.

- 2026-11-25 — Coordonnées terminées (zone Contenus, aide, doc) ; inscrites PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-21 — MEP : 3 lots (contenus déplacer et restauration, panneau « À ajouter » de l'article, titre du canevas Process). Laissés hors MEP (travail en cours d'une autre session) : item-question.ts, defaultReferentiels.ts, itemMenuGroups.nextStatus.test.ts, skill spok-triage. Vérifié sur une copie exacte des commits. 2 annonces datées.

- 2026-11-21 — Glisser dans les arborescences (`cmwqiehge00357iccoco9r4ut`) : cause trouvée (position avant/dedans/après calculée dans onDragOver de dnd-kit, déclenché seulement au changement de ligne → figée à l'entrée), NON CORRIGÉ : création du hook partagé refusée par les permissions, modifications de SpacePage annulées.

- 2026-11-21 — Article : panneau « À ajouter » modèle Process (ElementTray partagé) : inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-21 — MEP : Process = élément de type PROCESS. Poussé SANS sauvegarde des anciennes tables process_nodes / process_lanes (décision de Thomas, supprimées au démarrage de l'API). CLI Railway déconnecté : déploiement non surveillé par la session. Typecheck OK, TNR 3051/3051.

- 2026-11-21 — Process devenu un élément de type PROCESS (plusieurs par espace, éléments de tous espaces, Question en losange) : inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — MEP : Loupe, taille selon l'importance dans l'espace, ajustée à l'écran. 2 annonces datées. Typecheck OK, TNR 3073/3073.

- 2026-11-20 — Loupe : facteur d'écran unique + poids relatif à l'espace ; doc, aide, spec à jour ; inscrit PRÊT POUR MEP sur demande de Thomas, NON COMMITÉ.

- 2026-11-20 — Migration prod des périodes (accord de Thomas) : sauvegarde backups/manual-prod-period-statuses-2026-11-20T12-29-03-337Z.json (39), 37 statuts vidés, bilan final sans conversion. Tunnel fermé.

- 2026-11-20 — MEP : 5 lots (Gantt échelle en boutons, période sans statut, onglets du Kanban, menu ⋮ statut suivant, poids des vignettes de la Loupe). 4 annonces datées. Typecheck OK, TNR 3063/3063. APRÈS : migrate-type-statuses --prod pour les périodes, sur accord de Thomas.

- 2026-11-20 — Loupe : priorité et éléments d'un article ajoutés au poids des vignettes ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — Menu ⋮ statut suivant : lot complet, spec SPOK à jour ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — MEP : annonce item-secrets datée (clé SECRETS_ENCRYPTION_KEY posée en prod par Thomas). Typecheck OK, TNR 3051/3051.

- 2026-11-20 — MEP : Gantt « Tout le projet », données sécurisées (table item_secrets), vignettes carte et grande (jusqu'à 08f490f) ; poussé d'abord sans la clé. Point mineur : longueur du tag GCM non imposée au déchiffrement. TNR 3051/3051.

- 2026-11-20 — Données sécurisées : clé posée en prod (SUCCESS) et en local, annonce datée ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — Vignettes carte/grande : toutes les infos renseignées, tout type ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — Données sécurisées : lot complet (API, MCP, fiche, aide, spec), revue sécu + 2 corrections ; inscrit PRÊT POUR MEP, NON COMMITÉ. Clé Railway à poser par Thomas.

- 2026-11-20 — Loupe : clic sur la vignette figée ouvre la fiche, double-clic retiré ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — Séances : tous les droits en mode admin (`cmwo6tyxv001n11vfcxqsp08c`), inscrit PRÊT POUR MEP, NON COMMITÉ.
- 2026-11-20 — Loupe : vignettes agrandies selon contenus/enfants/relations (`cmwo4wjp8000s11vfi9so7z4u`), inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-20 — Bug `cmwo4ul6g000m11vfblgfia8t` (6 favoris « sans parent », Mon Administration) : pas d'orphelin, ce sont 6 éléments
  à la racine (5 anciens Liens importés de favoris + « Impots »), migration correcte. Libellé du groupe corrigé, inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-19 — Tableau de bord : zone Échéances vide (filtres du tableau de bord sans myTasks, tri priorité) corrigée, inscrite PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-19 — Fiche élément (signalements du 19/11) : réorganisation couverte par les autres signalements (Thomas),
  priorité déjà résolue ; 3 changements livrés, inscrits PRÊT POUR MEP, NON COMMITÉS.
- 2026-11-19 — Header admin responsive, ligne Administration, plan du site 2 colonnes : 3 lots inscrits PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — Revue des specs avec Thomas, toutes passées en done après correction : sélecteur de vues, mode d'interface, registre des vues, comportement général de SpacePage, skill spok-dev. Reste en to_validate : spec du bandeau (renommage du jour).
- 2026-11-18 — Bandeau : section « Tout SPOK », 4 pages globales renommées (libellés via menuLabel), store dashboardTab supprimé ; spec bandeau en to_validate ; inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — Export : choix et ordre des champs (CSV/Excel/PDF données, mémorisé par espace) inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — Tableau de bord : couleurs « Par statut » inscrites PRÊT POUR MEP, NON COMMITÉ. « TODO assignés » de l'accueil (confirmé par Thomas) inscrit aussi.
- 2026-11-19 — Accueil : « TODO assignés » vide après MEP 043cbe89 + critères des aperçus (plan validé par Thomas) : un lot, inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — Profil : onglet Communautés, Accès Claude dans Compte, aide par fonction ; inscrit PRÊT POUR MEP,
  NON COMMITÉ. Lot à part possible : 4 listes locales du profil (rôles, rôles de communauté, types et canaux de
  notification) à brancher sur des registres shared.
- 2026-11-18 — Recherche : « voir la suite » d'une catégorie (bouton, 10 sur N, retour aux catégories) inscrit PRÊT
  POUR MEP, NON COMMITÉ. Lot à part proposé : registre shared des catégories de recherche (3 copies : SearchPage,
  routes/search.ts, ITEM_FILTER_SECTIONS).

- 2026-11-18 — Fiche : correctif « élément d'article transformé en article » inscrit PRÊT POUR MEP, NON COMMITÉ.
- 2026-11-18 — Article : mise en page des éléments illustrés (galerie, image à côté) inscrite PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — Tags : sélecteur de la fiche en 3 colonnes par portée (sections par espace parent), aide + spec à jour.
  Inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-18 — MCP : lot « tags lus et list_relations » inscrit PRÊT POUR MEP, NON COMMITÉ. Hors lot : GET item
  renvoie les relations vers des espaces illisibles (titres), contrairement à /links — à traiter si Thomas le veut.

- 2026-11-15 — MindMap : dépôt sous un élément d'un autre espace (branche déplacée puis rattachée, confirmation si
  relations coupées). Inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-13 — Menu des vues (session menu des vues) : tous les lots poussés (A, B, C, vue gardée, référentiels centralisés,
  favoris réglés par Thomas, ViewSelectorBar supprimé). Reste ouvert : bandeau global (Sunburst, Carte mentale, Graphe global,
  Liens) à renommer — à décider avec Thomas ; specs SPOK en to_validate à valider par Thomas.

- 2026-11-13 — Fiche élément : réorganisation en 4 lots (spec `cmwec7lnh00038jdrd6tjgug8`). Les 4 lots (pied, en-tête, deux colonnes, panneau compact) inscrits PRÊT POUR MEP, NON COMMITÉS.

- 2026-11-13 — Tags, données prod (tunnel ouvert par Thomas, port 25499, accord explicite) : `migrate-space-tags --prod --restore --apply` → 10 tags rendus à leur espace, 463 recréés, 121 liens, 55 sautés (supprimés depuis). ERREUR du script : il a aussi rendu à leur espace 7 tags que Thomas avait rendus globaux depuis le 11/11 (Amélioration, Documentation, Evolution, idée, Personnel, Professionnel, Technique) → remis en global (accord Thomas). `repair-tag-scope --prod` : 0 lien hors de portée. Bug JDR/mdp passé done. Doublons global / espace possibles (Personnel…) : à fusionner dans /admin/tags si Thomas le souhaite.
- 2026-11-13 — Tags : lot « Vue Tags - champ Nouveau tag » inscrit PRÊT POUR MEP, NON COMMITÉ.

- 2026-11-13 — Références externes : lot « MCP, duplication et fusion » inscrit PRÊT POUR MEP, NON COMMITÉ ; spec SPOK to_validate.

- 2026-11-13 — Tags : lot « Admin tags - liste rangée par portée » inscrit PRÊT POUR MEP, NON COMMITÉ. Lot « Tags d'espace rétablis » poussé (cee48c1f) : scripts prod (migrate-space-tags --restore puis repair-tag-scope) toujours à lancer sur accord de Thomas.

- 2026-11-12 — Tags : lot « Tags d'espace rétablis » codé, inscrit PRÊT POUR MEP, NON COMMITÉ. Specs SPOK (Tags [Tag], Vue Tags, Filtre Tags, Gestion des tags) et les 4 éléments de l'espace bugs en to_validate. Spec de la modale d'édition non touchée (session fiche-element active).
- 2026-11-12 — Vue Assignations (session thème Assignations) : lot « colonnes des noms saisis sans compte » terminé, NON COMMITÉ, inscrit PRÊT POUR MEP. Tâche et spec SPOK passées to_validate.

- 2026-11-12 — Questions (session thème Questions) : lot « modèles de réponse » terminé, NON COMMITÉ, inscrit PRÊT POUR MEP. Point ergonomie (`cmw9emo8n002if3cswdm1st9h`) : à trancher avec Thomas.

- 2026-11-12 — Nouveautés (session thème Nouveautés) : lots 1/2 (vignettes /news) et 2/2 (/admin/news) terminés, NON COMMITÉS, inscrits PRÊT POUR MEP. Éléments SPOK regroupés sous « Nouveautés » `cmwdtua730136dpvm4f8x1tyl`, passés to_validate.

- 2026-11-12 — Fiche élément (session thème fiche) : lots « Enregistrer et quitter », « vote gardé par chaque contribution », « historique de l'élément », « saisie retrouvée » et « références externes » terminés, NON COMMITÉS, inscrits PRÊT POUR MEP (schéma local poussé). Repéré hors lot : croix / Échap / clic à côté ferment la fiche sans confirmation (Modal onClose = closeWithoutSaving).

- 2026-11-12 — Tags (session thème Tags) : diagnostic bug « JDR, mdp » — JDR = tag de GBK Team JDR, mdp = tag de Thomas Perso, bien filtrés par /spaces/:id/tags. Cause probable : éléments portant un tag d'une autre communauté (affiché sur la carte et en colonne de la vue Tags, buildTagColumns). Trous : PATCH /spaces/:id changeant de communauté ne remappe pas les tags des éléments (spaces.ts ~720) ; POST/PATCH items et merge acceptent tout tagId sans contrôle de portée. Données prod non vérifiées (MCP n'affiche pas les tags d'un élément). Question tags d'espace soumise à Thomas.
- 2026-11-11 — Aperçus fichiers, CAUSE TROUVÉE du 0 image : `--prod --check` (tunnel ouvert par Thomas, port 25500) → 10/14 images calculables (6 PDF sans texte, 4 pptx ; 3 xlsx + 1 pptx sans miniature intégrée). `--prod --apply` → R2 refuse chaque envoi « request signature … does not match … Check your secret access key » : **R2_SECRET_ACCESS_KEY du .env racine périmée** (rotation 2026-07-11 ?). Rien écrit. À faire : Thomas recopie R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY depuis Railway (service API → Variables) dans le .env racine, puis relancer `--prod --apply` (tunnel). L'API de prod n'est pas concernée (ses propres variables).
- 2026-11-11 — FAIT : Thomas a recopié R2_SECRET_ACCESS_KEY (Railway → .env racine) ; `--prod --apply` → 10 images créées, 0 échec. Restent sans aperçu 3 xlsx + 1 pptx (pas de miniature intégrée, attendu). Mémoire `reference_r2_credentials.md` créée.

- 2026-11-11 — Rattrapage aperçus fichiers en prod (`backfill-file-previews.ts --prod --apply`, tunnel Railway) : 30 contenus Fichier en prod (pas ~390), 16 extraits créés, **0 image** (même PDF lus), 0 échec de lecture ; restent 14 sans aperçu (6 pdf, 5 pptx, 3 xlsx). Image : erreur avalée dans storeFilePreview (`.catch(() => null)`) — à diagnostiquer.
