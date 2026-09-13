# Déplacement dans le temps d'un groupe d'items liés — design

**Demande initiale (TODO.md) :** lien permanent entre items (ancre + décalage) : déplacer la date d'un item déplace automatiquement ses items liés (ex. réunion + tâches satellites avant/après).

## Décisions clés

- **Le parent/enfant (`Item.parentId`) reste purement structurel, inchangé.** Il ne gouverne pas cette fonctionnalité. Une première itération de ce design avait proposé de s'appuyer dessus (borner le groupe au sous-arbre) ; rejetée en cours de brainstorming — la notion de "groupe qui bouge ensemble" doit être indépendante de la notion de "parent/enfant" (organisation/rangement), pas confondue avec elle.
- **Nouveau type de relation `ItemRelation`**, aux côtés des types existants (`blocks`, `depends`, `relates`, `implements`, `parent`) : id `drives`, libellé **"Entraîne"**. `fromItem` = l'item important (ancre), `toItem` = le dépendant.
- **Sens unique** : déplacer l'ancre (`fromItem`) entraîne le(s) dépendant(s) (`toItem`). Déplacer un dépendant seul ne fait rien bouger d'autre (pas de rétro-propagation).
- **Écart jamais stocké.** Pas de champ `offsetDays` sur la relation. Le delta appliqué au dépendant est déduit dynamiquement de l'écart de dates actuel entre ancre et dépendant, recalculé à chaque déplacement de l'ancre.
- **Chaînage transitif** : si A `drives` B et B `drives` C, déplacer A déplace aussi C (parcours récursif du graphe des relations `drives` uniquement — les autres types de relation n'entrent pas dans ce parcours).
- **Détection de cycle obligatoire** à la création d'un lien `drives` : refuser si le lien créerait une boucle (A `drives` B `drives` A).

## Champs de date décalés

Un item peut avoir jusqu'à 3 dates indépendantes : `startDate`, `endDate`, `dueDate`.

Quand l'ancre bouge, **toutes les dates renseignées de chaque dépendant** (celles qui existent parmi start/end/due) sont décalées du même delta en jours — traite le delta comme un vrai déplacement dans le temps de l'item entier, peu importe quel champ a bougé sur l'ancre.

Réutilise directement `shiftDate()` / `shiftItemDates()` déjà écrits dans [item-bulk.ts](../../../apps/api/src/routes/item-bulk.ts) pour la duplication avec décalage calendaire (31 jan +1 mois → 28 fév clampé, pas un débordement en jours fixes). À extraire en util partagé (ex. `apps/api/src/utils/dateShift.ts`) pour éviter la duplication entre `item-bulk.ts` et la nouvelle route de cascade.

## Calcul du delta de référence

Un item édité peut voir plusieurs champs de date changer simultanément avec des écarts différents (redimensionnement, pas un déplacement uniforme). Le delta proposé à la cascade se calcule sur un **champ de référence unique parmi ceux qui ont changé**, par ordre de priorité :

1. `dueDate`
2. `startDate`
3. `endDate`

Si un seul champ a changé, il sert directement de référence. Si plusieurs ont changé avec le même delta, ce delta est utilisé sans ambiguïté.

## Déclenchement

La cascade est proposée (jamais appliquée silencieusement) dès qu'un item dont la date change possède au moins une relation `drives` sortante (directe ou via la chaîne transitive) menant à des items ayant au moins une date renseignée.

Deux points d'entrée :

1. **`ItemEditModal`** — au moment de la sauvegarde, si une date a changé et que l'item est une ancre.
2. **Gantt (`TimelineView`)** — nouvelle interaction : drag du **corps** de la barre (pas les poignées de resize existantes aux extrémités) pour déplacer `startDate` et `endDate` ensemble du même delta. Distinction clic (ouvre la modale d'édition, comportement actuel) vs drag (déplace) via un seuil de mouvement en pixels avant de basculer en mode drag. Le corps de barre n'a aujourd'hui qu'un `onClick` ([TimelineView.tsx:1300-1303](../../../apps/web/src/components/views/TimelineView.tsx)) — ce comportement doit être conservé pour un clic sans mouvement. Même logique de snapping que le drag de resize existant ([TimelineView.tsx:580+](../../../apps/web/src/components/views/TimelineView.tsx)).

Un item **sans date propre** (bar Gantt "dérivée", calculée dans `computeDates()` à partir du min/max de ses enfants, [TimelineView.tsx:299-329](../../../apps/web/src/components/views/TimelineView.tsx)) n'a pas de poignées de resize et pas de corps de barre déplaçable — non concerné par la cascade tant qu'il n'a pas de date propre.

## UX de confirmation

Une seule modale de confirmation, montrant **toute la chaîne transitive** de dépendants affectés (pas de confirmation par niveau) :

```
Déplacer aussi les éléments liés ?

«Réunion» passe de +5 jours.
3 éléments liés seront décalés :
 • Préparer ODJ    (13→18 sept)
 • Rédiger CR       (17→22 sept)
 • Envoyer invit.   (12→17 sept)

     [Non, seul]   [Oui, déplacer]
```

- "Non, seul" : seule l'ancre est sauvegardée avec sa nouvelle date, aucun dépendant ne bouge.
- "Oui, déplacer" : l'ancre ET tous les dépendants affichés sont décalés en une seule opération.

La liste des dépendants affectés (et l'aperçu avant/après) est calculée **côté client**, à partir des items et relations déjà chargés pour l'espace (pas de round-trip API dédié pour la prévisualisation) — même pattern que la capture de descendants dans `SaveAsTemplateModal`.

## Création / suppression du lien

Le type `drives` s'ajoute comme un type de relation supplémentaire :

- **`ItemEditModal`** : dropdown de création de relation existant (`depends`/`blocks`/`relates`/`implements`) → ajout de `drives` ("Entraîne...").
- **`PertView`** : `PERT_RELATION_TYPES`, couleur de flèche dédiée, label contextuel (`getRelationContextLabel`) — même pattern que l'ajout du type `implements` documenté dans [2026-06-11-pert-relation-types.md](../plans/2026-06-11-pert-relation-types.md).

Suppression : réutilise le mécanisme de suppression de relation déjà en place (`onDeleteRelation`), aucune UI spécifique à ajouter — casser le lien `drives` = supprimer la relation comme n'importe quel autre type.

**Détection de cycle** : validée côté API à la création (avant insertion), en suivant les arêtes `drives` existantes depuis `toItemId` — si `fromItemId` est atteignable depuis `toItemId`, refuser (400) avec message explicite. Un item peut avoir plusieurs relations `drives` sortantes (une ancre peut entraîner plusieurs dépendants) et plusieurs entrantes (un dépendant peut être entraîné par plusieurs ancres — pas de restriction particulière, chaque déplacement d'ancre déclenche son propre calcul de cascade indépendant).

## Backend

Nouvel endpoint (ou extension d'`item-bulk.ts`) pour appliquer le décalage en cascade de façon transactionnelle avec audit log, cohérent avec le pattern déjà en place pour `bulk-duplicate` :

- Entrée : id de l'item ancre + delta en jours (calculé côté client à partir de l'ancien/nouveau valeur du champ de référence) + liste des ids de dépendants confirmés par l'utilisateur (pas recalculée côté serveur — évite un TOCTOU si les données ont changé entre la prévisualisation et la confirmation ; le serveur revalide juste que chaque id est bien atteignable via `drives` depuis l'ancre avant d'appliquer).
- Traitement : pour chaque item confirmé, `shiftItemDates(item, 'day', deltaDays)` puis update. Transaction Prisma unique.
- Audit log : une entrée par item modifié, cohérent avec `createAuditLog`/`serializeItemForAudit` déjà utilisés dans `item-bulk.ts`.

## Hors périmètre

- Pas de configuration d'un écart explicite (pas de champ à saisir à la création du lien).
- Pas de rétro-propagation (déplacer un dépendant ne fait jamais bouger son ancre).
- Les autres types de relation (`blocks`, `depends`, `relates`, `implements`, `parent`) ne sont pas concernés par le parcours de cascade.
- Pas de résolution automatique de conflit si un dépendant a lui-même une relation `drives` sortante ET entrante avec des ancres différentes bougeant en même temps (cas non simultané en pratique — chaque sauvegarde ne traite qu'une seule ancre à la fois).
