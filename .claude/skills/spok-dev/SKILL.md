---
name: spok-dev
description: Cycle de développement SPOK — à invoquer à CHAQUE demande de modification de code (fonctionnalité, correctif, retouche d'interface, refactor, route API, vue, page, modale, bouton), avant de lire ou toucher le code. Distingue micro-correction (sans plan à valider) et changement (spec, plan validé, trois couches de documentation via spok-doc), tests ciblés, liste de contrôle « terminé » ; ne commite jamais — le lot fini est inscrit « PRÊT POUR MEP » pour la session MEP. Ne pas utiliser pour une simple question sans modification, ni pour le déploiement (spok-deploy).
---

# spok-dev — Cycle de développement SPOK

Une modification n'est **terminée** que lorsque les **trois couches de documentation** sont à jour
(décision Thomas 2026-10-14, renforcée 2026-10-21) : spec SPOK, doc technique dans le code, aide utilisateur
dans l'interface. Cette skill est la seule porte d'entrée du code : elle appelle `spok-doc` avant et après.

> Anti-tunnel : un message de Thomas en cours de route prime — reformuler son impact en une phrase, l'intégrer,
> continuer. Découverte qui élargit le périmètre → signaler avant de traiter.

## 0. Niveau du changement (décision Thomas 2026-10-23)

- **Micro-correction** — moins d'une vingtaine de lignes, aucun nouveau comportement (libellé, placement, bug
  local évident) : pas de plan à valider, dire en une phrase ce qui change puis le faire. Si elle touche un
  composant, **demander à Thomas** si on actualise ses éléments de documentation (spec SPOK, fiche d'aide) au lieu
  de dérouler la section 3 d'office. En-tête du fichier et tests ciblés restent obligatoires.
- **Changement** — tout le reste (nouveau comportement, plusieurs fichiers, choix d'architecture) : cycle complet
  ci-dessous (spec, plan validé, trois couches).
- Doute sur le niveau → c'est un changement.

## 1. Avant de coder

1. **Invoquer `spok-doc`** (`Skill({ skill: "spok-doc" })`) et lire l'item SPOK du composant concerné
   (`mcp__spok__search_items`) — la spec fait foi, pas le code.
   - Item absent → le signaler à Thomas.
   - Code ≠ spec → signaler la divergence, ne pas suivre le code silencieusement.
2. **Skill de domaine** si concernée : `spok-menu` (menus, barres d'outils, vues), `spok-layout` (header, sidebar,
   bandeau), `docs/ARCHITECTURE.md` (vues, stores, hooks, SpacePage).
3. **Plan** : exposer ce qui va être fait et pourquoi, **y compris l'aide utilisateur prévue** (fiche, rappels
   fonctionnels, tour), puis attendre la validation de Thomas. Pas de code avant.

## 2. Pendant

- En-tête `/* ... */` sur tout fichier créé ou modifié (raison d'être, params clés, règles d'usage).
- Règle de gestion implicite introduite → `apps/web/src/lib/businessRules.ts`.
- Vérifications **ciblées seulement** : test du fichier concerné, typecheck du seul paquet touché
  (`cd apps/web && npx tsc --noEmit -p .`). Tests de l'aide : `pnpm exec vitest run --project web apps/web/src/help`
  depuis la racine. La suite complète et le typecheck des paquets sont réservés à la MEP (`spok-deploy`).
- Points d'étape courts sur les longues séquences (jalon, découverte, prochaine action).

## 3. Avant de rendre la main — liste de contrôle « terminé »

Rappeler `spok-doc` et dérouler, pour chaque composant touché :

| Couche | Contrôle |
|---|---|
| Spec | Item SPOK mis à jour (statut `to_validate`, Markdown) ou signalé absent |
| Doc technique | En-têtes à jour ; `businessRules.ts` si règle de gestion |
| Aide utilisateur | Fiche du composant (créée si elle n'existait pas — même pour un composant ancien), « ? » branché, tour et repères `data-tour`, **rappels fonctionnels sur chaque action à effet et chaque bloc de décision**, `fields` / `empty` / zones du mode Aide si concernés |
| Contrôle | `apps/web/src/help` vert ; test ciblé vert ; typecheck du paquet |

Puis :
- **Vérification du comportement** : suivre la skill `testing-protocol`.
- `docs/session-journal.md` : une ligne (ce qui a été fait, tests, état « NON COMMITÉ »).
- **Lot terminé → section « PRÊT POUR MEP »** en haut de `docs/session-journal.md` : nom du lot, fichiers exacts
  (pour un fichier partagé avec un autre lot : les lignes / blocs concernés), tests faits, ce qui n'est pas vérifié.
- Rendre compte à Thomas : ce qui change pour l'utilisateur, ce qui a été vérifié, ce qui ne l'a pas été.
- **Jamais de commit ni de push depuis une session de développement** : une seule session (« MEP ») commite et
  pousse, via `spok-deploy` (CLAUDE.md, « Une seule session fait les MEP »). Thomas demande « MEP » ici → répondre
  que le lot est inscrit et que la MEP se fait depuis la session MEP.
- Ne pas lancer `pnpm dev:stop` / `dev:start` si le dev tourne déjà : il est partagé avec les autres sessions.
