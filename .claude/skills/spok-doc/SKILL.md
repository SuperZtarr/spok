---
name: spok-doc
description: Hub central de documentation SPOK. Invoquer pour documenter, consulter ou compléter toute documentation sur SPOK — interfaces, infra, consignes Claude. Point d'entrée unique vers toute la doc.
---

# spok-doc — Hub de documentation SPOK

## Règle absolue — documentation dans le code

**Tout fichier créé ou modifié reçoit un commentaire en tête** (composant, hook, utilitaire, store, route API) :
- Raison d'être : pourquoi ce fichier existe
- Params/props clés et leur rôle
- Règles d'usage : où l'utiliser, ce qu'on ne doit pas faire

Format : bloc `/* ... */` avant les imports. Non négociable, au même titre que le TS check.

## Les trois couches de documentation (décision Thomas 2026-10-14)

| Couche | Pour qui | Contenu | Où |
|---|---|---|---|
| 1. Spec | Thomas | Ce que le composant est censé faire — **fait foi** | Items de doc SPOK (ce skill) |
| 2. Doc technique | Claude | Ce que le code est censé faire | En-têtes de fichiers, commentaires, `apps/web/src/lib/businessRules.ts` |
| 3. Aide utilisateur | Utilisateur final | Comment se servir du composant | **Dans l'interface, textes écrits dans le code** |

**Toute évolution d'un composant met à jour les trois couches dans le même changement** : spec validée → code + en-tête → aide utilisateur.

**Point d'entrée** : toute modification de code passe par la skill `spok-dev`, qui appelle ce skill avant (spec) et
après (liste de contrôle des trois couches). Cette skill-ci garde les règles ; `spok-dev` garde le déroulé.

**Composant sans aide** : toucher une page, une modale ou une vue qui n'a pas encore de fiche d'aide = la créer dans
le même changement (règle 2026-10-21, après le constat des pages d'administration sans aucune aide). Ne jamais
laisser un composant modifié sans « ? » ni rappels fonctionnels.

### Couche 3 — aide utilisateur : règles

- **Une fiche `HelpEntry` par composant** (`apps/web/src/help/types.ts`), à côté du composant :
  - vues : `components/views/help/<vue>.help.ts`, registre `VIEW_HELP` (`components/views/help/index.ts`)
  - pages et modales : `pages/help/<page>.help.ts` ou `components/help/<modale>.help.ts`, registre `PAGE_HELP` (`help/pageHelp.ts`)
- Champs d'une fiche : `title`, `summary`, `short` (accroche des cartes), `tips`, `tour` (étapes driver.js, repères `data-tour`), `hints` (infobulles), `empty` (état vide d'une vue), `fields` (aide sous les champs).
- **Les textes ne s'écrivent jamais en dur dans un composant** : les affichages lisent la fiche.
  - `?` : `ViewHelpButton` (vue) / `PageHelpButton` (page, modale) — jamais de bouton d'aide maison
  - infobulles : `HelpHint` ; états vides : `EmptyHelp` ; aide sous un champ : `FieldHelp`
- **Rappels fonctionnels** (demande Thomas 2026-10-21 : « je ne sais plus ce que je valide ») — l'interface doit
  dire ce que fait chaque fonction, pas seulement comment s'en servir :
  - **toute action à effet** (approuver, rejeter, supprimer, changer un rôle, fusionner, publier, inviter,
    restaurer…) porte une infobulle `HelpHint` qui dit **ce qui va se passer** : quelles données changent, pour qui,
    si c'est réversible. Texte dans `hints` de la fiche, vérifié dans le code de l'API (ne rien affirmer de faux) ;
  - **tout bloc qui demande une décision** (file d'attente, demande en attente, alerte, conflit) porte une phrase
    d'explication sous son titre (texte dans la fiche) : d'où vient la demande, ce que chaque choix entraîne ;
  - pages d'administration comprises : elles ont une fiche et un « ? » comme les autres.
- **Modifier un comportement d'interface = mettre à jour sa fiche** : bouton ajouté/retiré/renommé → conseil, étape de tour et repère `data-tour` ; nouveau champ → `fields` ; nouvelle vue/page → fiche + registre.
- Une étape dont la cible est absente est sautée (`runTour`) : acceptable pour une section conditionnelle (favoris, enfants…), pas pour une commande toujours présente — vérifier les repères à l'écran.
- La dernière étape « Besoin d'aide ? » est ajoutée automatiquement sur le `?` qui a lancé le tour (`TOUR_ANCHOR_ATTR`) : ne pas l'écrire dans les fiches.
- **Mode Aide** (Maj+? ou bouton « Mode Aide » du `?`, lecture seule, survol = zone encadrée + explication) : les zones sont marquées SANS wrapper —
  - cadre et barre d'espace : `data-devzone="<nom>"` (vocabulaire de `DevZoneInspector`), texte dans `help/shellZones.ts` ;
  - vues (puis pages/modales) : `data-help-zone="<fiche>:<zone>"` sur un élément existant, texte dans le champ `zones` de la fiche (`{ title, text }`, titre ≤ 4 mots, 1 à 3 phrases, sans lister les boutons).
  - Composants : `help/HelpModeOverlay.tsx` (monté dans Layout), `help/helpZones.ts` (résolution), `stores/helpMode.ts`.
  - Une zone renommée/ajoutée/supprimée = son texte dans le même changement.
- Contrôle : `apps/web/src/help/coverage.test.ts` (fiche de chaque vue/page, tours complets, repères existants, `EmptyHelp`/`FieldHelp` branchés, pas de `title` natif dans les en-têtes, zones du cadre ⇔ textes, ≥ 2 zones par vue et aucun texte de zone orphelin).

---

Ce skill remplit trois rôles :
1. **Consulter** — orienter vers la bonne documentation existante
2. **Documenter** — conventions et format pour créer un item de doc
3. **Compléter** — séquence pour ajouter ce qui manque

Lire en entier avant toute action.

---

## Quand invoquer ce skill

**Avant de coder** (obligatoire) :
- Toute demande d'implémentation, modification ou correction sur un composant SPOK
- Toute question sur un comportement ("est-ce un bug ou c'est voulu ?")
- Avant de lire le code source — la doc prime sur le code

**Séquence obligatoire avant de toucher du code :**
1. `mcp__spok__search_items` avec le nom du composant/page concerné
2. Lire l'item trouvé — c'est la spec d'intention
3. Si item absent → signaler à l'utilisateur avant de coder
4. Coder en respectant la spec
5. Si le code existant diverge de la doc → signaler la divergence, ne pas la suivre silencieusement

**Après avoir codé** — liste de contrôle « terminé » (déroulée par `spok-dev`) :
- **Spec** : comportement d'un composant documenté changé → item SPOK mis à jour (status `to_validate`) ; item absent → signalé
- **Doc technique** : en-têtes des fichiers touchés ; `businessRules.ts` si règle de gestion
- **Aide utilisateur** : fiche du composant à jour (ou créée), « ? », tour et repères, rappels fonctionnels sur les actions
  à effet et les blocs de décision, `fields` / `empty` / zones si concernés (couche 3, ci-dessus)
- **Contrôle** : `pnpm exec vitest run --project web apps/web/src/help` vert

---

## Plan de la documentation

Communauté : **Mes Projets Claude** `cmlnwrtg80001mjpp4dc1fnxq`
Espace racine SPOK : **Projet SPOK** `cmmtjoiih00gdf03n9hscbkeq`

### Fonctionnement structurel

> Infra, architecture technique, MCP, modèle de données — sous Projet SPOK

| Espace | ID | Contenu |
|--------|----|---------|
| Système | `cmmthmtr7000mf03nkqrv7a3z` | Hébergement Railway, Docker, domaine, env vars, ports |
| Modèle de données | `cmnq9c4x8000o5yz2xrlcel81` | 1 item par table Prisma (fonctionnelles + techniques) |
| Autres fonctionnalités | `cmnq9c4aq000k5yz2w1n6e70d` | Templates, AppConfig, Permissions & accès |
| Contexte | `cmnq9c6st00105yz2eoky7uvt` | Vision, objectifs, problème résolu, utilisateurs cibles |

### Interfaces

> Composants visuels, pages, vues, modales — sous Projet SPOK

| Espace | ID | Contenu |
|--------|----|---------|
| Structure | `cmnq9c5jr000s5yz2vthye9ws` | Header, Sidebar, Zone principale, Sécurité & Accès |
| Modales & Overlays | `cmmts8ab200ajwbfkewwrj2b6` | Modale d'édition, création espace/communauté, autres modales |
| Pages publiques | `cmnxnu81f01h8n856xt1fj4bo` | Landing, Auth (login/register/reset), Invitation, Sitemap |
| Pages utilisateur | `cmnxohuia01mln856b8bu9luo` | Accueil, Dashboard, Recherche, Graphe, Sunburst, MindMap, Tâches |
| Communautés | `cmnq9c2fa00085yz2u2961kvx` | CommunityPage, CommunitiesListPage, Settings |
| Espaces | `cmnq9c31s000c5yz2co7rpg8m` | SpacePage (vues), SpaceOverview, Settings, History, Toolbar |
| Items | `cmnssg2zf00dnx6kktkjmqfq4` | Items et leurs comportements |
| Administration | `cmnq9c3oa000g5yz26hkk5adh` | Pages /admin/* (Users, Spaces, Communities, Stats, AuditLogs…) |

### Consignes & configuration Claude

> Sous l'espace CLAUDE `cmmtsblm400gmwbfky28czun6` (niveau communauté)

| Espace | ID | Contenu |
|--------|----|---------|
| Claude — Global | `cmofn4cma003bu1pvwzxj4hs1` | Consignes universelles, skills et plugins tous projets |
| Claude — SPOK | `cmofml3lf0022u1pvkbdb5xlm` | Consignes et skills spécifiques SPOK |
| CLAUDE Documentations | `cmmtsblm400gmwbfky28czun6` | Compte et abonnements Claude |

---

## Comment consulter

**Question sur l'infra ou le déploiement ?** → Système
**Question sur la base de données ?** → Modèle de données
**Question sur un composant visuel (header, sidebar) ?** → Structure
**Question sur une page (login, accueil, admin) ?** → Pages publiques / Pages utilisateur / Administration
**Question sur les espaces ou les vues ?** → Espaces
**Question sur les modales ?** → Modales & Overlays
**Question sur les consignes ou comportements de Claude ?** → Claude — SPOK ou Claude — Global

Séquence :
1. Identifier la branche (structurel / interfaces / consignes)
2. `mcp__spok__get_space` sur l'espace concerné
3. Si non trouvé : `mcp__spok__search_items` avec des mots-clés

---

## Comment documenter

### Principe fondamental

La documentation est la **spec convenue** : ce que Thomas et Claude ont décidé ensemble. Ni description du code tel qu'il est, ni vision idéale — la référence de ce qui a été acté.

### Statuts

| Statut | Signification |
|--------|--------------|
| *(aucun)* | Idée envisagée — pas encore spécifiée ni décidée |
| `todo` | Spécifié — décidé, pas encore implémenté |
| `in_progress` | Partiellement implémenté |
| `to_validate` | Rédigé par Claude — Thomas doit confirmer |
| `done` | Spec validée par Thomas — c'est la référence |
| `cancelled` | Abandonné / doublon |

**Règle** : Claude rédige → Thomas valide (`to_validate` → `done`). Jamais d'auto-validation.

### Types d'items enfants sur un composant

- `BUG` → anomalie identifiée
- `TASK` → évolution planifiée, décidée (statut `todo`)
- `NOTE` → idée envisagée, pas encore décidée (statut vide)

### Format des items

- Titre : `Nom fonctionnel [NomTechnique]`
- Ex : `Barre latérale [Sidebar]`, `Modale d'édition d'item [ItemEditModal]`
- 1 item parent = 1 page ou composant identifiable
- Items enfants = bugs, évolutions, idées rattachés au composant

### Corps d'un item

```
## Intention
Pourquoi ce composant existe, quel problème il résout.

## Décisions de design
Choix structurants et pourquoi — ce qui ne doit pas changer sans discussion.

## Comportements attendus
Ce que le système doit faire dans chaque cas — référence pour distinguer bug vs attendu.

## Contraintes
Invariants, dépendances critiques, ce qu'on ne touche pas.

## Fichiers
apps/web/src/... ou apps/api/src/...
```

---

## Comment compléter

1. `mcp__spok__search_items` — vérifier que ça n'existe pas déjà
2. Identifier le bon espace dans le plan ci-dessus
3. `mcp__spok__create_item` (spaceId, parentId si sous-composant, statut `to_validate`)
4. Mettre ce skill à jour si la structure change

### Outils MCP disponibles

| Opération | Outil |
|-----------|-------|
| Lister les espaces | `mcp__spok__list_spaces` |
| Lire un espace + ses items | `mcp__spok__get_space` |
| Chercher un item | `mcp__spok__search_items` |
| Créer un item | `mcp__spok__create_item` |

---

## Détail des espaces

### Structure `cmnq9c5jr000s5yz2vthye9ws`
| ID | Item |
|----|------|
| `cmnq9ctvy00ao5yz2ugz3dicd` | En-tête [Header] |
| `cmnq9c9zj00265yz2875z82fl` | Zone principale [Main] |
| `cmnq9c7tx00185yz2sfznl4x3` | Barre latérale [Sidebar] |
| `cmnq9ccfd00365yz2w5pke7oj` | Sécurité & Accès (item parent, spaceId=cmnq9c5jr000s5yz2vthye9ws) |

### Modales & Overlays `cmmts8ab200ajwbfkewwrj2b6`
| ID | Item |
|----|------|
| `cmmti1lkp006kf03nzbdq9acw` | Modale d'édition d'item [ItemEditModal] |
| `cmmtjtwrd00srf03n6d810van` | Détail espace (admin) [SpaceDetailModal] |
| `cmmtjtv6b00snf03ne6mtot7d` | Détail communauté (admin) [CommunityDetailModal] |
| `cmmti1yez007gf03n2trd658b` | Autres modales |
| `cmmtiyxlp00b3f03nmog78n1f` | Détails utilisateur [UserDetailModal] |
| `cmmtiyx5f00avf03n3lp982rd` | Création d'espace |
| `cmmtiyxdm00azf03n0rmow5w1` | Création de communauté |

### Pages publiques `cmnxnu81f01h8n856xt1fj4bo`
| ID | Item |
|----|------|
| `cmnxpqf1g01q0n856blbgriei` | Authentification (5 sous-items) |
| `cmnxpqf8y01q4n8567es0rbho` | Accès par lien — Invitation |
| `cmnxpqfle01q8n85655c4744j` | Découverte — Landing, Sitemap |

### Pages utilisateur `cmnxohuia01mln856b8bu9luo`
| ID | Item |
|----|------|
| `cmnxpvfye01qzn856runief9k` | Navigation globale (Accueil, Espaces, Dashboard, Recherche) |
| `cmnxpvgcg01r3n856nl0qya0o` | Visualisations globales (Graphe, Sunburst, MindMap, Tâches) |

### Communautés `cmnq9c2fa00085yz2u2961kvx`
| ID | Item |
|----|------|
| `cmnq9c830001c5yz29upq89c8` | Page communauté [CommunityPage] |
| `cmnq9c87k001e5yz28d635i0m` | Liste des communautés [CommunitiesListPage] |
| `cmnq9cfpv004m5yz20n3meqfg` | Paramètres communauté [CommunitySettingsPage] |

### Espaces `cmnq9c31s000c5yz2co7rpg8m`
| ID | Item |
|----|------|
| `cmnq9c8gp001i5yz2jioyartd` | Contenu espace [SpacePage] |
| `cmnq9cw6h00bo5yz2dtf4wlu0` | Vues |
| `cmnq9ctre00am5yz236zts7mm` | Barre d'outils espace |
| `cmnq9c8l9001k5yz2t1kcpkkd` | Paramètres espace [SpaceSettingsPage] |
| `cmnq9c8c3001g5yz2a0mza14i` | Aperçu espace [SpaceOverviewPage] |
| `cmnq9cg84004u5yz2qt0svazx` | Historique espace [SpaceHistoryPage] |

### Administration `cmnq9c3oa000g5yz26hkk5adh`
| ID | Item |
|----|------|
| `cmnq9c8pu001m5yz2ubtshw1m` | Gestion utilisateurs [UsersPage] |
| `cmnq9cd26003g5yz2xu95powk` | Gestion des espaces [SpacesPage] |
| `cmnq9cd6q003i5yz2f7btm0nr` | Gestion des communautés [CommunitiesPage] |
| `cmnq9c8ug001o5yz28naev90e` | Statistiques [StatsPage] |
| `cmnq9c8z1001q5yz28s6mjoy6` | Journaux d'audit [AuditLogsPage] |
| `cmnq9cdb8003k5yz22ngl0570` | Diagnostics [AnomaliesPage] |
| `cmnq9c93l001s5yz2dpx2fguy` | Configuration des menus [MenuConfigPage] |
| `cmnq9c985001u5yz2vhjzllrf` | Référentiels [ReferentielsPage] |

### Modèle de données `cmnq9c4x8000o5yz2xrlcel81`
| ID | Item |
|----|------|
| `cmnq9chmk005e5yz2ss5q7l1c` | Tables fonctionnelles (13) |
| `cmnq9chdh005c5yz2560eetsp` | Tables techniques (12, dont ItemView ; MenuItem = concept AppConfig, pas une table) |
| `cmnq9cdtl003s5yz293mlb05a` | Types d'items [enum ItemType] (à la racine, pas une table) |

### Système `cmmthmtr7000mf03nkqrv7a3z`
| ID | Item |
|----|------|
| `cmnufclwh01snx6kko2m73lax` | PROD (Railway, Docker, domaine, env vars) |
| `cmnufcg9301shx6kkws6xwkwh` | DEV (Docker local, ports) |

### Contexte `cmnq9c6st00105yz2eoky7uvt`
| ID | Item |
|----|------|
| `cmnq9cb96002q5yz2bqkzo1r7` | Vision |
| `cmnq9cbdq002s5yz291lftyg8` | Problème résolu |
| `cmnq9cbmu002w5yz2vxrbjwh2` | Utilisateurs cibles |
| `cmnq9cbib002u5yz2zvz6uslm` | Objectifs |
| `cmnq9cbvv002y5yz2508md8cv` | Centraliser sans rigidité |
| `cmnq9cc0g00305yz2a20e7rdq` | Plusieurs lectures du même contenu |
| `cmnq9cc5000325yz2flyn9qdj` | Liens plutôt que silos |
| `cmnq9ccau00345yz2ji5lge7n` | Simple à prendre en main, puissant à l'usage |

---

## Lexique des routes

### Publiques (sans auth)
| Route | Composant |
|-------|-----------|
| `/` (non connecté) | `LandingPage` |
| `/login` | `LoginPage` |
| `/register` | `RegisterPage` |
| `/forgot-password` | `ForgotPasswordPage` |
| `/reset-password` | `ResetPasswordPage` |
| `/verify-email` | `VerifyEmailPage` |
| `/invitation` | `InvitationPage` |
| `/sitemap` | `SitemapPage` |

### Utilisateur connecté
| Route | Composant |
|-------|-----------|
| `/` | `HomePage` → `HomeView` |
| `/communities` | `CommunitiesListPage` |
| `/spaces` | `SpacesListPage` |
| `/dashboard` | `DashboardViewPage` |
| `/graph` | `GraphPage` |
| `/sunburst` | `SunburstPage` |
| `/mindmap` | `MindMapPage` |
| `/tasks` | `GlobalTasksPage` |
| `/search` | `SearchPage` |

### Espaces
| Route | Composant |
|-------|-----------|
| `/spaces/:id` | `SpaceOverviewPage` |
| `/spaces/:id/content` | `SpacePage` (vues) |
| `/spaces/:id/settings` | `SpaceSettingsPage` |
| `/spaces/:id/history` | `SpaceHistoryPage` |

### Communautés
| Route | Composant |
|-------|-----------|
| `/communities/:id` | `CommunityPage` |
| `/communities/:id/settings` | `CommunitySettingsPage` |

### Administration
| Route | Composant |
|-------|-----------|
| `/admin/users` | `UsersPage` |
| `/admin/spaces` | `SpacesPage` |
| `/admin/communities` | `CommunitiesPage` |
| `/admin/stats` | `StatsPage` |
| `/admin/audit-logs` | `AuditLogsPage` |
| `/admin/anomalies` | `AnomaliesPage` |
| `/admin/menu` | `MenuConfigPage` |
| `/admin/views` | `ViewsConfigPage` |
| `/admin/referentiels` | `ReferentielsPage` |
| `/admin/api-doc` | `ApiDocPage` |
| `/admin/perf` | `PerfPage` |
