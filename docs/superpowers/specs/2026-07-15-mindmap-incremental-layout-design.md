# MindMap — layout incrémental (design)

Date : 2026-07-15
Statut : validé par Thomas (à confirmer sur ce document)

## Problème

Dans la vue MindMap, presque tout changement structurel déclenche un recalcul complet du layout radial, qui repositionne des branches entières à l'autre bout de l'écran :

- **Suppression** : le chemin « suppression pure » (retrait des nœuds sans re-layout) existe dans `MindMapView.tsx` mais ne se déclenche presque jamais — supprimer un enfant change le `children.length` du parent survivant, le parent apparaît dans `changedIds`, et on retombe sur le recalcul complet.
- **Déplacement (reparentage)** : `onNodeDragStop` efface volontairement les positions sauvegardées de TOUTE la branche d'origine et de TOUTE la branche de destination (`clearAffectedBranches`), parce que le layout radial global recalcule rayon/angle de chaque ancêtre selon son nombre de descendants. Résultat : deux branches complètes sautent.
- **Ajout / relations** : changement de `structureSignature` → recalcul complet.

## Principe décidé

**La carte ne bouge que localement.** Tout changement structurel est traité par un **ré-éventail local** limité au(x) parent(s) directement concerné(s), via le mécanisme existant `reorganizeRef` (« réorganiser les enfants » du menu contextuel) : les enfants du parent sont redisposés en éventail autour de sa position actuelle, le parent et le reste de la carte ne bougent pas.

Le layout complet (`calculateLayout` global) ne s'exécute plus que :
1. au premier rendu d'un espace ;
2. sur action explicite « Réorganiser » (bouton toolbar / reset).

## Comportement par événement

| Événement | Traitement |
|---|---|
| Ajout d'un enfant | Ré-éventail local des enfants du parent concerné (le nouveau nœud prend sa place, les frères s'écartent) |
| Suppression | Retrait du/des nœud(s) + ré-éventail local des frères restants (**ils se resserrent** — décision Thomas) |
| Déplacement entre branches | Ré-éventail local chez l'ancien parent ET chez le nouveau, chacun à sa position actuelle. Suppression de `clearAffectedBranches` (plus d'effacement de branches entières) |
| Création/suppression de relation | Ajout/retrait de l'arête seule (réutiliser le cache `lastRelationEdgesRef` du toggle Relations), aucun repositionnement |
| Changement de contenu (titre, statut…) | Inchangé : patch des données du nœud en place |
| Repli/dépli (collapse) | Inchangé |

## Invariants conservés

- Les nœuds **épinglés** restent protégés : le ré-éventail local (`reorganizeRef`) les respecte déjà.
- Les positions manuelles (`savedPositions`, localStorage `mindmap-positions-v3-<spaceId>`) restent la source de vérité entre les recalculs.
- Le pattern `reorganizeRef.current` (capture du closure courant) est obligatoire — zone fragile, cf. CLAUDE.md.
- Portails : mêmes règles ; le ré-éventail local sait déjà traiter les nœuds portail (`child-space-*`).
- `fitView` automatique : seulement au premier rendu (comportement `userHasInteracted` conservé), pas après un ajustement local.

## Implémentation (vue d'ensemble)

Fichier principal : `apps/web/src/components/views/MindMapView.tsx`

1. **Effect structurel** : sur changement de `structureSignature`, ne plus appeler `calculateLayout` global. Diff des items (ajouts / suppressions / reparentages via `parentId`), puis :
   - retirer les nœuds/arêtes supprimés ;
   - créer les nœuds ajoutés (données via la même fabrique que le layout) ;
   - appeler le ré-éventail local sur chaque parent affecté (ancien et nouveau en cas de reparentage, parent des ajoutés, parent des supprimés).
2. **`onNodeDragStop`** : supprimer `clearAffectedBranches` et ses helpers ; le reparentage déclenche le ré-éventail local (déclenché de toute façon par le diff de l'effect quand les items reviennent du serveur).
3. **Relations** : traiter le diff des relations séparément de la signature structurelle pour n'ajouter/retirer que les arêtes.
4. **Nettoyage** : la détection `isPureDeletion` et ses refs deviennent inutiles (remplacées par le diff général) ; simplification des 4 chemins actuels en 2 (premier rendu/reset = global, tout le reste = incrémental + patch contenu).

## Hors périmètre (suggestions lisibilité, non décidées)

Notées pour plus tard, non incluses dans ce chantier :
1. Repli automatique à l'ouverture des gros espaces (~50+ items visibles → profondeur 1-2, badge « +N »)
2. Zoom sémantique (pastilles colorées à faible zoom)
3. Focus généralisé (double-clic sur tout nœud à enfants + fil d'Ariane)
4. Agrégation des feuilles nombreuses (nœud « 12 tâches » dépliable)
