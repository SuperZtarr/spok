# /today — une colonne par agenda (design)

Date : 2026-07-18
Statut : validé par Thomas (« on y va »)

## Contexte

Discussion de fond avec Thomas sur la fragmentation de ses tâches entre plusieurs contextes de vie (employeur, client, fils, domestique, divers, perso), chacun avec ses propres fenêtres de faisabilité temporelle. En marge de cette réflexion (non résolue et volontairement mise de côté pour un futur chantier), une demande concrète et bornée a émergé : `/today` fusionne aujourd'hui tous les agendas externes connectés (ICS) et les réunions SPOK dans une seule colonne « Agenda », ce qui rend impossible de distinguer visuellement ses contextes dans la grille horaire.

Ce document ne couvre QUE cette demande bornée (colonnes par agenda). La réflexion plus large sur les horizons temporels, les fenêtres de faisabilité par contexte, et la priorisation cross-contexte reste un sujet ouvert, non spécifié ici.

## Principe

La colonne « Agenda » unique de `DayTimeGrid` (`apps/web/src/components/today/DayTimeGrid.tsx`) éclate en **une colonne par source d'événement**, dans cet ordre de gauche à droite :
1. une colonne par agenda ICS connecté (feed), dans l'ordre où ils apparaissent dans `useCalendarFeeds()` (ordre de création, `orderBy createdAt asc` côté API)
2. une colonne dédiée **« SPOK »** regroupant les réunions créées dans l'app (`source.kind === 'spok'`), tous espaces confondus — toujours en dernière position parmi les colonnes de sources
3. la colonne **Tâches** reste inchangée : unique, partagée, tout à droite de l'ensemble (décision Thomas : « unique pour le moment »)

## Contrôle de visibilité

- Une rangée de pastilles/boutons toggle au-dessus de la grille, dans l'interface principale de `/today` (pas dans la modale « Calendriers externes (ICS) ») — une pastille par agenda + une pour « SPOK », reprenant le nom et la couleur déjà associés à chaque feed (`CalendarFeed.color`)
- Indépendant de la case « activé » de `CalendarFeedsModal` : celle-ci contrôle si l'agenda est récupéré côté serveur (ses événements existent ou non) ; la nouvelle pastille contrôle uniquement si sa colonne s'affiche dans la grille
- État persisté en `localStorage` (clé `spok-today-visible-sources`, JSON `{ [sourceKey]: boolean }` où `sourceKey` est `feed:<feedId>` ou `spok`), par défaut toutes visibles si aucune préférence enregistrée
- Une colonne masquée disparaît complètement (les colonnes visibles se partagent l'espace restant à parts égales, comme aujourd'hui pour Agenda/Tâches)
- Pas de masquage automatique des colonnes vides un jour donné — comportement purement manuel (décision Thomas)

## Comportement aux limites

- Agenda sans aucun événement affiché mais visible : colonne vide, en-tête affiché quand même (cohérent avec « pas de masquage automatique »)
- Suppression d'un feed (`deleteFeed`) : sa colonne disparaît naturellement (plus de `sourceKey` correspondant côté données), l'entrée obsolète dans `localStorage` reste sans effet (ignorée si le feed n'existe plus)
- Nouveau feed ajouté : apparaît par défaut visible (absent de la préférence stockée → traité comme visible)

## Hors périmètre

- Éclatement de la colonne Tâches par contexte (explicitement refusé pour l'instant par Thomas)
- Fenêtres de faisabilité temporelle par contexte, horizons (maintenant/aujourd'hui/semaine/mois), priorisation cross-contexte — sujet de fond distinct, non traité ici
- Réordonnancement manuel des colonnes (ordre = ordre des feeds tel que renvoyé par l'API, pas de drag-and-drop de colonnes)
- Le calendrier « Matthias » cassé côté Outlook (bug externe, hors SPOK) — cf. `docs/TODO.md`, limite connue déjà documentée

## Implémentation (vue d'ensemble)

Fichiers concernés :
- `apps/web/src/components/today/DayTimeGrid.tsx` : remplacer la colonne Agenda unique par un rendu par groupe de `source` (map `sourceKey → events`), largeur dynamique selon le nombre de colonnes visibles
- `apps/web/src/pages/TodayPage.tsx` : nouvelle rangée de toggles au-dessus de la grille, état de visibilité (hook ou state local + localStorage), passé en props à `DayTimeGrid`
- Pas de changement API/backend : `AgendaEvent.source` porte déjà toute l'information nécessaire (`feedId`/`name`/`color` ou `spaceId`/`spaceName`)
