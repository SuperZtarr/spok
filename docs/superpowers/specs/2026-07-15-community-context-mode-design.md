# Contexte de communauté (Forum / Projet) — design

Date : 2026-07-15
Statut : validé par Thomas (« vas-y directement »)

## Principe

Le mode d'interface cesse d'être une bascule utilisateur globale : il devient une **propriété de la communauté**. Une communauté *est* un forum (sujets, discussions) ou *est* un projet (sous-projets, pilotage). L'interface se dérive du contexte visité.

- **Hors communauté** (espace personnel, Ma journée, Tâches, pages globales) : mode **« tous »** (décision Thomas).
- **Exploration** : hors périmètre, à déterminer plus tard (piste : « loupe » utilisateur, pas un contexte de contenu).
- Effet assumé : plus de forçage manuel du mode (le contenu dicte l'interface).

## Modèle

- Prisma : `enum CommunityContext { FORUM PROJECT }` + `context CommunityContext?` sur `Community`.
- `null` = neutre → mode « tous ». Les communautés existantes restent à `null` (pas de migration de données).
- Modifiable par le OWNER (réglages communauté + à la création).

## Dérivation front

- Le store `useInterfaceModeStore` conserve son API de lecture (`mode`, `setMode`) mais perd la persistance localStorage : il devient une valeur dérivée, défaut `'tous'`.
- `Layout.tsx` (qui calcule déjà `currentCommunity`) pousse le mode dérivé dans le store via un effect :
  `FORUM → 'forum'`, `PROJECT → 'projet'`, sinon `'tous'`.
- Les consommateurs existants (`MODE_ALLOWED` de SpaceToolbar, `MODE_GLOBAL_EXCLUDED` de GlobalNavBar, `isForumMode` d'ItemEditModal) sont inchangés.
- Le sélecteur 4 boutons du header (row 1) est supprimé.

## Chantier

1. Schéma Prisma + `db:generate`/`db:push` + rebuild packages (spok-rebuild)
2. Types partagés : `CommunityContext`, `Community.context`, inputs create/update
3. API communities : zod create/update + écriture du champ (le champ sort tout seul en lecture, les handlers renvoient le modèle complet)
4. Store `interfaceMode` dérivé (plus de localStorage)
5. Layout : suppression du sélecteur + effect de dérivation
6. Réglages communauté : sélecteur de contexte (Neutre / Forum / Projet), OWNER
7. Création de communauté : choix du contexte (optionnel)

## Hors périmètre

- Mode Exploration (loupe utilisateur)
- Affinage des listes de vues par mode (MODE_ALLOWED de projet/exploration)
- Épinglage de vues par espace (proposition n°3 de la revue ergonomique, à traiter séparément)
