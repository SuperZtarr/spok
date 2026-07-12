# Time-blocking sur Ma journée (/today) — Design

**Date** : 2026-07-12
**Statut** : validé par Thomas (conversation), en attente de relecture du présent document
**Prérequis** : page /today livrée (spec 2026-07-11-today-page-design.md)

## Besoin

Caser les todos dans les trous entre les RDV : les réunions (Outlook, lecture seule) restent fixes, les tâches engagées du jour se placent sur une grille horaire et se réajustent au fil de la journée.

## Décisions structurantes

- Le placement vit sur **`DayPlanEntry`** (`plannedStart` + `plannedDuration`), jamais sur les dates de l'item — les dates réelles (Gantt, échéances) sont intactes ; le placement est le brouillon personnel d'organisation du jour.
- `plannedStart` nullable : une tâche engagée mais non placée reste dans la liste latérale.
- Les réunions ne sont **pas déplaçables** depuis SPOK (elles se gèrent dans Outlook).
- Drag & drop maison (pointer events + snap 15 min) — pas de lib supplémentaire.

## Modèle de données

`DayPlanEntry` (existant) gagne :
| Champ | Type | Rôle |
|-------|------|------|
| plannedStart | DateTime? | début du bloc (instant UTC, le client affiche en local) |
| plannedDuration | Int? | durée en minutes (défaut 30 à la pose) |

## API

- `PATCH /user/day-plan/:id` (existant) accepte en plus `plannedStart` (ISO ou null pour dé-placer) et `plannedDuration` (minutes, 15–720). `plannedStart: null` implique effacement de la durée.
- `GET /user/agenda` renvoie les nouveaux champs dans `plan[]` (aucun autre changement).

## UI — page /today réorganisée

- **Grille horaire 7h–20h** (pas de 15 min), colonne principale :
  - réunions posées (fixes, style distinct, pastille source)
  - blocs de tâches : glisser verticalement pour déplacer (snap 15 min), poignée basse pour étirer la durée, clic ✕ sur le bloc = dé-placer (retour dans la liste)
  - chevauchements autorisés, rendus côte à côte (largeur partagée)
  - les événements hors plage (avant 7h / après 20h) restent listés au-dessus/en-dessous de la grille
- **Liste latérale** (existante) : tâches engagées non placées + suggestions + pioche
  - bouton **« placer »** sur chaque tâche non placée → premier créneau libre ≥ maintenant (30 min), sinon premier trou du jour
- La case « fait » reste sur les items (grille et liste) ; une tâche done placée reste visible, grisée/barrée

## Tests (TNR Vitest)

- PATCH day-plan : validation plannedStart/plannedDuration (bornes, null qui efface la durée), scope utilisateur inchangé
- Utilitaire de calcul « premier créneau libre » (fonction pure, testée : journée vide, trous entre réunions, journée pleine)

## Hors périmètre

Vue semaine, déplacement des RDV (écriture Outlook/Graph), durées par défaut configurables, récurrence de plans.
