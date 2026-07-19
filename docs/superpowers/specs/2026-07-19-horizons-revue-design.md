# Horizons temporels + revue de rattrapage (chantier 1) — design

Date : 2026-07-19
Statut : validé par Thomas (design en 3 sections + correction du mécanisme de staleness)

## Contexte

Suite de la réflexion multi-contextes (chantier 0 : colonnes par agenda `/today`, livré 2026-07-18). Le problème : le volume d'items ingérable ne se résout pas en affichant plus, mais en **réduisant par horizon temporel** — et en assumant que reporter délibérément (« Plus tard ») est une stratégie de survie, pas un échec à corriger.

Ce document couvre uniquement le chantier 1. Les fenêtres de faisabilité par contexte (chantier 2) et le placement contraint dans l'agenda (chantier 3) restent des chantiers séparés, non spécifiés ici.

## 1. Modèle de données

Deux nouveaux champs sur `Item` (`packages/database/prisma/schema.prisma`) :

```prisma
enum HorizonBucket {
  NOW    // Maintenant
  TODAY  // Aujourd'hui
  WEEK   // Cette semaine
  MONTH  // Ce mois
  LATER  // Plus tard
}

model Item {
  // ...
  manualHorizon  HorizonBucket?
  horizonSetAt   DateTime?
}
```

- `manualHorizon` : horizon assigné manuellement (par la revue ou une édition directe), uniquement pertinent quand `dueDate` est absent. `null` = **bac à trier**.
- `horizonSetAt` : horodatage de la dernière assignation/changement de `manualHorizon` — remis à jour à chaque écriture de ce champ, jamais touché par une simple modification du titre/description. C'est lui qui mesure le dépassement, pas `updatedAt`.

Pas de migration de données : tous les items existants démarrent avec les deux champs à `null` (bac à trier), cohérent avec « rien ne se perd, ça remonte simplement en revue au prochain passage ».

## 2. Horizon effectif — dérivation

Fonction pure (nouveau fichier `packages/shared/src/horizon.ts`, utilisable front et back) :

```ts
function effectiveHorizon(item: { dueDate: Date | null; manualHorizon: HorizonBucket | null }, now: Date): HorizonBucket | null
```

- **Avec `dueDate`** : dérivé de la date, réutilisant exactement les bornes déjà codées dans `useGlobalTaskFilters` (overdue/aujourd'hui → `NOW`, cette semaine → `WEEK`, ce mois → `MONTH`, au-delà → `LATER`). Recalculé à chaque lecture, jamais stocké — aucune désynchronisation possible avec la date.
- **Sans `dueDate`** : `manualHorizon` tel quel (`null` = bac à trier).

## 3. Grâce par horizon — remontée en revue

Fonction pure `isOverdueForReview(item, now)` — s'applique **uniquement** aux items sans `dueDate` (les items à échéance sont déjà « à jour » par construction, leur horizon se recalcule tout seul). Délai de grâce depuis `horizonSetAt` :

| Horizon | Délai de grâce |
|---|---|
| `NOW` / `TODAY` | 1 jour |
| `WEEK` | 10 jours |
| `MONTH` | 35 jours |
| `LATER` | **jamais** — un horizon de repos, pas d'attente. Peut dormir des mois, c'est le comportement voulu |

Un horizon dépassé signifie : l'engagement pris avec cet horizon n'a pas été tenu — pas que l'item est suspect ou obsolète. Ce mécanisme remplace toute détection séparée des items « faits mais pas actualisés » : quand un horizon dépassé remonte en revue, l'action « Fait » (section 4) couvre déjà ce cas.

## 4. File de revue

Nouvel endpoint `GET /user/review-queue` (même périmètre d'accès que `/user/tasks` — espaces accessibles de l'utilisateur). Union de deux critères, sans doublon :

1. **Bac à trier** : `dueDate IS NULL AND manualHorizon IS NULL` et statut non `done`/`cancelled` — triés par `createdAt` croissant (les plus oubliés en premier)
2. **Horizon dépassé** : `dueDate IS NULL AND manualHorizon IS NOT NULL` et `isOverdueForReview` vrai et statut non `done`/`cancelled` — triés par ancienneté du dépassement

Réponse : `{ toTriage: Item[], overdue: Item[] }` (les deux groupes restent visuellement distincts dans l'UI — point 5).

**Actions par ligne** (toutes déjà couvertes par des endpoints existants, aucune route supplémentaire à créer hors le PATCH horizon) :
- **Fait** → `PATCH /spaces/:id/items/:id` `{ status: 'done' }` (déjà utilisé par `toggleDone` dans `TodayPage.tsx`)
- **Plus d'actualité** → `PATCH .../items/:id` `{ status: 'cancelled' }`
- **Reporter à un horizon** → nouveau champ dans le PATCH item : `{ manualHorizon: 'WEEK' }` — le backend met `horizonSetAt = now()` automatiquement dès que `manualHorizon` change (jamais fourni par le client)
- **Planifier dans un créneau** → `addToPlan`/`updateEntry` existants (`useAgendaMutations`), exactement le mécanisme déjà utilisé par le drag & drop de `/today`

## 5. UI

**`/today`** : nouvelle section repliable **« À réviser »** (badge = `toTriage.length + overdue.length`), dans la même zone que la liste du jour actuelle, style visuel aligné sur `DayPlanList` (une ligne par item + actions rapides inline). Les deux groupes (bac à trier / horizon dépassé) restent distincts avec un intitulé court, pas de fusion en une liste unique.

**`/tasks` (Tâches globales)** : la liste plate paginée devient des sections repliables par horizon effectif — **Maintenant / Aujourd'hui / Semaine / Mois / Plus tard / À trier**, chacune avec son compteur. 20 items visibles par défaut par section + « voir tout (N) » pour étendre. Les filtres existants (type, statut, priorité, espace, communauté, recherche) s'appliquent toujours, à l'intérieur de chaque section plutôt qu'à une liste unique.

**`/today` (suggestions existantes)** : inchangées — déjà groupées par espace, pas de double-groupement par horizon dans cette zone.

## Hors périmètre

- Fenêtres de faisabilité par contexte (chantier 2) et placement contraint dans l'agenda (chantier 3) — chantiers séparés
- Distinction fine « mois prochain » vs « encore plus tard » — fusionnée en un seul horizon `LATER` (non actionnable, écartée par Thomas)
- Détection automatique dédiée des items « faits mais pas actualisés » — couverte par le mécanisme d'horizon dépassé (section 3)
