---
name: spok-triage
description: Triage de l'espace SPOK « Bugs et évolutions » — à invoquer quand Thomas dit « actualise », « regarde les nouveaux éléments / bugs », ou demande de répartir les signalements. Lit l'espace en un appel, repère ce qui est nouveau ou non terminé (Questions comprises), rapproche des commits poussés, propose la répartition vers les sessions qui ont le contexte, et tient les statuts à jour. Ne code jamais, ne commite jamais.
---

# spok-triage — Triage de l'espace « Bugs et évolutions »

Espace : `cmmugmqeg00189zxnsugws3v5` (communauté `cmlnwrtg80001mjpp4dc1fnxq`). Décisions de Thomas, 2026-11-12 à 11-21.

But : savoir en un coup d'œil ce qui est nouveau, ce qui est livré, ce qui attend Thomas, et répartir sans perdre de signalement,
en restant économe en tokens.

## 1. Lire (un seul passage)

1. **Lire seulement les statuts ouverts** (décision Thomas 2026-11-25) : un `mcp__spok__list_items` par statut, en parallèle,
   sans `pageSize` réduit — `todo`, `undefined`, `late`, `question_open`, `question_postponed` (repérer le nouveau), puis
   `in_progress`, `scheduled`, `to_validate` (suivi). Jamais `get_space` complet (147+ lignes, surtout du terminé) ; jamais de
   `limit` bas : l'ordre renvoyé n'est pas chronologique (raté le 2026-11-21 : `cmwqhp7yn`). Un élément sans aucun statut
   (Élément créé sans type) n'apparaît dans aucun filtre : `list_items type=UNDEFINED` en complément.
2. **Non terminé** = tout statut sauf `done` et `cancelled` ; pour une QUESTION : `question_open` et `question_postponed`
   (`question_decided` et `question_no_conclusion` = terminées). Un élément sans statut compte comme non terminé.
3. **Nouveau** = créé (date de début) depuis le dernier triage, ou non terminé et absent du dernier compte rendu.
4. **Code** : `git log --oneline` depuis le dernier triage et la section « PRÊT POUR MEP » de `docs/session-journal.md`.
   `git fetch` seulement si une MEP a pu avoir lieu depuis (sinon l'historique local suffit).
5. `get_item` seulement pour un cas ambigu (description tronquée qui change la répartition).

## 2. Rapprocher

- Commit poussé qui réalise un élément encore `todo` / `in_progress` → le passer en `to_validate` (jamais `done` : seul Thomas
  passe en Terminé, après test — sauf s'il dit l'avoir testé).
- Lot inscrit « PRÊT POUR MEP » → élément en `to_validate` ; le signaler comme « en attente de MEP ».
- Anomalies de rangement à signaler (pas corriger d'office) : élément sans type ni statut, tâche qui est une question,
  regroupement en Élément au lieu de Projet, parent incohérent, tag « bug » sur une évolution.

## 3. Proposer la répartition

- **Session existante qui a le contexte** (même vue / composant / sujet, liste « Linked sessions ») → `SendMessage` avec l'id de
  l'élément, le résumé du signalement et les consignes (spok-dev, plan validé, pas de commit, lot PRÊT POUR MEP avec l'id).
- **Sinon nouvelle session** (une par thème, pas par élément) : brief autonome, `use_worktree: false`, règles du projet,
  « Thomas manque de tokens : Grep et lectures ciblées ».
- Présenter la répartition en tableau (destination → éléments) et attendre un mot de Thomas (« Oui, répartis ») avant d'envoyer.

## 4. Tenir les statuts (décision Thomas 2026-11-21, Question `cmwqf8aby002w5x2xed1zhuo3`)

- **Dès qu'un élément est confié à une session** (nouvelle ou existante) : le passer en `in_progress` (une Question reste
  `question_open`). Appeler `get_space_conventions` une fois avant d'écrire.
- La session de dev le passe en `to_validate` quand son lot est inscrit « PRÊT POUR MEP » (règle de `spok-dev`).
- Ne jamais supprimer, ne jamais changer les tags sans le dire (`update_item.tags` remplace toute la liste).

## 5. Compte rendu à Thomas (court)

1. Livré depuis le dernier point (commits) → à tester.
2. En attente de MEP (et toute action destructive annoncée dans le journal, ex. suppression de tables).
3. Sessions qui attendent une réponse de Thomas (lien `[titre](#local_…)`).
4. Nouveaux signalements + répartition proposée.
5. Anomalies de rangement relevées.

Pas de relecture des comptes rendus de sessions au-delà de leur première ligne, sauf pour lever une ambiguïté.
