# Vue Process — couloirs (flux) — Plan d'implémentation

> Exécution inline (superpowers:executing-plans). Design validé en chat par Thomas le 2026-10-21 (pas de fichier spec).

**Goal :** des couloirs horizontaux empilés, chacun nommé par un item de l'espace, où l'on range visuellement des items ; « Réorganiser » garde chaque item dans son couloir avec des colonnes communes.

**Architecture :** table `process_lanes` (espace, item, position) + `process_nodes.laneId` (nullable, SetNull). Coordonnées d'un nœud **relatives à son couloir** quand laneId est posé, absolues sinon. Géométrie des couloirs (y, hauteur, largeur) calculée côté client (`computeLaneLayout`) à partir des membres : couloirs empilés à partir de y = 0, x = 0, hauteur = max(min, bas du membre le plus bas + marge). Rendu : nœud xyflow de groupe `lane` (parentId des membres).

## Décisions (validées / mes choix)
- Définir comme couloir : menu ⋯ d'un nœud ou bouton du panneau ; l'item n'est plus un nœud (sa ligne process_nodes est supprimée), couloir ajouté en dernier, vide.
- Glisser un nœud : le couloir dont la bande contient le centre du nœud le reçoit ; hors de toute bande → libre.
- Titre du couloir : clic = fiche de l'item ; menu Monter / Descendre / Retirer le couloir. Retirer : membres convertis en coordonnées absolues (restent visuellement en place), couloir supprimé, l'item revient dans « Non placés ».
- Réorganiser : rangs globaux (colonnes communes, x = LANE_HEADER_WIDTH + LANE_PADDING + rang × colonne), rangement par branches à l'intérieur de chaque couloir (prédécesseurs du même groupe seulement), items libres rangés sous le dernier couloir.
- VIEWER : lecture seule ; API couloirs réservée OWNER/MEMBER en écriture.

## Tâches
- [ ] 1. Schéma : `ProcessLane` + `ProcessNode.laneId` ; db push ; mock `processLane` ; MODELE-DONNEES.
- [ ] 2. API (`process-nodes.ts`) : GET nœuds renvoie laneId ; PUT unitaire et groupé acceptent `laneId` (nullable, couloir de l'espace sinon 400) ; routes `/process-lanes` : GET, POST { itemId } (supprime le nœud de l'item), PUT `/order` { ids }, DELETE `/:laneId`. Tests.
- [ ] 3. `process-utils` : `computeLaneLayout`, `findLaneAt`, `layoutAsProcess` avec couloirs. Tests (empilement, hauteur min, appartenance, colonnes communes, libres sous les couloirs).
- [ ] 4. `processApi` + `useProcessNodes` : laneId, couloirs (liste, création, ordre, suppression).
- [ ] 5. `ProcessLaneNode` + `ProcessView` : nœuds de groupe, glisser dedans/dehors, dépôt du panneau et double-clic dans un couloir, menus ; panneau sans les items-couloirs + bouton « Définir comme couloir ».
- [ ] 6. Fiche d'aide, businessRules, spec SPOK, typecheck web/api, tests ciblés ; test à l'usage par Thomas.
