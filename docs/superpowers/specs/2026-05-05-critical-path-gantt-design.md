# Design — Chemin critique dans la vue Gantt

**Date :** 2026-05-05  
**Statut :** approuvé  

---

## Objectif

Mettre en évidence le chemin critique (CPM) directement dans la vue Timeline/Gantt existante, sans nouvelle vue. Les items critiques (slack = 0) reçoivent une bordure rouge, la couleur statut reste visible.

---

## Algorithme CPM

**Fichier :** `apps/web/src/components/views/timeline-utils.ts`  
**Fonction :** `computeCriticalPath(items: Item[], relations: ItemRelation[]): Set<string>`

### Règles d'inclusion

- Relations prises en compte : `depends` et `blocks`, directions opposées :
  - `blocks` (fromItem=A, toItemId=B) : A doit finir avant B → A est prédécesseur de B
  - `depends` (fromItem=A, toItemId=B) : A nécessite B → B est prédécesseur de A
- Item **avec** dates (`startDate` + `endDate`) : durée = endDate − startDate (en minutes)
- Item **sans** dates mais **connecté** à au moins une dépendance : durée = 0 (jalon)
- Item **sans** dates **et sans** dépendances : exclu du calcul

### Passes CPM

**Forward pass** (du début vers la fin du graphe) :
- ES[item] = max(EF[prédécesseurs]) — ou startDate si aucun prédécesseur et dates définies
- EF[item] = ES[item] + durée

**Backward pass** (de la fin vers le début) :
- LF[item] = min(LS[successeurs]) — ou EF[item] si aucun successeur
- LS[item] = LF[item] − durée

**Slack :** `LS[item] − ES[item]`  
**Critique :** slack ≤ 60 secondes (seuil pour absorber les imprécisions float sur les dates ISO)

### Gestion des cycles

Si un cycle est détecté dans le graphe (dépendances circulaires), la fonction retourne un `Set` vide — pas de crash, pas de chemin critique affiché.

---

## Rendu visuel

**Fichier :** `apps/web/src/components/views/TimelineView.tsx`

### Toggle toolbar

- Nouveau bouton dans la toolbar existante (à côté de compact mode)
- Libellé : "Chemin critique"
- Icône : `GitBranch` (Lucide)
- État local : `useState(false)`, désactivé par défaut
- Quand activé : appel à `computeCriticalPath` (mémoïsé via `useMemo`)

### Barres critiques

- Classes ajoutées sur la barre si l'item est dans le Set critique : `ring-2 ring-red-500`
- Couleur de fond (statut) conservée — la bordure rouge s'y superpose
- Items sans dates affichés avec la même bordure rouge s'ils sont critiques (jalons sur le chemin)

---

## Périmètre

| Fichier | Modification |
|---|---|
| `timeline-utils.ts` | Ajout de `computeCriticalPath()` |
| `TimelineView.tsx` | État toggle + `useMemo` CPM + rendu bordure |

Aucun autre fichier modifié. Pas de changement API, pas de nouveau composant.

---

## Ce qui est exclu

- Flèches de dépendance : rendu inchangé (déjà en place)
- Affichage ES/EF/LS/LF en tooltip : hors scope
- Persistance du toggle (localStorage) : hors scope
- Items d'autres espaces (portails) : exclus du calcul CPM
