---
name: spok-doc
description: Gérer la documentation fonctionnelle dans l'application SPOK (espace Produit SPOK). Utiliser quand on veut créer, mettre à jour ou enrichir la documentation des interfaces dans SPOK. Déclencher systématiquement quand on documente une page, une section ou un composant de SPOK.
---

# spok-doc — Documentation fonctionnelle dans SPOK

Ce skill est la **source de vérité** pour la documentation SPOK. Lire en entier avant toute action.

## Règles absolues

1. Lire les IDs ci-dessous AVANT toute action
2. Ne jamais recréer un espace qui existe déjà
3. Si un item est introuvable, chercher avec `mcp__spok__search_items` avant de créer
4. Si la structure change, mettre ce skill à jour immédiatement

## Outils MCP disponibles

| Opération | Outil MCP |
|-----------|-----------|
| Lister les espaces | `mcp__spok__list_spaces` |
| Lire un espace + ses items | `mcp__spok__get_space` |
| Chercher un item existant | `mcp__spok__search_items` |
| Créer un item | `mcp__spok__create_item` |

---

## Espaces de documentation (prod)

Communauté : **Mes Projets Claude** `cmlnwrtg80001mjpp4dc1fnxq`

```
Projet SPOK (cmmtjoiih00gdf03n9hscbkeq)
├── Produit - SPOK (cmnq9c16300045yz277osg7wc)  ← conteneur
│   ├── Contexte             (cmnq9c6st00105yz2eoky7uvt)
│   ├── Structure            (cmnq9c5jr000s5yz2vthye9ws)
│   ├── Pages publiques      (cmnxnu81f01h8n856xt1fj4bo)
│   ├── Pages utilisateur    (cmnxohuia01mln856b8bu9luo)
│   ├── Communautés          (cmnq9c2fa00085yz2u2961kvx)
│   │   └── Espaces              (cmnq9c31s000c5yz2co7rpg8m)
│   │   │   └── Items            (cmnssg2zf00dnx6kktkjmqfq4)
│   ├── Administration       (cmnq9c3oa000g5yz26hkk5adh)
│   ├── Modales & Overlays   (cmmts8ab200ajwbfkewwrj2b6)
│   ├── Modèle de données    (cmnq9c4x8000o5yz2xrlcel81)
│   └── Autres fonctionnalités (cmnq9c4aq000k5yz2w1n6e70d)
└── Système                  (cmmthmtr7000mf03nkqrv7a3z)

CLAUDE Documentations        (cmmtsblm400gmwbfky28czun6)  ← hors Produit SPOK
```

### Table de référence rapide

| Espace | ID | Contenu |
|--------|----|---------|
| Produit - SPOK | `cmnq9c16300045yz277osg7wc` | Conteneur racine |
| Contexte | `cmnq9c6st00105yz2eoky7uvt` | Vision, objectifs, utilisateurs cibles |
| Structure | `cmnq9c5jr000s5yz2vthye9ws` | Header, Sidebar, Zone principale, Sécurité |
| Modales & Overlays | `cmmts8ab200ajwbfkewwrj2b6` | Toutes les fenêtres et panneaux modaux |
| Pages publiques | `cmnxnu81f01h8n856xt1fj4bo` | Landing, Login, Register, Forgot password... |
| Pages utilisateur | `cmnxohuia01mln856b8bu9luo` | Accueil, Recherche, Dashboard, Graphe... |
| Communautés | `cmnq9c2fa00085yz2u2961kvx` | CommunityPage, Settings, Membres |
| Espaces | `cmnq9c31s000c5yz2co7rpg8m` | SpacePage, vues, SpaceOverview, Settings, History |
| Items | `cmnssg2zf00dnx6kktkjmqfq4` | Items et leurs comportements |
| Administration | `cmnq9c3oa000g5yz26hkk5adh` | Toutes les pages /admin/* |
| Modèle de données | `cmnq9c4x8000o5yz2xrlcel81` | 1 item par table Prisma |
| Autres fonctionnalités | `cmnq9c4aq000k5yz2w1n6e70d` | Templates, AppConfig, Permissions & accès |
| Système | `cmmthmtr7000mf03nkqrv7a3z` | Hébergement, infra prod/dev, config technique |
| CLAUDE Documentations | `cmmtsblm400gmwbfky28czun6` | Skills, consignes, mémoire Claude |

---

## Détail des espaces

### Contexte `cmnq9c6st00105yz2eoky7uvt`
| ID | Item |
|----|------|
| `cmnq9cbib002u5yz2zvz6uslm` | Objectifs (4 sous-items) |
| `cmnq9cb96002q5yz2bqkzo1r7` | Vision |
| `cmnq9cbdq002s5yz291lftyg8` | Problème résolu |
| `cmnq9cbmu002w5yz2vxrbjwh2` | Utilisateurs cibles |

### Structure `cmnq9c5jr000s5yz2vthye9ws`
| ID | Item | Statut | Enfants |
|----|------|--------|---------|
| `cmnq9ctvy00ao5yz2ugz3dicd` | En-tête [Header] | `in_progress` | Logo, Recherche globale, Sélecteur de vue, Titre de page, Favoris, Récents, Mes espaces, Communautés, Menu utilisateur, Sidebar, Notifications, Bouton Nouvel item |
| `cmnq9c9zj00265yz2875z82fl` | Zone principale [Main] | `done` | Barre de filtres, Sélecteur de vue, Actions contextuelles, Actions globales, Zone de rendu |
| `cmnq9c7tx00185yz2sfznl4x3` | Barre latérale [Sidebar] | `done` | Pied de sidebar |
| `cmnq9ccfd00365yz2w5pke7oj` | Sécurité & Accès | `done` | Rôles plateforme, Rôles espace, Rôles communauté, Auth JWT |
| `cmnq9caqx002i5yz2rgtajio9` | Documentation | `todo` | Doc fonctionnelle, Doc technique, Spécifications |

### Modales & Overlays `cmmts8ab200ajwbfkewwrj2b6`
| ID | Item | Enfants |
|----|------|---------|
| `cmmti1lkp006kf03nzbdq9acw` | Modale d'édition d'item | 19 sous-items (champs, onglets, actions) |
| `cmmtjtwrd00srf03n6d810van` | Espaces | 11 sous-items |
| `cmmtjtv6b00snf03ne6mtot7d` | Communautés | 10 sous-items |
| `cmmti1yez007gf03n2trd658b` | Autres modales | 15 sous-items |
| `cmmtiyxlp00b3f03nmog78n1f` | Détails utilisateur | 5 sous-items |
| `cmmtiyx5f00avf03n3lp982rd` | Création d'espace | 5 sous-items |
| `cmmtiyxdm00azf03n0rmow5w1` | Création de communauté | 1 sous-item |

### Pages publiques `cmnxnu81f01h8n856xt1fj4bo`
| ID | Item | Enfants |
|----|------|---------|
| `cmnxpqf1g01q0n856blbgriei` | Authentification | Connexion, Inscription, Mot de passe oublié, Réinitialisation, Vérification email (5) |
| `cmnxpqf8y01q4n8567es0rbho` | Accès par lien | Invitation (1) |
| `cmnxpqfle01q8n85655c4744j` | Découverte | Landing, Plan du site (2) |

### Pages utilisateur `cmnxohuia01mln856b8bu9luo`
| ID | Item | Enfants |
|----|------|---------|
| `cmnxpvfye01qzn856runief9k` | Navigation globale | Accueil, Liste des espaces, Tableau de bord, Recherche (4) |
| `cmnxpvgcg01r3n856nl0qya0o` | Visualisations globales | Graphe, Sunburst, Carte mentale, Tâches (4) |

### Communautés `cmnq9c2fa00085yz2u2961kvx`
| ID | Item | Enfants |
|----|------|---------|
| `cmnq9cvjn00be5yz2dsu07f8t` | Pages | CommunityPage, CommunitiesListPage, Settings… (6) |
| `cmnq9cfpv004m5yz20n3meqfg` | Paramètres communauté [CommunitySettingsPage] | 3 sous-items |
| `cmnq9c87k001e5yz28d635i0m` | Liste des communautés [CommunitiesListPage] | — |
| `cmnq9c830001c5yz29upq89c8` | Page communauté [CommunityPage] | — |

### Espaces `cmnq9c31s000c5yz2co7rpg8m`
| ID | Item | Enfants |
|----|------|---------|
| `cmnq9c8gp001i5yz2jioyartd` | Contenu espace [SpacePage] | Liste, Kanban, Timeline, MindMap, Sequence, Graphe, Sunburst, Bubble… (8) |
| `cmnq9cw6h00bo5yz2dtf4wlu0` | Vues | 6 sous-items (types de vues) |
| `cmnq9ctre00am5yz236zts7mm` | Barre d'outils espace | Filtres, Recherche locale, Actions (3) |
| `cmnq9c8l9001k5yz2t1kcpkkd` | Paramètres espace [SpaceSettingsPage] | 3 sous-items |
| `cmnq9c8c3001g5yz2a0mza14i` | Aperçu espace [SpaceOverviewPage] | — |
| `cmnq9cg84004u5yz2qt0svazx` | Historique espace [SpaceHistoryPage] | — |

### Administration `cmnq9c3oa000g5yz26hkk5adh`
| ID | Item | Enfants |
|----|------|---------|
| `cmnq9cwot00bw5yz29wqonx18` | Menu Administration | Users, Spaces, Communities, Stats, AuditLogs, Anomalies, Menu, Views, Référentiels (9) |

### Modèle de données `cmnq9c4x8000o5yz2xrlcel81`
| ID | Item | Enfants |
|----|------|---------|
| `cmnq9chmk005e5yz2ss5q7l1c` | Les tables fonctionnelles | Item, Espace, Communauté, Utilisateur, SpaceMembership, CommunityMembership, ItemRelation, Tags, ItemTag, Reaction, Contributions, ItemBookmark, Invitation, Notification, SpaceFavorite (15) |
| `cmnq9chdh005c5yz2560eetsp` | Les tables techniques | AuditLog, SpaceModule, CommunityEmail, CommunityEmailRecipient, RefreshToken, PasswordResetToken, EmailVerificationToken, AppConfig, MenuItem (11) |

### Système `cmmthmtr7000mf03nkqrv7a3z`
| ID | Item | Enfants |
|----|------|---------|
| `cmnufclwh01snx6kko2m73lax` | PROD | Railway, Docker, domaine, env vars (5) |
| `cmnufcg9301shx6kkws6xwkwh` | DEV | Docker local, ports (1) |

---

## CLAUDE Documentations `cmmtsblm400gmwbfky28czun6`

| Item | ID |
|------|----|
| SPOK START | `cmnx6vwif00abn856zflscr5x` |
| SPOK DOC | `cmnx6z61k00ann856dy48deae` |
| SPOK API | `cmnx6zd1q00atn856jbk7dc8r` |
| DEPLOY | `cmnx6yxin00ahn856gmhmidzq` |
| SPOK TNR | `cmnx6zkne00azn8565gjrheyj` |
| SPOK REBUILD | `cmnxc3m6l00gjn856gqbyw6yh` |
| Fichiers de consignes | *(sous-items : CLAUDE.md, Skills, Memory, docs/)* |

---

## Conventions

### Statuts
| Statut | Signification |
|--------|--------------|
| `done` | Composant documenté, existe tel que décrit dans le code |
| `to_validate` | Évolution déployée, en attente de validation |
| `in_progress` | En cours de documentation |
| `todo` | Bug, évolution ou question identifiée |
| `cancelled` | Obsolète / doublon |

### Format des items
- Titre : `Nom fonctionnel [NomTechnique]` — toujours le nom fonctionnel en premier, le nom technique entre crochets
- Ex : `Barre latérale [Sidebar]`, `Accueil [HomePage]`, `Modale d'édition d'item [ItemEditModal]`
- 1 item parent = 1 page ou composant identifiable
- Items enfants = bugs, évolutions, questions rattachés au composant

### Corps d'un item de documentation
```
## Rôle
Ce que fait ce composant, pourquoi il existe.

## Fichier(s)
apps/web/src/...

## Contenu
Liste des éléments visuels ou fonctionnels présents.

## Comportement
Conditions d'affichage, états, variantes.

## Interactions clés (si pertinent)
- Clic : action
- Raccourci : action
```

### Séquence pour documenter un composant
1. Chercher avec `mcp__spok__search_items` — ne pas créer si ça existe déjà
2. Identifier le bon espace dans la table ci-dessus
3. Créer avec `mcp__spok__create_item` (spaceId, parentId si sous-composant)
4. Renseigner : titre, description, statut
5. Mettre ce skill à jour si la structure change
